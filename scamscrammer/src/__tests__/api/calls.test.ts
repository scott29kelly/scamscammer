import { NextRequest } from 'next/server';
import { GET } from '@/app/api/calls/route';
import {
  GET as getCall,
  PATCH as patchCall,
  DELETE as deleteCall,
} from '@/app/api/calls/[id]/route';
import prisma from '@/lib/db';
import type { CallListResponse, CallResponse } from '@/types';

// Mock Prisma
jest.mock('@/lib/db', () => ({
  __esModule: true,
  default: {
    call: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  },
}));

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

describe('Calls API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/calls', () => {
    it('should return paginated list of calls', async () => {
      const mockCalls = [
        {
          id: 'call-1',
          twilioSid: 'CA123',
          fromNumber: '+1234567890',
          toNumber: '+0987654321',
          status: 'COMPLETED',
          duration: 300,
          recordingUrl: null,
          transcriptUrl: null,
          rating: 4,
          notes: null,
          tags: [],
          createdAt: new Date('2026-01-15'),
          updatedAt: new Date('2026-01-15'),
          _count: { segments: 5 },
        },
      ];

      (mockPrisma.call.findMany as jest.Mock).mockResolvedValue(mockCalls);
      (mockPrisma.call.count as jest.Mock).mockResolvedValue(1);

      const request = new NextRequest('http://localhost:3000/api/calls');
      const response = await GET(request);
      const data: CallListResponse = await response.json();

      expect(response.status).toBe(200);
      expect(data.calls).toHaveLength(1);
      expect(data.pagination.total).toBe(1);
      expect(data.pagination.page).toBe(1);
      expect(data.pagination.limit).toBe(20);
    });

    it('should filter by status', async () => {
      (mockPrisma.call.findMany as jest.Mock).mockResolvedValue([]);
      (mockPrisma.call.count as jest.Mock).mockResolvedValue(0);

      const request = new NextRequest('http://localhost:3000/api/calls?status=COMPLETED');
      await GET(request);

      expect(mockPrisma.call.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'COMPLETED' }),
        })
      );
    });

    it('should filter by date range', async () => {
      (mockPrisma.call.findMany as jest.Mock).mockResolvedValue([]);
      (mockPrisma.call.count as jest.Mock).mockResolvedValue(0);

      const request = new NextRequest(
        'http://localhost:3000/api/calls?startDate=2026-01-01&endDate=2026-01-31'
      );
      await GET(request);

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

    it('should respect pagination parameters', async () => {
      (mockPrisma.call.findMany as jest.Mock).mockResolvedValue([]);
      (mockPrisma.call.count as jest.Mock).mockResolvedValue(50);

      const request = new NextRequest('http://localhost:3000/api/calls?page=2&limit=10');
      const response = await GET(request);
      const data: CallListResponse = await response.json();

      expect(mockPrisma.call.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10,
          take: 10,
        })
      );
      expect(data.pagination.page).toBe(2);
      expect(data.pagination.limit).toBe(10);
      expect(data.pagination.totalPages).toBe(5);
      expect(data.pagination.hasNext).toBe(true);
      expect(data.pagination.hasPrev).toBe(true);
    });

    it('should sort by specified field', async () => {
      (mockPrisma.call.findMany as jest.Mock).mockResolvedValue([]);
      (mockPrisma.call.count as jest.Mock).mockResolvedValue(0);

      const request = new NextRequest(
        'http://localhost:3000/api/calls?sortBy=duration&sortOrder=asc'
      );
      await GET(request);

      expect(mockPrisma.call.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { duration: 'asc' },
        })
      );
    });

    it('should handle database errors', async () => {
      (mockPrisma.call.findMany as jest.Mock).mockRejectedValue(new Error('Database error'));

      const request = new NextRequest('http://localhost:3000/api/calls');
      const response = await GET(request);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe('Failed to fetch calls');
    });
  });

  describe('GET /api/calls/[id]', () => {
    it('should return a single call with segments', async () => {
      const mockCall = {
        id: 'call-1',
        twilioSid: 'CA123',
        fromNumber: '+1234567890',
        toNumber: '+0987654321',
        status: 'COMPLETED',
        duration: 300,
        recordingUrl: 'https://example.com/recording.mp3',
        transcriptUrl: null,
        rating: 4,
        notes: 'Funny call',
        tags: ['scam', 'irs'],
        createdAt: new Date('2026-01-15'),
        updatedAt: new Date('2026-01-15'),
        segments: [
          {
            id: 'seg-1',
            callId: 'call-1',
            speaker: 'SCAMMER',
            text: 'This is the IRS',
            timestamp: 0,
            createdAt: new Date('2026-01-15'),
          },
          {
            id: 'seg-2',
            callId: 'call-1',
            speaker: 'EARL',
            text: 'Well I\'ll be dipped!',
            timestamp: 3,
            createdAt: new Date('2026-01-15'),
          },
        ],
      };

      (mockPrisma.call.findUnique as jest.Mock).mockResolvedValue(mockCall);

      const request = new NextRequest('http://localhost:3000/api/calls/call-1');
      const response = await getCall(request, { params: Promise.resolve({ id: 'call-1' }) });
      const data: CallResponse = await response.json();

      expect(response.status).toBe(200);
      expect(data.id).toBe('call-1');
      expect(data.segments).toHaveLength(2);
    });

    it('should return 404 for non-existent call', async () => {
      (mockPrisma.call.findUnique as jest.Mock).mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/calls/non-existent');
      const response = await getCall(request, { params: Promise.resolve({ id: 'non-existent' }) });

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toBe('Call not found');
    });
  });

  describe('PATCH /api/calls/[id]', () => {
    const existingCall = {
      id: 'call-1',
      twilioSid: 'CA123',
      fromNumber: '+1234567890',
      toNumber: '+0987654321',
      status: 'COMPLETED',
      duration: 300,
      recordingUrl: null,
      transcriptUrl: null,
      rating: null,
      notes: null,
      tags: [],
      createdAt: new Date('2026-01-15'),
      updatedAt: new Date('2026-01-15'),
    };

    beforeEach(() => {
      (mockPrisma.call.findUnique as jest.Mock).mockResolvedValue(existingCall);
    });

    it('should update rating', async () => {
      const updatedCall = { ...existingCall, rating: 5, segments: [] };
      (mockPrisma.call.update as jest.Mock).mockResolvedValue(updatedCall);

      const request = new NextRequest('http://localhost:3000/api/calls/call-1', {
        method: 'PATCH',
        body: JSON.stringify({ rating: 5 }),
      });
      const response = await patchCall(request, { params: Promise.resolve({ id: 'call-1' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.rating).toBe(5);
    });

    it('should update notes', async () => {
      const updatedCall = { ...existingCall, notes: 'Great call!', segments: [] };
      (mockPrisma.call.update as jest.Mock).mockResolvedValue(updatedCall);

      const request = new NextRequest('http://localhost:3000/api/calls/call-1', {
        method: 'PATCH',
        body: JSON.stringify({ notes: 'Great call!' }),
      });
      const response = await patchCall(request, { params: Promise.resolve({ id: 'call-1' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.notes).toBe('Great call!');
    });

    it('should update tags', async () => {
      const updatedCall = { ...existingCall, tags: ['scam', 'funny'], segments: [] };
      (mockPrisma.call.update as jest.Mock).mockResolvedValue(updatedCall);

      const request = new NextRequest('http://localhost:3000/api/calls/call-1', {
        method: 'PATCH',
        body: JSON.stringify({ tags: ['scam', 'funny'] }),
      });
      const response = await patchCall(request, { params: Promise.resolve({ id: 'call-1' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.tags).toEqual(['scam', 'funny']);
    });

    it('should validate rating range (1-5)', async () => {
      const request = new NextRequest('http://localhost:3000/api/calls/call-1', {
        method: 'PATCH',
        body: JSON.stringify({ rating: 6 }),
      });
      const response = await patchCall(request, { params: Promise.resolve({ id: 'call-1' }) });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Validation failed');
      expect(data.details?.rating).toBeDefined();
    });

    it('should reject invalid rating type', async () => {
      const request = new NextRequest('http://localhost:3000/api/calls/call-1', {
        method: 'PATCH',
        body: JSON.stringify({ rating: 'five' }),
      });
      const response = await patchCall(request, { params: Promise.resolve({ id: 'call-1' }) });

      expect(response.status).toBe(400);
    });

    it('should reject empty update payload', async () => {
      const request = new NextRequest('http://localhost:3000/api/calls/call-1', {
        method: 'PATCH',
        body: JSON.stringify({}),
      });
      const response = await patchCall(request, { params: Promise.resolve({ id: 'call-1' }) });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('No valid fields to update');
    });

    it('should return 404 for non-existent call', async () => {
      (mockPrisma.call.findUnique as jest.Mock).mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/calls/non-existent', {
        method: 'PATCH',
        body: JSON.stringify({ rating: 5 }),
      });
      const response = await patchCall(request, { params: Promise.resolve({ id: 'non-existent' }) });

      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /api/calls/[id]', () => {
    it('should delete a call', async () => {
      (mockPrisma.call.findUnique as jest.Mock).mockResolvedValue({
        id: 'call-1',
        recordingUrl: null,
      });
      (mockPrisma.call.delete as jest.Mock).mockResolvedValue({});

      const request = new NextRequest('http://localhost:3000/api/calls/call-1', {
        method: 'DELETE',
      });
      const response = await deleteCall(request, { params: Promise.resolve({ id: 'call-1' }) });

      expect(response.status).toBe(204);
      expect(mockPrisma.call.delete).toHaveBeenCalledWith({
        where: { id: 'call-1' },
      });
    });

    it('should return 404 for non-existent call', async () => {
      (mockPrisma.call.findUnique as jest.Mock).mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/calls/non-existent', {
        method: 'DELETE',
      });
      const response = await deleteCall(request, { params: Promise.resolve({ id: 'non-existent' }) });

      expect(response.status).toBe(404);
    });

    it('should handle database errors', async () => {
      (mockPrisma.call.findUnique as jest.Mock).mockResolvedValue({
        id: 'call-1',
        recordingUrl: null,
      });
      (mockPrisma.call.delete as jest.Mock).mockRejectedValue(new Error('Database error'));

      const request = new NextRequest('http://localhost:3000/api/calls/call-1', {
        method: 'DELETE',
      });
      const response = await deleteCall(request, { params: Promise.resolve({ id: 'call-1' }) });

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe('Failed to delete call');
    });
  });
});
