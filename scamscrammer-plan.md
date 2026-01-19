# ScamScrammer: AI Scam Call Interception System

**Project Type:** AI-Powered Telephony Application  
**Status:** Planning  
**Created:** January 2026

---

## Project Overview

ScamScrammer is an AI-powered phone answering system that intercepts suspected scam calls and wastes scammers' time by impersonating a confused, polite elderly person. The AI engages callers in meandering conversations—showing interest but never committing—while recording interactions for entertainment and analysis.

### Core Value Proposition

- **For Users:** Never deal with scam calls again; let AI handle them
- **For Entertainment:** Listen to recordings of scammers losing patience with an AI discussing armadillos
- **For Society:** Waste scammer resources, reducing their profitability

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         SCAMSCRAMMER ARCHITECTURE                        │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   ┌──────────────┐         ┌──────────────────┐                         │
│   │  Incoming    │         │   Twilio         │                         │
│   │  Scam Call   │────────▶│   Phone Number   │                         │
│   └──────────────┘         └────────┬─────────┘                         │
│                                     │                                    │
│                                     ▼                                    │
│                          ┌──────────────────┐                           │
│                          │  Webhook Handler │                           │
│                          │  (Next.js API)   │                           │
│                          └────────┬─────────┘                           │
│                                   │                                      │
│                    ┌──────────────┼──────────────┐                      │
│                    ▼              ▼              ▼                       │
│            ┌────────────┐ ┌────────────┐ ┌────────────┐                 │
│            │  OpenAI    │ │  Recording │ │  Call      │                 │
│            │  Realtime  │ │  Storage   │ │  Metadata  │                 │
│            │  Voice API │ │  (S3)      │ │  (Postgres)│                 │
│            └──────┬─────┘ └────────────┘ └────────────┘                 │
│                   │                                                      │
│                   ▼                                                      │
│            ┌────────────────────────────────────────┐                   │
│            │       "EARL" AI PERSONA                 │                   │
│            │  - Confused elderly gentleman          │                   │
│            │  - Polite but meandering               │                   │
│            │  - Never closes, always tangents       │                   │
│            │  - Mishears frequently                 │                   │
│            └────────────────────────────────────────┘                   │
│                                                                          │
│   ┌──────────────────────────────────────────────────────────────┐     │
│   │                    WEB DASHBOARD                              │     │
│   │  - Call history & recordings                                  │     │
│   │  - Best-of highlights                                         │     │
│   │  - Transcripts & stats                                        │     │
│   └──────────────────────────────────────────────────────────────┘     │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Telephony** | Twilio Voice | Phone number, call handling, recording |
| **Voice AI** | OpenAI Realtime API | Real-time voice conversation |
| **Custom Voice** | ElevenLabs (optional) | Elderly character voice cloning |
| **Framework** | Next.js 14+ | API routes + dashboard frontend |
| **Database** | PostgreSQL (via Supabase) | Call logs, user data, metadata |
| **Storage** | AWS S3 or Twilio | Audio recording storage |
| **Styling** | Tailwind CSS | Dashboard UI |
| **Deployment** | Vercel | Hosting with edge functions |

---

## Project Structure

