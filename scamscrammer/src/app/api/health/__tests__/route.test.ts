/**
 * Tests for the Health Check API endpoint
 */

import { GET } from '../route';

// Mock the prisma client
jest.mock('@/lib/db', () => ({
  prisma: {
    $queryRaw: jest.fn(),
  },
}));

import { prisma } from '@/lib/db';

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

describe('GET /api/health', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return healthy status when database is connected', async () => {
    // Mock successful database query
    (mockPrisma.$queryRaw as jest.Mock).mockResolvedValue([{ '?column?': 1 }]);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe('healthy');
    expect(data.services.database.status).toBe('up');
    expect(data.services.app.status).toBe('up');
    expect(typeof data.services.database.latency).toBe('number');
    expect(data.timestamp).toBeDefined();
    expect(data.uptime).toBeGreaterThanOrEqual(0);
  });

  it('should return unhealthy status when database is disconnected', async () => {
    // Mock database connection failure
    (mockPrisma.$queryRaw as jest.Mock).mockRejectedValue(
      new Error('Connection refused')
    );

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(503);
    expect(data.status).toBe('unhealthy');
    expect(data.services.database.status).toBe('down');
    expect(data.services.database.error).toBe('Connection refused');
    expect(data.services.app.status).toBe('up');
  });

  it('should include version information', async () => {
    (mockPrisma.$queryRaw as jest.Mock).mockResolvedValue([{ '?column?': 1 }]);

    const response = await GET();
    const data = await response.json();

    expect(data.version).toBeDefined();
    expect(typeof data.version).toBe('string');
  });

  it('should include timestamp in ISO format', async () => {
    (mockPrisma.$queryRaw as jest.Mock).mockResolvedValue([{ '?column?': 1 }]);

    const response = await GET();
    const data = await response.json();

    expect(data.timestamp).toBeDefined();
    // Verify it's a valid ISO date string
    const date = new Date(data.timestamp);
    expect(date.toISOString()).toBe(data.timestamp);
  });

  it('should handle unknown errors gracefully', async () => {
    // Mock with non-Error object
    (mockPrisma.$queryRaw as jest.Mock).mockRejectedValue('Unknown error');

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(503);
    expect(data.status).toBe('unhealthy');
    expect(data.services.database.status).toBe('down');
    expect(data.services.database.error).toBe('Unknown database error');
  });
});
