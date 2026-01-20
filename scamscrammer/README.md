# ScamScrammer

AI-powered phone answering system that intercepts suspected scam calls and wastes scammers' time by impersonating a confused, polite elderly person named "Earl."

## Overview

ScamScrammer uses OpenAI's Realtime Voice API to engage scam callers in meandering conversations. The AI shows interest but never commits, keeping scammers on the line while recording interactions for entertainment and analysis.

### Features

- **Real-time AI voice conversations** via OpenAI Realtime API
- **Twilio integration** for phone call handling
- **Call recording storage** on AWS S3
- **Web dashboard** for reviewing calls, transcripts, and statistics
- **"Earl" persona** - an 81-year-old retired refrigerator repairman who loves to tell stories

## Tech Stack

- **Framework:** Next.js 16+ with App Router
- **Language:** TypeScript
- **Database:** PostgreSQL with Prisma ORM
- **Telephony:** Twilio Voice
- **Voice AI:** OpenAI Realtime API
- **Storage:** AWS S3
- **Styling:** Tailwind CSS
- **Deployment:** Vercel

## Prerequisites

- Node.js 18+
- PostgreSQL database (local or hosted, e.g., Supabase)
- Twilio account with a phone number
- OpenAI API key with Realtime API access
- AWS account with S3 bucket

## Quick Start

### 1. Clone and Install

```bash
git clone https://github.com/your-username/scamscrammer.git
cd scamscrammer
npm install
```

### 2. Configure Environment Variables

Copy the example environment file:

```bash
cp .env.local.example .env.local
```

Edit `.env.local` with your credentials (see [Environment Variables](#environment-variables) section below).

### 3. Set Up Database

Generate Prisma client and run migrations:

```bash
npx prisma generate
npx prisma migrate dev
```

### 4. Run Development Server

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) to see the dashboard.

### 5. Expose Local Server (for Twilio webhooks)

For local development, you need a public URL for Twilio webhooks. Use ngrok:

```bash
ngrok http 3000
```

Copy the ngrok URL (e.g., `https://abc123.ngrok.io`) and update `NEXT_PUBLIC_APP_URL` in `.env.local`.

## Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/db` |
| `TWILIO_ACCOUNT_SID` | Twilio Account SID | `ACxxxxxxxx` |
| `TWILIO_AUTH_TOKEN` | Twilio Auth Token | `your_token` |
| `TWILIO_PHONE_NUMBER` | Your Twilio phone number | `+1234567890` |
| `OPENAI_API_KEY` | OpenAI API key | `sk-xxxxxxxx` |
| `AWS_ACCESS_KEY_ID` | AWS access key | `AKIAXXXXXXXX` |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key | `xxxxxxxx` |
| `AWS_BUCKET_NAME` | S3 bucket for recordings | `scamscrammer-recordings` |
| `AWS_REGION` | AWS region | `us-east-1` |
| `NEXT_PUBLIC_APP_URL` | Public URL of the app | `https://your-domain.com` |

## Twilio Webhook Configuration

Configure these webhooks in your Twilio console for your phone number:

| Event | Webhook URL | Method |
|-------|-------------|--------|
| Incoming Call | `{APP_URL}/api/twilio/incoming` | POST |
| Call Status | `{APP_URL}/api/twilio/status` | POST |
| Recording Status | `{APP_URL}/api/twilio/recording` | POST |

### Steps to Configure:

1. Log in to [Twilio Console](https://console.twilio.com/)
2. Go to **Phone Numbers** > **Manage** > **Active Numbers**
3. Click on your phone number
4. Under **Voice Configuration**:
   - Set "A call comes in" webhook to `{APP_URL}/api/twilio/incoming`
   - Set "Call status changes" webhook to `{APP_URL}/api/twilio/status`
5. Save changes

## Project Structure

```
scamscrammer/
├── prisma/
│   └── schema.prisma          # Database schema
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── calls/         # Call history REST API
│   │   │   ├── health/        # Health check endpoint
│   │   │   ├── stats/         # Statistics API
│   │   │   ├── twilio/        # Twilio webhooks
│   │   │   └── voice/         # Voice streaming
│   │   ├── calls/             # Call history pages
│   │   ├── layout.tsx
│   │   └── page.tsx           # Dashboard home
│   ├── components/            # React components
│   ├── lib/                   # Utility modules
│   │   ├── db.ts              # Database client
│   │   ├── openai.ts          # OpenAI Realtime client
│   │   ├── persona.ts         # Earl AI persona
│   │   ├── storage.ts         # S3 storage
│   │   └── twilio.ts          # Twilio helpers
│   └── types/                 # TypeScript definitions
├── .env.local.example
├── next.config.js
├── package.json
├── tsconfig.json
└── vercel.json
```

## API Endpoints

### Twilio Webhooks

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/twilio/incoming` | POST | Handle incoming calls |
| `/api/twilio/status` | POST | Call status updates |
| `/api/twilio/recording` | POST | Recording completed |

### REST API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/calls` | GET | List calls (paginated) |
| `/api/calls/[id]` | GET | Get single call |
| `/api/calls/[id]` | PATCH | Update call (rating, notes) |
| `/api/calls/[id]` | DELETE | Delete call |
| `/api/stats` | GET | Dashboard statistics |
| `/api/health` | GET | Health check |

## Deployment

### Deploy to Vercel

1. Push your code to GitHub
2. Import the repository in [Vercel](https://vercel.com)
3. Add all environment variables in Vercel project settings
4. Deploy

Vercel will automatically:
- Build the Next.js application
- Set up serverless functions for API routes
- Configure the domain

### Post-Deployment

1. Update `NEXT_PUBLIC_APP_URL` to your Vercel domain
2. Update Twilio webhooks to use your Vercel domain
3. Verify the health check: `https://your-domain.vercel.app/api/health`

## Development

### Running Tests

```bash
npm test           # Run tests once
npm run test:watch # Run tests in watch mode
```

### Database Commands

```bash
npx prisma studio    # Open Prisma Studio GUI
npx prisma migrate dev   # Run migrations
npx prisma generate  # Regenerate client
```

### Linting

```bash
npm run lint
```

## Cost Estimates

| Service | Cost | Notes |
|---------|------|-------|
| Twilio Phone Number | $1.00/month | |
| Twilio Voice (inbound) | $0.0085/min | |
| OpenAI Realtime Voice | ~$0.06/min | Input + output |
| Twilio Recording | $0.0025/min | |
| **Total per minute** | **~$0.08/min** | |

A typical 10-minute scam call costs approximately $0.85.

## License

MIT

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.
