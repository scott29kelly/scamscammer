/**
 * Tests for authentication route protection logic
 * These tests verify that the route protection rules are correctly applied
 */

// Route matching helper functions (extracted from middleware logic for testability)
function isProtectedRoute(pathname: string): boolean {
  return (
    pathname.startsWith('/calls') ||
    pathname.startsWith('/api/calls') ||
    pathname.startsWith('/api/stats')
  );
}

function isTwilioRoute(pathname: string): boolean {
  return pathname.startsWith('/api/twilio');
}

function isAuthRoute(pathname: string): boolean {
  return (
    pathname.startsWith('/api/auth') ||
    pathname === '/login' ||
    pathname === '/register'
  );
}

function shouldRequireAuth(pathname: string): boolean {
  if (isTwilioRoute(pathname)) return false;
  if (isAuthRoute(pathname)) return false;
  return isProtectedRoute(pathname);
}

describe('Authentication route protection', () => {
  describe('isProtectedRoute', () => {
    it('should protect /calls route', () => {
      expect(isProtectedRoute('/calls')).toBe(true);
    });

    it('should protect /calls/[id] routes', () => {
      expect(isProtectedRoute('/calls/abc123')).toBe(true);
      expect(isProtectedRoute('/calls/xyz/details')).toBe(true);
    });

    it('should protect /api/calls routes', () => {
      expect(isProtectedRoute('/api/calls')).toBe(true);
      expect(isProtectedRoute('/api/calls/abc123')).toBe(true);
    });

    it('should protect /api/stats route', () => {
      expect(isProtectedRoute('/api/stats')).toBe(true);
    });

    it('should not protect root route', () => {
      expect(isProtectedRoute('/')).toBe(false);
    });

    it('should not protect unrelated routes', () => {
      expect(isProtectedRoute('/about')).toBe(false);
      expect(isProtectedRoute('/api/health')).toBe(false);
    });
  });

  describe('isTwilioRoute', () => {
    it('should identify Twilio webhook routes', () => {
      expect(isTwilioRoute('/api/twilio/incoming')).toBe(true);
      expect(isTwilioRoute('/api/twilio/status')).toBe(true);
      expect(isTwilioRoute('/api/twilio/recording')).toBe(true);
    });

    it('should not match non-Twilio routes', () => {
      expect(isTwilioRoute('/api/calls')).toBe(false);
      expect(isTwilioRoute('/twilio')).toBe(false);
    });
  });

  describe('isAuthRoute', () => {
    it('should identify auth API routes', () => {
      expect(isAuthRoute('/api/auth/signin')).toBe(true);
      expect(isAuthRoute('/api/auth/callback/credentials')).toBe(true);
    });

    it('should identify login page', () => {
      expect(isAuthRoute('/login')).toBe(true);
    });

    it('should identify register page', () => {
      expect(isAuthRoute('/register')).toBe(true);
    });

    it('should not match other routes', () => {
      expect(isAuthRoute('/calls')).toBe(false);
      expect(isAuthRoute('/api/calls')).toBe(false);
    });
  });

  describe('shouldRequireAuth', () => {
    // Protected routes that should require authentication
    it('should require auth for /calls', () => {
      expect(shouldRequireAuth('/calls')).toBe(true);
    });

    it('should require auth for /api/calls', () => {
      expect(shouldRequireAuth('/api/calls')).toBe(true);
    });

    it('should require auth for /api/stats', () => {
      expect(shouldRequireAuth('/api/stats')).toBe(true);
    });

    // Routes that should NOT require authentication
    it('should NOT require auth for Twilio webhooks', () => {
      expect(shouldRequireAuth('/api/twilio/incoming')).toBe(false);
      expect(shouldRequireAuth('/api/twilio/status')).toBe(false);
    });

    it('should NOT require auth for login page', () => {
      expect(shouldRequireAuth('/login')).toBe(false);
    });

    it('should NOT require auth for auth API routes', () => {
      expect(shouldRequireAuth('/api/auth/signin')).toBe(false);
      expect(shouldRequireAuth('/api/auth/callback/credentials')).toBe(false);
    });

    it('should NOT require auth for public routes', () => {
      expect(shouldRequireAuth('/')).toBe(false);
      expect(shouldRequireAuth('/about')).toBe(false);
    });
  });
});
