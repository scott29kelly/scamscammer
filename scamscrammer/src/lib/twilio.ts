/**
 * Twilio Client Wrapper
 *
 * Handles Twilio API interactions including TwiML generation,
 * signature validation, and media stream configuration.
 */

import twilio from 'twilio';

export interface TwilioConfig {
  accountSid: string;
  authToken: string;
  phoneNumber?: string;
}

export interface TwiMLStreamConfig {
  websocketUrl: string;
  greeting?: string;
  track?: 'inbound_track' | 'outbound_track' | 'both_tracks';
}

export interface CallDetails {
  sid: string;
  from: string;
  to: string;
  status: string;
  direction: string;
  duration?: number;
}

/**
 * Media stream event types from Twilio
 */
export interface TwilioStreamEvent {
  event: string;
  sequenceNumber?: string;
  streamSid?: string;
  [key: string]: unknown;
}

export interface TwilioConnectedEvent extends TwilioStreamEvent {
  event: 'connected';
  protocol: string;
  version: string;
}

export interface TwilioStartEvent extends TwilioStreamEvent {
  event: 'start';
  start: {
    streamSid: string;
    accountSid: string;
    callSid: string;
    tracks: string[];
    customParameters: Record<string, string>;
    mediaFormat: {
      encoding: string;
      sampleRate: number;
      channels: number;
    };
  };
}

export interface TwilioMediaEvent extends TwilioStreamEvent {
  event: 'media';
  streamSid: string; // Required for media events
  media: {
    track: string;
    chunk: string;
    timestamp: string;
    payload: string; // base64 encoded audio
  };
}

export interface TwilioStopEvent extends TwilioStreamEvent {
  event: 'stop';
  stop: {
    accountSid: string;
    callSid: string;
  };
}

export interface TwilioMarkEvent extends TwilioStreamEvent {
  event: 'mark';
  mark: {
    name: string;
  };
}

export type TwilioMediaStreamMessage =
  | TwilioConnectedEvent
  | TwilioStartEvent
  | TwilioMediaEvent
  | TwilioStopEvent
  | TwilioMarkEvent;

// Type aliases for alternative naming conventions
export type TwilioStreamStartEvent = TwilioStartEvent;
export type TwilioStreamMediaEvent = TwilioMediaEvent;

/**
 * Outgoing media message to send audio to Twilio
 */
export interface TwilioStreamOutgoingMedia {
  event: 'media';
  streamSid: string;
  media: {
    payload: string; // base64 encoded audio
  };
}

/**
 * Clear message to flush the audio buffer
 */
export interface TwilioStreamClear {
  event: 'clear';
  streamSid: string;
}

class TwilioClient {
  private client: twilio.Twilio;
  private config: TwilioConfig;

  constructor(config: TwilioConfig) {
    this.config = config;
    this.client = twilio(config.accountSid, config.authToken);
  }

  /**
   * Get the auth token for signature validation
   */
  getAuthToken(): string {
    return this.config.authToken;
  }

  /**
   * Generate TwiML for streaming audio via WebSocket
   */
  generateStreamTwiML(config: TwiMLStreamConfig): string {
    const VoiceResponse = twilio.twiml.VoiceResponse;
    const response = new VoiceResponse();

    // Optional greeting before connecting to stream
    if (config.greeting) {
      response.say(
        {
          voice: 'Polly.Matthew', // Male voice for Earl
          language: 'en-US'
        },
        config.greeting
      );
    }

    // Connect to WebSocket for bidirectional audio
    const connect = response.connect();
    connect.stream({
      url: config.websocketUrl,
      track: config.track || 'both_tracks'
    });

    return response.toString();
  }

  /**
   * Generate simple TwiML response with speech
   */
  generateSayTwiML(message: string): string {
    const VoiceResponse = twilio.twiml.VoiceResponse;
    const response = new VoiceResponse();

    response.say(
      {
        voice: 'Polly.Matthew',
        language: 'en-US'
      },
      message
    );

    return response.toString();
  }

  /**
   * Generate TwiML to hang up the call
   */
  generateHangupTwiML(): string {
    const VoiceResponse = twilio.twiml.VoiceResponse;
    const response = new VoiceResponse();
    response.hangup();
    return response.toString();
  }

  /**
   * Generate TwiML to reject the call
   */
  generateRejectTwiML(reason: 'busy' | 'rejected' = 'rejected'): string {
    const VoiceResponse = twilio.twiml.VoiceResponse;
    const response = new VoiceResponse();
    response.reject({ reason });
    return response.toString();
  }

  /**
   * Validate Twilio webhook signature
   */
  validateSignature(
    signature: string,
    url: string,
    params: Record<string, string>
  ): boolean {
    return twilio.validateRequest(
      this.config.authToken,
      signature,
      url,
      params
    );
  }

  /**
   * Validate Twilio webhook signature from request headers
   */
  validateRequestSignature(
    signature: string | null,
    url: string,
    body: string | Record<string, string>
  ): boolean {
    if (!signature) return false;

    const params = typeof body === 'string' ? {} : body;
    return this.validateSignature(signature, url, params);
  }

  /**
   * Get call details from Twilio
   */
  async getCallDetails(callSid: string): Promise<CallDetails> {
    const call = await this.client.calls(callSid).fetch();

    return {
      sid: call.sid,
      from: call.from,
      to: call.to,
      status: call.status,
      direction: call.direction,
      duration: call.duration ? parseInt(call.duration) : undefined
    };
  }

  /**
   * Get recording details
   */
  async getRecording(recordingSid: string) {
    return await this.client.recordings(recordingSid).fetch();
  }

