/**
 * ScamScrammer TypeScript Interfaces and Types
 *
 * This file contains all TypeScript interfaces for the application including:
 * - Twilio webhook payloads
 * - API response shapes
 * - OpenAI configuration
 * - Earl persona configuration
 * - Dashboard statistics
 */

// =============================================================================
// Enums
// =============================================================================

/**
 * Status of a phone call throughout its lifecycle
 */
export enum CallStatus {
  RINGING = 'RINGING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  NO_ANSWER = 'NO_ANSWER',
}

/**
 * Speaker in a conversation segment
 */
export enum Speaker {
  SCAMMER = 'SCAMMER',
  EARL = 'EARL',
}

// =============================================================================
// Twilio Webhook Payloads
// =============================================================================

/**
 * Payload received from Twilio when an incoming call arrives
 * @see https://www.twilio.com/docs/voice/twiml#request-parameters
 */
export interface TwilioWebhookPayload {
  /** Unique identifier for the call */
  CallSid: string;
  /** Account SID that owns this call */
  AccountSid: string;
  /** Phone number of the caller (E.164 format) */
  From: string;
  /** Phone number being called (E.164 format) */
  To: string;
  /** Status of the call (e.g., 'ringing', 'in-progress') */
  CallStatus: string;
  /** API version used */
  ApiVersion: string;
  /** Direction of the call ('inbound' or 'outbound-*') */
  Direction: string;
  /** Forwarded from number, if applicable */
  ForwardedFrom?: string;
  /** Caller name if available */
  CallerName?: string;
  /** Parent call SID if this is a child call */
  ParentCallSid?: string;
  /** City of the caller, if available */
  FromCity?: string;
  /** State/province of the caller, if available */
  FromState?: string;
  /** Postal code of the caller, if available */
  FromZip?: string;
  /** Country of the caller, if available */
  FromCountry?: string;
  /** City of the called number */
  ToCity?: string;
  /** State/province of the called number */
  ToState?: string;
  /** Postal code of the called number */
  ToZip?: string;
  /** Country of the called number */
  ToCountry?: string;
  /** SIP call ID if using SIP */
  SipCallId?: string;
  /** Twilio request signature for validation */
  'X-Twilio-Signature'?: string;
}

/**
 * Payload received from Twilio for call status updates
 * @see https://www.twilio.com/docs/voice/api/call-resource#statuscallback
 */
export interface TwilioStatusPayload {
  /** Unique identifier for the call */
  CallSid: string;
  /** Account SID that owns this call */
  AccountSid: string;
  /** Phone number of the caller */
  From: string;
  /** Phone number being called */
  To: string;
  /** Current status of the call */
  CallStatus: TwilioCallStatus;
  /** API version used */
  ApiVersion: string;
  /** Direction of the call */
  Direction: string;
  /** Duration of the call in seconds (when completed) */
  CallDuration?: string;
  /** Timestamp when the call was created */
  Timestamp?: string;
  /** Sequence number of this status callback */
  SequenceNumber?: string;
  /** SID of the parent call if applicable */
  ParentCallSid?: string;
  /** Queue time in seconds if call was queued */
  QueueTime?: string;
  /** Indicates if call was answered by machine */
  AnsweredBy?: 'human' | 'machine_start' | 'machine_end_beep' | 'machine_end_silence' | 'machine_end_other' | 'fax' | 'unknown';
  /** Machine detection duration if enabled */
  MachineDetectionDuration?: string;
}

/**
 * Twilio call status values
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

/**
 * Payload received from Twilio when a recording is ready
 * @see https://www.twilio.com/docs/voice/api/recording#recordingstatuscallback
 */
export interface TwilioRecordingPayload {
  /** Account SID that owns this recording */
  AccountSid: string;
  /** Unique identifier for the call that was recorded */
  CallSid: string;
  /** Unique identifier for the recording */
  RecordingSid: string;
  /** URL where the recording can be accessed */
  RecordingUrl: string;
  /** Status of the recording */
  RecordingStatus: TwilioRecordingStatus;
  /** Duration of the recording in seconds */
  RecordingDuration: string;
  /** Number of channels in the recording */
  RecordingChannels: string;
  /** Audio source (e.g., 'DialVerb', 'RecordVerb') */
  RecordingSource: string;
  /** Timestamp when recording started */
  RecordingStartTime?: string;
  /** Error code if recording failed */
  ErrorCode?: string;
}

/**
 * Twilio recording status values
 */
export type TwilioRecordingStatus =
  | 'in-progress'
  | 'completed'
  | 'absent'
  | 'failed';

/**
 * Twilio Media Stream payload for WebSocket communication
 */
