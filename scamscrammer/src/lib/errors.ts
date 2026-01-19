/**
 * Custom Error Classes and Error Handling Utilities
 *
 * This module provides a standardized approach to error handling across the application.
 * It includes custom error classes for different error types and utilities for
 * formatting error responses.
 */

/**
 * Error codes for categorizing different types of errors
 */
export const ErrorCodes = {
  // Database errors
  DATABASE_CONNECTION: 'DATABASE_CONNECTION',
  DATABASE_QUERY: 'DATABASE_QUERY',
  DATABASE_CONSTRAINT: 'DATABASE_CONSTRAINT',

  // Twilio errors
  TWILIO_API: 'TWILIO_API',
  TWILIO_WEBHOOK: 'TWILIO_WEBHOOK',
  TWILIO_RECORDING: 'TWILIO_RECORDING',

  // OpenAI errors
  OPENAI_API: 'OPENAI_API',
  OPENAI_RATE_LIMIT: 'OPENAI_RATE_LIMIT',
  OPENAI_CONTEXT_LENGTH: 'OPENAI_CONTEXT_LENGTH',

  // Storage errors
  STORAGE_UPLOAD: 'STORAGE_UPLOAD',
  STORAGE_DOWNLOAD: 'STORAGE_DOWNLOAD',
  STORAGE_NOT_FOUND: 'STORAGE_NOT_FOUND',

  // Validation errors
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  INVALID_INPUT: 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',

  // Resource errors
  NOT_FOUND: 'NOT_FOUND',
  ALREADY_EXISTS: 'ALREADY_EXISTS',

  // General errors
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  EXTERNAL_SERVICE: 'EXTERNAL_SERVICE',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

/**
 * Base application error class
 * All custom errors should extend this class
 */
export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly details?: Record<string, unknown>;
  public readonly timestamp: Date;
  public readonly requestId?: string;

  constructor(
    message: string,
    code: ErrorCode = ErrorCodes.INTERNAL_ERROR,
    statusCode: number = 500,
    isOperational: boolean = true,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.details = details;
    this.timestamp = new Date();

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Convert error to API response format
   */
  toJSON() {
    return {
      error: this.message,
      code: this.code,
      details: this.details,
      ...(this.requestId && { requestId: this.requestId }),
    };
  }
}

/**
 * Database-related errors
 */
export class DatabaseError extends AppError {
  constructor(
    message: string,
    code: ErrorCode = ErrorCodes.DATABASE_QUERY,
    details?: Record<string, unknown>
  ) {
    super(message, code, 500, true, details);
  }
}

/**
 * Twilio API errors
 */
export class TwilioError extends AppError {
  public readonly twilioErrorCode?: number;

  constructor(
    message: string,
    code: ErrorCode = ErrorCodes.TWILIO_API,
    twilioErrorCode?: number,
    details?: Record<string, unknown>
  ) {
    super(message, code, 502, true, details);
    this.twilioErrorCode = twilioErrorCode;
  }
}

/**
 * OpenAI API errors
 */
export class OpenAIError extends AppError {
  constructor(
    message: string,
    code: ErrorCode = ErrorCodes.OPENAI_API,
    details?: Record<string, unknown>
  ) {
    super(message, code, 502, true, details);
  }
}

/**
 * Storage (S3) errors
 */
export class StorageError extends AppError {
  constructor(
    message: string,
    code: ErrorCode = ErrorCodes.STORAGE_UPLOAD,
    details?: Record<string, unknown>
  ) {
    super(message, code, 500, true, details);
  }
}

/**
 * Validation errors (for invalid input)
 */
export class ValidationError extends AppError {
  public readonly fieldErrors?: Record<string, string>;

  constructor(
    message: string,
    fieldErrors?: Record<string, string>,
    details?: Record<string, unknown>
  ) {
    super(message, ErrorCodes.VALIDATION_FAILED, 400, true, details);
    this.fieldErrors = fieldErrors;
  }

  toJSON() {
    return {
      ...super.toJSON(),
      ...(this.fieldErrors && { fieldErrors: this.fieldErrors }),
    };
  }
}

/**
 * Not found errors
 */
export class NotFoundError extends AppError {
  constructor(resource: string, identifier?: string) {
    const message = identifier
      ? `${resource} with id '${identifier}' not found`
      : `${resource} not found`;
    super(message, ErrorCodes.NOT_FOUND, 404, true, {
      resource,
      ...(identifier && { identifier }),
    });
  }
}

/**
 * External service errors (generic)
 */
export class ExternalServiceError extends AppError {
  public readonly serviceName: string;

  constructor(
    serviceName: string,
    message: string,
    details?: Record<string, unknown>
  ) {
    super(
      `External service error (${serviceName}): ${message}`,
      ErrorCodes.EXTERNAL_SERVICE,
      502,
      true,
      details
    );
    this.serviceName = serviceName;
  }
}

/**
 * Type guard to check if an error is an AppError
 */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/**
 * Type guard to check if an error is an operational error
 * (vs a programming error)
 */
export function isOperationalError(error: unknown): boolean {
  if (isAppError(error)) {
    return error.isOperational;
  }
  return false;
}

/**
 * Format any error to a safe API response
 * Hides implementation details for non-operational errors in production
 */
export function formatErrorResponse(
  error: unknown,
  requestId?: string
): {
  error: string;
  code: ErrorCode;
  details?: Record<string, unknown>;
  requestId?: string;
} {
  if (isAppError(error)) {
    return {
      ...error.toJSON(),
      requestId,
    };
  }

  // For unexpected errors, hide details in production
  const isDev = process.env.NODE_ENV === 'development';

  return {
    error: isDev && error instanceof Error ? error.message : 'An unexpected error occurred',
    code: ErrorCodes.INTERNAL_ERROR,
    ...(isDev && error instanceof Error && { details: { stack: error.stack } }),
    requestId,
  };
}

/**
 * Get HTTP status code from an error
 */
export function getErrorStatusCode(error: unknown): number {
  if (isAppError(error)) {
    return error.statusCode;
  }
  return 500;
}

/**
 * Wrap a Prisma error into an AppError
 */
export function wrapPrismaError(error: unknown): DatabaseError {
  const prismaError = error as {
    code?: string;
    meta?: Record<string, unknown>;
    message?: string;
  };

  // Handle common Prisma error codes
  const prismaCode = prismaError.code;

  if (prismaCode === 'P2002') {
    return new DatabaseError(
      'A record with this unique identifier already exists',
      ErrorCodes.DATABASE_CONSTRAINT,
      { prismaCode, meta: prismaError.meta }
    );
  }

  if (prismaCode === 'P2025') {
    return new DatabaseError(
      'The requested record was not found',
      ErrorCodes.DATABASE_QUERY,
      { prismaCode, meta: prismaError.meta }
    );
  }

  if (prismaCode?.startsWith('P1')) {
    return new DatabaseError(
      'Database connection error',
      ErrorCodes.DATABASE_CONNECTION,
      { prismaCode, meta: prismaError.meta }
    );
  }

  return new DatabaseError(
    prismaError.message || 'Database operation failed',
    ErrorCodes.DATABASE_QUERY,
    { prismaCode, meta: prismaError.meta }
  );
}