  /**
   * Fetch recording audio data from URL
   */
  async fetchRecordingAudio(recordingUrl: string): Promise<Buffer | null> {
    try {
      // Twilio recording URLs need auth token appended
      const authUrl = `${recordingUrl}.mp3`;
      const response = await fetch(authUrl, {
        headers: {
          'Authorization': `Basic ${Buffer.from(`${this.config.accountSid}:${this.config.authToken}`).toString('base64')}`,
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
   */
  static formatPhoneNumber(phone: string): string {
    // Remove all non-digit characters
    const digits = phone.replace(/\D/g, '');

    // If it's a US number without country code, add +1
    if (digits.length === 10) {
      return `+1${digits}`;
    }

    // If it already has country code, just add +
    if (digits.length === 11 && digits.startsWith('1')) {
      return `+${digits}`;
    }

    // For other formats, assume it's already formatted
    return phone.startsWith('+') ? phone : `+${digits}`;
  }

  /**
   * Parse a Twilio media stream message
   */
  static parseStreamMessage(data: string): TwilioMediaStreamMessage | null {
    try {
      return JSON.parse(data) as TwilioMediaStreamMessage;
    } catch (error) {
      console.error('[Twilio] Failed to parse stream message:', error);
      return null;
    }
  }

  /**
   * Create a media message to send audio back to Twilio
   */
  static createMediaMessage(streamSid: string, payload: string): string {
    return JSON.stringify({
      event: 'media',
      streamSid,
      media: {
        payload // base64 encoded μ-law audio
      }
    });
  }

  /**
   * Create a mark message for synchronization
   */
  static createMarkMessage(streamSid: string, markName: string): string {
    return JSON.stringify({
      event: 'mark',
      streamSid,
      mark: {
        name: markName
      }
    });
  }

  /**
   * Create a clear message to flush the audio buffer
   */
  static createClearMessage(streamSid: string): string {
    return JSON.stringify({
      event: 'clear',
      streamSid
    });
  }

  /**
   * Get the underlying Twilio client for advanced operations
   */
  get twilioClient(): twilio.Twilio {
    return this.client;
  }
}

/**
 * Create a configured Twilio client instance
 */
export function createTwilioClient(config?: Partial<TwilioConfig>): TwilioClient {
  const accountSid = config?.accountSid || process.env.TWILIO_ACCOUNT_SID;
  const authToken = config?.authToken || process.env.TWILIO_AUTH_TOKEN;
  const phoneNumber = config?.phoneNumber || process.env.TWILIO_PHONE_NUMBER;

  if (!accountSid || !authToken) {
    throw new Error(
      'Twilio credentials required. Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN environment variables.'
    );
  }

  return new TwilioClient({
    accountSid,
    authToken,
    phoneNumber
  });
}

/**
 * Twilio call status values
 */
export type TwilioCallStatus =
  | 'queued'
  | 'initiated'
  | 'ringing'
  | 'in-progress'
  | 'completed'
  | 'busy'
  | 'failed'
  | 'no-answer'
  | 'canceled';

/**
 * Validate Twilio webhook signature (standalone function)
 */
export function validateTwilioSignature(
  authToken: string,
  signature: string,
  url: string,
  params: Record<string, string>
): boolean {
  return twilio.validateRequest(authToken, signature, url, params);
}

/**
 * Get the base URL for webhooks from environment
 */
export function getWebhookBaseUrl(): string {
  return process.env.WEBHOOK_BASE_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000';
}

/**
 * Get the Twilio auth token from environment
 */
export function getTwilioAuthToken(): string {
  return process.env.TWILIO_AUTH_TOKEN || '';
}

/**
 * Interface for Twilio recording webhook payload
 */
export interface TwilioRecordingPayload {
  AccountSid: string;
  CallSid: string;
  RecordingSid: string;
  RecordingUrl: string;
  RecordingStatus: 'in-progress' | 'completed' | 'failed' | 'absent';
  RecordingDuration?: string;
  RecordingChannels?: string;
  RecordingSource?: string;
  RecordingStartTime?: string;
  ErrorCode?: string;
}

/**
 * Interface for Twilio incoming call webhook parameters
 */
export interface TwilioIncomingCallParams {
  CallSid: string;
  AccountSid: string;
  From: string;
  To: string;
  CallStatus: string;
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
 * Validate a Twilio webhook request
 */
export function validateRequest(
  signature: string | null,
  url: string,
  params: Record<string, string>
): boolean {
  if (!signature) return false;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken) return false;
  return twilio.validateRequest(authToken, signature, url, params);
}

/**
 * Create TwiML for streaming audio via WebSocket
 */
export function createStreamingTwiml(websocketUrl: string, greeting?: string): string {
  const VoiceResponse = twilio.twiml.VoiceResponse;
  const response = new VoiceResponse();

  if (greeting) {
    response.say(
      {
        voice: 'Polly.Matthew',
        language: 'en-US'
      },
      greeting
    );
  }

  const connect = response.connect();
  connect.stream({
    url: websocketUrl,
    track: 'both_tracks'
  });

  return response.toString();
}

/**
 * Create error TwiML response
 */
export function createErrorTwiml(message: string = "I'm sorry, something went wrong. Please try calling back later."): string {
  const VoiceResponse = twilio.twiml.VoiceResponse;
  const response = new VoiceResponse();
  response.say(
    {
      voice: 'Polly.Matthew',
      language: 'en-US'
    },
    message
  );
  response.hangup();
  return response.toString();
}

export { TwilioClient };
export default TwilioClient;
