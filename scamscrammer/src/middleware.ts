/**
 * Next.js Middleware for Route Protection
 *
 * Protects dashboard routes (/calls/*, /api/calls/*) while
 * keeping public routes and Twilio webhooks accessible.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  isAuthenticatedRequest,
  isProtectedRoute,
  isLoginRoute,
  isApiRoute,
} from '@/lib/auth';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check if this is a protected route
  if (!isProtectedRoute(pathname)) {
    // Not a protected route, allow access
    return NextResponse.next();
  }

  // Check if user is authenticated
  const authenticated = isAuthenticatedRequest(request);

  if (authenticated) {
    // User is authenticated, allow access
    return NextResponse.next();
  }

  // User is not authenticated
  if (isApiRoute(pathname)) {
    // For API routes, return 401 JSON response
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    );
  }

  // For page routes, redirect to login
  const loginUrl = new URL('/login', request.url);
  loginUrl.searchParams.set('redirect', pathname);
  return NextResponse.redirect(loginUrl);
}

// Middleware configuration
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files
     *
     * Protected routes are:
     * - /calls and /calls/*
     * - /api/calls and /api/calls/*
     *
     * NOT protected (use Twilio signature validation instead):
     * - /api/twilio/*
     * - /api/voice/*
     * - /api/stats
     * - /api/health
     * - /api/auth/*
     */
    '/calls/:path*',
    '/api/calls/:path*',
  ],
};
