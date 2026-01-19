/**
 * ScamScrammer - TypeScript Type Definitions
 *
 * This module contains all TypeScript interfaces and types for the application.
 */

// =============================================================================
// Twilio Webhook Payloads
// =============================================================================

/**
 * Payload received from Twilio for incoming calls
 * @see https://www.twilio.com/docs/voice/twiml#request-parameters
 */
export interface TwilioWebhookPayload {
  /** Unique identifier for this call */
  CallSid: string;
  /** Twilio Account SID */
  AccountSid: string;
  /** The phone number of the caller (E.164 format) */
  From: string;
  /** The Twilio phone number that received the call (E.164 format) */
  To: string;
  /** Current status of the call */
  CallStatus: TwilioCallStatus;
  /** Direction of the call */
  Direction: "inbound" | "outbound-api" | "outbound-dial";
  /** Twilio API version */
  ApiVersion: string;
  /** Caller's city (if available) */
  CallerCity?: string;
  /** Caller's state/region (if available) */
  CallerState?: string;
  /** Caller's ZIP/postal code (if available) */
  CallerZip?: string;
  /** Caller's country (if available) */
  CallerCountry?: string;
  /** Caller's name from CNAM lookup (if available) */
  CallerName?: string;
  /** Called city (if available) */
  CalledCity?: string;
  /** Called state/region (if available) */
  CalledState?: string;
  /** Called ZIP/postal code (if available) */
  CalledZip?: string;
  /** Called country (if available) */
  CalledCountry?: string;
  /** Forwarded from number (if call was forwarded) */
  ForwardedFrom?: string;
}

/**
 * Payload received from Twilio for call status updates
 * @see https://www.twilio.com/docs/voice/twiml#status-callbacks
 */
export interface TwilioStatusPayload {
  /** Unique identifier for this call */
  CallSid: string;
  /** Twilio Account SID */
  AccountSid: string;
  /** The phone number of the caller */
  From: string;
  /** The Twilio phone number */
  To: string;
  /** Current status of the call */
  CallStatus: TwilioCallStatus;
  /** Direction of the call */
  Direction: string;
  /** Duration of the call in seconds (when completed) */
  CallDuration?: string;
  /** Timestamp when the call started */
  Timestamp?: string;
  /** Sequence number for ordering status updates */
  SequenceNumber?: string;
}

/**
 * Payload received from Twilio when a recording is complete
 * @see https://www.twilio.com/docs/voice/twiml/record#recording-status-callback
 */
export interface TwilioRecordingPayload {
  /** Twilio Account SID */
  AccountSid: string;
  /** Call SID this recording belongs to */
  CallSid: string;
  /** Unique identifier for this recording */
  RecordingSid: string;
  /** URL to access the recording */
  RecordingUrl: string;
  /** Status of the recording */
  RecordingStatus: "in-progress" | "completed" | "absent" | "failed";
  /** Duration of the recording in seconds */
  RecordingDuration: string;
  /** Number of channels in the recording */
  RecordingChannels?: string;
  /** Source of the recording */
  RecordingSource?: string;
  /** Error code if recording failed */
  ErrorCode?: string;
}

/**
 * Twilio Media Stream payload for WebSocket communication
 * @see https://www.twilio.com/docs/voice/twiml/stream#message-media
 */
export interface TwilioMediaStreamPayload {
  /** Event type */
  event: "connected" | "start" | "media" | "stop" | "mark";
  /** Stream SID */
  streamSid?: string;
  /** Sequence number */
  sequenceNumber?: string;
  /** Start event data */
  start?: {
    /** Stream SID */
    streamSid: string;
    /** Account SID */
    accountSid: string;
    /** Call SID */
    callSid: string;
    /** Tracks being streamed */
    tracks: string[];
    /** Custom parameters */
    customParameters?: Record<string, string>;
    /** Media format information */
    mediaFormat: {
      encoding: "audio/x-mulaw";
      sampleRate: 8000;
      channels: 1;
    };
  };
  /** Media event data */
  media?: {
    /** Track identifier */
    track: "inbound" | "outbound";
    /** Chunk number */
    chunk: string;
    /** Timestamp in milliseconds */
    timestamp: string;
    /** Base64 encoded audio payload */
    payload: string;
  };
  /** Stop event data */
  stop?: {
    /** Account SID */
    accountSid: string;
    /** Call SID */
    callSid: string;
  };
  /** Mark event data */
  mark?: {
    /** Mark name */
    name: string;
  };
}

