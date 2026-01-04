# Af Maay AI Language Platform - PRD

## Original Problem Statement
Building the first comprehensive digital platform for Af Maay, a previously undocumented Somali language variant that has existed exclusively in oral tradition. Platform combines AI-powered translation, speech recognition, educational modules, and collaborative vocabulary development.

## Architecture
- **Backend**: FastAPI (Python) with MongoDB
- **Frontend**: React with Tailwind CSS + shadcn/ui
- **AI**: OpenAI GPT-4o (via Emergent LLM Key) for translation/chat
- **Voice**: OpenAI Whisper (STT) + OpenAI TTS
- **Auth**: Google OAuth + Email/Password (JWT)
- **Payments**: Stripe for donations

## User Personas
1. **Native Af Maay speakers** - oral tradition background, voice-first users
2. **Diaspora community** - language learners seeking connection to heritage
3. **Language authority/Admin** - content verification and standardization
4. **Contributors** - community members adding vocabulary

## Core Requirements (Static)
- Voice-first UI design (40%+ screen for voice button)
- Bidirectional dictionary (English ↔ Af Maay)
- AI-powered translation with vocabulary gap tracking
- Conversational AI assistant
- Admin panel for content management
- Community contribution system
- Donation system with tax receipt capability

## What's Been Implemented (January 2025)

### Phase 1 MVP ✅
1. **Voice-Enabled AI Interaction**
   - OpenAI Whisper STT integration
   - OpenAI TTS for audio playback
   - Tap-to-talk UI on landing page

2. **Bilingual Dictionary**
   - Search by Maay or English
   - Sound group classification (k, t, dh, n, b, r)
   - Audio pronunciation for entries
   - Example sentences
   - Verified vs community entry distinction

3. **Translation Engine**
   - Sentence-level translation
   - Vocabulary gap detection and tracking
   - AI prompts distinguish Af Maay from Standard Somali

4. **AI Chat/Conversation**
   - Context-aware responses
   - Af Maay learning assistance
   - Conversation history

5. **Authentication**
   - Google OAuth
   - Email/Password registration
   - Session management with JWT

6. **Admin Panel**
   - Dashboard with statistics
   - Pending entry review queue
   - Vocabulary gap management
   - Bulk upload (JSON/CSV)
   - Grammar rules management
   - User management

7. **Collaboration Features**
   - Users can add words (pending review)
   - Suggest edits to existing entries
   - Admin approval workflow
   - Contributor role assignment

8. **Donation System**
   - One-time donations
   - Monthly recurring option
   - Stripe checkout integration
   - Tax deductible receipt capability

### Design Updates
- Dark theme: Black background, orange accents, white text
- Voice-first prominent button design
- Accessible WCAG 2.1 AA compliant

## Prioritized Backlog

### P0 (Critical - Next Sprint)
- [ ] Upload user's 1000+ dictionary entries
- [ ] Verb conjugation tables (7 persons × 3 tenses)
- [ ] Spell checker based on sound group rules

### P1 (High Priority)
- [ ] Offline dictionary caching
- [ ] Grammar reference library with examples
- [ ] Interactive learning exercises
- [ ] Mobile app optimization

### P2 (Medium Priority)
- [ ] AI-generated creative content (poetry, stories)
- [ ] Leaderboards for contributors
- [ ] Achievement/badge system
- [ ] Subject matter assistance (STEM, humanities)

### P3 (Future)
- [ ] Fine-tuned speech recognition for Af Maay
- [ ] Native mobile apps (iOS/Android)
- [ ] Domain-specific glossaries

## Next Tasks
1. User to provide dictionary data for bulk upload
2. Implement verb conjugation display
3. Add spell checker based on orthographic rules
4. Create grammar reference pages
5. Set up Stripe webhook for receipt delivery
