/**
 * Calls List API Endpoint Tests
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
      findMany: jest.fn(),
      count: jest.fn(),
    },
  },
}));

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

// Helper to create NextRequest with query params
function createRequest(queryParams: Record<string, string> = {}): NextRequest {
  const url = new URL('http://localhost:3000/api/calls');
  Object.entries(queryParams).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });
  return new NextRequest(url);
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

  it('should return paginated list of calls with default parameters', async () => {
    (mockPrisma.call.findMany as jest.Mock).mockResolvedValue(mockCalls);
    (mockPrisma.call.count as jest.Mock).mockResolvedValue(2);

    const response = await GET(createRequest());
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

    expect(mockPrisma.call.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 0,
        take: 20,
        orderBy: { createdAt: 'desc' },
      })
    );
  });

  it('should handle custom pagination parameters', async () => {
    (mockPrisma.call.findMany as jest.Mock).mockResolvedValue([mockCalls[0]]);
    (mockPrisma.call.count as jest.Mock).mockResolvedValue(50);

    const response = await GET(createRequest({ page: '3', limit: '10' }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.pagination).toEqual({
      total: 50,
      page: 3,
      limit: 10,
      totalPages: 5,
      hasNext: true,
      hasPrev: true,
    });

    expect(mockPrisma.call.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 20,
        take: 10,
      })
    );
  });

  it('should enforce pagination limits', async () => {
    (mockPrisma.call.findMany as jest.Mock).mockResolvedValue([]);
    (mockPrisma.call.count as jest.Mock).mockResolvedValue(0);

    // Test maximum limit enforcement
    const response = await GET(createRequest({ limit: '999' }));
    await response.json();

    expect(mockPrisma.call.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 100,
      })
    );
  });

  it('should enforce minimum page number', async () => {
    (mockPrisma.call.findMany as jest.Mock).mockResolvedValue([]);
    (mockPrisma.call.count as jest.Mock).mockResolvedValue(0);

    const response = await GET(createRequest({ page: '-5' }));
    await response.json();

    expect(mockPrisma.call.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 0,
      })
    );
  });

  it('should filter by status', async () => {
    (mockPrisma.call.findMany as jest.Mock).mockResolvedValue([mockCalls[0]]);
    (mockPrisma.call.count as jest.Mock).mockResolvedValue(1);

    const response = await GET(createRequest({ status: 'COMPLETED' }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.calls).toHaveLength(1);

    expect(mockPrisma.call.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'COMPLETED',
        }),
      })
    );
  });

  it('should return 400 for invalid status filter', async () => {
    const response = await GET(createRequest({ status: 'INVALID_STATUS' }));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Invalid status filter');
    expect(data.details).toHaveProperty('status');
  });

  it('should filter by date range', async () => {
    (mockPrisma.call.findMany as jest.Mock).mockResolvedValue(mockCalls);
    (mockPrisma.call.count as jest.Mock).mockResolvedValue(2);

    const response = await GET(
      createRequest({
        startDate: '2026-01-01T00:00:00Z',
        endDate: '2026-01-31T23:59:59Z',
      })
    );

    expect(response.status).toBe(200);

    expect(mockPrisma.call.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          createdAt: {
            gte: new Date('2026-01-01T00:00:00Z'),
            lte: new Date('2026-01-31T23:59:59Z'),
          },
        }),
      })
    );
  });

  it('should return 400 for invalid start date', async () => {
    const response = await GET(createRequest({ startDate: 'not-a-date' }));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Invalid start date');
  });

  it('should return 400 for invalid end date', async () => {
    const response = await GET(createRequest({ endDate: 'not-a-date' }));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Invalid end date');
  });

  it('should sort by different fields', async () => {
    (mockPrisma.call.findMany as jest.Mock).mockResolvedValue(mockCalls);
    (mockPrisma.call.count as jest.Mock).mockResolvedValue(2);

    const response = await GET(
      createRequest({ sortBy: 'duration', sortOrder: 'asc' })
    );

    expect(response.status).toBe(200);

    expect(mockPrisma.call.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { duration: 'asc' },
      })
    );
  });

  it('should return 400 for invalid sort field', async () => {
    const response = await GET(createRequest({ sortBy: 'invalidField' }));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Invalid sort field');
    expect(data.details).toHaveProperty('sortBy');
  });

  it('should return 400 for invalid sort order', async () => {
    const response = await GET(createRequest({ sortOrder: 'random' }));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Invalid sort order');
    expect(data.details).toHaveProperty('sortOrder');
  });

  it('should handle empty results', async () => {
    (mockPrisma.call.findMany as jest.Mock).mockResolvedValue([]);
    (mockPrisma.call.count as jest.Mock).mockResolvedValue(0);

    const response = await GET(createRequest());
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.calls).toEqual([]);
    expect(data.pagination.total).toBe(0);
    expect(data.pagination.totalPages).toBe(0);
  });

  it('should return 500 on database error', async () => {
    (mockPrisma.call.findMany as jest.Mock).mockRejectedValue(
      new Error('Database connection failed')
    );

    const response = await GET(createRequest());
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to fetch calls');
  });

  it('should include segment count in response', async () => {
    (mockPrisma.call.findMany as jest.Mock).mockResolvedValue(mockCalls);
    (mockPrisma.call.count as jest.Mock).mockResolvedValue(2);

    const response = await GET(createRequest());
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.calls[0]._count.segments).toBe(10);
    expect(data.calls[1]._count.segments).toBe(20);
  });
});
