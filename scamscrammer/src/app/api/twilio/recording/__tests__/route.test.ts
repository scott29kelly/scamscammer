/**
 * Recording Complete Webhook Handler Tests
 */

import { NextRequest } from 'next/server';
import { POST } from '../route';
import prisma from '@/lib/db';
import { CallStatus } from '@prisma/client';

// Mock the Prisma client
jest.mock('@/lib/db', () => ({
  __esModule: true,
  default: {
    call: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  },
}));

// Mock the Twilio client
const mockTwilioClientInstance = {
  getAuthToken: jest.fn().mockReturnValue('test-auth-token'),
  getRecording: jest.fn(),
  fetchRecordingAudio: jest.fn().mockResolvedValue(Buffer.from('fake-audio-data')),
};

jest.mock('@/lib/twilio', () => ({
  __esModule: true,
  TwilioClient: jest.fn().mockImplementation(() => mockTwilioClientInstance),
  createTwilioClient: jest.fn().mockImplementation(() => mockTwilioClientInstance),
  validateTwilioSignature: jest.fn().mockReturnValue(true),
}));

// Mock the Storage client
jest.mock('@/lib/storage', () => ({
  __esModule: true,
  StorageClient: jest.fn().mockImplementation(() => ({
    uploadRecording: jest.fn(),
  })),
  generateStorageKey: jest.fn().mockReturnValue('recordings/2026/01/19/CA123/RE456.mp3'),
}));

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

// Import mocked modules for manipulation
import { TwilioClient, createTwilioClient, validateTwilioSignature } from '@/lib/twilio';
import { StorageClient } from '@/lib/storage';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const mockTwilioClient = TwilioClient as jest.MockedClass<typeof TwilioClient>;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const mockCreateTwilioClient = createTwilioClient as jest.MockedFunction<typeof createTwilioClient>;
const mockStorageClient = StorageClient as jest.MockedClass<typeof StorageClient>;
const mockValidateSignature = validateTwilioSignature as jest.MockedFunction<
  typeof validateTwilioSignature
>;

/**
 * Helper to create a mock NextRequest with form data
 */
function createMockRequest(params: Record<string, string>): NextRequest {
  const body = Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');

  return new NextRequest('https://example.com/api/twilio/recording', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-Twilio-Signature': 'test-signature',
    },
    body,
  });
}

