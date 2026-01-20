/**
 * Tests for Authentication Module
 */

import {
  generateSessionToken,
  validatePassword,
  isValidSession,
  isProtectedRoute,
  isLoginRoute,
  isApiRoute,
} from '../auth';

describe('Authentication Module', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('validatePassword', () => {
    it('should return true for correct password', () => {
      process.env.DASHBOARD_PASSWORD = 'test-password-123';
      expect(validatePassword('test-password-123')).toBe(true);
    });

    it('should return false for incorrect password', () => {
      process.env.DASHBOARD_PASSWORD = 'test-password-123';
      expect(validatePassword('wrong-password')).toBe(false);
    });

    it('should return false when DASHBOARD_PASSWORD is not set', () => {
      delete process.env.DASHBOARD_PASSWORD;
      expect(validatePassword('any-password')).toBe(false);
    });

    it('should return false for empty password', () => {
      process.env.DASHBOARD_PASSWORD = 'test-password-123';
      expect(validatePassword('')).toBe(false);
    });
  });

  describe('generateSessionToken', () => {
    it('should generate a token string', () => {
      const token = generateSessionToken('test-password');
      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(0);
    });

    it('should generate tokens with timestamp and hash parts', () => {
      const token = generateSessionToken('test-password');
      const parts = token.split('.');
      expect(parts.length).toBe(2);
    });

    it('should generate different timestamps for different calls', async () => {
      const token1 = generateSessionToken('test-password');
      await new Promise((resolve) => setTimeout(resolve, 10));
      const token2 = generateSessionToken('test-password');

      const timestamp1 = token1.split('.')[0];
      const timestamp2 = token2.split('.')[0];

      // Timestamps should be different
      expect(timestamp1).not.toBe(timestamp2);
    });
  });

  describe('isValidSession', () => {
    it('should return false for empty token', () => {
      process.env.DASHBOARD_PASSWORD = 'test-password';
      expect(isValidSession('')).toBe(false);
    });

    it('should return false when DASHBOARD_PASSWORD is not set', () => {
      delete process.env.DASHBOARD_PASSWORD;
      const token = 'timestamp.hash';
      expect(isValidSession(token)).toBe(false);
    });

    it('should return false for malformed token', () => {
      process.env.DASHBOARD_PASSWORD = 'test-password';
      expect(isValidSession('invalid-token-no-dot')).toBe(false);
    });

    it('should return true for valid token', () => {
      process.env.DASHBOARD_PASSWORD = 'test-password';
      const token = generateSessionToken('test-password');
      expect(isValidSession(token)).toBe(true);
    });

    it('should return false for token with wrong password hash', () => {
      process.env.DASHBOARD_PASSWORD = 'correct-password';
      const token = generateSessionToken('wrong-password');
      expect(isValidSession(token)).toBe(false);
    });
  });

  describe('isProtectedRoute', () => {
    it('should return true for /calls routes', () => {
      expect(isProtectedRoute('/calls')).toBe(true);
      expect(isProtectedRoute('/calls/123')).toBe(true);
      expect(isProtectedRoute('/calls/abc/details')).toBe(true);
    });

    it('should return true for /api/calls routes', () => {
      expect(isProtectedRoute('/api/calls')).toBe(true);
      expect(isProtectedRoute('/api/calls/123')).toBe(true);
    });

    it('should return false for public routes', () => {
      expect(isProtectedRoute('/')).toBe(false);
      expect(isProtectedRoute('/login')).toBe(false);
      expect(isProtectedRoute('/api/stats')).toBe(false);
      expect(isProtectedRoute('/api/twilio/incoming')).toBe(false);
      expect(isProtectedRoute('/api/auth/login')).toBe(false);
    });
  });

  describe('isLoginRoute', () => {
    it('should return true for /login', () => {
      expect(isLoginRoute('/login')).toBe(true);
    });

    it('should return false for other routes', () => {
      expect(isLoginRoute('/')).toBe(false);
      expect(isLoginRoute('/calls')).toBe(false);
      expect(isLoginRoute('/login/callback')).toBe(false);
    });
  });

  describe('isApiRoute', () => {
    it('should return true for API routes', () => {
      expect(isApiRoute('/api/calls')).toBe(true);
      expect(isApiRoute('/api/stats')).toBe(true);
      expect(isApiRoute('/api/auth/login')).toBe(true);
    });

    it('should return false for non-API routes', () => {
      expect(isApiRoute('/')).toBe(false);
      expect(isApiRoute('/calls')).toBe(false);
      expect(isApiRoute('/login')).toBe(false);
    });
  });
});
