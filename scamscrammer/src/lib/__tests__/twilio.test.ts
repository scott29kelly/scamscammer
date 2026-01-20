/**
 * Tests for Twilio Client Wrapper
 */

import { TwilioClient } from '../twilio';

// Mock the twilio module
jest.mock('twilio', () => {
  const mockTwiml = {
    VoiceResponse: jest.fn().mockImplementation(() => ({
      say: jest.fn().mockReturnThis(),
      connect: jest.fn().mockReturnValue({
        stream: jest.fn()
      }),
      hangup: jest.fn(),
      reject: jest.fn(),
      toString: jest.fn().mockReturnValue('<Response><Say>Test</Say></Response>')
    }))
  };

  const mockClientInstance = {
    calls: jest.fn().mockReturnValue({
      fetch: jest.fn().mockResolvedValue({
        sid: 'CA123',
        from: '+1234567890',
        to: '+0987654321',
        status: 'completed',
        direction: 'inbound',
        duration: '120'
      })
    }),
    recordings: jest.fn().mockReturnValue({
      fetch: jest.fn().mockResolvedValue({
        sid: 'RE123',
        callSid: 'CA123',
        duration: '120'
      })
    })
  };

  const mockClient = jest.fn().mockReturnValue(mockClientInstance);

  // Add static properties
  Object.defineProperty(mockClient, 'validateRequest', {
    value: jest.fn().mockReturnValue(true),
    writable: true
  });
  Object.defineProperty(mockClient, 'twiml', {
    value: mockTwiml,
    writable: true
  });

  return {
    __esModule: true,
    default: mockClient,
    validateRequest: jest.fn().mockReturnValue(true),
    twiml: mockTwiml
  };
});

describe('TwilioClient', () => {
  let client: TwilioClient;

  beforeEach(() => {
    client = new TwilioClient({
      accountSid: 'test_account_sid',
      authToken: 'test_auth_token',
      phoneNumber: '+1234567890'
    });
  });

  describe('generateStreamTwiML', () => {
    it('should generate TwiML for streaming', () => {
      const twiml = client.generateStreamTwiML({
        websocketUrl: 'wss://example.com/stream'
      });

      expect(typeof twiml).toBe('string');
      expect(twiml).toContain('Response');
    });

    it('should include greeting when provided', () => {
      const twiml = client.generateStreamTwiML({
        websocketUrl: 'wss://example.com/stream',
        greeting: 'Hello there!'
      });

      expect(typeof twiml).toBe('string');
    });
  });

  describe('generateSayTwiML', () => {
    it('should generate TwiML with speech', () => {
      const twiml = client.generateSayTwiML('Hello world');
      expect(typeof twiml).toBe('string');
    });
  });

  describe('generateHangupTwiML', () => {
    it('should generate hangup TwiML', () => {
      const twiml = client.generateHangupTwiML();
      expect(typeof twiml).toBe('string');
    });
  });

  describe('generateRejectTwiML', () => {
    it('should generate reject TwiML', () => {
      const twiml = client.generateRejectTwiML();
      expect(typeof twiml).toBe('string');
    });
  });

  describe('validateSignature', () => {
    it('should validate Twilio signature', () => {
      const result = client.validateSignature(
        'test-signature',
        'https://example.com/webhook',
        { key: 'value' }
      );

      expect(typeof result).toBe('boolean');
    });
  });

  describe('getCallDetails', () => {
    it('should return call details', async () => {
      const details = await client.getCallDetails('CA123');

      expect(details.sid).toBe('CA123');
      expect(details.from).toBe('+1234567890');
      expect(details.to).toBe('+0987654321');
      expect(details.status).toBe('completed');
      expect(details.direction).toBe('inbound');
      expect(details.duration).toBe(120);
    });
  });

  describe('getRecording', () => {
    it('should return recording details', async () => {
      const recording = await client.getRecording('RE123');

      expect(recording.sid).toBe('RE123');
      expect(recording.callSid).toBe('CA123');
    });
  });
});

describe('TwilioClient static methods', () => {
  describe('formatPhoneNumber', () => {
    it('should format 10-digit US numbers', () => {
      expect(TwilioClient.formatPhoneNumber('1234567890')).toBe('+11234567890');
    });

    it('should format 11-digit numbers with country code', () => {
      expect(TwilioClient.formatPhoneNumber('11234567890')).toBe('+11234567890');
    });

    it('should handle numbers with existing + prefix', () => {
      expect(TwilioClient.formatPhoneNumber('+11234567890')).toBe('+11234567890');
    });

    it('should strip non-digit characters', () => {
      expect(TwilioClient.formatPhoneNumber('(123) 456-7890')).toBe('+11234567890');
    });
  });

  describe('parseStreamMessage', () => {
    it('should parse valid JSON messages', () => {
      const message = TwilioClient.parseStreamMessage(
        JSON.stringify({ event: 'start', streamSid: 'MZ123' })
      );

      expect(message).toEqual({ event: 'start', streamSid: 'MZ123' });
    });

    it('should return null for invalid JSON', () => {
      const message = TwilioClient.parseStreamMessage('invalid json');
      expect(message).toBeNull();
    });

    it('should handle connected events', () => {
      const message = TwilioClient.parseStreamMessage(
        JSON.stringify({ event: 'connected', protocol: 'Call', version: '1.0.0' })
      );

      expect(message?.event).toBe('connected');
    });

    it('should handle media events', () => {
      const message = TwilioClient.parseStreamMessage(
        JSON.stringify({
          event: 'media',
          media: {
            track: 'inbound',
            chunk: '1',
            timestamp: '1234567890',
            payload: 'base64audio'
          }
        })
      );

      expect(message?.event).toBe('media');
    });
  });

  describe('createMediaMessage', () => {
    it('should create a valid media message', () => {
      const message = TwilioClient.createMediaMessage('MZ123', 'base64audio');
      const parsed = JSON.parse(message);

      expect(parsed.event).toBe('media');
      expect(parsed.streamSid).toBe('MZ123');
      expect(parsed.media.payload).toBe('base64audio');
    });
  });

  describe('createMarkMessage', () => {
    it('should create a valid mark message', () => {
      const message = TwilioClient.createMarkMessage('MZ123', 'test-mark');
      const parsed = JSON.parse(message);

      expect(parsed.event).toBe('mark');
      expect(parsed.streamSid).toBe('MZ123');
      expect(parsed.mark.name).toBe('test-mark');
    });
  });

  describe('createClearMessage', () => {
    it('should create a valid clear message', () => {
      const message = TwilioClient.createClearMessage('MZ123');
      const parsed = JSON.parse(message);

      expect(parsed.event).toBe('clear');
      expect(parsed.streamSid).toBe('MZ123');
    });
  });
});
