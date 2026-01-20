/**
 * Tests for TypeScript types and utility functions
 */

import {
  CallStatus,
  Speaker,
  TwilioCallStatus,
  TWILIO_STATUS_MAP,
  mapTwilioStatusToCallStatus,
} from '../index';

describe('Types and Utilities', () => {
  // ===========================================================================
  // Enum Tests
  // ===========================================================================

  describe('CallStatus Enum', () => {
    it('should have all required status values', () => {
      expect(CallStatus.RINGING).toBe('RINGING');
      expect(CallStatus.IN_PROGRESS).toBe('IN_PROGRESS');
      expect(CallStatus.COMPLETED).toBe('COMPLETED');
      expect(CallStatus.FAILED).toBe('FAILED');
      expect(CallStatus.NO_ANSWER).toBe('NO_ANSWER');
    });

    it('should have exactly 5 status values', () => {
      const values = Object.values(CallStatus);
      expect(values).toHaveLength(5);
    });
  });

  describe('Speaker Enum', () => {
    it('should have SCAMMER and EARL values', () => {
      expect(Speaker.SCAMMER).toBe('SCAMMER');
      expect(Speaker.EARL).toBe('EARL');
    });

    it('should have exactly 2 speaker values', () => {
      const values = Object.values(Speaker);
      expect(values).toHaveLength(2);
    });
  });

  // ===========================================================================
  // Status Mapping Tests
  // ===========================================================================

  describe('TWILIO_STATUS_MAP', () => {
    it('should map all Twilio statuses to internal statuses', () => {
      const twilioStatuses: TwilioCallStatus[] = [
        'queued',
        'ringing',
        'in-progress',
        'completed',
        'busy',
        'failed',
        'no-answer',
        'canceled',
      ];

      twilioStatuses.forEach((status) => {
        expect(TWILIO_STATUS_MAP[status]).toBeDefined();
      });
    });

    it('should map queued to RINGING', () => {
      expect(TWILIO_STATUS_MAP['queued']).toBe(CallStatus.RINGING);
    });

    it('should map ringing to RINGING', () => {
      expect(TWILIO_STATUS_MAP['ringing']).toBe(CallStatus.RINGING);
    });

    it('should map in-progress to IN_PROGRESS', () => {
      expect(TWILIO_STATUS_MAP['in-progress']).toBe(CallStatus.IN_PROGRESS);
    });

    it('should map completed to COMPLETED', () => {
      expect(TWILIO_STATUS_MAP['completed']).toBe(CallStatus.COMPLETED);
    });

    it('should map busy to FAILED', () => {
      expect(TWILIO_STATUS_MAP['busy']).toBe(CallStatus.FAILED);
    });

    it('should map failed to FAILED', () => {
      expect(TWILIO_STATUS_MAP['failed']).toBe(CallStatus.FAILED);
    });

    it('should map no-answer to NO_ANSWER', () => {
      expect(TWILIO_STATUS_MAP['no-answer']).toBe(CallStatus.NO_ANSWER);
    });

    it('should map canceled to FAILED', () => {
      expect(TWILIO_STATUS_MAP['canceled']).toBe(CallStatus.FAILED);
    });
  });

  describe('mapTwilioStatusToCallStatus', () => {
    it('should correctly map all valid Twilio statuses', () => {
      expect(mapTwilioStatusToCallStatus('queued')).toBe(CallStatus.RINGING);
      expect(mapTwilioStatusToCallStatus('ringing')).toBe(CallStatus.RINGING);
      expect(mapTwilioStatusToCallStatus('in-progress')).toBe(CallStatus.IN_PROGRESS);
      expect(mapTwilioStatusToCallStatus('completed')).toBe(CallStatus.COMPLETED);
      expect(mapTwilioStatusToCallStatus('busy')).toBe(CallStatus.FAILED);
      expect(mapTwilioStatusToCallStatus('failed')).toBe(CallStatus.FAILED);
      expect(mapTwilioStatusToCallStatus('no-answer')).toBe(CallStatus.NO_ANSWER);
      expect(mapTwilioStatusToCallStatus('canceled')).toBe(CallStatus.FAILED);
    });

    it('should return FAILED for unknown status', () => {
      // Cast to TwilioCallStatus to test unknown values
      expect(mapTwilioStatusToCallStatus('unknown' as TwilioCallStatus)).toBe(
        CallStatus.FAILED
      );
    });

    it('should handle empty string by returning FAILED', () => {
      expect(mapTwilioStatusToCallStatus('' as TwilioCallStatus)).toBe(
        CallStatus.FAILED
      );
    });
  });
});
