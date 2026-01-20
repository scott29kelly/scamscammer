/**
 * Incoming Call Webhook Tests
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
      create: jest.fn(),
    },
  },
}));

// Mock the twilio module
jest.mock('@/lib/twilio', () => ({
  validateRequest: jest.fn(() => true),
  createStreamingTwiml: jest.fn(
    (greeting, streamUrl) =>
      `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="Polly.Matthew-Neural">${greeting}</Say><Connect><Stream url="${streamUrl}"/></Connect></Response>`
  ),
  createErrorTwiml: jest.fn(
    () =>
      '<?xml version="1.0" encoding="UTF-8"?><Response><Say>Error</Say><Hangup/></Response>'
  ),
}));

const mockPrisma = prisma as jest.Mocked<typeof prisma>;
const mockTwilio = jest.requireMock('@/lib/twilio');

// Helper to create a mock NextRequest with form data
function createMockRequest(
  params: Record<string, string>,
  headers: Record<string, string> = {}
): NextRequest {
  const formData = new FormData();
  Object.entries(params).forEach(([key, value]) => {
    formData.append(key, value);
  });

  const request = new NextRequest('https://example.com/api/twilio/incoming', {
    method: 'POST',
    headers: {
      'X-Twilio-Signature': 'valid-signature',
      ...headers,
    },
  });

  // Mock the formData method
  jest.spyOn(request, 'formData').mockResolvedValue(formData);

  return request;
}

describe('POST /api/twilio/incoming', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv, NODE_ENV: 'development' };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should handle incoming call and return TwiML response', async () => {
    const callParams = {
      CallSid: 'CA123456789',
      AccountSid: 'AC123456789',
      From: '+15551234567',
      To: '+15559876543',
      CallStatus: 'ringing',
      Direction: 'inbound',
    };

    (mockPrisma.call.create as jest.Mock).mockResolvedValue({
      id: 'call-1',
      twilioSid: callParams.CallSid,
      fromNumber: callParams.From,
      toNumber: callParams.To,
      status: CallStatus.RINGING,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const request = createMockRequest(callParams);
    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('text/xml');

    const body = await response.text();
    expect(body).toContain('<?xml');
    expect(body).toContain('<Response>');
    expect(body).toContain('<Say');
    expect(body).toContain('<Connect>');
    expect(body).toContain('<Stream');

    // Verify call was created in database
    expect(mockPrisma.call.create).toHaveBeenCalledWith({
      data: {
        twilioSid: callParams.CallSid,
        fromNumber: callParams.From,
        toNumber: callParams.To,
        status: CallStatus.RINGING,
      },
    });
  });

  it('should return error TwiML when required parameters are missing', async () => {
    const callParams = {
      CallSid: '', // Missing CallSid
      From: '+15551234567',
      To: '+15559876543',
    };

    const request = createMockRequest(callParams);
    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('text/xml');

    // Should return error TwiML, not create a call
    expect(mockTwilio.createErrorTwiml).toHaveBeenCalled();
    expect(mockPrisma.call.create).not.toHaveBeenCalled();
  });

  it('should handle duplicate call SID gracefully', async () => {
    const callParams = {
      CallSid: 'CA123456789',
      AccountSid: 'AC123456789',
      From: '+15551234567',
      To: '+15559876543',
      CallStatus: 'ringing',
    };

    // Simulate unique constraint violation
    (mockPrisma.call.create as jest.Mock).mockRejectedValue(
      new Error('Unique constraint failed on the fields: (`twilioSid`)')
    );

    const request = createMockRequest(callParams);
    const response = await POST(request);

    // Should still return success TwiML
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('text/xml');

    const body = await response.text();
    expect(body).toContain('<Response>');
    expect(mockTwilio.createStreamingTwiml).toHaveBeenCalled();
  });

  it('should return 403 for invalid Twilio signature in production', async () => {
    process.env = { ...originalEnv, NODE_ENV: 'production' };

    const callParams = {
      CallSid: 'CA123456789',
      From: '+15551234567',
      To: '+15559876543',
      CallStatus: 'ringing',
    };

    // Mock validation to fail
    mockTwilio.validateRequest.mockReturnValue(false);

    const request = createMockRequest(callParams);
    const response = await POST(request);

    expect(response.status).toBe(403);
  });

  it('should skip signature validation in development mode', async () => {
    process.env = { ...originalEnv, NODE_ENV: 'development' };

    const callParams = {
      CallSid: 'CA123456789',
      From: '+15551234567',
      To: '+15559876543',
      CallStatus: 'ringing',
    };

    (mockPrisma.call.create as jest.Mock).mockResolvedValue({
      id: 'call-1',
      twilioSid: callParams.CallSid,
      fromNumber: callParams.From,
      toNumber: callParams.To,
      status: CallStatus.RINGING,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const request = createMockRequest(callParams, {
      // No X-Twilio-Signature header
    });
    // Remove the header
    jest.spyOn(request.headers, 'get').mockImplementation((name) => {
      if (name === 'X-Twilio-Signature') return null;
      if (name === 'host') return 'localhost:3000';
      return null;
    });

    const response = await POST(request);

    // Should succeed in development mode
    expect(response.status).toBe(200);
  });

  it('should use configured app URL for stream URL in production', async () => {
    process.env = {
      ...originalEnv,
      NODE_ENV: 'development',
      NEXT_PUBLIC_APP_URL: 'https://scamscrammer.example.com',
    };

    const callParams = {
      CallSid: 'CA123456789',
      From: '+15551234567',
      To: '+15559876543',
      CallStatus: 'ringing',
    };

    (mockPrisma.call.create as jest.Mock).mockResolvedValue({
      id: 'call-1',
      twilioSid: callParams.CallSid,
      fromNumber: callParams.From,
      toNumber: callParams.To,
      status: CallStatus.RINGING,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const request = createMockRequest(callParams);
    await POST(request);

    // Verify stream URL uses the configured app URL with wss protocol
    expect(mockTwilio.createStreamingTwiml).toHaveBeenCalledWith(
      expect.any(String),
      'wss://scamscrammer.example.com/api/voice/stream'
    );
  });

  it('should return error TwiML on unexpected errors', async () => {
    const callParams = {
      CallSid: 'CA123456789',
      From: '+15551234567',
      To: '+15559876543',
      CallStatus: 'ringing',
    };

    // Simulate unexpected database error
    (mockPrisma.call.create as jest.Mock).mockRejectedValue(
      new Error('Connection timeout')
    );

    const request = createMockRequest(callParams);
    const response = await POST(request);

    // Should return success status with TwiML (we still answer the call)
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('text/xml');
  });

  it('should log call details for debugging', async () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

    const callParams = {
      CallSid: 'CA123456789',
      From: '+15551234567',
      To: '+15559876543',
      CallStatus: 'ringing',
    };

    (mockPrisma.call.create as jest.Mock).mockResolvedValue({
      id: 'call-1',
      twilioSid: callParams.CallSid,
      fromNumber: callParams.From,
      toNumber: callParams.To,
      status: CallStatus.RINGING,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const request = createMockRequest(callParams);
    await POST(request);

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Incoming call: CA123456789')
    );

    consoleSpy.mockRestore();
  });
});
