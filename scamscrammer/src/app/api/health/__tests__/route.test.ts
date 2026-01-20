/**
 * Health Check API Endpoint Tests
 */

import { GET, HealthStatus } from '../route';
import prisma from '@/lib/db';

// Mock the Prisma client
jest.mock('@/lib/db', () => ({
  __esModule: true,
  default: {
    $queryRaw: jest.fn(),
  },
}));

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

describe('GET /api/health', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return healthy status when database is connected', async () => {
    (mockPrisma.$queryRaw as jest.Mock).mockResolvedValue([{ '?column?': 1 }]);

    const response = await GET();
    const data: HealthStatus = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe('healthy');
    expect(data.services.database.status).toBe('up');
    expect(typeof data.services.database.latency).toBe('number');
    expect(data.timestamp).toBeDefined();
    expect(data.version).toBeDefined();
  });

  it('should return unhealthy status when database is down', async () => {
    (mockPrisma.$queryRaw as jest.Mock).mockRejectedValue(new Error('Connection refused'));

    const response = await GET();
    const data: HealthStatus = await response.json();

    expect(response.status).toBe(503);
    expect(data.status).toBe('unhealthy');
    expect(data.services.database.status).toBe('down');
    expect(data.services.database.error).toBe('Connection refused');
    expect(typeof data.services.database.latency).toBe('number');
  });

  it('should include timestamp in ISO format', async () => {
    (mockPrisma.$queryRaw as jest.Mock).mockResolvedValue([{ '?column?': 1 }]);

    const response = await GET();
    const data: HealthStatus = await response.json();

    expect(data.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/);
  });

  it('should handle non-Error exceptions gracefully', async () => {
    (mockPrisma.$queryRaw as jest.Mock).mockRejectedValue('String error');

    const response = await GET();
    const data: HealthStatus = await response.json();

    expect(response.status).toBe(503);
    expect(data.status).toBe('unhealthy');
    expect(data.services.database.status).toBe('down');
    expect(data.services.database.error).toBe('Unknown database error');
  });

  it('should return version from environment or default', async () => {
    (mockPrisma.$queryRaw as jest.Mock).mockResolvedValue([{ '?column?': 1 }]);

    const response = await GET();
    const data: HealthStatus = await response.json();

    expect(data.version).toBeDefined();
    expect(typeof data.version).toBe('string');
  });
});
