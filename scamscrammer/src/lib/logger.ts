/**
 * Structured Logging Service
 *
 * This module provides a structured logging system with support for:
 * - Multiple log levels (debug, info, warn, error)
 * - Structured JSON output for log aggregation
 * - Correlation ID tracking for request tracing
 * - Context metadata for enhanced debugging
 */

import { randomUUID } from 'crypto';

/**
 * Log levels in order of severity
 */
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

/**
 * Numeric priority for log levels (higher = more severe)
 */
const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  [LogLevel.DEBUG]: 0,
  [LogLevel.INFO]: 1,
  [LogLevel.WARN]: 2,
  [LogLevel.ERROR]: 3,
};

/**
 * Log entry structure
 */
export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  requestId?: string;
  context?: Record<string, unknown>;
  error?: {
    name: string;
    message: string;
    stack?: string;
    code?: string;
  };
  duration?: number;
  service: string;
  environment: string;
}

/**
 * Logger configuration
 */
export interface LoggerConfig {
  service: string;
  minLevel?: LogLevel;
  enabled?: boolean;
}

/**
 * Request context for tracking
 */
export interface RequestContext {
  requestId: string;
  method?: string;
  path?: string;
  userAgent?: string;
  ip?: string;
  startTime?: number;
}

// Store for current request context (using AsyncLocalStorage would be ideal in production)
let currentRequestContext: RequestContext | null = null;

/**
 * Set the current request context
 */
export function setRequestContext(context: RequestContext): void {
  currentRequestContext = context;
}

/**
 * Clear the current request context
 */
export function clearRequestContext(): void {
  currentRequestContext = null;
}

/**
 * Get the current request context
 */
export function getRequestContext(): RequestContext | null {
  return currentRequestContext;
}

/**
 * Generate a unique request ID
 */
export function generateRequestId(): string {
  return randomUUID();
}

/**
 * Logger class for structured logging
 */
class Logger {
  private config: Required<LoggerConfig>;

  constructor(config: LoggerConfig) {
    this.config = {
      service: config.service,
      minLevel: config.minLevel ?? (process.env.NODE_ENV === 'development' ? LogLevel.DEBUG : LogLevel.INFO),
      enabled: config.enabled ?? true,
    };
  }

  /**
   * Check if a log level should be output
   */
  private shouldLog(level: LogLevel): boolean {
    if (!this.config.enabled) return false;
    return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[this.config.minLevel];
  }

