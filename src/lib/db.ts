/**
 * Database client singleton for Prisma
 *
 * This module provides a singleton PrismaClient instance to avoid
 * creating multiple connections during development hot reloads.
 */

import { PrismaClient } from '@prisma/client';

// Declare global type for PrismaClient to persist across hot reloads
declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

/**
 * Create a new PrismaClient instance with logging configuration
 */
function createPrismaClient(): PrismaClient {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development'
      ? ['query', 'error', 'warn']
      : ['error'],
  });
}

/**
 * Singleton PrismaClient instance
 * In development, we store the client on globalThis to survive hot reloads
 * In production, we create a single instance
 */
export const prisma: PrismaClient = globalThis.prisma ?? createPrismaClient();

// Prevent multiple instances during development hot reloads
if (process.env.NODE_ENV !== 'production') {
  globalThis.prisma = prisma;
}

/**
 * Disconnect the Prisma client (useful for cleanup in tests)
 */
export async function disconnectDb(): Promise<void> {
  await prisma.$disconnect();
}

/**
 * Connect to the database (useful for health checks)
 */
export async function connectDb(): Promise<void> {
  await prisma.$connect();
}

export default prisma;
