/**
 * Twilio Integration Module Tests
 */

import { createHmac } from 'crypto';
import {
  validateTwilioSignature,
  getTwilioAuthToken,
  getWebhookBaseUrl,
} from '../twilio';

describe('validateTwilioSignature', () => {
  const authToken = 'test-auth-token';
  const url = 'https://example.com/api/twilio/status';
  const params = {
    CallSid: 'CA123456',
    CallStatus: 'in-progress',
    From: '+15551234567',
  };

  // Generate a valid signature for testing
  function generateValidSignature(
    token: string,
    requestUrl: string,
    requestParams: Record<string, string>
  ): string {
    let data = requestUrl;
    const sortedKeys = Object.keys(requestParams).sort();
    for (const key of sortedKeys) {
      data += key + requestParams[key];
    }
    return createHmac('sha1', token).update(data, 'utf8').digest('base64');
  }

  it('should return true for a valid signature', () => {
    const validSignature = generateValidSignature(authToken, url, params);
    const result = validateTwilioSignature(authToken, validSignature, url, params);
    expect(result).toBe(true);
  });

  it('should return false for an invalid signature', () => {
    const invalidSignature = 'invalid-signature-value';
    const result = validateTwilioSignature(authToken, invalidSignature, url, params);
    expect(result).toBe(false);
  });

  it('should return false when auth token is empty', () => {
    const validSignature = generateValidSignature(authToken, url, params);
    const result = validateTwilioSignature('', validSignature, url, params);
    expect(result).toBe(false);
  });

  it('should return false when signature is empty', () => {
    const result = validateTwilioSignature(authToken, '', url, params);
    expect(result).toBe(false);
  });

  it('should return false when URL is empty', () => {
    const validSignature = generateValidSignature(authToken, url, params);
    const result = validateTwilioSignature(authToken, validSignature, '', params);
    expect(result).toBe(false);
  });

  it('should handle empty params', () => {
    const emptyParams = {};
    const validSignature = generateValidSignature(authToken, url, emptyParams);
    const result = validateTwilioSignature(authToken, validSignature, url, emptyParams);
    expect(result).toBe(true);
  });

  it('should sort params alphabetically', () => {
    // Params in non-alphabetical order
    const unorderedParams = {
      Zebra: 'value3',
      Apple: 'value1',
      Mango: 'value2',
    };
    const validSignature = generateValidSignature(authToken, url, unorderedParams);
    const result = validateTwilioSignature(authToken, validSignature, url, unorderedParams);
    expect(result).toBe(true);
  });

  it('should return false when signature has different length', () => {
    const shortSignature = 'abc';
    const result = validateTwilioSignature(authToken, shortSignature, url, params);
    expect(result).toBe(false);
  });
});

describe('getTwilioAuthToken', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should return the auth token when set', () => {
    process.env.TWILIO_AUTH_TOKEN = 'my-secret-token';
    const token = getTwilioAuthToken();
    expect(token).toBe('my-secret-token');
  });

  it('should throw an error when auth token is not set', () => {
    delete process.env.TWILIO_AUTH_TOKEN;
    expect(() => getTwilioAuthToken()).toThrow(
      'TWILIO_AUTH_TOKEN environment variable is not set'
    );
  });
});

describe('getWebhookBaseUrl', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should return WEBHOOK_BASE_URL when set', () => {
    process.env.WEBHOOK_BASE_URL = 'https://my-app.com';
    const url = getWebhookBaseUrl();
    expect(url).toBe('https://my-app.com');
  });

  it('should return VERCEL_URL when WEBHOOK_BASE_URL is not set', () => {
    delete process.env.WEBHOOK_BASE_URL;
    process.env.VERCEL_URL = 'my-app.vercel.app';
    const url = getWebhookBaseUrl();
    expect(url).toBe('https://my-app.vercel.app');
  });

  it('should add https:// prefix when URL does not have protocol', () => {
    process.env.WEBHOOK_BASE_URL = 'my-domain.com';
    const url = getWebhookBaseUrl();
    expect(url).toBe('https://my-domain.com');
  });

  it('should not add prefix when URL starts with http://', () => {
    process.env.WEBHOOK_BASE_URL = 'http://localhost:3000';
    const url = getWebhookBaseUrl();
    expect(url).toBe('http://localhost:3000');
  });

  it('should not add prefix when URL starts with https://', () => {
    process.env.WEBHOOK_BASE_URL = 'https://my-app.com';
    const url = getWebhookBaseUrl();
    expect(url).toBe('https://my-app.com');
  });

  it('should throw an error when neither URL is set', () => {
    delete process.env.WEBHOOK_BASE_URL;
    delete process.env.VERCEL_URL;
    expect(() => getWebhookBaseUrl()).toThrow(
      'WEBHOOK_BASE_URL or VERCEL_URL environment variable is not set'
    );
  });
});
