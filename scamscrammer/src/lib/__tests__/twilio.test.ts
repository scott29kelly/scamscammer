/**
 * Twilio Helper Utilities Tests
 */

import {
  formatPhoneNumber,
  formatPhoneNumberForDisplay,
  isValidPhoneNumber,
  isTwilioWebhookPayload,
  generateTwiMLResponse,
  generateStreamTwiML,
  generateGreetingAndStreamTwiML,
  generateHangupTwiML,
  generateFallbackTwiML,
  buildWebSocketUrl,
  getEarlGreeting,
} from '../twilio';

describe('Twilio Helper Utilities', () => {
  describe('formatPhoneNumber', () => {
    it('should format US 10-digit number to E.164', () => {
      expect(formatPhoneNumber('5551234567')).toBe('+15551234567');
    });

    it('should keep E.164 format unchanged', () => {
      expect(formatPhoneNumber('+15551234567')).toBe('+15551234567');
    });

    it('should handle US number with country code but no +', () => {
      expect(formatPhoneNumber('15551234567')).toBe('+15551234567');
    });

    it('should handle number with formatting characters', () => {
      expect(formatPhoneNumber('(555) 123-4567')).toBe('+15551234567');
    });

    it('should handle number with dots', () => {
      expect(formatPhoneNumber('555.123.4567')).toBe('+15551234567');
    });

    it('should preserve international numbers with +', () => {
      expect(formatPhoneNumber('+442071234567')).toBe('+442071234567');
    });
  });

  describe('formatPhoneNumberForDisplay', () => {
    it('should format US E.164 number for display', () => {
      expect(formatPhoneNumberForDisplay('+15551234567')).toBe('+1 (555) 123-4567');
    });

    it('should format 10-digit US number for display', () => {
      expect(formatPhoneNumberForDisplay('5551234567')).toBe('(555) 123-4567');
    });

    it('should return international numbers as-is', () => {
      const intlNumber = '+442071234567';
      expect(formatPhoneNumberForDisplay(intlNumber)).toBe(intlNumber);
    });
  });

  describe('isValidPhoneNumber', () => {
    it('should validate E.164 US number', () => {
      expect(isValidPhoneNumber('+15551234567')).toBe(true);
    });

    it('should validate 10-digit number', () => {
      expect(isValidPhoneNumber('5551234567')).toBe(true);
    });

    it('should validate international numbers', () => {
      expect(isValidPhoneNumber('+442071234567')).toBe(true);
    });

    it('should reject too short numbers', () => {
      expect(isValidPhoneNumber('12345')).toBe(false);
    });

    it('should reject too long numbers', () => {
      expect(isValidPhoneNumber('12345678901234567890')).toBe(false);
    });
  });

  describe('isTwilioWebhookPayload', () => {
    it('should return true for valid payload', () => {
      const payload = {
        CallSid: 'CA123',
        AccountSid: 'AC123',
        From: '+15551234567',
        To: '+15559876543',
      };
      expect(isTwilioWebhookPayload(payload)).toBe(true);
    });

    it('should return false for missing CallSid', () => {
      const payload = {
        AccountSid: 'AC123',
        From: '+15551234567',
        To: '+15559876543',
      };
      expect(isTwilioWebhookPayload(payload)).toBe(false);
    });

    it('should return false for missing AccountSid', () => {
      const payload = {
        CallSid: 'CA123',
        From: '+15551234567',
        To: '+15559876543',
      };
      expect(isTwilioWebhookPayload(payload)).toBe(false);
    });

    it('should return false for missing From', () => {
      const payload = {
        CallSid: 'CA123',
        AccountSid: 'AC123',
        To: '+15559876543',
      };
      expect(isTwilioWebhookPayload(payload)).toBe(false);
    });

    it('should return false for missing To', () => {
      const payload = {
        CallSid: 'CA123',
        AccountSid: 'AC123',
        From: '+15551234567',
      };
      expect(isTwilioWebhookPayload(payload)).toBe(false);
    });

    it('should return false for empty object', () => {
      expect(isTwilioWebhookPayload({})).toBe(false);
    });
  });

  describe('generateTwiMLResponse', () => {
    it('should generate valid TwiML with message', () => {
      const twiml = generateTwiMLResponse('Hello there!');
      expect(twiml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(twiml).toContain('<Response>');
      expect(twiml).toContain('<Say');
      expect(twiml).toContain('Hello there!');
      expect(twiml).toContain('</Response>');
    });

    it('should include voice attribute', () => {
      const twiml = generateTwiMLResponse('Test', { voice: 'Polly.Joanna' });
      expect(twiml).toContain('voice="Polly.Joanna"');
    });

    it('should include language attribute', () => {
      const twiml = generateTwiMLResponse('Test', { language: 'en-GB' });
      expect(twiml).toContain('language="en-GB"');
    });

    it('should include pause when specified', () => {
      const twiml = generateTwiMLResponse('Test', { pauseLength: 2 });
      expect(twiml).toContain('<Pause');
      expect(twiml).toContain('length="2"');
    });
  });

  describe('generateStreamTwiML', () => {
    it('should generate TwiML with stream connection', () => {
      const twiml = generateStreamTwiML('wss://example.com/stream');
      expect(twiml).toContain('<Response>');
      expect(twiml).toContain('<Connect>');
      expect(twiml).toContain('<Stream');
      expect(twiml).toContain('url="wss://example.com/stream"');
      expect(twiml).toContain('</Connect>');
    });

    it('should include track attribute', () => {
      const twiml = generateStreamTwiML('wss://example.com/stream', { track: 'inbound' });
      expect(twiml).toContain('track="inbound_track"');
    });

    it('should default to both tracks', () => {
      const twiml = generateStreamTwiML('wss://example.com/stream');
      expect(twiml).toContain('track="both_tracks"');
    });
  });

  describe('generateGreetingAndStreamTwiML', () => {
    it('should generate TwiML with greeting then stream', () => {
      const twiml = generateGreetingAndStreamTwiML(
        'Hello friend!',
        'wss://example.com/stream'
      );
      expect(twiml).toContain('<Response>');
      expect(twiml).toContain('<Say');
      expect(twiml).toContain('Hello friend!');
      expect(twiml).toContain('<Connect>');
      expect(twiml).toContain('<Stream');
      expect(twiml).toContain('url="wss://example.com/stream"');
    });

    it('should include voice and language options', () => {
      const twiml = generateGreetingAndStreamTwiML(
        'Hi there!',
        'wss://example.com/stream',
        { voice: 'Polly.Matthew', language: 'en-US' }
      );
      expect(twiml).toContain('voice="Polly.Matthew"');
      expect(twiml).toContain('language="en-US"');
    });
  });

  describe('generateHangupTwiML', () => {
    it('should generate TwiML with just hangup', () => {
      const twiml = generateHangupTwiML();
      expect(twiml).toContain('<Response>');
      expect(twiml).toContain('<Hangup/>');
    });

    it('should include message before hangup when provided', () => {
      const twiml = generateHangupTwiML('Goodbye!');
      expect(twiml).toContain('<Say');
      expect(twiml).toContain('Goodbye!');
      expect(twiml).toContain('<Hangup/>');
    });
  });

  describe('generateFallbackTwiML', () => {
    it('should generate fallback message with hangup', () => {
      const twiml = generateFallbackTwiML();
      expect(twiml).toContain('<Response>');
      expect(twiml).toContain('<Say');
      expect(twiml).toContain('hearing aid');
      expect(twiml).toContain('<Hangup/>');
    });
  });

  describe('buildWebSocketUrl', () => {
    it('should convert https to wss', () => {
      const wsUrl = buildWebSocketUrl('https://example.com', 'CA123');
      expect(wsUrl).toBe('wss://example.com/api/voice/stream?callSid=CA123');
    });

    it('should convert http to ws', () => {
      const wsUrl = buildWebSocketUrl('http://localhost:3000', 'CA123');
      expect(wsUrl).toBe('ws://localhost:3000/api/voice/stream?callSid=CA123');
    });

    it('should URL encode the callSid', () => {
      const wsUrl = buildWebSocketUrl('https://example.com', 'CA123=test');
      expect(wsUrl).toContain('callSid=CA123%3Dtest');
    });
  });

  describe('getEarlGreeting', () => {
    it('should return a non-empty greeting', () => {
      const greeting = getEarlGreeting();
      expect(typeof greeting).toBe('string');
      expect(greeting.length).toBeGreaterThan(50);
    });

    it('should mention Earl', () => {
      // Run multiple times to ensure Earl is mentioned
      for (let i = 0; i < 10; i++) {
        const greeting = getEarlGreeting();
        expect(greeting.toLowerCase()).toContain('earl');
      }
    });

    it('should return different greetings (randomization)', () => {
      const greetings = new Set<string>();
      // Get 20 greetings - should get at least 2 different ones
      for (let i = 0; i < 20; i++) {
        greetings.add(getEarlGreeting());
      }
      expect(greetings.size).toBeGreaterThan(1);
    });
  });
});
