/**
 * Simple Authentication Module for ScamScrammer
 *
 * MVP-level authentication using password protection with secure sessions.
 * This protects the dashboard routes while keeping Twilio webhooks accessible.
 */

import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';

// Session configuration
const SESSION_COOKIE_NAME = 'scamscrammer_session';
const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days in seconds

/**
 * Generate a simple hash for session token validation
 * Note: In production, use a proper cryptographic library
 */
function simpleHash(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36) + input.length.toString(36);
}

/**
 * Generate a session token from password
 */
export function generateSessionToken(password: string): string {
  const timestamp = Date.now().toString(36);
  const passwordHash = simpleHash(password);
  return `${timestamp}.${passwordHash}`;
}

/**
 * Validate password against environment variable
 */
export function validatePassword(password: string): boolean {
  const correctPassword = process.env.DASHBOARD_PASSWORD;
  if (!correctPassword) {
    console.warn('DASHBOARD_PASSWORD not set in environment');
    return false;
  }
  return password === correctPassword;
}

/**
 * Check if a session token is valid
 */
export function isValidSession(token: string): boolean {
  if (!token) return false;

  const correctPassword = process.env.DASHBOARD_PASSWORD;
  if (!correctPassword) return false;

  const [timestamp, passwordHash] = token.split('.');
  if (!timestamp || !passwordHash) return false;

  // Verify the password hash matches
  const expectedHash = simpleHash(correctPassword);
  if (passwordHash !== expectedHash) return false;

  // Check if session is not expired (7 days)
  const tokenTime = parseInt(timestamp, 36);
  const now = Date.now();
  const maxAge = SESSION_MAX_AGE * 1000; // Convert to milliseconds

  return (now - tokenTime) < maxAge;
}

/**
 * Create authentication session (set cookie)
 */
export async function createSession(): Promise<void> {
  const password = process.env.DASHBOARD_PASSWORD;
  if (!password) {
    throw new Error('DASHBOARD_PASSWORD not configured');
  }

  const token = generateSessionToken(password);
  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_MAX_AGE,
    path: '/',
  });
}

/**
 * Destroy authentication session (clear cookie)
 */
export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

/**
 * Check if current request is authenticated (for server components)
 */
export async function isAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);

  if (!sessionCookie?.value) return false;

  return isValidSession(sessionCookie.value);
}

/**
 * Check if request is authenticated (for middleware)
 */
export function isAuthenticatedRequest(request: NextRequest): boolean {
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME);

  if (!sessionCookie?.value) return false;

  return isValidSession(sessionCookie.value);
}

/**
 * Get the session cookie name (for external use)
 */
export function getSessionCookieName(): string {
  return SESSION_COOKIE_NAME;
}

/**
 * Check if the route should be protected
 */
export function isProtectedRoute(pathname: string): boolean {
  // Protect dashboard routes
  const protectedPatterns = [
    /^\/calls/,           // All /calls/* routes
    /^\/api\/calls/,      // All /api/calls/* routes
  ];

  return protectedPatterns.some(pattern => pattern.test(pathname));
}

/**
 * Check if the route is the login page
 */
export function isLoginRoute(pathname: string): boolean {
  return pathname === '/login';
}

/**
 * Check if the route is an API route
 */
export function isApiRoute(pathname: string): boolean {
  return pathname.startsWith('/api/');
}
