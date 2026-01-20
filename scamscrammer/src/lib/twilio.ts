/**
 * Twilio Client and Helpers
 *
 * Provides integration with Twilio for voice calls, including
 * TwiML generation, webhook signature validation, and recording retrieval.
 */

import twilio from 'twilio';
import { validateRequest } from 'twilio/lib/webhooks/webhooks';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;

/**
 * Lazily initialized Twilio client
 */
function getTwilioClient(): twilio.Twilio {
  if (!accountSid || !authToken) {
    throw new Error('Twilio credentials not configured');
  }
  return twilio(accountSid, authToken);
}

/**
 * Validate Twilio webhook signature for security
 * @param signature - X-Twilio-Signature header value
 * @param url - Full URL of the webhook endpoint
 * @param params - Request body parameters
 * @returns true if signature is valid
 */
export function validateTwilioSignature(
  signature: string,
  url: string,
  params: Record<string, string>
): boolean {
  if (!authToken) {
    console.error('TWILIO_AUTH_TOKEN not configured');
    return false;
  }
  return validateRequest(authToken, signature, url, params);
}

/**
 * Generate TwiML response for voice calls
 * @param message - Text to be spoken
 * @returns TwiML XML string
 */
export function generateTwiMLResponse(message: string): string {
  const VoiceResponse = twilio.twiml.VoiceResponse;
  const response = new VoiceResponse();
  response.say({ voice: 'alice' }, message);
  return response.toString();
}

/**
 * Generate TwiML for media streams (WebSocket connection)
 * @param websocketUrl - WebSocket URL for media streaming
 * @param greeting - Optional greeting message before connecting
 * @returns TwiML XML string
 */
export function generateStreamTwiML(websocketUrl: string, greeting?: string): string {
  const VoiceResponse = twilio.twiml.VoiceResponse;
  const response = new VoiceResponse();

  if (greeting) {
    response.say({ voice: 'alice' }, greeting);
  }

  const connect = response.connect();
  connect.stream({ url: websocketUrl });

  return response.toString();
}

/**
 * Get call details from Twilio
 * @param callSid - Twilio Call SID
 * @returns Call details or null if not found
 */
export async function getCallDetails(callSid: string) {
  const client = getTwilioClient();
  try {
    const call = await client.calls(callSid).fetch();
    return {
      sid: call.sid,
      from: call.from,
      to: call.to,
      status: call.status,
      duration: call.duration,
      startTime: call.startTime,
      endTime: call.endTime,
    };
  } catch (error) {
    console.error(`Error fetching call details for ${callSid}:`, error);
    return null;
  }
}

/**
 * Get recording details from Twilio
 * @param recordingSid - Twilio Recording SID
 * @returns Recording details or null if not found
 */
export async function getRecordingDetails(recordingSid: string) {
  const client = getTwilioClient();
  try {
    const recording = await client.recordings(recordingSid).fetch();
    return {
      sid: recording.sid,
      callSid: recording.callSid,
      duration: recording.duration,
      channels: recording.channels,
      source: recording.source,
      status: recording.status,
      uri: recording.uri,
    };
  } catch (error) {
    console.error(`Error fetching recording details for ${recordingSid}:`, error);
    return null;
  }
}

/**
 * Fetch recording audio from Twilio
 * @param recordingUrl - URL to the recording (from webhook payload)
 * @returns Buffer containing the audio data, or null on error
 */
export async function fetchRecordingAudio(recordingUrl: string): Promise<Buffer | null> {
  if (!accountSid || !authToken) {
    console.error('Twilio credentials not configured');
    return null;
  }

  try {
    // Twilio recording URLs need authentication
    // Add .mp3 extension if not present and fetch with auth
    const url = recordingUrl.endsWith('.mp3') ? recordingUrl : `${recordingUrl}.mp3`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
      },
    });

    if (!response.ok) {
      console.error(`Failed to fetch recording: ${response.status} ${response.statusText}`);
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (error) {
    console.error('Error fetching recording audio:', error);
    return null;
  }
}

/**
 * Format phone number to E.164 format
 * @param number - Phone number in any format
 * @returns E.164 formatted number
 */
export function formatPhoneNumber(number: string): string {
  // Remove all non-digit characters except leading +
  const cleaned = number.replace(/[^\d+]/g, '');

  // If already in E.164 format, return as-is
  if (cleaned.startsWith('+')) {
    return cleaned;
  }

  // Assume US number if 10 digits
  if (cleaned.length === 10) {
    return `+1${cleaned}`;
  }

  // Assume US number with country code if 11 digits starting with 1
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    return `+${cleaned}`;
  }

  // Return with + prefix for other cases
  return `+${cleaned}`;
}

/**
 * Delete a recording from Twilio
 * @param recordingSid - Twilio Recording SID
 * @returns true if deleted successfully
 */
export async function deleteRecording(recordingSid: string): Promise<boolean> {
  const client = getTwilioClient();
  try {
    await client.recordings(recordingSid).remove();
    return true;
  } catch (error) {
    console.error(`Error deleting recording ${recordingSid}:`, error);
    return false;
  }
}

export default {
  validateTwilioSignature,
  generateTwiMLResponse,
  generateStreamTwiML,
  getCallDetails,
  getRecordingDetails,
  fetchRecordingAudio,
  formatPhoneNumber,
  deleteRecording,
};
