/**
 * Monitoring and Metrics Service
 *
 * This module provides performance monitoring and metrics collection:
 * - Request duration tracking
 * - Database query monitoring
 * - External service call tracking
 * - Error rate tracking
 * - Memory usage monitoring
 */

import { logger, getRequestContext } from './logger';

/**
 * Metric types
 */
export enum MetricType {
  COUNTER = 'counter',
  GAUGE = 'gauge',
  HISTOGRAM = 'histogram',
  TIMER = 'timer',
}

/**
 * Metric data structure
 */
export interface Metric {
  name: string;
  type: MetricType;
  value: number;
  unit?: string;
  tags?: Record<string, string>;
  timestamp: Date;
}

/**
 * Timer result structure
 */
export interface TimerResult<T> {
  result: T;
  duration: number;
}

/**
 * Service health status
 */
export interface ServiceHealth {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  latency?: number;
  lastCheck: Date;
  error?: string;
}

/**
 * Overall system health
 */
export interface SystemHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: Date;
  services: ServiceHealth[];
  metrics: {
    uptime: number;
    memoryUsage: NodeJS.MemoryUsage;
    requestsPerMinute?: number;
    errorRate?: number;
  };
}

/**
 * In-memory metrics store
 * In production, this would be replaced with a proper time-series database
 * like Prometheus, InfluxDB, or DataDog
 */
class MetricsStore {
  private metrics: Map<string, Metric[]> = new Map();
  private maxMetricsPerKey = 1000;
  private requestCounts: number[] = [];
  private errorCounts: number[] = [];
  private startTime = Date.now();

  /**
   * Record a metric
   */
  record(metric: Omit<Metric, 'timestamp'>): void {
    const fullMetric: Metric = {
      ...metric,
      timestamp: new Date(),
    };

    const key = this.getMetricKey(metric.name, metric.tags);
    const existing = this.metrics.get(key) || [];

    // Keep only the last N metrics per key to prevent memory issues
    if (existing.length >= this.maxMetricsPerKey) {
      existing.shift();
    }

    existing.push(fullMetric);
    this.metrics.set(key, existing);

    // Log the metric in development
    if (process.env.NODE_ENV === 'development') {
      logger.debug('Metric recorded', {
        metric: metric.name,
        value: metric.value,
        type: metric.type,
        tags: metric.tags,
      });
    }
  }

  /**
   * Get metrics by name
   */
  get(name: string, tags?: Record<string, string>): Metric[] {
    const key = this.getMetricKey(name, tags);
    return this.metrics.get(key) || [];
  }

  /**
   * Get all metrics
   */
  getAll(): Map<string, Metric[]> {
    return new Map(this.metrics);
  }

  /**
   * Record a request
   */
  recordRequest(): void {
    const now = Math.floor(Date.now() / 60000); // Current minute
    this.requestCounts.push(now);
    // Keep only last hour of data
    this.requestCounts = this.requestCounts.filter(t => t >= now - 60);
  }

  /**
   * Record an error
   */
  recordError(): void {
    const now = Math.floor(Date.now() / 60000);
    this.errorCounts.push(now);
    this.errorCounts = this.errorCounts.filter(t => t >= now - 60);
  }

  /**
   * Get requests per minute (last minute)
   */
  getRequestsPerMinute(): number {
    const now = Math.floor(Date.now() / 60000);
    return this.requestCounts.filter(t => t === now).length;
  }

  /**
   * Get error rate (errors per request in last hour)
   */
  getErrorRate(): number {
    if (this.requestCounts.length === 0) return 0;
    return this.errorCounts.length / this.requestCounts.length;
  }

  /**
   * Get uptime in seconds
   */
  getUptime(): number {
    return Math.floor((Date.now() - this.startTime) / 1000);
  }

  /**
   * Clear all metrics
   */
  clear(): void {
    this.metrics.clear();
    this.requestCounts = [];
    this.errorCounts = [];
  }

