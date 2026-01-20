/**
 * Tests for Recording Complete Webhook Handler
 *
 * These tests verify the webhook handler correctly:
 * - Validates Twilio signatures
 * - Handles completed recordings
 * - Handles failed recordings
 * - Handles edge cases gracefully
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '../route';

// Mock the dependencies
vi.mock('@/lib/twilio', () => ({
  validateTwilioSignature: vi.fn(),
  parseTwilioWebhookBody: vi.fn(),
  getTwilioClient: vi.fn(),
}));

vi.mock('@/lib/storage', () => ({
  getStorageClient: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  prisma: {
    call: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

// Import mocked modules
import {
  validateTwilioSignature,
  parseTwilioWebhookBody,
  getTwilioClient,
} from '@/lib/twilio';
import { getStorageClient } from '@/lib/storage';
import { prisma } from '@/lib/db';

// Type the mocks
const mockValidateSignature = vi.mocked(validateTwilioSignature);
const mockParseBody = vi.mocked(parseTwilioWebhookBody);
const mockGetTwilioClient = vi.mocked(getTwilioClient);
const mockGetStorageClient = vi.mocked(getStorageClient);
const mockPrismaCall = vi.mocked(prisma.call);

// Mock fetch for downloading recordings
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('Recording Webhook Handler', () => {
  const mockRequest = {} as NextRequest;

  const baseRecordingPayload = {
    AccountSid: 'AC123456789',
    CallSid: 'CA123456789',
    RecordingSid: 'RE123456789',
    RecordingUrl: 'https://api.twilio.com/recordings/RE123456789',
    RecordingStatus: 'completed',
    RecordingDuration: '120',
    RecordingChannels: '1',
    RecordingSource: 'RecordVerb',
  };

  const mockCall = {
    id: 'call-123',
    twilioSid: 'CA123456789',
    fromNumber: '+15551234567',
    toNumber: '+15559876543',
    status: 'IN_PROGRESS',
    duration: null,
    recordingUrl: null,
    transcriptUrl: null,
    rating: null,
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockRecordingDetails = {
    sid: 'RE123456789',
    callSid: 'CA123456789',
    status: 'completed',
    duration: 120,
    url: '/2010-04-01/Accounts/AC123/Recordings/RE123456789',
    mediaUrl: 'https://api.twilio.com/2010-04-01/Accounts/AC123/Recordings/RE123456789.mp3',
  };

  const mockUploadResult = {
    key: 'recordings/2024-01-19/call-123.wav',
    url: 'https://bucket.s3.amazonaws.com/recordings/2024-01-19/call-123.wav',
    size: 1024000,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Set up environment variables
    process.env.TWILIO_ACCOUNT_SID = 'AC123456789';
    process.env.TWILIO_AUTH_TOKEN = 'test-auth-token';

    // Default mock implementations
    mockParseBody.mockResolvedValue(baseRecordingPayload as Record<string, string>);
    mockValidateSignature.mockResolvedValue(true);
  });

  afterEach(() => {
    delete process.env.TWILIO_ACCOUNT_SID;
    delete process.env.TWILIO_AUTH_TOKEN;
  });

  describe('Signature Validation', () => {
    it('should reject requests with invalid signatures', async () => {
      mockValidateSignature.mockResolvedValue(false);

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('Invalid signature');
    });

    it('should accept requests with valid signatures', async () => {
      mockValidateSignature.mockResolvedValue(true);
      mockPrismaCall.findUnique.mockResolvedValue(null);

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });

  describe('Recording Completed', () => {
    it('should process completed recordings successfully', async () => {
      // Set up mocks for successful flow
      mockPrismaCall.findUnique.mockResolvedValue(mockCall);
      mockGetTwilioClient.mockReturnValue({
        getRecording: vi.fn().mockResolvedValue(mockRecordingDetails),
      } as unknown as ReturnType<typeof getTwilioClient>);

      mockFetch.mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024)),
      });

      mockGetStorageClient.mockReturnValue({
        uploadRecording: vi.fn().mockResolvedValue(mockUploadResult),
      } as unknown as ReturnType<typeof getStorageClient>);

      mockPrismaCall.update.mockResolvedValue({ ...mockCall, recordingUrl: mockUploadResult.url });

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockPrismaCall.update).toHaveBeenCalledWith({
        where: { id: 'call-123' },
        data: {
          recordingUrl: mockUploadResult.url,
          duration: 120,
        },
      });
    });

    it('should skip processing if recording URL already exists', async () => {
      mockPrismaCall.findUnique.mockResolvedValue({
        ...mockCall,
        recordingUrl: 'https://existing-url.com/recording.wav',
      });

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockPrismaCall.update).not.toHaveBeenCalled();
    });

    it('should handle missing call gracefully', async () => {
      mockPrismaCall.findUnique.mockResolvedValue(null);

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockGetStorageClient).not.toHaveBeenCalled();
    });
  });

  describe('Recording Failed', () => {
    it('should handle failed recordings', async () => {
      mockParseBody.mockResolvedValue({
        ...baseRecordingPayload,
        RecordingStatus: 'failed',
        ErrorCode: '12345',
      } as Record<string, string>);

      mockPrismaCall.findUnique.mockResolvedValue(mockCall);
      mockPrismaCall.update.mockResolvedValue({ ...mockCall, notes: 'Recording failed (Error: 12345)' });

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockPrismaCall.update).toHaveBeenCalledWith({
        where: { id: 'call-123' },
        data: {
          notes: 'Recording failed (Error: 12345)',
        },
      });
    });

    it('should append to existing notes when recording fails', async () => {
      mockParseBody.mockResolvedValue({
        ...baseRecordingPayload,
        RecordingStatus: 'failed',
        ErrorCode: '12345',
      } as Record<string, string>);

      mockPrismaCall.findUnique.mockResolvedValue({
        ...mockCall,
        notes: 'Existing note',
      });
      mockPrismaCall.update.mockResolvedValue({
        ...mockCall,
        notes: 'Existing note\nRecording failed (Error: 12345)',
      });

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(mockPrismaCall.update).toHaveBeenCalledWith({
        where: { id: 'call-123' },
        data: {
          notes: 'Existing note\nRecording failed (Error: 12345)',
        },
      });
    });
  });

  describe('Other Recording Statuses', () => {
    it('should handle in-progress status', async () => {
      mockParseBody.mockResolvedValue({
        ...baseRecordingPayload,
        RecordingStatus: 'in-progress',
      } as Record<string, string>);

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockPrismaCall.findUnique).not.toHaveBeenCalled();
    });

    it('should handle absent status', async () => {
      mockParseBody.mockResolvedValue({
        ...baseRecordingPayload,
        RecordingStatus: 'absent',
      } as Record<string, string>);

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockPrismaCall.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should return 200 even when errors occur to prevent Twilio retries', async () => {
      mockPrismaCall.findUnique.mockRejectedValue(new Error('Database error'));

      const response = await POST(mockRequest);

      expect(response.status).toBe(200);
    });

    it('should handle Twilio recording fetch errors', async () => {
      mockPrismaCall.findUnique.mockResolvedValue(mockCall);
      mockGetTwilioClient.mockReturnValue({
        getRecording: vi.fn().mockRejectedValue(new Error('Twilio error')),
      } as unknown as ReturnType<typeof getTwilioClient>);

      const response = await POST(mockRequest);

      expect(response.status).toBe(200);
    });

    it('should handle storage upload errors', async () => {
      mockPrismaCall.findUnique.mockResolvedValue(mockCall);
      mockGetTwilioClient.mockReturnValue({
        getRecording: vi.fn().mockResolvedValue(mockRecordingDetails),
      } as unknown as ReturnType<typeof getTwilioClient>);

      mockFetch.mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024)),
      });

      mockGetStorageClient.mockReturnValue({
        uploadRecording: vi.fn().mockRejectedValue(new Error('S3 error')),
      } as unknown as ReturnType<typeof getStorageClient>);

      const response = await POST(mockRequest);

      expect(response.status).toBe(200);
    });
  });
});
