# ScamScrammer

An AI-powered telephony application that wastes scammers' time with "Earl Pemberton" - a confused elderly persona powered by OpenAI's Realtime Voice API.

## Overview

ScamScrammer intercepts scam calls and engages scammers in lengthy, confusing conversations using an AI character named Earl. The system tracks call metrics, records conversations, and provides a dashboard for monitoring scammer-wasting effectiveness.

### Key Features

- **Real-time Voice AI**: Uses OpenAI's Realtime API for natural voice conversations
- **Twilio Integration**: Handles incoming calls via Twilio Voice webhooks
- **Call Recording**: Stores recordings in AWS S3 with secure access
- **Dashboard**: Monitor call statistics, listen to recordings, view transcripts
- **Earl Persona**: Customizable AI character with tangents, mishearings, and confusion

## Tech Stack

- **Framework**: Next.js 16 (App Router, TypeScript)
- **Database**: PostgreSQL with Prisma ORM
- **Voice AI**: OpenAI Realtime API
- **Telephony**: Twilio Voice
- **Storage**: AWS S3
- **Styling**: Tailwind CSS
- **Testing**: Jest

## Prerequisites

- Node.js 20+
- PostgreSQL database (local or hosted)
- Twilio account with voice-enabled phone number
- OpenAI API key with Realtime API access
- AWS account with S3 bucket

## Quick Start

### 1. Clone and Install

```bash
git clone <repository-url>
cd scamscrammer
npm install
```

### 2. Configure Environment

Copy the example environment file and fill in your values:

```bash
cp .env.local.example .env.local
```

