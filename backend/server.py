from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File, Depends, Response, Request
from fastapi.responses import JSONResponse, StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
import httpx
import io
import base64

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app
app = FastAPI(title="Af Maay AI Language Platform")

# Create router with /api prefix
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ============== PYDANTIC MODELS ==============

class UserBase(BaseModel):
    model_config = ConfigDict(extra="ignore")
    email: str
    name: str
    picture: Optional[str] = None

class User(UserBase):
    user_id: str
    created_at: datetime
    is_admin: bool = False

class UserSession(BaseModel):
    model_config = ConfigDict(extra="ignore")
    session_id: str
    user_id: str
    session_token: str
    expires_at: datetime
    created_at: datetime

# Dictionary Models
class DictionaryEntryBase(BaseModel):
    maay_word: str
    english_translation: str
    part_of_speech: str  # noun, verb, adjective, etc.
    sound_group: Optional[str] = None  # k, t, dh, n, b, r
    example_maay: Optional[str] = None
    example_english: Optional[str] = None
    audio_url: Optional[str] = None
    is_verified: bool = False
    contributor_id: Optional[str] = None

class DictionaryEntry(DictionaryEntryBase):
    entry_id: str
    created_at: datetime
    updated_at: datetime

class DictionaryEntryCreate(DictionaryEntryBase):
    pass

# Translation Models
class TranslationRequest(BaseModel):
    text: str
    source_language: str  # "en" or "maay"
    target_language: str  # "en" or "maay"

class TranslationResponse(BaseModel):
    original_text: str
    translated_text: str
    source_language: str
    target_language: str
    vocabulary_gaps: List[str] = []
    confidence: float = 0.8

# Conversation Models
class ConversationMessage(BaseModel):
    role: str  # "user" or "assistant"
    content: str
    timestamp: datetime
    audio_url: Optional[str] = None

class Conversation(BaseModel):
    conversation_id: str
    user_id: str
    messages: List[Dict[str, Any]]
    created_at: datetime
    updated_at: datetime

class ChatRequest(BaseModel):
    message: str
    conversation_id: Optional[str] = None
    language: str = "en"  # "en" or "maay"

class ChatResponse(BaseModel):
    response: str
    conversation_id: str
    vocabulary_gaps: List[str] = []
    audio_url: Optional[str] = None

# Grammar Models
class GrammarRule(BaseModel):
    rule_id: str
    category: str  # verb_morphology, nominal_morphology, syntax, etc.
    title: str
    content: str
    examples: List[Dict[str, str]] = []
    difficulty: str = "beginner"  # beginner, intermediate, advanced
    created_at: datetime

class GrammarRuleCreate(BaseModel):
    category: str
    title: str
    content: str
    examples: List[Dict[str, str]] = []
    difficulty: str = "beginner"

# Vocabulary Gap Models
class VocabularyGap(BaseModel):
    gap_id: str
    english_term: str
    context: str
    domain: str  # science, technology, humanities, etc.
    frequency: int = 1
    suggested_maay: Optional[str] = None
    status: str = "pending"  # pending, approved, rejected
    created_at: datetime

# ============== AUTH HELPERS ==============

async def get_session_from_token(session_token: str) -> Optional[Dict]:
    """Get session from token"""
    session_doc = await db.user_sessions.find_one(
        {"session_token": session_token},
        {"_id": 0}
    )
    if not session_doc:
        return None
    
    # Check expiry
    expires_at = session_doc.get("expires_at")
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        return None
    
    return session_doc

async def get_current_user(request: Request) -> Optional[Dict]:
    """Extract user from session token in cookie or Authorization header"""
    # Try cookie first
    session_token = request.cookies.get("session_token")
    
    # Fallback to Authorization header
    if not session_token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            session_token = auth_header.split(" ")[1]
    
    if not session_token:
        return None
    
    session = await get_session_from_token(session_token)
    if not session:
        return None
    
    user = await db.users.find_one(
        {"user_id": session["user_id"]},
        {"_id": 0}
    )
    return user

