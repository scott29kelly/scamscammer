/**
 * Incoming Call Webhook Handler Tests
 */

import { POST, OPTIONS } from '../route';
import prisma from '../../../../../lib/db';
import { CallStatus } from '@prisma/client';
import { NextRequest } from 'next/server';
import * as twilioHelpers from '../../../../../lib/twilio';

// Mock the Prisma client
jest.mock('../../../../../lib/db', () => ({
  __esModule: true,
  default: {
    call: {
      create: jest.fn(),
    },
  },
}));

// Mock Twilio helpers
jest.mock('../../../../../lib/twilio', () => ({
  parseTwilioWebhookBody: jest.fn(),
  isTwilioWebhookPayload: jest.fn(),
  validateTwilioSignature: jest.fn(),
  formatPhoneNumber: jest.fn((num: string) => num),
  generateGreetingAndStreamTwiML: jest.fn(),
  generateFallbackTwiML: jest.fn(),
  buildWebSocketUrl: jest.fn(),
  getEarlGreeting: jest.fn(),
}));

const mockPrisma = prisma as jest.Mocked<typeof prisma>;
const mockTwilioHelpers = twilioHelpers as jest.Mocked<typeof twilioHelpers>;

// Helper to create a mock NextRequest
function createMockRequest(): NextRequest {
  const url = 'https://example.com/api/twilio/incoming';
  const request = new NextRequest(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'x-twilio-signature': 'valid-signature',
    },
  });
  return request;
}

describe('POST /api/twilio/incoming', () => {
  const validPayload = {
    CallSid: 'CA123456789',
    AccountSid: 'AC123456789',
    From: '+15551234567',
    To: '+15559876543',
    CallStatus: 'ringing',
    Direction: 'inbound',
    CallerName: 'Spam Caller',
    FromCity: 'New York',
    FromState: 'NY',
    FromCountry: 'US',
  };

  const mockCall = {
    id: 'cuid-123',
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
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup default mock implementations
    mockTwilioHelpers.parseTwilioWebhookBody.mockResolvedValue(validPayload);
    mockTwilioHelpers.isTwilioWebhookPayload.mockReturnValue(true);
    mockTwilioHelpers.validateTwilioSignature.mockReturnValue(true);
    mockTwilioHelpers.formatPhoneNumber.mockImplementation((num: string) => num);
    mockTwilioHelpers.getEarlGreeting.mockReturnValue('Hello! This is Earl speaking.');
    mockTwilioHelpers.buildWebSocketUrl.mockReturnValue('wss://example.com/api/voice/stream?callSid=CA123456789');
    mockTwilioHelpers.generateGreetingAndStreamTwiML.mockReturnValue(
      '<?xml version="1.0" encoding="UTF-8"?><Response><Say>Hello!</Say><Connect><Stream url="wss://example.com/api/voice/stream?callSid=CA123456789"/></Connect></Response>'
    );
    mockTwilioHelpers.generateFallbackTwiML.mockReturnValue(
      '<?xml version="1.0" encoding="UTF-8"?><Response><Say>Error occurred</Say><Hangup/></Response>'
    );

    (mockPrisma.call.create as jest.Mock).mockResolvedValue(mockCall);

    // Set environment variable
    process.env.NEXT_PUBLIC_APP_URL = 'https://example.com';
  });

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_APP_URL;
  });

  it('should successfully process an incoming call', async () => {
    const request = createMockRequest();
    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('application/xml');

    const responseBody = await response.text();
    expect(responseBody).toContain('<?xml version="1.0"');
    expect(responseBody).toContain('<Response>');
  });

  it('should parse the webhook body', async () => {
    const request = createMockRequest();
    await POST(request);

    expect(mockTwilioHelpers.parseTwilioWebhookBody).toHaveBeenCalledWith(request);
  });

  it('should validate Twilio signature', async () => {
    const request = createMockRequest();
    await POST(request);

    expect(mockTwilioHelpers.validateTwilioSignature).toHaveBeenCalledWith(
      request,
      validPayload
    );
  });

  it('should return 401 when signature validation fails', async () => {
    mockTwilioHelpers.validateTwilioSignature.mockReturnValue(false);

    const request = createMockRequest();
    const response = await POST(request);

    expect(response.status).toBe(401);
    const body = await response.text();
    expect(body).toBe('Unauthorized');
  });

  it('should return fallback TwiML when payload is invalid', async () => {
    mockTwilioHelpers.isTwilioWebhookPayload.mockReturnValue(false);

    const request = createMockRequest();
    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(mockTwilioHelpers.generateFallbackTwiML).toHaveBeenCalled();
  });

  it('should create a call record in the database', async () => {
    const request = createMockRequest();
    await POST(request);

    expect(mockPrisma.call.create).toHaveBeenCalledWith({
      data: {
        twilioSid: 'CA123456789',
        fromNumber: '+15551234567',
        toNumber: '+15559876543',
        status: CallStatus.RINGING,
        tags: [],
      },
    });
  });

  it('should format phone numbers', async () => {
    const request = createMockRequest();
    await POST(request);

    expect(mockTwilioHelpers.formatPhoneNumber).toHaveBeenCalledWith('+15551234567');
    expect(mockTwilioHelpers.formatPhoneNumber).toHaveBeenCalledWith('+15559876543');
  });

  it('should get Earl greeting', async () => {
    const request = createMockRequest();
    await POST(request);

    expect(mockTwilioHelpers.getEarlGreeting).toHaveBeenCalled();
  });

  it('should build WebSocket URL', async () => {
    const request = createMockRequest();
    await POST(request);

    expect(mockTwilioHelpers.buildWebSocketUrl).toHaveBeenCalledWith(
      'https://example.com',
      'CA123456789'
    );
  });

  it('should generate greeting and stream TwiML', async () => {
    const request = createMockRequest();
    await POST(request);

    expect(mockTwilioHelpers.generateGreetingAndStreamTwiML).toHaveBeenCalledWith(
      'Hello! This is Earl speaking.',
      'wss://example.com/api/voice/stream?callSid=CA123456789',
      {
        voice: 'Polly.Matthew',
        language: 'en-US',
        track: 'both',
      }
    );
  });

  it('should return fallback TwiML on database error', async () => {
    (mockPrisma.call.create as jest.Mock).mockRejectedValue(new Error('Database error'));

    const request = createMockRequest();
    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(mockTwilioHelpers.generateFallbackTwiML).toHaveBeenCalled();
  });

  it('should return fallback TwiML on unexpected error', async () => {
    mockTwilioHelpers.parseTwilioWebhookBody.mockRejectedValue(new Error('Unexpected error'));

    const request = createMockRequest();
    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('application/xml');
  });

  it('should handle missing NEXT_PUBLIC_APP_URL by extracting from request', async () => {
    delete process.env.NEXT_PUBLIC_APP_URL;

    const request = createMockRequest();
    await POST(request);

    // Should still work, using URL from request
    expect(mockTwilioHelpers.buildWebSocketUrl).toHaveBeenCalled();
  });
});

describe('OPTIONS /api/twilio/incoming', () => {
  it('should return 200 for CORS preflight', async () => {
    const response = await OPTIONS();

    expect(response.status).toBe(200);
  });

  it('should include CORS headers', async () => {
    const response = await OPTIONS();

    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(response.headers.get('Access-Control-Allow-Methods')).toBe('POST, OPTIONS');
    expect(response.headers.get('Access-Control-Allow-Headers')).toBe(
      'Content-Type, X-Twilio-Signature'
    );
  });
});
