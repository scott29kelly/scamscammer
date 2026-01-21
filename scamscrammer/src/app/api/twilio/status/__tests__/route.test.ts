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
    },
  },
}));

// Mock the twilio module
jest.mock('@/lib/twilio', () => ({
  validateTwilioSignature: jest.fn(() => true),
  getTwilioAuthToken: jest.fn(() => 'test-auth-token'),
  getWebhookBaseUrl: jest.fn(() => 'https://example.com'),
}));

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

// Helper to create a mock NextRequest with form data
function createMockRequest(
  params: Record<string, string>,
  headers: Record<string, string> = {}
): NextRequest {
  const formData = new FormData();
  for (const [key, value] of Object.entries(params)) {
    formData.append(key, value);
  }

  const request = new NextRequest('https://example.com/api/twilio/status', {
    method: 'POST',
    body: formData,
    headers: new Headers(headers),
  });

  return request;
}

describe('POST /api/twilio/status', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv, TWILIO_AUTH_TOKEN: 'test-token' };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should update call status to IN_PROGRESS when call is answered', async () => {
    const existingCall = {
      id: 'call-123',
      status: CallStatus.RINGING,
    };

    const updatedCall = {
      id: 'call-123',
      status: CallStatus.IN_PROGRESS,
      duration: null,
    };

    (mockPrisma.call.findUnique as jest.Mock).mockResolvedValue(existingCall);
    (mockPrisma.call.update as jest.Mock).mockResolvedValue(updatedCall);

    const request = createMockRequest(
      {
        CallSid: 'CA123456',
        AccountSid: 'AC123456',
        From: '+15551234567',
        To: '+15559876543',
        CallStatus: 'in-progress',
        Direction: 'inbound',
        ApiVersion: '2010-04-01',
      },
      { 'X-Twilio-Signature': 'valid-signature' }
    );

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.callId).toBe('call-123');
    expect(data.previousStatus).toBe(CallStatus.RINGING);
    expect(data.newStatus).toBe(CallStatus.IN_PROGRESS);

    expect(mockPrisma.call.update).toHaveBeenCalledWith({
      where: { twilioSid: 'CA123456' },
      data: { status: CallStatus.IN_PROGRESS },
      select: { id: true, status: true, duration: true },
    });
  });

  it('should update call status to COMPLETED with duration when call ends', async () => {
    const existingCall = {
      id: 'call-123',
      status: CallStatus.IN_PROGRESS,
    };

    const updatedCall = {
      id: 'call-123',
      status: CallStatus.COMPLETED,
      duration: 300,
    };

    (mockPrisma.call.findUnique as jest.Mock).mockResolvedValue(existingCall);
    (mockPrisma.call.update as jest.Mock).mockResolvedValue(updatedCall);

    const request = createMockRequest(
      {
        CallSid: 'CA123456',
        AccountSid: 'AC123456',
        From: '+15551234567',
        To: '+15559876543',
        CallStatus: 'completed',
        CallDuration: '300',
        Direction: 'inbound',
        ApiVersion: '2010-04-01',
      },
      { 'X-Twilio-Signature': 'valid-signature' }
    );

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.newStatus).toBe(CallStatus.COMPLETED);
    expect(data.duration).toBe(300);

    expect(mockPrisma.call.update).toHaveBeenCalledWith({
      where: { twilioSid: 'CA123456' },
      data: {
        status: CallStatus.COMPLETED,
        duration: 300,
      },
      select: { id: true, status: true, duration: true },
    });
  });

  it('should map ringing status correctly', async () => {
    const existingCall = {
      id: 'call-123',
      status: CallStatus.RINGING,
    };

    const updatedCall = {
      id: 'call-123',
      status: CallStatus.RINGING,
      duration: null,
    };

    (mockPrisma.call.findUnique as jest.Mock).mockResolvedValue(existingCall);
    (mockPrisma.call.update as jest.Mock).mockResolvedValue(updatedCall);

    const request = createMockRequest(
      {
        CallSid: 'CA123456',
        CallStatus: 'ringing',
      },
      { 'X-Twilio-Signature': 'valid-signature' }
    );

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.newStatus).toBe(CallStatus.RINGING);
  });

  it('should map no-answer status to NO_ANSWER', async () => {
    const existingCall = {
      id: 'call-123',
      status: CallStatus.RINGING,
    };

    const updatedCall = {
      id: 'call-123',
      status: CallStatus.NO_ANSWER,
      duration: null,
    };

    (mockPrisma.call.findUnique as jest.Mock).mockResolvedValue(existingCall);
    (mockPrisma.call.update as jest.Mock).mockResolvedValue(updatedCall);

    const request = createMockRequest(
      {
        CallSid: 'CA123456',
        CallStatus: 'no-answer',
      },
      { 'X-Twilio-Signature': 'valid-signature' }
    );

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.newStatus).toBe(CallStatus.NO_ANSWER);
  });

  it('should map busy status to FAILED', async () => {
    const existingCall = {
      id: 'call-123',
      status: CallStatus.RINGING,
    };

    const updatedCall = {
      id: 'call-123',
      status: CallStatus.FAILED,
      duration: null,
    };

    (mockPrisma.call.findUnique as jest.Mock).mockResolvedValue(existingCall);
    (mockPrisma.call.update as jest.Mock).mockResolvedValue(updatedCall);

    const request = createMockRequest(
      {
        CallSid: 'CA123456',
        CallStatus: 'busy',
      },
      { 'X-Twilio-Signature': 'valid-signature' }
    );

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.newStatus).toBe(CallStatus.FAILED);
  });

  it('should map failed status to FAILED', async () => {
    const existingCall = {
      id: 'call-123',
      status: CallStatus.RINGING,
    };

    const updatedCall = {
      id: 'call-123',
      status: CallStatus.FAILED,
      duration: null,
    };

    (mockPrisma.call.findUnique as jest.Mock).mockResolvedValue(existingCall);
    (mockPrisma.call.update as jest.Mock).mockResolvedValue(updatedCall);

    const request = createMockRequest(
      {
        CallSid: 'CA123456',
        CallStatus: 'failed',
      },
      { 'X-Twilio-Signature': 'valid-signature' }
    );

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.newStatus).toBe(CallStatus.FAILED);
  });

  it('should map canceled status to FAILED', async () => {
    const existingCall = {
      id: 'call-123',
      status: CallStatus.RINGING,
    };

    const updatedCall = {
      id: 'call-123',
      status: CallStatus.FAILED,
      duration: null,
    };

    (mockPrisma.call.findUnique as jest.Mock).mockResolvedValue(existingCall);
    (mockPrisma.call.update as jest.Mock).mockResolvedValue(updatedCall);

    const request = createMockRequest(
      {
        CallSid: 'CA123456',
        CallStatus: 'canceled',
      },
      { 'X-Twilio-Signature': 'valid-signature' }
    );

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.newStatus).toBe(CallStatus.FAILED);
  });

  it('should map initiated status to RINGING', async () => {
    const existingCall = {
      id: 'call-123',
      status: CallStatus.RINGING,
    };

    const updatedCall = {
      id: 'call-123',
      status: CallStatus.RINGING,
      duration: null,
    };

    (mockPrisma.call.findUnique as jest.Mock).mockResolvedValue(existingCall);
    (mockPrisma.call.update as jest.Mock).mockResolvedValue(updatedCall);

    const request = createMockRequest(
      {
        CallSid: 'CA123456',
        CallStatus: 'initiated',
      },
      { 'X-Twilio-Signature': 'valid-signature' }
    );

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.newStatus).toBe(CallStatus.RINGING);
  });

  it('should map queued status to RINGING', async () => {
    const existingCall = {
      id: 'call-123',
      status: CallStatus.RINGING,
    };

    const updatedCall = {
      id: 'call-123',
      status: CallStatus.RINGING,
      duration: null,
    };

    (mockPrisma.call.findUnique as jest.Mock).mockResolvedValue(existingCall);
    (mockPrisma.call.update as jest.Mock).mockResolvedValue(updatedCall);

    const request = createMockRequest(
      {
        CallSid: 'CA123456',
        CallStatus: 'queued',
      },
      { 'X-Twilio-Signature': 'valid-signature' }
    );

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.newStatus).toBe(CallStatus.RINGING);
  });

  it('should return 404 when call is not found', async () => {
    (mockPrisma.call.findUnique as jest.Mock).mockResolvedValue(null);

    const request = createMockRequest(
      {
        CallSid: 'CA-unknown',
        CallStatus: 'in-progress',
      },
      { 'X-Twilio-Signature': 'valid-signature' }
    );

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Call not found');
    expect(data.code).toBe('CALL_NOT_FOUND');
  });

  it('should return 400 when CallSid is missing', async () => {
    const request = createMockRequest(
      {
        CallStatus: 'in-progress',
      },
      { 'X-Twilio-Signature': 'valid-signature' }
    );

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Missing required fields');
    expect(data.code).toBe('MISSING_FIELDS');
  });

  it('should return 400 when CallStatus is missing', async () => {
    const request = createMockRequest(
      {
        CallSid: 'CA123456',
      },
      { 'X-Twilio-Signature': 'valid-signature' }
    );

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Missing required fields');
    expect(data.code).toBe('MISSING_FIELDS');
  });

  it('should return 401 when signature is invalid', async () => {
    // Re-mock validateTwilioSignature to return false for this test
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { validateTwilioSignature } = require('@/lib/twilio');
    (validateTwilioSignature as jest.Mock).mockReturnValueOnce(false);

    const request = createMockRequest(
      {
        CallSid: 'CA123456',
        CallStatus: 'in-progress',
      },
      { 'X-Twilio-Signature': 'invalid-signature' }
    );

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Invalid signature');
    expect(data.code).toBe('INVALID_SIGNATURE');
  });

  it('should return 500 on database error', async () => {
    (mockPrisma.call.findUnique as jest.Mock).mockRejectedValue(
      new Error('Database connection failed')
    );

    const request = createMockRequest(
      {
        CallSid: 'CA123456',
        CallStatus: 'in-progress',
      },
      { 'X-Twilio-Signature': 'valid-signature' }
    );

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Internal server error');
    expect(data.code).toBe('INTERNAL_ERROR');
  });

  it('should not update duration for non-completed status', async () => {
    const existingCall = {
      id: 'call-123',
      status: CallStatus.RINGING,
    };

    const updatedCall = {
      id: 'call-123',
      status: CallStatus.IN_PROGRESS,
      duration: null,
    };

    (mockPrisma.call.findUnique as jest.Mock).mockResolvedValue(existingCall);
    (mockPrisma.call.update as jest.Mock).mockResolvedValue(updatedCall);

    // Even if CallDuration is provided, it should only be saved when status is completed
    const request = createMockRequest(
      {
        CallSid: 'CA123456',
        CallStatus: 'in-progress',
        CallDuration: '100', // Duration provided but shouldn't be saved
      },
      { 'X-Twilio-Signature': 'valid-signature' }
    );

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(mockPrisma.call.update).toHaveBeenCalledWith({
      where: { twilioSid: 'CA123456' },
      data: { status: CallStatus.IN_PROGRESS },
      select: { id: true, status: true, duration: true },
    });
  });
});
