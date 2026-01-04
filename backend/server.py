from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File, Depends, Response, Request, Form
from fastapi.responses import JSONResponse, StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
import httpx
import io
import base64
import hashlib
import secrets

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
    is_contributor: bool = False

class UserSession(BaseModel):
    model_config = ConfigDict(extra="ignore")
    session_id: str
    user_id: str
    session_token: str
    expires_at: datetime
    created_at: datetime

# Auth Models
class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    name: str

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

# Dictionary Models
class DictionaryEntryBase(BaseModel):
    maay_word: str
    english_translation: str
    part_of_speech: str
    sound_group: Optional[str] = None
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

class DictionaryEntryUpdate(BaseModel):
    maay_word: Optional[str] = None
    english_translation: Optional[str] = None
    part_of_speech: Optional[str] = None
    sound_group: Optional[str] = None
    example_maay: Optional[str] = None
    example_english: Optional[str] = None

# Edit Suggestion Models
class EditSuggestion(BaseModel):
    suggestion_id: str
    entry_id: str
    user_id: str
    user_name: str
    changes: Dict[str, Any]
    reason: Optional[str] = None
    status: str = "pending"  # pending, approved, rejected
    created_at: datetime

class EditSuggestionCreate(BaseModel):
    entry_id: str
    changes: Dict[str, Any]
    reason: Optional[str] = None

# Translation Models
class TranslationRequest(BaseModel):
    text: str
    source_language: str
    target_language: str

class TranslationResponse(BaseModel):
    original_text: str
    translated_text: str
    source_language: str
    target_language: str
    vocabulary_gaps: List[str] = []
    confidence: float = 0.8
    note: Optional[str] = None

# Conversation Models
class ChatRequest(BaseModel):
    message: str
    conversation_id: Optional[str] = None
    language: str = "en"

class ChatResponse(BaseModel):
    response: str
    conversation_id: str
    vocabulary_gaps: List[str] = []
    audio_url: Optional[str] = None

# Grammar Models
class GrammarRule(BaseModel):
    rule_id: str
    category: str
    title: str
    content: str
    examples: List[Dict[str, str]] = []
    difficulty: str = "beginner"
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
    domain: str
    frequency: int = 1
    suggested_maay: Optional[str] = None
    status: str = "pending"
    created_at: datetime

# Donation Models
class DonationCreate(BaseModel):
    amount: int  # in cents
    currency: str = "usd"
    donor_email: str
    donor_name: str
    is_recurring: bool = False
    message: Optional[str] = None

# ============== PASSWORD HELPERS ==============

def hash_password(password: str) -> str:
    """Hash password with salt"""
    salt = secrets.token_hex(16)
    pwd_hash = hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), 100000)
    return f"{salt}:{pwd_hash.hex()}"

def verify_password(password: str, stored_hash: str) -> bool:
    """Verify password against stored hash"""
    try:
        salt, pwd_hash = stored_hash.split(':')
        new_hash = hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), 100000)
        return new_hash.hex() == pwd_hash
    except:
        return False

# ============== AUTH HELPERS ==============

async def get_session_from_token(session_token: str) -> Optional[Dict]:
    """Get session from token"""
    session_doc = await db.user_sessions.find_one(
        {"session_token": session_token},
        {"_id": 0}
    )
    if not session_doc:
        return None
    
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
    session_token = request.cookies.get("session_token")
    
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
    """Require authentication"""
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

async def require_contributor(request: Request) -> Dict:
    """Require contributor or admin"""
    user = await require_auth(request)
    if not user.get("is_admin", False) and not user.get("is_contributor", False):
        raise HTTPException(status_code=403, detail="Contributor access required")
    return user

# ============== AUTH ROUTES ==============

