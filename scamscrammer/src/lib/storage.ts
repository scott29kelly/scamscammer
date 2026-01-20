/**
 * ScamScrammer Storage Service
 *
 * Handles AWS S3 operations for storing and managing call recordings.
 * Provides methods for uploading, retrieving, deleting, and listing recordings.
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  HeadObjectCommand,
  type PutObjectCommandInput,
  type GetObjectCommandInput,
  type DeleteObjectCommandInput,
  type ListObjectsV2CommandInput,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import {
  StoragePaginationOptions,
  StorageListResult,
  RecordingMetadata,
  StorageConfig,
  UploadResult,
  StorageErrorCode,
} from '@/types';

/**
 * Custom error class for storage operations
 */
export class StorageError extends Error {
  public readonly code: StorageErrorCode;
  public readonly cause?: Error;

  constructor(message: string, code: StorageErrorCode, cause?: Error) {
    super(message);
    this.name = 'StorageError';
    this.code = code;
    this.cause = cause;

    // Maintains proper stack trace for where error was thrown (V8 engines)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, StorageError);
    }
  }
}

/**
 * Default expiration time for signed URLs (1 hour in seconds)
 */
const DEFAULT_URL_EXPIRATION = 3600;

/**
 * Default content type for audio recordings
 */
const DEFAULT_CONTENT_TYPE = 'audio/wav';

/**
 * Prefix for all recording objects in S3
 */
const RECORDINGS_PREFIX = 'recordings/';

/**
 * StorageClient class for managing call recordings in AWS S3
 */
export class StorageClient {
  private readonly client: S3Client;
  private readonly bucketName: string;
  private readonly region: string;

