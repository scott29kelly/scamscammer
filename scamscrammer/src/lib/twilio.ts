/**
 * Twilio Client Library
 *
 * Provides utilities for Twilio webhook validation and recording management.
 */

import crypto from 'crypto';

/**
 * Twilio recording status values
 */
export type TwilioRecordingStatus =
  | 'in-progress'
  | 'completed'
  | 'absent'
  | 'failed';

/**
 * Twilio recording webhook payload
 */
export interface TwilioRecordingPayload {
  AccountSid: string;
  CallSid: string;
  RecordingSid: string;
  RecordingUrl: string;
  RecordingStatus: TwilioRecordingStatus;
  RecordingDuration?: string;
  RecordingChannels?: string;
  RecordingSource?: string;
  RecordingStartTime?: string;
  ErrorCode?: string;
}

/**
 * Twilio call details response
 */
export interface TwilioCallDetails {
  sid: string;
  from: string;
  to: string;
  status: string;
  duration: string | null;
  startTime: string | null;
  endTime: string | null;
}

/**
 * Validates a Twilio request signature to ensure the request is authentic.
 * Uses the X-Twilio-Signature header and your auth token.
 *
 * @param authToken - Your Twilio auth token
 * @param signature - The X-Twilio-Signature header value
 * @param url - The full URL of the request (including protocol and query string)
 * @param params - The POST parameters as a key-value object
 * @returns boolean indicating if the signature is valid
 */
export function validateTwilioSignature(
  authToken: string,
  signature: string,
  url: string,
  params: Record<string, string>
): boolean {
  // Sort the POST parameters alphabetically by key
  const sortedParams = Object.keys(params)
    .sort()
    .reduce((acc, key) => acc + key + params[key], '');

  // Concatenate the URL and parameters
  const data = url + sortedParams;

  // Compute HMAC-SHA1
  const expectedSignature = crypto
    .createHmac('sha1', authToken)
    .update(data, 'utf8')
    .digest('base64');

  // Use timing-safe comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch {
    // If buffers are different lengths, comparison fails
    return false;
  }
}

/**
 * Formats a phone number to E.164 format
 *
 * @param phoneNumber - The phone number to format
 * @returns The formatted phone number
 */
export function formatPhoneNumber(phoneNumber: string): string {
  // Remove all non-digit characters except leading +
  const cleaned = phoneNumber.replace(/[^\d+]/g, '');

  // If it starts with +, it's already E.164
  if (cleaned.startsWith('+')) {
    return cleaned;
  }

  // If it's a 10-digit US number, add +1
  if (cleaned.length === 10) {
    return `+1${cleaned}`;
  }

  // If it's an 11-digit number starting with 1, add +
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    return `+${cleaned}`;
  }

  // Otherwise, return as-is with +
  return `+${cleaned}`;
}

/**
 * TwilioClient class for interacting with Twilio API
 */
export class TwilioClient {
  private accountSid: string;
  private authToken: string;
  private baseUrl: string;

  constructor(accountSid?: string, authToken?: string) {
    this.accountSid = accountSid || process.env.TWILIO_ACCOUNT_SID || '';
    this.authToken = authToken || process.env.TWILIO_AUTH_TOKEN || '';
    this.baseUrl = `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}`;

    if (!this.accountSid || !this.authToken) {
      console.warn('TwilioClient: Missing account SID or auth token');
    }
  }

  /**
   * Get the auth token for signature validation
   */
  getAuthToken(): string {
    return this.authToken;
  }

  /**
   * Fetches details about a specific call
   *
   * @param callSid - The Twilio Call SID
   * @returns Call details or null if not found
   */
  async getCallDetails(callSid: string): Promise<TwilioCallDetails | null> {
    try {
      const response = await fetch(`${this.baseUrl}/Calls/${callSid}.json`, {
        headers: {
          Authorization: `Basic ${Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64')}`,
        },
      });

      if (!response.ok) {
        console.error(`Failed to fetch call details: ${response.status}`);
        return null;
      }

      const data = await response.json();
      return {
        sid: data.sid,
        from: data.from,
        to: data.to,
        status: data.status,
        duration: data.duration,
        startTime: data.start_time,
        endTime: data.end_time,
      };
    } catch (error) {
      console.error('Error fetching call details:', error);
      return null;
    }
  }

  /**
   * Fetches a recording's audio content from Twilio
   *
   * @param recordingUrl - The Twilio recording URL
   * @returns Buffer containing the audio data, or null if failed
   */
  async getRecording(recordingUrl: string): Promise<Buffer | null> {
    try {
      // Twilio recording URLs don't include the file extension by default
      // Add .mp3 to get the audio file
      const audioUrl = recordingUrl.endsWith('.mp3') ? recordingUrl : `${recordingUrl}.mp3`;

      const response = await fetch(audioUrl, {
        headers: {
          Authorization: `Basic ${Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64')}`,
        },
      });

      if (!response.ok) {
        console.error(`Failed to fetch recording: ${response.status}`);
        return null;
      }

      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (error) {
      console.error('Error fetching recording:', error);
      return null;
    }
  }

  /**
   * Generates TwiML response for greeting and WebSocket connection
   *
   * @param websocketUrl - The WebSocket URL for real-time audio streaming
   * @param greeting - The initial greeting message
   * @returns TwiML string
   */
  generateStreamTwiML(websocketUrl: string, greeting?: string): string {
    const greetingTwiML = greeting
      ? `<Say voice="Polly.Matthew">${this.escapeXml(greeting)}</Say>`
      : '';

    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${greetingTwiML}
  <Connect>
    <Stream url="${this.escapeXml(websocketUrl)}">
      <Parameter name="track" value="both_tracks" />
    </Stream>
  </Connect>
</Response>`;
  }

  /**
   * Generates basic TwiML response
   *
   * @param message - Message to speak
   * @returns TwiML string
   */
  generateTwiMLResponse(message: string): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Matthew">${this.escapeXml(message)}</Say>
</Response>`;
  }

  /**
   * Escapes special XML characters
   */
  private escapeXml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}

// Export a default instance
export const twilioClient = new TwilioClient();