@api_router.post("/auth/register")
async def register(req: RegisterRequest, response: Response):
    """Register new user with email/password"""
    # Check if email exists
    existing = await db.users.find_one({"email": req.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create user
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    password_hash = hash_password(req.password)
    
    user_doc = {
        "user_id": user_id,
        "email": req.email,
        "name": req.name,
        "password_hash": password_hash,
        "picture": None,
        "is_admin": False,
        "is_contributor": False,
        "auth_type": "email",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(user_doc)
    
    # Create session
    session_token = f"session_{uuid.uuid4().hex}"
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
    
    # Return user without password
    user_doc.pop("password_hash", None)
    user_doc.pop("_id", None)
    
    return {"user": user_doc, "session_token": session_token}

@api_router.post("/auth/login")
async def login(req: LoginRequest, response: Response):
    """Login with email/password"""
    user = await db.users.find_one({"email": req.email}, {"_id": 0})
    
    if not user or not user.get("password_hash"):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    if not verify_password(req.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    # Create session
    session_token = f"session_{uuid.uuid4().hex}"
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    
    session_doc = {
        "session_id": str(uuid.uuid4()),
        "user_id": user["user_id"],
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
    
    # Return user without password
    user.pop("password_hash", None)
    
    return {"user": user, "session_token": session_token}

@api_router.post("/auth/session")
async def process_session(request: Request, response: Response):
    """Process session_id from Emergent Auth (Google OAuth)"""
    body = await request.json()
    session_id = body.get("session_id")
    
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id required")
    
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
    
    existing_user = await db.users.find_one({"email": user_data["email"]}, {"_id": 0})
    
    if existing_user:
        user_id = existing_user["user_id"]
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {"name": user_data["name"], "picture": user_data.get("picture")}}
        )
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        new_user = {
            "user_id": user_id,
            "email": user_data["email"],
            "name": user_data["name"],
            "picture": user_data.get("picture"),
            "is_admin": False,
            "is_contributor": False,
            "auth_type": "google",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.users.insert_one(new_user)
    
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
    
    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
        max_age=7 * 24 * 60 * 60
    )
    
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0})
    
    return {"user": user, "session_token": session_token}

@api_router.get("/auth/me")
async def get_me(request: Request):
    """Get current authenticated user"""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user.pop("password_hash", None)
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
    language: Optional[str] = None,
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
    entry_doc["contributor_name"] = user.get("name", "Anonymous")
    entry_doc["is_verified"] = user.get("is_admin", False)
    entry_doc["created_at"] = datetime.now(timezone.utc).isoformat()
    entry_doc["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.dictionary.insert_one(entry_doc)
    entry_doc.pop("_id", None)
    return entry_doc

@api_router.put("/dictionary/{entry_id}")
async def update_dictionary_entry(entry_id: str, entry: DictionaryEntryUpdate, request: Request):
    """Update dictionary entry (admin/contributor only)"""
    user = await require_contributor(request)
    
    existing = await db.dictionary.find_one({"entry_id": entry_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Entry not found")
    
    update_data = {k: v for k, v in entry.model_dump().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    update_data["last_edited_by"] = user["user_id"]
    
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

# ============== EDIT SUGGESTIONS ROUTES ==============

@api_router.post("/dictionary/{entry_id}/suggest-edit")
async def suggest_edit(entry_id: str, suggestion: EditSuggestionCreate, request: Request):
    """Suggest an edit to a dictionary entry"""
    user = await require_auth(request)
    
    # Verify entry exists
    entry = await db.dictionary.find_one({"entry_id": entry_id})
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    
    suggestion_doc = {
        "suggestion_id": f"sugg_{uuid.uuid4().hex[:12]}",
        "entry_id": entry_id,
        "user_id": user["user_id"],
        "user_name": user.get("name", "Anonymous"),
        "changes": suggestion.changes,
        "reason": suggestion.reason,
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.edit_suggestions.insert_one(suggestion_doc)
    suggestion_doc.pop("_id", None)
    return suggestion_doc

@api_router.get("/edit-suggestions")
async def get_edit_suggestions(status: Optional[str] = "pending", request: Request = None):
    """Get edit suggestions (admin only)"""
    await require_admin(request)
    
    query = {}
    if status:
        query["status"] = status
    
    suggestions = await db.edit_suggestions.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    return suggestions

@api_router.post("/edit-suggestions/{suggestion_id}/approve")
async def approve_edit_suggestion(suggestion_id: str, request: Request):
    """Approve and apply edit suggestion"""
    await require_admin(request)
    
    suggestion = await db.edit_suggestions.find_one({"suggestion_id": suggestion_id}, {"_id": 0})
    if not suggestion:
        raise HTTPException(status_code=404, detail="Suggestion not found")
    
    # Apply changes to entry
    await db.dictionary.update_one(
        {"entry_id": suggestion["entry_id"]},
        {"$set": {
            **suggestion["changes"],
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Update suggestion status
    await db.edit_suggestions.update_one(
        {"suggestion_id": suggestion_id},
        {"$set": {"status": "approved"}}
    )
    
    return {"message": "Edit suggestion approved and applied"}

@api_router.post("/edit-suggestions/{suggestion_id}/reject")
async def reject_edit_suggestion(suggestion_id: str, request: Request):
    """Reject edit suggestion"""
    await require_admin(request)
    
    result = await db.edit_suggestions.update_one(
        {"suggestion_id": suggestion_id},
        {"$set": {"status": "rejected"}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Suggestion not found")
    
    return {"message": "Edit suggestion rejected"}

# ============== TRANSLATION ROUTES ==============

@api_router.post("/translate", response_model=TranslationResponse)
async def translate_text(req: TranslationRequest):
    """Translate text between English and Af Maay"""
    from emergentintegrations.llm.chat import LlmChat, UserMessage
    
    api_key = os.environ.get("EMERGENT_LLM_KEY")
    
    # Build context from dictionary
    dict_entries = await db.dictionary.find({"is_verified": True}, {"_id": 0}).limit(100).to_list(100)
    dict_context = "\n".join([f"- {e.get('maay_word', '')}: {e.get('english_translation', '')}" for e in dict_entries])
    
    system_message = f"""You are an expert translator for Af Maay (also called Maay Maay or Maay Tiri).

IMPORTANT: Af Maay is DISTINCT from Standard Somali (Maxaa Tiri). They share roots but have different:
- Vocabulary
- Pronunciation
- Some grammatical structures

Key Af Maay language rules:
- Uses SOV (Subject-Object-Verb) word order
- Has 6 sound groups: k, t, dh, n, b, r (affects noun declension and verb conjugation)
- Verb conjugation follows 7 person system across 3 tenses
- Many words differ from Standard Somali

VERIFIED Af Maay Dictionary (use these words when possible):
{dict_context}

Translation Guidelines:
1. Prefer words from the verified dictionary above
2. If a word is NOT in the dictionary, you may attempt translation but mark uncertain words
3. Keep words in English if you're not confident about the Af Maay equivalent, mark as (needs verification)
4. Provide natural, grammatically correct translations following SOV order"""

    chat = LlmChat(
        api_key=api_key,
        session_id=f"translate_{uuid.uuid4().hex[:8]}",
        system_message=system_message
    ).with_model("openai", "gpt-4o")
    
    direction = f"{req.source_language} to {req.target_language}"
    prompt = f"Translate the following from {direction}:\n\n{req.text}\n\nProvide only the translation, using verified Af Maay words when available."
    
    try:
        response = await chat.send_message(UserMessage(text=prompt))
        translated = response.strip()
        
        # Detect vocabulary gaps
        vocabulary_gaps = []
        import re
        if "(needs verification)" in translated or "(untranslated)" in translated:
            gaps = re.findall(r'(\w+)\s*\((?:needs verification|untranslated)\)', translated)
            vocabulary_gaps = gaps
            
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
        
        note = "Translation uses verified Af Maay dictionary. Words marked (needs verification) may need review by native speakers."
        
        return TranslationResponse(
            original_text=req.text,
            translated_text=translated,
            source_language=req.source_language,
            target_language=req.target_language,
            vocabulary_gaps=vocabulary_gaps,
            note=note
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
    
    system_message = f"""You are a helpful AI assistant specializing in Af Maay language learning and preservation.

IMPORTANT DISTINCTION:
- Af Maay (Maay Maay, Maay Tiri) is DIFFERENT from Standard Somali (Maxaa Tiri)
- They are related but distinct language varieties
- When teaching or translating, use Af Maay specifically, not Standard Somali

About Af Maay:
- Spoken primarily in southern Somalia (Bay, Bakool, parts of other regions)
- Uses SOV (Subject-Object-Verb) word order
- Has 6 sound groups: k, t, dh, n, b, r
- Verbs conjugate for 7 persons across 3 tenses
- Many vocabulary differences from Standard Somali

Verified Af Maay Dictionary:
{dict_context}

Guidelines:
- If the user speaks in Af Maay, respond in Af Maay
- If the user speaks in English, respond in English
- Use words from the verified dictionary when possible
- If you don't know a word in Af Maay, say so honestly
- Be encouraging and supportive of language learners
- Help preserve and promote authentic Af Maay usage"""

    chat_client = LlmChat(
        api_key=api_key,
        session_id=conversation_id,
        system_message=system_message
    ).with_model("openai", "gpt-4o")
    
    try:
        response = await chat_client.send_message(UserMessage(text=req.message))
        
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
        
        vocabulary_gaps = []
        import re
        if "(needs verification)" in response or "(untranslated)" in response:
            gaps = re.findall(r'(\w+)\s*\((?:needs verification|untranslated)\)', response)
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
    content = await file.read()
    
    try:
        stt = OpenAISpeechToText(api_key=api_key)
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
    from emergentintegrations.llm.openai import OpenAITextToSpeech
    
    body = await request.json()
    text = body.get("text", "")
    voice = body.get("voice", "alloy")
    
    if not text:
        raise HTTPException(status_code=400, detail="Text required")
    
    api_key = os.environ.get("EMERGENT_LLM_KEY")
    
    try:
        tts = OpenAITextToSpeech(api_key=api_key)
        audio_base64 = await tts.generate_speech_base64(
            text=text,
            model="tts-1",
            voice=voice
        )
        
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
    
    entry = {
        "entry_id": f"dict_{uuid.uuid4().hex[:12]}",
        "maay_word": gap["suggested_maay"],
        "english_translation": gap["english_term"],
        "part_of_speech": "noun",
        "is_verified": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    await db.dictionary.insert_one(entry)
    
    await db.vocabulary_gaps.update_one(
        {"gap_id": gap_id},
        {"$set": {"status": "approved"}}
    )
    
    return {"message": "Gap approved and added to dictionary"}

# ============== DONATION ROUTES ==============

@api_router.post("/donations/create-checkout")
async def create_donation_checkout(donation: DonationCreate):
    """Create Stripe checkout session for donation"""
    import stripe
    
    stripe_key = os.environ.get("STRIPE_SECRET_KEY")
    if not stripe_key:
        raise HTTPException(status_code=500, detail="Donation system not configured")
    
    stripe.api_key = stripe_key
    
    try:
        # Create checkout session
        session_params = {
            "payment_method_types": ["card"],
            "line_items": [{
                "price_data": {
                    "currency": donation.currency,
                    "product_data": {
                        "name": "Donation to Af Maay Language Preservation",
                        "description": "Support the preservation and digitization of Af Maay language",
                    },
                    "unit_amount": donation.amount,
                },
                "quantity": 1,
            }],
            "mode": "subscription" if donation.is_recurring else "payment",
            "success_url": f"{os.environ.get('FRONTEND_URL', 'http://localhost:3000')}/donation-success?session_id={{CHECKOUT_SESSION_ID}}",
            "cancel_url": f"{os.environ.get('FRONTEND_URL', 'http://localhost:3000')}/donate",
            "customer_email": donation.donor_email,
            "metadata": {
                "donor_name": donation.donor_name,
                "message": donation.message or "",
                "is_recurring": str(donation.is_recurring)
            }
        }
        
        if donation.is_recurring:
            session_params["line_items"][0]["price_data"]["recurring"] = {"interval": "month"}
        
        session = stripe.checkout.Session.create(**session_params)
        
        # Store donation record
        donation_doc = {
            "donation_id": f"don_{uuid.uuid4().hex[:12]}",
            "stripe_session_id": session.id,
            "amount": donation.amount,
            "currency": donation.currency,
            "donor_email": donation.donor_email,
            "donor_name": donation.donor_name,
            "is_recurring": donation.is_recurring,
            "message": donation.message,
            "status": "pending",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.donations.insert_one(donation_doc)
        
        return {"checkout_url": session.url, "session_id": session.id}
    except Exception as e:
        logger.error(f"Stripe error: {e}")
        raise HTTPException(status_code=500, detail="Failed to create checkout session")

@api_router.post("/donations/webhook")
async def donation_webhook(request: Request):
    """Handle Stripe webhook for donation completion"""
    import stripe
    
    stripe_key = os.environ.get("STRIPE_SECRET_KEY")
    webhook_secret = os.environ.get("STRIPE_WEBHOOK_SECRET")
    
    if not stripe_key:
        raise HTTPException(status_code=500, detail="Stripe not configured")
    
    stripe.api_key = stripe_key
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")
    
    try:
        if webhook_secret:
            event = stripe.Webhook.construct_event(payload, sig_header, webhook_secret)
        else:
            event = stripe.Event.construct_from(
                payload.decode("utf-8"), stripe.api_key
            )
        
        if event["type"] == "checkout.session.completed":
            session = event["data"]["object"]
            
            # Update donation status
            await db.donations.update_one(
                {"stripe_session_id": session["id"]},
                {"$set": {
                    "status": "completed",
                    "completed_at": datetime.now(timezone.utc).isoformat()
                }}
            )
            
            # TODO: Send tax receipt email
            
        return {"status": "success"}
    except Exception as e:
        logger.error(f"Webhook error: {e}")
        raise HTTPException(status_code=400, detail="Webhook failed")

@api_router.get("/donations/stats")
async def get_donation_stats():
    """Get public donation statistics"""
    total_donations = await db.donations.count_documents({"status": "completed"})
    
    # Calculate total amount
    pipeline = [
        {"$match": {"status": "completed"}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
    ]
    result = await db.donations.aggregate(pipeline).to_list(1)
    total_amount = result[0]["total"] if result else 0
    
    return {
        "total_donations": total_donations,
        "total_amount_cents": total_amount,
        "total_amount_display": f"${total_amount / 100:.2f}"
    }

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
        "contributors": await db.users.count_documents({"is_contributor": True}),
        "conversations": await db.conversations.count_documents({}),
        "vocabulary_gaps": await db.vocabulary_gaps.count_documents({"status": "pending"}),
        "grammar_rules": await db.grammar_rules.count_documents({}),
        "edit_suggestions": await db.edit_suggestions.count_documents({"status": "pending"}),
        "donations": await db.donations.count_documents({"status": "completed"})
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

@api_router.post("/admin/make-contributor/{user_id}")
async def make_contributor(user_id: str, request: Request):
    """Make a user contributor (admin only)"""
    await require_admin(request)
    
    result = await db.users.update_one(
        {"user_id": user_id},
        {"$set": {"is_contributor": True}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {"message": "User is now a contributor"}

@api_router.get("/admin/users")
async def get_users(request: Request):
    """Get all users (admin only)"""
    await require_admin(request)
    
    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(500)
    return users

# ============== FILE UPLOAD ROUTES ==============

@api_router.post("/upload/dictionary-csv")
async def upload_dictionary_csv(file: UploadFile = File(...), request: Request = None):
    """Upload dictionary entries from CSV file"""
    await require_admin(request)
    
    import csv
    
    content = await file.read()
    text = content.decode('utf-8')
    
    reader = csv.DictReader(io.StringIO(text))
    created = 0
    
    for row in reader:
        entry = {
            "entry_id": f"dict_{uuid.uuid4().hex[:12]}",
            "maay_word": row.get("maay_word", row.get("word", "")),
            "english_translation": row.get("english_translation", row.get("translation", row.get("english", ""))),
            "part_of_speech": row.get("part_of_speech", row.get("pos", "noun")),
            "sound_group": row.get("sound_group", row.get("group", None)),
            "example_maay": row.get("example_maay", row.get("example", None)),
            "example_english": row.get("example_english", None),
            "is_verified": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        if entry["maay_word"] and entry["english_translation"]:
            await db.dictionary.insert_one(entry)
            created += 1
    
    return {"message": f"Uploaded {created} entries from CSV"}

# ============== HEALTH CHECK ==============

@api_router.get("/")
async def root():
    return {"message": "Af Maay AI Language Platform API", "version": "2.0.0"}

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
