/**
 * Storage Service Unit Tests
 *
 * Tests for the StorageClient class covering:
 * - Configuration validation
 * - Key generation
 * - Upload, download, and delete operations
 * - Listing with pagination
 * - Error handling
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

import {
  StorageClient,
  StorageError,
  getStorageClient,
  resetStorageClient,
} from '../storage';
import { StorageErrorCode } from '@/types';

// Mock AWS SDK
jest.mock('@aws-sdk/client-s3');
jest.mock('@aws-sdk/s3-request-presigner');

const mockSend = jest.fn();
const mockGetSignedUrl = getSignedUrl as jest.MockedFunction<typeof getSignedUrl>;

// Set up mock S3 client
(S3Client as jest.MockedClass<typeof S3Client>).mockImplementation(() => ({
  send: mockSend,
} as unknown as S3Client));

describe('StorageClient', () => {
  const mockConfig = {
    region: 'us-east-1',
    bucketName: 'test-bucket',
    accessKeyId: 'test-access-key',
    secretAccessKey: 'test-secret-key',
  };

  let client: StorageClient;

  beforeEach(() => {
    jest.clearAllMocks();
    resetStorageClient();
    client = new StorageClient(mockConfig);
  });

  describe('constructor', () => {
    it('should create client with valid config', () => {
      expect(() => new StorageClient(mockConfig)).not.toThrow();
    });

    it('should throw StorageError when region is missing', () => {
      expect(() => new StorageClient({ ...mockConfig, region: undefined })).toThrow(
        StorageError
      );
      try {
        new StorageClient({ ...mockConfig, region: undefined });
      } catch (error) {
        expect(error).toBeInstanceOf(StorageError);
        expect((error as StorageError).code).toBe(StorageErrorCode.INVALID_CONFIG);
      }
    });

    it('should throw StorageError when bucketName is missing', () => {
      expect(() =>
        new StorageClient({ ...mockConfig, bucketName: undefined })
      ).toThrow(StorageError);
    });

    it('should throw StorageError when accessKeyId is missing', () => {
      expect(() =>
        new StorageClient({ ...mockConfig, accessKeyId: undefined })
      ).toThrow(StorageError);
    });

    it('should throw StorageError when secretAccessKey is missing', () => {
      expect(() =>
        new StorageClient({ ...mockConfig, secretAccessKey: undefined })
      ).toThrow(StorageError);
    });

    it('should use environment variables when config not provided', () => {
      const originalEnv = process.env;
      process.env = {
        ...originalEnv,
        AWS_REGION: 'us-west-2',
        AWS_BUCKET_NAME: 'env-bucket',
        AWS_ACCESS_KEY_ID: 'env-key',
        AWS_SECRET_ACCESS_KEY: 'env-secret',
      };

      expect(() => new StorageClient()).not.toThrow();

      process.env = originalEnv;
    });
  });

  describe('generateStorageKey', () => {
    it('should generate key with correct format', () => {
      const callId = 'test-call-123';
      const date = new Date('2024-01-15');
      const key = client.generateStorageKey(callId, date);

      expect(key).toBe('recordings/2024-01-15/test-call-123.wav');
    });

    it('should use current date when not provided', () => {
      const callId = 'test-call-456';
      const key = client.generateStorageKey(callId);

      expect(key).toMatch(/^recordings\/\d{4}-\d{2}-\d{2}\/test-call-456\.wav$/);
    });
  });

  describe('extractCallIdFromKey', () => {
    it('should extract callId from key', () => {
      const key = 'recordings/2024-01-15/my-call-id-abc.wav';
      const callId = client.extractCallIdFromKey(key);

      expect(callId).toBe('my-call-id-abc');
    });

    it('should handle keys with multiple dots', () => {
      const key = 'recordings/2024-01-15/call.id.test.wav';
      const callId = client.extractCallIdFromKey(key);

      expect(callId).toBe('call.id.test');
    });
  });

  describe('uploadRecording', () => {
    it('should upload recording successfully', async () => {
      mockSend.mockResolvedValueOnce({});

      const callId = 'upload-test-123';
      const audioBuffer = Buffer.from('test audio data');

      const result = await client.uploadRecording(callId, audioBuffer);

      expect(mockSend).toHaveBeenCalledTimes(1);
      expect(mockSend).toHaveBeenCalledWith(expect.any(PutObjectCommand));
      expect(result.key).toContain(callId);
      expect(result.size).toBe(audioBuffer.length);
      expect(result.url).toContain('test-bucket');
    });

    it('should use custom content type', async () => {
      mockSend.mockResolvedValueOnce({});

      const callId = 'upload-test-mp3';
      const audioBuffer = Buffer.from('test mp3 data');

      const result = await client.uploadRecording(callId, audioBuffer, 'audio/mpeg');

      // Verify upload was called
      expect(mockSend).toHaveBeenCalledTimes(1);
      expect(mockSend).toHaveBeenCalledWith(expect.any(PutObjectCommand));
      expect(result.key).toContain(callId);
    });

    it('should throw StorageError on upload failure', async () => {
      mockSend.mockRejectedValueOnce(new Error('Network error'));

      const callId = 'upload-fail-test';
      const audioBuffer = Buffer.from('test data');

      await expect(client.uploadRecording(callId, audioBuffer)).rejects.toThrow(
        StorageError
      );

      try {
        await client.uploadRecording(callId, audioBuffer);
      } catch (error) {
        expect(error).toBeInstanceOf(StorageError);
        expect((error as StorageError).code).toBe(StorageErrorCode.UPLOAD_FAILED);
      }
    });

    it('should handle quota exceeded error', async () => {
      mockSend.mockRejectedValueOnce(new Error('QuotaExceeded: Storage limit reached'));

      const callId = 'quota-test';
      const audioBuffer = Buffer.from('test data');

      try {
        await client.uploadRecording(callId, audioBuffer);
      } catch (error) {
        expect(error).toBeInstanceOf(StorageError);
        expect((error as StorageError).code).toBe(StorageErrorCode.QUOTA_EXCEEDED);
      }
    });

    it('should handle access denied error', async () => {
      mockSend.mockRejectedValueOnce(new Error('AccessDenied: Permission denied'));

      const callId = 'access-test';
      const audioBuffer = Buffer.from('test data');

      try {
        await client.uploadRecording(callId, audioBuffer);
      } catch (error) {
        expect(error).toBeInstanceOf(StorageError);
        expect((error as StorageError).code).toBe(StorageErrorCode.ACCESS_DENIED);
      }
    });
  });

  describe('getRecordingUrl', () => {
    it('should generate signed URL successfully', async () => {
      mockSend.mockResolvedValueOnce({}); // HeadObject
      mockGetSignedUrl.mockResolvedValueOnce('https://signed-url.example.com/test');

      const callId = 'url-test-123';
      const url = await client.getRecordingUrl(callId);

      expect(mockSend).toHaveBeenCalledWith(expect.any(HeadObjectCommand));
      expect(mockGetSignedUrl).toHaveBeenCalled();
      expect(url).toBe('https://signed-url.example.com/test');
    });

    it('should use custom expiration time', async () => {
      mockSend.mockResolvedValueOnce({});
      mockGetSignedUrl.mockResolvedValueOnce('https://signed-url.example.com/custom');

      const callId = 'url-test-expiry';
      await client.getRecordingUrl(callId, 7200);

      expect(mockGetSignedUrl).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        { expiresIn: 7200 }
      );
    });

    it('should throw NOT_FOUND when recording does not exist', async () => {
      mockSend.mockRejectedValueOnce(new Error('NotFound: Object not found'));

      const callId = 'not-found-test';

      try {
        await client.getRecordingUrl(callId);
      } catch (error) {
        expect(error).toBeInstanceOf(StorageError);
        expect((error as StorageError).code).toBe(StorageErrorCode.NOT_FOUND);
      }
    });
  });

  describe('deleteRecording', () => {
    it('should delete recording successfully', async () => {
      mockSend.mockResolvedValueOnce({});

      const callId = 'delete-test-123';
      await expect(client.deleteRecording(callId)).resolves.not.toThrow();

      expect(mockSend).toHaveBeenCalledWith(expect.any(DeleteObjectCommand));
    });

    it('should not throw when file does not exist (S3 behavior)', async () => {
      mockSend.mockResolvedValueOnce({});

      const callId = 'non-existent-call';
      await expect(client.deleteRecording(callId)).resolves.not.toThrow();
    });

    it('should throw on access denied', async () => {
      mockSend.mockRejectedValueOnce(new Error('AccessDenied'));

      const callId = 'delete-denied-test';

      try {
        await client.deleteRecording(callId);
      } catch (error) {
        expect(error).toBeInstanceOf(StorageError);
        expect((error as StorageError).code).toBe(StorageErrorCode.ACCESS_DENIED);
      }
    });
  });

  describe('listRecordings', () => {
    it('should list recordings with default options', async () => {
      mockSend.mockResolvedValueOnce({
        Contents: [
          {
            Key: 'recordings/2024-01-15/call-1.wav',
            Size: 1024,
            LastModified: new Date('2024-01-15T10:00:00Z'),
          },
          {
            Key: 'recordings/2024-01-16/call-2.wav',
            Size: 2048,
            LastModified: new Date('2024-01-16T10:00:00Z'),
          },
        ],
        IsTruncated: false,
      });

      const result = await client.listRecordings();

      expect(result.recordings).toHaveLength(2);
      expect(result.recordings[0].callId).toBe('call-1');
      expect(result.recordings[1].callId).toBe('call-2');
      expect(result.isTruncated).toBe(false);
      expect(result.count).toBe(2);
    });

    it('should handle pagination', async () => {
      mockSend.mockResolvedValueOnce({
        Contents: [
          {
            Key: 'recordings/2024-01-15/call-3.wav',
            Size: 512,
            LastModified: new Date(),
          },
        ],
        IsTruncated: true,
        NextContinuationToken: 'next-token-abc',
      });

      const result = await client.listRecordings({
        maxKeys: 1,
        continuationToken: 'prev-token',
      });

      expect(result.isTruncated).toBe(true);
      expect(result.nextContinuationToken).toBe('next-token-abc');
    });

    it('should filter by prefix', async () => {
      mockSend.mockResolvedValueOnce({
        Contents: [],
        IsTruncated: false,
      });

      const result = await client.listRecordings({ prefix: '2024-01-15/' });

      // Verify list was called and returns expected structure
      expect(mockSend).toHaveBeenCalledTimes(1);
      expect(mockSend).toHaveBeenCalledWith(expect.any(ListObjectsV2Command));
      expect(result.recordings).toEqual([]);
      expect(result.isTruncated).toBe(false);
    });

    it('should filter out non-wav files', async () => {
      mockSend.mockResolvedValueOnce({
        Contents: [
          { Key: 'recordings/2024-01-15/call-1.wav', Size: 1024, LastModified: new Date() },
          { Key: 'recordings/2024-01-15/call-1.json', Size: 100, LastModified: new Date() },
          { Key: 'recordings/2024-01-15/call-2.wav', Size: 2048, LastModified: new Date() },
        ],
        IsTruncated: false,
      });

      const result = await client.listRecordings();

      expect(result.recordings).toHaveLength(2);
      expect(result.recordings.every((r) => r.key.endsWith('.wav'))).toBe(true);
    });

    it('should handle empty results', async () => {
      mockSend.mockResolvedValueOnce({
        Contents: [],
        IsTruncated: false,
      });

      const result = await client.listRecordings();

      expect(result.recordings).toHaveLength(0);
      expect(result.count).toBe(0);
    });

    it('should throw on access denied', async () => {
      mockSend.mockRejectedValueOnce(new Error('AccessDenied'));

      try {
        await client.listRecordings();
      } catch (error) {
        expect(error).toBeInstanceOf(StorageError);
        expect((error as StorageError).code).toBe(StorageErrorCode.ACCESS_DENIED);
      }
    });
  });

  describe('recordingExists', () => {
    it('should return true when recording exists', async () => {
      mockSend.mockResolvedValueOnce({});

      const exists = await client.recordingExists('existing-call');

      expect(exists).toBe(true);
    });

    it('should return false when recording does not exist', async () => {
      mockSend.mockRejectedValueOnce(new Error('NotFound'));

      const exists = await client.recordingExists('non-existent-call');

      expect(exists).toBe(false);
    });
  });

  describe('getRecordingMetadata', () => {
    it('should return metadata for existing recording', async () => {
      mockSend.mockResolvedValueOnce({
        ContentLength: 4096,
        ContentType: 'audio/wav',
        LastModified: new Date('2024-01-20T12:00:00Z'),
      });

      const metadata = await client.getRecordingMetadata('metadata-test');

      expect(metadata.size).toBe(4096);
      expect(metadata.contentType).toBe('audio/wav');
      expect(metadata.callId).toBe('metadata-test');
    });

    it('should throw NOT_FOUND for non-existent recording', async () => {
      mockSend.mockRejectedValueOnce(new Error('NotFound'));

      try {
        await client.getRecordingMetadata('non-existent');
      } catch (error) {
        expect(error).toBeInstanceOf(StorageError);
        expect((error as StorageError).code).toBe(StorageErrorCode.NOT_FOUND);
      }
    });
  });

  describe('downloadRecording', () => {
    it('should download recording as buffer', async () => {
      const testData = Buffer.from('audio data content');

      // Create async iterable mock
      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield testData;
        },
      };

      mockSend.mockResolvedValueOnce({
        Body: mockStream,
      });

      const buffer = await client.downloadRecording('download-test');

      expect(buffer.toString()).toBe('audio data content');
    });

    it('should throw NOT_FOUND for non-existent recording', async () => {
      mockSend.mockRejectedValueOnce(new Error('NoSuchKey'));

      try {
        await client.downloadRecording('non-existent');
      } catch (error) {
        expect(error).toBeInstanceOf(StorageError);
        expect((error as StorageError).code).toBe(StorageErrorCode.NOT_FOUND);
      }
    });

    it('should throw DOWNLOAD_FAILED for empty body', async () => {
      mockSend.mockResolvedValueOnce({
        Body: undefined,
      });

      await expect(client.downloadRecording('empty-body-test')).rejects.toThrow(
        StorageError
      );
    });
  });
});

describe('Singleton', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    resetStorageClient();
    process.env = {
      ...originalEnv,
      AWS_REGION: 'us-east-1',
      AWS_BUCKET_NAME: 'test-bucket',
      AWS_ACCESS_KEY_ID: 'test-key',
      AWS_SECRET_ACCESS_KEY: 'test-secret',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should return same instance on multiple calls', () => {
    const instance1 = getStorageClient();
    const instance2 = getStorageClient();

    expect(instance1).toBe(instance2);
  });

  it('should create new instance after reset', () => {
    const instance1 = getStorageClient();
    resetStorageClient();
    const instance2 = getStorageClient();

    expect(instance1).not.toBe(instance2);
  });
});

describe('StorageError', () => {
  it('should create error with correct properties', () => {
    const cause = new Error('Original error');
    const error = new StorageError(
      'Test error message',
      StorageErrorCode.UPLOAD_FAILED,
      cause
    );

    expect(error.message).toBe('Test error message');
    expect(error.code).toBe(StorageErrorCode.UPLOAD_FAILED);
    expect(error.cause).toBe(cause);
    expect(error.name).toBe('StorageError');
  });

  it('should work without cause', () => {
    const error = new StorageError('Simple error', StorageErrorCode.NOT_FOUND);

    expect(error.message).toBe('Simple error');
    expect(error.code).toBe(StorageErrorCode.NOT_FOUND);
    expect(error.cause).toBeUndefined();
  });
});
