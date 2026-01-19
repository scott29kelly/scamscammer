/**
 * Twilio client and helper functions for ScamScrammer
 *
 * Provides webhook validation, TwiML generation, and phone number utilities
 */

import { NextRequest } from 'next/server';
import crypto from 'crypto';

// =============================================================================
// Environment Configuration
// =============================================================================

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;

// =============================================================================
// Webhook Validation
// =============================================================================

/**
 * Validate that a webhook request actually came from Twilio
 *
 * Uses Twilio's signature validation to verify the authenticity of webhook requests.
 * See: https://www.twilio.com/docs/usage/webhooks/webhooks-security
 *
 * @param request - The incoming NextRequest
 * @param body - The parsed body as a Record<string, string>
 * @returns true if the signature is valid, false otherwise
 */
export async function validateTwilioSignature(
  request: NextRequest,
  body: Record<string, string>
): Promise<boolean> {
  // Skip validation in development if no auth token is set
  if (!TWILIO_AUTH_TOKEN) {
    console.warn('TWILIO_AUTH_TOKEN not set, skipping signature validation');
    return process.env.NODE_ENV === 'development';
  }

  const signature = request.headers.get('x-twilio-signature');
  if (!signature) {
    console.warn('Missing X-Twilio-Signature header');
    return false;
  }

  // Build the full URL Twilio used to sign the request
  const url = buildSignatureUrl(request);

  // Compute expected signature
  const expectedSignature = computeTwilioSignature(url, body);

  // Constant-time comparison to prevent timing attacks
  return timingSafeEqual(signature, expectedSignature);
}

/**
 * Build the URL string used for Twilio signature validation
 *
 * Twilio uses the full URL including protocol, host, and path
 * The URL must match exactly what Twilio has configured
 */
function buildSignatureUrl(request: NextRequest): string {
  // Use the x-forwarded headers if behind a proxy (Vercel, etc.)
  const protocol = request.headers.get('x-forwarded-proto') || 'https';
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || '';

  // Get the pathname from the request URL
  const { pathname } = new URL(request.url);

  return `${protocol}://${host}${pathname}`;
}

/**
 * Compute the expected Twilio signature for a given URL and body
 *
 * Twilio's signature algorithm:
 * 1. Take the full URL
 * 2. Sort the POST parameters alphabetically by key
 * 3. Append each key-value pair to the URL (no delimiters)
 * 4. HMAC-SHA1 the result using your auth token
 * 5. Base64 encode the hash
 */
function computeTwilioSignature(url: string, body: Record<string, string>): string {
  // Sort parameters alphabetically and append to URL
  const sortedKeys = Object.keys(body).sort();
  let data = url;

  for (const key of sortedKeys) {
    data += key + body[key];
  }

  // HMAC-SHA1 with auth token, base64 encoded
  const hmac = crypto.createHmac('sha1', TWILIO_AUTH_TOKEN!);
  hmac.update(data);
  return hmac.digest('base64');
}

/**
 * Constant-time string comparison to prevent timing attacks
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);

  return crypto.timingSafeEqual(bufA, bufB);
}

// =============================================================================
// Webhook Body Parsing
// =============================================================================

/**
 * Parse the body of a Twilio webhook request
 *
 * Twilio sends data as application/x-www-form-urlencoded
 *
 * @param request - The incoming NextRequest
 * @returns Parsed body as a Record<string, string>
 */
export async function parseTwilioWebhookBody(
  request: NextRequest
): Promise<Record<string, string>> {
  const contentType = request.headers.get('content-type') || '';

  if (contentType.includes('application/x-www-form-urlencoded')) {
    const formData = await request.formData();
    const body: Record<string, string> = {};

    formData.forEach((value, key) => {
      body[key] = value.toString();
    });

    return body;
  }

  // Fallback: try to parse as JSON (for testing)
  try {
    return await request.json();
  } catch {
    return {};
  }
}

// =============================================================================
// TwiML Generation
// =============================================================================

/**
 * Generate a simple TwiML response with a spoken message
 *
 * @param message - The message to speak
 * @returns TwiML XML string
 */
