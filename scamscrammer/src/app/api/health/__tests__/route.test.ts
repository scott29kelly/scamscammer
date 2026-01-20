/**
 * Tests for Health Check API endpoint
 */

import { GET } from '../route';
import prisma from '@/lib/db';

// Mock the Prisma client
jest.mock('@/lib/db', () => ({
  __esModule: true,
  default: {
    $queryRaw: jest.fn(),
  },
}));

// Mock the logger
jest.mock('@/lib/logger', () => ({
  logger: {
    error: jest.fn(),
    forRequest: jest.fn(() => ({
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    })),
  },
}));

describe('GET /api/health', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset environment variables before each test
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('should return healthy status when all services are configured and database is connected', async () => {
    // Set up environment variables
    process.env.TWILIO_ACCOUNT_SID = 'AC123';
    process.env.TWILIO_AUTH_TOKEN = 'token123';
    process.env.TWILIO_PHONE_NUMBER = '+1234567890';
    process.env.OPENAI_API_KEY = 'sk-test';
    process.env.AWS_S3_BUCKET = 'my-bucket';
    process.env.AWS_REGION = 'us-east-1';
    process.env.AWS_ACCESS_KEY_ID = 'AKIATEST';
    process.env.AWS_SECRET_ACCESS_KEY = 'secret123';

    // Mock successful database query
    (prisma.$queryRaw as jest.Mock).mockResolvedValue([{ '?column?': 1 }]);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe('healthy');
    expect(data.services.database.status).toBe('healthy');
    expect(data.services.database.latency).toBeDefined();
    expect(data.services.twilio.status).toBe('healthy');
    expect(data.services.openai.status).toBe('healthy');
    expect(data.services.storage.status).toBe('healthy');
    expect(data.timestamp).toBeDefined();
    expect(data.version).toBeDefined();
    expect(data.uptime).toBeGreaterThanOrEqual(0);
  });

  it('should return unhealthy status when database connection fails', async () => {
    // Set up all other services
    process.env.TWILIO_ACCOUNT_SID = 'AC123';
    process.env.TWILIO_AUTH_TOKEN = 'token123';
    process.env.TWILIO_PHONE_NUMBER = '+1234567890';
    process.env.OPENAI_API_KEY = 'sk-test';
    process.env.AWS_S3_BUCKET = 'my-bucket';
    process.env.AWS_REGION = 'us-east-1';
    process.env.AWS_ACCESS_KEY_ID = 'AKIATEST';
    process.env.AWS_SECRET_ACCESS_KEY = 'secret123';

    // Mock database connection failure
    (prisma.$queryRaw as jest.Mock).mockRejectedValue(new Error('Connection refused'));

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(503);
    expect(data.status).toBe('unhealthy');
    expect(data.services.database.status).toBe('unhealthy');
    expect(data.services.database.message).toBe('Database connection failed');
  });

  it('should return degraded status when Twilio is not fully configured', async () => {
    // Set up partial Twilio config (missing phone number)
    process.env.TWILIO_ACCOUNT_SID = 'AC123';
    process.env.TWILIO_AUTH_TOKEN = 'token123';
    delete process.env.TWILIO_PHONE_NUMBER;
    process.env.OPENAI_API_KEY = 'sk-test';
    process.env.AWS_S3_BUCKET = 'my-bucket';
    process.env.AWS_REGION = 'us-east-1';
    process.env.AWS_ACCESS_KEY_ID = 'AKIATEST';
    process.env.AWS_SECRET_ACCESS_KEY = 'secret123';

    // Mock successful database query
    (prisma.$queryRaw as jest.Mock).mockResolvedValue([{ '?column?': 1 }]);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe('degraded');
    expect(data.services.twilio.status).toBe('degraded');
    expect(data.services.twilio.message).toBe('Twilio phone number not configured');
  });

  it('should return degraded status when OpenAI key is missing', async () => {
    process.env.TWILIO_ACCOUNT_SID = 'AC123';
    process.env.TWILIO_AUTH_TOKEN = 'token123';
    process.env.TWILIO_PHONE_NUMBER = '+1234567890';
    delete process.env.OPENAI_API_KEY;
    process.env.AWS_S3_BUCKET = 'my-bucket';
    process.env.AWS_REGION = 'us-east-1';
    process.env.AWS_ACCESS_KEY_ID = 'AKIATEST';
    process.env.AWS_SECRET_ACCESS_KEY = 'secret123';

    (prisma.$queryRaw as jest.Mock).mockResolvedValue([{ '?column?': 1 }]);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe('degraded');
    expect(data.services.openai.status).toBe('unhealthy');
    expect(data.services.openai.message).toBe('OpenAI API key not configured');
  });

  it('should return degraded status when storage is not configured', async () => {
    process.env.TWILIO_ACCOUNT_SID = 'AC123';
    process.env.TWILIO_AUTH_TOKEN = 'token123';
    process.env.TWILIO_PHONE_NUMBER = '+1234567890';
    process.env.OPENAI_API_KEY = 'sk-test';
    delete process.env.AWS_S3_BUCKET;
    delete process.env.AWS_REGION;

    (prisma.$queryRaw as jest.Mock).mockResolvedValue([{ '?column?': 1 }]);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe('degraded');
    expect(data.services.storage.status).toBe('degraded');
    expect(data.services.storage.message).toBe('S3 bucket or region not configured');
  });

  it('should return degraded when AWS credentials are missing', async () => {
    process.env.TWILIO_ACCOUNT_SID = 'AC123';
    process.env.TWILIO_AUTH_TOKEN = 'token123';
    process.env.TWILIO_PHONE_NUMBER = '+1234567890';
    process.env.OPENAI_API_KEY = 'sk-test';
    process.env.AWS_S3_BUCKET = 'my-bucket';
    process.env.AWS_REGION = 'us-east-1';
    delete process.env.AWS_ACCESS_KEY_ID;
    delete process.env.AWS_SECRET_ACCESS_KEY;

    (prisma.$queryRaw as jest.Mock).mockResolvedValue([{ '?column?': 1 }]);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe('degraded');
    expect(data.services.storage.status).toBe('degraded');
    expect(data.services.storage.message).toBe('AWS credentials not configured');
  });

  it('should return degraded when Twilio credentials are completely missing', async () => {
    delete process.env.TWILIO_ACCOUNT_SID;
    delete process.env.TWILIO_AUTH_TOKEN;
    process.env.OPENAI_API_KEY = 'sk-test';
    process.env.AWS_S3_BUCKET = 'my-bucket';
    process.env.AWS_REGION = 'us-east-1';
    process.env.AWS_ACCESS_KEY_ID = 'AKIATEST';
    process.env.AWS_SECRET_ACCESS_KEY = 'secret123';

    (prisma.$queryRaw as jest.Mock).mockResolvedValue([{ '?column?': 1 }]);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe('degraded');
    expect(data.services.twilio.status).toBe('unhealthy');
    expect(data.services.twilio.message).toBe('Twilio credentials not configured');
  });

  it('should include database latency on success', async () => {
    process.env.TWILIO_ACCOUNT_SID = 'AC123';
    process.env.TWILIO_AUTH_TOKEN = 'token123';
    process.env.TWILIO_PHONE_NUMBER = '+1234567890';
    process.env.OPENAI_API_KEY = 'sk-test';
    process.env.AWS_S3_BUCKET = 'my-bucket';
    process.env.AWS_REGION = 'us-east-1';
    process.env.AWS_ACCESS_KEY_ID = 'AKIATEST';
    process.env.AWS_SECRET_ACCESS_KEY = 'secret123';

    (prisma.$queryRaw as jest.Mock).mockResolvedValue([{ '?column?': 1 }]);

    const response = await GET();
    const data = await response.json();

    expect(data.services.database.latency).toBeDefined();
    expect(typeof data.services.database.latency).toBe('number');
    expect(data.services.database.latency).toBeGreaterThanOrEqual(0);
  });

  it('should include database latency even on failure', async () => {
    process.env.TWILIO_ACCOUNT_SID = 'AC123';
    process.env.TWILIO_AUTH_TOKEN = 'token123';
    process.env.TWILIO_PHONE_NUMBER = '+1234567890';
    process.env.OPENAI_API_KEY = 'sk-test';
    process.env.AWS_S3_BUCKET = 'my-bucket';
    process.env.AWS_REGION = 'us-east-1';
    process.env.AWS_ACCESS_KEY_ID = 'AKIATEST';
    process.env.AWS_SECRET_ACCESS_KEY = 'secret123';

    (prisma.$queryRaw as jest.Mock).mockRejectedValue(new Error('Timeout'));

    const response = await GET();
    const data = await response.json();

    expect(data.services.database.latency).toBeDefined();
    expect(typeof data.services.database.latency).toBe('number');
  });
});