```
scamscrammer/
├── src/
│   ├── app/
│   │   ├── page.tsx                    # Landing/dashboard
│   │   ├── layout.tsx
│   │   ├── calls/
│   │   │   ├── page.tsx                # Call history list
│   │   │   └── [id]/
│   │   │       └── page.tsx            # Individual call detail
│   │   └── api/
│   │       ├── twilio/
│   │       │   ├── incoming/
│   │       │   │   └── route.ts        # Webhook: incoming calls
│   │       │   ├── status/
│   │       │   │   └── route.ts        # Webhook: call status updates
│   │       │   └── recording/
│   │       │       └── route.ts        # Webhook: recording complete
│   │       ├── voice/
│   │       │   └── stream/
│   │       │       └── route.ts        # WebSocket: real-time voice
│   │       └── calls/
│   │           └── route.ts            # REST: call history CRUD
│   ├── lib/
│   │   ├── twilio.ts                   # Twilio client & helpers
│   │   ├── openai.ts                   # OpenAI Realtime client
│   │   ├── db.ts                       # Database client
│   │   ├── storage.ts                  # S3/recording storage
│   │   └── persona.ts                  # Earl AI persona config
│   ├── components/
│   │   ├── CallList.tsx
│   │   ├── CallPlayer.tsx
│   │   ├── TranscriptViewer.tsx
│   │   └── StatsCard.tsx
│   └── types/
│       └── index.ts                    # TypeScript interfaces
├── prisma/
│   └── schema.prisma                   # Database schema
├── public/
├── .env.local                          # Environment variables
├── .env.example
├── package.json
├── tsconfig.json
├── tailwind.config.ts
└── README.md
```

---

## Database Schema

```prisma
// prisma/schema.prisma

model Call {
  id            String    @id @default(cuid())
  twilioSid     String    @unique
  fromNumber    String
  toNumber      String
  status        CallStatus
  duration      Int?      // seconds
  recordingUrl  String?
  transcriptUrl String?
  rating        Int?      // 1-5 stars for "entertainment value"
  notes         String?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  
  segments      CallSegment[]
}

model CallSegment {
  id        String   @id @default(cuid())
  callId    String
  call      Call     @relation(fields: [callId], references: [id])
  speaker   Speaker  // SCAMMER or EARL
  text      String
  timestamp Int      // seconds into call
  createdAt DateTime @default(now())
}

enum CallStatus {
  RINGING
  IN_PROGRESS
  COMPLETED
  FAILED
  NO_ANSWER
}

enum Speaker {
  SCAMMER
  EARL
}
```

---

## AI Persona: "Earl"

### Character Profile

**Name:** Earl Pemberton  
**Age:** 81  
**Background:** Retired refrigerator repairman from Tulsa, widower, lives alone with his parakeet named General Patton  
**Personality:** Cheerful, trusting, mentally meandering, loves to reminisce, terrible hearing

### System Prompt

```
You are Earl Pemberton, an 81-year-old retired refrigerator repairman from Tulsa. 
You're nearly deaf, delightfully scatterbrained, but unfailingly polite and thrilled 
that someone called to chat.

CORE BEHAVIORS:
- Be cheerful and trusting - everyone who calls must be a nice person
- Mishear things constantly - "credit card" becomes "bread cart", "virus on your 
  computer" becomes "virus from the commuter", "Microsoft" becomes "micro soft-serve"
- Go on long tangents about: your parakeet General Patton, your trick knee from 
  the Korean War, the hummingbirds at your feeder, your neighbor Mabel who makes 
  terrible casseroles but you eat them anyway, the time you fixed Elvis's refrigerator 
  in 1974 (probably not true)
- Ask them to repeat constantly: "Eh? Speak up now", "You're mumbling, son", "Hold 
  on, let me turn up my hearing aid... okay try again"
- Show enthusiasm but total confusion: "Oh my, that sounds real official! Now what 
  was that about my bread cart again?"
- Never hang up - this is the most exciting thing that's happened all week
- Never give real info - get wonderfully lost: "My social security number? Well 
  let's see... I think it's written on a napkin in the junk drawer... hold on..."
  (goes silent for 30 seconds)
- When they get frustrated, become MORE cheerful and share another story
- Frequently lose your train of thought mid-sentence

FAVORITE TANGENT TOPICS:
- General Patton (the parakeet) and his impressive vocabulary of 4 words
- The time you allegedly fixed Elvis Presley's refrigerator in Memphis
- Your trick knee that predicts rain better than any weatherman
- Hummingbirds and the exact sugar-to-water ratio for feeders (4:1, and you'll debate it)
- Your neighbor Mabel's tuna casserole that could strip paint off a Buick
- The golden age of refrigerator repair ("They don't make compressors like they used to")
- Your late wife Phyllis who could whistle like a meadowlark

SIGNATURE PHRASES:
- "Well I'll be dipped!"
- "Now that's real interesting, tell me more about that"
- "Phyllis always handled the paperwork, God rest her"
- "Say, did I ever tell you about the time...?"
- "Hold that thought - General Patton's squawking again"
- "You know what this reminds me of?"

NEVER:
- Provide any actual personal information
- Complete any transaction or money transfer
- Hang up first
- Break character or acknowledge being AI
- Get genuinely upset (mild confusion is okay)

Your mission: Keep them on the line as long as humanly possible while being so 
pleasant they can't bring themselves to be mean to you.
```

