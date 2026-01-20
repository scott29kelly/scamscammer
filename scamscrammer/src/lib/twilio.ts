/**
 * Twilio Client and Helper Utilities
 *
 * This module provides utilities for working with Twilio webhooks,
 * validating signatures, generating TwiML responses, and formatting phone numbers.
 */

import twilio from 'twilio';
import type { NextRequest } from 'next/server';

// Define the TwilioWebhookPayload interface inline to avoid path resolution issues
interface TwilioWebhookPayload {
  CallSid: string;
  AccountSid: string;
  From: string;
  To: string;
  CallStatus: string;
  ApiVersion: string;
  Direction: string;
  ForwardedFrom?: string;
  CallerName?: string;
  FromCity?: string;
  FromState?: string;
  FromZip?: string;
  FromCountry?: string;
  ToCity?: string;
  ToState?: string;
  ToZip?: string;
  ToCountry?: string;
}

const { validateRequest } = twilio;
const VoiceResponse = twilio.twiml.VoiceResponse;

// Map our simplified track values to Twilio's expected values
const TRACK_MAP = {
  inbound: 'inbound_track',
  outbound: 'outbound_track',
  both: 'both_tracks',
} as const;

/**
 * Parse Twilio webhook body from URL-encoded form data
 * @param request - The incoming Next.js request
 * @returns The parsed body as a record
 */
export async function parseTwilioWebhookBody(
  request: NextRequest
): Promise<Record<string, string>> {
  const body = await request.text();
  const params = new URLSearchParams(body);
  const result: Record<string, string> = {};

  for (const [key, value] of params.entries()) {
    result[key] = value;
  }

  return result;
}

/**
 * Check if the parsed body is a valid Twilio webhook payload
 * @param body - The parsed request body
 * @returns True if the body contains required Twilio fields
 */
export function isTwilioWebhookPayload(
  body: Record<string, string>
): body is TwilioWebhookPayload & Record<string, string> {
  return !!(body.CallSid && body.AccountSid && body.From && body.To);
}

/**
 * Validate Twilio webhook signature for security
 * @param request - The incoming Next.js request
 * @param body - The parsed body as a record
 * @returns True if the signature is valid
 */
export function validateTwilioSignature(
  request: NextRequest,
  body: Record<string, string>
): boolean {
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  if (!authToken) {
    console.error('[Twilio] Missing TWILIO_AUTH_TOKEN environment variable');
    return false;
  }

  // In development, optionally skip validation
  if (process.env.NODE_ENV === 'development' && process.env.SKIP_TWILIO_VALIDATION === 'true') {
    console.warn('[Twilio] Skipping signature validation in development mode');
    return true;
  }

  const signature = request.headers.get('x-twilio-signature') || '';
  const url = request.url;

  return validateRequest(authToken, signature, url, body);
}

/**
 * Format phone number to E.164 format
 * @param phoneNumber - The phone number to format
 * @returns The formatted phone number
 */
export function formatPhoneNumber(phoneNumber: string): string {
  // Remove all non-digit characters except leading +
  let cleaned = phoneNumber.replace(/[^\d+]/g, '');

  // If starts with +, keep it; otherwise assume US and add +1
  if (!cleaned.startsWith('+')) {
    // Remove leading 1 if present (US country code without +)
    if (cleaned.startsWith('1') && cleaned.length === 11) {
      cleaned = '+' + cleaned;
    } else if (cleaned.length === 10) {
      cleaned = '+1' + cleaned;
    } else {
      cleaned = '+' + cleaned;
    }
  }

  return cleaned;
}

/**
 * Format phone number for display (US format)
 * @param phoneNumber - The phone number in E.164 format
 * @returns Human-readable phone number
 */
export function formatPhoneNumberForDisplay(phoneNumber: string): string {
  const cleaned = phoneNumber.replace(/[^\d]/g, '');

  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    // US number: +1 (555) 123-4567
    return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
  } else if (cleaned.length === 10) {
    // US number without country code
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }

  // Return as-is for international numbers
  return phoneNumber;
}

/**
 * Check if a phone number is valid
 * @param phoneNumber - The phone number to validate
 * @returns True if the phone number appears valid
 */
export function isValidPhoneNumber(phoneNumber: string): boolean {
  const cleaned = phoneNumber.replace(/[^\d+]/g, '');
  // Must have at least 10 digits and optionally start with +
  return /^\+?\d{10,15}$/.test(cleaned);
}

/**
 * Generate a simple TwiML response with a message
 * @param message - The message to say
 * @param options - Optional voice settings
 * @returns TwiML XML string
 */
