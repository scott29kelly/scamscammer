/**
 * Storage Service for Call Recordings
 *
 * Provides S3 operations for storing and retrieving call recordings.
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const region = process.env.AWS_REGION || 'us-east-1';
const bucketName = process.env.S3_BUCKET_NAME;

/**
 * Lazily initialized S3 client
 */
function getS3Client(): S3Client {
  return new S3Client({
    region,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    },
  });
}

/**
 * Generate consistent storage key for a recording
 * @param callId - Internal call ID from database
 * @returns S3 object key
 */
export function generateStorageKey(callId: string): string {
  const date = new Date();
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `recordings/${year}/${month}/${callId}.mp3`;
}

/**
 * Upload a recording to S3 storage
 * @param callId - Internal call ID from database
 * @param audioBuffer - Buffer containing the audio data
 * @returns The storage key if successful, null on error
 */
export async function uploadRecording(
  callId: string,
  audioBuffer: Buffer
): Promise<string | null> {
  if (!bucketName) {
    console.error('S3_BUCKET_NAME not configured');
    return null;
  }

  const client = getS3Client();
  const key = generateStorageKey(callId);

  try {
    await client.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        Body: audioBuffer,
        ContentType: 'audio/mpeg',
        Metadata: {
          callId,
          uploadedAt: new Date().toISOString(),
        },
      })
    );

    return key;
  } catch (error) {
    console.error(`Error uploading recording for call ${callId}:`, error);
    return null;
  }
}

/**
 * Generate a signed URL for accessing a recording
 * @param callId - Internal call ID or storage key
 * @param expiresIn - URL expiration time in seconds (default: 1 hour)
 * @returns Signed URL or null on error
 */
export async function getRecordingUrl(
  callId: string,
  expiresIn: number = 3600
): Promise<string | null> {
  if (!bucketName) {
    console.error('S3_BUCKET_NAME not configured');
    return null;
  }

  const client = getS3Client();
  // Determine if callId is already a storage key or needs to be looked up
  const key = callId.startsWith('recordings/') ? callId : generateStorageKey(callId);

  try {
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: key,
    });

    const signedUrl = await getSignedUrl(client, command, { expiresIn });
    return signedUrl;
  } catch (error) {
    console.error(`Error generating signed URL for ${callId}:`, error);
    return null;
  }
}

/**
 * Delete a recording from S3 storage
 * @param storageKey - S3 object key for the recording
 * @returns true if deleted successfully
 */
export async function deleteRecording(storageKey: string): Promise<boolean> {
  if (!bucketName) {
    console.error('S3_BUCKET_NAME not configured');
    return false;
  }

  const client = getS3Client();

  try {
    await client.send(
      new DeleteObjectCommand({
        Bucket: bucketName,
        Key: storageKey,
      })
    );
    return true;
  } catch (error) {
    console.error(`Error deleting recording ${storageKey}:`, error);
    return false;
  }
}

/**
 * Pagination options for listing recordings
 */
export interface PaginationOptions {
  limit?: number;
  continuationToken?: string;
  prefix?: string;
}

/**
 * List recordings in S3 storage
 * @param options - Pagination and filtering options
 * @returns List of recording keys with pagination token
 */
export async function listRecordings(options: PaginationOptions = {}): Promise<{
  recordings: string[];
  nextToken?: string;
}> {
  if (!bucketName) {
    console.error('S3_BUCKET_NAME not configured');
    return { recordings: [] };
  }

  const client = getS3Client();
  const { limit = 100, continuationToken, prefix = 'recordings/' } = options;

  try {
    const response = await client.send(
      new ListObjectsV2Command({
        Bucket: bucketName,
        Prefix: prefix,
        MaxKeys: limit,
        ContinuationToken: continuationToken,
      })
    );

    const recordings = (response.Contents || [])
      .map((obj) => obj.Key)
      .filter((key): key is string => key !== undefined);

    return {
      recordings,
      nextToken: response.NextContinuationToken,
    };
  } catch (error) {
    console.error('Error listing recordings:', error);
    return { recordings: [] };
  }
}

/**
 * Check if a recording exists in storage
 * @param storageKey - S3 object key for the recording
 * @returns true if the recording exists
 */
export async function recordingExists(storageKey: string): Promise<boolean> {
  if (!bucketName) {
    return false;
  }

  const client = getS3Client();

  try {
    await client.send(
      new GetObjectCommand({
        Bucket: bucketName,
        Key: storageKey,
      })
    );
    return true;
  } catch (error) {
    // If we get a NoSuchKey error, the object doesn't exist
    return false;
  }
}

export default {
  generateStorageKey,
  uploadRecording,
  getRecordingUrl,
  deleteRecording,
  listRecordings,
  recordingExists,
};