export function generateTwiMLResponse(message: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">${escapeXml(message)}</Say>
</Response>`;
}

/**
 * Generate TwiML that connects to a WebSocket for real-time streaming
 *
 * @param websocketUrl - The WebSocket URL to connect to
 * @returns TwiML XML string
 */
export function generateStreamTwiML(websocketUrl: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${escapeXml(websocketUrl)}" />
  </Connect>
</Response>`;
}

/**
 * Generate TwiML that plays a greeting then connects to WebSocket
 *
 * @param greeting - Initial greeting message
 * @param websocketUrl - The WebSocket URL for streaming
 * @returns TwiML XML string
 */
export function generateGreetingAndStreamTwiML(
  greeting: string,
  websocketUrl: string
): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">${escapeXml(greeting)}</Say>
  <Connect>
    <Stream url="${escapeXml(websocketUrl)}" />
  </Connect>
</Response>`;
}

/**
 * Generate TwiML to hang up with an optional message
 *
 * @param message - Optional farewell message
 * @returns TwiML XML string
 */
export function generateHangupTwiML(message?: string): string {
  if (message) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">${escapeXml(message)}</Say>
  <Hangup />
</Response>`;
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Hangup />
</Response>`;
}

/**
 * Generate fallback TwiML for error scenarios
 *
 * @returns TwiML XML string
 */
export function generateFallbackTwiML(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">I'm sorry, we're experiencing technical difficulties. Please try again later.</Say>
  <Hangup />
</Response>`;
}

/**
 * Escape special characters for XML
 */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// =============================================================================
// Phone Number Utilities
// =============================================================================

/**
 * Format a phone number to E.164 format
 *
 * @param phoneNumber - Phone number in any format
 * @returns E.164 formatted number (e.g., +15551234567)
 */
export function formatPhoneNumber(phoneNumber: string): string {
  // Remove all non-digit characters except leading +
  let cleaned = phoneNumber.replace(/[^\d+]/g, '');

  // If starts with +, keep it
  if (cleaned.startsWith('+')) {
    return cleaned;
  }

  // If 10 digits (US), add +1
  if (cleaned.length === 10) {
    return `+1${cleaned}`;
  }

  // If 11 digits starting with 1 (US), add +
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    return `+${cleaned}`;
  }

  // Otherwise, just add + prefix
  return `+${cleaned}`;
}

/**
 * Format phone number for display
 *
 * @param phoneNumber - Phone number in E.164 or other format
 * @returns Human-readable format (e.g., "(555) 123-4567")
 */
export function formatPhoneNumberForDisplay(phoneNumber: string): string {
  // Remove non-digits
  const digits = phoneNumber.replace(/\D/g, '');

  // Handle US numbers (10 or 11 digits)
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  if (digits.length === 11 && digits.startsWith('1')) {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }

  // For other formats, return as-is with + prefix
  return phoneNumber.startsWith('+') ? phoneNumber : `+${digits}`;
}

/**
 * Validate if a string is a valid phone number
 *
 * @param phoneNumber - Phone number to validate
 * @returns true if valid, false otherwise
 */
export function isValidPhoneNumber(phoneNumber: string): boolean {
  const digits = phoneNumber.replace(/\D/g, '');
  // Accept 10-15 digits (international range)
  return digits.length >= 10 && digits.length <= 15;
}

// =============================================================================
// Configuration Getters
// =============================================================================

/**
 * Get the configured Twilio phone number
 */
export function getPhoneNumber(): string {
  if (!TWILIO_PHONE_NUMBER) {
    throw new Error('TWILIO_PHONE_NUMBER environment variable not set');
  }
  return TWILIO_PHONE_NUMBER;
}

/**
 * Get the Twilio Account SID
 */
export function getAccountSid(): string {
  if (!TWILIO_ACCOUNT_SID) {
    throw new Error('TWILIO_ACCOUNT_SID environment variable not set');
  }
  return TWILIO_ACCOUNT_SID;
}

/**
 * Check if Twilio is properly configured
 */
export function isTwilioConfigured(): boolean {
  return !!(TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_PHONE_NUMBER);
}
