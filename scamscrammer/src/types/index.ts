/**
 * ScamScrammer TypeScript Type Definitions
 *
 * This file contains all shared TypeScript interfaces and types
 * for the application.
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
 * Recording webhook response
 */
export interface RecordingWebhookResponse {
  success: boolean;
  message: string;
  recordingUrl?: string;
}

/**
 * Twilio recording status callback payload
 */
export interface TwilioRecordingPayload {
  AccountSid: string;
  CallSid: string;
  RecordingSid: string;
  RecordingUrl: string;
  RecordingStatus: 'in-progress' | 'completed' | 'absent' | 'failed';
  RecordingDuration?: string;
  RecordingChannels?: string;
  RecordingSource?: string;
  RecordingStartTime?: string;
  ErrorCode?: string;
}
