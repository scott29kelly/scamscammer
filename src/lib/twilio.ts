/**
 * Twilio Client and Helpers
 *
 * This module provides Twilio SDK wrapper functions for voice call handling,
 * TwiML generation, and webhook validation.
 */

import { NextRequest } from "next/server";
import twilio from "twilio";
import type { TwiMLOptions, TwilioWebhookPayload } from "@/types";

// =============================================================================
// Environment Configuration
// =============================================================================

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

// =============================================================================
// Custom Error Class
// =============================================================================

/**
 * Custom error class for Twilio-related errors
 */
export class TwilioClientError extends Error {
  public readonly code: string;
  public readonly cause?: Error;

  constructor(message: string, code: string, cause?: Error) {
    super(message);
    this.name = "TwilioClientError";
    this.code = code;
    this.cause = cause;
  }
}

// =============================================================================
// Twilio Client Singleton
// =============================================================================

let twilioClient: twilio.Twilio | null = null;

/**
 * Get the Twilio client singleton instance
 * @throws {TwilioClientError} If credentials are not configured
 */
export function getTwilioClient(): twilio.Twilio {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    throw new TwilioClientError(
      "Twilio credentials not configured. Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN.",
      "CREDENTIALS_MISSING"
    );
  }

  if (!twilioClient) {
    twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
  }

  return twilioClient;
}

// =============================================================================
// Webhook Validation
// =============================================================================

/**
 * Parse the webhook body from a Twilio request.
 * Twilio sends data as application/x-www-form-urlencoded.
 *
 * @param request - The incoming Next.js request
 * @returns Parsed form data as key-value pairs
 */
export async function parseTwilioWebhookBody(
  request: NextRequest
): Promise<Record<string, string>> {
  const text = await request.text();
  const params = new URLSearchParams(text);
  const body: Record<string, string> = {};

  params.forEach((value, key) => {
    body[key] = value;
  });

  return body;
}

/**
 * Validate that a request came from Twilio using the X-Twilio-Signature header.
 *
 * @param request - The incoming Next.js request
 * @param body - The parsed form data from the request
 * @returns True if the signature is valid, false otherwise
 */
export async function validateTwilioSignature(
  request: NextRequest,
  body: Record<string, string>
): Promise<boolean> {
  // Skip validation in development if no auth token
  if (process.env.NODE_ENV === "development" && !TWILIO_AUTH_TOKEN) {
    console.warn(
      "Skipping Twilio signature validation in development (no auth token)"
    );
    return true;
  }

  if (!TWILIO_AUTH_TOKEN) {
    throw new TwilioClientError(
      "TWILIO_AUTH_TOKEN is required for signature validation",
      "AUTH_TOKEN_MISSING"
    );
  }

  const signature = request.headers.get("X-Twilio-Signature");
  if (!signature) {
    return false;
  }

  // Get the full URL that Twilio used to call us
  const url = request.url;

  return twilio.validateRequest(TWILIO_AUTH_TOKEN, signature, url, body);
}

// =============================================================================
// TwiML Generation
// =============================================================================

/**
 * Generate a simple TwiML response that speaks a message.
 *
 * @param message - The message to speak
 * @param options - Optional TwiML configuration
 * @returns TwiML XML string
 */
export function generateTwiMLResponse(
  message: string,
  options: TwiMLOptions = {}
): string {
  const VoiceResponse = twilio.twiml.VoiceResponse;
  const response = new VoiceResponse();

  // Add the spoken message
  response.say(
    {
      voice: options.voice || "Polly.Matthew",
      language: options.language || "en-US",
    },
    message
  );

  return response.toString();
}

/**
 * Generate TwiML that connects to a WebSocket for real-time media streaming.
 *
 * @param websocketUrl - The WebSocket URL to connect to
 * @param options - Optional TwiML configuration
 * @returns TwiML XML string
 */
export function generateStreamTwiML(
  websocketUrl: string,
  options: TwiMLOptions = {}
): string {
  const VoiceResponse = twilio.twiml.VoiceResponse;
  const response = new VoiceResponse();

  // Start bidirectional media stream
  const connect = response.connect();
  connect.stream({
    url: websocketUrl,
  });

  // Add recording if requested
  if (options.record) {
    response.record({
      recordingStatusCallback: options.statusCallback || `${APP_URL}/api/twilio/recording`,
      recordingStatusCallbackEvent: ["completed", "absent"] as unknown as string,
    });
  }

  return response.toString();
}

/**
 * Generate TwiML that speaks a greeting then connects to a WebSocket.
 * This is the primary TwiML response for incoming scam calls.
 *
 * @param greeting - The greeting message Earl speaks
 * @param websocketUrl - The WebSocket URL for real-time voice streaming
 * @param options - Optional TwiML configuration
 * @returns TwiML XML string
 */
export function generateGreetingAndStreamTwiML(
  greeting: string,
  websocketUrl: string,
  options: TwiMLOptions = {}
): string {
  const VoiceResponse = twilio.twiml.VoiceResponse;
  const response = new VoiceResponse();

  // Speak Earl's greeting
  response.say(
    {
      voice: options.voice || "Polly.Matthew",
      language: options.language || "en-US",
    },
    greeting
  );

  // Start bidirectional media stream for real-time AI conversation
  const connect = response.connect({
    action: options.statusCallback || `${APP_URL}/api/twilio/status`,
  });
  connect.stream({
    url: websocketUrl,
  });

  // Add a pause at the end so the call doesn't disconnect
  response.pause({ length: 3600 }); // 1 hour max

  return response.toString();
}

