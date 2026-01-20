/**
 * Twilio Client and Helpers
 *
 * This module provides Twilio integration for voice calls in ScamScrammer.
 * It wraps the Twilio SDK and provides helper functions for:
 * - Generating TwiML responses
 * - Validating webhook signatures
 * - Fetching call and recording details
 * - Phone number formatting
 */

import twilio, { Twilio } from 'twilio';
import { twiml as TwiML } from 'twilio';
import { validateRequest } from 'twilio';

/**
 * Configuration for the Twilio client
 */
export interface TwilioConfig {
  accountSid: string;
  authToken: string;
  phoneNumber?: string;
}

/**
 * Options for generating stream TwiML
 */
export interface StreamTwiMLOptions {
  /** The WebSocket URL to connect to for media streaming */
  websocketUrl: string;
  /** Initial greeting message before connecting to stream */
  greeting?: string;
  /** Track to stream: inbound_track, outbound_track, or both_tracks */
  track?: 'inbound_track' | 'outbound_track' | 'both_tracks';
}

/** Default voice for Earl persona (older male American voice) */
const DEFAULT_VOICE = 'Polly.Matthew' as const;
const DEFAULT_LANGUAGE = 'en-US' as const;

/**
 * Options for generating voice TwiML
 */
export interface VoiceTwiMLOptions {
  /** The message to speak */
  message: string;
  /** Voice to use for text-to-speech - Polly or Google voice names */
  voice?: string;
  /** Language for text-to-speech */
  language?: string;
  /** Whether to loop the message */
  loop?: number;
}

/**
 * Call details returned from Twilio API
 */
export interface CallDetails {
  sid: string;
  accountSid: string;
  from: string;
  to: string;
  status: string;
  startTime: Date | null;
  endTime: Date | null;
  duration: string | null;
  direction: string;
  answeredBy: string | null;
  callerName: string | null;
  forwardedFrom: string | null;
  price: string | null;
  priceUnit: string | null;
}

/**
 * Recording details returned from Twilio API
 */
export interface RecordingDetails {
  sid: string;
  accountSid: string;
  callSid: string;
  duration: string;
  status: string;
  channels: number;
  source: string;
  startTime: Date;
  price: string | null;
  priceUnit: string | null;
  uri: string;
  mediaUrl: string;
}

/**
 * TwilioClient class wrapping the Twilio SDK
 */
export class TwilioClient {
  private client: Twilio;
  private config: TwilioConfig;

  constructor(config?: Partial<TwilioConfig>) {
    this.config = {
      accountSid: config?.accountSid || process.env.TWILIO_ACCOUNT_SID || '',
      authToken: config?.authToken || process.env.TWILIO_AUTH_TOKEN || '',
      phoneNumber: config?.phoneNumber || process.env.TWILIO_PHONE_NUMBER,
    };

    if (!this.config.accountSid || !this.config.authToken) {
      throw new Error('Twilio credentials not configured. Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN environment variables.');
    }

    this.client = twilio(this.config.accountSid, this.config.authToken);
  }

  /**
   * Get the underlying Twilio client for advanced operations
   */
  getClient(): Twilio {
    return this.client;
  }

  /**
   * Get the configured phone number
   */
  getPhoneNumber(): string | undefined {
    return this.config.phoneNumber;
  }

  /**
   * Generate TwiML response for a voice message
   * @param options - Voice TwiML options
   * @returns TwiML XML string
   */
  generateTwiMLResponse(options: VoiceTwiMLOptions | string): string {
    const response = new TwiML.VoiceResponse();

    if (typeof options === 'string') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      response.say({ voice: DEFAULT_VOICE, language: DEFAULT_LANGUAGE } as any, options);
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      response.say(
        {
          voice: options.voice || DEFAULT_VOICE,
          language: options.language || DEFAULT_LANGUAGE,
          loop: options.loop,
        } as any,
        options.message
      );
    }