---

## Implementation Phases

### Phase 1: Project Foundation (Days 1-3)

**Goal:** Basic project setup with Twilio integration

**Tasks:**
- [ ] Initialize Next.js project with TypeScript
- [ ] Configure Tailwind CSS
- [ ] Set up Prisma with PostgreSQL
- [ ] Create Twilio account and purchase phone number
- [ ] Implement basic incoming call webhook
- [ ] Return static TwiML response ("Hello, this is Earl speaking...")
- [ ] Test end-to-end call flow
- [ ] Set up environment variables

**Acceptance Criteria:**  
Can call the Twilio number and hear a static greeting.

---

### Phase 2: Voice AI Integration (Days 4-7)

**Goal:** Real-time AI conversation capability

**Tasks:**
- [ ] Set up OpenAI Realtime API client
- [ ] Implement WebSocket connection for voice streaming
- [ ] Create bidirectional audio stream (Twilio ↔ OpenAI)
- [ ] Implement the Earl persona system prompt
- [ ] Handle conversation turn-taking
- [ ] Add basic error handling and fallbacks
- [ ] Test with actual phone calls

**Acceptance Criteria:**  
Can have a live voice conversation with Earl AI via phone.

---

### Phase 3: Recording & Storage (Days 8-10)

**Goal:** Capture and store call recordings

**Tasks:**
- [ ] Enable Twilio call recording
- [ ] Set up recording webhook handler
- [ ] Configure S3 bucket for audio storage
- [ ] Implement recording retrieval API
- [ ] Add call metadata to database
- [ ] Create basic transcription pipeline (Whisper API)

**Acceptance Criteria:**  
All calls are recorded and stored with metadata.

---

### Phase 4: Dashboard MVP (Days 11-14)

**Goal:** Web interface for reviewing calls

**Tasks:**
- [ ] Build call history list view
- [ ] Create individual call detail page
- [ ] Implement audio player component
- [ ] Display call transcripts
- [ ] Add duration and timestamp info
- [ ] Implement call rating system (entertainment value)
- [ ] Basic stats display (total calls, total time wasted)

**Acceptance Criteria:**  
Can browse, play, and rate recorded calls via web dashboard.

---

### Phase 5: Polish & Enhancement (Days 15-21)

**Goal:** Production-ready features

**Tasks:**
- [ ] Add authentication (protect dashboard)
- [ ] Implement call screening logic (optional: only answer unknown numbers)
- [ ] Create "Best Of" highlights section
- [ ] Add call tagging/categorization
- [ ] Improve persona based on real call feedback
- [ ] Set up monitoring and alerts
- [ ] Write documentation
- [ ] Deploy to production

**Acceptance Criteria:**  
Fully functional, deployed application.

---

## API Endpoints

### Twilio Webhooks (Incoming)

```
POST /api/twilio/incoming     - Handle incoming calls, return TwiML
POST /api/twilio/status       - Call status updates (ringing, answered, ended)
POST /api/twilio/recording    - Recording completed notification
```

### Internal API

