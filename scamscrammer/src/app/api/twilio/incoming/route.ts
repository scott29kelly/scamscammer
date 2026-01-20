/**
 * Twilio Incoming Call Webhook Handler
 *
 * POST /api/twilio/incoming
 *
 * This endpoint handles incoming calls from Twilio. When a call comes in:
 * 1. Validates the Twilio signature for security
 * 2. Creates a call record in the database with RINGING status
 * 3. Returns TwiML that plays Earl's greeting and connects to WebSocket for AI voice streaming
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { CallStatus } from '@prisma/client';
import {
  parseTwilioWebhookBody,
  isTwilioWebhookPayload,
  validateTwilioSignature,
  formatPhoneNumber,
  generateGreetingAndStreamTwiML,
  generateFallbackTwiML,
  buildWebSocketUrl,
  getEarlGreeting,
} from '@/lib/twilio';

/**
 * Handle CORS preflight requests
 */
export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Twilio-Signature',
    },
  });
}

/**
 * Handle incoming call webhook from Twilio
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  console.log('[Incoming Call] Received webhook request');

  try {
    // Parse the form-encoded body from Twilio
    const body = await parseTwilioWebhookBody(request);
    console.log('[Incoming Call] Parsed body:', {
      CallSid: body.CallSid,
      From: body.From,
      To: body.To,
      CallStatus: body.CallStatus,
    });

    // Validate Twilio signature for security
    if (!validateTwilioSignature(request, body)) {
      console.error('[Incoming Call] Invalid Twilio signature');
      return new NextResponse('Unauthorized', { status: 401 });
    }

    // Validate required fields
    if (!isTwilioWebhookPayload(body)) {
      console.error('[Incoming Call] Invalid webhook payload - missing required fields');
      return new NextResponse(generateFallbackTwiML(), {
        status: 200,
        headers: {
          'Content-Type': 'application/xml',
        },
      });
    }

    // Extract call information
    const { CallSid, From, To, CallerName, FromCity, FromState, FromCountry } = body;

    // Format phone numbers to E.164
    const fromNumber = formatPhoneNumber(From);
    const toNumber = formatPhoneNumber(To);

    console.log('[Incoming Call] Processing call:', {
      CallSid,
      fromNumber,
      toNumber,
      CallerName,
      location: `${FromCity || 'Unknown'}, ${FromState || 'Unknown'}, ${FromCountry || 'Unknown'}`,
    });

    // Create call record in database with RINGING status
    const call = await prisma.call.create({
      data: {
        twilioSid: CallSid,
        fromNumber,
        toNumber,
        status: CallStatus.RINGING,
        tags: [], // Initialize empty tags array
      },
    });

    console.log('[Incoming Call] Created call record:', call.id);

    // Get Earl's greeting
    const greeting = getEarlGreeting();

    // Build the WebSocket URL for voice streaming
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || getBaseUrlFromRequest(request);
    const websocketUrl = buildWebSocketUrl(baseUrl, CallSid);

    console.log('[Incoming Call] WebSocket URL:', websocketUrl);

    // Generate TwiML response with greeting and WebSocket connection
    const twiml = generateGreetingAndStreamTwiML(greeting, websocketUrl, {
      voice: 'Polly.Matthew', // Male voice that sounds elderly-friendly
      language: 'en-US',
      track: 'both', // Capture both inbound and outbound audio
    });

    console.log('[Incoming Call] Returning TwiML response');

    return new NextResponse(twiml, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml',
      },
    });
  } catch (error) {
    console.error('[Incoming Call] Error processing webhook:', error);

    // Return fallback TwiML so the call doesn't just drop
    return new NextResponse(generateFallbackTwiML(), {
      status: 200,
      headers: {
        'Content-Type': 'application/xml',
      },
    });
  }
}

/**
 * Extract base URL from the request when NEXT_PUBLIC_APP_URL is not set
 * @param request - The incoming request
 * @returns The base URL
 */
function getBaseUrlFromRequest(request: NextRequest): string {
  const host = request.headers.get('host') || 'localhost:3000';
  const protocol = request.headers.get('x-forwarded-proto') || 'https';
  return `${protocol}://${host}`;
}
