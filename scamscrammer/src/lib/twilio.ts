/**
 * Twilio Client and Helpers
 *
 * This module provides the Twilio client instance and helper functions
 * for interacting with Twilio's Voice API.
 */

import twilio from 'twilio';
import { validateRequest as twilioValidateRequest } from 'twilio';

// Lazy-initialize Twilio client to allow for environment variable loading
let _twilioClient: ReturnType<typeof twilio> | null = null;

/**
 * Get the Twilio client instance (lazy initialization)
 */
export function getTwilioClient() {
  if (!_twilioClient) {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;

    if (!accountSid || !authToken) {
      throw new Error('TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN must be set');
    }

    _twilioClient = twilio(accountSid, authToken);
  }
  return _twilioClient;
}

/**
 * Validate that a request came from Twilio
 *
 * @param authToken - Twilio auth token
 * @param signature - X-Twilio-Signature header value
 * @param url - The full URL of the webhook endpoint
 * @param params - The POST parameters from the request
 * @returns boolean indicating if the request is valid
 */
export function validateTwilioRequest(
  authToken: string,
  signature: string,
  url: string,
  params: Record<string, string>
): boolean {
  return twilioValidateRequest(authToken, signature, url, params);
}

/**
 * Validate request using environment auth token
 */
export function validateRequest(
  signature: string,
  url: string,
  params: Record<string, string>
): boolean {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken) {
    throw new Error('TWILIO_AUTH_TOKEN must be set');
  }
  return validateTwilioRequest(authToken, signature, url, params);
}

// Re-export VoiceResponse for TwiML generation
export const VoiceResponse = twilio.twiml.VoiceResponse;

/**
 * Create a TwiML response that plays a greeting and streams to a WebSocket
 *
 * @param greeting - The initial greeting to say
 * @param streamUrl - The WebSocket URL for real-time voice streaming
 * @returns TwiML response as a string
 */
export function createStreamingTwiml(greeting: string, streamUrl: string): string {
  const response = new VoiceResponse();

  // Play the initial greeting
  response.say(
    {
      voice: 'Polly.Matthew-Neural',
      language: 'en-US',
    },
    greeting
  );

  // Start the bi-directional stream
  const connect = response.connect();
  connect.stream({
    url: streamUrl,
  });

  return response.toString();
}

/**
 * Create a simple TwiML response with a greeting message
 * Used as a fallback when streaming is not available
 *
 * @param message - The message to speak
 * @returns TwiML response as a string
 */
export function createSimpleTwiml(message: string): string {
  const response = new VoiceResponse();

  response.say(
    {
      voice: 'Polly.Matthew-Neural',
      language: 'en-US',
    },
    message
  );

  return response.toString();
}

/**
 * Create a TwiML response for error scenarios
 *
 * @returns TwiML response as a string
 */
export function createErrorTwiml(): string {
  const response = new VoiceResponse();

  response.say(
    {
      voice: 'Polly.Matthew-Neural',
      language: 'en-US',
    },
    "Well I'll be dipped! Something went wrong with my telephone contraption. Call back in a jiffy, would ya?"
  );

  response.hangup();

  return response.toString();
}

/**
 * Twilio webhook parameters for incoming calls
 */
export interface TwilioIncomingCallParams {
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

/**
 * Twilio webhook parameters for call status updates
 */
export interface TwilioStatusCallbackParams {
  CallSid: string;
  AccountSid: string;
  From: string;
  To: string;
  CallStatus: 'queued' | 'ringing' | 'in-progress' | 'completed' | 'busy' | 'failed' | 'no-answer' | 'canceled';
  CallDuration?: string;
  Duration?: string;
  Timestamp?: string;
  SequenceNumber?: string;
}
