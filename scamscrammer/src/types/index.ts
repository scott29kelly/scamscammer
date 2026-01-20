/**
 * ScamScrammer TypeScript Type Definitions
 *
 * This file contains all shared TypeScript interfaces and types
 * for the application. Types will be added by subsequent tasks.
 */

// Re-export Prisma types for convenience
export type { Call, CallSegment } from '@prisma/client';
export { CallStatus, Speaker } from '@prisma/client';

/**
 * API Error Response
 */
export interface ApiErrorResponse {
  error: string;
  code?: string;
  details?: Record<string, string>;
}

/**
 * Pagination metadata
 */
export interface PaginationInfo {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

/**
 * Call list item (without full segments)
 */
export interface CallListItem {
  id: string;
  twilioSid: string;
  fromNumber: string;
  toNumber: string;
  status: string;
  duration: number | null;
  recordingUrl: string | null;
  transcriptUrl: string | null;
  rating: number | null;
  notes: string | null;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
  _count: {
    segments: number;
  };
}

/**
 * Call list response with pagination
 */
export interface CallListResponse {
  calls: CallListItem[];
  pagination: PaginationInfo;
}

/**
 * Call response with segments
 */
export interface CallResponse {
  id: string;
  twilioSid: string;
  fromNumber: string;
  toNumber: string;
  status: string;
  duration: number | null;
  recordingUrl: string | null;
  transcriptUrl: string | null;
  rating: number | null;
  notes: string | null;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
  segments: Array<{
    id: string;
    callId: string;
    speaker: string;
    text: string;
    timestamp: number;
    createdAt: Date;
  }>;
}

/**
 * Dashboard statistics response
 */
export interface DashboardStats {
  totalCalls: number;
  totalDuration: number;
  averageDuration: number;
  callsByStatus: Record<string, number>;
  callsByDay: Array<{
    date: string;
    count: number;
  }>;
  topRatedCalls: CallListItem[];
  longestCalls: CallListItem[];
}

/**
 * Twilio call status values received in webhooks
 * @see https://www.twilio.com/docs/voice/twiml#callstatus-values
 */
export type TwilioCallStatus =
  | 'queued'
  | 'initiated'
  | 'ringing'
  | 'in-progress'
  | 'completed'
  | 'busy'
  | 'no-answer'
  | 'canceled'
  | 'failed';

/**
 * Twilio status webhook callback payload
 */
export interface TwilioStatusPayload {
  CallSid: string;
  AccountSid: string;
  From: string;
  To: string;
  CallStatus: TwilioCallStatus;
  CallDuration?: string;
  Direction: string;
  ApiVersion: string;
  Timestamp?: string;
}

/**
 * Response from the status webhook handler
 */
export interface StatusUpdateResponse {
  success: boolean;
  callId: string;
  previousStatus: string;
  newStatus: string;
  duration?: number;
}
