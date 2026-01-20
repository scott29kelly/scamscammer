/**
 * Twilio Client Wrapper
 *
 * Handles Twilio API interactions including TwiML generation,
 * signature validation, and media stream configuration.
 */

import twilio from 'twilio';
import crypto from 'crypto';

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

class TwilioClient {
  private client: twilio.Twilio;
  private config: TwilioConfig;

  constructor(config: TwilioConfig) {
    this.config = config;
    this.client = twilio(config.accountSid, config.authToken);
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

export { TwilioClient };
export default TwilioClient;
