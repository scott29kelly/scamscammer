/**
 * Tests for the logging service
 */

import {
  logger,
  createLogger,
  LogLevel,
  generateRequestId,
  setRequestContext,
  clearRequestContext,
  getRequestContext,
  withRequestLogging,
} from '../logger';

describe('Logger', () => {
  let consoleSpy: {
    log: jest.SpyInstance;
    warn: jest.SpyInstance;
    error: jest.SpyInstance;
  };

  beforeEach(() => {
    // Spy on console methods
    consoleSpy = {
      log: jest.spyOn(console, 'log').mockImplementation(),
      warn: jest.spyOn(console, 'warn').mockImplementation(),
      error: jest.spyOn(console, 'error').mockImplementation(),
    };

    // Clear request context before each test
    clearRequestContext();
  });

  afterEach(() => {
    // Restore console methods
    consoleSpy.log.mockRestore();
    consoleSpy.warn.mockRestore();
    consoleSpy.error.mockRestore();
  });

  describe('generateRequestId', () => {
    it('should generate a valid UUID', () => {
      const requestId = generateRequestId();

      expect(requestId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
      );
    });

    it('should generate unique IDs', () => {
      const id1 = generateRequestId();
      const id2 = generateRequestId();

      expect(id1).not.toBe(id2);
    });
  });

  describe('Request Context', () => {
    it('should set and get request context', () => {
      const context = {
        requestId: 'test-123',
        method: 'GET',
        path: '/api/test',
        startTime: Date.now(),
      };

      setRequestContext(context);

      expect(getRequestContext()).toEqual(context);
    });

    it('should clear request context', () => {
      setRequestContext({
        requestId: 'test-123',
        method: 'GET',
        path: '/api/test',
      });

      clearRequestContext();

      expect(getRequestContext()).toBeNull();
    });
  });

  describe('Logger methods', () => {
    it('should call debug method without throwing', () => {
      // Debug level may or may not be logged depending on minLevel config
      // This test verifies the method works without errors
      expect(() => {
        logger.debug('Debug message', { key: 'value' });
      }).not.toThrow();
    });

    it('should log info messages', () => {
      logger.info('Info message', { key: 'value' });

      expect(consoleSpy.log).toHaveBeenCalled();
    });

    it('should log warning messages', () => {
      logger.warn('Warning message', { key: 'value' });

      expect(consoleSpy.warn).toHaveBeenCalled();
    });

    it('should log error messages', () => {
      const error = new Error('Test error');
      logger.error('Error message', error, { key: 'value' });

      expect(consoleSpy.error).toHaveBeenCalled();
    });

    it('should include request ID in logs when context is set', () => {
      setRequestContext({
        requestId: 'req-abc123',
        method: 'GET',
        path: '/api/test',
        startTime: Date.now(),
      });

      logger.info('Test message');

      expect(consoleSpy.log).toHaveBeenCalled();
      const logOutput = consoleSpy.log.mock.calls[0][0];
      expect(logOutput).toContain('req-abc1'); // First 8 chars in pretty format
    });
  });

  describe('createLogger', () => {
    it('should create a child logger with component context', () => {
      const childLogger = createLogger('database');

      childLogger.info('Database connected');

      expect(consoleSpy.log).toHaveBeenCalled();
      const logOutput = consoleSpy.log.mock.calls[0][0];
      expect(logOutput).toContain('database');
    });

    it('should merge context from child and call', () => {
      const childLogger = createLogger('api');

      childLogger.info('Request received', { endpoint: '/health' });

      expect(consoleSpy.log).toHaveBeenCalled();
      const logOutput = consoleSpy.log.mock.calls[0][0];
      expect(logOutput).toContain('api');
      expect(logOutput).toContain('/health');
    });
  });

  describe('withRequestLogging', () => {
    it('should wrap async function with request context', async () => {
      const result = await withRequestLogging('GET', '/api/test', async () => {
        return 'success';
      });

      expect(result).toBe('success');
      // Info logged for start and completion
      expect(consoleSpy.log).toHaveBeenCalledTimes(2);
    });

    it('should log errors and rethrow', async () => {
      const testError = new Error('Test error');

      await expect(
        withRequestLogging('POST', '/api/test', async () => {
          throw testError;
        })
      ).rejects.toThrow('Test error');

      expect(consoleSpy.error).toHaveBeenCalled();
    });

    it('should clear request context after completion', async () => {
      await withRequestLogging('GET', '/api/test', async () => {
        expect(getRequestContext()).not.toBeNull();
        return 'done';
      });

      expect(getRequestContext()).toBeNull();
    });

    it('should clear request context after error', async () => {
      try {
        await withRequestLogging('GET', '/api/test', async () => {
          throw new Error('test');
        });
      } catch {
        // Expected
      }

      expect(getRequestContext()).toBeNull();
    });
  });
});

describe('Logger in production mode', () => {
  const originalEnv = process.env.NODE_ENV;

  beforeAll(() => {
    process.env.NODE_ENV = 'production';
  });

  afterAll(() => {
    process.env.NODE_ENV = originalEnv;
  });

  it('should output JSON in production', () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

    logger.info('Production message');

    // In production, output should be JSON
    const output = consoleSpy.mock.calls[0]?.[0];
    if (output) {
      // Should be valid JSON
      expect(() => JSON.parse(output)).not.toThrow();
    }

    consoleSpy.mockRestore();
  });
});