    return response.toString();
  }

  /**
   * Generate TwiML for connecting to a WebSocket media stream
   * @param options - Stream TwiML options
   * @returns TwiML XML string
   */
  generateStreamTwiML(options: StreamTwiMLOptions): string {
    const response = new TwiML.VoiceResponse();

    // Play initial greeting if provided
    if (options.greeting) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      response.say({ voice: DEFAULT_VOICE, language: DEFAULT_LANGUAGE } as any, options.greeting);
    }

    // Connect to WebSocket for bidirectional media streaming
    const connect = response.connect();
    const stream = connect.stream({
      url: options.websocketUrl,
    });

    // Set the track to stream
    if (options.track) {
      stream.parameter({ name: 'track', value: options.track });
    }

    return response.toString();
  }

  /**
   * Generate TwiML for recording a call
   * @param options - Recording options
   * @returns TwiML XML string
   */
  generateRecordingTwiML(options: {
    message?: string;
    statusCallbackUrl?: string;
    transcribe?: boolean;
    maxLength?: number;
    timeout?: number;
  }): string {
    const response = new TwiML.VoiceResponse();

    if (options.message) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      response.say({ voice: DEFAULT_VOICE, language: DEFAULT_LANGUAGE } as any, options.message);
    }

    response.record({
      recordingStatusCallback: options.statusCallbackUrl,
      recordingStatusCallbackEvent: ['completed', 'absent'],
      transcribe: options.transcribe,
      maxLength: options.maxLength || 3600, // 1 hour max
      timeout: options.timeout || 30,
    });

    return response.toString();
  }

  /**
   * Generate TwiML that starts recording and connects to a WebSocket stream
   * @param options - Combined options for greeting, recording, and streaming
   * @returns TwiML XML string
   */
  generateFullCallTwiML(options: {
    greeting?: string;
    websocketUrl: string;
    statusCallbackUrl?: string;
    recordingStatusCallbackUrl?: string;
  }): string {
    const response = new TwiML.VoiceResponse();

    // Start call recording if callback URL is provided
    if (options.recordingStatusCallbackUrl) {
      response.record({
        recordingStatusCallback: options.recordingStatusCallbackUrl,
        recordingStatusCallbackEvent: ['completed', 'absent'],
        maxLength: 3600,
      });
    }

    // Play initial greeting
    if (options.greeting) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      response.say({ voice: DEFAULT_VOICE, language: DEFAULT_LANGUAGE } as any, options.greeting);
    }

    // Connect to WebSocket for AI conversation
    const connect = response.connect();
    connect.stream({
      url: options.websocketUrl,
    });

    return response.toString();
  }

  /**
   * Fetch call details from Twilio API
   * @param callSid - The Twilio Call SID
   * @returns Call details
   */
  async getCallDetails(callSid: string): Promise<CallDetails> {
    const call = await this.client.calls(callSid).fetch();

    return {
      sid: call.sid,
      accountSid: call.accountSid,
      from: call.from,
      to: call.to,
      status: call.status,
      startTime: call.startTime,
      endTime: call.endTime,
      duration: call.duration,
      direction: call.direction,
      answeredBy: call.answeredBy,
      callerName: call.callerName,
      forwardedFrom: call.forwardedFrom,
      price: call.price,
      priceUnit: call.priceUnit,
    };
  }

  /**
   * Fetch recording details from Twilio API
   * @param recordingSid - The Twilio Recording SID
   * @returns Recording details
   */
  async getRecording(recordingSid: string): Promise<RecordingDetails> {
    const recording = await this.client.recordings(recordingSid).fetch();

    return {
      sid: recording.sid,
      accountSid: recording.accountSid,
      callSid: recording.callSid,
      duration: recording.duration,
      status: recording.status,
      channels: recording.channels,
      source: recording.source,
      startTime: recording.startTime,
      price: recording.price,
      priceUnit: recording.priceUnit,
      uri: recording.uri,
      mediaUrl: `https://api.twilio.com${recording.uri.replace('.json', '.mp3')}`,
    };
  }

  /**
   * Get the recording audio URL with authentication
   * @param recordingSid - The Twilio Recording SID
   * @returns Authenticated URL to download the recording
   */
  getRecordingUrl(recordingSid: string): string {
    return `https://api.twilio.com/2010-04-01/Accounts/${this.config.accountSid}/Recordings/${recordingSid}.mp3`;
  }

  /**
   * Download recording audio as a Buffer
   * @param recordingSid - The Twilio Recording SID
   * @returns Audio buffer
   */
  async downloadRecording(recordingSid: string): Promise<Buffer> {
    const url = this.getRecordingUrl(recordingSid);
    const credentials = Buffer.from(`${this.config.accountSid}:${this.config.authToken}`).toString('base64');

    const response = await fetch(url, {
      headers: {
        Authorization: `Basic ${credentials}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to download recording: ${response.status} ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  /**
   * List recordings for a specific call
   * @param callSid - The Twilio Call SID
   * @returns List of recordings
   */
  async listRecordingsForCall(callSid: string): Promise<RecordingDetails[]> {
    const recordings = await this.client.recordings.list({ callSid, limit: 20 });

    return recordings.map((recording) => ({
      sid: recording.sid,
      accountSid: recording.accountSid,
      callSid: recording.callSid,
      duration: recording.duration,
      status: recording.status,
      channels: recording.channels,
      source: recording.source,
      startTime: recording.startTime,
      price: recording.price,
      priceUnit: recording.priceUnit,
      uri: recording.uri,
      mediaUrl: `https://api.twilio.com${recording.uri.replace('.json', '.mp3')}`,
    }));
  }

  /**
   * End an active call
   * @param callSid - The Twilio Call SID
   * @returns Updated call details
   */
  async endCall(callSid: string): Promise<CallDetails> {
    const call = await this.client.calls(callSid).update({ status: 'completed' });

    return {
      sid: call.sid,
      accountSid: call.accountSid,
      from: call.from,
      to: call.to,
      status: call.status,
      startTime: call.startTime,
      endTime: call.endTime,
      duration: call.duration,
      direction: call.direction,
      answeredBy: call.answeredBy,
      callerName: call.callerName,
      forwardedFrom: call.forwardedFrom,
      price: call.price,
      priceUnit: call.priceUnit,
    };
  }
}