  /**
   * Format and output a log entry
   */
  private log(
    level: LogLevel,
    message: string,
    context?: Record<string, unknown>,
    error?: Error
  ): void {
    if (!this.shouldLog(level)) return;

    const requestContext = getRequestContext();

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      service: this.config.service,
      environment: process.env.NODE_ENV || 'development',
      ...(requestContext?.requestId && { requestId: requestContext.requestId }),
      ...(context && { context }),
      ...(requestContext?.startTime && {
        duration: Date.now() - requestContext.startTime,
      }),
    };

    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
        ...(error as { code?: string }).code && {
          code: (error as { code?: string }).code,
        },
      };
    }

    // In production, output JSON for log aggregation
    // In development, use a more readable format
    if (process.env.NODE_ENV === 'production') {
      this.outputJSON(level, entry);
    } else {
      this.outputPretty(level, entry);
    }
  }

  /**
   * Output log entry as JSON
   */
  private outputJSON(level: LogLevel, entry: LogEntry): void {
    const output = JSON.stringify(entry);
    switch (level) {
      case LogLevel.ERROR:
        console.error(output);
        break;
      case LogLevel.WARN:
        console.warn(output);
        break;
      default:
        console.log(output);
    }
  }

  /**
   * Output log entry in a pretty format for development
   */
  private outputPretty(level: LogLevel, entry: LogEntry): void {
    const timestamp = entry.timestamp.split('T')[1].split('.')[0];
    const levelColor = this.getLevelColor(level);
    const prefix = `[${timestamp}] ${levelColor}${level.toUpperCase().padEnd(5)}${this.resetColor()}`;
    const requestIdPart = entry.requestId ? ` (${entry.requestId.slice(0, 8)})` : '';

    let message = `${prefix}${requestIdPart}: ${entry.message}`;

    if (entry.context && Object.keys(entry.context).length > 0) {
      message += `\n  Context: ${JSON.stringify(entry.context)}`;
    }

    if (entry.duration !== undefined) {
      message += ` [${entry.duration}ms]`;
    }

    if (entry.error) {
      message += `\n  Error: ${entry.error.name}: ${entry.error.message}`;
      if (entry.error.stack && level === LogLevel.ERROR) {
        message += `\n  Stack: ${entry.error.stack.split('\n').slice(1, 4).join('\n  ')}`;
      }
    }

    switch (level) {
      case LogLevel.ERROR:
        console.error(message);
        break;
      case LogLevel.WARN:
        console.warn(message);
        break;
      default:
        console.log(message);
    }
  }

  /**
   * Get ANSI color code for log level
   */
  private getLevelColor(level: LogLevel): string {
    // Skip colors if not in a TTY
    if (!process.stdout.isTTY) return '';

    switch (level) {
      case LogLevel.DEBUG:
        return '\x1b[36m'; // Cyan
      case LogLevel.INFO:
        return '\x1b[32m'; // Green
      case LogLevel.WARN:
        return '\x1b[33m'; // Yellow
      case LogLevel.ERROR:
        return '\x1b[31m'; // Red
      default:
        return '';
    }
  }

  /**
   * Reset ANSI color
   */
  private resetColor(): string {
    if (!process.stdout.isTTY) return '';
    return '\x1b[0m';
  }

  /**
   * Log a debug message
   */
  debug(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  /**
   * Log an info message
   */
  info(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.INFO, message, context);
  }

  /**
   * Log a warning message
   */
  warn(message: string, context?: Record<string, unknown>, error?: Error): void {
    this.log(LogLevel.WARN, message, context, error);
  }

  /**
   * Log an error message
   */
  error(message: string, error?: Error, context?: Record<string, unknown>): void {
    this.log(LogLevel.ERROR, message, context, error);
  }

  /**
   * Create a child logger with additional default context
   */
  child(defaultContext: Record<string, unknown>): ChildLogger {
    return new ChildLogger(this, defaultContext);
  }
}

/**
 * Child logger with preset context
 */
class ChildLogger {
  constructor(
    private parent: Logger,
    private defaultContext: Record<string, unknown>
  ) {}

  private mergeContext(context?: Record<string, unknown>): Record<string, unknown> {
    return { ...this.defaultContext, ...context };
  }

  debug(message: string, context?: Record<string, unknown>): void {
    this.parent.debug(message, this.mergeContext(context));
  }

  info(message: string, context?: Record<string, unknown>): void {
    this.parent.info(message, this.mergeContext(context));
  }

  warn(message: string, context?: Record<string, unknown>, error?: Error): void {
    this.parent.warn(message, this.mergeContext(context), error);
  }

  error(message: string, error?: Error, context?: Record<string, unknown>): void {
    this.parent.error(message, error, this.mergeContext(context));
  }
}

// Create the default logger instance
export const logger = new Logger({
  service: 'scamscrammer',
});

export default logger;

/**
 * Create a logger for a specific component/module
 */
export function createLogger(component: string): ChildLogger {
  return logger.child({ component });
}

/**
 * Utility to wrap an async function with request context and logging
 */
export async function withRequestLogging<T>(
  method: string,
  path: string,
  fn: () => Promise<T>
): Promise<T> {
  const requestId = generateRequestId();
  const startTime = Date.now();

  setRequestContext({
    requestId,
    method,
    path,
    startTime,
  });

  logger.info(`${method} ${path}`, { method, path });

  try {
    const result = await fn();
    logger.info(`${method} ${path} completed`, {
      method,
      path,
      duration: Date.now() - startTime,
    });
    return result;
  } catch (error) {
    logger.error(`${method} ${path} failed`, error instanceof Error ? error : new Error(String(error)), {
      method,
      path,
      duration: Date.now() - startTime,
    });
    throw error;
  } finally {
    clearRequestContext();
  }
}
