/**
 * Tests for logging utility
 */

import { Logger, logger, twilioLogger, openaiLogger, storageLogger, databaseLogger, apiLogger } from '../logger';

describe('Logger', () => {
  let consoleSpy: {
    log: jest.SpyInstance;
    error: jest.SpyInstance;
    warn: jest.SpyInstance;
    debug: jest.SpyInstance;
  };

  beforeEach(() => {
    consoleSpy = {
      log: jest.spyOn(console, 'log').mockImplementation(),
      error: jest.spyOn(console, 'error').mockImplementation(),
      warn: jest.spyOn(console, 'warn').mockImplementation(),
      debug: jest.spyOn(console, 'debug').mockImplementation(),
    };
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('log levels', () => {
    it('should log info messages', () => {
      const testLogger = new Logger({ minLevel: 'debug', prettyPrint: false });
      testLogger.info('Test info message');

      expect(consoleSpy.log).toHaveBeenCalledTimes(1);
      const loggedData = JSON.parse(consoleSpy.log.mock.calls[0][0]);
      expect(loggedData.level).toBe('info');
      expect(loggedData.message).toBe('Test info message');
    });

    it('should log error messages with console.error', () => {
      const testLogger = new Logger({ minLevel: 'debug', prettyPrint: false });
      testLogger.error('Test error message');

      expect(consoleSpy.error).toHaveBeenCalledTimes(1);
      const loggedData = JSON.parse(consoleSpy.error.mock.calls[0][0]);
      expect(loggedData.level).toBe('error');
      expect(loggedData.message).toBe('Test error message');
    });

    it('should log warn messages with console.warn', () => {
      const testLogger = new Logger({ minLevel: 'debug', prettyPrint: false });
      testLogger.warn('Test warning message');

      expect(consoleSpy.warn).toHaveBeenCalledTimes(1);
      const loggedData = JSON.parse(consoleSpy.warn.mock.calls[0][0]);
      expect(loggedData.level).toBe('warn');
      expect(loggedData.message).toBe('Test warning message');
    });

    it('should log debug messages with console.debug', () => {
      const testLogger = new Logger({ minLevel: 'debug', prettyPrint: false });
      testLogger.debug('Test debug message');

      expect(consoleSpy.debug).toHaveBeenCalledTimes(1);
      const loggedData = JSON.parse(consoleSpy.debug.mock.calls[0][0]);
      expect(loggedData.level).toBe('debug');
      expect(loggedData.message).toBe('Test debug message');
    });
  });

  describe('log filtering', () => {
    it('should filter out debug when minLevel is info', () => {
      const testLogger = new Logger({ minLevel: 'info', prettyPrint: false });
      testLogger.debug('Debug message');
      testLogger.info('Info message');

      expect(consoleSpy.debug).not.toHaveBeenCalled();
      expect(consoleSpy.log).toHaveBeenCalledTimes(1);
    });

    it('should filter out info and debug when minLevel is warn', () => {
      const testLogger = new Logger({ minLevel: 'warn', prettyPrint: false });
      testLogger.debug('Debug message');
      testLogger.info('Info message');
      testLogger.warn('Warn message');

      expect(consoleSpy.debug).not.toHaveBeenCalled();
      expect(consoleSpy.log).not.toHaveBeenCalled();
      expect(consoleSpy.warn).toHaveBeenCalledTimes(1);
    });

    it('should only log errors when minLevel is error', () => {
      const testLogger = new Logger({ minLevel: 'error', prettyPrint: false });
      testLogger.debug('Debug message');
      testLogger.info('Info message');
      testLogger.warn('Warn message');
      testLogger.error('Error message');

      expect(consoleSpy.debug).not.toHaveBeenCalled();
      expect(consoleSpy.log).not.toHaveBeenCalled();
      expect(consoleSpy.warn).not.toHaveBeenCalled();
      expect(consoleSpy.error).toHaveBeenCalledTimes(1);
    });
  });

  describe('context', () => {
    it('should include context in log entry', () => {
      const testLogger = new Logger({ minLevel: 'debug', prettyPrint: false });
      testLogger.info('Test message', { userId: '123', action: 'login' });

      const loggedData = JSON.parse(consoleSpy.log.mock.calls[0][0]);
      expect(loggedData.context).toEqual({ userId: '123', action: 'login' });
    });

    it('should merge default context with call context', () => {
      const testLogger = new Logger({ minLevel: 'debug', prettyPrint: false }, { service: 'test' });
      testLogger.info('Test message', { action: 'login' });

      const loggedData = JSON.parse(consoleSpy.log.mock.calls[0][0]);
      expect(loggedData.context).toEqual({ service: 'test', action: 'login' });
    });

    it('should not include empty context', () => {
      const testLogger = new Logger({ minLevel: 'debug', prettyPrint: false });
      testLogger.info('Test message');

      const loggedData = JSON.parse(consoleSpy.log.mock.calls[0][0]);
      expect(loggedData.context).toBeUndefined();
    });
  });

  describe('child loggers', () => {
    it('should create child logger with additional context', () => {
      const parentLogger = new Logger({ minLevel: 'debug', prettyPrint: false }, { service: 'parent' });
      const childLogger = parentLogger.child({ requestId: 'req-123' });

      childLogger.info('Child message');

      const loggedData = JSON.parse(consoleSpy.log.mock.calls[0][0]);
      expect(loggedData.context).toEqual({ service: 'parent', requestId: 'req-123' });
    });

    it('should create request logger with requestId', () => {
      const testLogger = new Logger({ minLevel: 'debug', prettyPrint: false });
      const requestLogger = testLogger.forRequest('req-456');

      requestLogger.info('Request message');

      const loggedData = JSON.parse(consoleSpy.log.mock.calls[0][0]);
      expect(loggedData.context?.requestId).toBe('req-456');
    });

    it('should create service logger with service name', () => {
      const testLogger = new Logger({ minLevel: 'debug', prettyPrint: false });
      const serviceLogger = testLogger.forService('auth');

      serviceLogger.info('Service message');

      const loggedData = JSON.parse(consoleSpy.log.mock.calls[0][0]);
      expect(loggedData.context?.service).toBe('auth');
    });
  });

  describe('error logging', () => {
    it('should include error details', () => {
      const testLogger = new Logger({ minLevel: 'debug', prettyPrint: false });
      const error = new Error('Test error');
      testLogger.error('An error occurred', { operation: 'test' }, error);

      const loggedData = JSON.parse(consoleSpy.error.mock.calls[0][0]);
      expect(loggedData.error).toBeDefined();
      expect(loggedData.error.name).toBe('Error');
      expect(loggedData.error.message).toBe('Test error');
      expect(loggedData.error.stack).toBeDefined();
    });

    it('should handle logError with Error object', () => {
      const testLogger = new Logger({ minLevel: 'debug', prettyPrint: false });
      const error = new Error('Something went wrong');
      testLogger.logError(error, 'Operation failed');

      const loggedData = JSON.parse(consoleSpy.error.mock.calls[0][0]);
      expect(loggedData.message).toBe('Operation failed');
      expect(loggedData.error.message).toBe('Something went wrong');
    });

    it('should handle logError with non-Error', () => {
      const testLogger = new Logger({ minLevel: 'debug', prettyPrint: false });
      testLogger.logError('String error');

      const loggedData = JSON.parse(consoleSpy.error.mock.calls[0][0]);
      expect(loggedData.error.message).toBe('String error');
    });

    it('should use error message when no message provided', () => {
      const testLogger = new Logger({ minLevel: 'debug', prettyPrint: false });
      const error = new Error('Error message as log message');
      testLogger.logError(error);

      const loggedData = JSON.parse(consoleSpy.error.mock.calls[0][0]);
      expect(loggedData.message).toBe('Error message as log message');
    });
  });

  describe('pretty print mode', () => {
    it('should output human-readable format', () => {
      const testLogger = new Logger({ minLevel: 'debug', prettyPrint: true });
      testLogger.info('Test message', { key: 'value' });

      expect(consoleSpy.log).toHaveBeenCalledTimes(1);
      const output = consoleSpy.log.mock.calls[0][0];
      expect(output).toContain('INFO');
      expect(output).toContain('Test message');
      expect(output).toContain('Context:');
      expect(output).toContain('key');
    });
  });

  describe('timestamp', () => {
    it('should include timestamp by default', () => {
      const testLogger = new Logger({ minLevel: 'debug', prettyPrint: false });
      testLogger.info('Test');

      const loggedData = JSON.parse(consoleSpy.log.mock.calls[0][0]);
      expect(loggedData.timestamp).toBeDefined();
      expect(new Date(loggedData.timestamp).getTime()).not.toBeNaN();
    });

    it('should exclude timestamp when configured', () => {
      const testLogger = new Logger({ minLevel: 'debug', prettyPrint: false, includeTimestamp: false });
      testLogger.info('Test');

      const loggedData = JSON.parse(consoleSpy.log.mock.calls[0][0]);
      expect(loggedData.timestamp).toBe('');
    });
  });

  describe('pre-configured loggers', () => {
    it('should have service-specific loggers', () => {
      expect(twilioLogger).toBeInstanceOf(Logger);
      expect(openaiLogger).toBeInstanceOf(Logger);
      expect(storageLogger).toBeInstanceOf(Logger);
      expect(databaseLogger).toBeInstanceOf(Logger);
      expect(apiLogger).toBeInstanceOf(Logger);
    });

    it('should have default logger', () => {
      expect(logger).toBeInstanceOf(Logger);
    });
  });
});
