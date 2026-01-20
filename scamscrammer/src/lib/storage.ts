/**
 * Storage Service for Call Recordings
 *
 * This module provides S3-based storage operations for call recordings,
 * including upload, retrieval, deletion, and listing functionality.
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

/**
 * Storage configuration from environment variables
 */
export interface StorageConfig {
  region: string;
  bucket: string;
  accessKeyId?: string;
  secretAccessKey?: string;
}

/**
 * Options for listing recordings
 */
export interface ListRecordingsOptions {
  limit?: number;
  continuationToken?: string;
  prefix?: string;
}

/**
 * Recording metadata returned from storage
 */
export interface RecordingMetadata {
  key: string;
  callId: string;
  size: number;
  lastModified: Date;
  contentType: string;
}

/**
 * Response for listing recordings
 */
export interface ListRecordingsResponse {
  recordings: RecordingMetadata[];
  nextToken?: string;
  hasMore: boolean;
}

/**
 * Upload result
 */
export interface UploadResult {
  key: string;
  bucket: string;
  location: string;
}

/**
 * Custom error class for storage operations
 */
export class StorageError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = 'StorageError';
  }
}

/**
 * Get storage configuration from environment variables
 */
function getStorageConfig(): StorageConfig {
  const region = process.env.AWS_REGION;
  const bucket = process.env.AWS_BUCKET_NAME;

  if (!region) {
    throw new StorageError('AWS_REGION environment variable is not set', 'CONFIG_ERROR');
  }

  if (!bucket) {
    throw new StorageError('AWS_BUCKET_NAME environment variable is not set', 'CONFIG_ERROR');
  }

  return {
    region,
    bucket,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  };
}

/**
 * Global singleton for storage client
 */
const globalForStorage = globalThis as unknown as {
  storageClient: StorageClient | undefined;
};

/**
 * Storage client for managing call recordings in S3
 */
export class StorageClient {
  private s3: S3Client;
  private bucket: string;
  private region: string;

  constructor(config?: Partial<StorageConfig>) {
    const envConfig = getStorageConfig();
    const finalConfig = { ...envConfig, ...config };

    this.bucket = finalConfig.bucket;
    this.region = finalConfig.region;

    const s3Config: ConstructorParameters<typeof S3Client>[0] = {
      region: this.region,
    };

    // Only set credentials if explicitly provided
    // Otherwise, let the SDK use default credential chain (IAM roles, etc.)
    if (finalConfig.accessKeyId && finalConfig.secretAccessKey) {
      s3Config.credentials = {
        accessKeyId: finalConfig.accessKeyId,
        secretAccessKey: finalConfig.secretAccessKey,
      };
    }

    this.s3 = new S3Client(s3Config);
  }

  /**
   * Generate a consistent storage key for a call recording
   *
   * @param callId - The unique call identifier
   * @param extension - File extension (default: 'wav')
   * @returns The S3 object key
   */
  generateStorageKey(callId: string, extension: string = 'wav'): string {
    // Use date-based partitioning for better S3 performance
    const date = new Date();
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');

    return `recordings/${year}/${month}/${day}/${callId}.${extension}`;
  }

  /**
   * Extract call ID from a storage key
   *
   * @param key - The S3 object key
   * @returns The call ID
   */
  extractCallIdFromKey(key: string): string {
    const filename = key.split('/').pop() || '';
    return filename.replace(/\.[^.]+$/, '');
  }

