/**
 * Twilio Incoming Call Webhook Handler
 *
 * This is the entry point for all incoming calls to the ScamScrammer system.
 * When a call comes in, this handler:
 * 1. Validates the Twilio signature for security
 * 2. Creates a call record in the database
 * 3. Returns TwiML that greets the caller and connects to real-time voice streaming
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  parseTwilioWebhookBody,
  validateTwilioSignature,
  generateGreetingAndStreamTwiML,
  generateFallbackTwiML,
  isTwilioWebhookPayload,
  formatPhoneNumber,
} from "@/lib/twilio";
import { getEarlGreeting } from "@/lib/persona";
import { CallStatus } from "@/types";

// =============================================================================
// Configuration
// =============================================================================

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

/**
 * Get the WebSocket URL for voice streaming.
 * Converts http(s) to ws(s) protocol.
 */
function getWebSocketUrl(): string {
  const wsProtocol = APP_URL.startsWith("https") ? "wss" : "ws";
  const baseUrl = APP_URL.replace(/^https?/, wsProtocol);
  return `${baseUrl}/api/voice/stream`;
}

// =============================================================================
// POST Handler - Incoming Call Webhook
// =============================================================================

/**
 * Handle incoming call webhook from Twilio.
 *
 * This endpoint receives POST requests from Twilio when a call comes in
 * to our phone number. It must return TwiML instructions for handling the call.
 *
 * @param request - The incoming Next.js request
 * @returns TwiML response as XML
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  console.log("[Incoming Call] Received webhook request");

  try {
    // Parse the form-encoded body from Twilio
    const body = await parseTwilioWebhookBody(request);
    console.log("[Incoming Call] Parsed body:", {
      CallSid: body.CallSid,
      From: body.From,
      To: body.To,
      CallStatus: body.CallStatus,
    });

    // Validate Twilio signature for security
    const isValid = await validateTwilioSignature(request, body);
    if (!isValid) {
      console.error("[Incoming Call] Invalid Twilio signature");
      return new NextResponse("Unauthorized", { status: 403 });
    }

    // Validate required fields
    if (!isTwilioWebhookPayload(body)) {
      console.error("[Incoming Call] Invalid webhook payload - missing required fields");
      return new NextResponse(generateFallbackTwiML(), {
        status: 200,
        headers: { "Content-Type": "application/xml" },
      });
    }

    // Extract call information
    const { CallSid, From, To, CallStatus: twilioStatus } = body;

    // Format phone numbers to E.164
    const fromNumber = formatPhoneNumber(From);
    const toNumber = formatPhoneNumber(To);

    console.log("[Incoming Call] Processing call:", {
      callSid: CallSid,
      from: fromNumber,
      to: toNumber,
      status: twilioStatus,
    });

    // Create call record in database with RINGING status
    let call;
    try {
      call = await prisma.call.create({
        data: {
          twilioSid: CallSid,
          fromNumber,
          toNumber,
          status: CallStatus.RINGING,
        },
      });
      console.log("[Incoming Call] Created call record:", call.id);
    } catch (dbError) {
      // If we can't create the database record, still handle the call
      // but log the error for debugging
      console.error("[Incoming Call] Failed to create call record:", dbError);
      // Continue anyway - don't let DB issues prevent the call from being handled
    }

    // Get Earl's greeting and WebSocket URL
    const greeting = getEarlGreeting();
    const websocketUrl = getWebSocketUrl();

    console.log("[Incoming Call] Generating TwiML response:", {
      greeting: greeting.substring(0, 50) + "...",
      websocketUrl,
    });

    // Generate TwiML that speaks the greeting and connects to voice streaming
    const twiml = generateGreetingAndStreamTwiML(greeting, websocketUrl, {
      voice: "Polly.Matthew",
      language: "en-US",
      record: true,
      statusCallback: `${APP_URL}/api/twilio/status`,
    });

    console.log("[Incoming Call] Returning TwiML response");

    // Return TwiML response
    return new NextResponse(twiml, {
      status: 200,
      headers: {
        "Content-Type": "application/xml",
      },
    });
  } catch (error) {
    // Log the error
    console.error("[Incoming Call] Error handling webhook:", error);

    // Return fallback TwiML so the caller hears something
    const fallbackTwiml = generateFallbackTwiML();
    return new NextResponse(fallbackTwiml, {
      status: 200,
      headers: {
        "Content-Type": "application/xml",
      },
    });
  }
}

// =============================================================================
// OPTIONS Handler - CORS Preflight
// =============================================================================

/**
 * Handle CORS preflight requests.
 * Twilio webhooks don't typically need CORS, but we handle it for completeness.
 */
export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-Twilio-Signature",
    },
  });
}
