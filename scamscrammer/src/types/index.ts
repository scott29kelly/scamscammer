import { Call, CallSegment, CallStatus, Speaker } from '@prisma/client';

// Re-export Prisma types for convenience
export type { Call, CallSegment, User, Session } from '@prisma/client';
export { CallStatus, Speaker, UserRole } from '@prisma/client';

/**
 * Login credentials for authentication
 */
export interface ApiErrorResponse {
  error: string;
  code?: string;
  details?: Record<string, unknown>;
  requestId?: string;
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

// API Response types
export interface CallResponse extends Call {
  segments: CallSegment[];
  _count?: {
    segments: number;
  };
}

export interface CallListItem extends Omit<Call, 'segments'> {
  _count: {
    segments: number;
  };
}

export interface CallListResponse {
  calls: CallListItem[];
  pagination: PaginationInfo;
}

export interface PaginationInfo {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// Request types
export interface CallListQueryParams {
  page?: string;
  limit?: string;
  status?: CallStatus;
  startDate?: string;
  endDate?: string;
  sortBy?: 'createdAt' | 'duration';
  sortOrder?: 'asc' | 'desc';
}

export interface CallUpdatePayload {
  rating?: number;
  notes?: string;
  tags?: string[];
}

// Error response
export interface ApiErrorResponse {
  error: string;
  code?: string;
  details?: Record<string, string>;
}

// Storage types (for future use)
export interface StorageDeleteResult {
  success: boolean;
  key?: string;
}

/**
 * Health check response
 */
export interface ServiceStatus {
  status: 'healthy' | 'unhealthy' | 'degraded';
  latency?: number;
  message?: string;
}

export interface HealthResponse {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  version: string;
  services: {
    database: ServiceStatus;
    twilio: ServiceStatus;
    openai: ServiceStatus;
    storage: ServiceStatus;
  };
  uptime: number;
}
