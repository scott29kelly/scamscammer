/**
 * Prisma Client Singleton
 *
 * This module provides a singleton instance of the PrismaClient
 * to prevent multiple instances during development hot reloads.
 * Includes connection monitoring and error logging.
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { createLogger } from './logger';
import { monitoring } from './monitoring';

const dbLogger = createLogger('database');

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  dbInitialized: boolean;
};

function createPrismaClient(): PrismaClient {
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
  });

  const client = new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === 'development'
        ? [
            { level: 'query', emit: 'event' },
            { level: 'error', emit: 'event' },
            { level: 'warn', emit: 'event' },
          ]
        : [{ level: 'error', emit: 'event' }],
  });

  // Set up event listeners for monitoring
  setupPrismaEvents(client);

  return client;
}

function setupPrismaEvents(client: PrismaClient): void {
  // Log and monitor queries in development
  if (process.env.NODE_ENV === 'development') {
    // @ts-expect-error - Prisma event types not fully exposed
    client.$on('query', (e: { query: string; params: string; duration: number }) => {
      dbLogger.debug('Query executed', {
        query: e.query,
        params: e.params,
        duration: `${e.duration}ms`,
      });

      // Record query metrics
      monitoring.recordHistogram('database.query.duration', e.duration, 'ms', {
        operation: extractOperation(e.query),
      });
    });
  }

  // Always log errors
  // @ts-expect-error - Prisma event types not fully exposed
  client.$on('error', (e: { message: string; target?: string }) => {
    dbLogger.error('Database error', new Error(e.message), {
      target: e.target,
    });

    monitoring.incrementCounter('database.error', 1, {
      target: e.target || 'unknown',
    });
  });

  // Log warnings
  // @ts-expect-error - Prisma event types not fully exposed
  client.$on('warn', (e: { message: string }) => {
    dbLogger.warn('Database warning', { message: e.message });
  });

  // Log when database is first connected
  if (!globalForPrisma.dbInitialized) {
    dbLogger.info('Database client initialized', {
      environment: process.env.NODE_ENV,
    });
    globalForPrisma.dbInitialized = true;
  }
}

/**
 * Extract the operation type from a SQL query
 */
function extractOperation(query: string): string {
  const normalized = query.trim().toUpperCase();
  if (normalized.startsWith('SELECT')) return 'select';
  if (normalized.startsWith('INSERT')) return 'insert';
  if (normalized.startsWith('UPDATE')) return 'update';
  if (normalized.startsWith('DELETE')) return 'delete';
  if (normalized.startsWith('BEGIN')) return 'transaction_begin';
  if (normalized.startsWith('COMMIT')) return 'transaction_commit';
  if (normalized.startsWith('ROLLBACK')) return 'transaction_rollback';
  return 'other';
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

/**
 * Test database connectivity
 * Returns true if connected, throws an error otherwise
 */
export async function testDatabaseConnection(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbLogger.debug('Database connection test successful');
    return true;
  } catch (error) {
    dbLogger.error(
      'Database connection test failed',
      error instanceof Error ? error : new Error(String(error))
    );
    throw error;
  }
}

/**
 * Gracefully disconnect from the database
 */
export async function disconnectDatabase(): Promise<void> {
  try {
    await prisma.$disconnect();
    dbLogger.info('Database disconnected gracefully');
  } catch (error) {
    dbLogger.error(
      'Error disconnecting from database',
      error instanceof Error ? error : new Error(String(error))
    );
    throw error;
  }
}

export default prisma;
