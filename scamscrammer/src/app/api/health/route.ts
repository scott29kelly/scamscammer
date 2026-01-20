/**
 * Health Check API Endpoint
 *
 * GET /api/health - Returns the health status of the service and its dependencies
 *
 * This endpoint is used for:
 * - Load balancer health checks
 * - Kubernetes liveness/readiness probes
 * - Monitoring and alerting systems
 */

import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { logger, generateRequestId, setRequestContext, clearRequestContext } from '@/lib/logger';
import { monitoring, type ServiceHealth, type SystemHealth } from '@/lib/monitoring';

/**
 * Health check response type
 */
interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  services: ServiceHealth[];
  metrics: {
    uptime: number;
    memoryUsage: {
      heapUsed: number;
      heapTotal: number;
      external: number;
      rss: number;
    };
    requestsPerMinute: number;
    errorRate: number;
  };
}

/**
 * Check database connectivity
 */
async function checkDatabase(): Promise<ServiceHealth> {
  const start = Date.now();
  try {
    // Simple query to check database connectivity
    await prisma.$queryRaw`SELECT 1`;
    const latency = Date.now() - start;

    return {
      name: 'database',
      status: latency < 1000 ? 'healthy' : 'degraded',
      latency,
      lastCheck: new Date(),
    };
  } catch (error) {
    return {
      name: 'database',
      status: 'unhealthy',
      latency: Date.now() - start,
      lastCheck: new Date(),
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Determine overall system status based on service statuses
 */
function determineOverallStatus(
  services: ServiceHealth[]
): 'healthy' | 'degraded' | 'unhealthy' {
  const hasUnhealthy = services.some((s) => s.status === 'unhealthy');
  const hasDegraded = services.some((s) => s.status === 'degraded');

  if (hasUnhealthy) return 'unhealthy';
  if (hasDegraded) return 'degraded';
  return 'healthy';
}

export async function GET(): Promise<NextResponse<HealthCheckResponse>> {
  const requestId = generateRequestId();
  setRequestContext({
    requestId,
    method: 'GET',
    path: '/api/health',
    startTime: Date.now(),
  });

  logger.debug('Health check requested');

  try {
    // Check all services in parallel
    const services = await Promise.all([checkDatabase()]);

    // Get system metrics
    const memoryUsage = monitoring.getMemoryUsage();

    const response: HealthCheckResponse = {
      status: determineOverallStatus(services),
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '0.0.1',
      services,
      metrics: {
        uptime: monitoring.getUptime(),
        memoryUsage: {
          heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024), // MB
          heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024), // MB
          external: Math.round(memoryUsage.external / 1024 / 1024), // MB
          rss: Math.round(memoryUsage.rss / 1024 / 1024), // MB
        },
        requestsPerMinute: monitoring.getRequestsPerMinute(),
        errorRate: Math.round(monitoring.getErrorRate() * 10000) / 100, // Percentage with 2 decimals
      },
    };

    // Set appropriate status code based on health status
    const statusCode =
      response.status === 'healthy'
        ? 200
        : response.status === 'degraded'
          ? 200 // Still return 200 for degraded (service is functional)
          : 503;

    logger.info('Health check completed', {
      status: response.status,
      serviceStatuses: services.map((s) => ({ name: s.name, status: s.status })),
    });

    return NextResponse.json(response, { status: statusCode });
  } catch (error) {
    logger.error(
      'Health check failed',
      error instanceof Error ? error : new Error(String(error))
    );

    const errorResponse: HealthCheckResponse = {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '0.0.1',
      services: [],
      metrics: {
        uptime: monitoring.getUptime(),
        memoryUsage: {
          heapUsed: 0,
          heapTotal: 0,
          external: 0,
          rss: 0,
        },
        requestsPerMinute: 0,
        errorRate: 100,
      },
    };

    return NextResponse.json(errorResponse, { status: 503 });
  } finally {
    clearRequestContext();
  }
}
