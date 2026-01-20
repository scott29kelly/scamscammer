import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export default auth((req) => {
  const { pathname } = req.nextUrl;

  // Check if the route requires authentication
  const isProtectedRoute =
    pathname.startsWith('/calls') ||
    pathname.startsWith('/api/calls') ||
    pathname.startsWith('/api/stats');

  // Twilio webhook routes should NOT be protected (they use signature validation)
  const isTwilioRoute = pathname.startsWith('/api/twilio');

  // Auth routes should not be protected
  const isAuthRoute =
    pathname.startsWith('/api/auth') ||
    pathname === '/login' ||
    pathname === '/register';

  // Allow public routes
  if (isTwilioRoute || isAuthRoute || !isProtectedRoute) {
    return NextResponse.next();
  }

  // Check authentication for protected routes
  if (!req.auth) {
    // For API routes, return 401
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // For page routes, redirect to login
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    // Match all routes except static files and Next.js internals
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
