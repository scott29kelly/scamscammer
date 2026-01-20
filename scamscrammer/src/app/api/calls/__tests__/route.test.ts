/**
 * Calls API Endpoint Tests
 */

import { GET } from '../route';
import prisma from '@/lib/db';
import { CallStatus } from '@prisma/client';
import { NextRequest } from 'next/server';

// Mock the Prisma client
jest.mock('@/lib/db', () => ({
  __esModule: true,
  default: {
    call: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
  },
}));

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

function createRequest(url: string): NextRequest {
  return new NextRequest(new URL(url, 'http://localhost:3000'));
}

describe('GET /api/calls', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

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
      tags: ['funny', 'long'],
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

  it('should return paginated list of calls', async () => {
    (mockPrisma.call.count as jest.Mock).mockResolvedValue(2);
    (mockPrisma.call.findMany as jest.Mock).mockResolvedValue(mockCalls);

    const response = await GET(createRequest('/api/calls'));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.calls).toHaveLength(2);
    expect(data.pagination).toEqual({
      total: 2,
      page: 1,
      limit: 20,
      totalPages: 1,
      hasNext: false,
      hasPrev: false,
    });
  });

  it('should handle custom pagination parameters', async () => {
    (mockPrisma.call.count as jest.Mock).mockResolvedValue(50);
    (mockPrisma.call.findMany as jest.Mock).mockResolvedValue(mockCalls.slice(0, 1));

    const response = await GET(createRequest('/api/calls?page=2&limit=10'));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.pagination).toEqual({
      total: 50,
      page: 2,
      limit: 10,
      totalPages: 5,
      hasNext: true,
      hasPrev: true,
    });

    // Verify skip is calculated correctly
    expect(mockPrisma.call.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 10,
        take: 10,
      })
    );
  });

  it('should filter by status', async () => {
    (mockPrisma.call.count as jest.Mock).mockResolvedValue(1);
    (mockPrisma.call.findMany as jest.Mock).mockResolvedValue([mockCalls[0]]);

    const response = await GET(createRequest('/api/calls?status=COMPLETED'));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(mockPrisma.call.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: CallStatus.COMPLETED,
        }),
      })
    );
    expect(data.calls).toHaveLength(1);
  });

  it('should filter by search term', async () => {
    (mockPrisma.call.count as jest.Mock).mockResolvedValue(1);
    (mockPrisma.call.findMany as jest.Mock).mockResolvedValue([mockCalls[0]]);

    const response = await GET(createRequest('/api/calls?search=5551234567'));
    await response.json();

    expect(mockPrisma.call.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [
            { fromNumber: { contains: '5551234567', mode: 'insensitive' } },
            { toNumber: { contains: '5551234567', mode: 'insensitive' } },
            { notes: { contains: '5551234567', mode: 'insensitive' } },
          ],
        }),
      })
    );
  });

  it('should filter by minimum rating', async () => {
    (mockPrisma.call.count as jest.Mock).mockResolvedValue(1);
    (mockPrisma.call.findMany as jest.Mock).mockResolvedValue([mockCalls[0]]);

    const response = await GET(createRequest('/api/calls?minRating=4'));
    await response.json();

    expect(mockPrisma.call.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          rating: { gte: 4 },
        }),
      })
    );
  });

  it('should filter by tag', async () => {
    (mockPrisma.call.count as jest.Mock).mockResolvedValue(1);
    (mockPrisma.call.findMany as jest.Mock).mockResolvedValue([mockCalls[0]]);

    const response = await GET(createRequest('/api/calls?tag=funny'));
    await response.json();

    expect(mockPrisma.call.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tags: { has: 'funny' },
        }),
      })
    );
  });

  it('should sort by specified field and order', async () => {
    (mockPrisma.call.count as jest.Mock).mockResolvedValue(2);
    (mockPrisma.call.findMany as jest.Mock).mockResolvedValue(mockCalls);

    const response = await GET(createRequest('/api/calls?sortBy=duration&sortOrder=asc'));
    await response.json();

    expect(mockPrisma.call.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { duration: 'asc' },
      })
    );
  });

  it('should use default sort (createdAt desc) when not specified', async () => {
    (mockPrisma.call.count as jest.Mock).mockResolvedValue(2);
    (mockPrisma.call.findMany as jest.Mock).mockResolvedValue(mockCalls);

    await GET(createRequest('/api/calls'));

    expect(mockPrisma.call.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { createdAt: 'desc' },
      })
    );
  });

  it('should handle empty database gracefully', async () => {
    (mockPrisma.call.count as jest.Mock).mockResolvedValue(0);
    (mockPrisma.call.findMany as jest.Mock).mockResolvedValue([]);

    const response = await GET(createRequest('/api/calls'));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.calls).toEqual([]);
    expect(data.pagination).toEqual({
      total: 0,
      page: 1,
      limit: 20,
      totalPages: 0,
      hasNext: false,
      hasPrev: false,
    });
  });

  it('should return 500 on database error', async () => {
    (mockPrisma.call.count as jest.Mock).mockRejectedValue(
      new Error('Database connection failed')
    );

    const response = await GET(createRequest('/api/calls'));
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toHaveProperty('error', 'Failed to fetch calls');
  });

  it('should ignore invalid status filter', async () => {
    (mockPrisma.call.count as jest.Mock).mockResolvedValue(2);
    (mockPrisma.call.findMany as jest.Mock).mockResolvedValue(mockCalls);

    const response = await GET(createRequest('/api/calls?status=INVALID_STATUS'));
    const data = await response.json();

    expect(response.status).toBe(200);
    // Should not include status in where clause
    expect(mockPrisma.call.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {},
      })
    );
    expect(data.calls).toHaveLength(2);
  });

  it('should enforce maximum limit of 100', async () => {
    (mockPrisma.call.count as jest.Mock).mockResolvedValue(200);
    (mockPrisma.call.findMany as jest.Mock).mockResolvedValue(mockCalls);

    const response = await GET(createRequest('/api/calls?limit=500'));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.pagination.limit).toBe(100);
    expect(mockPrisma.call.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 100,
      })
    );
  });

  it('should ignore invalid rating filter', async () => {
    (mockPrisma.call.count as jest.Mock).mockResolvedValue(2);
    (mockPrisma.call.findMany as jest.Mock).mockResolvedValue(mockCalls);

    const response = await GET(createRequest('/api/calls?minRating=10'));
    const data = await response.json();

    expect(response.status).toBe(200);
    // Should not include rating in where clause since 10 > 5
    expect(mockPrisma.call.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {},
      })
    );
    expect(data.calls).toHaveLength(2);
  });
});