  private getMetricKey(name: string, tags?: Record<string, string>): string {
    if (!tags) return name;
    const tagStr = Object.entries(tags)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}:${v}`)
      .join(',');
    return `${name}[${tagStr}]`;
  }
}

// Global metrics store
const metricsStore = new MetricsStore();

/**
 * Monitoring service
 */
export const monitoring = {
  /**
   * Record a counter metric (increments)
   */
  incrementCounter(
    name: string,
    value: number = 1,
    tags?: Record<string, string>
  ): void {
    metricsStore.record({
      name,
      type: MetricType.COUNTER,
      value,
      tags,
    });
  },

  /**
   * Record a gauge metric (current value)
   */
  setGauge(
    name: string,
    value: number,
    unit?: string,
    tags?: Record<string, string>
  ): void {
    metricsStore.record({
      name,
      type: MetricType.GAUGE,
      value,
      unit,
      tags,
    });
  },

  /**
   * Record a histogram/distribution metric
   */
  recordHistogram(
    name: string,
    value: number,
    unit?: string,
    tags?: Record<string, string>
  ): void {
    metricsStore.record({
      name,
      type: MetricType.HISTOGRAM,
      value,
      unit,
      tags,
    });
  },

  /**
   * Time an async operation and record its duration
   */
  async timeAsync<T>(
    name: string,
    fn: () => Promise<T>,
    tags?: Record<string, string>
  ): Promise<TimerResult<T>> {
    const start = performance.now();
    try {
      const result = await fn();
      const duration = performance.now() - start;
      metricsStore.record({
        name,
        type: MetricType.TIMER,
        value: duration,
        unit: 'ms',
        tags: { ...tags, status: 'success' },
      });
      return { result, duration };
    } catch (error) {
      const duration = performance.now() - start;
      metricsStore.record({
        name,
        type: MetricType.TIMER,
        value: duration,
        unit: 'ms',
        tags: { ...tags, status: 'error' },
      });
      throw error;
    }
  },

  /**
   * Time a sync operation and record its duration
   */
  timeSync<T>(
    name: string,
    fn: () => T,
    tags?: Record<string, string>
  ): TimerResult<T> {
    const start = performance.now();
    try {
      const result = fn();
      const duration = performance.now() - start;
      metricsStore.record({
        name,
        type: MetricType.TIMER,
        value: duration,
        unit: 'ms',
        tags: { ...tags, status: 'success' },
      });
      return { result, duration };
    } catch (error) {
      const duration = performance.now() - start;
      metricsStore.record({
        name,
        type: MetricType.TIMER,
        value: duration,
        unit: 'ms',
        tags: { ...tags, status: 'error' },
      });
      throw error;
    }
  },

  /**
   * Record a request
   */
  recordRequest(): void {
    metricsStore.recordRequest();
  },

  /**
   * Record an error
   */
  recordError(): void {
    metricsStore.recordError();
  },

  /**
   * Get metrics for a specific name
   */
  getMetrics(name: string, tags?: Record<string, string>): Metric[] {
    return metricsStore.get(name, tags);
  },

  /**
   * Get all recorded metrics
   */
  getAllMetrics(): Map<string, Metric[]> {
    return metricsStore.getAll();
  },

  /**
   * Get current memory usage
   */
  getMemoryUsage(): NodeJS.MemoryUsage {
    return process.memoryUsage();
  },

  /**
   * Get requests per minute
   */
  getRequestsPerMinute(): number {
    return metricsStore.getRequestsPerMinute();
  },

  /**
   * Get error rate
   */
  getErrorRate(): number {
    return metricsStore.getErrorRate();
  },

  /**
   * Get uptime
   */
  getUptime(): number {
    return metricsStore.getUptime();
  },

  /**
   * Clear all metrics (useful for testing)
   */
  clearMetrics(): void {
    metricsStore.clear();
  },
};

/**
 * Create a timer for manual timing control
 */
export function createTimer(name: string, tags?: Record<string, string>) {
  const start = performance.now();

  return {
    /**
     * Stop the timer and record the metric
     */
    stop(additionalTags?: Record<string, string>): number {
      const duration = performance.now() - start;
      metricsStore.record({
        name,
        type: MetricType.TIMER,
        value: duration,
        unit: 'ms',
        tags: { ...tags, ...additionalTags },
      });
      return duration;
    },

    /**
     * Get elapsed time without recording
     */
    elapsed(): number {
      return performance.now() - start;
    },
  };
}

/**
 * Database query monitoring helper
 */
export function trackDatabaseQuery<T>(
  operation: string,
  model: string,
  fn: () => Promise<T>
): Promise<T> {
  return monitoring.timeAsync('database.query', fn, { operation, model }).then(r => r.result);
}

/**
 * External API call monitoring helper
 */
export function trackExternalCall<T>(
  service: string,
  operation: string,
  fn: () => Promise<T>
): Promise<T> {
  return monitoring.timeAsync('external.api', fn, { service, operation }).then(r => r.result);
}

/**
 * Create request-scoped monitoring
 */
export function createRequestMonitoring(method: string, path: string) {
  const requestId = getRequestContext()?.requestId;
  const tags = { method, path, ...(requestId && { requestId }) };

  monitoring.recordRequest();

  return {
    tags,
    recordSuccess: () => monitoring.incrementCounter('request.success', 1, tags),
    recordError: () => {
      monitoring.incrementCounter('request.error', 1, tags);
      monitoring.recordError();
    },
    trackDuration: <T>(fn: () => Promise<T>) =>
      monitoring.timeAsync('request.duration', fn, tags),
  };
}

export default monitoring;
