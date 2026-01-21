/**
 * Tests for Storage Service for Call Recordings
 */

import {
  S3Client,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  StorageClient,
  StorageError,
  getStorageClient,
  storage,
} from '../storage';

// Mock AWS SDK
jest.mock('@aws-sdk/client-s3');
jest.mock('@aws-sdk/s3-request-presigner');

const MockedS3Client = S3Client as jest.MockedClass<typeof S3Client>;
const mockedGetSignedUrl = getSignedUrl as jest.MockedFunction<typeof getSignedUrl>;

describe('Storage Service for Recordings', () => {
  const originalEnv = process.env;
  let mockSend: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset environment variables
    process.env = {
      ...originalEnv,
      AWS_REGION: 'us-east-1',
      AWS_BUCKET_NAME: 'test-bucket',
      AWS_ACCESS_KEY_ID: 'test-key',
      AWS_SECRET_ACCESS_KEY: 'test-secret',
    };

    // Reset singleton
    const globalForStorage = globalThis as unknown as {
      storageClient: StorageClient | undefined;
    };
    globalForStorage.storageClient = undefined;

    // Mock S3 client send method
    mockSend = jest.fn();
    MockedS3Client.mockImplementation(() => ({
      send: mockSend,
      destroy: jest.fn(),
      config: {},
    } as unknown as S3Client));
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('StorageClient constructor', () => {
    it('should create a client with environment variables', () => {
      const client = new StorageClient();
      expect(MockedS3Client).toHaveBeenCalledWith({
        region: 'us-east-1',
        credentials: {
          accessKeyId: 'test-key',
          secretAccessKey: 'test-secret',
        },
      });
      expect(client).toBeDefined();
    });

    it('should allow config override', () => {
      const client = new StorageClient({
        region: 'eu-west-1',
        bucket: 'custom-bucket',
      });
      expect(MockedS3Client).toHaveBeenCalledWith({
        region: 'eu-west-1',
        credentials: {
          accessKeyId: 'test-key',
          secretAccessKey: 'test-secret',
        },
      });
      expect(client).toBeDefined();
    });

    it('should throw error if AWS_REGION is not set', () => {
      delete process.env.AWS_REGION;
      expect(() => new StorageClient()).toThrow(StorageError);
      expect(() => new StorageClient()).toThrow('AWS_REGION environment variable is not set');
    });

    it('should throw error if AWS_BUCKET_NAME is not set', () => {
      delete process.env.AWS_BUCKET_NAME;
      expect(() => new StorageClient()).toThrow(StorageError);
      expect(() => new StorageClient()).toThrow('AWS_BUCKET_NAME environment variable is not set');
    });

    it('should work without explicit credentials (for IAM roles)', () => {
      delete process.env.AWS_ACCESS_KEY_ID;
      delete process.env.AWS_SECRET_ACCESS_KEY;

      const client = new StorageClient();
      expect(client).toBeDefined();
      expect(MockedS3Client).toHaveBeenCalledWith({
        region: 'us-east-1',
      });
    });
  });

  describe('generateStorageKey()', () => {
    it('should generate a key with date-based partitioning', () => {
      const client = new StorageClient();
      const key = client.generateStorageKey('call-123');

      expect(key).toMatch(/^recordings\/\d{4}\/\d{2}\/\d{2}\/call-123\.wav$/);
    });

    it('should use custom extension', () => {
      const client = new StorageClient();
      const key = client.generateStorageKey('call-123', 'mp3');

      expect(key).toMatch(/^recordings\/\d{4}\/\d{2}\/\d{2}\/call-123\.mp3$/);
    });
  });

  describe('extractCallIdFromKey()', () => {
    it('should extract call ID from storage key', () => {
      const client = new StorageClient();
      const callId = client.extractCallIdFromKey('recordings/2024/01/15/call-123.wav');

      expect(callId).toBe('call-123');
    });

    it('should handle keys without extension', () => {
      const client = new StorageClient();
      const callId = client.extractCallIdFromKey('recordings/2024/01/15/call-123');

      expect(callId).toBe('call-123');
    });
  });

  describe('uploadRecording()', () => {
    it('should upload a recording successfully', async () => {
      mockSend.mockResolvedValueOnce({});

      const client = new StorageClient();
      const buffer = Buffer.from('test audio data');
      const result = await client.uploadRecording('call-123', buffer);

      expect(mockSend).toHaveBeenCalledTimes(1);
      expect(result.bucket).toBe('test-bucket');
      expect(result.key).toMatch(/call-123\.wav$/);
      expect(result.location).toContain('test-bucket');
    });

    it('should use custom content type and derive extension', async () => {
      mockSend.mockResolvedValueOnce({});

      const client = new StorageClient();
      const buffer = Buffer.from('test audio data');
      const result = await client.uploadRecording('call-123', buffer, 'audio/mpeg');

      expect(result.key).toMatch(/call-123\.mp3$/);
    });

    it('should throw StorageError on upload failure', async () => {
      mockSend.mockRejectedValue(new Error('Network error'));

      const client = new StorageClient();
      const buffer = Buffer.from('test audio data');

      await expect(client.uploadRecording('call-123', buffer)).rejects.toThrow(StorageError);

      try {
        await client.uploadRecording('call-456', buffer);
      } catch (error) {
        expect((error as StorageError).code).toBe('UPLOAD_ERROR');
      }
    });
  });

  describe('getRecordingUrl()', () => {
    it('should generate a signed URL for existing recording', async () => {
      // Mock findRecordingKey (listObjects)
      mockSend.mockResolvedValueOnce({
        Contents: [{ Key: 'recordings/2024/01/15/call-123.wav' }],
      });

      mockedGetSignedUrl.mockResolvedValueOnce('https://signed-url.example.com');

      const client = new StorageClient();
      const url = await client.getRecordingUrl('call-123');

      expect(url).toBe('https://signed-url.example.com');
      expect(mockedGetSignedUrl).toHaveBeenCalledWith(
        expect.anything(),
        expect.any(GetObjectCommand),
        { expiresIn: 3600 }
      );
    });

    it('should use custom expiration time', async () => {
      mockSend.mockResolvedValueOnce({
        Contents: [{ Key: 'recordings/2024/01/15/call-123.wav' }],
      });

      mockedGetSignedUrl.mockResolvedValueOnce('https://signed-url.example.com');

      const client = new StorageClient();
      await client.getRecordingUrl('call-123', 7200);

      expect(mockedGetSignedUrl).toHaveBeenCalledWith(
        expect.anything(),
        expect.any(GetObjectCommand),
        { expiresIn: 7200 }
      );
    });

    it('should throw NOT_FOUND error if recording does not exist', async () => {
      mockSend.mockResolvedValue({ Contents: [] });

      const client = new StorageClient();

      await expect(client.getRecordingUrl('nonexistent')).rejects.toThrow(StorageError);

      try {
        await client.getRecordingUrl('nonexistent-2');
      } catch (error) {
        expect((error as StorageError).code).toBe('NOT_FOUND');
      }
    });

    it('should throw URL_ERROR on signed URL generation failure', async () => {
      // Always return the recording as found
      mockSend.mockResolvedValue({
        Contents: [{ Key: 'recordings/2024/01/15/call-123.wav' }],
      });

      mockedGetSignedUrl.mockRejectedValue(new Error('Signing error'));

      const client = new StorageClient();

      try {
        await client.getRecordingUrl('call-123');
        fail('Expected error to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(StorageError);
        expect((error as StorageError).code).toBe('URL_ERROR');
      }
    });
  });

  describe('deleteRecording()', () => {
    it('should delete an existing recording', async () => {
      // Mock findRecordingKey
      mockSend.mockResolvedValueOnce({
        Contents: [{ Key: 'recordings/2024/01/15/call-123.wav' }],
      });
      // Mock delete
      mockSend.mockResolvedValueOnce({});

      const client = new StorageClient();
      const result = await client.deleteRecording('call-123');

      expect(result).toBe(true);
      expect(mockSend).toHaveBeenCalledTimes(2);
    });

    it('should return false if recording does not exist', async () => {
      mockSend.mockResolvedValueOnce({ Contents: [] });

      const client = new StorageClient();
      const result = await client.deleteRecording('nonexistent');

      expect(result).toBe(false);
      expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it('should throw StorageError on delete failure', async () => {
      mockSend.mockResolvedValueOnce({
        Contents: [{ Key: 'recordings/2024/01/15/call-123.wav' }],
      });
      mockSend.mockRejectedValue(new Error('Delete error'));

      const client = new StorageClient();

      await expect(client.deleteRecording('call-123')).rejects.toThrow(StorageError);

      // Reset mocks for second attempt
      mockSend.mockReset();
      mockSend.mockResolvedValueOnce({
        Contents: [{ Key: 'recordings/2024/01/15/call-456.wav' }],
      });
      mockSend.mockRejectedValue(new Error('Delete error'));

      try {
        await client.deleteRecording('call-456');
      } catch (error) {
        expect((error as StorageError).code).toBe('DELETE_ERROR');
      }
    });
  });

  describe('listRecordings()', () => {
    it('should list recordings with default options', async () => {
      const now = new Date();
      mockSend.mockResolvedValueOnce({
        Contents: [
          { Key: 'recordings/2024/01/15/call-1.wav', Size: 1000, LastModified: now },
          { Key: 'recordings/2024/01/15/call-2.mp3', Size: 2000, LastModified: now },
        ],
        IsTruncated: false,
      });

      const client = new StorageClient();
      const result = await client.listRecordings();

      expect(result.recordings).toHaveLength(2);
      expect(result.recordings[0].callId).toBe('call-1');
      expect(result.recordings[0].contentType).toBe('audio/wav');
      expect(result.recordings[1].callId).toBe('call-2');
      expect(result.recordings[1].contentType).toBe('audio/mpeg');
      expect(result.hasMore).toBe(false);
    });

    it('should handle pagination', async () => {
      mockSend.mockResolvedValueOnce({
        Contents: [
          { Key: 'recordings/2024/01/15/call-1.wav', Size: 1000, LastModified: new Date() },
        ],
        IsTruncated: true,
        NextContinuationToken: 'token123',
      });

      const client = new StorageClient();
      const result = await client.listRecordings({ limit: 1 });

      expect(result.recordings).toHaveLength(1);
      expect(result.hasMore).toBe(true);
      expect(result.nextToken).toBe('token123');
    });

    it('should use continuation token', async () => {
      mockSend.mockResolvedValueOnce({
        Contents: [
          { Key: 'recordings/2024/01/15/call-2.wav', Size: 1000, LastModified: new Date() },
        ],
        IsTruncated: false,
      });

      const client = new StorageClient();
      const result = await client.listRecordings({ continuationToken: 'token123' });

      expect(result.recordings).toHaveLength(1);
      expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it('should throw StorageError on list failure', async () => {
      mockSend.mockRejectedValue(new Error('List error'));

      const client = new StorageClient();

      await expect(client.listRecordings()).rejects.toThrow(StorageError);

      try {
        await client.listRecordings();
      } catch (error) {
        expect((error as StorageError).code).toBe('LIST_ERROR');
      }
    });
  });

  describe('recordingExists()', () => {
    it('should return true for existing recording', async () => {
      mockSend.mockResolvedValueOnce({
        Contents: [{ Key: 'recordings/2024/01/15/call-123.wav' }],
      });

      const client = new StorageClient();
      const exists = await client.recordingExists('call-123');

      expect(exists).toBe(true);
    });

    it('should return false for non-existing recording', async () => {
      mockSend.mockResolvedValueOnce({ Contents: [] });

      const client = new StorageClient();
      const exists = await client.recordingExists('nonexistent');

      expect(exists).toBe(false);
    });
  });

  describe('getRecordingMetadata()', () => {
    it('should return metadata for existing recording', async () => {
      const now = new Date();
      mockSend.mockResolvedValueOnce({
        Contents: [{ Key: 'recordings/2024/01/15/call-123.wav' }],
      });
      mockSend.mockResolvedValueOnce({
        ContentLength: 5000,
        ContentType: 'audio/wav',
        LastModified: now,
      });

      const client = new StorageClient();
      const metadata = await client.getRecordingMetadata('call-123');

      expect(metadata).toEqual({
        key: 'recordings/2024/01/15/call-123.wav',
        callId: 'call-123',
        size: 5000,
        contentType: 'audio/wav',
        lastModified: now,
      });
    });

    it('should return null for non-existing recording', async () => {
      mockSend.mockResolvedValueOnce({ Contents: [] });

      const client = new StorageClient();
      const metadata = await client.getRecordingMetadata('nonexistent');

      expect(metadata).toBeNull();
    });

    it('should throw StorageError on metadata fetch failure', async () => {
      mockSend.mockResolvedValueOnce({
        Contents: [{ Key: 'recordings/2024/01/15/call-123.wav' }],
      });
      mockSend.mockRejectedValue(new Error('Metadata error'));

      const client = new StorageClient();

      await expect(client.getRecordingMetadata('call-123')).rejects.toThrow(StorageError);

      // Reset mocks for second attempt
      mockSend.mockReset();
      mockSend.mockResolvedValueOnce({
        Contents: [{ Key: 'recordings/2024/01/15/call-456.wav' }],
      });
      mockSend.mockRejectedValue(new Error('Metadata error'));

      try {
        await client.getRecordingMetadata('call-456');
      } catch (error) {
        expect((error as StorageError).code).toBe('METADATA_ERROR');
      }
    });
  });

  describe('getStorageClient()', () => {
    it('should return a singleton instance', () => {
      const client1 = getStorageClient();
      const client2 = getStorageClient();

      expect(client1).toBe(client2);
    });
  });

  describe('storage default export', () => {
    it('should provide uploadRecording method', async () => {
      mockSend.mockResolvedValueOnce({});

      const buffer = Buffer.from('test');
      const result = await storage.uploadRecording('call-123', buffer);

      expect(result).toBeDefined();
      expect(result.key).toBeDefined();
    });

    it('should provide getRecordingUrl method', async () => {
      mockSend.mockResolvedValueOnce({
        Contents: [{ Key: 'recordings/2024/01/15/call-123.wav' }],
      });
      mockedGetSignedUrl.mockResolvedValueOnce('https://signed-url.example.com');

      const url = await storage.getRecordingUrl('call-123');

      expect(url).toBe('https://signed-url.example.com');
    });

    it('should provide deleteRecording method', async () => {
      mockSend.mockResolvedValueOnce({
        Contents: [{ Key: 'recordings/2024/01/15/call-123.wav' }],
      });
      mockSend.mockResolvedValueOnce({});

      const result = await storage.deleteRecording('call-123');

      expect(result).toBe(true);
    });

    it('should provide listRecordings method', async () => {
      mockSend.mockResolvedValueOnce({
        Contents: [],
        IsTruncated: false,
      });

      const result = await storage.listRecordings();

      expect(result.recordings).toEqual([]);
    });

    it('should provide generateStorageKey method', () => {
      const key = storage.generateStorageKey('call-123');

      expect(key).toMatch(/call-123\.wav$/);
    });

    it('should provide recordingExists method', async () => {
      mockSend.mockResolvedValueOnce({ Contents: [] });

      const exists = await storage.recordingExists('call-123');

      expect(exists).toBe(false);
    });

    it('should provide getRecordingMetadata method', async () => {
      mockSend.mockResolvedValueOnce({ Contents: [] });

      const metadata = await storage.getRecordingMetadata('call-123');

      expect(metadata).toBeNull();
    });
  });

  describe('StorageError', () => {
    it('should have correct name', () => {
      const error = new StorageError('Test error', 'TEST_CODE');
      expect(error.name).toBe('StorageError');
    });

    it('should preserve code and cause', () => {
      const cause = new Error('Original error');
      const error = new StorageError('Test error', 'TEST_CODE', cause);

      expect(error.code).toBe('TEST_CODE');
      expect(error.cause).toBe(cause);
    });
  });
});
