/**
 * Tests for custom error classes and error handling utilities
 */

import {
  AppError,
  TwilioError,
  OpenAIError,
  StorageError,
  DatabaseError,
  ValidationError,
  formatErrorResponse,
  getErrorStatusCode,
  isOperationalError,
  getErrorMessage,
  getErrorContext,
} from '../errors';

describe('AppError', () => {
  it('should create an error with all properties', () => {
    const error = new AppError('Test error', 'TEST_ERROR', 400, true, { foo: 'bar' });

    expect(error.message).toBe('Test error');
    expect(error.code).toBe('TEST_ERROR');
    expect(error.statusCode).toBe(400);
    expect(error.isOperational).toBe(true);
    expect(error.context).toEqual({ foo: 'bar' });
    expect(error.name).toBe('AppError');
  });

  it('should use default values', () => {
    const error = new AppError('Test', 'TEST');

    expect(error.statusCode).toBe(500);
    expect(error.isOperational).toBe(true);
    expect(error.context).toBeUndefined();
  });
});

describe('TwilioError', () => {
  it('should create signature validation failed error', () => {
    const error = TwilioError.signatureValidationFailed();

    expect(error.message).toBe('Twilio signature validation failed');
    expect(error.code).toBe('TWILIO_SIGNATURE_INVALID');
    expect(error.statusCode).toBe(401);
  });

  it('should create call not found error', () => {
    const error = TwilioError.callNotFound('CA123');

    expect(error.message).toBe('Call not found: CA123');
    expect(error.code).toBe('TWILIO_CALL_NOT_FOUND');
    expect(error.statusCode).toBe(404);
    expect(error.context).toEqual({ callSid: 'CA123' });
  });

  it('should create webhook error', () => {
    const error = TwilioError.webhookError('status update', 'Invalid payload');

    expect(error.message).toBe('Twilio webhook error during status update: Invalid payload');
    expect(error.code).toBe('TWILIO_WEBHOOK_ERROR');
    expect(error.statusCode).toBe(500);
  });

  it('should create connection failed error', () => {
    const error = TwilioError.connectionFailed('Timeout');

    expect(error.message).toBe('Failed to connect to Twilio: Timeout');
    expect(error.code).toBe('TWILIO_CONNECTION_FAILED');
    expect(error.statusCode).toBe(503);
  });
});

describe('OpenAIError', () => {
  it('should create connection failed error', () => {
    const error = OpenAIError.connectionFailed('WebSocket closed');

    expect(error.message).toBe('Failed to connect to OpenAI Realtime API: WebSocket closed');
    expect(error.code).toBe('OPENAI_CONNECTION_FAILED');
    expect(error.statusCode).toBe(503);
  });

  it('should create session error', () => {
    const error = OpenAIError.sessionError();

    expect(error.message).toBe('OpenAI session error');
    expect(error.code).toBe('OPENAI_SESSION_ERROR');
    expect(error.statusCode).toBe(500);
  });

  it('should create audio stream error', () => {
    const error = OpenAIError.audioStreamError('Buffer overflow');

    expect(error.message).toBe('Audio stream error: Buffer overflow');
    expect(error.code).toBe('OPENAI_AUDIO_ERROR');
  });

  it('should create rate limit error', () => {
    const error = OpenAIError.rateLimitExceeded();

    expect(error.message).toBe('OpenAI rate limit exceeded');
    expect(error.code).toBe('OPENAI_RATE_LIMITED');
    expect(error.statusCode).toBe(429);
  });

  it('should create invalid response error', () => {
    const error = OpenAIError.invalidResponse('Malformed JSON');

    expect(error.message).toBe('Invalid response from OpenAI: Malformed JSON');
    expect(error.code).toBe('OPENAI_INVALID_RESPONSE');
    expect(error.statusCode).toBe(502);
  });
});

describe('StorageError', () => {
  it('should create upload failed error', () => {
    const error = StorageError.uploadFailed('recordings/call-123.wav', 'S3 timeout');

    expect(error.message).toBe('Failed to upload file: S3 timeout');
    expect(error.code).toBe('STORAGE_UPLOAD_FAILED');
    expect(error.context).toEqual({ key: 'recordings/call-123.wav' });
  });

  it('should create download failed error', () => {
    const error = StorageError.downloadFailed('recordings/call-123.wav');

    expect(error.message).toBe('Failed to download file');
    expect(error.code).toBe('STORAGE_DOWNLOAD_FAILED');
  });

  it('should create delete failed error', () => {
    const error = StorageError.deleteFailed('recordings/call-123.wav', 'Access denied');

    expect(error.message).toBe('Failed to delete file: Access denied');
    expect(error.code).toBe('STORAGE_DELETE_FAILED');
  });

  it('should create file not found error', () => {
    const error = StorageError.fileNotFound('recordings/missing.wav');

    expect(error.message).toBe('File not found: recordings/missing.wav');
    expect(error.code).toBe('STORAGE_FILE_NOT_FOUND');
    expect(error.statusCode).toBe(404);
  });

  it('should create bucket not configured error', () => {
    const error = StorageError.bucketNotConfigured();

    expect(error.message).toBe('Storage bucket not configured');
    expect(error.code).toBe('STORAGE_BUCKET_NOT_CONFIGURED');
  });
});

