/**
 * Twilio Integration Module
 *
 * Provides Twilio-related utilities including webhook signature validation.
 */

import { createHmac } from 'crypto';

/**
 * Validates the Twilio webhook signature to ensure requests are authentic.
 *
 * Twilio signs each webhook request using HMAC-SHA1 with your Auth Token.
 * This function verifies that signature to prevent spoofed requests.
 *
 * @param authToken - Your Twilio Auth Token
 * @param signature - The X-Twilio-Signature header from the request
 * @param url - The full URL of your webhook endpoint
 * @param params - The POST body parameters (for POST requests)
 * @returns true if the signature is valid, false otherwise
 *
 * @see https://www.twilio.com/docs/usage/security#validating-requests
 */
export function validateTwilioSignature(
  authToken: string,
  signature: string,
  url: string,
  params: Record<string, string>
): boolean {
  if (!authToken || !signature || !url) {
    return false;
  }

  // Build the data string: URL + sorted POST params
  let data = url;

  // Sort the params alphabetically by key and append key=value pairs
  const sortedKeys = Object.keys(params).sort();
  for (const key of sortedKeys) {
    data += key + params[key];
  }

  // Compute HMAC-SHA1 with the auth token
  const computedSignature = createHmac('sha1', authToken)
    .update(data, 'utf8')
    .digest('base64');

  // Compare signatures (constant-time comparison to prevent timing attacks)
  return timingSafeEqual(signature, computedSignature);
}

/**
 * Constant-time string comparison to prevent timing attacks.
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Twilio call status values that can be received in status callbacks.
 * @see https://www.twilio.com/docs/voice/twiml#callstatus-values
 */
export type TwilioCallStatus =
  | 'queued'
  | 'initiated'
  | 'ringing'
  | 'in-progress'
  | 'completed'
  | 'busy'
  | 'no-answer'
  | 'canceled'
  | 'failed';

/**
 * Gets the Twilio Auth Token from environment variables.
 * Throws an error if not configured.
 */
export function getTwilioAuthToken(): string {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken) {
    throw new Error('TWILIO_AUTH_TOKEN environment variable is not set');
  }
  return authToken;
}

/**
 * Gets the webhook URL base from environment variables.
 * Used to construct full webhook URLs for signature validation.
 */
export function getWebhookBaseUrl(): string {
  const baseUrl = process.env.WEBHOOK_BASE_URL || process.env.VERCEL_URL;
  if (!baseUrl) {
    throw new Error('WEBHOOK_BASE_URL or VERCEL_URL environment variable is not set');
  }
  // Ensure the URL starts with https://
  if (baseUrl.startsWith('http://') || baseUrl.startsWith('https://')) {
    return baseUrl;
  }
  return `https://${baseUrl}`;
}