/**
 * Validate Twilio webhook request signature
 * @param authToken - Twilio Auth Token
 * @param signature - X-Twilio-Signature header value
 * @param url - Full URL of the webhook endpoint
 * @param params - Request body parameters
 * @returns true if signature is valid
 */
export function validateTwilioSignature(
  authToken: string,
  signature: string,
  url: string,
  params: Record<string, string>
): boolean {
  return validateRequest(authToken, signature, url, params);
}

/**
 * Validate Twilio webhook request from NextJS request object
 * @param request - NextJS Request object
 * @param body - Parsed request body
 * @returns true if signature is valid
 */
export async function validateTwilioWebhook(
  request: Request,
  body: Record<string, string>
): Promise<boolean> {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken) {
    throw new Error('TWILIO_AUTH_TOKEN environment variable not set');
  }

  const signature = request.headers.get('x-twilio-signature');
  if (!signature) {
    return false;
  }

  // Get the full URL from the request
  const url = request.url;

  return validateTwilioSignature(authToken, signature, url, body);
}

/**
 * Format a phone number to E.164 format
 * @param phoneNumber - Phone number in any format
 * @param defaultCountryCode - Default country code if not present (default: '1' for US)
 * @returns Phone number in E.164 format (+1234567890)
 */
export function formatPhoneNumber(phoneNumber: string, defaultCountryCode: string = '1'): string {
  // Remove all non-digit characters except leading +
  let cleaned = phoneNumber.replace(/[^\d+]/g, '');

  // If it starts with +, keep it
  if (cleaned.startsWith('+')) {
    return cleaned;
  }

  // Remove any leading zeros
  cleaned = cleaned.replace(/^0+/, '');

  // If the number doesn't start with a country code, add the default
  if (cleaned.length <= 10) {
    cleaned = defaultCountryCode + cleaned;
  }

  // Add + prefix
  return '+' + cleaned;
}