/**
 * Possible Twilio call statuses
 */
export type TwilioCallStatus =
  | "queued"
  | "ringing"
  | "in-progress"
  | "completed"
  | "busy"
  | "failed"
  | "no-answer"
  | "canceled";

// =============================================================================
// Database/API Response Types
// =============================================================================

/**
 * Call status enum matching Prisma schema
 */
export enum CallStatus {
  RINGING = "RINGING",
  IN_PROGRESS = "IN_PROGRESS",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
  NO_ANSWER = "NO_ANSWER",
}

/**
 * Speaker enum matching Prisma schema
 */
export enum Speaker {
  SCAMMER = "SCAMMER",
  EARL = "EARL",
}

/**
 * API response shape for a single call
 */
export interface CallResponse {
  /** Unique call identifier */
  id: string;
  /** Twilio call SID */
  twilioSid: string;
  /** Caller's phone number */
  fromNumber: string;
  /** Our Twilio phone number */
  toNumber: string;
  /** Call status */
  status: CallStatus;
  /** Duration in seconds */
  duration: number | null;
  /** S3 URL for the recording */
  recordingUrl: string | null;
  /** S3 URL for the transcript */
  transcriptUrl: string | null;
  /** Entertainment rating (1-5) */
  rating: number | null;
  /** User notes */
  notes: string | null;
  /** When the call was received */
  createdAt: Date;
  /** Last update timestamp */
  updatedAt: Date;
  /** Conversation segments (optional) */
  segments?: CallSegmentResponse[];
}

/**
 * API response shape for a call segment
 */
export interface CallSegmentResponse {
  /** Unique segment identifier */
  id: string;
  /** Parent call ID */
  callId: string;
  /** Who spoke this segment */
  speaker: Speaker;
  /** Transcribed text */
  text: string;
  /** Seconds into the call */
  timestamp: number;
  /** When this segment was created */
  createdAt: Date;
}

/**
 * API response for paginated call list
 */
export interface CallListResponse {
  /** Array of calls */
  calls: CallResponse[];
  /** Total number of calls */
  total: number;
  /** Current page */
  page: number;
  /** Items per page */
  limit: number;
  /** Total number of pages */
  totalPages: number;
}

// =============================================================================
// OpenAI Realtime API Types
// =============================================================================

/**
 * Configuration for OpenAI Realtime API session
 */
export interface OpenAIRealtimeConfig {
  /** Model to use */
  model: "gpt-4o-realtime-preview-2024-12-17";
  /** Voice to use */
  voice: "alloy" | "ash" | "ballad" | "coral" | "echo" | "sage" | "shimmer" | "verse";
  /** System prompt for the AI persona */
  systemPrompt: string;
  /** Input audio format */
  inputAudioFormat: "pcm16" | "g711_ulaw" | "g711_alaw";
  /** Output audio format */
  outputAudioFormat: "pcm16" | "g711_ulaw" | "g711_alaw";
  /** Turn detection configuration */
  turnDetection?: {
    type: "server_vad";
    threshold?: number;
    prefix_padding_ms?: number;
    silence_duration_ms?: number;
  };
  /** Input audio transcription configuration */
  inputAudioTranscription?: {
    model: "whisper-1";
  };
  /** Temperature for response generation */
  temperature?: number;
  /** Maximum response tokens */
  maxResponseOutputTokens?: number | "inf";
}

/**
 * OpenAI Realtime session state
 */
export interface OpenAIRealtimeSession {
  /** Session ID */
  id: string;
  /** Object type */
  object: "realtime.session";
  /** Model being used */
  model: string;
  /** Voice being used */
  voice: string;
  /** Session modalities */
  modalities: string[];
  /** Input audio format */
  input_audio_format: string;
  /** Output audio format */
  output_audio_format: string;
  /** Turn detection config */
  turn_detection: Record<string, unknown> | null;
}

// =============================================================================
// Earl Persona Types
// =============================================================================

/**
 * Configuration for Earl AI persona
 */
