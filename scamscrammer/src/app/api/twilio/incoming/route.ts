/**
 * Twilio Incoming Call Webhook Handler
 *
 * POST /api/twilio/incoming
 *
 * This endpoint handles incoming phone calls from Twilio.
 * It validates the request, creates a call record in the database,
 * and returns TwiML to greet the caller and connect to voice streaming.
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { CallStatus } from '@prisma/client';
import {
  validateRequest,
  createStreamingTwiml,
  createErrorTwiml,
  TwilioIncomingCallParams,
} from '@/lib/twilio';
import { EARL_GREETING } from '@/lib/persona';

/**
 * Parse form data from Twilio webhook request
 */
async function parseFormData(request: NextRequest): Promise<Record<string, string>> {
  const formData = await request.formData();
  const params: Record<string, string> = {};

  formData.forEach((value, key) => {
    if (typeof value === 'string') {
      params[key] = value;
    }
  });

  return params;
}

/**
 * Validate Twilio signature for security
 * Returns true in development mode or if signature is valid
 */
function validateSignature(
  request: NextRequest,
  params: Record<string, string>
): boolean {
  // Skip validation in development
  if (process.env.NODE_ENV === 'development' && !process.env.VALIDATE_TWILIO_IN_DEV) {
    return true;
  }

  const signature = request.headers.get('X-Twilio-Signature');
  if (!signature) {
    return false;
  }

  // Build the full URL for validation
  const url = request.url;

  try {
    return validateRequest(signature, url, params);
  } catch {
    // If validation fails (e.g., missing auth token), reject
    return false;
  }
}

/**
 * Build the WebSocket URL for voice streaming
 */
function buildStreamUrl(request: NextRequest): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  if (appUrl) {
    // Use configured app URL (production)
    const wsProtocol = appUrl.startsWith('https') ? 'wss' : 'ws';
    const baseUrl = appUrl.replace(/^https?/, wsProtocol);
    return `${baseUrl}/api/voice/stream`;
  }

  // Fallback to request host (development)
  const host = request.headers.get('host') || 'localhost:3000';
  const protocol = host.includes('localhost') ? 'ws' : 'wss';
  return `${protocol}://${host}/api/voice/stream`;
}

/**
 * Handle incoming call webhook from Twilio
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Parse the form data from Twilio
    const params = await parseFormData(request);
    const twilioParams = params as unknown as TwilioIncomingCallParams;

    // Validate Twilio signature
    if (!validateSignature(request, params)) {
      console.error('Invalid Twilio signature');
      return new NextResponse('Forbidden', { status: 403 });
    }

    // Extract call details
    const { CallSid, From, To, CallStatus: twilioStatus } = twilioParams;

    // Validate required parameters
    if (!CallSid || !From || !To) {
      console.error('Missing required parameters:', { CallSid, From, To });
      return new NextResponse(createErrorTwiml(), {
        status: 200,
        headers: { 'Content-Type': 'text/xml' },
      });
    }

    // Log incoming call
    console.log(`Incoming call: ${CallSid} from ${From} to ${To} (status: ${twilioStatus})`);

    // Create call record in database
    try {
      await prisma.call.create({
        data: {
          twilioSid: CallSid,
          fromNumber: From,
          toNumber: To,
          status: CallStatus.RINGING,
        },
      });
      console.log(`Created call record for ${CallSid}`);
    } catch (dbError) {
      // Handle duplicate call SID (call already exists)
      if (
        dbError instanceof Error &&
        dbError.message.includes('Unique constraint')
      ) {
        console.log(`Call record already exists for ${CallSid}`);
      } else {
        // Log but don't fail - we still want to answer the call
        console.error('Error creating call record:', dbError);
      }
    }

    // Build the streaming WebSocket URL
    const streamUrl = buildStreamUrl(request);

    // Generate TwiML response with Earl's greeting and streaming connection
    const twiml = createStreamingTwiml(EARL_GREETING, streamUrl);

    // Return TwiML response
    return new NextResponse(twiml, {
      status: 200,
      headers: {
        'Content-Type': 'text/xml',
      },
    });
  } catch (error) {
    console.error('Error handling incoming call:', error);

    // Return error TwiML so the caller gets a friendly message
    return new NextResponse(createErrorTwiml(), {
      status: 200,
      headers: {
        'Content-Type': 'text/xml',
      },
    });
  }
}
