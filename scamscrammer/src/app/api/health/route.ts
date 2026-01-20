import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  services: {
    database: ServiceStatus;
    app: ServiceStatus;
  };
  uptime: number;
}

interface ServiceStatus {
  status: 'up' | 'down' | 'unknown';
  latency?: number;
  error?: string;
}

const startTime = Date.now();

/**
 * Health check endpoint for monitoring and deployment verification
 * GET /api/health
 */
export async function GET(): Promise<NextResponse<HealthStatus>> {
  const timestamp = new Date().toISOString();
  const uptime = Math.floor((Date.now() - startTime) / 1000);

  // Check database connectivity
  const databaseStatus = await checkDatabase();

  // Determine overall health status
  const isHealthy = databaseStatus.status === 'up';
  const isDegraded = false; // Could add more checks here
  const overallStatus: 'healthy' | 'degraded' | 'unhealthy' = isHealthy
    ? 'healthy'
    : isDegraded
      ? 'degraded'
      : 'unhealthy';

  const healthStatus: HealthStatus = {
    status: overallStatus,
    timestamp,
    version: process.env.npm_package_version || '0.1.0',
    services: {
      database: databaseStatus,
      app: {
        status: 'up',
      },
    },
    uptime,
  };

  // Return 503 if unhealthy for load balancer health checks
  const statusCode = overallStatus === 'unhealthy' ? 503 : 200;

  return NextResponse.json(healthStatus, { status: statusCode });
}

/**
 * Check database connectivity and measure latency
 */
async function checkDatabase(): Promise<ServiceStatus> {
  const start = Date.now();
  try {
    // Simple query to verify database connection
    await prisma.$queryRaw`SELECT 1`;
    const latency = Date.now() - start;

    return {
      status: 'up',
      latency,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown database error';

    return {
      status: 'down',
      error: errorMessage,
    };
  }
}
