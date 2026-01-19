/**
 * ScamScrammer TypeScript Type Definitions
 *
 * This file contains all shared TypeScript interfaces and types
 * for the application.
 */

// Re-export Prisma types for convenience
export type { Call, CallSegment, User, Session } from '@prisma/client';
export { CallStatus, Speaker, UserRole } from '@prisma/client';

/**
 * Login credentials for authentication
 */
export interface LoginCredentials {
  email: string;
  password: string;
}

/**
 * User registration data
 */
export interface RegisterData {
  email: string;
  password: string;
  name?: string;
}

/**
 * Authenticated user info (safe to expose to client)
 */
export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
}

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
