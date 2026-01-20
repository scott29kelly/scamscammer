/**
 * Logging Utility
 *
 * A structured logging utility that can be easily swapped for
 * an external logging service (e.g., Datadog, Logtail, Sentry).
 *
 * Currently outputs to console with structured JSON format in production
 * and human-readable format in development.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  [key: string]: unknown;
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: LogContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

/**
 * Logger configuration
 */
interface LoggerConfig {
  minLevel: LogLevel;
  prettyPrint: boolean;
  includeTimestamp: boolean;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const DEFAULT_CONFIG: LoggerConfig = {
  minLevel: (process.env.LOG_LEVEL as LogLevel) || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  prettyPrint: process.env.NODE_ENV !== 'production',
  includeTimestamp: true,
};

/**
 * Logger class with support for structured logging
 */
class Logger {
  private config: LoggerConfig;
  private defaultContext: LogContext;

  constructor(config: Partial<LoggerConfig> = {}, defaultContext: LogContext = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.defaultContext = defaultContext;
  }

  /**
   * Create a child logger with additional default context
   */
  child(context: LogContext): Logger {
    return new Logger(this.config, { ...this.defaultContext, ...context });
  }

  /**
   * Check if a log level should be logged
   */
  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.config.minLevel];
  }

  /**
   * Format and output a log entry
   */
  private log(level: LogLevel, message: string, context?: LogContext, error?: Error): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const entry: LogEntry = {
      timestamp: this.config.includeTimestamp ? new Date().toISOString() : '',
      level,
      message,
    };

    const mergedContext = { ...this.defaultContext, ...context };
    if (Object.keys(mergedContext).length > 0) {
      entry.context = mergedContext;
    }

    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    }

    this.output(level, entry);
  }

  /**
   * Output log entry to console
   */
  private output(level: LogLevel, entry: LogEntry): void {
    const consoleFn = level === 'error' ? console.error :
                      level === 'warn' ? console.warn :
                      level === 'debug' ? console.debug :
                      console.log;

    if (this.config.prettyPrint) {
      // Human-readable format for development
      const timestamp = entry.timestamp ? `[${entry.timestamp}] ` : '';
      const levelStr = level.toUpperCase().padEnd(5);
      let output = `${timestamp}${levelStr} ${entry.message}`;

      if (entry.context) {
        output += `\n  Context: ${JSON.stringify(entry.context, null, 2).replace(/\n/g, '\n  ')}`;
      }

      if (entry.error) {
        output += `\n  Error: ${entry.error.name}: ${entry.error.message}`;
        if (entry.error.stack) {
          output += `\n  Stack: ${entry.error.stack.split('\n').slice(1).join('\n  ')}`;
        }
      }

      consoleFn(output);
    } else {
      // JSON format for production (easy to parse by log aggregators)
      consoleFn(JSON.stringify(entry));
    }
  }

  /**
   * Log a debug message
   */
  debug(message: string, context?: LogContext): void {
    this.log('debug', message, context);
  }

  /**
   * Log an info message
   */
  info(message: string, context?: LogContext): void {
    this.log('info', message, context);
  }

  /**
   * Log a warning message
   */
  warn(message: string, context?: LogContext, error?: Error): void {
    this.log('warn', message, context, error);
  }

  /**
   * Log an error message
   */
  error(message: string, context?: LogContext, error?: Error): void {
    this.log('error', message, context, error);
  }

  /**
   * Log an error with full error object
   */
  logError(error: unknown, message?: string, context?: LogContext): void {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    this.error(message || errorObj.message, context, errorObj);
  }

  /**
   * Create a request logger with request ID
   */
  forRequest(requestId: string, additionalContext?: LogContext): Logger {
    return this.child({ requestId, ...additionalContext });
  }

  /**
   * Create a service-specific logger
   */
  forService(serviceName: string): Logger {
    return this.child({ service: serviceName });
  }
}

// Default logger instance
export const logger = new Logger();

// Service-specific loggers
export const twilioLogger = logger.forService('twilio');
export const openaiLogger = logger.forService('openai');
export const storageLogger = logger.forService('storage');
export const databaseLogger = logger.forService('database');
export const apiLogger = logger.forService('api');

// Export for creating custom loggers
export { Logger };
export default logger;
