# Database Schema Update Required

## Overview

The Persona Manager and Selection System has been implemented, but the database schema
needs to be updated to track which persona was used for each call.

## Required Schema Change

Add a `persona` field to the `Call` model in `prisma/schema.prisma`:

```prisma
model Call {
  id            String      @id @default(cuid())
  twilioSid     String      @unique
  fromNumber    String
  toNumber      String
  status        CallStatus
  persona       String?     // NEW: Track which persona was used ('earl', 'gladys', 'kevin', 'brenda')
  duration      Int?        // seconds
  recordingUrl  String?
  transcriptUrl String?
  rating        Int?        // 1-5 stars for entertainment value
  notes         String?
  tags          String[]    // Array of tags
  createdAt     DateTime    @default(now())
  updatedAt     DateTime    @updatedAt

  segments      CallSegment[]

  @@index([status])
  @@index([createdAt])
  @@index([persona])         // NEW: Index for filtering by persona
}
```

## Also Consider

Update the `Speaker` enum to support multiple personas instead of just `EARL`:

```prisma
enum Speaker {
  SCAMMER
  EARL
  GLADYS
  KEVIN
  BRENDA
  AI        // Generic fallback for any AI persona
}
```

Or alternatively, make the speaker field a String to support dynamic personas.

## Migration Steps

1. Update `prisma/schema.prisma` with the changes above
2. Run `npx prisma migrate dev --name add-persona-field`
3. Update any code that creates Call records to include the persona field

## PersonaType Values

Valid persona types from the system:
- `'earl'` - Earl Pemberton, 81-year-old retired refrigerator repairman
- `'gladys'` - Gladys Hoffmann, 78-year-old suspicious retired librarian
- `'kevin'` - Kevin, 22-year-old confused philosophy dropout
- `'brenda'` - Brenda Kowalski, 43-year-old MLM boss babe

Import the `PersonaType` type from `@/lib/personas/types` for type safety.
