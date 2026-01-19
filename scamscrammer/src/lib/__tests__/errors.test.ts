/**
 * Tests for custom error classes and error utilities
 */

import {
  AppError,
  DatabaseError,
  TwilioError,
  OpenAIError,
  StorageError,
  ValidationError,
  NotFoundError,
  ExternalServiceError,
  ErrorCodes,
  isAppError,
  isOperationalError,
  formatErrorResponse,
  getErrorStatusCode,
  wrapPrismaError,
} from '../errors';

describe('Custom Error Classes', () => {
  describe('AppError', () => {
    it('should create an error with default values', () => {
      const error = new AppError('Test error');

      expect(error.message).toBe('Test error');
      expect(error.code).toBe(ErrorCodes.INTERNAL_ERROR);
      expect(error.statusCode).toBe(500);
      expect(error.isOperational).toBe(true);
      expect(error.details).toBeUndefined();
      expect(error.timestamp).toBeInstanceOf(Date);
      expect(error.name).toBe('AppError');
    });

    it('should create an error with custom values', () => {
      const error = new AppError(
        'Custom error',
        ErrorCodes.VALIDATION_FAILED,
        400,
        true,
        { field: 'email' }
      );

      expect(error.message).toBe('Custom error');
      expect(error.code).toBe(ErrorCodes.VALIDATION_FAILED);
      expect(error.statusCode).toBe(400);
      expect(error.details).toEqual({ field: 'email' });
    });

    it('should convert to JSON correctly', () => {
      const error = new AppError('Test error', ErrorCodes.NOT_FOUND, 404, true, {
        resource: 'user',
      });

      const json = error.toJSON();

      expect(json).toEqual({
        error: 'Test error',
        code: ErrorCodes.NOT_FOUND,
        details: { resource: 'user' },
      });
    });
  });

  describe('DatabaseError', () => {
    it('should create a database error with defaults', () => {
      const error = new DatabaseError('Query failed');

      expect(error.message).toBe('Query failed');
      expect(error.code).toBe(ErrorCodes.DATABASE_QUERY);
      expect(error.statusCode).toBe(500);
      expect(error.name).toBe('DatabaseError');
    });

    it('should create a database error with custom code', () => {
      const error = new DatabaseError(
        'Connection failed',
        ErrorCodes.DATABASE_CONNECTION
      );

      expect(error.code).toBe(ErrorCodes.DATABASE_CONNECTION);
    });
  });

  describe('TwilioError', () => {
    it('should create a Twilio error with error code', () => {
      const error = new TwilioError(
        'Invalid number',
        ErrorCodes.TWILIO_API,
        21211
      );

      expect(error.message).toBe('Invalid number');
      expect(error.code).toBe(ErrorCodes.TWILIO_API);
      expect(error.statusCode).toBe(502);
      expect(error.twilioErrorCode).toBe(21211);
      expect(error.name).toBe('TwilioError');
    });
  });

  describe('OpenAIError', () => {
    it('should create an OpenAI error', () => {
      const error = new OpenAIError('Rate limit exceeded', ErrorCodes.OPENAI_RATE_LIMIT);

      expect(error.message).toBe('Rate limit exceeded');
      expect(error.code).toBe(ErrorCodes.OPENAI_RATE_LIMIT);
      expect(error.statusCode).toBe(502);
      expect(error.name).toBe('OpenAIError');
    });
  });

  describe('StorageError', () => {
    it('should create a storage error', () => {
      const error = new StorageError('Upload failed', ErrorCodes.STORAGE_UPLOAD, {
        bucket: 'recordings',
      });

      expect(error.message).toBe('Upload failed');
      expect(error.code).toBe(ErrorCodes.STORAGE_UPLOAD);
      expect(error.statusCode).toBe(500);
      expect(error.details).toEqual({ bucket: 'recordings' });
      expect(error.name).toBe('StorageError');
    });
  });

  describe('ValidationError', () => {
    it('should create a validation error with field errors', () => {
      const error = new ValidationError('Validation failed', {
        email: 'Invalid email format',
        phone: 'Phone number required',
      });

      expect(error.message).toBe('Validation failed');
      expect(error.code).toBe(ErrorCodes.VALIDATION_FAILED);
      expect(error.statusCode).toBe(400);
      expect(error.fieldErrors).toEqual({
        email: 'Invalid email format',
        phone: 'Phone number required',
      });
      expect(error.name).toBe('ValidationError');
    });

    it('should include field errors in JSON', () => {
      const error = new ValidationError('Validation failed', {
        name: 'Required',
      });

      const json = error.toJSON();

      expect(json.fieldErrors).toEqual({ name: 'Required' });
    });
  });

  describe('NotFoundError', () => {
    it('should create a not found error with resource name', () => {
      const error = new NotFoundError('Call');

      expect(error.message).toBe('Call not found');
      expect(error.code).toBe(ErrorCodes.NOT_FOUND);
      expect(error.statusCode).toBe(404);
      expect(error.details).toEqual({ resource: 'Call' });
    });

    it('should create a not found error with identifier', () => {
      const error = new NotFoundError('Call', 'abc-123');

      expect(error.message).toBe("Call with id 'abc-123' not found");
      expect(error.details).toEqual({
        resource: 'Call',
        identifier: 'abc-123',
      });
    });
  });

  describe('ExternalServiceError', () => {
    it('should create an external service error', () => {
      const error = new ExternalServiceError('OpenAI', 'API timeout');

      expect(error.message).toBe('External service error (OpenAI): API timeout');
      expect(error.code).toBe(ErrorCodes.EXTERNAL_SERVICE);
      expect(error.statusCode).toBe(502);
      expect(error.serviceName).toBe('OpenAI');
    });
  });
});

