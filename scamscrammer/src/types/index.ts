/**
 * ScamScrammer TypeScript Interfaces and Types
 *
 * This file contains all TypeScript interfaces for the application including:
 * - Twilio webhook payloads
 * - API response shapes
 * - OpenAI configuration
 * - Storage types
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

/**
 * Error codes for storage operations
 */
export enum StorageErrorCode {
  UPLOAD_FAILED = 'UPLOAD_FAILED',
  DOWNLOAD_FAILED = 'DOWNLOAD_FAILED',
  DELETE_FAILED = 'DELETE_FAILED',
  NOT_FOUND = 'NOT_FOUND',
  ACCESS_DENIED = 'ACCESS_DENIED',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
  NETWORK_ERROR = 'NETWORK_ERROR',
  INVALID_CONFIG = 'INVALID_CONFIG',
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

// =============================================================================
// Twilio Client Types
// =============================================================================

/**
 * Details of a Twilio call fetched from the API
 */
export interface TwilioCallDetails {
  sid: string;
  status: string;
  from: string;
  to: string;
  direction: string;
  duration: number | null;
  startTime: Date | null;
  endTime: Date | null;
  price: string | null;
  priceUnit: string | null;
}

/**
 * Details of a Twilio recording fetched from the API
 */
export interface TwilioRecordingDetails {
  sid: string;
  callSid: string;
  status: string;
  duration: number;
  url: string;
  mediaUrl: string;
}

/**
 * Options for TwiML generation
 */
export interface TwiMLOptions {
  voice?: string;
  language?: string;
  record?: boolean;
  recordingStatusCallback?: string;
}

// =============================================================================
// Storage Types
// =============================================================================

/**
 * Configuration for the storage client
 */
export interface StorageConfig {
  region: string;
  bucketName: string;
  accessKeyId: string;
  secretAccessKey: string;
}

/**
 * Options for paginating storage results
 */
export interface StoragePaginationOptions {
  /** Maximum number of items to return */
  maxKeys?: number;
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
  isTruncated: boolean;
  /** Number of recordings returned */
  count: number;
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
  lastModified: Date;
  /** Signed URL for access (if generated) */
  url?: string;
}

/**
 * Result of an upload operation
 */
export interface UploadResult {
  /** S3 object key */
  key: string;
  /** Public URL (unsigned) */
  url: string;
  /** File size in bytes */
  size: number;
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
