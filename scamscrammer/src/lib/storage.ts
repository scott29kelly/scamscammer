/**
 * S3 Storage Client Library
 *
 * Provides utilities for storing and managing call recordings in S3-compatible storage.
 */

import crypto from 'crypto';

/**
 * S3 upload result
 */
export interface UploadResult {
  url: string;
  key: string;
  bucket: string;
}

/**
 * S3 recording metadata
 */
export interface RecordingMetadata {
  callSid: string;
  recordingSid: string;
  duration?: number;
  contentType: string;
  uploadedAt: string;
}

/**
 * Generates a unique storage key for a recording
 *
 * @param callSid - The Twilio Call SID
 * @param recordingSid - The Twilio Recording SID
 * @param extension - File extension (default: 'mp3')
 * @returns Storage key string
 */
export function generateStorageKey(
  callSid: string,
  recordingSid: string,
  extension: string = 'mp3'
): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `recordings/${year}/${month}/${day}/${callSid}/${recordingSid}.${extension}`;
}

/**
 * StorageClient class for S3-compatible storage operations
 */
export class StorageClient {
  private accessKeyId: string;
  private secretAccessKey: string;
  private bucket: string;
  private region: string;
  private endpoint: string;

  constructor(options?: {
    accessKeyId?: string;
    secretAccessKey?: string;
    bucket?: string;
    region?: string;
    endpoint?: string;
  }) {
    this.accessKeyId = options?.accessKeyId || process.env.AWS_ACCESS_KEY_ID || '';
    this.secretAccessKey = options?.secretAccessKey || process.env.AWS_SECRET_ACCESS_KEY || '';
    this.bucket = options?.bucket || process.env.S3_BUCKET || 'scamscrammer-recordings';
    this.region = options?.region || process.env.AWS_REGION || 'us-east-1';
    this.endpoint = options?.endpoint || process.env.S3_ENDPOINT || `https://s3.${this.region}.amazonaws.com`;

    if (!this.accessKeyId || !this.secretAccessKey) {
      console.warn('StorageClient: Missing AWS credentials');
    }
  }

