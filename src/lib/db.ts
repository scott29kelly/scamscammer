/**
 * Database Client - Prisma Singleton
 *
 * This module provides a singleton instance of the Prisma client
 * to prevent connection exhaustion during development with hot reloading.
 */

import { PrismaClient } from "@prisma/client";

// Declare global type for the prisma singleton
declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

/**
 * Prisma client singleton instance.
 *
 * In development, we store the client on the global object to prevent
 * multiple instances from being created during hot module replacement.
 *
 * In production, we create a new instance each time the module is loaded.
 */
export const prisma =
  globalThis.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

// Store on global in development to prevent hot reload issues
if (process.env.NODE_ENV !== "production") {
  globalThis.prisma = prisma;
}
