/**
 * Health Check API Endpoint
 *
 * Returns the health status of the application and its dependencies.
 * Used for monitoring, load balancer health checks, and deployment verification.
 */

import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  services: {
    database: ServiceStatus;
  };
}

interface ServiceStatus {
  status: 'up' | 'down';
  latency?: number;
  error?: string;
}

/**
 * Check database connectivity
 */
async function checkDatabase(): Promise<ServiceStatus> {
  const start = Date.now();
  try {
    // Simple query to verify database connection
    await prisma.$queryRaw`SELECT 1`;
    return {
      status: 'up',
      latency: Date.now() - start,
    };
  } catch (error) {
    return {
      status: 'down',
      latency: Date.now() - start,
      error: error instanceof Error ? error.message : 'Unknown database error',
    };
  }
}

/**
 * GET /api/health
 *
 * Returns health status of all services
 */
export async function GET(): Promise<NextResponse<HealthStatus>> {
  const databaseStatus = await checkDatabase();

  // Determine overall status
  let overallStatus: HealthStatus['status'] = 'healthy';
  if (databaseStatus.status === 'down') {
    overallStatus = 'unhealthy';
  }

  const healthStatus: HealthStatus = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '0.1.0',
    services: {
      database: databaseStatus,
    },
  };

  // Return 503 if unhealthy, 200 otherwise
  const httpStatus = overallStatus === 'unhealthy' ? 503 : 200;

  return NextResponse.json(healthStatus, { status: httpStatus });
}