describe('DatabaseError', () => {
  it('should create connection failed error', () => {
    const error = DatabaseError.connectionFailed('Connection refused');

    expect(error.message).toBe('Database connection failed: Connection refused');
    expect(error.code).toBe('DATABASE_CONNECTION_FAILED');
    expect(error.statusCode).toBe(503);
  });

  it('should create query failed error', () => {
    const error = DatabaseError.queryFailed('fetch calls', 'Syntax error');

    expect(error.message).toBe('Database query failed during fetch calls: Syntax error');
    expect(error.code).toBe('DATABASE_QUERY_FAILED');
    expect(error.context).toEqual({ operation: 'fetch calls' });
  });

  it('should create record not found error', () => {
    const error = DatabaseError.recordNotFound('Call', 'call-123');

    expect(error.message).toBe('Call not found: call-123');
    expect(error.code).toBe('DATABASE_RECORD_NOT_FOUND');
    expect(error.statusCode).toBe(404);
    expect(error.context).toEqual({ entity: 'Call', id: 'call-123' });
  });

  it('should create duplicate record error', () => {
    const error = DatabaseError.duplicateRecord('Call', 'twilioSid');

    expect(error.message).toBe('Duplicate Call on field: twilioSid');
    expect(error.code).toBe('DATABASE_DUPLICATE_RECORD');
    expect(error.statusCode).toBe(409);
  });
});

describe('ValidationError', () => {
  it('should create required field error', () => {
    const error = ValidationError.requiredField('phoneNumber');

    expect(error.message).toBe('Missing required field: phoneNumber');
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.statusCode).toBe(400);
    expect(error.fields).toEqual({ phoneNumber: 'Required' });
  });

  it('should create invalid format error', () => {
    const error = ValidationError.invalidFormat('email', 'valid email address');

    expect(error.message).toBe('Invalid format for field: email. Expected: valid email address');
    expect(error.fields).toEqual({ email: 'Expected valid email address' });
  });

  it('should create invalid value error', () => {
    const error = ValidationError.invalidValue('rating', 'Must be between 1 and 5');

    expect(error.message).toBe('Invalid value for field: rating. Must be between 1 and 5');
    expect(error.fields).toEqual({ rating: 'Must be between 1 and 5' });
  });
});

describe('formatErrorResponse', () => {
  it('should format AppError', () => {
    const error = new AppError('Test error', 'TEST_ERROR', 400);
    const response = formatErrorResponse(error);

    expect(response).toEqual({
      error: 'Test error',
      code: 'TEST_ERROR',
    });
  });

  it('should include validation fields for ValidationError', () => {
    const error = ValidationError.requiredField('name');
    const response = formatErrorResponse(error);

    expect(response).toEqual({
      error: 'Missing required field: name',
      code: 'VALIDATION_ERROR',
      details: { name: 'Required' },
    });
  });

  it('should return generic error for unknown errors', () => {
    const response = formatErrorResponse(new Error('Internal details'));

    expect(response).toEqual({
      error: 'An unexpected error occurred',
      code: 'INTERNAL_ERROR',
    });
  });

  it('should return generic error for non-Error values', () => {
    const response = formatErrorResponse('string error');

    expect(response).toEqual({
      error: 'An unexpected error occurred',
      code: 'INTERNAL_ERROR',
    });
  });
});

describe('getErrorStatusCode', () => {
  it('should return status code from AppError', () => {
    expect(getErrorStatusCode(new AppError('Test', 'TEST', 404))).toBe(404);
    expect(getErrorStatusCode(TwilioError.signatureValidationFailed())).toBe(401);
  });

  it('should return 500 for non-AppError', () => {
    expect(getErrorStatusCode(new Error('Test'))).toBe(500);
    expect(getErrorStatusCode('string error')).toBe(500);
  });
});

describe('isOperationalError', () => {
  it('should return true for operational AppError', () => {
    const error = new AppError('Test', 'TEST', 500, true);
    expect(isOperationalError(error)).toBe(true);
  });

  it('should return false for non-operational AppError', () => {
    const error = new AppError('Test', 'TEST', 500, false);
    expect(isOperationalError(error)).toBe(false);
  });

  it('should return false for non-AppError', () => {
    expect(isOperationalError(new Error('Test'))).toBe(false);
    expect(isOperationalError('string')).toBe(false);
  });
});

describe('getErrorMessage', () => {
  it('should extract message from Error', () => {
    expect(getErrorMessage(new Error('Test message'))).toBe('Test message');
  });

  it('should return string as-is', () => {
    expect(getErrorMessage('String error')).toBe('String error');
  });

  it('should return Unknown error for other types', () => {
    expect(getErrorMessage(null)).toBe('Unknown error');
    expect(getErrorMessage(123)).toBe('Unknown error');
  });
});

describe('getErrorContext', () => {
  it('should extract context from AppError', () => {
    const error = new AppError('Test', 'TEST_CODE', 400, true, { foo: 'bar' });
    const context = getErrorContext(error);

    expect(context.name).toBe('AppError');
    expect(context.message).toBe('Test');
    expect(context.code).toBe('TEST_CODE');
    expect(context.statusCode).toBe(400);
    expect(context.isOperational).toBe(true);
    expect(context.errorContext).toEqual({ foo: 'bar' });
    expect(context.stack).toBeDefined();
  });

  it('should extract context from ValidationError', () => {
    const error = ValidationError.requiredField('name');
    const context = getErrorContext(error);

    expect(context.validationFields).toEqual({ name: 'Required' });
  });

  it('should handle regular Error', () => {
    const error = new Error('Test');
    const context = getErrorContext(error);

    expect(context.name).toBe('Error');
    expect(context.message).toBe('Test');
    expect(context.stack).toBeDefined();
  });

  it('should handle non-Error values', () => {
    const context = getErrorContext('string error');

    expect(context.name).toBe('Unknown');
    expect(context.message).toBe('string error');
    expect(context.stack).toBeUndefined();
  });
});