/**
 * Generate a fallback TwiML response for error scenarios.
 * This ensures callers hear something even if the system fails.
 *
 * @returns TwiML XML string with a friendly error message
 */
export function generateFallbackTwiML(): string {
  const VoiceResponse = twilio.twiml.VoiceResponse;
  const response = new VoiceResponse();

  response.say(
    {
      voice: "Polly.Matthew",
      language: "en-US",
    },
    "Well now, I seem to have gotten myself a bit confused here. You'll have to excuse me, my hearing aid's been acting up. Give me a call back in a little bit, would ya?"
  );

  response.hangup();

  return response.toString();
}

// =============================================================================
// Call Details Fetching
// =============================================================================

/**
 * Details about a Twilio call
 */
export interface TwilioCallDetails {
  sid: string;
  from: string;
  to: string;
  status: string;
  direction: string;
  duration: string | null;
  startTime: Date | null;
  endTime: Date | null;
}

/**
 * Fetch details about a specific call from Twilio.
 *
 * @param callSid - The Twilio call SID
 * @returns Call details
 */
export async function getCallDetails(
  callSid: string
): Promise<TwilioCallDetails> {
  const client = getTwilioClient();

  try {
    const call = await client.calls(callSid).fetch();

    return {
      sid: call.sid,
      from: call.from,
      to: call.to,
      status: call.status,
      direction: call.direction,
      duration: call.duration,
      startTime: call.startTime,
      endTime: call.endTime,
    };
  } catch (error) {
    throw new TwilioClientError(
      `Failed to fetch call details for ${callSid}`,
      "CALL_FETCH_FAILED",
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Details about a Twilio recording
 */
export interface TwilioRecordingDetails {
  sid: string;
  callSid: string;
  duration: string;
  status: string;
  uri: string;
  mediaUrl: string;
}

/**
 * Fetch details about a specific recording from Twilio.
 *
 * @param recordingSid - The Twilio recording SID
 * @returns Recording details
 */
export async function getRecording(
  recordingSid: string
): Promise<TwilioRecordingDetails> {
  const client = getTwilioClient();

  try {
    const recording = await client.recordings(recordingSid).fetch();

    return {
      sid: recording.sid,
      callSid: recording.callSid,
      duration: recording.duration,
      status: recording.status,
      uri: recording.uri,
      mediaUrl: `https://api.twilio.com${recording.uri.replace(".json", ".wav")}`,
    };
  } catch (error) {
    throw new TwilioClientError(
      `Failed to fetch recording details for ${recordingSid}`,
      "RECORDING_FETCH_FAILED",
      error instanceof Error ? error : undefined
    );
  }
}

// =============================================================================
// Phone Number Utilities
// =============================================================================

/**
 * Format a phone number to E.164 format.
 * Handles common US phone number formats.
 *
 * @param phoneNumber - The phone number to format
 * @returns E.164 formatted phone number
 */
export function formatPhoneNumber(phoneNumber: string): string {
  // Remove all non-digit characters
  const digits = phoneNumber.replace(/\D/g, "");

  // Handle US numbers
  if (digits.length === 10) {
    return `+1${digits}`;
  }

  // Already has country code
  if (digits.length === 11 && digits.startsWith("1")) {
    return `+${digits}`;
  }

  // Return as-is if it's already in a valid format
  if (phoneNumber.startsWith("+")) {
    return phoneNumber;
  }

  // Default: just add + prefix
  return `+${digits}`;
}

/**
 * Validate that a string is a valid phone number.
 * Accepts E.164 format and common US formats.
 *
 * @param phoneNumber - The phone number to validate
 * @returns True if valid, false otherwise
 */
export function isValidPhoneNumber(phoneNumber: string): boolean {
  // E.164 format: + followed by 1-15 digits
  const e164Pattern = /^\+[1-9]\d{1,14}$/;

  // Try E.164 first
  if (e164Pattern.test(phoneNumber)) {
    return true;
  }

  // Check if it can be formatted to E.164
  const formatted = formatPhoneNumber(phoneNumber);
  return e164Pattern.test(formatted);
}

/**
 * Get the configured Twilio phone number
 *
 * @returns The configured Twilio phone number or undefined
 */
export function getTwilioPhoneNumber(): string | undefined {
  return TWILIO_PHONE_NUMBER;
}

// =============================================================================
// Webhook Payload Type Guards
// =============================================================================

/**
 * Type guard to check if a payload is a valid TwilioWebhookPayload
 *
 * @param payload - The payload to check
 * @returns True if the payload is a valid TwilioWebhookPayload
 */
export function isTwilioWebhookPayload(
  payload: Record<string, string>
): payload is Record<string, string> & TwilioWebhookPayload {
  return (
    typeof payload.CallSid === "string" &&
    typeof payload.AccountSid === "string" &&
    typeof payload.From === "string" &&
    typeof payload.To === "string" &&
    typeof payload.CallStatus === "string"
  );
}
