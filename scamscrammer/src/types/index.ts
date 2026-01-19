import { Call, CallSegment, CallStatus, Speaker } from '@prisma/client';

// Re-export Prisma types
export type { Call, CallSegment, CallStatus, Speaker };
export { CallStatus as CallStatusEnum, Speaker as SpeakerEnum } from '@prisma/client';

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