describe('POST /api/twilio/recording', () => {
  const mockCall = {
    id: 'cltest123',
    twilioSid: 'CA123',
    fromNumber: '+15551234567',
    toNumber: '+15559876543',
    status: CallStatus.COMPLETED,
    duration: null,
    recordingUrl: null,
    transcriptUrl: null,
    rating: null,
    notes: null,
    tags: [],
    createdAt: new Date('2026-01-19T10:00:00Z'),
    updatedAt: new Date('2026-01-19T10:00:00Z'),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset the default mock implementations
    mockTwilioClientInstance.getAuthToken.mockReturnValue('test-auth-token');
    mockTwilioClientInstance.fetchRecordingAudio.mockResolvedValue(Buffer.from('fake-audio-data'));

    mockStorageClient.mockImplementation(
      () =>
        ({
          uploadRecording: jest.fn().mockResolvedValue({
            url: 'https://s3.example.com/recordings/2026/01/19/CA123/RE456.mp3',
            key: 'recordings/2026/01/19/CA123/RE456.mp3',
            bucket: 'scamscrammer-recordings',
          }),
        }) as unknown as InstanceType<typeof StorageClient>
    );

    mockValidateSignature.mockReturnValue(true);
  });

  describe('completed recording', () => {
    const completedParams = {
      AccountSid: 'AC123',
      CallSid: 'CA123',
      RecordingSid: 'RE456',
      RecordingUrl: 'https://api.twilio.com/2010-04-01/Accounts/AC123/Recordings/RE456',
      RecordingStatus: 'completed',
      RecordingDuration: '120',
    };

    it('should process a completed recording successfully', async () => {
      (mockPrisma.call.findFirst as jest.Mock).mockResolvedValue(mockCall);
      (mockPrisma.call.update as jest.Mock).mockResolvedValue({
        ...mockCall,
        recordingUrl: 'https://s3.example.com/recordings/2026/01/19/CA123/RE456.mp3',
        duration: 120,
      });

      const request = createMockRequest(completedParams);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toBe('Recording processed successfully');
      expect(data.recordingUrl).toBe('https://s3.example.com/recordings/2026/01/19/CA123/RE456.mp3');

      // Verify database was updated
      expect(mockPrisma.call.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockCall.id },
          data: expect.objectContaining({
            recordingUrl: 'https://s3.example.com/recordings/2026/01/19/CA123/RE456.mp3',
          }),
        })
      );
    });

    it('should handle call not found in database', async () => {
      (mockPrisma.call.findFirst as jest.Mock).mockResolvedValue(null);

      const request = createMockRequest(completedParams);
      const response = await POST(request);
      const data = await response.json();

      // Should still return 200 to acknowledge Twilio
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toBe('Recording received but call not found in database');
    });

    it('should handle Twilio recording fetch failure', async () => {
      (mockPrisma.call.findFirst as jest.Mock).mockResolvedValue(mockCall);

      mockTwilioClientInstance.fetchRecordingAudio.mockResolvedValue(null);

      const request = createMockRequest(completedParams);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(502);
      expect(data.error).toBe('Failed to fetch recording from Twilio');
    });

    it('should handle S3 upload failure', async () => {
      (mockPrisma.call.findFirst as jest.Mock).mockResolvedValue(mockCall);

      mockStorageClient.mockImplementation(
        () =>
          ({
            uploadRecording: jest.fn().mockRejectedValue(new Error('Upload failed')),
          }) as unknown as InstanceType<typeof StorageClient>
      );

      const request = createMockRequest(completedParams);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(502);
      expect(data.error).toBe('Failed to upload recording to storage');
    });

    it('should update call duration if not already set', async () => {
      (mockPrisma.call.findFirst as jest.Mock).mockResolvedValue(mockCall);
      (mockPrisma.call.update as jest.Mock).mockResolvedValue({
        ...mockCall,
        recordingUrl: 'https://s3.example.com/recordings/2026/01/19/CA123/RE456.mp3',
        duration: 120,
      });

      const request = createMockRequest(completedParams);
      await POST(request);

      expect(mockPrisma.call.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            duration: 120,
          }),
        })
      );
    });

    it('should not overwrite existing duration', async () => {
      const callWithDuration = { ...mockCall, duration: 100 };
      (mockPrisma.call.findFirst as jest.Mock).mockResolvedValue(callWithDuration);
      (mockPrisma.call.update as jest.Mock).mockResolvedValue({
        ...callWithDuration,
        recordingUrl: 'https://s3.example.com/recordings/2026/01/19/CA123/RE456.mp3',
      });

      const request = createMockRequest(completedParams);
      await POST(request);

      // Duration should not be in the update call
      expect(mockPrisma.call.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.not.objectContaining({
            duration: expect.anything(),
          }),
        })
      );
    });
  });

  describe('failed recording', () => {
    it('should acknowledge failed recording status', async () => {
      const request = createMockRequest({
        AccountSid: 'AC123',
        CallSid: 'CA123',
        RecordingSid: 'RE456',
        RecordingUrl: '',
        RecordingStatus: 'failed',
        ErrorCode: '12345',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toBe('Recording failure acknowledged');
    });
  });

  describe('in-progress recording', () => {
    it('should acknowledge in-progress recording status', async () => {
      const request = createMockRequest({
        AccountSid: 'AC123',
        CallSid: 'CA123',
        RecordingSid: 'RE456',
        RecordingUrl: '',
        RecordingStatus: 'in-progress',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toBe('Recording in progress acknowledged');
    });
  });

  describe('absent recording', () => {
    it('should acknowledge absent recording status', async () => {
      const request = createMockRequest({
        AccountSid: 'AC123',
        CallSid: 'CA123',
        RecordingSid: 'RE456',
        RecordingUrl: '',
        RecordingStatus: 'absent',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toBe('Recording absent acknowledged');
    });
  });

  describe('validation', () => {
    it('should return 400 for missing CallSid', async () => {
      const request = createMockRequest({
        AccountSid: 'AC123',
        RecordingSid: 'RE456',
        RecordingUrl: '',
        RecordingStatus: 'completed',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Missing required fields: CallSid or RecordingSid');
    });

    it('should return 400 for missing RecordingSid', async () => {
      const request = createMockRequest({
        AccountSid: 'AC123',
        CallSid: 'CA123',
        RecordingUrl: '',
        RecordingStatus: 'completed',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Missing required fields: CallSid or RecordingSid');
    });

    it('should return 403 for invalid signature in production', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.VALIDATE_TWILIO_SIGNATURE = 'true';
      mockValidateSignature.mockReturnValue(false);

      const request = createMockRequest({
        AccountSid: 'AC123',
        CallSid: 'CA123',
        RecordingSid: 'RE456',
        RecordingUrl: '',
        RecordingStatus: 'completed',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('Invalid request signature');

      process.env.NODE_ENV = originalEnv;
      delete process.env.VALIDATE_TWILIO_SIGNATURE;
    });
  });

  describe('error handling', () => {
    it('should return 500 on unexpected errors', async () => {
      (mockPrisma.call.findFirst as jest.Mock).mockRejectedValue(new Error('Database error'));

      const request = createMockRequest({
        AccountSid: 'AC123',
        CallSid: 'CA123',
        RecordingSid: 'RE456',
        RecordingUrl: 'https://api.twilio.com/recordings/RE456',
        RecordingStatus: 'completed',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Internal server error processing recording');
    });

    it('should handle unknown recording status gracefully', async () => {
      const request = createMockRequest({
        AccountSid: 'AC123',
        CallSid: 'CA123',
        RecordingSid: 'RE456',
        RecordingUrl: '',
        RecordingStatus: 'unknown-status',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toBe('Unknown status acknowledged');
    });
  });
});
