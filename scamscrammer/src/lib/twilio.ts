/**
 * Twilio Client and Helpers for ScamScrammer
 *
 * This module provides a wrapper around the Twilio SDK for handling
 * voice calls, generating TwiML responses, and validating webhooks.
 */

import twilio from 'twilio';
import type { NextRequest } from 'next/server';

// VoiceResponse is accessed via the twilio module
const VoiceResponse = twilio.twiml.VoiceResponse;
import type {
  TwilioCallDetails,
  TwilioRecordingDetails,
  TwiMLOptions,
} from '@/types';

// ============================================================================
// Environment Configuration
// ============================================================================

/**
 * Get Twilio configuration from environment variables
 * We use functions instead of constants to allow runtime changes (useful for testing)
 */
function getAccountSid(): string | undefined {
  return process.env.TWILIO_ACCOUNT_SID;
}

function getAuthToken(): string | undefined {
  return process.env.TWILIO_AUTH_TOKEN;
}

function getPhoneNumberFromEnv(): string | undefined {
  return process.env.TWILIO_PHONE_NUMBER;
}

/**
 * Validates that required Twilio environment variables are set
 */
function validateConfig(): void {
  if (!getAccountSid()) {
    throw new Error('TWILIO_ACCOUNT_SID environment variable is not set');
  }
  if (!getAuthToken()) {
    throw new Error('TWILIO_AUTH_TOKEN environment variable is not set');
  }
}

// ============================================================================
// TwilioClient Class
// ============================================================================

/**
 * TwilioClient wraps the Twilio SDK and provides helper methods
 * for ScamScrammer's voice call handling.
 *
 * @example
 * ```ts
 * const client = new TwilioClient();
 * const callDetails = await client.getCallDetails('CA123...');
 * ```
 */
export class TwilioClient {
  private client: twilio.Twilio;

  constructor() {
    validateConfig();
    this.client = twilio(getAccountSid()!, getAuthToken()!);
  }

  /**
   * Get the underlying Twilio client for advanced operations
   */
  getClient(): twilio.Twilio {
    return this.client;
  }

  /**
   * Fetch details about a specific call
   *
   * @param callSid - The Twilio Call SID
   * @returns Call details including status, duration, etc.
   */
  async getCallDetails(callSid: string): Promise<TwilioCallDetails> {
    try {
      const call = await this.client.calls(callSid).fetch();

      return {
        sid: call.sid,
        status: call.status,
        from: call.from,
        to: call.to,
        direction: call.direction,
        duration: call.duration ? parseInt(call.duration, 10) : null,
        startTime: call.startTime ? new Date(call.startTime) : null,
        endTime: call.endTime ? new Date(call.endTime) : null,
        price: call.price,
        priceUnit: call.priceUnit,
      };
    } catch (error) {
      throw new TwilioClientError(
        `Failed to fetch call details for ${callSid}`,
        error
      );
    }
  }

  /**
   * Fetch details about a specific recording
   *
   * @param recordingSid - The Twilio Recording SID
   * @returns Recording details including URL and duration
   */
  async getRecording(recordingSid: string): Promise<TwilioRecordingDetails> {
    try {
      const recording = await this.client.recordings(recordingSid).fetch();

      return {
        sid: recording.sid,
        callSid: recording.callSid,
        status: recording.status,
        duration: parseInt(recording.duration, 10),
        url: recording.uri.replace('.json', ''),
        mediaUrl: `https://api.twilio.com${recording.uri.replace('.json', '.mp3')}`,
      };
    } catch (error) {
      throw new TwilioClientError(
        `Failed to fetch recording ${recordingSid}`,
        error
      );
    }
  }

  /**
   * Get the configured Twilio phone number
   */
  getPhoneNumber(): string {
    const phoneNumber = getPhoneNumberFromEnv();
    if (!phoneNumber) {
      throw new Error('TWILIO_PHONE_NUMBER environment variable is not set');
    }
    return phoneNumber;
  }
}

// ============================================================================
// TwiML Response Generators
// ============================================================================

/**
 * Default options for TwiML responses
 */
const DEFAULT_TWIML_OPTIONS: TwiMLOptions = {
  voice: 'Polly.Matthew',
  language: 'en-US',
  record: false,
};

