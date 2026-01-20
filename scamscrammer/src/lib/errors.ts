/**
 * Custom Error Classes and Error Handling Utilities
 *
 * This module provides custom error classes for different error categories
 * and helper functions for error formatting and handling.
 */

/**
 * Base application error class
 */
export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly context?: Record<string, unknown>;

  constructor(
    message: string,
    code: string,
    statusCode: number = 500,
    isOperational: boolean = true,
    context?: Record<string, unknown>
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.context = context;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Twilio-related errors
 */
export class TwilioError extends AppError {
  constructor(
    message: string,
    code: string = 'TWILIO_ERROR',
    statusCode: number = 500,
    context?: Record<string, unknown>
  ) {
    super(message, code, statusCode, true, context);
  }

  static signatureValidationFailed(): TwilioError {
    return new TwilioError(
      'Twilio signature validation failed',
      'TWILIO_SIGNATURE_INVALID',
      401
    );
  }

  static callNotFound(callSid: string): TwilioError {
    return new TwilioError(
      `Call not found: ${callSid}`,
      'TWILIO_CALL_NOT_FOUND',
      404,
      { callSid }
    );
  }

  static webhookError(operation: string, details?: string): TwilioError {
    return new TwilioError(
      `Twilio webhook error during ${operation}${details ? `: ${details}` : ''}`,
      'TWILIO_WEBHOOK_ERROR',
      500,
      { operation }
    );
  }

  static connectionFailed(details?: string): TwilioError {
    return new TwilioError(
      `Failed to connect to Twilio${details ? `: ${details}` : ''}`,
      'TWILIO_CONNECTION_FAILED',
      503
    );
  }
}

/**
 * OpenAI-related errors
 */
export class OpenAIError extends AppError {
  constructor(
    message: string,
    code: string = 'OPENAI_ERROR',
    statusCode: number = 500,
    context?: Record<string, unknown>
  ) {
    super(message, code, statusCode, true, context);
  }

  static connectionFailed(details?: string): OpenAIError {
    return new OpenAIError(
      `Failed to connect to OpenAI Realtime API${details ? `: ${details}` : ''}`,
      'OPENAI_CONNECTION_FAILED',
      503
    );
  }

  static sessionError(details?: string): OpenAIError {
    return new OpenAIError(
      `OpenAI session error${details ? `: ${details}` : ''}`,
      'OPENAI_SESSION_ERROR',
      500
    );
  }

  static audioStreamError(details?: string): OpenAIError {
    return new OpenAIError(
      `Audio stream error${details ? `: ${details}` : ''}`,
      'OPENAI_AUDIO_ERROR',
      500
    );
  }

  static rateLimitExceeded(): OpenAIError {
    return new OpenAIError(
      'OpenAI rate limit exceeded',
      'OPENAI_RATE_LIMITED',
      429
    );
  }

  static invalidResponse(details?: string): OpenAIError {
    return new OpenAIError(
      `Invalid response from OpenAI${details ? `: ${details}` : ''}`,
      'OPENAI_INVALID_RESPONSE',
      502
    );
  }
}

/**
 * Storage-related errors (S3)
 */
export class StorageError extends AppError {
  constructor(
    message: string,
    code: string = 'STORAGE_ERROR',
    statusCode: number = 500,
    context?: Record<string, unknown>
  ) {
    super(message, code, statusCode, true, context);
  }

  static uploadFailed(key: string, details?: string): StorageError {
    return new StorageError(
      `Failed to upload file${details ? `: ${details}` : ''}`,
      'STORAGE_UPLOAD_FAILED',
      500,
      { key }
    );
  }

  static downloadFailed(key: string, details?: string): StorageError {
    return new StorageError(
      `Failed to download file${details ? `: ${details}` : ''}`,
      'STORAGE_DOWNLOAD_FAILED',
      500,
      { key }
    );
  }

  static deleteFailed(key: string, details?: string): StorageError {
    return new StorageError(
      `Failed to delete file${details ? `: ${details}` : ''}`,
      'STORAGE_DELETE_FAILED',
      500,
      { key }
    );
  }

  static fileNotFound(key: string): StorageError {
    return new StorageError(
      `File not found: ${key}`,
      'STORAGE_FILE_NOT_FOUND',
      404,
      { key }
    );
  }

  static bucketNotConfigured(): StorageError {
    return new StorageError(
      'Storage bucket not configured',
      'STORAGE_BUCKET_NOT_CONFIGURED',
      500
    );
  }
}

/**
 * Database-related errors
 */
export class DatabaseError extends AppError {
  constructor(
    message: string,
    code: string = 'DATABASE_ERROR',
    statusCode: number = 500,
    context?: Record<string, unknown>
  ) {
    super(message, code, statusCode, true, context);
  }

  static connectionFailed(details?: string): DatabaseError {
    return new DatabaseError(
      `Database connection failed${details ? `: ${details}` : ''}`,
      'DATABASE_CONNECTION_FAILED',
      503
    );
  }

  static queryFailed(operation: string, details?: string): DatabaseError {
    return new DatabaseError(
      `Database query failed during ${operation}${details ? `: ${details}` : ''}`,
      'DATABASE_QUERY_FAILED',
      500,
      { operation }
    );
  }

  static recordNotFound(entity: string, id: string): DatabaseError {
    return new DatabaseError(
      `${entity} not found: ${id}`,
      'DATABASE_RECORD_NOT_FOUND',
      404,
      { entity, id }
    );
  }

  static duplicateRecord(entity: string, field: string): DatabaseError {
    return new DatabaseError(
      `Duplicate ${entity} on field: ${field}`,
      'DATABASE_DUPLICATE_RECORD',
      409,
      { entity, field }
    );
  }
}

/**
 * Validation errors
 */
export class ValidationError extends AppError {
  public readonly fields?: Record<string, string>;

  constructor(
    message: string,
    fields?: Record<string, string>,
    context?: Record<string, unknown>
  ) {
    super(message, 'VALIDATION_ERROR', 400, true, context);
    this.fields = fields;
  }

  static requiredField(field: string): ValidationError {
    return new ValidationError(
      `Missing required field: ${field}`,
      { [field]: 'Required' }
    );
  }

  static invalidFormat(field: string, expected: string): ValidationError {
    return new ValidationError(
      `Invalid format for field: ${field}. Expected: ${expected}`,
      { [field]: `Expected ${expected}` }
    );
  }

  static invalidValue(field: string, message: string): ValidationError {
    return new ValidationError(
      `Invalid value for field: ${field}. ${message}`,
      { [field]: message }
    );
  }
}

/**
 * Format an error for API response (safe for clients)
 */
export function formatErrorResponse(error: unknown): {
  error: string;
  code?: string;
  details?: Record<string, string>;
} {
  if (error instanceof AppError) {
    const response: {
      error: string;
      code?: string;
      details?: Record<string, string>;
    } = {
      error: error.message,
      code: error.code,
    };

    if (error instanceof ValidationError && error.fields) {
      response.details = error.fields;
    }

    return response;
  }

  // For unknown errors, return a generic message (don't expose internals)
  return {
    error: 'An unexpected error occurred',
    code: 'INTERNAL_ERROR',
  };
}

/**
 * Get HTTP status code from error
 */
export function getErrorStatusCode(error: unknown): number {
  if (error instanceof AppError) {
    return error.statusCode;
  }
  return 500;
}

/**
 * Check if error is operational (expected) vs programmer error
 */
export function isOperationalError(error: unknown): boolean {
  if (error instanceof AppError) {
    return error.isOperational;
  }
  return false;
}

/**
 * Extract error message safely
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'Unknown error';
}

/**
 * Extract error context for logging
 */
export function getErrorContext(error: unknown): Record<string, unknown> {
  const context: Record<string, unknown> = {
    name: error instanceof Error ? error.name : 'Unknown',
    message: getErrorMessage(error),
    stack: error instanceof Error ? error.stack : undefined,
  };

  if (error instanceof AppError) {
    context.code = error.code;
    context.statusCode = error.statusCode;
    context.isOperational = error.isOperational;
    if (error.context) {
      context.errorContext = error.context;
    }
    if (error instanceof ValidationError && error.fields) {
      context.validationFields = error.fields;
    }
  }

  return context;
}
