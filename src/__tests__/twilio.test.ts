/**
 * Tests for Twilio Client and Helpers
 */

import {
  TwilioClient,
  TwilioClientError,
  generateTwiMLResponse,
  generateStreamTwiML,
  generateGreetingAndStreamTwiML,
  generateHangupTwiML,
  generateFallbackTwiML,
  formatPhoneNumber,
  formatPhoneNumberForDisplay,
  isValidPhoneNumber,
  validateTwilioSignature,
  parseTwilioWebhookBody,
  getTwilioClient,
} from '../lib/twilio';

// ============================================================================
// TwiML Response Generation Tests
// ============================================================================

describe('TwiML Response Generation', () => {
  describe('generateTwiMLResponse', () => {
    it('should generate valid TwiML with a message', () => {
      const message = 'Hello, this is Earl speaking!';
      const twiml = generateTwiMLResponse(message);

      expect(twiml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(twiml).toContain('<Response>');
      expect(twiml).toContain('<Say');
      expect(twiml).toContain('Hello, this is Earl speaking!');
      expect(twiml).toContain('</Say>');
      expect(twiml).toContain('</Response>');
    });

    it('should use default voice Polly.Matthew', () => {
      const twiml = generateTwiMLResponse('Test message');
      expect(twiml).toContain('voice="Polly.Matthew"');
    });

    it('should use custom voice when specified', () => {
      const twiml = generateTwiMLResponse('Test message', { voice: 'alice' });
      expect(twiml).toContain('voice="alice"');
    });

    it('should handle special characters in message', () => {
      const message = 'Hello & goodbye <friend>';
      const twiml = generateTwiMLResponse(message);
      // TwiML should properly escape special characters
      expect(twiml).toContain('&amp;');
      expect(twiml).toContain('&lt;');
      expect(twiml).toContain('&gt;');
    });
  });

  describe('generateStreamTwiML', () => {
    it('should generate TwiML with Connect and Stream elements', () => {
      const websocketUrl = 'wss://example.com/voice/stream';
      const twiml = generateStreamTwiML(websocketUrl);

      expect(twiml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(twiml).toContain('<Response>');
      expect(twiml).toContain('<Connect>');
      expect(twiml).toContain('<Stream');
      expect(twiml).toContain(`url="${websocketUrl}"`);
      expect(twiml).toContain('</Stream>');
      expect(twiml).toContain('</Connect>');
      expect(twiml).toContain('</Response>');
    });

    it('should include parameter element', () => {
      const twiml = generateStreamTwiML('wss://example.com/stream');
      expect(twiml).toContain('<Parameter');
      expect(twiml).toContain('name="FirstMessage"');
    });
  });

  describe('generateGreetingAndStreamTwiML', () => {
    it('should include greeting before stream connection', () => {
      const greeting = 'Hello there!';
      const websocketUrl = 'wss://example.com/stream';
      const twiml = generateGreetingAndStreamTwiML(greeting, websocketUrl);

      expect(twiml).toContain('<Say');
      expect(twiml).toContain('Hello there!');
      expect(twiml).toContain('<Connect>');
      expect(twiml).toContain('<Stream');
    });

    it('should have Say before Connect in the XML', () => {
      const twiml = generateGreetingAndStreamTwiML(
        'Greeting',
        'wss://example.com'
      );
      const sayIndex = twiml.indexOf('<Say');
      const connectIndex = twiml.indexOf('<Connect>');
      expect(sayIndex).toBeLessThan(connectIndex);
    });
  });

  describe('generateHangupTwiML', () => {
    it('should generate hangup TwiML without message', () => {
      const twiml = generateHangupTwiML();

      expect(twiml).toContain('<Response>');
      expect(twiml).toContain('<Hangup/>');
      expect(twiml).not.toContain('<Say');
    });

    it('should include goodbye message when provided', () => {
      const message = 'Goodbye now!';
      const twiml = generateHangupTwiML(message);

      expect(twiml).toContain('<Say');
      expect(twiml).toContain('Goodbye now!');
      expect(twiml).toContain('<Hangup/>');
    });

    it('should have Say before Hangup when message provided', () => {
      const twiml = generateHangupTwiML('Bye!');
      const sayIndex = twiml.indexOf('<Say');
      const hangupIndex = twiml.indexOf('<Hangup');
      expect(sayIndex).toBeLessThan(hangupIndex);
    });
  });

  describe('generateFallbackTwiML', () => {
    it('should generate a polite error message', () => {
      const twiml = generateFallbackTwiML();

      expect(twiml).toContain('<Response>');
      expect(twiml).toContain('<Say');
      expect(twiml).toContain('trouble');
      expect(twiml).toContain('<Hangup/>');
    });

    it('should use Polly.Matthew voice', () => {
      const twiml = generateFallbackTwiML();
      expect(twiml).toContain('voice="Polly.Matthew"');
    });
  });
});

// ============================================================================
// Phone Number Formatting Tests
// ============================================================================

describe('Phone Number Formatting', () => {
  describe('formatPhoneNumber', () => {
    it('should format 10-digit US number to E.164', () => {
      expect(formatPhoneNumber('5551234567')).toBe('+15551234567');
    });

    it('should handle number with dashes', () => {
      expect(formatPhoneNumber('555-123-4567')).toBe('+15551234567');
    });

    it('should handle number with parentheses', () => {
      expect(formatPhoneNumber('(555) 123-4567')).toBe('+15551234567');
    });

    it('should handle number with spaces', () => {
      expect(formatPhoneNumber('555 123 4567')).toBe('+15551234567');
    });

    it('should preserve existing + prefix', () => {
      expect(formatPhoneNumber('+15551234567')).toBe('+15551234567');
    });

    it('should handle number starting with 1', () => {
      expect(formatPhoneNumber('15551234567')).toBe('+15551234567');
    });

    it('should handle international format with +', () => {
      expect(formatPhoneNumber('+44 20 7123 4567')).toBe('+442071234567');
    });

    it('should handle mixed formatting', () => {
      expect(formatPhoneNumber('+1 (555) 123-4567')).toBe('+15551234567');
    });
  });

  describe('formatPhoneNumberForDisplay', () => {
    it('should format E.164 US number for display', () => {
      expect(formatPhoneNumberForDisplay('+15551234567')).toBe(
        '(555) 123-4567'
      );
    });

    it('should handle number without +', () => {
      expect(formatPhoneNumberForDisplay('15551234567')).toBe('(555) 123-4567');
    });

    it('should return original for non-US numbers', () => {
      expect(formatPhoneNumberForDisplay('+442071234567')).toBe(
        '+442071234567'
      );
    });
  });

  describe('isValidPhoneNumber', () => {
    it('should return true for valid 10-digit number', () => {
      expect(isValidPhoneNumber('5551234567')).toBe(true);
    });

    it('should return true for valid 11-digit number', () => {
      expect(isValidPhoneNumber('15551234567')).toBe(true);
    });

    it('should return true for E.164 format', () => {
      expect(isValidPhoneNumber('+15551234567')).toBe(true);
    });

    it('should return false for too short number', () => {
      expect(isValidPhoneNumber('555123')).toBe(false);
    });

    it('should return false for too long number', () => {
      expect(isValidPhoneNumber('12345678901234567890')).toBe(false);
    });

    it('should handle formatted numbers', () => {
      expect(isValidPhoneNumber('(555) 123-4567')).toBe(true);
    });
  });
});

// ============================================================================
// TwilioClient Tests
// ============================================================================

describe('TwilioClient', () => {
  describe('constructor', () => {
    it('should create client with valid environment variables', () => {
      const client = new TwilioClient();
      expect(client).toBeInstanceOf(TwilioClient);
    });

    it('should throw error when TWILIO_ACCOUNT_SID is missing', () => {
      const originalSid = process.env.TWILIO_ACCOUNT_SID;
      delete process.env.TWILIO_ACCOUNT_SID;

      expect(() => new TwilioClient()).toThrow(
        'TWILIO_ACCOUNT_SID environment variable is not set'
      );

      process.env.TWILIO_ACCOUNT_SID = originalSid;
    });

    it('should throw error when TWILIO_AUTH_TOKEN is missing', () => {
      const originalToken = process.env.TWILIO_AUTH_TOKEN;
      delete process.env.TWILIO_AUTH_TOKEN;

      expect(() => new TwilioClient()).toThrow(
        'TWILIO_AUTH_TOKEN environment variable is not set'
      );

      process.env.TWILIO_AUTH_TOKEN = originalToken;
    });
  });

  describe('getPhoneNumber', () => {
    it('should return configured phone number', () => {
      const client = new TwilioClient();
      expect(client.getPhoneNumber()).toBe('+15551234567');
    });

    it('should throw error when phone number not set', () => {
      const originalNumber = process.env.TWILIO_PHONE_NUMBER;
      delete process.env.TWILIO_PHONE_NUMBER;

      const client = new TwilioClient();
      expect(() => client.getPhoneNumber()).toThrow(
        'TWILIO_PHONE_NUMBER environment variable is not set'
      );

      process.env.TWILIO_PHONE_NUMBER = originalNumber;
    });
  });

  describe('getClient', () => {
    it('should return underlying Twilio client', () => {
      const client = new TwilioClient();
      const twilioClient = client.getClient();
      expect(twilioClient).toBeDefined();
    });
  });
});

// ============================================================================
// getTwilioClient Singleton Tests
// ============================================================================

describe('getTwilioClient', () => {
  it('should return a TwilioClient instance', () => {
    const client = getTwilioClient();
    expect(client).toBeInstanceOf(TwilioClient);
  });

  it('should return the same instance on multiple calls', () => {
    const client1 = getTwilioClient();
    const client2 = getTwilioClient();
    expect(client1).toBe(client2);
  });
});

// ============================================================================
// TwilioClientError Tests
// ============================================================================

describe('TwilioClientError', () => {
  it('should create error with message', () => {
    const error = new TwilioClientError('Test error');
    expect(error.message).toBe('Test error');
    expect(error.name).toBe('TwilioClientError');
  });

  it('should include cause when provided', () => {
    const cause = new Error('Original error');
    const error = new TwilioClientError('Wrapped error', cause);
    expect(error.cause).toBe(cause);
  });

  it('should be instanceof Error', () => {
    const error = new TwilioClientError('Test');
    expect(error).toBeInstanceOf(Error);
  });
});

// ============================================================================
// Webhook Signature Validation Tests
// ============================================================================

describe('Webhook Signature Validation', () => {
  describe('parseTwilioWebhookBody', () => {
    it('should parse form data into object', async () => {
      const formData = new FormData();
      formData.append('CallSid', 'CA123');
      formData.append('From', '+15551234567');
      formData.append('To', '+15559876543');

      const mockRequest = {
        formData: async () => formData,
      } as unknown as import('next/server').NextRequest;

      const body = await parseTwilioWebhookBody(mockRequest);

      expect(body).toEqual({
        CallSid: 'CA123',
        From: '+15551234567',
        To: '+15559876543',
      });
    });
  });

  describe('validateTwilioSignature', () => {
    it('should return false when signature header is missing', async () => {
      const mockRequest = {
        headers: {
          get: jest.fn().mockReturnValue(null),
        },
        url: 'https://example.com/api/twilio/incoming',
      } as unknown as import('next/server').NextRequest;

      const result = await validateTwilioSignature(mockRequest, {});
      expect(result).toBe(false);
    });

    it('should return false when auth token is not set', async () => {
      const originalToken = process.env.TWILIO_AUTH_TOKEN;
      delete process.env.TWILIO_AUTH_TOKEN;

      const mockRequest = {
        headers: {
          get: jest.fn().mockReturnValue('some-signature'),
        },
        url: 'https://example.com/api/twilio/incoming',
      } as unknown as import('next/server').NextRequest;

      const result = await validateTwilioSignature(mockRequest, {});
      expect(result).toBe(false);

      process.env.TWILIO_AUTH_TOKEN = originalToken;
    });
  });
});