See [Environment Variables](#environment-variables) section for details.

### 3. Set Up Database

Generate Prisma client and run migrations:

```bash
npx prisma generate
npx prisma db push
```

### 4. Run Development Server

```bash
npm run dev
```

The app will be available at `http://localhost:3000`.

## Environment Variables

### Required Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `TWILIO_ACCOUNT_SID` | Twilio account identifier |
| `TWILIO_AUTH_TOKEN` | Twilio authentication token |
| `TWILIO_PHONE_NUMBER` | Your Twilio phone number (E.164 format) |
| `OPENAI_API_KEY` | OpenAI API key |
| `AWS_ACCESS_KEY_ID` | AWS access key for S3 |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key for S3 |
| `AWS_REGION` | AWS region (e.g., `us-east-1`) |
| `AWS_S3_BUCKET` | S3 bucket name for recordings |
| `NEXT_PUBLIC_APP_URL` | Public URL of your application |

### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `OPENAI_REALTIME_MODEL` | OpenAI model for voice | `gpt-4o-realtime-preview` |
| `NODE_ENV` | Environment mode | `development` |
| `AUTH_SECRET` | NextAuth.js secret | - |
| `LOG_LEVEL` | Logging verbosity | `info` |

## Deployment

### Deploy to Vercel

1. **Connect Repository**: Link your GitHub repository to Vercel

2. **Configure Environment Variables**: Add all required environment variables in Vercel project settings

3. **Deploy**: Vercel will automatically build and deploy on push

```bash
# Or deploy manually
npx vercel --prod
```

4. **Configure Twilio Webhooks**: See [Twilio Configuration](#twilio-configuration)

### Build Commands

The `vercel.json` configuration handles the build process:
- Install: `npm install`
- Build: `npx prisma generate && next build`

### Function Timeouts

| Endpoint | Timeout |
|----------|---------|
| `/api/twilio/*` | 30s |
| `/api/voice/*` | 300s (5min for long calls) |
| `/api/calls/*` | 10s |
| `/api/stats/*` | 10s |
| `/api/health/*` | 10s |

## Twilio Configuration

### Webhook URLs

Configure these webhooks in your Twilio phone number settings:

| Event | URL | Method |
|-------|-----|--------|
| Incoming Call | `https://your-domain.vercel.app/api/twilio/incoming` | POST |
| Status Callback | `https://your-domain.vercel.app/api/twilio/status` | POST |
| Recording Callback | `https://your-domain.vercel.app/api/twilio/recording` | POST |

### Setup Steps

1. Go to [Twilio Console](https://console.twilio.com/)
2. Navigate to Phone Numbers → Manage → Active Numbers
3. Click on your phone number
4. Under "Voice & Fax":
   - Set "A Call Comes In" webhook to your incoming call URL
   - Set "Call Status Changes" webhook to your status URL
5. Save changes

### Local Development with ngrok

For local testing, use ngrok to expose your local server:

```bash
# Install ngrok
npm install -g ngrok

# Start your dev server
npm run dev

# In another terminal, expose port 3000
ngrok http 3000
```

Update your Twilio webhooks to use the ngrok URL.

## API Endpoints

### Public Endpoints (Webhook)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/twilio/incoming` | Handle incoming calls |
| POST | `/api/twilio/status` | Call status updates |
| POST | `/api/twilio/recording` | Recording completion |

### Protected Endpoints (Dashboard)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/calls` | List calls with pagination |
| GET | `/api/calls/[id]` | Get single call details |
| PATCH | `/api/calls/[id]` | Update call (rating, notes) |
| DELETE | `/api/calls/[id]` | Delete call and recording |
| GET | `/api/stats` | Dashboard statistics |
| GET | `/api/health` | Health check endpoint |

## Database Schema

### Models

**Call**
- `id`: Unique identifier
- `twilioSid`: Twilio call SID
- `fromNumber`: Caller's phone number
- `toNumber`: Your Twilio number
- `status`: RINGING, IN_PROGRESS, COMPLETED, FAILED, NO_ANSWER
- `duration`: Call length in seconds
- `recordingUrl`: S3 URL for recording
- `rating`: Entertainment value (1-5)
- `notes`: Admin notes
- `tags`: Categorization tags

**CallSegment**
- `id`: Unique identifier
- `callId`: Related call
- `speaker`: SCAMMER or EARL
- `text`: Transcribed text
- `timestamp`: Seconds into call

### Migrations

```bash
# Create a migration
npx prisma migrate dev --name <migration-name>

# Apply migrations in production
npx prisma migrate deploy

# Reset database (development only)
npx prisma migrate reset
```

## Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run with coverage
npm test -- --coverage
```

## Project Structure

```
scamscrammer/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── calls/         # Call CRUD endpoints
│   │   │   ├── health/        # Health check
│   │   │   ├── stats/         # Statistics
│   │   │   ├── twilio/        # Twilio webhooks
│   │   │   └── voice/         # WebSocket streaming
│   │   ├── calls/             # Call list & detail pages
│   │   └── page.tsx           # Dashboard home
│   ├── components/            # React components
│   ├── lib/
│   │   ├── db.ts              # Prisma client
│   │   ├── openai.ts          # OpenAI Realtime client
│   │   ├── persona.ts         # Earl persona config
│   │   ├── storage.ts         # S3 storage client
│   │   └── twilio.ts          # Twilio client
│   └── types/                 # TypeScript definitions
├── prisma/
│   └── schema.prisma          # Database schema
├── public/                    # Static assets
├── .env.local.example         # Environment template
├── next.config.ts             # Next.js configuration
├── vercel.json                # Vercel deployment config
└── package.json
```

## Health Monitoring

The `/api/health` endpoint provides system status:

```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T12:00:00.000Z",
  "version": "0.1.0",
  "services": {
    "database": { "status": "up", "latency": 5 },
    "app": { "status": "up" }
  },
  "uptime": 3600
}
```

Status codes:
- `200`: All services healthy
- `503`: One or more services unhealthy

## Troubleshooting

### Common Issues

**Database Connection Failed**
- Verify `DATABASE_URL` is correct
- Check if database server is running
- Ensure SSL settings match your provider

**Twilio Webhooks Not Working**
- Verify webhook URLs are publicly accessible
- Check Twilio signature validation
- Review Twilio console for error logs

**OpenAI Realtime Connection Issues**
- Verify API key has Realtime API access
- Check WebSocket connectivity
- Review OpenAI API status

**S3 Upload Failures**
- Verify AWS credentials and permissions
- Check bucket exists and is accessible
- Ensure bucket policy allows uploads

### Debug Mode

Enable verbose logging:

```bash
LOG_LEVEL=debug npm run dev
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests: `npm test`
5. Submit a pull request

## License

MIT License - see LICENSE file for details.