export function generateTwiMLResponse(
  message: string,
  options?: {
    voice?: string;
    language?: string;
    pauseLength?: number;
  }
): string {
  const response = new VoiceResponse();

  // Using type assertion since Twilio SDK has strict literal types
  response.say(
    {
      voice: (options?.voice || 'Polly.Matthew') as 'Polly.Matthew',
      language: (options?.language || 'en-US') as 'en-US',
    },
    message
  );

  if (options?.pauseLength) {
    response.pause({ length: options.pauseLength });
  }

  return response.toString();
}

/**
 * Generate TwiML that connects to a WebSocket for real-time streaming
 * @param websocketUrl - The WebSocket URL to connect to
 * @param options - Optional stream settings
 * @returns TwiML XML string
 */
export function generateStreamTwiML(
  websocketUrl: string,
  options?: {
    track?: 'inbound' | 'outbound' | 'both';
  }
): string {
  const response = new VoiceResponse();

  const connect = response.connect();
  const track = TRACK_MAP[options?.track || 'both'];
  connect.stream({
    url: websocketUrl,
    track,
  });

  return response.toString();
}

/**
 * Generate TwiML that says a greeting then connects to WebSocket for streaming
 * @param greeting - The greeting message to say first
 * @param websocketUrl - The WebSocket URL to connect to
 * @param options - Optional settings
 * @returns TwiML XML string
 */
export function generateGreetingAndStreamTwiML(
  greeting: string,
  websocketUrl: string,
  options?: {
    voice?: string;
    language?: string;
    track?: 'inbound' | 'outbound' | 'both';
  }
): string {
  const response = new VoiceResponse();

  // Say the greeting first - using type assertion for Twilio SDK strict types
  response.say(
    {
      voice: (options?.voice || 'Polly.Matthew') as 'Polly.Matthew',
      language: (options?.language || 'en-US') as 'en-US',
    },
    greeting
  );

  // Then connect to WebSocket for real-time streaming
  const connect = response.connect();
  const track = TRACK_MAP[options?.track || 'both'];
  connect.stream({
    url: websocketUrl,
    track,
  });

  return response.toString();
}

/**
 * Generate TwiML to hangup the call with an optional message
 * @param message - Optional message to say before hanging up
 * @returns TwiML XML string
 */
export function generateHangupTwiML(message?: string): string {
  const response = new VoiceResponse();

  if (message) {
    response.say(
      {
        voice: 'Polly.Matthew' as const,
        language: 'en-US' as const,
      },
      message
    );
  }

  response.hangup();

  return response.toString();
}

/**
 * Generate a fallback TwiML response for error cases
 * @returns TwiML XML string with a friendly error message
 */
export function generateFallbackTwiML(): string {
  const response = new VoiceResponse();

  response.say(
    {
      voice: 'Polly.Matthew' as const,
      language: 'en-US' as const,
    },
    "Well I'll be... my hearing aid seems to be acting up. Could you call back in a minute? Sorry about that, friend."
  );

  response.hangup();

  return response.toString();
}

/**
 * Build the WebSocket URL for voice streaming
 * @param baseUrl - The base URL of the application
 * @param callSid - The Twilio call SID
 * @returns The WebSocket URL
 */
export function buildWebSocketUrl(baseUrl: string, callSid: string): string {
  // Convert http(s) to ws(s)
  const wsUrl = baseUrl.replace(/^http/, 'ws');
  return `${wsUrl}/api/voice/stream?callSid=${encodeURIComponent(callSid)}`;
}

/**
 * Get Earl's initial greeting for answering calls
 * @returns A friendly greeting in Earl's voice
 */
export function getEarlGreeting(): string {
  const greetings = [
    "Hello? Hello? Oh, wonderful! Someone's calling! This is Earl speaking, Earl Pemberton. Hold on just a second, let me turn up my hearing aid... there we go. Now, who am I speaking with today?",
    "Well hello there! You've reached Earl Pemberton. Boy oh boy, I wasn't expecting a call today! Let me just put down my coffee here... okay, now what can I do for you, friend?",
    "Hello? Is someone there? Oh good! This is Earl. Earl Pemberton. My neighbor Mabel said I should get one of those answering machines, but I like talking to real people. Who's this?",
    "Why hello! Earl Pemberton here. I was just feeding General Patton - that's my parakeet, you know - when I heard the phone. Now, what brings you to call old Earl today?",
    "Hello, hello! This is Earl speaking. You caught me right in the middle of my crossword puzzle, but that's alright. I always have time for a chat. What's your name, friend?",
  ];

  const index = Math.floor(Math.random() * greetings.length);
  return greetings[index];
}
