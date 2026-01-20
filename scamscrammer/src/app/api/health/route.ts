/**
 * Health Check API Endpoint
 *
 * GET /api/health - Returns service health status
 *
 * Returns 200 if all services are reachable
 * Returns 503 if any critical service is unavailable
 */

import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { logger } from '@/lib/logger';
import { getErrorMessage } from '@/lib/errors';
import type { ServiceStatus, HealthResponse } from '@/types';

// Track server start time for uptime calculation
const startTime = Date.now();

/**
 * Check database connection health
 */
async function checkDatabase(): Promise<ServiceStatus> {
  const start = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return {
      status: 'healthy',
      latency: Date.now() - start,
    };
  } catch (error) {
    logger.error('Database health check failed', { error: getErrorMessage(error) });
    return {
      status: 'unhealthy',
      latency: Date.now() - start,
      message: 'Database connection failed',
    };
  }
}

/**
 * Check Twilio configuration (not actual connection test)
 */
function checkTwilio(): ServiceStatus {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const phoneNumber = process.env.TWILIO_PHONE_NUMBER;

  if (!accountSid || !authToken) {
    return {
      status: 'unhealthy',
      message: 'Twilio credentials not configured',
    };
  }

  if (!phoneNumber) {
    return {
      status: 'degraded',
      message: 'Twilio phone number not configured',
    };
  }

  return {
    status: 'healthy',
  };
}

/**
 * Check OpenAI configuration
 */
function checkOpenAI(): ServiceStatus {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return {
      status: 'unhealthy',
      message: 'OpenAI API key not configured',
    };
  }

  return {
    status: 'healthy',
  };
}

/**
 * Check storage configuration
 */
function checkStorage(): ServiceStatus {
  const bucket = process.env.AWS_S3_BUCKET;
  const region = process.env.AWS_REGION;
  const accessKey = process.env.AWS_ACCESS_KEY_ID;
  const secretKey = process.env.AWS_SECRET_ACCESS_KEY;

  if (!bucket || !region) {
    return {
      status: 'degraded',
      message: 'S3 bucket or region not configured',
    };
  }

  if (!accessKey || !secretKey) {
    return {
      status: 'degraded',
      message: 'AWS credentials not configured',
    };
  }

  return {
    status: 'healthy',
  };
}

/**
 * Determine overall health status from individual services
 */
function getOverallStatus(services: HealthResponse['services']): HealthResponse['status'] {
  const statuses = Object.values(services).map((s) => s.status);

  // If any service is unhealthy, overall is unhealthy
  if (statuses.includes('unhealthy')) {
    // Database is critical
    if (services.database.status === 'unhealthy') {
      return 'unhealthy';
    }
    // Other services being unhealthy means degraded
    return 'degraded';
  }

  // If any service is degraded, overall is degraded
  if (statuses.includes('degraded')) {
    return 'degraded';
  }

  return 'healthy';
}

export async function GET(): Promise<NextResponse<HealthResponse>> {
  const healthLogger = logger.forRequest(`health-${Date.now()}`);

  healthLogger.debug('Health check started');

  // Check all services (database check is async)
  const [databaseStatus] = await Promise.all([
    checkDatabase(),
  ]);

  const twilioStatus = checkTwilio();
  const openaiStatus = checkOpenAI();
  const storageStatus = checkStorage();

  const services: HealthResponse['services'] = {
    database: databaseStatus,
    twilio: twilioStatus,
    openai: openaiStatus,
    storage: storageStatus,
  };

  const overallStatus = getOverallStatus(services);

  const response: HealthResponse = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    services,
    uptime: Math.floor((Date.now() - startTime) / 1000),
  };

  healthLogger.debug('Health check completed', { status: overallStatus });

  // Return appropriate HTTP status
  const httpStatus = overallStatus === 'unhealthy' ? 503 :
                     overallStatus === 'degraded' ? 200 :
                     200;

  return NextResponse.json(response, { status: httpStatus });
}