describe('Error Utility Functions', () => {
  describe('isAppError', () => {
    it('should return true for AppError instances', () => {
      expect(isAppError(new AppError('test'))).toBe(true);
      expect(isAppError(new DatabaseError('test'))).toBe(true);
      expect(isAppError(new ValidationError('test'))).toBe(true);
    });

    it('should return false for non-AppError instances', () => {
      expect(isAppError(new Error('test'))).toBe(false);
      expect(isAppError('error')).toBe(false);
      expect(isAppError(null)).toBe(false);
      expect(isAppError(undefined)).toBe(false);
    });
  });

  describe('isOperationalError', () => {
    it('should return true for operational errors', () => {
      expect(isOperationalError(new AppError('test', ErrorCodes.INTERNAL_ERROR, 500, true))).toBe(true);
    });

    it('should return false for non-operational errors', () => {
      expect(isOperationalError(new AppError('test', ErrorCodes.INTERNAL_ERROR, 500, false))).toBe(false);
    });

    it('should return false for non-AppError instances', () => {
      expect(isOperationalError(new Error('test'))).toBe(false);
    });
  });

  describe('formatErrorResponse', () => {
    it('should format AppError correctly', () => {
      const error = new NotFoundError('Call', '123');
      const response = formatErrorResponse(error, 'req-123');

      expect(response).toEqual({
        error: "Call with id '123' not found",
        code: ErrorCodes.NOT_FOUND,
        details: { resource: 'Call', identifier: '123' },
        requestId: 'req-123',
      });
    });

    it('should format generic errors in development', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const error = new Error('Something broke');
      const response = formatErrorResponse(error);

      expect(response.error).toBe('Something broke');
      expect(response.code).toBe(ErrorCodes.INTERNAL_ERROR);

      process.env.NODE_ENV = originalEnv;
    });

    it('should hide error details in production', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const error = new Error('Internal details');
      const response = formatErrorResponse(error);

      expect(response.error).toBe('An unexpected error occurred');
      expect(response.details).toBeUndefined();

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('getErrorStatusCode', () => {
    it('should return status code from AppError', () => {
      expect(getErrorStatusCode(new NotFoundError('Call'))).toBe(404);
      expect(getErrorStatusCode(new ValidationError('Invalid'))).toBe(400);
      expect(getErrorStatusCode(new TwilioError('Failed'))).toBe(502);
    });

    it('should return 500 for non-AppError', () => {
      expect(getErrorStatusCode(new Error('test'))).toBe(500);
      expect(getErrorStatusCode('error')).toBe(500);
    });
  });

  describe('wrapPrismaError', () => {
    it('should wrap P2002 (unique constraint) errors', () => {
      const prismaError = { code: 'P2002', meta: { target: ['email'] } };
      const wrapped = wrapPrismaError(prismaError);

      expect(wrapped).toBeInstanceOf(DatabaseError);
      expect(wrapped.code).toBe(ErrorCodes.DATABASE_CONSTRAINT);
      expect(wrapped.message).toContain('unique identifier');
    });

    it('should wrap P2025 (not found) errors', () => {
      const prismaError = { code: 'P2025', meta: {} };
      const wrapped = wrapPrismaError(prismaError);

      expect(wrapped).toBeInstanceOf(DatabaseError);
      expect(wrapped.code).toBe(ErrorCodes.DATABASE_QUERY);
      expect(wrapped.message).toContain('not found');
    });

    it('should wrap P1xxx (connection) errors', () => {
      const prismaError = { code: 'P1001', meta: {} };
      const wrapped = wrapPrismaError(prismaError);

      expect(wrapped).toBeInstanceOf(DatabaseError);
      expect(wrapped.code).toBe(ErrorCodes.DATABASE_CONNECTION);
    });

    it('should wrap unknown errors', () => {
      const prismaError = { code: 'P9999', message: 'Unknown error' };
      const wrapped = wrapPrismaError(prismaError);

      expect(wrapped).toBeInstanceOf(DatabaseError);
      expect(wrapped.message).toBe('Unknown error');
    });
  });
});