  /**
   * Uploads a recording to S3
   *
   * @param key - The storage key for the file
   * @param data - The file data as a Buffer
   * @param metadata - Optional metadata for the recording
   * @returns Upload result with URL and key
   */
  async uploadRecording(
    key: string,
    data: Buffer,
    metadata?: Partial<RecordingMetadata>
  ): Promise<UploadResult> {
    const contentType = metadata?.contentType || 'audio/mpeg';
    const date = new Date();
    const amzDate = this.getAmzDate(date);
    const dateStamp = amzDate.slice(0, 8);

    // Build canonical request
    const host = new URL(this.endpoint).host;
    const canonicalUri = `/${this.bucket}/${key}`;
    const canonicalQueryString = '';

    // Hash the payload
    const payloadHash = crypto.createHash('sha256').update(data).digest('hex');

    // Prepare headers
    const headers: Record<string, string> = {
      'host': host,
      'x-amz-date': amzDate,
      'x-amz-content-sha256': payloadHash,
      'content-type': contentType,
      'content-length': String(data.length),
    };

    // Add metadata headers
    if (metadata?.callSid) {
      headers['x-amz-meta-call-sid'] = metadata.callSid;
    }
    if (metadata?.recordingSid) {
      headers['x-amz-meta-recording-sid'] = metadata.recordingSid;
    }
    if (metadata?.duration !== undefined) {
      headers['x-amz-meta-duration'] = String(metadata.duration);
    }

    const signedHeaders = Object.keys(headers).sort().join(';');
    const canonicalHeaders = Object.keys(headers)
      .sort()
      .map((k) => `${k}:${headers[k]}\n`)
      .join('');

    const canonicalRequest = [
      'PUT',
      canonicalUri,
      canonicalQueryString,
      canonicalHeaders,
      signedHeaders,
      payloadHash,
    ].join('\n');

    // Create string to sign
    const algorithm = 'AWS4-HMAC-SHA256';
    const credentialScope = `${dateStamp}/${this.region}/s3/aws4_request`;
    const stringToSign = [
      algorithm,
      amzDate,
      credentialScope,
      crypto.createHash('sha256').update(canonicalRequest).digest('hex'),
    ].join('\n');

    // Calculate signature
    const signingKey = this.getSignatureKey(dateStamp);
    const signature = crypto
      .createHmac('sha256', signingKey)
      .update(stringToSign)
      .digest('hex');

    // Build authorization header
    const authorization = `${algorithm} Credential=${this.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    // Make the request
    const url = `${this.endpoint}/${this.bucket}/${key}`;
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        ...headers,
        Authorization: authorization,
      },
      body: data,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to upload recording: ${response.status} - ${errorText}`);
    }

    return {
      url: this.getPublicUrl(key),
      key,
      bucket: this.bucket,
    };
  }

  /**
   * Gets a public URL for a recording
   *
   * @param key - The storage key
   * @returns Public URL string
   */
  getRecordingUrl(key: string): string {
    return this.getPublicUrl(key);
  }

  /**
   * Deletes a recording from S3
   *
   * @param key - The storage key to delete
   * @returns true if deleted successfully
   */
  async deleteRecording(key: string): Promise<boolean> {
    const date = new Date();
    const amzDate = this.getAmzDate(date);
    const dateStamp = amzDate.slice(0, 8);

    const host = new URL(this.endpoint).host;
    const canonicalUri = `/${this.bucket}/${key}`;
    const payloadHash = crypto.createHash('sha256').update('').digest('hex');

    const headers: Record<string, string> = {
      'host': host,
      'x-amz-date': amzDate,
      'x-amz-content-sha256': payloadHash,
    };

    const signedHeaders = Object.keys(headers).sort().join(';');
    const canonicalHeaders = Object.keys(headers)
      .sort()
      .map((k) => `${k}:${headers[k]}\n`)
      .join('');

    const canonicalRequest = [
      'DELETE',
      canonicalUri,
      '',
      canonicalHeaders,
      signedHeaders,
      payloadHash,
    ].join('\n');

    const algorithm = 'AWS4-HMAC-SHA256';
    const credentialScope = `${dateStamp}/${this.region}/s3/aws4_request`;
    const stringToSign = [
      algorithm,
      amzDate,
      credentialScope,
      crypto.createHash('sha256').update(canonicalRequest).digest('hex'),
    ].join('\n');

    const signingKey = this.getSignatureKey(dateStamp);
    const signature = crypto
      .createHmac('sha256', signingKey)
      .update(stringToSign)
      .digest('hex');

    const authorization = `${algorithm} Credential=${this.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    const url = `${this.endpoint}/${this.bucket}/${key}`;
    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        ...headers,
        Authorization: authorization,
      },
    });

    return response.ok || response.status === 204;
  }

  /**
   * Lists recordings in a path prefix
   *
   * @param prefix - The path prefix to list
   * @returns Array of recording keys
   */
  async listRecordings(prefix: string = 'recordings/'): Promise<string[]> {
    const date = new Date();
    const amzDate = this.getAmzDate(date);
    const dateStamp = amzDate.slice(0, 8);

    const host = new URL(this.endpoint).host;
    const canonicalUri = `/${this.bucket}`;
    const canonicalQueryString = `list-type=2&prefix=${encodeURIComponent(prefix)}`;
    const payloadHash = crypto.createHash('sha256').update('').digest('hex');

    const headers: Record<string, string> = {
      'host': host,
      'x-amz-date': amzDate,
      'x-amz-content-sha256': payloadHash,
    };

    const signedHeaders = Object.keys(headers).sort().join(';');
    const canonicalHeaders = Object.keys(headers)
      .sort()
      .map((k) => `${k}:${headers[k]}\n`)
      .join('');

    const canonicalRequest = [
      'GET',
      canonicalUri,
      canonicalQueryString,
      canonicalHeaders,
      signedHeaders,
      payloadHash,
    ].join('\n');

    const algorithm = 'AWS4-HMAC-SHA256';
    const credentialScope = `${dateStamp}/${this.region}/s3/aws4_request`;
    const stringToSign = [
      algorithm,
      amzDate,
      credentialScope,
      crypto.createHash('sha256').update(canonicalRequest).digest('hex'),
    ].join('\n');

    const signingKey = this.getSignatureKey(dateStamp);
    const signature = crypto
      .createHmac('sha256', signingKey)
      .update(stringToSign)
      .digest('hex');

    const authorization = `${algorithm} Credential=${this.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    const url = `${this.endpoint}/${this.bucket}?${canonicalQueryString}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        ...headers,
        Authorization: authorization,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to list recordings: ${response.status}`);
    }

    const xmlText = await response.text();
    const keys: string[] = [];
    const keyRegex = /<Key>([^<]+)<\/Key>/g;
    let match;
    while ((match = keyRegex.exec(xmlText)) !== null) {
      keys.push(match[1]);
    }

    return keys;
  }

  /**
   * Gets the public URL for a key
   */
  private getPublicUrl(key: string): string {
    return `${this.endpoint}/${this.bucket}/${key}`;
  }

  /**
   * Formats date for AWS signature
   */
  private getAmzDate(date: Date): string {
    return date.toISOString().replace(/[:-]|\.\d{3}/g, '');
  }

  /**
   * Derives the signing key for AWS Signature Version 4
   */
  private getSignatureKey(dateStamp: string): Buffer {
    const kDate = crypto
      .createHmac('sha256', `AWS4${this.secretAccessKey}`)
      .update(dateStamp)
      .digest();
    const kRegion = crypto.createHmac('sha256', kDate).update(this.region).digest();
    const kService = crypto.createHmac('sha256', kRegion).update('s3').digest();
    const kSigning = crypto.createHmac('sha256', kService).update('aws4_request').digest();
    return kSigning;
  }
}

// Export a default instance
export const storageClient = new StorageClient();
