/**
 * Tests for Twilio Client and Helpers
 */

import {
  formatPhoneNumber,
  isValidPhoneNumber,
  generateTwiMLResponse,
  generateFallbackTwiML,
  generateStreamTwiML,
  generateGreetingAndStreamTwiML,
  isTwilioWebhookPayload,
} from "../twilio";

describe("Phone Number Utilities", () => {
  describe("formatPhoneNumber", () => {
    it("should format 10-digit US number to E.164", () => {
      expect(formatPhoneNumber("5551234567")).toBe("+15551234567");
    });

    it("should format 11-digit US number with country code", () => {
      expect(formatPhoneNumber("15551234567")).toBe("+15551234567");
    });

    it("should preserve already formatted E.164 number", () => {
      expect(formatPhoneNumber("+15551234567")).toBe("+15551234567");
    });

    it("should strip non-digit characters", () => {
      expect(formatPhoneNumber("(555) 123-4567")).toBe("+15551234567");
      expect(formatPhoneNumber("555.123.4567")).toBe("+15551234567");
      expect(formatPhoneNumber("555-123-4567")).toBe("+15551234567");
    });

    it("should handle international numbers", () => {
      expect(formatPhoneNumber("+442071234567")).toBe("+442071234567");
    });

    it("should add + prefix to bare digit strings", () => {
      expect(formatPhoneNumber("442071234567")).toBe("+442071234567");
    });
  });

  describe("isValidPhoneNumber", () => {
    it("should return true for valid E.164 numbers", () => {
      expect(isValidPhoneNumber("+15551234567")).toBe(true);
      expect(isValidPhoneNumber("+442071234567")).toBe(true);
    });

    it("should return true for formattable US numbers", () => {
      expect(isValidPhoneNumber("5551234567")).toBe(true);
      expect(isValidPhoneNumber("15551234567")).toBe(true);
      expect(isValidPhoneNumber("(555) 123-4567")).toBe(true);
    });

    it("should return false for invalid numbers", () => {
      expect(isValidPhoneNumber("")).toBe(false);
      expect(isValidPhoneNumber("123")).toBe(false);
      expect(isValidPhoneNumber("abc")).toBe(false);
    });
  });
});

describe("TwiML Generation", () => {
  describe("generateTwiMLResponse", () => {
    it("should generate valid TwiML with message", () => {
      const twiml = generateTwiMLResponse("Hello, this is Earl speaking.");

      expect(twiml).toContain("<?xml");
      expect(twiml).toContain("<Response>");
      expect(twiml).toContain("<Say");
      expect(twiml).toContain("Hello, this is Earl speaking.");
      expect(twiml).toContain("</Response>");
    });

    it("should use default voice when not specified", () => {
      const twiml = generateTwiMLResponse("Test message");

      expect(twiml).toContain('voice="Polly.Matthew"');
    });

    it("should use custom voice when specified", () => {
      const twiml = generateTwiMLResponse("Test message", { voice: "alice" });

      expect(twiml).toContain('voice="alice"');
    });

    it("should use default language when not specified", () => {
      const twiml = generateTwiMLResponse("Test message");

      expect(twiml).toContain('language="en-US"');
    });
  });

  describe("generateFallbackTwiML", () => {
    it("should generate TwiML with error message", () => {
      const twiml = generateFallbackTwiML();

      expect(twiml).toContain("<?xml");
      expect(twiml).toContain("<Response>");
      expect(twiml).toContain("<Say");
      expect(twiml).toContain("<Hangup");
    });

    it("should include friendly error message", () => {
      const twiml = generateFallbackTwiML();

      expect(twiml).toContain("confused");
      expect(twiml).toContain("hearing aid");
    });
  });

  describe("generateStreamTwiML", () => {
    it("should generate TwiML with stream connection", () => {
      const twiml = generateStreamTwiML("wss://example.com/stream");

      expect(twiml).toContain("<?xml");
      expect(twiml).toContain("<Response>");
      expect(twiml).toContain("<Connect>");
      expect(twiml).toContain("<Stream");
      expect(twiml).toContain("wss://example.com/stream");
    });
  });

  describe("generateGreetingAndStreamTwiML", () => {
    it("should include both greeting and stream", () => {
      const twiml = generateGreetingAndStreamTwiML(
        "Hello there!",
        "wss://example.com/stream"
      );

      expect(twiml).toContain("<Say");
      expect(twiml).toContain("Hello there!");
      expect(twiml).toContain("<Connect>");
      expect(twiml).toContain("<Stream");
      expect(twiml).toContain("wss://example.com/stream");
    });

    it("should use custom voice when specified", () => {
      const twiml = generateGreetingAndStreamTwiML(
        "Hello!",
        "wss://example.com/stream",
        { voice: "alice" }
      );

      expect(twiml).toContain('voice="alice"');
    });

    it("should include pause at the end", () => {
      const twiml = generateGreetingAndStreamTwiML(
        "Hello!",
        "wss://example.com/stream"
      );

      expect(twiml).toContain("<Pause");
    });
  });
});

describe("Webhook Payload Validation", () => {
  describe("isTwilioWebhookPayload", () => {
    it("should return true for valid payload", () => {
      const payload = {
        CallSid: "CA1234567890abcdef",
        AccountSid: "AC1234567890abcdef",
        From: "+15551234567",
        To: "+15559876543",
        CallStatus: "ringing",
      };

      expect(isTwilioWebhookPayload(payload)).toBe(true);
    });

    it("should return false if CallSid is missing", () => {
      const payload = {
        AccountSid: "AC1234567890abcdef",
        From: "+15551234567",
        To: "+15559876543",
        CallStatus: "ringing",
      };

      expect(isTwilioWebhookPayload(payload)).toBe(false);
    });

    it("should return false if AccountSid is missing", () => {
      const payload = {
        CallSid: "CA1234567890abcdef",
        From: "+15551234567",
        To: "+15559876543",
        CallStatus: "ringing",
      };

      expect(isTwilioWebhookPayload(payload)).toBe(false);
    });

    it("should return false if From is missing", () => {
      const payload = {
        CallSid: "CA1234567890abcdef",
        AccountSid: "AC1234567890abcdef",
        To: "+15559876543",
        CallStatus: "ringing",
      };

      expect(isTwilioWebhookPayload(payload)).toBe(false);
    });

    it("should return false if To is missing", () => {
      const payload = {
        CallSid: "CA1234567890abcdef",
        AccountSid: "AC1234567890abcdef",
        From: "+15551234567",
        CallStatus: "ringing",
      };

      expect(isTwilioWebhookPayload(payload)).toBe(false);
    });

    it("should return false if CallStatus is missing", () => {
      const payload = {
        CallSid: "CA1234567890abcdef",
        AccountSid: "AC1234567890abcdef",
        From: "+15551234567",
        To: "+15559876543",
      };

      expect(isTwilioWebhookPayload(payload)).toBe(false);
    });

    it("should return true with extra fields", () => {
      const payload = {
        CallSid: "CA1234567890abcdef",
        AccountSid: "AC1234567890abcdef",
        From: "+15551234567",
        To: "+15559876543",
        CallStatus: "ringing",
        CallerCity: "New York",
        CallerState: "NY",
        Direction: "inbound",
      };

      expect(isTwilioWebhookPayload(payload)).toBe(true);
    });
  });
});
