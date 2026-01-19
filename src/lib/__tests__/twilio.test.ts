/**
 * Tests for Twilio helper functions
 */

import {
  formatPhoneNumber,
  formatPhoneNumberForDisplay,
  isValidPhoneNumber,
  generateTwiMLResponse,
  generateStreamTwiML,
  generateGreetingAndStreamTwiML,
  generateHangupTwiML,
  generateFallbackTwiML,
} from '../twilio';

describe('Twilio Helper Functions', () => {
  // ===========================================================================
  // Phone Number Formatting Tests
  // ===========================================================================

  describe('formatPhoneNumber', () => {
    it('should keep numbers already in E.164 format', () => {
      expect(formatPhoneNumber('+15551234567')).toBe('+15551234567');
    });

    it('should add +1 to 10-digit US numbers', () => {
      expect(formatPhoneNumber('5551234567')).toBe('+15551234567');
    });

    it('should add + to 11-digit US numbers starting with 1', () => {
      expect(formatPhoneNumber('15551234567')).toBe('+15551234567');
    });

    it('should strip non-digit characters', () => {
      expect(formatPhoneNumber('(555) 123-4567')).toBe('+15551234567');
      expect(formatPhoneNumber('555.123.4567')).toBe('+15551234567');
      expect(formatPhoneNumber('555 123 4567')).toBe('+15551234567');
    });

    it('should handle international numbers', () => {
      expect(formatPhoneNumber('+44 20 7946 0958')).toBe('+442079460958');
    });

    it('should add + prefix to unformatted international numbers', () => {
      expect(formatPhoneNumber('442079460958')).toBe('+442079460958');
    });
  });

  describe('formatPhoneNumberForDisplay', () => {
    it('should format 10-digit US numbers with parentheses', () => {
      expect(formatPhoneNumberForDisplay('5551234567')).toBe('(555) 123-4567');
    });

    it('should format 11-digit US numbers (starting with 1)', () => {
      expect(formatPhoneNumberForDisplay('15551234567')).toBe('(555) 123-4567');
      expect(formatPhoneNumberForDisplay('+15551234567')).toBe('(555) 123-4567');
    });

    it('should return international numbers with + prefix', () => {
      expect(formatPhoneNumberForDisplay('+442079460958')).toBe('+442079460958');
    });

    it('should add + to non-standard length numbers', () => {
      expect(formatPhoneNumberForDisplay('442079460958')).toBe('+442079460958');
    });
  });

  describe('isValidPhoneNumber', () => {
    it('should accept 10-digit US numbers', () => {
      expect(isValidPhoneNumber('5551234567')).toBe(true);
    });

    it('should accept 11-digit numbers with country code', () => {
      expect(isValidPhoneNumber('15551234567')).toBe(true);
      expect(isValidPhoneNumber('+15551234567')).toBe(true);
    });

    it('should accept international numbers up to 15 digits', () => {
      expect(isValidPhoneNumber('+442079460958')).toBe(true);
      expect(isValidPhoneNumber('123456789012345')).toBe(true);
    });

    it('should reject numbers shorter than 10 digits', () => {
      expect(isValidPhoneNumber('123456789')).toBe(false);
      expect(isValidPhoneNumber('555123')).toBe(false);
    });

    it('should reject numbers longer than 15 digits', () => {
      expect(isValidPhoneNumber('1234567890123456')).toBe(false);
    });

    it('should ignore non-digit characters when validating', () => {
      expect(isValidPhoneNumber('(555) 123-4567')).toBe(true);
    });
  });

  // ===========================================================================
  // TwiML Generation Tests
  // ===========================================================================

  describe('generateTwiMLResponse', () => {
    it('should generate valid TwiML with message', () => {
      const twiml = generateTwiMLResponse('Hello, world!');
      expect(twiml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(twiml).toContain('<Response>');
      expect(twiml).toContain('<Say voice="alice">Hello, world!</Say>');
      expect(twiml).toContain('</Response>');
    });

    it('should escape XML special characters', () => {
      const twiml = generateTwiMLResponse('Test <script> & "quotes"');
      expect(twiml).toContain('&lt;script&gt;');
      expect(twiml).toContain('&amp;');
      expect(twiml).toContain('&quot;quotes&quot;');
    });

    it('should escape apostrophes', () => {
      const twiml = generateTwiMLResponse("It's a test");
      expect(twiml).toContain('&apos;');
    });
  });

  describe('generateStreamTwiML', () => {
    it('should generate TwiML with Stream element', () => {
      const twiml = generateStreamTwiML('wss://example.com/stream');
      expect(twiml).toContain('<Connect>');
      expect(twiml).toContain('<Stream url="wss://example.com/stream" />');
      expect(twiml).toContain('</Connect>');
    });

    it('should escape URL special characters', () => {
      const twiml = generateStreamTwiML('wss://example.com/stream?param=value&other=1');
      expect(twiml).toContain('&amp;');
    });
  });

  describe('generateGreetingAndStreamTwiML', () => {
    it('should generate TwiML with greeting then stream', () => {
      const twiml = generateGreetingAndStreamTwiML(
        'Hello there!',
        'wss://example.com/stream'
      );
      expect(twiml).toContain('<Say voice="alice">Hello there!</Say>');
      expect(twiml).toContain('<Connect>');
      expect(twiml).toContain('<Stream url="wss://example.com/stream" />');
    });

    it('should have Say before Connect/Stream', () => {
      const twiml = generateGreetingAndStreamTwiML(
        'Greeting',
        'wss://example.com/stream'
      );
      const sayIndex = twiml.indexOf('<Say');
      const connectIndex = twiml.indexOf('<Connect');
      expect(sayIndex).toBeLessThan(connectIndex);
    });
  });

  describe('generateHangupTwiML', () => {
    it('should generate TwiML with just Hangup when no message', () => {
      const twiml = generateHangupTwiML();
      expect(twiml).toContain('<Hangup />');
      expect(twiml).not.toContain('<Say');
    });

    it('should generate TwiML with message then Hangup', () => {
      const twiml = generateHangupTwiML('Goodbye!');
      expect(twiml).toContain('<Say voice="alice">Goodbye!</Say>');
      expect(twiml).toContain('<Hangup />');
    });

    it('should have Say before Hangup when message provided', () => {
      const twiml = generateHangupTwiML('Farewell');
      const sayIndex = twiml.indexOf('<Say');
      const hangupIndex = twiml.indexOf('<Hangup');
      expect(sayIndex).toBeLessThan(hangupIndex);
    });
  });

  describe('generateFallbackTwiML', () => {
    it('should generate error TwiML with message and hangup', () => {
      const twiml = generateFallbackTwiML();
      expect(twiml).toContain('<Say');
      expect(twiml).toContain('technical difficulties');
      expect(twiml).toContain('<Hangup />');
    });

    it('should be valid XML', () => {
      const twiml = generateFallbackTwiML();
      expect(twiml).toContain('<?xml version="1.0"');
      expect(twiml).toContain('<Response>');
      expect(twiml).toContain('</Response>');
    });
  });
});