  /**
   * Upload a recording to S3
   *
   * @param callId - The unique call identifier
   * @param audioBuffer - The audio data as a Buffer
   * @param contentType - MIME type of the audio (default: 'audio/wav')
   * @returns Upload result with key and location
   */
  async uploadRecording(
    callId: string,
    audioBuffer: Buffer,
    contentType: string = 'audio/wav'
  ): Promise<UploadResult> {
    const extension = this.getExtensionFromContentType(contentType);
    const key = this.generateStorageKey(callId, extension);

    try {
      await this.s3.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: audioBuffer,
          ContentType: contentType,
          Metadata: {
            callId,
            uploadedAt: new Date().toISOString(),
          },
        })
      );

      return {
        key,
        bucket: this.bucket,
        location: `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`,
      };
    } catch (error) {
      throw new StorageError(
        `Failed to upload recording for call ${callId}`,
        'UPLOAD_ERROR',
        error
      );
    }
  }

  /**
   * Get a signed URL for downloading a recording
   *
   * @param callId - The unique call identifier
   * @param expiresIn - URL expiration time in seconds (default: 3600 = 1 hour)
   * @returns Signed URL for the recording
   */
  async getRecordingUrl(callId: string, expiresIn: number = 3600): Promise<string> {
    // First, find the recording key by listing with the callId prefix
    const key = await this.findRecordingKey(callId);

    if (!key) {
      throw new StorageError(
        `Recording not found for call ${callId}`,
        'NOT_FOUND'
      );
    }

    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      return await getSignedUrl(this.s3, command, { expiresIn });
    } catch (error) {
      throw new StorageError(
        `Failed to generate signed URL for call ${callId}`,
        'URL_ERROR',
        error
      );
    }
  }

  /**
   * Delete a recording from S3
   *
   * @param callId - The unique call identifier
   * @returns true if deleted, false if not found
   */
  async deleteRecording(callId: string): Promise<boolean> {
    const key = await this.findRecordingKey(callId);

    if (!key) {
      return false;
    }

    try {
      await this.s3.send(
        new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: key,
        })
      );
      return true;
    } catch (error) {
      throw new StorageError(
        `Failed to delete recording for call ${callId}`,
        'DELETE_ERROR',
        error
      );
    }
  }

  /**
   * List recordings with optional pagination
   *
   * @param options - Listing options (limit, continuationToken, prefix)
   * @returns List of recording metadata with pagination info
   */
  async listRecordings(options: ListRecordingsOptions = {}): Promise<ListRecordingsResponse> {
    const { limit = 100, continuationToken, prefix = 'recordings/' } = options;

    try {
      const response = await this.s3.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: prefix,
          MaxKeys: limit,
          ContinuationToken: continuationToken,
        })
      );

      const recordings: RecordingMetadata[] = (response.Contents || [])
        .filter((obj) => obj.Key && obj.Size !== undefined)
        .map((obj) => ({
          key: obj.Key!,
          callId: this.extractCallIdFromKey(obj.Key!),
          size: obj.Size!,
          lastModified: obj.LastModified || new Date(),
          contentType: this.getContentTypeFromKey(obj.Key!),
        }));

      return {
        recordings,
        nextToken: response.NextContinuationToken,
        hasMore: response.IsTruncated || false,
      };
    } catch (error) {
      throw new StorageError(
        'Failed to list recordings',
        'LIST_ERROR',
        error
      );
    }
  }

  /**
   * Check if a recording exists
   *
   * @param callId - The unique call identifier
   * @returns true if exists, false otherwise
   */
  async recordingExists(callId: string): Promise<boolean> {
    const key = await this.findRecordingKey(callId);
    return key !== null;
  }

  /**
   * Get recording metadata without downloading the file
   *
   * @param callId - The unique call identifier
   * @returns Recording metadata or null if not found
   */
  async getRecordingMetadata(callId: string): Promise<RecordingMetadata | null> {
    const key = await this.findRecordingKey(callId);

    if (!key) {
      return null;
    }

    try {
      const response = await this.s3.send(
        new HeadObjectCommand({
          Bucket: this.bucket,
          Key: key,
        })
      );

      return {
        key,
        callId,
        size: response.ContentLength || 0,
        lastModified: response.LastModified || new Date(),
        contentType: response.ContentType || 'audio/wav',
      };
    } catch (error) {
      throw new StorageError(
        `Failed to get metadata for call ${callId}`,
        'METADATA_ERROR',
        error
      );
    }
  }

  /**
   * Find the storage key for a recording by call ID
   * Searches across date partitions
   *
   * @param callId - The unique call identifier
   * @returns The S3 key if found, null otherwise
   */
  private async findRecordingKey(callId: string): Promise<string | null> {
    try {
      // Search for the recording across all partitions
      // This handles cases where we don't know the exact date
      const response = await this.s3.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: 'recordings/',
          MaxKeys: 1000,
        })
      );

      const found = (response.Contents || []).find((obj) => {
        if (!obj.Key) return false;
        const extractedCallId = this.extractCallIdFromKey(obj.Key);
        return extractedCallId === callId;
      });

      return found?.Key || null;
    } catch (error) {
      throw new StorageError(
        `Failed to find recording for call ${callId}`,
        'FIND_ERROR',
        error
      );
    }
  }

  /**
   * Get file extension from content type
   */
  private getExtensionFromContentType(contentType: string): string {
    const typeToExtension: Record<string, string> = {
      'audio/wav': 'wav',
      'audio/wave': 'wav',
      'audio/x-wav': 'wav',
      'audio/mpeg': 'mp3',
      'audio/mp3': 'mp3',
      'audio/ogg': 'ogg',
      'audio/webm': 'webm',
      'audio/flac': 'flac',
    };

    return typeToExtension[contentType] || 'wav';
  }

  /**
   * Get content type from file extension in key
   */
  private getContentTypeFromKey(key: string): string {
    const extension = key.split('.').pop()?.toLowerCase();
    const extensionToType: Record<string, string> = {
      wav: 'audio/wav',
      mp3: 'audio/mpeg',
      ogg: 'audio/ogg',
      webm: 'audio/webm',
      flac: 'audio/flac',
    };

    return extensionToType[extension || ''] || 'audio/wav';
  }
}

/**
 * Get the singleton storage client instance
 */
export function getStorageClient(config?: Partial<StorageConfig>): StorageClient {
  if (!globalForStorage.storageClient) {
    globalForStorage.storageClient = new StorageClient(config);
  }
  return globalForStorage.storageClient;
}

/**
 * Default export: singleton storage client
 * Usage: import storage from '@/lib/storage'; storage.uploadRecording(...)
 */
export const storage = {
  /**
   * Upload a recording to S3
   */
  uploadRecording: (
    callId: string,
    audioBuffer: Buffer,
    contentType?: string
  ) => getStorageClient().uploadRecording(callId, audioBuffer, contentType),

  /**
   * Get a signed URL for a recording
   */
  getRecordingUrl: (callId: string, expiresIn?: number) =>
    getStorageClient().getRecordingUrl(callId, expiresIn),

  /**
   * Delete a recording
   */
  deleteRecording: (callId: string) => getStorageClient().deleteRecording(callId),

  /**
   * List recordings with pagination
   */
  listRecordings: (options?: ListRecordingsOptions) =>
    getStorageClient().listRecordings(options),

  /**
   * Generate a storage key for a call ID
   */
  generateStorageKey: (callId: string, extension?: string) =>
    getStorageClient().generateStorageKey(callId, extension),

  /**
   * Check if a recording exists
   */
  recordingExists: (callId: string) => getStorageClient().recordingExists(callId),

  /**
   * Get recording metadata
   */
  getRecordingMetadata: (callId: string) =>
    getStorageClient().getRecordingMetadata(callId),
};

export default storage;