/**
 * Parse phone number into components
 * @param phoneNumber - Phone number in E.164 format
 * @returns Object with country code, area code, and local number
 */
export function parsePhoneNumber(phoneNumber: string): {
  countryCode: string;
  areaCode: string;
  localNumber: string;
  formatted: string;
} {
  const cleaned = phoneNumber.replace(/[^\d]/g, '');

  // Assume North American format for now
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    return {
      countryCode: '1',
      areaCode: cleaned.substring(1, 4),
      localNumber: cleaned.substring(4),
      formatted: `+1 (${cleaned.substring(1, 4)}) ${cleaned.substring(4, 7)}-${cleaned.substring(7)}`,
    };
  }

  if (cleaned.length === 10) {
    return {
      countryCode: '1',
      areaCode: cleaned.substring(0, 3),
      localNumber: cleaned.substring(3),
      formatted: `+1 (${cleaned.substring(0, 3)}) ${cleaned.substring(3, 6)}-${cleaned.substring(6)}`,
    };
  }

  // Fallback for international numbers
  return {
    countryCode: cleaned.substring(0, cleaned.length - 10) || '1',
    areaCode: cleaned.substring(cleaned.length - 10, cleaned.length - 7),
    localNumber: cleaned.substring(cleaned.length - 7),
    formatted: '+' + cleaned,
  };
}

/**
 * Check if a phone number appears to be a valid format
 * @param phoneNumber - Phone number to validate
 * @returns true if the phone number appears valid
 */
export function isValidPhoneNumber(phoneNumber: string): boolean {
  const cleaned = phoneNumber.replace(/[^\d]/g, '');

  // Valid lengths: 10 (US without country), 11 (US with country), or longer for international
  return cleaned.length >= 10 && cleaned.length <= 15;
}

/**
 * Mask a phone number for privacy (show only last 4 digits)
 * @param phoneNumber - Phone number to mask
 * @returns Masked phone number
 */
export function maskPhoneNumber(phoneNumber: string): string {
  const cleaned = phoneNumber.replace(/[^\d]/g, '');
  if (cleaned.length < 4) {
    return '****';
  }
  return '*'.repeat(cleaned.length - 4) + cleaned.slice(-4);
}

/**
 * Map Twilio call status to our internal CallStatus enum
 * @param twilioStatus - Twilio call status string
 * @returns Our internal status string
 */
export function mapTwilioStatus(
  twilioStatus: string
): 'RINGING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'NO_ANSWER' {
  switch (twilioStatus.toLowerCase()) {
    case 'queued':
    case 'ringing':
      return 'RINGING';
    case 'in-progress':
    case 'initiated':
    case 'answered':
      return 'IN_PROGRESS';
    case 'completed':
      return 'COMPLETED';
    case 'busy':
    case 'failed':
    case 'canceled':
      return 'FAILED';
    case 'no-answer':
      return 'NO_ANSWER';
    default:
      return 'FAILED';
  }
}

/**
 * Parse form data from a Twilio webhook request
 * @param request - The incoming Request object
 * @returns Parsed form data as a Record
 */
export async function parseTwilioFormData(request: Request): Promise<Record<string, string>> {
  const formData = await request.formData();
  const params: Record<string, string> = {};

  formData.forEach((value, key) => {
    params[key] = value.toString();
  });

  return params;
}

// Create a singleton instance for convenience
let twilioClientInstance: TwilioClient | null = null;

/**
 * Get the singleton TwilioClient instance
 * @returns TwilioClient instance
 */
export function getTwilioClient(): TwilioClient {
  if (!twilioClientInstance) {
    twilioClientInstance = new TwilioClient();
  }
  return twilioClientInstance;
}

/**
 * Reset the singleton instance (useful for testing)
 */
export function resetTwilioClient(): void {
  twilioClientInstance = null;
}

export default TwilioClient;
