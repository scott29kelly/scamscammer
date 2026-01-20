/**
 * Tests for Twilio Client and Helpers
 */

import {
  TwilioClient,
  validateTwilioSignature,
  formatPhoneNumber,
  parsePhoneNumber,
  isValidPhoneNumber,
  maskPhoneNumber,
  mapTwilioStatus,
  parseTwilioFormData,
  getTwilioClient,
  resetTwilioClient,
} from '../twilio';

// Mock the twilio module
jest.mock('twilio', () => {
  const mockCallsFetch = jest.fn();
  const mockCallsUpdate = jest.fn();
  const mockRecordingFetch = jest.fn();
  const mockRecordingsList = jest.fn();

  const mockClient = jest.fn(() => ({
    calls: jest.fn((sid?: string) => ({
      fetch: mockCallsFetch,
      update: mockCallsUpdate,
    })),
    recordings: jest.fn((sid?: string) => ({
      fetch: mockRecordingFetch,
      list: mockRecordingsList,
    })),
  }));

  // Add named exports
  (mockClient as unknown as { validateRequest: jest.Mock }).validateRequest = jest.fn();

  return {
    __esModule: true,
    default: mockClient,
    Twilio: mockClient,
    twiml: {
      VoiceResponse: jest.fn().mockImplementation(() => {
        const nodes: string[] = [];
        const response = {
          say: jest.fn((options, message) => {
            const attrs = Object.entries(options)
              .filter(([, v]) => v !== undefined)
              .map(([k, v]) => `${k}="${v}"`)
              .join(' ');
            nodes.push(`<Say ${attrs}>${message}</Say>`);
          }),
          record: jest.fn((options) => {
            const attrs = Object.entries(options)
              .filter(([, v]) => v !== undefined)
              .map(([k, v]) => `${k}="${v}"`)
              .join(' ');
            nodes.push(`<Record ${attrs}/>`);
          }),
          connect: jest.fn(() => ({
            stream: jest.fn((options) => ({
              parameter: jest.fn((param) => {
                nodes.push(`<Stream url="${options.url}"><Parameter name="${param.name}" value="${param.value}"/></Stream>`);
              }),
            })),
          })),
          toString: jest.fn(() => `<?xml version="1.0" encoding="UTF-8"?><Response>${nodes.join('')}</Response>`),
        };
        return response;
      }),
    },
    validateRequest: jest.fn(),
  };
});