export interface TwilioMediaStreamPayload {
  /** Event type */
  event: 'connected' | 'start' | 'media' | 'stop' | 'mark';
  /** Sequence number */
  sequenceNumber?: string;
  /** Stream SID */
  streamSid?: string;
  /** Start event data */
  start?: {
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
  /** Media event data (audio chunks) */
  media?: {
    track: 'inbound' | 'outbound';
    chunk: string;
    timestamp: string;
    payload: string;
  };
  /** Stop event data */
  stop?: {
    accountSid: string;
    callSid: string;
  };
  /** Mark event data */
  mark?: {
    name: string;
  };
}

// =============================================================================
// API Response Shapes
// =============================================================================

/**
 * API response for a single call
 */
export interface CallResponse {
  /** Unique identifier */
  id: string;
  /** Twilio call SID */
  twilioSid: string;
  /** Caller's phone number */
  fromNumber: string;
  /** Called phone number */
  toNumber: string;
  /** Current status of the call */
  status: CallStatus;
  /** Duration in seconds */
  duration: number | null;
  /** URL to the recording */
  recordingUrl: string | null;
  /** URL to the transcript */
  transcriptUrl: string | null;
  /** Entertainment value rating (1-5) */
  rating: number | null;
  /** User notes about the call */
  notes: string | null;
  /** Timestamp when the call was created */
  createdAt: string;
  /** Timestamp when the call was last updated */
  updatedAt: string;
  /** Conversation segments */
  segments?: CallSegmentResponse[];
}

/**
 * API response for a call segment (part of conversation)
 */
export interface CallSegmentResponse {
  /** Unique identifier */
  id: string;
  /** Associated call ID */
  callId: string;
  /** Who spoke this segment */
  speaker: Speaker;
  /** Transcribed text */
  text: string;
  /** Timestamp in seconds from call start */
  timestamp: number;
  /** Timestamp when the segment was created */
  createdAt: string;
}

/**
 * Paginated list response for calls
 */
export interface CallListResponse {
  /** Array of calls */
  calls: CallResponse[];
  /** Pagination metadata */
  pagination: PaginationMeta;
}

/**
 * Pagination metadata
 */
export interface PaginationMeta {
  /** Current page number (1-indexed) */
  page: number;
  /** Number of items per page */
  limit: number;
  /** Total number of items */
  total: number;
  /** Total number of pages */
  totalPages: number;
  /** Whether there's a next page */
  hasNext: boolean;
  /** Whether there's a previous page */
  hasPrev: boolean;
}

/**
 * Query parameters for listing calls
 */
export interface CallListQuery {
  /** Page number (1-indexed) */
  page?: number;
  /** Items per page */
  limit?: number;
  /** Filter by status */
  status?: CallStatus;
  /** Filter calls after this date */
  startDate?: string;
  /** Filter calls before this date */
  endDate?: string;
  /** Sort field */
  sortBy?: 'createdAt' | 'duration' | 'rating';
  /** Sort direction */
  sortOrder?: 'asc' | 'desc';
}

/**
 * Request body for updating a call
 */
export interface CallUpdateRequest {
  /** Entertainment value rating (1-5) */
  rating?: number;
  /** User notes */
  notes?: string;
  /** Tags for categorization */
  tags?: string[];
}

/**
 * Generic API error response
 */
export interface ApiErrorResponse {
  /** Error message */
  error: string;
  /** Error code for programmatic handling */
  code?: string;
  /** Additional error details */
  details?: Record<string, unknown>;
}

/**
 * Generic API success response
 */
export interface ApiSuccessResponse<T> {
  /** Response data */
  data: T;
  /** Optional message */
  message?: string;
}

// =============================================================================
// OpenAI Realtime Configuration
// =============================================================================

/**
 * Configuration for OpenAI Realtime API session
 */
export interface OpenAIRealtimeConfig {
  /** Model to use for conversation */
  model: 'gpt-4o-realtime-preview' | 'gpt-4o-realtime-preview-2024-10-01';
  /** Voice to use for responses */
  voice: 'alloy' | 'echo' | 'shimmer' | 'ash' | 'ballad' | 'coral' | 'sage' | 'verse';
  /** System instructions/prompt */
  instructions: string;
  /** Input audio format */
  inputAudioFormat: AudioFormat;
  /** Output audio format */
  outputAudioFormat: AudioFormat;
  /** Input audio transcription configuration */
  inputAudioTranscription?: {
    /** Model for transcription */
    model: 'whisper-1';
  };
  /** Turn detection configuration */
  turnDetection?: TurnDetectionConfig;
  /** Temperature for response generation (0-2) */
  temperature?: number;
  /** Maximum response tokens */
  maxResponseOutputTokens?: number | 'inf';
  /** Tools available to the model */
  tools?: OpenAIRealtimeTool[];
  /** How the model should use tools */
  toolChoice?: 'auto' | 'none' | 'required' | { type: 'function'; name: string };
}

/**
 * Audio format configuration
 */
export type AudioFormat = 'pcm16' | 'g711_ulaw' | 'g711_alaw';

/**
 * Turn detection configuration for voice activity detection
 */
export interface TurnDetectionConfig {
  /** Type of turn detection */
  type: 'server_vad';
  /** Activation threshold (0-1) */
  threshold?: number;
  /** Prefix padding in milliseconds */
  prefixPaddingMs?: number;
  /** Silence duration to trigger end of turn in milliseconds */
  silenceDurationMs?: number;
}

/**
 * Tool definition for OpenAI Realtime
 */
export interface OpenAIRealtimeTool {
  /** Type of tool */
  type: 'function';
  /** Function definition */
  function: {
    /** Function name */
    name: string;
    /** Function description */
    description: string;
    /** JSON Schema for parameters */
    parameters: Record<string, unknown>;
  };
}

/**
 * OpenAI Realtime session event types
 */
export type OpenAIRealtimeEventType =
  | 'session.created'
  | 'session.updated'
  | 'input_audio_buffer.append'
  | 'input_audio_buffer.commit'
  | 'input_audio_buffer.clear'
  | 'input_audio_buffer.speech_started'
  | 'input_audio_buffer.speech_stopped'
  | 'input_audio_buffer.committed'
  | 'input_audio_buffer.cleared'
  | 'conversation.item.create'
  | 'conversation.item.created'
  | 'conversation.item.truncate'
  | 'conversation.item.deleted'
  | 'conversation.item.input_audio_transcription.completed'
  | 'response.create'
  | 'response.created'
  | 'response.output_item.added'
  | 'response.output_item.done'
  | 'response.content_part.added'
  | 'response.content_part.done'
  | 'response.text.delta'
  | 'response.text.done'
  | 'response.audio_transcript.delta'
  | 'response.audio_transcript.done'
  | 'response.audio.delta'
  | 'response.audio.done'
  | 'response.function_call_arguments.delta'
  | 'response.function_call_arguments.done'
  | 'response.done'
  | 'rate_limits.updated'
  | 'error';

/**
 * Base interface for OpenAI Realtime events
 */
export interface OpenAIRealtimeEvent {
  /** Event type */
  type: OpenAIRealtimeEventType;
  /** Event ID */
  event_id?: string;
}

/**
 * OpenAI Realtime error event
 */
export interface OpenAIRealtimeError extends OpenAIRealtimeEvent {
  type: 'error';
  error: {
    type: string;
    code: string;
    message: string;
    param?: string;
  };
}

/**
 * OpenAI Realtime audio delta event
 */
export interface OpenAIRealtimeAudioDelta extends OpenAIRealtimeEvent {
  type: 'response.audio.delta';
  response_id: string;
  item_id: string;
  output_index: number;
  content_index: number;
  delta: string;
}

/**
 * OpenAI Realtime transcript delta event
 */
export interface OpenAIRealtimeTranscriptDelta extends OpenAIRealtimeEvent {
  type: 'response.audio_transcript.delta';
  response_id: string;
  item_id: string;
  output_index: number;
  content_index: number;
  delta: string;
}

// =============================================================================
// Earl Persona Configuration
// =============================================================================

/**
 * Configuration for the Earl AI persona
 */
export interface EarlPersonaConfig {
  /** Character name */
  name: string;
  /** Character age */
  age: number;
  /** Character background/bio */
  background: string;
  /** Character personality traits */
  personality: string[];
  /** System prompt for AI */
  systemPrompt: string;
  /** Topics Earl likes to go on tangents about */
  tangentTopics: TangentTopic[];
  /** Earl's signature phrases */
  signaturePhrases: string[];
  /** Word mishearings mapping (what they said -> what Earl hears) */
  mishearings: MishearingMap[];
  /** Voice configuration */
  voice: PersonaVoiceConfig;
  /** Response timing configuration */
  timing: PersonaTimingConfig;
  /** Things Earl should never do */
  restrictions: string[];
}

/**
 * A tangent topic that Earl might discuss
 */
export interface TangentTopic {
  /** Topic name/title */
  name: string;
  /** Description or talking points for this topic */
  description: string;
  /** Keywords that might trigger this tangent */
  triggers?: string[];
}

/**
 * A mishearing mapping
 */
export interface MishearingMap {
  /** Original word/phrase that was said */
  original: string;
  /** What Earl mishears it as */
  misheard: string;
  /** Alternative mishearings */
  alternatives?: string[];
}

/**
 * Voice configuration for the persona
 */
export interface PersonaVoiceConfig {
  /** OpenAI voice ID to use */
  openAIVoice: OpenAIRealtimeConfig['voice'];
  /** Speaking speed modifier (0.5 - 2.0, 1.0 is normal) */
  speedModifier?: number;
  /** Optional ElevenLabs voice ID for custom voice */
  elevenLabsVoiceId?: string;
}

/**
 * Timing configuration for persona responses
 */
export interface PersonaTimingConfig {
  /** Minimum delay before responding (ms) */
  minResponseDelayMs: number;
  /** Maximum delay before responding (ms) */
  maxResponseDelayMs: number;
  /** Probability of a long pause (0-1) */
  longPauseProbability: number;
  /** Duration of long pauses (ms) */
  longPauseDurationMs: number;
  /** Probability of asking to repeat (0-1) */
  repeatRequestProbability: number;
}

// =============================================================================
// Dashboard Statistics
// =============================================================================

/**
 * Dashboard statistics response
 */
export interface DashboardStats {
  /** Overview statistics */
  overview: StatsOverview;
  /** Calls grouped by status */
  callsByStatus: CallsByStatus;
  /** Daily call data for charts */
  callsByDay: DailyCallData[];
  /** Top rated calls for entertainment value */
  topRatedCalls: CallSummary[];
  /** Longest duration calls */
  longestCalls: CallSummary[];
  /** Recent calls */
  recentCalls: CallSummary[];
}

/**
 * Overview statistics
 */
export interface StatsOverview {
  /** Total number of calls */
  totalCalls: number;
  /** Total duration of all calls in seconds */
  totalDuration: number;
  /** Average call duration in seconds */
  averageDuration: number;
  /** Average entertainment rating */
  averageRating: number | null;
  /** Total scammer time wasted (formatted string) */
  timeWastedFormatted: string;
  /** Calls this week */
  callsThisWeek: number;
  /** Calls this month */
  callsThisMonth: number;
}

/**
 * Call counts grouped by status
 */
export interface CallsByStatus {
  [CallStatus.RINGING]: number;
  [CallStatus.IN_PROGRESS]: number;
  [CallStatus.COMPLETED]: number;
  [CallStatus.FAILED]: number;
  [CallStatus.NO_ANSWER]: number;
}

/**
 * Daily call data for charts
 */
export interface DailyCallData {
  /** Date string (YYYY-MM-DD) */
  date: string;
  /** Number of calls on this day */
  count: number;
  /** Total duration on this day in seconds */
  totalDuration: number;
  /** Average duration on this day in seconds */
  avgDuration: number;
}

/**
 * Summary of a call for lists
 */
export interface CallSummary {
  /** Call ID */
  id: string;
  /** Caller number (masked for privacy) */
  fromNumber: string;
  /** Call duration in seconds */
  duration: number | null;
  /** Entertainment rating */
  rating: number | null;
  /** Call status */
  status: CallStatus;
  /** When the call occurred */
  createdAt: string;
}

// =============================================================================
// Storage Types
// =============================================================================

/**
 * Options for paginating storage results
 */
export interface StoragePaginationOptions {
  /** Maximum number of items to return */
  limit?: number;
  /** Continuation token for pagination */
  continuationToken?: string;
  /** Prefix to filter by */
  prefix?: string;
}

/**
 * Result of a storage list operation
 */
export interface StorageListResult {
  /** List of recording metadata */
  recordings: RecordingMetadata[];
  /** Token for fetching next page */
  nextContinuationToken?: string;
  /** Whether there are more results */
  hasMore: boolean;
}

/**
 * Metadata for a stored recording
 */
export interface RecordingMetadata {
  /** Storage key */
  key: string;
  /** Associated call ID */
  callId: string;
  /** File size in bytes */
  size: number;
  /** Content type */
  contentType: string;
  /** Last modified timestamp */
  lastModified: string;
  /** Signed URL for access (if generated) */
  url?: string;
}

// =============================================================================
// Utility Types
// =============================================================================

/**
 * Makes specified properties required
 */
export type RequireFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

/**
 * Makes all properties optional recursively
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/**
 * Extracts the type of array elements
 */
export type ArrayElement<T> = T extends (infer U)[] ? U : never;

/**
 * Result type for async operations that can fail
 */
export type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E };

/**
 * Async result type
 */
export type AsyncResult<T, E = Error> = Promise<Result<T, E>>;
