/**
 * Stats API Endpoint Tests
 */

// Define CallStatus enum locally since Prisma client might not be generated
const CallStatus = {
  RINGING: 'RINGING',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  NO_ANSWER: 'NO_ANSWER'
} as const;

type CallStatusType = typeof CallStatus[keyof typeof CallStatus];

// Mock the Prisma client BEFORE imports
const mockPrismaClient = {
  call: {
    count: jest.fn(),
    aggregate: jest.fn(),
    groupBy: jest.fn(),
    findMany: jest.fn(),
  },
  $queryRaw: jest.fn(),
};

jest.mock('../../../../lib/db', () => ({
  __esModule: true,
  default: mockPrismaClient,
}));

import { GET } from '../route';

const mockPrisma = mockPrismaClient;

describe('GET /api/stats', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return dashboard statistics', async () => {
    // Mock data
    const mockCalls = [
      {
        id: 'call-1',
        twilioSid: 'CA123',
        fromNumber: '+15551234567',
        toNumber: '+15559876543',
        status: CallStatus.COMPLETED,
        duration: 300,
        recordingUrl: 'https://example.com/recording1.mp3',
        transcriptUrl: null,
        rating: 5,
        notes: 'Great call',
        tags: ['funny'],
        createdAt: new Date('2026-01-15T10:00:00Z'),
        updatedAt: new Date('2026-01-15T10:05:00Z'),
        _count: { segments: 10 },
      },
      {
        id: 'call-2',
        twilioSid: 'CA456',
        fromNumber: '+15551234568',
        toNumber: '+15559876543',
        status: CallStatus.COMPLETED,
        duration: 600,
        recordingUrl: 'https://example.com/recording2.mp3',
        transcriptUrl: null,
        rating: 4,
        notes: null,
        tags: [],
        createdAt: new Date('2026-01-14T10:00:00Z'),
        updatedAt: new Date('2026-01-14T10:10:00Z'),
        _count: { segments: 20 },
      },
    ];

    // Setup mocks
    (mockPrisma.call.count as jest.Mock).mockResolvedValue(10);
    (mockPrisma.call.aggregate as jest.Mock).mockResolvedValue({
      _sum: { duration: 3600 },
      _avg: { duration: 360 },
    });
    (mockPrisma.call.groupBy as jest.Mock).mockResolvedValue([
      { status: CallStatus.COMPLETED, _count: { _all: 8 } },
      { status: CallStatus.FAILED, _count: { _all: 2 } },
    ]);
    (mockPrisma.$queryRaw as jest.Mock).mockResolvedValue([
      { date: new Date('2026-01-15'), count: BigInt(3) },
      { date: new Date('2026-01-14'), count: BigInt(2) },
    ]);
    (mockPrisma.call.findMany as jest.Mock)
      .mockResolvedValueOnce(mockCalls) // topRatedCalls
      .mockResolvedValueOnce(mockCalls); // longestCalls

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveProperty('totalCalls', 10);
    expect(data).toHaveProperty('totalDuration', 3600);
    expect(data).toHaveProperty('averageDuration', 360);
    expect(data).toHaveProperty('callsByStatus');
    expect(data.callsByStatus[CallStatus.COMPLETED]).toBe(8);
    expect(data.callsByStatus[CallStatus.FAILED]).toBe(2);
    expect(data.callsByStatus[CallStatus.RINGING]).toBe(0);
    expect(data).toHaveProperty('callsByDay');
    expect(Array.isArray(data.callsByDay)).toBe(true);
    expect(data.callsByDay.length).toBe(30);
    expect(data).toHaveProperty('topRatedCalls');
    expect(data.topRatedCalls.length).toBe(2);
    expect(data).toHaveProperty('longestCalls');
    expect(data.longestCalls.length).toBe(2);
  });

  it('should handle empty database gracefully', async () => {
    (mockPrisma.call.count as jest.Mock).mockResolvedValue(0);
    (mockPrisma.call.aggregate as jest.Mock).mockResolvedValue({
      _sum: { duration: null },
      _avg: { duration: null },
    });
    (mockPrisma.call.groupBy as jest.Mock).mockResolvedValue([]);
    (mockPrisma.$queryRaw as jest.Mock).mockResolvedValue([]);
    (mockPrisma.call.findMany as jest.Mock)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.totalCalls).toBe(0);
    expect(data.totalDuration).toBe(0);
    expect(data.averageDuration).toBe(0);
    expect(data.topRatedCalls).toEqual([]);
    expect(data.longestCalls).toEqual([]);
    // All statuses should be 0
    for (const status of Object.values(CallStatus)) {
      expect(data.callsByStatus[status]).toBe(0);
    }
  });

  it('should return 500 on database error', async () => {
    (mockPrisma.call.count as jest.Mock).mockRejectedValue(new Error('Database connection failed'));

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toHaveProperty('error', 'Failed to fetch statistics');
  });

  it('should fill missing days with zero counts', async () => {
    (mockPrisma.call.count as jest.Mock).mockResolvedValue(1);
    (mockPrisma.call.aggregate as jest.Mock).mockResolvedValue({
      _sum: { duration: 100 },
      _avg: { duration: 100 },
    });
    (mockPrisma.call.groupBy as jest.Mock).mockResolvedValue([
      { status: CallStatus.COMPLETED, _count: { _all: 1 } },
    ]);
    // Only one day has calls
    (mockPrisma.$queryRaw as jest.Mock).mockResolvedValue([
      { date: new Date(), count: BigInt(1) },
    ]);
    (mockPrisma.call.findMany as jest.Mock)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.callsByDay.length).toBe(30);
    // Most days should have 0 count
    const zeroDays = data.callsByDay.filter((d: { count: number }) => d.count === 0);
    expect(zeroDays.length).toBeGreaterThanOrEqual(29);
  });
});
