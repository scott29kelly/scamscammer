/**
 * Tests for Call Status Webhook Handler
 *
 * Tests cover:
 * - Valid status updates for all Twilio statuses
 * - Invalid signature rejection
 * - Missing required fields
 * - Call not found scenarios
 * - Terminal state handling
 * - Duration parsing
 * - HTTP method restrictions
 */

import { NextRequest } from 'next/server';
import { POST, GET, PUT, DELETE } from '../route';
import { prisma } from '@/lib/db';
import { CallStatus } from '@/types';
import * as twilioLib from '@/lib/twilio';

// Mock the Prisma client
jest.mock('@/lib/db', () => ({
  prisma: {
    call: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}));

// Mock the Twilio library
jest.mock('@/lib/twilio', () => ({
  validateTwilioSignature: jest.fn(),
  parseTwilioWebhookBody: jest.fn(),
}));

describe('Call Status Webhook Handler', () => {
  const mockPrisma = prisma as jest.Mocked<typeof prisma>;
  const mockTwilioLib = twilioLib as jest.Mocked<typeof twilioLib>;

  // Helper to create a mock NextRequest
  function createMockRequest(body: Record<string, string>): NextRequest {
    return {
      headers: new Headers({
        'content-type': 'application/x-www-form-urlencoded',
        'x-twilio-signature': 'valid-signature',
      }),
      url: 'https://example.com/api/twilio/status',
    } as unknown as NextRequest;
  }

  // Helper to create a standard status payload
  function createStatusPayload(
    overrides: Partial<Record<string, string>> = {}
  ): Record<string, string> {
    return {
      CallSid: 'CA1234567890abcdef1234567890abcdef',
      AccountSid: 'AC1234567890abcdef1234567890abcdef',
      From: '+15551234567',
      To: '+15559876543',
      CallStatus: 'in-progress',
      ApiVersion: '2010-04-01',
      Direction: 'inbound',
      ...overrides,
    };
  }

  beforeEach(() => {
    jest.clearAllMocks();
    // Default to valid signature
    mockTwilioLib.validateTwilioSignature.mockResolvedValue(true);
  });

  // ===========================================================================
  // Signature Validation Tests
  // ===========================================================================

  describe('Signature Validation', () => {
    it('should reject requests with invalid Twilio signature', async () => {
      const payload = createStatusPayload();
      mockTwilioLib.parseTwilioWebhookBody.mockResolvedValue(payload);
      mockTwilioLib.validateTwilioSignature.mockResolvedValue(false);

      const request = createMockRequest(payload);
      const response = await POST(request);

      expect(response.status).toBe(403);
      const body = await response.json();
      expect(body.error).toBe('Invalid signature');
    });

    it('should accept requests with valid Twilio signature', async () => {
      const payload = createStatusPayload();
      mockTwilioLib.parseTwilioWebhookBody.mockResolvedValue(payload);
      mockTwilioLib.validateTwilioSignature.mockResolvedValue(true);

      (mockPrisma.call.findUnique as jest.Mock).mockResolvedValue({
        id: 'call-123',
        status: CallStatus.RINGING,
      });
      (mockPrisma.call.update as jest.Mock).mockResolvedValue({
        id: 'call-123',
        status: CallStatus.IN_PROGRESS,
        duration: null,
      });

      const request = createMockRequest(payload);
      const response = await POST(request);

      expect(response.status).toBe(200);
    });
  });

  // ===========================================================================
  // Required Field Validation Tests
  // ===========================================================================

  describe('Required Field Validation', () => {
    it('should return 400 when CallSid is missing', async () => {
      const payload = createStatusPayload({ CallSid: '' });
      delete (payload as Record<string, string>).CallSid;
      mockTwilioLib.parseTwilioWebhookBody.mockResolvedValue(payload);

      const request = createMockRequest(payload);
      const response = await POST(request);

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toBe('Missing CallSid');
    });

    it('should return 400 when CallStatus is missing', async () => {
      const payload = createStatusPayload({ CallStatus: '' });
      delete (payload as Record<string, string>).CallStatus;
      mockTwilioLib.parseTwilioWebhookBody.mockResolvedValue(payload);

      const request = createMockRequest(payload);
      const response = await POST(request);

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toBe('Missing CallStatus');
    });
  });

  // ===========================================================================
  // Status Mapping Tests
  // ===========================================================================

  describe('Status Mapping', () => {
    const statusMappings: Array<{ twilioStatus: string; expectedStatus: CallStatus }> = [
      { twilioStatus: 'queued', expectedStatus: CallStatus.RINGING },
      { twilioStatus: 'ringing', expectedStatus: CallStatus.RINGING },
      { twilioStatus: 'in-progress', expectedStatus: CallStatus.IN_PROGRESS },
      { twilioStatus: 'completed', expectedStatus: CallStatus.COMPLETED },
      { twilioStatus: 'busy', expectedStatus: CallStatus.FAILED },
      { twilioStatus: 'failed', expectedStatus: CallStatus.FAILED },
      { twilioStatus: 'no-answer', expectedStatus: CallStatus.NO_ANSWER },
      { twilioStatus: 'canceled', expectedStatus: CallStatus.FAILED },
    ];

    statusMappings.forEach(({ twilioStatus, expectedStatus }) => {
      it(`should map Twilio status '${twilioStatus}' to ${expectedStatus}`, async () => {
        const payload = createStatusPayload({ CallStatus: twilioStatus });
        mockTwilioLib.parseTwilioWebhookBody.mockResolvedValue(payload);

        (mockPrisma.call.findUnique as jest.Mock).mockResolvedValue({
          id: 'call-123',
          status: CallStatus.RINGING,
        });
        (mockPrisma.call.update as jest.Mock).mockResolvedValue({
          id: 'call-123',
          status: expectedStatus,
          duration: null,
        });

        const request = createMockRequest(payload);
        const response = await POST(request);

        expect(response.status).toBe(200);
        expect(mockPrisma.call.update).toHaveBeenCalledWith({
          where: { twilioSid: payload.CallSid },
          data: expect.objectContaining({ status: expectedStatus }),
          select: { id: true, status: true, duration: true },
        });
      });
    });
  });

  // ===========================================================================
  // Call Not Found Tests
  // ===========================================================================

  describe('Call Not Found Handling', () => {
    it('should return 200 with warning when call not found', async () => {
      const payload = createStatusPayload();
      mockTwilioLib.parseTwilioWebhookBody.mockResolvedValue(payload);
      (mockPrisma.call.findUnique as jest.Mock).mockResolvedValue(null);

      const request = createMockRequest(payload);
      const response = await POST(request);

      // Return 200 to prevent Twilio retries
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.warning).toBe('Call not found');
      expect(body.callSid).toBe(payload.CallSid);
    });

    it('should not attempt to update when call not found', async () => {
      const payload = createStatusPayload();
      mockTwilioLib.parseTwilioWebhookBody.mockResolvedValue(payload);
      (mockPrisma.call.findUnique as jest.Mock).mockResolvedValue(null);

      const request = createMockRequest(payload);
      await POST(request);

      expect(mockPrisma.call.update).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // Terminal State Tests
  // ===========================================================================

  describe('Terminal State Handling', () => {
    const terminalStates = [
      CallStatus.COMPLETED,
      CallStatus.FAILED,
      CallStatus.NO_ANSWER,
    ];

    terminalStates.forEach((terminalState) => {
      it(`should not update call already in ${terminalState} state`, async () => {
        const payload = createStatusPayload({ CallStatus: 'in-progress' });
        mockTwilioLib.parseTwilioWebhookBody.mockResolvedValue(payload);
        (mockPrisma.call.findUnique as jest.Mock).mockResolvedValue({
          id: 'call-123',
          status: terminalState,
        });

        const request = createMockRequest(payload);
        const response = await POST(request);

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.success).toBe(true);
        expect(body.status).toBe('already_terminal');
        expect(mockPrisma.call.update).not.toHaveBeenCalled();
      });
    });

    it('should update call from RINGING to IN_PROGRESS', async () => {
      const payload = createStatusPayload({ CallStatus: 'in-progress' });
      mockTwilioLib.parseTwilioWebhookBody.mockResolvedValue(payload);
      (mockPrisma.call.findUnique as jest.Mock).mockResolvedValue({
        id: 'call-123',
        status: CallStatus.RINGING,
      });
      (mockPrisma.call.update as jest.Mock).mockResolvedValue({
        id: 'call-123',
        status: CallStatus.IN_PROGRESS,
        duration: null,
      });

      const request = createMockRequest(payload);
      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(mockPrisma.call.update).toHaveBeenCalled();
    });

    it('should update call from IN_PROGRESS to COMPLETED', async () => {
      const payload = createStatusPayload({
        CallStatus: 'completed',
        CallDuration: '120',
      });
      mockTwilioLib.parseTwilioWebhookBody.mockResolvedValue(payload);
      (mockPrisma.call.findUnique as jest.Mock).mockResolvedValue({
        id: 'call-123',
        status: CallStatus.IN_PROGRESS,
      });
      (mockPrisma.call.update as jest.Mock).mockResolvedValue({
        id: 'call-123',
        status: CallStatus.COMPLETED,
        duration: 120,
      });

      const request = createMockRequest(payload);
      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(mockPrisma.call.update).toHaveBeenCalledWith({
        where: { twilioSid: payload.CallSid },
        data: { status: CallStatus.COMPLETED, duration: 120 },
        select: { id: true, status: true, duration: true },
      });
    });
  });

  // ===========================================================================
  // Duration Parsing Tests
  // ===========================================================================

  describe('Duration Parsing', () => {
    it('should parse and save valid duration on completed status', async () => {
      const payload = createStatusPayload({
        CallStatus: 'completed',
        CallDuration: '300',
      });
      mockTwilioLib.parseTwilioWebhookBody.mockResolvedValue(payload);
      (mockPrisma.call.findUnique as jest.Mock).mockResolvedValue({
        id: 'call-123',
        status: CallStatus.IN_PROGRESS,
      });
      (mockPrisma.call.update as jest.Mock).mockResolvedValue({
        id: 'call-123',
        status: CallStatus.COMPLETED,
        duration: 300,
      });

      const request = createMockRequest(payload);
      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(mockPrisma.call.update).toHaveBeenCalledWith({
        where: { twilioSid: payload.CallSid },
        data: { status: CallStatus.COMPLETED, duration: 300 },
        select: { id: true, status: true, duration: true },
      });
    });

    it('should handle duration of 0', async () => {
      const payload = createStatusPayload({
        CallStatus: 'completed',
        CallDuration: '0',
      });
      mockTwilioLib.parseTwilioWebhookBody.mockResolvedValue(payload);
      (mockPrisma.call.findUnique as jest.Mock).mockResolvedValue({
        id: 'call-123',
        status: CallStatus.IN_PROGRESS,
      });
      (mockPrisma.call.update as jest.Mock).mockResolvedValue({
        id: 'call-123',
        status: CallStatus.COMPLETED,
        duration: 0,
      });

      const request = createMockRequest(payload);
      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(mockPrisma.call.update).toHaveBeenCalledWith({
        where: { twilioSid: payload.CallSid },
        data: { status: CallStatus.COMPLETED, duration: 0 },
        select: { id: true, status: true, duration: true },
      });
    });

    it('should handle missing duration on completed status', async () => {
      const payload = createStatusPayload({ CallStatus: 'completed' });
      mockTwilioLib.parseTwilioWebhookBody.mockResolvedValue(payload);
      (mockPrisma.call.findUnique as jest.Mock).mockResolvedValue({
        id: 'call-123',
        status: CallStatus.IN_PROGRESS,
      });
      (mockPrisma.call.update as jest.Mock).mockResolvedValue({
        id: 'call-123',
        status: CallStatus.COMPLETED,
        duration: null,
      });

      const request = createMockRequest(payload);
      const response = await POST(request);

      expect(response.status).toBe(200);
      // Should not include duration in update
      expect(mockPrisma.call.update).toHaveBeenCalledWith({
        where: { twilioSid: payload.CallSid },
        data: { status: CallStatus.COMPLETED },
        select: { id: true, status: true, duration: true },
      });
    });

    it('should ignore invalid duration values', async () => {
      const payload = createStatusPayload({
        CallStatus: 'completed',
        CallDuration: 'invalid',
      });
      mockTwilioLib.parseTwilioWebhookBody.mockResolvedValue(payload);
      (mockPrisma.call.findUnique as jest.Mock).mockResolvedValue({
        id: 'call-123',
        status: CallStatus.IN_PROGRESS,
      });
      (mockPrisma.call.update as jest.Mock).mockResolvedValue({
        id: 'call-123',
        status: CallStatus.COMPLETED,
        duration: null,
      });

      const request = createMockRequest(payload);
      const response = await POST(request);

      expect(response.status).toBe(200);
      // Should not include duration in update
      expect(mockPrisma.call.update).toHaveBeenCalledWith({
        where: { twilioSid: payload.CallSid },
        data: { status: CallStatus.COMPLETED },
        select: { id: true, status: true, duration: true },
      });
    });

    it('should ignore negative duration values', async () => {
      const payload = createStatusPayload({
        CallStatus: 'completed',
        CallDuration: '-10',
      });
      mockTwilioLib.parseTwilioWebhookBody.mockResolvedValue(payload);
      (mockPrisma.call.findUnique as jest.Mock).mockResolvedValue({
        id: 'call-123',
        status: CallStatus.IN_PROGRESS,
      });
      (mockPrisma.call.update as jest.Mock).mockResolvedValue({
        id: 'call-123',
        status: CallStatus.COMPLETED,
        duration: null,
      });

      const request = createMockRequest(payload);
      const response = await POST(request);

      expect(response.status).toBe(200);
      // Should not include duration in update
      expect(mockPrisma.call.update).toHaveBeenCalledWith({
        where: { twilioSid: payload.CallSid },
        data: { status: CallStatus.COMPLETED },
        select: { id: true, status: true, duration: true },
      });
    });

    it('should not save duration for non-completed statuses', async () => {
      const payload = createStatusPayload({
        CallStatus: 'in-progress',
        CallDuration: '60', // This would be unusual but handle it
      });
      mockTwilioLib.parseTwilioWebhookBody.mockResolvedValue(payload);
      (mockPrisma.call.findUnique as jest.Mock).mockResolvedValue({
        id: 'call-123',
        status: CallStatus.RINGING,
      });
      (mockPrisma.call.update as jest.Mock).mockResolvedValue({
        id: 'call-123',
        status: CallStatus.IN_PROGRESS,
        duration: null,
      });

      const request = createMockRequest(payload);
      const response = await POST(request);

      expect(response.status).toBe(200);
      // Should not include duration (only for completed)
      expect(mockPrisma.call.update).toHaveBeenCalledWith({
        where: { twilioSid: payload.CallSid },
        data: { status: CallStatus.IN_PROGRESS },
        select: { id: true, status: true, duration: true },
      });
    });
  });

  // ===========================================================================
  // Error Handling Tests
  // ===========================================================================

  describe('Error Handling', () => {
    it('should return 500 on database error', async () => {
      const payload = createStatusPayload();
      mockTwilioLib.parseTwilioWebhookBody.mockResolvedValue(payload);
      (mockPrisma.call.findUnique as jest.Mock).mockRejectedValue(
        new Error('Database connection failed')
      );

      const request = createMockRequest(payload);
      const response = await POST(request);

      expect(response.status).toBe(500);
      const body = await response.json();
      expect(body.error).toBe('Internal server error');
    });

    it('should return 500 on update error', async () => {
      const payload = createStatusPayload();
      mockTwilioLib.parseTwilioWebhookBody.mockResolvedValue(payload);
      (mockPrisma.call.findUnique as jest.Mock).mockResolvedValue({
        id: 'call-123',
        status: CallStatus.RINGING,
      });
      (mockPrisma.call.update as jest.Mock).mockRejectedValue(
        new Error('Update failed')
      );

      const request = createMockRequest(payload);
      const response = await POST(request);

      expect(response.status).toBe(500);
      const body = await response.json();
      expect(body.error).toBe('Internal server error');
    });

    it('should handle body parsing errors gracefully', async () => {
      mockTwilioLib.parseTwilioWebhookBody.mockRejectedValue(
        new Error('Parse error')
      );

      const request = createMockRequest({});
      const response = await POST(request);

      expect(response.status).toBe(500);
    });
  });

  // ===========================================================================
  // HTTP Method Tests
  // ===========================================================================

  describe('HTTP Method Restrictions', () => {
    it('should return 405 for GET requests', async () => {
      const response = await GET();
      expect(response.status).toBe(405);
      const body = await response.json();
      expect(body.error).toBe('Method not allowed');
    });

    it('should return 405 for PUT requests', async () => {
      const response = await PUT();
      expect(response.status).toBe(405);
      const body = await response.json();
      expect(body.error).toBe('Method not allowed');
    });

    it('should return 405 for DELETE requests', async () => {
      const response = await DELETE();
      expect(response.status).toBe(405);
      const body = await response.json();
      expect(body.error).toBe('Method not allowed');
    });
  });

  // ===========================================================================
  // Response Format Tests
  // ===========================================================================

  describe('Response Format', () => {
    it('should return callId and status in success response', async () => {
      const payload = createStatusPayload({ CallStatus: 'in-progress' });
      mockTwilioLib.parseTwilioWebhookBody.mockResolvedValue(payload);
      (mockPrisma.call.findUnique as jest.Mock).mockResolvedValue({
        id: 'call-123',
        status: CallStatus.RINGING,
      });
      (mockPrisma.call.update as jest.Mock).mockResolvedValue({
        id: 'call-123',
        status: CallStatus.IN_PROGRESS,
        duration: null,
      });

      const request = createMockRequest(payload);
      const response = await POST(request);

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.callId).toBe('call-123');
      expect(body.status).toBe(CallStatus.IN_PROGRESS);
      expect(body.duration).toBeNull();
    });

    it('should return duration in success response when available', async () => {
      const payload = createStatusPayload({
        CallStatus: 'completed',
        CallDuration: '180',
      });
      mockTwilioLib.parseTwilioWebhookBody.mockResolvedValue(payload);
      (mockPrisma.call.findUnique as jest.Mock).mockResolvedValue({
        id: 'call-123',
        status: CallStatus.IN_PROGRESS,
      });
      (mockPrisma.call.update as jest.Mock).mockResolvedValue({
        id: 'call-123',
        status: CallStatus.COMPLETED,
        duration: 180,
      });

      const request = createMockRequest(payload);
      const response = await POST(request);

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.duration).toBe(180);
    });
  });

  // ===========================================================================
  // Edge Cases
  // ===========================================================================

  describe('Edge Cases', () => {
    it('should handle very long CallSid', async () => {
      const longCallSid = 'CA' + 'a'.repeat(100);
      const payload = createStatusPayload({ CallSid: longCallSid });
      mockTwilioLib.parseTwilioWebhookBody.mockResolvedValue(payload);
      (mockPrisma.call.findUnique as jest.Mock).mockResolvedValue({
        id: 'call-123',
        status: CallStatus.RINGING,
      });
      (mockPrisma.call.update as jest.Mock).mockResolvedValue({
        id: 'call-123',
        status: CallStatus.IN_PROGRESS,
        duration: null,
      });

      const request = createMockRequest(payload);
      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(mockPrisma.call.findUnique).toHaveBeenCalledWith({
        where: { twilioSid: longCallSid },
        select: { id: true, status: true },
      });
    });

    it('should handle very large duration values', async () => {
      const payload = createStatusPayload({
        CallStatus: 'completed',
        CallDuration: '999999999',
      });
      mockTwilioLib.parseTwilioWebhookBody.mockResolvedValue(payload);
      (mockPrisma.call.findUnique as jest.Mock).mockResolvedValue({
        id: 'call-123',
        status: CallStatus.IN_PROGRESS,
      });
      (mockPrisma.call.update as jest.Mock).mockResolvedValue({
        id: 'call-123',
        status: CallStatus.COMPLETED,
        duration: 999999999,
      });

      const request = createMockRequest(payload);
      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(mockPrisma.call.update).toHaveBeenCalledWith({
        where: { twilioSid: payload.CallSid },
        data: { status: CallStatus.COMPLETED, duration: 999999999 },
        select: { id: true, status: true, duration: true },
      });
    });

    it('should handle unknown Twilio status by mapping to FAILED', async () => {
      const payload = createStatusPayload({ CallStatus: 'unknown-status' });
      mockTwilioLib.parseTwilioWebhookBody.mockResolvedValue(payload);
      (mockPrisma.call.findUnique as jest.Mock).mockResolvedValue({
        id: 'call-123',
        status: CallStatus.RINGING,
      });
      (mockPrisma.call.update as jest.Mock).mockResolvedValue({
        id: 'call-123',
        status: CallStatus.FAILED,
        duration: null,
      });

      const request = createMockRequest(payload);
      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(mockPrisma.call.update).toHaveBeenCalledWith({
        where: { twilioSid: payload.CallSid },
        data: { status: CallStatus.FAILED },
        select: { id: true, status: true, duration: true },
      });
    });
  });
});
