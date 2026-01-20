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

function createMockRequest(params: Record<string, string> = {}): NextRequest {
  const url = new URL('http://localhost:3000/api/calls');
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });
  return new NextRequest(url);
}

describe('GET /api/calls', () => {
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

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return paginated calls list', async () => {
    (mockPrisma.call.count as jest.Mock).mockResolvedValue(10);
    (mockPrisma.call.findMany as jest.Mock).mockResolvedValue(mockCalls);

    const request = createMockRequest();
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveProperty('calls');
    expect(data).toHaveProperty('pagination');
    expect(data.calls.length).toBe(2);
    expect(data.pagination.total).toBe(10);
    expect(data.pagination.page).toBe(1);
    expect(data.pagination.limit).toBe(20);
  });

  it('should handle page and limit parameters', async () => {
    (mockPrisma.call.count as jest.Mock).mockResolvedValue(50);
    (mockPrisma.call.findMany as jest.Mock).mockResolvedValue([mockCalls[0]]);

    const request = createMockRequest({ page: '2', limit: '10' });
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.pagination.page).toBe(2);
    expect(data.pagination.limit).toBe(10);
    expect(data.pagination.totalPages).toBe(5);
    expect(data.pagination.hasNext).toBe(true);
    expect(data.pagination.hasPrev).toBe(true);

    // Verify skip and take were called correctly
    expect(mockPrisma.call.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 10,
        take: 10,
      })
    );
  });

  it('should filter by status', async () => {
    (mockPrisma.call.count as jest.Mock).mockResolvedValue(5);
    (mockPrisma.call.findMany as jest.Mock).mockResolvedValue([mockCalls[0]]);

    const request = createMockRequest({ status: 'COMPLETED' });
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(mockPrisma.call.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: CallStatus.COMPLETED,
        }),
      })
    );
    expect(mockPrisma.call.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: CallStatus.COMPLETED,
        }),
      })
    );
  });

  it('should filter by date range', async () => {
    (mockPrisma.call.count as jest.Mock).mockResolvedValue(2);
    (mockPrisma.call.findMany as jest.Mock).mockResolvedValue(mockCalls);

    const request = createMockRequest({
      startDate: '2026-01-01',
      endDate: '2026-01-31',
    });
    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(mockPrisma.call.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          createdAt: expect.objectContaining({
            gte: expect.any(Date),
            lte: expect.any(Date),
          }),
        }),
      })
    );
  });

  it('should handle search parameter', async () => {
    (mockPrisma.call.count as jest.Mock).mockResolvedValue(1);
    (mockPrisma.call.findMany as jest.Mock).mockResolvedValue([mockCalls[0]]);

    const request = createMockRequest({ search: '5551234567' });
    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(mockPrisma.call.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            expect.objectContaining({
              fromNumber: { contains: '5551234567', mode: 'insensitive' },
            }),
          ]),
        }),
      })
    );
  });

  it('should handle sort parameters', async () => {
    (mockPrisma.call.count as jest.Mock).mockResolvedValue(10);
    (mockPrisma.call.findMany as jest.Mock).mockResolvedValue(mockCalls);

    const request = createMockRequest({ sortBy: 'duration', sortOrder: 'asc' });
    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(mockPrisma.call.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: {
          duration: 'asc',
        },
      })
    );
  });

  it('should default to sorting by createdAt desc', async () => {
    (mockPrisma.call.count as jest.Mock).mockResolvedValue(10);
    (mockPrisma.call.findMany as jest.Mock).mockResolvedValue(mockCalls);

    const request = createMockRequest();
    await GET(request);

    expect(mockPrisma.call.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: {
          createdAt: 'desc',
        },
      })
    );
  });

  it('should handle empty results', async () => {
    (mockPrisma.call.count as jest.Mock).mockResolvedValue(0);
    (mockPrisma.call.findMany as jest.Mock).mockResolvedValue([]);

    const request = createMockRequest();
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.calls).toEqual([]);
    expect(data.pagination.total).toBe(0);
    expect(data.pagination.totalPages).toBe(0);
    expect(data.pagination.hasNext).toBe(false);
    expect(data.pagination.hasPrev).toBe(false);
  });

  it('should return 500 on database error', async () => {
    (mockPrisma.call.count as jest.Mock).mockRejectedValue(
      new Error('Database connection failed')
    );

    const request = createMockRequest();
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toHaveProperty('error', 'Failed to fetch calls');
  });

  it('should enforce maximum limit of 100', async () => {
    (mockPrisma.call.count as jest.Mock).mockResolvedValue(200);
    (mockPrisma.call.findMany as jest.Mock).mockResolvedValue(mockCalls);

    const request = createMockRequest({ limit: '200' });
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.pagination.limit).toBe(100);
    expect(mockPrisma.call.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 100,
      })
    );
  });

  it('should enforce minimum page of 1', async () => {
    (mockPrisma.call.count as jest.Mock).mockResolvedValue(10);
    (mockPrisma.call.findMany as jest.Mock).mockResolvedValue(mockCalls);

    const request = createMockRequest({ page: '-5' });
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.pagination.page).toBe(1);
    expect(mockPrisma.call.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 0,
      })
    );
  });

  it('should ignore invalid status values', async () => {
    (mockPrisma.call.count as jest.Mock).mockResolvedValue(10);
    (mockPrisma.call.findMany as jest.Mock).mockResolvedValue(mockCalls);

    const request = createMockRequest({ status: 'INVALID_STATUS' });
    const response = await GET(request);

    expect(response.status).toBe(200);
    // Should not include status filter when invalid
    expect(mockPrisma.call.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {},
      })
    );
  });

  it('should include segment count in response', async () => {
    (mockPrisma.call.count as jest.Mock).mockResolvedValue(1);
    (mockPrisma.call.findMany as jest.Mock).mockResolvedValue([mockCalls[0]]);

    const request = createMockRequest();
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.calls[0]._count.segments).toBe(10);
  });
});