describe('Twilio Client and Helpers', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    resetTwilioClient();
    process.env = {
      ...originalEnv,
      TWILIO_ACCOUNT_SID: 'test_account_sid',
      TWILIO_AUTH_TOKEN: 'test_auth_token',
      TWILIO_PHONE_NUMBER: '+15551234567',
    };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('TwilioClient', () => {
    describe('constructor', () => {
      it('should create client with environment variables', () => {
        const client = new TwilioClient();
        expect(client).toBeDefined();
        expect(client.getPhoneNumber()).toBe('+15551234567');
      });

      it('should create client with explicit config', () => {
        const client = new TwilioClient({
          accountSid: 'custom_sid',
          authToken: 'custom_token',
          phoneNumber: '+15559876543',
        });
        expect(client).toBeDefined();
        expect(client.getPhoneNumber()).toBe('+15559876543');
      });

      it('should throw error if credentials not configured', () => {
        process.env.TWILIO_ACCOUNT_SID = '';
        process.env.TWILIO_AUTH_TOKEN = '';
        expect(() => new TwilioClient()).toThrow('Twilio credentials not configured');
      });
    });

    describe('generateTwiMLResponse', () => {
      it('should generate TwiML with string message', () => {
        const client = new TwilioClient();
        const result = client.generateTwiMLResponse('Hello, this is Earl speaking.');

        expect(result).toContain('<?xml version="1.0" encoding="UTF-8"?>');
        expect(result).toContain('<Response>');
        expect(result).toContain('<Say');
        expect(result).toContain('Hello, this is Earl speaking.');
      });

      it('should generate TwiML with options object', () => {
        const client = new TwilioClient();
        const result = client.generateTwiMLResponse({
          message: 'Test message',
          voice: 'Polly.Joanna',
          language: 'en-GB',
        });

        expect(result).toContain('<Response>');
        expect(result).toContain('Test message');
      });
    });

    describe('generateStreamTwiML', () => {
      it('should generate TwiML for WebSocket streaming', () => {
        const client = new TwilioClient();
        const result = client.generateStreamTwiML({
          websocketUrl: 'wss://example.com/stream',
        });

        expect(result).toContain('<Response>');
      });

      it('should include greeting when provided', () => {
        const client = new TwilioClient();
        const result = client.generateStreamTwiML({
          websocketUrl: 'wss://example.com/stream',
          greeting: 'Hello there!',
        });

        expect(result).toContain('<Response>');
        expect(result).toContain('Hello there!');
      });
    });

    describe('generateRecordingTwiML', () => {
      it('should generate TwiML with recording', () => {
        const client = new TwilioClient();
        const result = client.generateRecordingTwiML({
          message: 'Recording will begin now.',
          statusCallbackUrl: 'https://example.com/recording-callback',
        });

        expect(result).toContain('<Response>');
        expect(result).toContain('<Record');
        expect(result).toContain('Recording will begin now.');
      });
    });

    describe('getClient', () => {
      it('should return the underlying Twilio client', () => {
        const client = new TwilioClient();
        const underlyingClient = client.getClient();
        expect(underlyingClient).toBeDefined();
      });
    });
  });

  describe('validateTwilioSignature', () => {
    it('should call validateRequest with correct params', () => {
      const { validateRequest } = jest.requireMock('twilio');
      validateRequest.mockReturnValue(true);

      const result = validateTwilioSignature(
        'auth_token',
        'signature',
        'https://example.com/webhook',
        { CallSid: 'CA123' }
      );

      expect(validateRequest).toHaveBeenCalledWith(
        'auth_token',
        'signature',
        'https://example.com/webhook',
        { CallSid: 'CA123' }
      );
      expect(result).toBe(true);
    });
  });

  describe('formatPhoneNumber', () => {
    it('should keep E.164 format as is', () => {
      expect(formatPhoneNumber('+15551234567')).toBe('+15551234567');
    });

    it('should add + prefix and country code to 10-digit number', () => {
      expect(formatPhoneNumber('5551234567')).toBe('+15551234567');
    });

    it('should add + prefix to 11-digit number with country code', () => {
      expect(formatPhoneNumber('15551234567')).toBe('+15551234567');
    });

    it('should remove non-digit characters', () => {
      expect(formatPhoneNumber('(555) 123-4567')).toBe('+15551234567');
    });

    it('should handle different country codes', () => {
      expect(formatPhoneNumber('5551234567', '44')).toBe('+445551234567');
    });

    it('should remove leading zeros', () => {
      expect(formatPhoneNumber('05551234567')).toBe('+15551234567');
    });
  });

  describe('parsePhoneNumber', () => {
    it('should parse US number with country code', () => {
      const result = parsePhoneNumber('+15551234567');
      expect(result.countryCode).toBe('1');
      expect(result.areaCode).toBe('555');
      expect(result.localNumber).toBe('1234567');
      expect(result.formatted).toBe('+1 (555) 123-4567');
    });

    it('should parse 10-digit US number', () => {
      const result = parsePhoneNumber('5551234567');
      expect(result.countryCode).toBe('1');
      expect(result.areaCode).toBe('555');
      expect(result.localNumber).toBe('1234567');
    });

    it('should handle international numbers', () => {
      const result = parsePhoneNumber('+442071234567');
      expect(result.countryCode).toBe('44');
      expect(result.areaCode).toBe('207');
    });
  });

  describe('isValidPhoneNumber', () => {
    it('should return true for valid 10-digit number', () => {
      expect(isValidPhoneNumber('5551234567')).toBe(true);
    });

    it('should return true for valid 11-digit number', () => {
      expect(isValidPhoneNumber('15551234567')).toBe(true);
    });

    it('should return true for valid E.164 format', () => {
      expect(isValidPhoneNumber('+15551234567')).toBe(true);
    });

    it('should return false for too short number', () => {
      expect(isValidPhoneNumber('123456')).toBe(false);
    });

    it('should return false for too long number', () => {
      expect(isValidPhoneNumber('1234567890123456')).toBe(false);
    });
  });

  describe('maskPhoneNumber', () => {
    it('should mask all but last 4 digits', () => {
      expect(maskPhoneNumber('+15551234567')).toBe('*******4567');
    });

    it('should handle short numbers', () => {
      expect(maskPhoneNumber('123')).toBe('****');
    });

    it('should handle numbers with formatting', () => {
      expect(maskPhoneNumber('(555) 123-4567')).toBe('******4567');
    });
  });

  describe('mapTwilioStatus', () => {
    it('should map queued to RINGING', () => {
      expect(mapTwilioStatus('queued')).toBe('RINGING');
    });

    it('should map ringing to RINGING', () => {
      expect(mapTwilioStatus('ringing')).toBe('RINGING');
    });

    it('should map in-progress to IN_PROGRESS', () => {
      expect(mapTwilioStatus('in-progress')).toBe('IN_PROGRESS');
    });

    it('should map initiated to IN_PROGRESS', () => {
      expect(mapTwilioStatus('initiated')).toBe('IN_PROGRESS');
    });

    it('should map answered to IN_PROGRESS', () => {
      expect(mapTwilioStatus('answered')).toBe('IN_PROGRESS');
    });

    it('should map completed to COMPLETED', () => {
      expect(mapTwilioStatus('completed')).toBe('COMPLETED');
    });

    it('should map busy to FAILED', () => {
      expect(mapTwilioStatus('busy')).toBe('FAILED');
    });

    it('should map failed to FAILED', () => {
      expect(mapTwilioStatus('failed')).toBe('FAILED');
    });

    it('should map canceled to FAILED', () => {
      expect(mapTwilioStatus('canceled')).toBe('FAILED');
    });

    it('should map no-answer to NO_ANSWER', () => {
      expect(mapTwilioStatus('no-answer')).toBe('NO_ANSWER');
    });

    it('should be case insensitive', () => {
      expect(mapTwilioStatus('COMPLETED')).toBe('COMPLETED');
      expect(mapTwilioStatus('In-Progress')).toBe('IN_PROGRESS');
    });

    it('should map unknown status to FAILED', () => {
      expect(mapTwilioStatus('unknown-status')).toBe('FAILED');
    });
  });

  describe('parseTwilioFormData', () => {
    it('should parse form data from request', async () => {
      const formData = new FormData();
      formData.append('CallSid', 'CA123');
      formData.append('From', '+15551234567');
      formData.append('To', '+15559876543');

      const mockRequest = {
        formData: jest.fn().mockResolvedValue(formData),
      } as unknown as Request;

      const result = await parseTwilioFormData(mockRequest);

      expect(result).toEqual({
        CallSid: 'CA123',
        From: '+15551234567',
        To: '+15559876543',
      });
    });
  });

  describe('getTwilioClient singleton', () => {
    it('should return the same instance on multiple calls', () => {
      const client1 = getTwilioClient();
      const client2 = getTwilioClient();
      expect(client1).toBe(client2);
    });

    it('should create new instance after reset', () => {
      const client1 = getTwilioClient();
      resetTwilioClient();
      const client2 = getTwilioClient();
      expect(client1).not.toBe(client2);
    });
  });
});