/**
 * Generate a TwiML response that speaks a message
 *
 * @param message - The text to speak
 * @param options - Optional configuration for voice and recording
 * @returns TwiML XML string
 *
 * @example
 * ```ts
 * const twiml = generateTwiMLResponse("Hello, this is Earl speaking!");
 * // Returns: <?xml version="1.0" encoding="UTF-8"?>
 * //          <Response><Say voice="Polly.Matthew">Hello, this is Earl speaking!</Say></Response>
 * ```
 */
export function generateTwiMLResponse(
  message: string,
  options: TwiMLOptions = {}
): string {
  const opts = { ...DEFAULT_TWIML_OPTIONS, ...options };
  const response = new VoiceResponse();

  response.say(
    {
      voice: opts.voice as 'alice' | 'man' | 'woman',
      language: opts.language,
    },
    message
  );

  return response.toString();
}

/**
 * Generate TwiML that connects to a WebSocket for real-time media streaming
 *
 * This is used to connect Twilio calls to the OpenAI Realtime API via
 * a bidirectional audio stream.
 *
 * @param websocketUrl - The WebSocket URL to connect to (wss://...)
 * @param options - Optional configuration for recording
 * @returns TwiML XML string
 *
 * @example
 * ```ts
 * const twiml = generateStreamTwiML("wss://example.com/voice/stream");
 * ```
 */
export function generateStreamTwiML(
  websocketUrl: string,
  options: TwiMLOptions = {}
): string {
  const opts = { ...DEFAULT_TWIML_OPTIONS, ...options };
  const response = new VoiceResponse();

  // Optionally start recording
  if (opts.record) {
    response.record({
      recordingStatusCallback: opts.recordingStatusCallback,
      recordingStatusCallbackEvent: ['completed', 'failed'],
    });
  }

  // Connect to WebSocket stream for real-time audio
  const connect = response.connect();
  const stream = connect.stream({
    url: websocketUrl,
  });

  // Configure stream parameters
  stream.parameter({ name: 'FirstMessage', value: 'Hello from ScamScrammer!' });

  return response.toString();
}

/**
 * Generate TwiML that plays an initial greeting and then connects to a WebSocket stream
 *
 * @param greeting - Initial message to say before connecting
 * @param websocketUrl - The WebSocket URL for streaming
 * @param options - Optional configuration
 * @returns TwiML XML string
 */
export function generateGreetingAndStreamTwiML(
  greeting: string,
  websocketUrl: string,
  options: TwiMLOptions = {}
): string {
  const opts = { ...DEFAULT_TWIML_OPTIONS, ...options };
  const response = new VoiceResponse();

  // Say the initial greeting
  response.say(
    {
      voice: opts.voice as 'alice' | 'man' | 'woman',
      language: opts.language,
    },
    greeting
  );

  // Start recording if enabled
  if (opts.record && opts.recordingStatusCallback) {
    response.record({
      recordingStatusCallback: opts.recordingStatusCallback,
      recordingStatusCallbackEvent: ['completed', 'failed'],
    });
  }

  // Connect to WebSocket stream
  const connect = response.connect();
  connect.stream({
    url: websocketUrl,
  });

  return response.toString();
}

/**
 * Generate a simple TwiML response that hangs up
 *
 * @param message - Optional goodbye message
 * @returns TwiML XML string
 */
export function generateHangupTwiML(message?: string): string {
  const response = new VoiceResponse();

  if (message) {
    response.say(
      {
        voice: 'Polly.Matthew',
        language: 'en-US',
      },
      message
    );
  }

  response.hangup();

  return response.toString();
}

/**
 * Generate a fallback TwiML response for error scenarios
 *
 * @returns TwiML XML string with a polite error message
 */
export function generateFallbackTwiML(): string {
  const response = new VoiceResponse();

  response.say(
    {
      voice: 'Polly.Matthew',
      language: 'en-US',
    },
    "Oh dear, I seem to be having some trouble here. Can you call back in a bit? My hearing aid's acting up again."
  );

  response.hangup();

  return response.toString();
}

// ============================================================================
// Webhook Signature Validation
// ============================================================================

/**
 * Validate that a request came from Twilio by checking the signature
 *
 * This is critical for security - it ensures webhook requests are
 * actually from Twilio and not spoofed by attackers.
 *
 * @param request - The incoming Next.js request
 * @param body - The parsed body of the request (as form data object)
 * @returns True if the signature is valid, false otherwise
 *
 * @example
 * ```ts
 * const isValid = await validateTwilioSignature(request, body);
 * if (!isValid) {
 *   return new Response('Invalid signature', { status: 403 });
 * }
 * ```
 */
