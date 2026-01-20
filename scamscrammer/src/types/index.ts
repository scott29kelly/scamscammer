/**
 * ScamScrammer TypeScript Type Definitions
 *
 * This file contains all shared TypeScript interfaces and types
 * for the application. Types will be added by subsequent tasks.
 */

// Re-export Prisma types for convenience
export type { Call, CallSegment } from '@prisma/client';
export { CallStatus, Speaker } from '@prisma/client';

/**
 * API Error Response
 */
export interface ApiErrorResponse {
  error: string;
  code?: string;
  details?: Record<string, string>;
}

/**
 * Pagination metadata
 */
export interface PaginationInfo {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

/**
 * Call list item (without full segments)
 */
export interface CallListItem {
  id: string;
  twilioSid: string;
  fromNumber: string;
  toNumber: string;
  status: string;
  duration: number | null;
  recordingUrl: string | null;
  transcriptUrl: string | null;
  rating: number | null;
  notes: string | null;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
  _count: {
    segments: number;
  };
}

/**
 * Call list response with pagination
 */
export interface CallListResponse {
  calls: CallListItem[];
  pagination: PaginationInfo;
}

/**
 * Call response with segments
 */
export interface CallResponse {
  id: string;
  twilioSid: string;
  fromNumber: string;
  toNumber: string;
  status: string;
  duration: number | null;
  recordingUrl: string | null;
  transcriptUrl: string | null;
  rating: number | null;
  notes: string | null;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
  segments: Array<{
    id: string;
    callId: string;
    speaker: string;
    text: string;
    timestamp: number;
    createdAt: Date;
  }>;
}

/**
 * Dashboard statistics response
 */
export interface DashboardStats {
  totalCalls: number;
  totalDuration: number;
  averageDuration: number;
  callsByStatus: Record<string, number>;
  callsByDay: Array<{
    date: string;
    count: number;
  }>;
  topRatedCalls: CallListItem[];
  longestCalls: CallListItem[];
}

/**
 * Twilio incoming call webhook payload
 */
export interface TwilioWebhookPayload {
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
 * Twilio call status update webhook payload
 */
export interface TwilioStatusPayload {
  CallSid: string;
  AccountSid: string;
  From: string;
  To: string;
  CallStatus: 'queued' | 'ringing' | 'in-progress' | 'completed' | 'busy' | 'failed' | 'no-answer' | 'canceled';
  CallDuration?: string;
  Direction: string;
  Timestamp?: string;
  SequenceNumber?: string;
}

/**
 * Twilio recording complete webhook payload
 */
export interface TwilioRecordingPayload {
  AccountSid: string;
  CallSid: string;
  RecordingSid: string;
  RecordingUrl: string;
  RecordingStatus: 'completed' | 'failed';
  RecordingDuration: string;
  RecordingChannels: string;
  RecordingSource: string;
  RecordingStartTime?: string;
}

/**
 * OpenAI Realtime API session configuration
 */
export interface OpenAIRealtimeConfig {
  /** The model to use for realtime voice */
  model: string;
  /** Voice to use for audio output */
  voice: 'alloy' | 'echo' | 'shimmer' | 'ash' | 'ballad' | 'coral' | 'sage' | 'verse';
  /** Instructions/system prompt for the session */
  instructions: string;
  /** Input audio format */
  inputAudioFormat: 'pcm16' | 'g711_ulaw' | 'g711_alaw';
  /** Output audio format */
  outputAudioFormat: 'pcm16' | 'g711_ulaw' | 'g711_alaw';
  /** Whether to enable input audio transcription */
  inputAudioTranscription?: {
    model: string;
  };
  /** Turn detection configuration */
  turnDetection?: {
    type: 'server_vad';
    threshold?: number;
    prefixPaddingMs?: number;
    silenceDurationMs?: number;
  };
  /** Tools available to the model */
  tools?: Array<{
    type: 'function';
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  }>;
  /** Temperature for response generation */
  temperature?: number;
  /** Maximum tokens for responses */
  maxResponseOutputTokens?: number | 'inf';
}

/**
 * Earl persona configuration interface
 * Re-exported from persona module for convenience
 */
export interface EarlPersonaConfig {
  /** Unique identifier for the persona */
  id: string;
  /** Display name */
  name: string;
  /** Character's age */
  age: number;
  /** Background story and context */
  background: string;
  /** Personality traits */
  personality: string[];
  /** Topics the character loves to ramble about */
  tangentTopics: Array<{
    name: string;
    description: string;
    triggers?: string[];
  }>;
  /** Signature phrases the character uses */
  signaturePhrases: string[];
  /** Words/phrases the character commonly mishears */
  mishearings: Array<{
    original: string;
    misheard: string;
    category?: string;
  }>;
  /** Response timing configuration */
  timing: {
    minResponseDelay: number;
    maxResponseDelay: number;
    pauseProbability: number;
    pauseDuration: number;
    repeatRequestProbability: number;
  };
  /** The full system prompt for the AI */
  systemPrompt: string;
}
