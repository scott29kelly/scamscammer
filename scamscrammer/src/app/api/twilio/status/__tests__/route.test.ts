/**
 * Twilio Call Status Webhook Handler Tests
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
      findUnique: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
  },
}));

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

// Helper function to create a mock NextRequest with form data
function createFormDataRequest(data: Record<string, string>): NextRequest {
  const formData = new URLSearchParams(data);
  return new NextRequest('http://localhost/api/twilio/status', {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: formData.toString(),
  });
}

// Helper function to create a mock NextRequest with JSON data
function createJsonRequest(data: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/twilio/status', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(data),
  });
}

// Mock call data
const mockExistingCall = {
  id: 'call-123',
  twilioSid: 'CA123456789',
  fromNumber: '+15551234567',
  toNumber: '+15559876543',
  status: CallStatus.RINGING,
  duration: null,
  recordingUrl: null,
  transcriptUrl: null,
  rating: null,
  notes: null,
  tags: [],
  createdAt: new Date('2026-01-15T10:00:00Z'),
  updatedAt: new Date('2026-01-15T10:00:00Z'),
};

// Valid Twilio status payload
const validPayload = {
  CallSid: 'CA123456789',
  AccountSid: 'AC123456789',
  From: '+15551234567',
  To: '+15559876543',
  CallStatus: 'in-progress',
  Direction: 'inbound',
};

describe('POST /api/twilio/status', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Payload Validation', () => {
    it('should reject request with missing CallSid', async () => {
      const payload = { ...validPayload, CallSid: '' };
      const request = createJsonRequest(payload);

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid payload');
      expect(data.code).toBe('INVALID_PAYLOAD');
    });

    it('should reject request with missing AccountSid', async () => {
      const payload = { ...validPayload, AccountSid: '' };
      const request = createJsonRequest(payload);

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid payload');
    });

    it('should reject request with invalid CallStatus', async () => {
      const payload = { ...validPayload, CallStatus: 'invalid-status' };
      const request = createJsonRequest(payload);

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid payload');
    });

    it('should reject request with missing required fields', async () => {
      const request = createJsonRequest({ CallSid: 'CA123' });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid payload');
    });
  });

  describe('Status Updates for Existing Calls', () => {
    it('should update call status to IN_PROGRESS', async () => {
      const payload = { ...validPayload, CallStatus: 'in-progress' };
      const request = createJsonRequest(payload);

      (mockPrisma.call.findUnique as jest.Mock).mockResolvedValue(mockExistingCall);
      (mockPrisma.call.update as jest.Mock).mockResolvedValue({
        ...mockExistingCall,
        status: CallStatus.IN_PROGRESS,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.status).toBe(CallStatus.IN_PROGRESS);
      expect(mockPrisma.call.update).toHaveBeenCalledWith({
        where: { twilioSid: 'CA123456789' },
        data: { status: CallStatus.IN_PROGRESS },
      });
    });

    it('should update call status to COMPLETED with duration', async () => {
      const payload = {
        ...validPayload,
        CallStatus: 'completed',
        CallDuration: '300',
      };
      const request = createJsonRequest(payload);

      (mockPrisma.call.findUnique as jest.Mock).mockResolvedValue(mockExistingCall);
      (mockPrisma.call.update as jest.Mock).mockResolvedValue({
        ...mockExistingCall,
        status: CallStatus.COMPLETED,
        duration: 300,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.status).toBe(CallStatus.COMPLETED);
      expect(mockPrisma.call.update).toHaveBeenCalledWith({
        where: { twilioSid: 'CA123456789' },
        data: { status: CallStatus.COMPLETED, duration: 300 },
      });
    });

    it('should update call status to RINGING for ringing status', async () => {
      const payload = { ...validPayload, CallStatus: 'ringing' };
      const request = createJsonRequest(payload);

      (mockPrisma.call.findUnique as jest.Mock).mockResolvedValue(mockExistingCall);
      (mockPrisma.call.update as jest.Mock).mockResolvedValue({
        ...mockExistingCall,
        status: CallStatus.RINGING,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe(CallStatus.RINGING);
    });

    it('should update call status to RINGING for queued status', async () => {
      const payload = { ...validPayload, CallStatus: 'queued' };
      const request = createJsonRequest(payload);

      (mockPrisma.call.findUnique as jest.Mock).mockResolvedValue(mockExistingCall);
      (mockPrisma.call.update as jest.Mock).mockResolvedValue({
        ...mockExistingCall,
        status: CallStatus.RINGING,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe(CallStatus.RINGING);
    });

    it('should update call status to FAILED for failed status', async () => {
      const payload = { ...validPayload, CallStatus: 'failed' };
      const request = createJsonRequest(payload);

      (mockPrisma.call.findUnique as jest.Mock).mockResolvedValue(mockExistingCall);
      (mockPrisma.call.update as jest.Mock).mockResolvedValue({
        ...mockExistingCall,
        status: CallStatus.FAILED,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe(CallStatus.FAILED);
    });

    it('should update call status to NO_ANSWER for busy status', async () => {
      const payload = { ...validPayload, CallStatus: 'busy' };
      const request = createJsonRequest(payload);

      (mockPrisma.call.findUnique as jest.Mock).mockResolvedValue(mockExistingCall);
      (mockPrisma.call.update as jest.Mock).mockResolvedValue({
        ...mockExistingCall,
        status: CallStatus.NO_ANSWER,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe(CallStatus.NO_ANSWER);
    });

    it('should update call status to NO_ANSWER for no-answer status', async () => {
      const payload = { ...validPayload, CallStatus: 'no-answer' };
      const request = createJsonRequest(payload);

      (mockPrisma.call.findUnique as jest.Mock).mockResolvedValue(mockExistingCall);
      (mockPrisma.call.update as jest.Mock).mockResolvedValue({
        ...mockExistingCall,
        status: CallStatus.NO_ANSWER,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe(CallStatus.NO_ANSWER);
    });

    it('should update call status to NO_ANSWER for canceled status', async () => {
      const payload = { ...validPayload, CallStatus: 'canceled' };
      const request = createJsonRequest(payload);

      (mockPrisma.call.findUnique as jest.Mock).mockResolvedValue(mockExistingCall);
      (mockPrisma.call.update as jest.Mock).mockResolvedValue({
        ...mockExistingCall,
        status: CallStatus.NO_ANSWER,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe(CallStatus.NO_ANSWER);
    });
  });

  describe('Creating New Calls', () => {
    it('should create new call when CallSid not found', async () => {
      const payload = { ...validPayload };
      const request = createJsonRequest(payload);

      const newCall = {
        id: 'new-call-123',
        twilioSid: 'CA123456789',
        fromNumber: '+15551234567',
        toNumber: '+15559876543',
        status: CallStatus.IN_PROGRESS,
        duration: null,
        recordingUrl: null,
        transcriptUrl: null,
        rating: null,
        notes: null,
        tags: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (mockPrisma.call.findUnique as jest.Mock).mockResolvedValue(null);
      (mockPrisma.call.create as jest.Mock).mockResolvedValue(newCall);

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.callId).toBe('new-call-123');
      expect(data.status).toBe(CallStatus.IN_PROGRESS);
      expect(mockPrisma.call.create).toHaveBeenCalledWith({
        data: {
          twilioSid: 'CA123456789',
          fromNumber: '+15551234567',
          toNumber: '+15559876543',
          status: CallStatus.IN_PROGRESS,
        },
      });
    });

    it('should create new call with duration when provided', async () => {
      const payload = {
        ...validPayload,
        CallStatus: 'completed',
        CallDuration: '120',
      };
      const request = createJsonRequest(payload);

      const newCall = {
        id: 'new-call-456',
        twilioSid: 'CA123456789',
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

      (mockPrisma.call.findUnique as jest.Mock).mockResolvedValue(null);
      (mockPrisma.call.create as jest.Mock).mockResolvedValue(newCall);

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockPrisma.call.create).toHaveBeenCalledWith({
        data: {
          twilioSid: 'CA123456789',
          fromNumber: '+15551234567',
          toNumber: '+15559876543',
          status: CallStatus.COMPLETED,
          duration: 120,
        },
      });
    });
  });

  describe('Content-Type Handling', () => {
    it('should handle application/x-www-form-urlencoded content type', async () => {
      const request = createFormDataRequest({
        CallSid: 'CA123456789',
        AccountSid: 'AC123456789',
        From: '+15551234567',
        To: '+15559876543',
        CallStatus: 'completed',
        Direction: 'inbound',
        CallDuration: '60',
      });

      (mockPrisma.call.findUnique as jest.Mock).mockResolvedValue(mockExistingCall);
      (mockPrisma.call.update as jest.Mock).mockResolvedValue({
        ...mockExistingCall,
        status: CallStatus.COMPLETED,
        duration: 60,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.status).toBe(CallStatus.COMPLETED);
    });

    it('should handle application/json content type', async () => {
      const request = createJsonRequest({
        ...validPayload,
        CallStatus: 'completed',
        CallDuration: '180',
      });

      (mockPrisma.call.findUnique as jest.Mock).mockResolvedValue(mockExistingCall);
      (mockPrisma.call.update as jest.Mock).mockResolvedValue({
        ...mockExistingCall,
        status: CallStatus.COMPLETED,
        duration: 180,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should return 500 on database error during findUnique', async () => {
      const request = createJsonRequest(validPayload);

      (mockPrisma.call.findUnique as jest.Mock).mockRejectedValue(
        new Error('Database connection failed')
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to process call status update');
      expect(data.code).toBe('INTERNAL_ERROR');
    });

    it('should return 500 on database error during update', async () => {
      const request = createJsonRequest(validPayload);

      (mockPrisma.call.findUnique as jest.Mock).mockResolvedValue(mockExistingCall);
      (mockPrisma.call.update as jest.Mock).mockRejectedValue(
        new Error('Database update failed')
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to process call status update');
    });

    it('should return 500 on database error during create', async () => {
      const request = createJsonRequest(validPayload);

      (mockPrisma.call.findUnique as jest.Mock).mockResolvedValue(null);
      (mockPrisma.call.create as jest.Mock).mockRejectedValue(
        new Error('Database create failed')
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to process call status update');
    });

    it('should return 409 on unique constraint violation', async () => {
      const request = createJsonRequest(validPayload);

      (mockPrisma.call.findUnique as jest.Mock).mockResolvedValue(null);
      (mockPrisma.call.create as jest.Mock).mockRejectedValue(
        new Error('Unique constraint failed on the fields: (`twilioSid`)')
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data.error).toBe('Call already exists');
      expect(data.code).toBe('DUPLICATE_CALL');
    });
  });

  describe('Edge Cases', () => {
    it('should handle CallDuration of 0', async () => {
      const payload = {
        ...validPayload,
        CallStatus: 'completed',
        CallDuration: '0',
      };
      const request = createJsonRequest(payload);

      (mockPrisma.call.findUnique as jest.Mock).mockResolvedValue(mockExistingCall);
      (mockPrisma.call.update as jest.Mock).mockResolvedValue({
        ...mockExistingCall,
        status: CallStatus.COMPLETED,
        duration: 0,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(mockPrisma.call.update).toHaveBeenCalledWith({
        where: { twilioSid: 'CA123456789' },
        data: { status: CallStatus.COMPLETED, duration: 0 },
      });
    });

    it('should not include duration if CallDuration is not provided', async () => {
      const payload = { ...validPayload };
      delete (payload as Record<string, unknown>).CallDuration;
      const request = createJsonRequest(payload);

      (mockPrisma.call.findUnique as jest.Mock).mockResolvedValue(mockExistingCall);
      (mockPrisma.call.update as jest.Mock).mockResolvedValue({
        ...mockExistingCall,
        status: CallStatus.IN_PROGRESS,
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(mockPrisma.call.update).toHaveBeenCalledWith({
        where: { twilioSid: 'CA123456789' },
        data: { status: CallStatus.IN_PROGRESS },
      });
    });

    it('should handle international phone numbers', async () => {
      const payload = {
        ...validPayload,
        From: '+447700900000',
        To: '+12025551234',
      };
      const request = createJsonRequest(payload);

      (mockPrisma.call.findUnique as jest.Mock).mockResolvedValue(null);
      (mockPrisma.call.create as jest.Mock).mockResolvedValue({
        id: 'intl-call-123',
        twilioSid: 'CA123456789',
        fromNumber: '+447700900000',
        toNumber: '+12025551234',
        status: CallStatus.IN_PROGRESS,
        duration: null,
        recordingUrl: null,
        transcriptUrl: null,
        rating: null,
        notes: null,
        tags: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockPrisma.call.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          fromNumber: '+447700900000',
          toNumber: '+12025551234',
        }),
      });
    });
  });
});