export async function validateTwilioSignature(
  request: NextRequest,
  body: Record<string, string>
): Promise<boolean> {
  const authToken = getAuthToken();
  if (!authToken) {
    console.error('TWILIO_AUTH_TOKEN not set, cannot validate signature');
    return false;
  }

  const signature = request.headers.get('x-twilio-signature');
  if (!signature) {
    console.warn('No x-twilio-signature header present');
    return false;
  }

  // Get the full URL that Twilio used to call us
  const url = request.url;

  try {
    const isValid = twilio.validateRequest(
      authToken,
      signature,
      url,
      body
    );

    if (!isValid) {
      console.warn('Invalid Twilio signature detected', {
        url,
        hasSignature: !!signature,
      });
    }

    return isValid;
  } catch (error) {
    console.error('Error validating Twilio signature:', error);
    return false;
  }
}

/**
 * Parse form data from a Twilio webhook request
 *
 * @param request - The incoming Next.js request
 * @returns Parsed body as a key-value object
 */
export async function parseTwilioWebhookBody(
  request: NextRequest
): Promise<Record<string, string>> {
  const formData = await request.formData();
  const body: Record<string, string> = {};

  formData.forEach((value, key) => {
    body[key] = value.toString();
  });

  return body;
}

// ============================================================================
// Phone Number Formatting
// ============================================================================

/**
 * Format a phone number to E.164 format
 *
 * E.164 is the international standard format: +[country code][number]
 * Example: +15551234567
 *
 * @param phoneNumber - The phone number to format (various formats accepted)
 * @returns E.164 formatted phone number
 *
 * @example
 * ```ts
 * formatPhoneNumber("555-123-4567")     // "+15551234567"
 * formatPhoneNumber("(555) 123-4567")   // "+15551234567"
 * formatPhoneNumber("+1 555 123 4567")  // "+15551234567"
 * ```
 */
export function formatPhoneNumber(phoneNumber: string): string {
  // Remove all non-numeric characters except leading +
  let cleaned = phoneNumber.replace(/[^\d+]/g, '');

  // If it starts with +, keep it; otherwise add +1 (US) if needed
  if (cleaned.startsWith('+')) {
    // Already has country code
    return cleaned;
  }

  // Remove leading 1 if present (US country code without +)
  if (cleaned.startsWith('1') && cleaned.length === 11) {
    return `+${cleaned}`;
  }

  // Assume US number if 10 digits
  if (cleaned.length === 10) {
    return `+1${cleaned}`;
  }

  // Return as-is with + prefix for other cases
  return `+${cleaned}`;
}

/**
 * Format a phone number for display purposes
 *
 * @param phoneNumber - E.164 formatted phone number
 * @returns Human-readable format like "(555) 123-4567"
 */
export function formatPhoneNumberForDisplay(phoneNumber: string): string {
  // Remove the + and country code for US numbers
  let cleaned = phoneNumber.replace(/[^\d]/g, '');

  // Handle US numbers (11 digits starting with 1)
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    cleaned = cleaned.substring(1);
  }

  // Format as (XXX) XXX-XXXX for 10-digit numbers
  if (cleaned.length === 10) {
    return `(${cleaned.substring(0, 3)}) ${cleaned.substring(3, 6)}-${cleaned.substring(6)}`;
  }

  // Return original for non-US formats
  return phoneNumber;
}

/**
 * Check if a phone number appears to be valid
 *
 * @param phoneNumber - The phone number to validate
 * @returns True if the number appears valid
 */
export function isValidPhoneNumber(phoneNumber: string): boolean {
  const cleaned = phoneNumber.replace(/[^\d]/g, '');
  // Valid if 10 digits (US without country code) or 11+ digits (with country code)
  return cleaned.length >= 10 && cleaned.length <= 15;
}

// ============================================================================
// Error Classes
// ============================================================================

/**
 * Custom error class for Twilio-related errors
 */
export class TwilioClientError extends Error {
  public readonly cause: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'TwilioClientError';
    this.cause = cause;

    // Maintains proper stack trace for where error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, TwilioClientError);
    }
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let twilioClientInstance: TwilioClient | null = null;

/**
 * Get or create a singleton TwilioClient instance
 *
 * @returns TwilioClient singleton
 */
export function getTwilioClient(): TwilioClient {
  if (!twilioClientInstance) {
    twilioClientInstance = new TwilioClient();
  }
  return twilioClientInstance;
}

// ============================================================================
// Exports
// ============================================================================

export default TwilioClient;
