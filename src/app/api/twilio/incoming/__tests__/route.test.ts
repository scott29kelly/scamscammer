/**
 * Tests for Twilio Incoming Call Webhook Handler
 */

import { NextRequest } from "next/server";
import { POST, OPTIONS } from "../route";

// Mock the dependencies
jest.mock("@/lib/db", () => ({
  prisma: {
    call: {
      create: jest.fn(),
    },
  },
}));

jest.mock("@/lib/twilio", () => ({
  parseTwilioWebhookBody: jest.fn(),
  validateTwilioSignature: jest.fn(),
  generateGreetingAndStreamTwiML: jest.fn(),
  generateFallbackTwiML: jest.fn(),
  isTwilioWebhookPayload: jest.fn(),
  formatPhoneNumber: jest.fn((num) => num),
}));

jest.mock("@/lib/persona", () => ({
  getEarlGreeting: jest.fn(),
}));

// Import mocked modules
import { prisma } from "@/lib/db";
import {
  parseTwilioWebhookBody,
  validateTwilioSignature,
  generateGreetingAndStreamTwiML,
  generateFallbackTwiML,
  isTwilioWebhookPayload,
  formatPhoneNumber,
} from "@/lib/twilio";
import { getEarlGreeting } from "@/lib/persona";

// Type the mocked functions
const mockPrismaCallCreate = prisma.call.create as jest.Mock;
const mockParseTwilioWebhookBody = parseTwilioWebhookBody as jest.Mock;
const mockValidateTwilioSignature = validateTwilioSignature as jest.Mock;
const mockGenerateGreetingAndStreamTwiML = generateGreetingAndStreamTwiML as jest.Mock;
const mockGenerateFallbackTwiML = generateFallbackTwiML as jest.Mock;
const mockIsTwilioWebhookPayload = isTwilioWebhookPayload as jest.Mock;
const mockFormatPhoneNumber = formatPhoneNumber as jest.Mock;
const mockGetEarlGreeting = getEarlGreeting as jest.Mock;

// Helper to create a mock NextRequest
function createMockRequest(options: {
  method?: string;
  body?: Record<string, string>;
  headers?: Record<string, string>;
} = {}): NextRequest {
  const { method = "POST", headers = {} } = options;

  return {
    method,
    url: "https://example.com/api/twilio/incoming",
    headers: {
      get: (name: string) => headers[name] || null,
    },
    text: jest.fn().mockResolvedValue(""),
  } as unknown as NextRequest;
}

// Sample valid Twilio webhook payload
const validTwilioPayload = {
  CallSid: "CA1234567890abcdef",
  AccountSid: "AC1234567890abcdef",
  From: "+15551234567",
  To: "+15559876543",
  CallStatus: "ringing",
  Direction: "inbound",
  ApiVersion: "2010-04-01",
};

describe("Twilio Incoming Call Webhook Handler", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Set up default mock implementations
    mockParseTwilioWebhookBody.mockResolvedValue(validTwilioPayload);
    mockValidateTwilioSignature.mockResolvedValue(true);
    mockIsTwilioWebhookPayload.mockReturnValue(true);
    mockFormatPhoneNumber.mockImplementation((num) => num);
    mockGetEarlGreeting.mockReturnValue("Hello? Who's there?");
    mockGenerateGreetingAndStreamTwiML.mockReturnValue(
      '<?xml version="1.0" encoding="UTF-8"?><Response><Say>Hello</Say></Response>'
    );
    mockGenerateFallbackTwiML.mockReturnValue(
      '<?xml version="1.0" encoding="UTF-8"?><Response><Say>Error</Say></Response>'
    );
    mockPrismaCallCreate.mockResolvedValue({
      id: "test-call-id",
      twilioSid: validTwilioPayload.CallSid,
      fromNumber: validTwilioPayload.From,
      toNumber: validTwilioPayload.To,
      status: "RINGING",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });

  describe("POST handler", () => {
    it("should return TwiML response for valid incoming call", async () => {
      const request = createMockRequest();
      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toBe("application/xml");

      const body = await response.text();
      expect(body).toContain("<?xml");
    });

    it("should parse the webhook body", async () => {
      const request = createMockRequest();
      await POST(request);

      expect(mockParseTwilioWebhookBody).toHaveBeenCalledWith(request);
    });

    it("should validate Twilio signature", async () => {
      const request = createMockRequest();
      await POST(request);

      expect(mockValidateTwilioSignature).toHaveBeenCalledWith(
        request,
        validTwilioPayload
      );
    });

    it("should return 403 for invalid signature", async () => {
      mockValidateTwilioSignature.mockResolvedValue(false);

      const request = createMockRequest();
      const response = await POST(request);

      expect(response.status).toBe(403);
    });

    it("should create call record in database", async () => {
      const request = createMockRequest();
      await POST(request);

      expect(mockPrismaCallCreate).toHaveBeenCalledWith({
        data: {
          twilioSid: validTwilioPayload.CallSid,
          fromNumber: validTwilioPayload.From,
          toNumber: validTwilioPayload.To,
          status: "RINGING",
        },
      });
    });

    it("should format phone numbers", async () => {
      const request = createMockRequest();
      await POST(request);

      expect(mockFormatPhoneNumber).toHaveBeenCalledWith(validTwilioPayload.From);
      expect(mockFormatPhoneNumber).toHaveBeenCalledWith(validTwilioPayload.To);
    });

    it("should get Earl greeting", async () => {
      const request = createMockRequest();
      await POST(request);

      expect(mockGetEarlGreeting).toHaveBeenCalled();
    });

    it("should generate TwiML with greeting and stream URL", async () => {
      const request = createMockRequest();
      await POST(request);

      expect(mockGenerateGreetingAndStreamTwiML).toHaveBeenCalledWith(
        "Hello? Who's there?",
        expect.stringContaining("/api/voice/stream"),
        expect.objectContaining({
          voice: "Polly.Matthew",
          language: "en-US",
          record: true,
        })
      );
    });

    it("should return fallback TwiML for invalid payload", async () => {
      mockIsTwilioWebhookPayload.mockReturnValue(false);

      const request = createMockRequest();
      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(mockGenerateFallbackTwiML).toHaveBeenCalled();
    });

    it("should continue even if database create fails", async () => {
      mockPrismaCallCreate.mockRejectedValue(new Error("Database error"));

      const request = createMockRequest();
      const response = await POST(request);

      // Should still return success with TwiML
      expect(response.status).toBe(200);
      expect(mockGenerateGreetingAndStreamTwiML).toHaveBeenCalled();
    });

    it("should return fallback TwiML on unexpected error", async () => {
      mockParseTwilioWebhookBody.mockRejectedValue(new Error("Parse error"));

      const request = createMockRequest();
      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(mockGenerateFallbackTwiML).toHaveBeenCalled();
    });

    it("should handle missing optional fields in payload", async () => {
      const minimalPayload = {
        CallSid: "CA1234567890abcdef",
        AccountSid: "AC1234567890abcdef",
        From: "+15551234567",
        To: "+15559876543",
        CallStatus: "ringing",
      };
      mockParseTwilioWebhookBody.mockResolvedValue(minimalPayload);

      const request = createMockRequest();
      const response = await POST(request);

      expect(response.status).toBe(200);
    });
  });

  describe("OPTIONS handler", () => {
    it("should return 204 with CORS headers", async () => {
      const response = await OPTIONS();

      expect(response.status).toBe(204);
      expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
      expect(response.headers.get("Access-Control-Allow-Methods")).toBe("POST, OPTIONS");
      expect(response.headers.get("Access-Control-Allow-Headers")).toContain(
        "X-Twilio-Signature"
      );
    });
  });
});

