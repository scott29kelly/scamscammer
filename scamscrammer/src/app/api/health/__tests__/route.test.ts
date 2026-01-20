/**
 * Tests for the Health Check API endpoint
 */

// Define mock functions before jest.mock calls
const mockQueryRaw = jest.fn();
const mockGetMemoryUsage = jest.fn().mockReturnValue({
  heapUsed: 50 * 1024 * 1024,
  heapTotal: 100 * 1024 * 1024,
  external: 10 * 1024 * 1024,
  rss: 150 * 1024 * 1024,
});
const mockGetRequestsPerMinute = jest.fn().mockReturnValue(10);
const mockGetErrorRate = jest.fn().mockReturnValue(0.05);
const mockGetUptime = jest.fn().mockReturnValue(3600);

// Mock modules using aliased paths (as used in the source file)
jest.mock('@/lib/db', () => ({
  __esModule: true,
  default: {
    $queryRaw: mockQueryRaw,
  },
}));

jest.mock('@/lib/logger', () => ({
  __esModule: true,
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
  generateRequestId: jest.fn().mockReturnValue('test-request-id'),
  setRequestContext: jest.fn(),
  clearRequestContext: jest.fn(),
}));

jest.mock('@/lib/monitoring', () => ({
  __esModule: true,
  monitoring: {
    getMemoryUsage: mockGetMemoryUsage,
    getRequestsPerMinute: mockGetRequestsPerMinute,
    getErrorRate: mockGetErrorRate,
    getUptime: mockGetUptime,
  },
}));

// Import after mocks are set up
import { GET } from '../route';

describe('GET /api/health', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset mock implementations
    mockQueryRaw.mockReset();
    mockGetMemoryUsage.mockReturnValue({
      heapUsed: 50 * 1024 * 1024,
      heapTotal: 100 * 1024 * 1024,
      external: 10 * 1024 * 1024,
      rss: 150 * 1024 * 1024,
    });
    mockGetRequestsPerMinute.mockReturnValue(10);
    mockGetErrorRate.mockReturnValue(0.05);
    mockGetUptime.mockReturnValue(3600);
  });

  it('should return healthy status when database is connected', async () => {
    // Mock successful database query
    mockQueryRaw.mockResolvedValue([{ 1: 1 }]);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe('healthy');
    expect(data.services).toHaveLength(1);
    expect(data.services[0].name).toBe('database');
    expect(data.services[0].status).toBe('healthy');
    expect(data.services[0].latency).toBeDefined();
  });

  it('should return degraded status when database is slow', async () => {
    // Mock slow database query (simulate by delaying)
    mockQueryRaw.mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 1100));
      return [{ 1: 1 }];
    });

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200); // Still 200 for degraded
    expect(data.status).toBe('degraded');
    expect(data.services[0].status).toBe('degraded');
  });

  it('should return unhealthy status when database is down', async () => {
    // Mock database connection failure
    mockQueryRaw.mockRejectedValue(new Error('Connection refused'));

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(503);
    expect(data.status).toBe('unhealthy');
    expect(data.services).toHaveLength(1);
    expect(data.services[0].name).toBe('database');
    expect(data.services[0].status).toBe('unhealthy');
    expect(data.services[0].error).toBe('Connection refused');
  });

  it('should include system metrics', async () => {
    mockQueryRaw.mockResolvedValue([{ 1: 1 }]);

    const response = await GET();
    const data = await response.json();

    expect(data.metrics).toBeDefined();
    expect(data.metrics.uptime).toBe(3600);
    expect(data.metrics.memoryUsage).toEqual({
      heapUsed: 50,
      heapTotal: 100,
      external: 10,
      rss: 150,
    });
    expect(data.metrics.requestsPerMinute).toBe(10);
    expect(data.metrics.errorRate).toBe(5); // 0.05 * 100 = 5%
  });

  it('should include timestamp and version', async () => {
    mockQueryRaw.mockResolvedValue([{ 1: 1 }]);

    const response = await GET();
    const data = await response.json();

    expect(data.timestamp).toBeDefined();
    expect(new Date(data.timestamp)).toBeInstanceOf(Date);
    expect(data.version).toBeDefined();
  });

  it('should handle unexpected errors gracefully', async () => {
    // Mock an unexpected error scenario
    mockQueryRaw.mockImplementation(() => {
      throw new Error('Unexpected error');
    });

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(503);
    expect(data.status).toBe('unhealthy');
  });
});
