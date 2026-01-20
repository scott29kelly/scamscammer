/**
 * TypeScript interfaces and types for ScamScrammer
 * Call tracking and Twilio webhook handling
 */

// =============================================================================
// Call Status Enums
// =============================================================================

/**
 * Internal call status enum - matches Prisma schema
 */
export enum CallStatus {
  RINGING = 'RINGING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  NO_ANSWER = 'NO_ANSWER',
}

/**
 * Speaker enum for call segments
 */
export enum Speaker {
  SCAMMER = 'SCAMMER',
  EARL = 'EARL',
}

/**
 * Twilio call status values received from webhooks
 */
export type TwilioCallStatus =
  | 'queued'
  | 'ringing'
  | 'in-progress'
  | 'completed'
  | 'busy'
  | 'failed'
  | 'no-answer'
  | 'canceled';

// =============================================================================
// Twilio Webhook Payloads
// =============================================================================

/**
 * Base payload fields common to all Twilio webhooks
 */
export interface TwilioBasePayload {
  CallSid: string;
  AccountSid: string;
  From: string;
  To: string;
  ApiVersion: string;
  Direction: 'inbound' | 'outbound-api' | 'outbound-dial';
}

/**
 * Incoming call webhook payload from Twilio
 */
export interface TwilioWebhookPayload extends TwilioBasePayload {
  Caller: string;
  Called: string;
  CallStatus: TwilioCallStatus;
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
 * Call status callback payload from Twilio
 */
export interface TwilioStatusPayload extends TwilioBasePayload {
  CallStatus: TwilioCallStatus;
  CallDuration?: string; // Duration in seconds (only on completed)
  Timestamp?: string;
  SequenceNumber?: string;
  CallbackSource?: string;
  ParentCallSid?: string;
  QueueTime?: string;
  AnsweredBy?: 'human' | 'machine_start' | 'machine_end_beep' | 'machine_end_silence' | 'machine_end_other' | 'fax' | 'unknown';
  SipResponseCode?: string;
  ErrorCode?: string;
  ErrorMessage?: string;
}

/**
 * Recording status callback payload from Twilio
 */
export interface TwilioRecordingPayload extends TwilioBasePayload {
  RecordingSid: string;
  RecordingUrl: string;
  RecordingStatus: 'completed' | 'failed' | 'absent';
  RecordingDuration: string;
  RecordingChannels: string;
  RecordingSource: 'RecordVerb' | 'DialVerb' | 'Conference' | 'OutboundAPI' | 'Trunking';
  RecordingStartTime?: string;
  RecordingErrorCode?: string;
  RecordingEncryptionDetails?: string;
}

// =============================================================================
// API Response Types
// =============================================================================

/**
 * Call segment response for API
 */
export interface CallSegmentResponse {
  id: string;
  callId: string;
  speaker: Speaker;
  text: string;
  timestamp: number;
  createdAt: string;
}

/**
 * Call response for API
 */
export interface CallResponse {
  id: string;
  twilioSid: string;
  fromNumber: string;
  toNumber: string;
  status: CallStatus;
  duration: number | null;
  recordingUrl: string | null;
  transcriptUrl: string | null;
  rating: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  segments?: CallSegmentResponse[];
}

/**
 * Paginated list response
 */
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Dashboard statistics
 */
export interface DashboardStats {
  totalCalls: number;
  totalDuration: number;
  averageDuration: number;
  callsByStatus: Record<CallStatus, number>;
  callsByDay: Array<{
    date: string;
    count: number;
    duration: number;
  }>;
  topRatedCalls: CallResponse[];
  longestCalls: CallResponse[];
}

// =============================================================================
// Configuration Types
// =============================================================================

/**
 * OpenAI Realtime API configuration
 */
export interface OpenAIRealtimeConfig {
  apiKey: string;
  model?: string;
  voice?: string;
  turnDetection?: {
    type: 'server_vad';
    threshold?: number;
    silenceDurationMs?: number;
    prefixPaddingMs?: number;
  };
}

/**
 * Earl persona configuration
 */
export interface EarlPersonaConfig {
  name: string;
  age: number;
  background: string;
  tangentTopics: string[];
  signaturePhrases: string[];
  mishearings: Record<string, string>;
  responseDelayMs: {
    min: number;
    max: number;
  };
}

// =============================================================================
// Utility Types
// =============================================================================

/**
 * Mapping from Twilio call status to internal status
 */
export const TWILIO_STATUS_MAP: Record<TwilioCallStatus, CallStatus> = {
  'queued': CallStatus.RINGING,
  'ringing': CallStatus.RINGING,
  'in-progress': CallStatus.IN_PROGRESS,
  'completed': CallStatus.COMPLETED,
  'busy': CallStatus.FAILED,
  'failed': CallStatus.FAILED,
  'no-answer': CallStatus.NO_ANSWER,
  'canceled': CallStatus.FAILED,
};

/**
 * Get internal CallStatus from Twilio status string
 */
export function mapTwilioStatusToCallStatus(twilioStatus: TwilioCallStatus): CallStatus {
  return TWILIO_STATUS_MAP[twilioStatus] ?? CallStatus.FAILED;
}