async def require_auth(request: Request) -> Dict:
    """Require authentication - raises HTTPException if not authenticated"""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user

async def require_admin(request: Request) -> Dict:
    """Require admin authentication"""
    user = await require_auth(request)
    if not user.get("is_admin", False):
        raise HTTPException(status_code=403, detail="Admin access required")
    return user

# ============== AUTH ROUTES ==============

@api_router.post("/auth/session")
async def process_session(request: Request, response: Response):
    """Process session_id from Emergent Auth and create session"""
    body = await request.json()
    session_id = body.get("session_id")
    
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id required")
    
    # Call Emergent Auth to get user data
    async with httpx.AsyncClient() as client:
        try:
            auth_response = await client.get(
                "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
                headers={"X-Session-ID": session_id}
            )
            if auth_response.status_code != 200:
                raise HTTPException(status_code=401, detail="Invalid session")
            
            user_data = auth_response.json()
        except Exception as e:
            logger.error(f"Auth error: {e}")
            raise HTTPException(status_code=401, detail="Authentication failed")
    
    # Check if user exists
    existing_user = await db.users.find_one({"email": user_data["email"]}, {"_id": 0})
    
    if existing_user:
        user_id = existing_user["user_id"]
        # Update user data
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {"name": user_data["name"], "picture": user_data.get("picture")}}
        )
    else:
        # Create new user
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        new_user = {
            "user_id": user_id,
            "email": user_data["email"],
            "name": user_data["name"],
            "picture": user_data.get("picture"),
            "is_admin": False,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.users.insert_one(new_user)
    
    # Create session
    session_token = user_data.get("session_token", f"session_{uuid.uuid4().hex}")
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    
    session_doc = {
        "session_id": str(uuid.uuid4()),
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": expires_at.isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.user_sessions.insert_one(session_doc)
    
    # Set cookie
    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
        max_age=7 * 24 * 60 * 60
    )
    
    # Get user for response
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    
    return {"user": user, "session_token": session_token}

@api_router.get("/auth/me")
async def get_me(request: Request):
    """Get current authenticated user"""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user

@api_router.post("/auth/logout")
async def logout(request: Request, response: Response):
    """Logout user"""
    session_token = request.cookies.get("session_token")
    if session_token:
        await db.user_sessions.delete_one({"session_token": session_token})
    
    response.delete_cookie(key="session_token", path="/")
    return {"message": "Logged out successfully"}

# ============== DICTIONARY ROUTES ==============

@api_router.get("/dictionary", response_model=List[Dict])
async def get_dictionary_entries(
    search: Optional[str] = None,
    language: Optional[str] = None,  # "maay" or "en"
    sound_group: Optional[str] = None,
    verified_only: bool = False,
    limit: int = 50,
    skip: int = 0
):
    """Get dictionary entries with search and filter"""
    query = {}
    
    if verified_only:
        query["is_verified"] = True
    
    if sound_group:
        query["sound_group"] = sound_group
    
    if search:
        if language == "maay":
            query["maay_word"] = {"$regex": search, "$options": "i"}
        elif language == "en":
            query["english_translation"] = {"$regex": search, "$options": "i"}
        else:
            # Search both
            query["$or"] = [
                {"maay_word": {"$regex": search, "$options": "i"}},
                {"english_translation": {"$regex": search, "$options": "i"}}
            ]
    
    entries = await db.dictionary.find(query, {"_id": 0}).skip(skip).limit(limit).to_list(limit)
    return entries

@api_router.get("/dictionary/{entry_id}")
async def get_dictionary_entry(entry_id: str):
    """Get single dictionary entry"""
    entry = await db.dictionary.find_one({"entry_id": entry_id}, {"_id": 0})
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    return entry

@api_router.post("/dictionary")
async def create_dictionary_entry(entry: DictionaryEntryCreate, request: Request):
    """Create new dictionary entry (requires auth)"""
    user = await require_auth(request)
    
    entry_doc = entry.model_dump()
    entry_doc["entry_id"] = f"dict_{uuid.uuid4().hex[:12]}"
    entry_doc["contributor_id"] = user["user_id"]
    entry_doc["is_verified"] = user.get("is_admin", False)  # Auto-verify if admin
    entry_doc["created_at"] = datetime.now(timezone.utc).isoformat()
    entry_doc["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.dictionary.insert_one(entry_doc)
    
    # Remove _id for response
    entry_doc.pop("_id", None)
    return entry_doc

@api_router.put("/dictionary/{entry_id}")
async def update_dictionary_entry(entry_id: str, entry: DictionaryEntryCreate, request: Request):
    """Update dictionary entry (admin only)"""
    await require_admin(request)
    
    existing = await db.dictionary.find_one({"entry_id": entry_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Entry not found")
    
    update_data = entry.model_dump()
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.dictionary.update_one(
        {"entry_id": entry_id},
        {"$set": update_data}
    )
    
    updated = await db.dictionary.find_one({"entry_id": entry_id}, {"_id": 0})
    return updated

@api_router.delete("/dictionary/{entry_id}")
async def delete_dictionary_entry(entry_id: str, request: Request):
    """Delete dictionary entry (admin only)"""
    await require_admin(request)
    
    result = await db.dictionary.delete_one({"entry_id": entry_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Entry not found")
    
    return {"message": "Entry deleted successfully"}

@api_router.post("/dictionary/{entry_id}/verify")
async def verify_dictionary_entry(entry_id: str, request: Request):
    """Verify a dictionary entry (admin only)"""
    await require_admin(request)
    
    result = await db.dictionary.update_one(
        {"entry_id": entry_id},
        {"$set": {"is_verified": True, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Entry not found")
    
    return {"message": "Entry verified successfully"}

# ============== TRANSLATION ROUTES ==============

@api_router.post("/translate", response_model=TranslationResponse)
async def translate_text(req: TranslationRequest):
    """Translate text between English and Af Maay"""
    from emergentintegrations.llm.chat import LlmChat, UserMessage
    
    api_key = os.environ.get("EMERGENT_LLM_KEY")
    
    # Build context from dictionary
    dict_entries = await db.dictionary.find({"is_verified": True}, {"_id": 0}).limit(100).to_list(100)
    dict_context = "\n".join([f"- {e.get('maay_word', '')}: {e.get('english_translation', '')}" for e in dict_entries])
    
    system_message = f"""You are an expert translator for Af Maay (also called Maay Maay), a Somali language variant. 
    
Key language rules:
- Af Maay uses SOV (Subject-Object-Verb) word order
- Sound groups: k, t, dh, n, b, r (affects noun declension)
- Verb conjugation follows 7 person system across 3 tenses

Dictionary reference:
{dict_context}

If a word cannot be translated, keep it in English and mark it with (untranslated).
Provide natural, grammatically correct translations."""

    chat = LlmChat(
        api_key=api_key,
        session_id=f"translate_{uuid.uuid4().hex[:8]}",
        system_message=system_message
    ).with_model("openai", "gpt-4o")
    
    direction = f"{req.source_language} to {req.target_language}"
    prompt = f"Translate the following from {direction}:\n\n{req.text}\n\nProvide only the translation."
    
    try:
        response = await chat.send_message(UserMessage(text=prompt))
        translated = response.strip()
        
        # Detect vocabulary gaps
        vocabulary_gaps = []
        if "(untranslated)" in translated:
            import re
            gaps = re.findall(r'(\w+)\s*\(untranslated\)', translated)
            vocabulary_gaps = gaps
            
            # Log gaps for analysis
            for gap in gaps:
                existing = await db.vocabulary_gaps.find_one({"english_term": gap.lower()})
                if existing:
                    await db.vocabulary_gaps.update_one(
                        {"english_term": gap.lower()},
                        {"$inc": {"frequency": 1}}
                    )
                else:
                    gap_doc = {
                        "gap_id": f"gap_{uuid.uuid4().hex[:12]}",
                        "english_term": gap.lower(),
                        "context": req.text,
                        "domain": "general",
                        "frequency": 1,
                        "status": "pending",
                        "created_at": datetime.now(timezone.utc).isoformat()
                    }
                    await db.vocabulary_gaps.insert_one(gap_doc)
        
        return TranslationResponse(
            original_text=req.text,
            translated_text=translated,
            source_language=req.source_language,
            target_language=req.target_language,
            vocabulary_gaps=vocabulary_gaps
        )
    except Exception as e:
        logger.error(f"Translation error: {e}")
        raise HTTPException(status_code=500, detail="Translation failed")

# ============== CHAT/CONVERSATION ROUTES ==============

@api_router.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest, request: Request):
    """Chat with AI in English or Af Maay"""
    from emergentintegrations.llm.chat import LlmChat, UserMessage
    
    user = await get_current_user(request)
    user_id = user["user_id"] if user else "anonymous"
    
    api_key = os.environ.get("EMERGENT_LLM_KEY")
    
    # Get or create conversation
    conversation_id = req.conversation_id or f"conv_{uuid.uuid4().hex[:12]}"
    
    conversation = await db.conversations.find_one({"conversation_id": conversation_id}, {"_id": 0})
    if not conversation:
        conversation = {
            "conversation_id": conversation_id,
            "user_id": user_id,
            "messages": [],
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        await db.conversations.insert_one(conversation)
    
    # Build context from dictionary
    dict_entries = await db.dictionary.find({"is_verified": True}, {"_id": 0}).limit(50).to_list(50)
    dict_context = "\n".join([f"- {e.get('maay_word', '')}: {e.get('english_translation', '')}" for e in dict_entries])
    
    system_message = f"""You are a helpful AI assistant for Af Maay language learning and translation.

About Af Maay:
- Af Maay (also called Maay Maay) is a Somali language variant
- It uses SOV (Subject-Object-Verb) word order
- It has 6 sound groups: k, t, dh, n, b, r
- Verbs conjugate for 7 persons across 3 tenses

Dictionary reference:
{dict_context}

Guidelines:
- If the user speaks in Af Maay, respond in Af Maay
- If the user speaks in English, respond in English
- Help with translations, grammar questions, and language learning
- If you don't know a word in Af Maay, say so and keep it in English marked as (untranslated)
- Be encouraging and supportive of language learners"""

    chat_client = LlmChat(
        api_key=api_key,
        session_id=conversation_id,
        system_message=system_message
    ).with_model("openai", "gpt-4o")
    
    try:
        response = await chat_client.send_message(UserMessage(text=req.message))
        
        # Update conversation
        new_messages = conversation.get("messages", [])
        new_messages.append({
            "role": "user",
            "content": req.message,
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
        new_messages.append({
            "role": "assistant",
            "content": response,
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
        
        await db.conversations.update_one(
            {"conversation_id": conversation_id},
            {"$set": {
                "messages": new_messages,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        # Detect vocabulary gaps
        vocabulary_gaps = []
        if "(untranslated)" in response:
            import re
            gaps = re.findall(r'(\w+)\s*\(untranslated\)', response)
            vocabulary_gaps = gaps
        
        return ChatResponse(
            response=response,
            conversation_id=conversation_id,
            vocabulary_gaps=vocabulary_gaps
        )
    except Exception as e:
        logger.error(f"Chat error: {e}")
        raise HTTPException(status_code=500, detail="Chat failed")

@api_router.get("/conversations")
async def get_conversations(request: Request):
    """Get user's conversations"""
    user = await require_auth(request)
    conversations = await db.conversations.find(
        {"user_id": user["user_id"]},
        {"_id": 0}
    ).sort("updated_at", -1).limit(20).to_list(20)
    return conversations

@api_router.get("/conversations/{conversation_id}")
async def get_conversation(conversation_id: str, request: Request):
    """Get single conversation"""
    user = await require_auth(request)
    conversation = await db.conversations.find_one(
        {"conversation_id": conversation_id, "user_id": user["user_id"]},
        {"_id": 0}
    )
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conversation

# ============== VOICE ROUTES ==============

@api_router.post("/voice/transcribe")
async def transcribe_audio(file: UploadFile = File(...)):
    """Transcribe audio to text using Whisper"""
    from emergentintegrations.llm.openai import OpenAISpeechToText
    
    api_key = os.environ.get("EMERGENT_LLM_KEY")
    
    # Read file
    content = await file.read()
    
    try:
        stt = OpenAISpeechToText(api_key=api_key)
        
        # Create file-like object
        audio_file = io.BytesIO(content)
        audio_file.name = file.filename or "audio.webm"
        
        response = await stt.transcribe(
            file=audio_file,
            model="whisper-1",
            response_format="json"
        )
        
        return {"text": response.text}
    except Exception as e:
        logger.error(f"Transcription error: {e}")
        raise HTTPException(status_code=500, detail="Transcription failed")

@api_router.post("/voice/synthesize")
async def synthesize_speech(request: Request):
    """Synthesize text to speech"""
    from openai import AsyncOpenAI
    
    body = await request.json()
    text = body.get("text", "")
    voice = body.get("voice", "alloy")  # alloy, echo, fable, onyx, nova, shimmer
    
    if not text:
        raise HTTPException(status_code=400, detail="Text required")
    
    api_key = os.environ.get("EMERGENT_LLM_KEY")
    
    try:
        client = AsyncOpenAI(api_key=api_key)
        
        response = await client.audio.speech.create(
            model="tts-1",
            voice=voice,
            input=text
        )
        
        # Get audio bytes
        audio_content = response.content
        
        # Return as base64
        audio_base64 = base64.b64encode(audio_content).decode('utf-8')
        
        return {"audio": audio_base64, "format": "mp3"}
    except Exception as e:
        logger.error(f"TTS error: {e}")
        raise HTTPException(status_code=500, detail="Speech synthesis failed")

# ============== GRAMMAR ROUTES ==============

@api_router.get("/grammar", response_model=List[Dict])
async def get_grammar_rules(
    category: Optional[str] = None,
    difficulty: Optional[str] = None,
    search: Optional[str] = None
):
    """Get grammar rules"""
    query = {}
    
    if category:
        query["category"] = category
    if difficulty:
        query["difficulty"] = difficulty
    if search:
        query["$or"] = [
            {"title": {"$regex": search, "$options": "i"}},
            {"content": {"$regex": search, "$options": "i"}}
        ]
    
    rules = await db.grammar_rules.find(query, {"_id": 0}).to_list(100)
    return rules

@api_router.get("/grammar/{rule_id}")
async def get_grammar_rule(rule_id: str):
    """Get single grammar rule"""
    rule = await db.grammar_rules.find_one({"rule_id": rule_id}, {"_id": 0})
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    return rule

@api_router.post("/grammar")
async def create_grammar_rule(rule: GrammarRuleCreate, request: Request):
    """Create grammar rule (admin only)"""
    await require_admin(request)
    
    rule_doc = rule.model_dump()
    rule_doc["rule_id"] = f"rule_{uuid.uuid4().hex[:12]}"
    rule_doc["created_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.grammar_rules.insert_one(rule_doc)
    rule_doc.pop("_id", None)
    return rule_doc

# ============== VOCABULARY GAPS ROUTES ==============

@api_router.get("/vocabulary-gaps")
async def get_vocabulary_gaps(
    status: Optional[str] = None,
    domain: Optional[str] = None
):
    """Get vocabulary gaps"""
    query = {}
    if status:
        query["status"] = status
    if domain:
        query["domain"] = domain
    
    gaps = await db.vocabulary_gaps.find(query, {"_id": 0}).sort("frequency", -1).to_list(100)
    return gaps

@api_router.post("/vocabulary-gaps/{gap_id}/suggest")
async def suggest_maay_equivalent(gap_id: str, request: Request):
    """Suggest Maay equivalent for a gap"""
    body = await request.json()
    suggested = body.get("suggested_maay")
    
    if not suggested:
        raise HTTPException(status_code=400, detail="suggested_maay required")
    
    result = await db.vocabulary_gaps.update_one(
        {"gap_id": gap_id},
        {"$set": {"suggested_maay": suggested}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Gap not found")
    
    return {"message": "Suggestion added"}

@api_router.post("/vocabulary-gaps/{gap_id}/approve")
async def approve_vocabulary_gap(gap_id: str, request: Request):
    """Approve gap suggestion and add to dictionary (admin only)"""
    await require_admin(request)
    
    gap = await db.vocabulary_gaps.find_one({"gap_id": gap_id}, {"_id": 0})
    if not gap or not gap.get("suggested_maay"):
        raise HTTPException(status_code=400, detail="Gap not found or no suggestion")
    
    # Create dictionary entry
    entry = {
        "entry_id": f"dict_{uuid.uuid4().hex[:12]}",
        "maay_word": gap["suggested_maay"],
        "english_translation": gap["english_term"],
        "part_of_speech": "noun",  # Default
        "is_verified": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    await db.dictionary.insert_one(entry)
    
    # Update gap status
    await db.vocabulary_gaps.update_one(
        {"gap_id": gap_id},
        {"$set": {"status": "approved"}}
    )
    
    return {"message": "Gap approved and added to dictionary"}

# ============== ADMIN ROUTES ==============

@api_router.get("/admin/stats")
async def get_admin_stats(request: Request):
    """Get admin statistics"""
    await require_admin(request)
    
    stats = {
        "dictionary_entries": await db.dictionary.count_documents({}),
        "verified_entries": await db.dictionary.count_documents({"is_verified": True}),
        "pending_entries": await db.dictionary.count_documents({"is_verified": False}),
        "users": await db.users.count_documents({}),
        "conversations": await db.conversations.count_documents({}),
        "vocabulary_gaps": await db.vocabulary_gaps.count_documents({"status": "pending"}),
        "grammar_rules": await db.grammar_rules.count_documents({})
    }
    
    return stats

@api_router.get("/admin/pending-entries")
async def get_pending_entries(request: Request):
    """Get pending dictionary entries for review"""
    await require_admin(request)
    
    entries = await db.dictionary.find(
        {"is_verified": False},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    return entries

@api_router.post("/admin/bulk-upload/dictionary")
async def bulk_upload_dictionary(request: Request):
    """Bulk upload dictionary entries (admin only)"""
    await require_admin(request)
    
    body = await request.json()
    entries = body.get("entries", [])
    
    if not entries:
        raise HTTPException(status_code=400, detail="No entries provided")
    
    created = 0
    for entry_data in entries:
        entry = {
            "entry_id": f"dict_{uuid.uuid4().hex[:12]}",
            "maay_word": entry_data.get("maay_word", ""),
            "english_translation": entry_data.get("english_translation", ""),
            "part_of_speech": entry_data.get("part_of_speech", "noun"),
            "sound_group": entry_data.get("sound_group"),
            "example_maay": entry_data.get("example_maay"),
            "example_english": entry_data.get("example_english"),
            "is_verified": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        await db.dictionary.insert_one(entry)
        created += 1
    
    return {"message": f"Created {created} entries"}

@api_router.post("/admin/make-admin/{user_id}")
async def make_admin(user_id: str, request: Request):
    """Make a user admin (admin only)"""
    await require_admin(request)
    
    result = await db.users.update_one(
        {"user_id": user_id},
        {"$set": {"is_admin": True}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {"message": "User is now admin"}

# ============== HEALTH CHECK ==============

@api_router.get("/")
async def root():
    return {"message": "Af Maay AI Language Platform API", "version": "1.0.0"}

@api_router.get("/health")
async def health():
    return {"status": "healthy"}

# Include router
app.include_router(api_router)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