describe("TwiML Response Format", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockParseTwilioWebhookBody.mockResolvedValue(validTwilioPayload);
    mockValidateTwilioSignature.mockResolvedValue(true);
    mockIsTwilioWebhookPayload.mockReturnValue(true);
    mockGetEarlGreeting.mockReturnValue("Hello!");
    mockPrismaCallCreate.mockResolvedValue({ id: "test" });
  });

  it("should return valid XML Content-Type", async () => {
    mockGenerateGreetingAndStreamTwiML.mockReturnValue(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>'
    );

    const request = createMockRequest();
    const response = await POST(request);

    expect(response.headers.get("Content-Type")).toBe("application/xml");
  });

  it("should include XML declaration in response", async () => {
    const xmlResponse =
      '<?xml version="1.0" encoding="UTF-8"?><Response><Say>Hello</Say></Response>';
    mockGenerateGreetingAndStreamTwiML.mockReturnValue(xmlResponse);

    const request = createMockRequest();
    const response = await POST(request);

    const body = await response.text();
    expect(body).toBe(xmlResponse);
  });
});

describe("Error Handling", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockParseTwilioWebhookBody.mockResolvedValue(validTwilioPayload);
    mockValidateTwilioSignature.mockResolvedValue(true);
    mockIsTwilioWebhookPayload.mockReturnValue(true);
    mockPrismaCallCreate.mockResolvedValue({ id: "test" });
    mockGetEarlGreeting.mockReturnValue("Hello!");
    mockGenerateFallbackTwiML.mockReturnValue("<Response><Say>Error</Say></Response>");
  });

  it("should catch and handle signature validation errors", async () => {
    mockValidateTwilioSignature.mockRejectedValue(new Error("Validation error"));

    const request = createMockRequest();
    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(mockGenerateFallbackTwiML).toHaveBeenCalled();
  });

  it("should catch and handle TwiML generation errors", async () => {
    mockGenerateGreetingAndStreamTwiML.mockImplementation(() => {
      throw new Error("TwiML generation failed");
    });

    const request = createMockRequest();
    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(mockGenerateFallbackTwiML).toHaveBeenCalled();
  });

  it("should handle greeting retrieval errors", async () => {
    mockGetEarlGreeting.mockImplementation(() => {
      throw new Error("Greeting error");
    });

    const request = createMockRequest();
    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(mockGenerateFallbackTwiML).toHaveBeenCalled();
  });
});

describe("WebSocket URL Generation", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    mockParseTwilioWebhookBody.mockResolvedValue(validTwilioPayload);
    mockValidateTwilioSignature.mockResolvedValue(true);
    mockIsTwilioWebhookPayload.mockReturnValue(true);
    mockPrismaCallCreate.mockResolvedValue({ id: "test" });
    mockGetEarlGreeting.mockReturnValue("Hello!");
    mockGenerateGreetingAndStreamTwiML.mockReturnValue("<Response></Response>");
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("should generate wss:// URL for https:// APP_URL", async () => {
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_APP_URL: "https://example.com",
    };

    // Re-import to get new env
    jest.resetModules();
    const { POST: freshPOST } = await import("../route");

    const request = createMockRequest();
    await freshPOST(request);

    expect(mockGenerateGreetingAndStreamTwiML).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringMatching(/^wss?:\/\//),
      expect.any(Object)
    );
  });
});
