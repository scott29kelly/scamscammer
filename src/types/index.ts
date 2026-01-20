/**
 * ScamScrammer TypeScript Types
 * Storage-related types for AWS S3 recording management
 */

// ============================================================================
// Storage Types
// ============================================================================

/**
 * Options for paginating storage listing results
 */
export interface StoragePaginationOptions {
  /** Maximum number of items to return */
  maxKeys?: number;
  /** Continuation token from previous request for pagination */
  continuationToken?: string;
  /** Filter results by key prefix */
  prefix?: string;
}

/**
 * Metadata for a single recording stored in S3
 */
export interface RecordingMetadata {
  /** S3 object key */
  key: string;
  /** Size in bytes */
  size: number;
  /** MIME content type (e.g., 'audio/wav', 'audio/mpeg') */
  contentType?: string;
  /** Last modified timestamp */
  lastModified: Date;
  /** Associated call ID extracted from the key */
  callId: string;
}

/**
 * Result of listing recordings from storage
 */
export interface StorageListResult {
  /** Array of recording metadata */
  recordings: RecordingMetadata[];
  /** Token for fetching next page, undefined if no more results */
  nextContinuationToken?: string;
  /** Whether there are more results available */
  isTruncated: boolean;
  /** Total count of items returned in this response */
  count: number;
}

/**
 * Configuration for the storage client
 */
export interface StorageConfig {
  /** AWS region (e.g., 'us-east-1') */
  region: string;
  /** S3 bucket name */
  bucketName: string;
  /** AWS access key ID */
  accessKeyId: string;
  /** AWS secret access key */
  secretAccessKey: string;
}

/**
 * Result of an upload operation
 */
export interface UploadResult {
  /** S3 object key where the file was stored */
  key: string;
  /** Full S3 URL (not signed) */
  url: string;
  /** Size of uploaded file in bytes */
  size: number;
}

// ============================================================================
// Error Types
// ============================================================================

/**
 * Error codes for storage operations
 */
export enum StorageErrorCode {
  UPLOAD_FAILED = 'UPLOAD_FAILED',
  DOWNLOAD_FAILED = 'DOWNLOAD_FAILED',
  DELETE_FAILED = 'DELETE_FAILED',
  NOT_FOUND = 'NOT_FOUND',
  ACCESS_DENIED = 'ACCESS_DENIED',
  INVALID_CONFIG = 'INVALID_CONFIG',
  NETWORK_ERROR = 'NETWORK_ERROR',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
}

// ============================================================================
// Call Types (for reference - used by other modules)
// ============================================================================

/**
 * Call status enum matching Prisma schema
 */
export enum CallStatus {
  RINGING = 'RINGING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  NO_ANSWER = 'NO_ANSWER',
}

/**
 * Speaker enum matching Prisma schema
 */
export enum Speaker {
  SCAMMER = 'SCAMMER',
  EARL = 'EARL',
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Generic result type for operations that may fail
 */
export type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E };

/**
 * Async result type
 */
export type AsyncResult<T, E = Error> = Promise<Result<T, E>>;
