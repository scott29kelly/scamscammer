/**
 * Jest setup file
 * Runs before all tests
 */

// Set up test environment variables
process.env.TWILIO_ACCOUNT_SID = 'ACtest1234567890';
process.env.TWILIO_AUTH_TOKEN = 'test_auth_token_12345';
process.env.TWILIO_PHONE_NUMBER = '+15551234567';
process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';

// Silence console during tests unless explicitly needed
if (process.env.DEBUG_TESTS !== 'true') {
  global.console = {
    ...console,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
}