export interface EarlPersonaConfig {
  /** Character name */
  name: string;
  /** Character age */
  age: number;
  /** Background story */
  background: string;
  /** Hometown */
  hometown: string;
  /** Occupation history */
  occupation: string;
  /** Array of tangent topics */
  tangentTopics: TangentTopic[];
  /** Array of signature phrases */
  signaturePhrases: string[];
  /** Mapping of words Earl mishears */
  mishearings: Record<string, string>;
  /** Response timing configuration */
  responseTiming: ResponseTimingConfig;
}

/**
 * A topic Earl might go on a tangent about
 */
export interface TangentTopic {
  /** Topic name */
  name: string;
  /** Description or story about the topic */
  description: string;
  /** Trigger words that might lead to this tangent */
  triggers?: string[];
}

/**
 * Configuration for Earl's response timing
 */
export interface ResponseTimingConfig {
  /** Minimum pause duration in milliseconds */
  minPauseMs: number;
  /** Maximum pause duration in milliseconds */
  maxPauseMs: number;
  /** Probability of a long "thinking" pause (0-1) */
  longPauseProbability: number;
  /** Duration of a long pause in milliseconds */
  longPauseMs: number;
}

// =============================================================================
// Dashboard Statistics Types
// =============================================================================

/**
 * Dashboard statistics response
 */
export interface DashboardStats {
  /** Total number of calls */
  totalCalls: number;
  /** Total duration in seconds */
  totalDuration: number;
  /** Average call duration in seconds */
  averageDuration: number;
  /** Calls grouped by status */
  callsByStatus: Record<CallStatus, number>;
  /** Calls per day for charting (last 30 days) */
  callsByDay: DailyCallStats[];
  /** Top rated calls by entertainment value */
  topRatedCalls: CallResponse[];
  /** Longest duration calls */
  longestCalls: CallResponse[];
}

/**
 * Daily call statistics for charting
 */
export interface DailyCallStats {
  /** Date in YYYY-MM-DD format */
  date: string;
  /** Number of calls */
  count: number;
  /** Total duration for that day */
  totalDuration: number;
}

// =============================================================================
// TwiML Generation Types
// =============================================================================

/**
 * Options for generating TwiML responses
 */
export interface TwiMLOptions {
  /** Voice to use for text-to-speech */
  voice?: "alice" | "man" | "woman" | "Polly.Matthew" | "Polly.Joanna";
  /** Language for text-to-speech */
  language?: string;
  /** Enable call recording */
  record?: boolean;
  /** Status callback URL */
  statusCallback?: string;
  /** Status callback events */
  statusCallbackEvent?: string[];
}

// =============================================================================
// Storage Types
// =============================================================================

/**
 * Result from uploading a recording
 */
export interface UploadResult {
  /** S3 object key */
  key: string;
  /** Full S3 URL */
  url: string;
  /** Content type */
  contentType: string;
  /** Size in bytes */
  size: number;
}

/**
 * Pagination options for listing recordings
 */
export interface StoragePaginationOptions {
  /** Maximum items to return */
  limit?: number;
  /** Continuation token from previous request */
  continuationToken?: string;
  /** Prefix filter */
  prefix?: string;
}

/**
 * Result from listing recordings
 */
export interface StorageListResult {
  /** Array of recording keys */
  recordings: StorageRecordingInfo[];
  /** Token for next page (if more results exist) */
  nextContinuationToken?: string;
  /** Whether there are more results */
  isTruncated: boolean;
}

/**
 * Information about a stored recording
 */
export interface StorageRecordingInfo {
  /** S3 object key */
  key: string;
  /** File size in bytes */
  size: number;
  /** Last modified date */
  lastModified: Date;
}

// =============================================================================
// Error Types
// =============================================================================

/**
 * Custom error with code for better error handling
 */
export interface AppError extends Error {
  /** Error code for categorization */
  code: string;
  /** HTTP status code */
  statusCode?: number;
  /** Original error that caused this error */
  cause?: Error;
}

/**
 * API error response shape
 */
export interface ApiErrorResponse {
  /** Error message */
  error: string;
  /** Error code */
  code: string;
  /** Additional details */
  details?: Record<string, unknown>;
}
