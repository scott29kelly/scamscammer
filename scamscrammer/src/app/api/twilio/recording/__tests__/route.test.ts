/**
 * Recording Complete Webhook Handler Tests
 */

import { POST } from '../route';
import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import * as twilioLib from '@/lib/twilio';
import * as storageLib from '@/lib/storage';
import { CallStatus } from '@prisma/client';

// Mock the dependencies
jest.mock('@/lib/db', () => ({
  __esModule: true,
  default: {
    call: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock('@/lib/twilio', () => ({
  validateTwilioSignature: jest.fn(),
  fetchRecordingAudio: jest.fn(),
}));

jest.mock('@/lib/storage', () => ({
  uploadRecording: jest.fn(),
  getRecordingUrl: jest.fn(),
}));

const mockPrisma = prisma as jest.Mocked<typeof prisma>;
const mockTwilio = twilioLib as jest.Mocked<typeof twilioLib>;
const mockStorage = storageLib as jest.Mocked<typeof storageLib>;

/**
 * Create a mock NextRequest with form-encoded body
 */
function createMockRequest(params: Record<string, string>): NextRequest {
  const body = new URLSearchParams(params).toString();
  return new NextRequest('https://example.com/api/twilio/recording', {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      'x-twilio-signature': 'valid-signature',
    },
    body,
  });
}

/**
 * Default recording webhook payload
 */
const defaultPayload = {
  AccountSid: 'AC123456',
  CallSid: 'CA123456',
  RecordingSid: 'RE123456',
  RecordingUrl: 'https://api.twilio.com/recordings/RE123456',
  RecordingStatus: 'completed',
  RecordingDuration: '120',
  RecordingChannels: '1',
  RecordingSource: 'RecordVerb',
};

/**
 * Default mock call from database
 */
const mockCall = {
  id: 'call-123',
  twilioSid: 'CA123456',
  fromNumber: '+15551234567',
  toNumber: '+15559876543',
  status: CallStatus.COMPLETED,
  duration: 120,
  recordingUrl: null,
  transcriptUrl: null,
  rating: null,
  notes: null,
  tags: [],
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('POST /api/twilio/recording', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default mocks for successful flow
    mockTwilio.validateTwilioSignature.mockReturnValue(true);
    mockTwilio.fetchRecordingAudio.mockResolvedValue(Buffer.from('fake audio'));
    mockStorage.uploadRecording.mockResolvedValue('recordings/2026/01/call-123.mp3');
    mockStorage.getRecordingUrl.mockResolvedValue('https://s3.amazonaws.com/signed-url');
    (mockPrisma.call.findUnique as jest.Mock).mockResolvedValue(mockCall);
    (mockPrisma.call.update as jest.Mock).mockResolvedValue({ ...mockCall, recordingUrl: 'https://s3.amazonaws.com/signed-url' });
  });

  describe('successful recording processing', () => {
    it('should process completed recording and update call record', async () => {
      const request = createMockRequest(defaultPayload);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({ success: true });

      // Verify Twilio audio was fetched
      expect(mockTwilio.fetchRecordingAudio).toHaveBeenCalledWith(
        'https://api.twilio.com/recordings/RE123456'
      );

      // Verify recording was uploaded to S3
      expect(mockStorage.uploadRecording).toHaveBeenCalledWith(
        'call-123',
        expect.any(Buffer)
      );

      // Verify signed URL was generated
      expect(mockStorage.getRecordingUrl).toHaveBeenCalledWith(
        'recordings/2026/01/call-123.mp3'
      );

      // Verify call was updated with recording URL
      expect(mockPrisma.call.update).toHaveBeenCalledWith({
        where: { id: 'call-123' },
        data: {
          recordingUrl: 'https://s3.amazonaws.com/signed-url',
          duration: 120,
        },
      });
    });

    it('should parse recording duration from payload', async () => {
      const request = createMockRequest({
        ...defaultPayload,
        RecordingDuration: '300',
      });

      await POST(request);

      expect(mockPrisma.call.update).toHaveBeenCalledWith({
        where: { id: 'call-123' },
        data: expect.objectContaining({
          duration: 300,
        }),
      });
    });
  });

  describe('signature validation', () => {
    it('should reject requests with invalid signature in production', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      mockTwilio.validateTwilioSignature.mockReturnValue(false);

      const request = createMockRequest(defaultPayload);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data).toEqual({ error: 'Invalid signature' });

      process.env.NODE_ENV = originalEnv;
    });

    it('should validate signature when TWILIO_AUTH_TOKEN is set', async () => {
      const originalToken = process.env.TWILIO_AUTH_TOKEN;
      process.env.TWILIO_AUTH_TOKEN = 'test-token';
      mockTwilio.validateTwilioSignature.mockReturnValue(false);

      const request = createMockRequest(defaultPayload);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data).toEqual({ error: 'Invalid signature' });

      process.env.TWILIO_AUTH_TOKEN = originalToken;
    });
  });

  describe('call not found', () => {
    it('should return success even if call is not found', async () => {
      (mockPrisma.call.findUnique as jest.Mock).mockResolvedValue(null);

      const request = createMockRequest(defaultPayload);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({ success: true });

      // Should not attempt to fetch or upload recording
      expect(mockTwilio.fetchRecordingAudio).not.toHaveBeenCalled();
      expect(mockStorage.uploadRecording).not.toHaveBeenCalled();
    });
  });

  describe('recording fetch failure', () => {
    it('should handle Twilio recording fetch failure gracefully', async () => {
      mockTwilio.fetchRecordingAudio.mockResolvedValue(null);

      const request = createMockRequest(defaultPayload);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({ success: true });

      // Should update call notes with failure message
      expect(mockPrisma.call.update).toHaveBeenCalledWith({
        where: { id: 'call-123' },
        data: {
          notes: '[Recording fetch failed]',
        },
      });

      // Should not attempt S3 upload
      expect(mockStorage.uploadRecording).not.toHaveBeenCalled();
    });

    it('should append to existing notes when fetch fails', async () => {
      (mockPrisma.call.findUnique as jest.Mock).mockResolvedValue({
        ...mockCall,
        notes: 'Existing notes',
      });
      mockTwilio.fetchRecordingAudio.mockResolvedValue(null);

      const request = createMockRequest(defaultPayload);
      await POST(request);

      expect(mockPrisma.call.update).toHaveBeenCalledWith({
        where: { id: 'call-123' },
        data: {
          notes: 'Existing notes\n[Recording fetch failed]',
        },
      });
    });
  });

  describe('S3 upload failure', () => {
    it('should handle S3 upload failure gracefully', async () => {
      mockStorage.uploadRecording.mockResolvedValue(null);

      const request = createMockRequest(defaultPayload);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({ success: true });

      // Should update call notes with failure message
      expect(mockPrisma.call.update).toHaveBeenCalledWith({
        where: { id: 'call-123' },
        data: {
          notes: '[Recording upload failed]',
        },
      });
    });
  });

  describe('recording failed status', () => {
    it('should handle failed recording status', async () => {
      const request = createMockRequest({
        ...defaultPayload,
        RecordingStatus: 'failed',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({ success: true });

      // Should not fetch or upload recording
      expect(mockTwilio.fetchRecordingAudio).not.toHaveBeenCalled();
      expect(mockStorage.uploadRecording).not.toHaveBeenCalled();

      // Should update call notes with failure message
      expect(mockPrisma.call.update).toHaveBeenCalledWith({
        where: { id: 'call-123' },
        data: {
          notes: '[Recording failed]',
        },
      });
    });
  });

  describe('URL generation failure', () => {
    it('should fallback to storage key when URL generation fails', async () => {
      mockStorage.getRecordingUrl.mockResolvedValue(null);

      const request = createMockRequest(defaultPayload);
      await POST(request);

      // Should still update with the storage key as fallback
      expect(mockPrisma.call.update).toHaveBeenCalledWith({
        where: { id: 'call-123' },
        data: {
          recordingUrl: 'recordings/2026/01/call-123.mp3',
          duration: 120,
        },
      });
    });
  });

  describe('error handling', () => {
    it('should return success even on unexpected errors', async () => {
      (mockPrisma.call.findUnique as jest.Mock).mockRejectedValue(
        new Error('Database connection failed')
      );

      const request = createMockRequest(defaultPayload);
      const response = await POST(request);
      const data = await response.json();

      // Return success to prevent Twilio from retrying
      expect(response.status).toBe(200);
      expect(data).toEqual({ success: true });
    });
  });

  describe('payload parsing', () => {
    it('should handle missing optional fields', async () => {
      const minimalPayload = {
        AccountSid: 'AC123456',
        CallSid: 'CA123456',
        RecordingSid: 'RE123456',
        RecordingUrl: 'https://api.twilio.com/recordings/RE123456',
        RecordingStatus: 'completed',
      };

      const request = createMockRequest(minimalPayload);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({ success: true });
    });

    it('should handle non-numeric duration gracefully', async () => {
      const request = createMockRequest({
        ...defaultPayload,
        RecordingDuration: 'invalid',
      });

      await POST(request);

      // Should use existing duration from call record when parsing fails
      expect(mockPrisma.call.update).toHaveBeenCalledWith({
        where: { id: 'call-123' },
        data: expect.objectContaining({
          duration: 120, // Falls back to existing duration
        }),
      });
    });
  });
});