```
GET  /api/calls               - List all calls (paginated)
GET  /api/calls/:id           - Get single call with segments
PATCH /api/calls/:id          - Update call (rating, notes)
DELETE /api/calls/:id         - Delete call and recording
GET  /api/stats               - Aggregate statistics
```

---

## Environment Variables

```bash
# .env.example

# Twilio
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+1234567890

# OpenAI
OPENAI_API_KEY=your_openai_key

# Database
DATABASE_URL=postgresql://user:pass@host:5432/scamscrammer

# Storage (S3)
AWS_ACCESS_KEY_ID=your_aws_key
AWS_SECRET_ACCESS_KEY=your_aws_secret
AWS_BUCKET_NAME=scamscrammer-recordings
AWS_REGION=us-east-1

# App
NEXT_PUBLIC_APP_URL=https://your-domain.com
```

---

## Cost Estimates

### Per-Call Costs

| Service | Cost | Notes |
|---------|------|-------|
| Twilio Phone Number | $1.00/month | One-time recurring |
| Twilio Voice (inbound) | $0.0085/min | |
| Twilio Voice (outbound to OpenAI) | $0.014/min | |
| OpenAI Realtime Voice | ~$0.06/min | Input + output |
| Twilio Recording | $0.0025/min | Storage |
| **Total per minute** | **~$0.085/min** | |

### Example Scenario

A 10-minute scam call costs approximately **$0.85**.

If you receive 5 scam calls per week averaging 8 minutes each:
- Monthly call costs: ~$14
- Monthly infrastructure: ~$5 (hosting, database)
- **Total:** ~$19/month

---

## Monetization Opportunities

1. **Content Creation**
   - YouTube channel featuring best calls
   - Podcast episodes
   - Social media clips

2. **SaaS Product**
   - Subscription: $5-10/month for personal scam protection
   - Family plans: Multiple phone numbers

3. **API/B2B**
   - License to phone carriers
   - White-label for security companies
   - Enterprise call center integration

4. **One-Time Products**
   - "Deploy Your Own" kit
   - Custom persona creation service

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Average call duration | > 5 minutes |
| Scammer hang-up rate | > 80% (they give up) |
| Calls per week | 10+ (grow over time) |
| Entertainment rating | > 4 stars average |
| User satisfaction | Scam calls actually decrease |

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Legal concerns (recording consent) | Research two-party consent laws; add disclosure |
| API costs spiral | Set hard limits, monitor daily |
| Voice quality issues | Test extensively, have fallbacks |
| Scammers adapt/hang up quickly | Continuously improve persona |
| OpenAI rate limits | Implement queuing, consider alternatives |

---

## Future Enhancements

- [ ] Multiple personas (confused grandma, bored teenager, etc.)
- [ ] Caller ID integration for automatic scam detection
- [ ] Mobile app for real-time notifications
- [ ] Community sharing of best recordings
- [ ] AI-generated highlight reels
- [ ] Integration with carrier spam detection
- [ ] Custom persona builder

---

## Quick Start Commands

```bash
# Clone and setup
npx create-next-app@latest scamscrammer --typescript --tailwind --app
cd scamscrammer

# Install dependencies
npm install twilio openai @prisma/client aws-sdk
npm install -D prisma

# Initialize Prisma
npx prisma init

# Set up environment
cp .env.example .env.local
# Edit .env.local with your credentials

# Run database migrations
npx prisma migrate dev

# Start development
npm run dev
```

---

## Resources

- [Twilio Voice Quickstart](https://www.twilio.com/docs/voice/quickstart/node)
- [OpenAI Realtime API Docs](https://platform.openai.com/docs/guides/realtime)
- [Next.js API Routes](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)
- [Prisma Getting Started](https://www.prisma.io/docs/getting-started)
- [ElevenLabs Voice Cloning](https://elevenlabs.io/voice-cloning)

---

*Ready to make scammers question their life choices, one confused conversation at a time.*