  /**
   * Creates a new StorageClient instance
   *
   * @param config - Optional configuration. If not provided, uses environment variables.
   * @throws StorageError if configuration is invalid or missing
   */
  constructor(config?: Partial<StorageConfig>) {
    const region = config?.region ?? process.env.AWS_REGION;
    const bucketName = config?.bucketName ?? process.env.AWS_BUCKET_NAME;
    const accessKeyId = config?.accessKeyId ?? process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = config?.secretAccessKey ?? process.env.AWS_SECRET_ACCESS_KEY;

    if (!region) {
      throw new StorageError(
        'AWS_REGION is required',
        StorageErrorCode.INVALID_CONFIG
      );
    }
    if (!bucketName) {
      throw new StorageError(
        'AWS_BUCKET_NAME is required',
        StorageErrorCode.INVALID_CONFIG
      );
    }
    if (!accessKeyId) {
      throw new StorageError(
        'AWS_ACCESS_KEY_ID is required',
        StorageErrorCode.INVALID_CONFIG
      );
    }
    if (!secretAccessKey) {
      throw new StorageError(
        'AWS_SECRET_ACCESS_KEY is required',
        StorageErrorCode.INVALID_CONFIG
      );
    }

    this.region = region;
    this.bucketName = bucketName;

    this.client = new S3Client({
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
  }

  /**
   * Generates a consistent S3 key for a recording
   *
   * Format: recordings/{YYYY-MM-DD}/{callId}.wav
   *
   * @param callId - The unique call identifier
   * @param date - Optional date for the recording (defaults to now)
   * @returns The S3 object key
   */
  public generateStorageKey(callId: string, date?: Date): string {
    const recordingDate = date ?? new Date();
    const dateStr = recordingDate.toISOString().split('T')[0]; // YYYY-MM-DD
    return `${RECORDINGS_PREFIX}${dateStr}/${callId}.wav`;
  }

  /**
   * Extracts the call ID from an S3 object key
   *
   * @param key - The S3 object key
   * @returns The extracted call ID
   */
  public extractCallIdFromKey(key: string): string {
    // Key format: recordings/YYYY-MM-DD/callId.wav
    const filename = key.split('/').pop() ?? '';
    return filename.replace(/\.[^/.]+$/, ''); // Remove extension
  }

  /**
   * Uploads a recording to S3
   *
   * @param callId - The unique call identifier
   * @param audioBuffer - The audio data as a Buffer
   * @param contentType - Optional MIME type (defaults to 'audio/wav')
   * @returns Upload result with key and URL
   * @throws StorageError if upload fails
   */
  public async uploadRecording(
    callId: string,
    audioBuffer: Buffer,
    contentType: string = DEFAULT_CONTENT_TYPE
  ): Promise<UploadResult> {
    const key = this.generateStorageKey(callId);

    const params: PutObjectCommandInput = {
      Bucket: this.bucketName,
      Key: key,
      Body: audioBuffer,
      ContentType: contentType,
      Metadata: {
        'call-id': callId,
        'uploaded-at': new Date().toISOString(),
      },
    };

    try {
      await this.client.send(new PutObjectCommand(params));

      return {
        key,
        url: `https://${this.bucketName}.s3.${this.region}.amazonaws.com/${key}`,
        size: audioBuffer.length,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Check for specific AWS error types
      if (errorMessage.includes('QuotaExceeded') || errorMessage.includes('EntityTooLarge')) {
        throw new StorageError(
          `Upload failed: Storage quota exceeded for call ${callId}`,
          StorageErrorCode.QUOTA_EXCEEDED,
          error instanceof Error ? error : undefined
        );
      }

      if (errorMessage.includes('AccessDenied')) {
        throw new StorageError(
          `Upload failed: Access denied for call ${callId}`,
          StorageErrorCode.ACCESS_DENIED,
          error instanceof Error ? error : undefined
        );
      }

      throw new StorageError(
        `Failed to upload recording for call ${callId}: ${errorMessage}`,
        StorageErrorCode.UPLOAD_FAILED,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Generates a signed URL for accessing a recording
   *
   * @param callId - The unique call identifier
   * @param expiresIn - URL expiration time in seconds (default: 3600)
   * @returns Signed URL for the recording
   * @throws StorageError if URL generation fails or recording not found
   */
  public async getRecordingUrl(
    callId: string,
    expiresIn: number = DEFAULT_URL_EXPIRATION
  ): Promise<string> {
    const key = this.generateStorageKey(callId);

    // First, verify the object exists
    try {
      await this.client.send(
        new HeadObjectCommand({
          Bucket: this.bucketName,
          Key: key,
        })
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      if (errorMessage.includes('NotFound') || errorMessage.includes('NoSuchKey')) {
        throw new StorageError(
          `Recording not found for call ${callId}`,
          StorageErrorCode.NOT_FOUND,
          error instanceof Error ? error : undefined
        );
      }

      throw new StorageError(
        `Failed to verify recording for call ${callId}: ${errorMessage}`,
        StorageErrorCode.DOWNLOAD_FAILED,
        error instanceof Error ? error : undefined
      );
    }

    // Generate signed URL
    const params: GetObjectCommandInput = {
      Bucket: this.bucketName,
      Key: key,
    };

    try {
      const signedUrl = await getSignedUrl(
        this.client,
        new GetObjectCommand(params),
        { expiresIn }
      );
      return signedUrl;
    } catch (error) {
      throw new StorageError(
        `Failed to generate signed URL for call ${callId}`,
        StorageErrorCode.DOWNLOAD_FAILED,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Retrieves a recording URL by its S3 key (instead of callId)
   * Useful when the key is already known from listing results
   *
   * @param key - The S3 object key
   * @param expiresIn - URL expiration time in seconds (default: 3600)
   * @returns Signed URL for the recording
   */
  public async getRecordingUrlByKey(
    key: string,
    expiresIn: number = DEFAULT_URL_EXPIRATION
  ): Promise<string> {
    const params: GetObjectCommandInput = {
      Bucket: this.bucketName,
      Key: key,
    };

    try {
      const signedUrl = await getSignedUrl(
        this.client,
        new GetObjectCommand(params),
        { expiresIn }
      );
      return signedUrl;
    } catch (error) {
      throw new StorageError(
        `Failed to generate signed URL for key ${key}`,
        StorageErrorCode.DOWNLOAD_FAILED,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Deletes a recording from S3
   *
   * @param callId - The unique call identifier
   * @throws StorageError if deletion fails (but not if file doesn't exist)
   */
  public async deleteRecording(callId: string): Promise<void> {
    const key = this.generateStorageKey(callId);

    const params: DeleteObjectCommandInput = {
      Bucket: this.bucketName,
      Key: key,
    };

    try {
      // S3 DeleteObject is idempotent - it succeeds even if the object doesn't exist
      await this.client.send(new DeleteObjectCommand(params));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      if (errorMessage.includes('AccessDenied')) {
        throw new StorageError(
          `Delete failed: Access denied for call ${callId}`,
          StorageErrorCode.ACCESS_DENIED,
          error instanceof Error ? error : undefined
        );
      }

      throw new StorageError(
        `Failed to delete recording for call ${callId}: ${errorMessage}`,
        StorageErrorCode.DELETE_FAILED,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Deletes a recording by its S3 key (instead of callId)
   * Useful when cleaning up recordings with known keys
   *
   * @param key - The S3 object key
   */
  public async deleteRecordingByKey(key: string): Promise<void> {
    const params: DeleteObjectCommandInput = {
      Bucket: this.bucketName,
      Key: key,
    };

    try {
      await this.client.send(new DeleteObjectCommand(params));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      throw new StorageError(
        `Failed to delete recording with key ${key}: ${errorMessage}`,
        StorageErrorCode.DELETE_FAILED,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Lists recordings from S3 with optional filtering and pagination
   *
   * @param options - Pagination and filtering options
   * @returns List result with recordings and pagination info
   * @throws StorageError if listing fails
   */
  public async listRecordings(
    options: StoragePaginationOptions = {}
  ): Promise<StorageListResult> {
    const { maxKeys = 100, continuationToken, prefix } = options;

    // Build the full prefix (always under recordings/)
    const fullPrefix = prefix
      ? `${RECORDINGS_PREFIX}${prefix}`
      : RECORDINGS_PREFIX;

    const params: ListObjectsV2CommandInput = {
      Bucket: this.bucketName,
      Prefix: fullPrefix,
      MaxKeys: maxKeys,
      ContinuationToken: continuationToken,
    };

    try {
      const response = await this.client.send(new ListObjectsV2Command(params));

      const recordings: RecordingMetadata[] = (response.Contents ?? [])
        .filter((obj) => obj.Key && obj.Key.endsWith('.wav'))
        .map((obj) => ({
          key: obj.Key!,
          size: obj.Size ?? 0,
          contentType: DEFAULT_CONTENT_TYPE,
          lastModified: obj.LastModified ?? new Date(),
          callId: this.extractCallIdFromKey(obj.Key!),
        }));

      return {
        recordings,
        nextContinuationToken: response.NextContinuationToken,
        isTruncated: response.IsTruncated ?? false,
        count: recordings.length,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      if (errorMessage.includes('AccessDenied')) {
        throw new StorageError(
          'List failed: Access denied to bucket',
          StorageErrorCode.ACCESS_DENIED,
          error instanceof Error ? error : undefined
        );
      }

      throw new StorageError(
        `Failed to list recordings: ${errorMessage}`,
        StorageErrorCode.NETWORK_ERROR,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Checks if a recording exists in S3
   *
   * @param callId - The unique call identifier
   * @returns True if the recording exists
   */
  public async recordingExists(callId: string): Promise<boolean> {
    const key = this.generateStorageKey(callId);

    try {
      await this.client.send(
        new HeadObjectCommand({
          Bucket: this.bucketName,
          Key: key,
        })
      );
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Gets metadata for a specific recording
   *
   * @param callId - The unique call identifier
   * @returns Recording metadata
   * @throws StorageError if recording not found
   */
  public async getRecordingMetadata(callId: string): Promise<RecordingMetadata> {
    const key = this.generateStorageKey(callId);

    try {
      const response = await this.client.send(
        new HeadObjectCommand({
          Bucket: this.bucketName,
          Key: key,
        })
      );

      return {
        key,
        size: response.ContentLength ?? 0,
        contentType: response.ContentType ?? DEFAULT_CONTENT_TYPE,
        lastModified: response.LastModified ?? new Date(),
        callId,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      if (errorMessage.includes('NotFound') || errorMessage.includes('NoSuchKey')) {
        throw new StorageError(
          `Recording not found for call ${callId}`,
          StorageErrorCode.NOT_FOUND,
          error instanceof Error ? error : undefined
        );
      }

      throw new StorageError(
        `Failed to get metadata for call ${callId}: ${errorMessage}`,
        StorageErrorCode.DOWNLOAD_FAILED,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Downloads recording data as a Buffer
   *
   * @param callId - The unique call identifier
   * @returns The recording audio data
   * @throws StorageError if download fails
   */
  public async downloadRecording(callId: string): Promise<Buffer> {
    const key = this.generateStorageKey(callId);

    try {
      const response = await this.client.send(
        new GetObjectCommand({
          Bucket: this.bucketName,
          Key: key,
        })
      );

      if (!response.Body) {
        throw new StorageError(
          `Empty response body for call ${callId}`,
          StorageErrorCode.DOWNLOAD_FAILED
        );
      }

      // Convert stream to buffer
      const chunks: Uint8Array[] = [];
      const stream = response.Body as AsyncIterable<Uint8Array>;

      for await (const chunk of stream) {
        chunks.push(chunk);
      }

      return Buffer.concat(chunks);
    } catch (error) {
      if (error instanceof StorageError) {
        throw error;
      }

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      if (errorMessage.includes('NotFound') || errorMessage.includes('NoSuchKey')) {
        throw new StorageError(
          `Recording not found for call ${callId}`,
          StorageErrorCode.NOT_FOUND,
          error instanceof Error ? error : undefined
        );
      }

      throw new StorageError(
        `Failed to download recording for call ${callId}: ${errorMessage}`,
        StorageErrorCode.DOWNLOAD_FAILED,
        error instanceof Error ? error : undefined
      );
    }
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let storageClientInstance: StorageClient | null = null;

/**
 * Gets or creates the singleton StorageClient instance
 *
 * @returns The StorageClient instance
 */
export function getStorageClient(): StorageClient {
  if (!storageClientInstance) {
    storageClientInstance = new StorageClient();
  }
  return storageClientInstance;
}

/**
 * Resets the singleton instance (useful for testing)
 */
export function resetStorageClient(): void {
  storageClientInstance = null;
}
