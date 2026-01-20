/**
 * Tests for the monitoring service
 */

import {
  monitoring,
  createTimer,
  MetricType,
  trackDatabaseQuery,
  trackExternalCall,
  createRequestMonitoring,
} from '../monitoring';
import { setRequestContext, clearRequestContext } from '../logger';

describe('Monitoring Service', () => {
  beforeEach(() => {
    // Clear metrics before each test
    monitoring.clearMetrics();
    clearRequestContext();
  });

  describe('Counter metrics', () => {
    it('should increment counter', () => {
      monitoring.incrementCounter('test.counter', 1, { type: 'test' });
      monitoring.incrementCounter('test.counter', 2, { type: 'test' });

      const metrics = monitoring.getMetrics('test.counter', { type: 'test' });

      expect(metrics).toHaveLength(2);
      expect(metrics[0].value).toBe(1);
      expect(metrics[1].value).toBe(2);
      expect(metrics[0].type).toBe(MetricType.COUNTER);
    });
  });

  describe('Gauge metrics', () => {
    it('should set gauge value', () => {
      monitoring.setGauge('test.gauge', 100, 'bytes', { resource: 'memory' });

      const metrics = monitoring.getMetrics('test.gauge', { resource: 'memory' });

      expect(metrics).toHaveLength(1);
      expect(metrics[0].value).toBe(100);
      expect(metrics[0].unit).toBe('bytes');
      expect(metrics[0].type).toBe(MetricType.GAUGE);
    });
  });

  describe('Histogram metrics', () => {
    it('should record histogram value', () => {
      monitoring.recordHistogram('response.time', 150, 'ms', { endpoint: '/api' });
      monitoring.recordHistogram('response.time', 200, 'ms', { endpoint: '/api' });

      const metrics = monitoring.getMetrics('response.time', { endpoint: '/api' });

      expect(metrics).toHaveLength(2);
      expect(metrics[0].type).toBe(MetricType.HISTOGRAM);
    });
  });

  describe('Timer metrics', () => {
    it('should time async operations', async () => {
      const result = await monitoring.timeAsync(
        'async.operation',
        async () => {
          await new Promise((resolve) => setTimeout(resolve, 10));
          return 'result';
        },
        { operation: 'test' }
      );

      expect(result.result).toBe('result');
      expect(result.duration).toBeGreaterThanOrEqual(10);

      const metrics = monitoring.getMetrics('async.operation', {
        operation: 'test',
        status: 'success',
      });
      expect(metrics).toHaveLength(1);
      expect(metrics[0].type).toBe(MetricType.TIMER);
    });

    it('should record error status on failure', async () => {
      await expect(
        monitoring.timeAsync(
          'failing.operation',
          async () => {
            throw new Error('Test error');
          },
          { operation: 'test' }
        )
      ).rejects.toThrow('Test error');

      const metrics = monitoring.getMetrics('failing.operation', {
        operation: 'test',
        status: 'error',
      });
      expect(metrics).toHaveLength(1);
    });

    it('should time sync operations', () => {
      const result = monitoring.timeSync(
        'sync.operation',
        () => {
          let sum = 0;
          for (let i = 0; i < 1000; i++) sum += i;
          return sum;
        },
        { operation: 'computation' }
      );

      expect(result.result).toBe(499500);
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });
  });

  describe('createTimer', () => {
    it('should create a manual timer', () => {
      const timer = createTimer('manual.timer', { operation: 'test' });

      // Simulate some work
      const elapsed1 = timer.elapsed();
      expect(elapsed1).toBeGreaterThanOrEqual(0);

      // Stop and record
      const duration = timer.stop({ status: 'success' });
      expect(duration).toBeGreaterThanOrEqual(0);

      const metrics = monitoring.getMetrics('manual.timer', {
        operation: 'test',
        status: 'success',
      });
      expect(metrics).toHaveLength(1);
    });
  });

  describe('Request tracking', () => {
    it('should record requests', () => {
      monitoring.recordRequest();
      monitoring.recordRequest();
      monitoring.recordRequest();

      const rpm = monitoring.getRequestsPerMinute();
      expect(rpm).toBe(3);
    });

    it('should record errors', () => {
      monitoring.recordRequest();
      monitoring.recordRequest();
      monitoring.recordError();

      const errorRate = monitoring.getErrorRate();
      expect(errorRate).toBe(0.5); // 1 error / 2 requests
    });
  });

  describe('System metrics', () => {
    it('should return memory usage', () => {
      const memory = monitoring.getMemoryUsage();

      expect(memory).toHaveProperty('heapUsed');
      expect(memory).toHaveProperty('heapTotal');
      expect(memory).toHaveProperty('external');
      expect(memory).toHaveProperty('rss');
    });

    it('should return uptime', () => {
      const uptime = monitoring.getUptime();
      expect(uptime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('trackDatabaseQuery', () => {
    it('should track database query execution', async () => {
      const result = await trackDatabaseQuery('findMany', 'Call', async () => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        return [{ id: 1 }, { id: 2 }];
      });

      expect(result).toEqual([{ id: 1 }, { id: 2 }]);

      const metrics = monitoring.getMetrics('database.query', {
        operation: 'findMany',
        model: 'Call',
        status: 'success',
      });
      expect(metrics).toHaveLength(1);
    });
  });

  describe('trackExternalCall', () => {
    it('should track external API calls', async () => {
      const result = await trackExternalCall('Twilio', 'sendSMS', async () => {
        return { sid: 'SM123' };
      });

      expect(result).toEqual({ sid: 'SM123' });

      const metrics = monitoring.getMetrics('external.api', {
        service: 'Twilio',
        operation: 'sendSMS',
        status: 'success',
      });
      expect(metrics).toHaveLength(1);
    });
  });

  describe('createRequestMonitoring', () => {
    it('should create request-scoped monitoring', () => {
      setRequestContext({
        requestId: 'req-123',
        method: 'GET',
        path: '/api/test',
        startTime: Date.now(),
      });

      const reqMonitoring = createRequestMonitoring('GET', '/api/test');

      expect(reqMonitoring.tags).toEqual({
        method: 'GET',
        path: '/api/test',
        requestId: 'req-123',
      });

      // A request should be recorded
      expect(monitoring.getRequestsPerMinute()).toBe(1);
    });

    it('should record success', () => {
      const reqMonitoring = createRequestMonitoring('POST', '/api/create');
      reqMonitoring.recordSuccess();

      const metrics = monitoring.getMetrics('request.success', {
        method: 'POST',
        path: '/api/create',
      });
      expect(metrics).toHaveLength(1);
    });

    it('should record error', () => {
      const reqMonitoring = createRequestMonitoring('PUT', '/api/update');
      reqMonitoring.recordError();

      const metrics = monitoring.getMetrics('request.error', {
        method: 'PUT',
        path: '/api/update',
      });
      expect(metrics).toHaveLength(1);

      // Error should also be recorded in error rate
      const errorRate = monitoring.getErrorRate();
      expect(errorRate).toBeGreaterThan(0);
    });
  });

  describe('getAllMetrics', () => {
    it('should return all recorded metrics', () => {
      monitoring.incrementCounter('counter1', 1);
      monitoring.setGauge('gauge1', 100);

      const allMetrics = monitoring.getAllMetrics();

      expect(allMetrics.size).toBeGreaterThanOrEqual(2);
    });
  });
});
