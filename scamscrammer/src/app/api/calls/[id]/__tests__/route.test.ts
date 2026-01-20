/**
 * Individual Call API Endpoint Tests
 */

import { GET, PATCH, DELETE } from '../route';
import prisma from '@/lib/db';
import { CallStatus, Speaker } from '@prisma/client';
import { NextRequest } from 'next/server';

// Mock the Prisma client
jest.mock('@/lib/db', () => ({
  __esModule: true,
  default: {
    call: {
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  },
}));

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

// Helper to create NextRequest
function createRequest(
  body?: Record<string, unknown>,
  method: string = 'GET'
): NextRequest {
  const url = new URL('http://localhost:3000/api/calls/test-id');
  const init: RequestInit = { method };
  if (body) {
    init.body = JSON.stringify(body);
    init.headers = { 'Content-Type': 'application/json' };
  }
  return new NextRequest(url, init);
}

// Helper to create params promise
function createParams(id: string): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) };
}

describe('GET /api/calls/[id]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockCall = {
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
    tags: ['funny', 'epic'],
    createdAt: new Date('2026-01-15T10:00:00Z'),
    updatedAt: new Date('2026-01-15T10:05:00Z'),
    segments: [
      {
        id: 'seg-1',
        callId: 'call-1',
        speaker: Speaker.SCAMMER,
        text: 'Hello, this is Microsoft support.',
        timestamp: 0,
        createdAt: new Date('2026-01-15T10:00:00Z'),
      },
      {
        id: 'seg-2',
        callId: 'call-1',
        speaker: Speaker.EARL,
        text: 'Oh, hello there! Is this about my microwave?',
        timestamp: 5,
        createdAt: new Date('2026-01-15T10:00:05Z'),
      },
    ],
  };

  it('should return call with all segments', async () => {
    (mockPrisma.call.findUnique as jest.Mock).mockResolvedValue(mockCall);

    const response = await GET(createRequest(), createParams('call-1'));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.id).toBe('call-1');
    expect(data.twilioSid).toBe('CA123');
    expect(data.status).toBe('COMPLETED');
    expect(data.segments).toHaveLength(2);
    expect(data.segments[0].speaker).toBe('SCAMMER');
    expect(data.segments[1].speaker).toBe('EARL');

    expect(mockPrisma.call.findUnique).toHaveBeenCalledWith({
      where: { id: 'call-1' },
      include: {
        segments: {
          orderBy: { timestamp: 'asc' },
        },
      },
    });
  });

  it('should return 404 for non-existent call', async () => {
    (mockPrisma.call.findUnique as jest.Mock).mockResolvedValue(null);

    const response = await GET(createRequest(), createParams('non-existent'));
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Call not found');
  });

  it('should return 500 on database error', async () => {
    (mockPrisma.call.findUnique as jest.Mock).mockRejectedValue(
      new Error('Database error')
    );

    const response = await GET(createRequest(), createParams('call-1'));
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to fetch call');
  });
});

describe('PATCH /api/calls/[id]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockCall = {
    id: 'call-1',
    twilioSid: 'CA123',
    fromNumber: '+15551234567',
    toNumber: '+15559876543',
    status: CallStatus.COMPLETED,
    duration: 300,
    recordingUrl: 'https://example.com/recording1.mp3',
    transcriptUrl: null,
    rating: null,
    notes: null,
    tags: [],
    createdAt: new Date('2026-01-15T10:00:00Z'),
    updatedAt: new Date('2026-01-15T10:05:00Z'),
    segments: [],
  };

  it('should update call rating', async () => {
    (mockPrisma.call.findUnique as jest.Mock).mockResolvedValue(mockCall);
    (mockPrisma.call.update as jest.Mock).mockResolvedValue({
      ...mockCall,
      rating: 5,
    });

    const response = await PATCH(
      createRequest({ rating: 5 }, 'PATCH'),
      createParams('call-1')
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.rating).toBe(5);

    expect(mockPrisma.call.update).toHaveBeenCalledWith({
      where: { id: 'call-1' },
      data: { rating: 5 },
      include: {
        segments: {
          orderBy: { timestamp: 'asc' },
        },
      },
    });
  });

  it('should update call notes', async () => {
    (mockPrisma.call.findUnique as jest.Mock).mockResolvedValue(mockCall);
    (mockPrisma.call.update as jest.Mock).mockResolvedValue({
      ...mockCall,
      notes: 'This was hilarious!',
    });

    const response = await PATCH(
      createRequest({ notes: 'This was hilarious!' }, 'PATCH'),
      createParams('call-1')
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.notes).toBe('This was hilarious!');
  });

  it('should update call tags', async () => {
    (mockPrisma.call.findUnique as jest.Mock).mockResolvedValue(mockCall);
    (mockPrisma.call.update as jest.Mock).mockResolvedValue({
      ...mockCall,
      tags: ['funny', 'long', 'confused-scammer'],
    });

    const response = await PATCH(
      createRequest({ tags: ['funny', 'long', 'confused-scammer'] }, 'PATCH'),
      createParams('call-1')
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.tags).toEqual(['funny', 'long', 'confused-scammer']);
  });

  it('should update multiple fields at once', async () => {
    (mockPrisma.call.findUnique as jest.Mock).mockResolvedValue(mockCall);
    (mockPrisma.call.update as jest.Mock).mockResolvedValue({
      ...mockCall,
      rating: 4,
      notes: 'Pretty good',
      tags: ['good'],
    });

    const response = await PATCH(
      createRequest(
        {
          rating: 4,
          notes: 'Pretty good',
          tags: ['good'],
        },
        'PATCH'
      ),
      createParams('call-1')
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.rating).toBe(4);
    expect(data.notes).toBe('Pretty good');
    expect(data.tags).toEqual(['good']);

    expect(mockPrisma.call.update).toHaveBeenCalledWith({
      where: { id: 'call-1' },
      data: {
        rating: 4,
        notes: 'Pretty good',
        tags: ['good'],
      },
      include: {
        segments: {
          orderBy: { timestamp: 'asc' },
        },
      },
    });
  });

  it('should return 404 for non-existent call', async () => {
    (mockPrisma.call.findUnique as jest.Mock).mockResolvedValue(null);

    const response = await PATCH(
      createRequest({ rating: 5 }, 'PATCH'),
      createParams('non-existent')
    );
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Call not found');
  });

  it('should return 400 for rating out of range (too low)', async () => {
    (mockPrisma.call.findUnique as jest.Mock).mockResolvedValue(mockCall);

    const response = await PATCH(
      createRequest({ rating: 0 }, 'PATCH'),
      createParams('call-1')
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Validation failed');
    expect(data.details.rating).toBe('Rating must be between 1 and 5');
  });

  it('should return 400 for rating out of range (too high)', async () => {
    (mockPrisma.call.findUnique as jest.Mock).mockResolvedValue(mockCall);

    const response = await PATCH(
      createRequest({ rating: 6 }, 'PATCH'),
      createParams('call-1')
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Validation failed');
    expect(data.details.rating).toBe('Rating must be between 1 and 5');
  });

  it('should return 400 for non-integer rating', async () => {
    (mockPrisma.call.findUnique as jest.Mock).mockResolvedValue(mockCall);

    const response = await PATCH(
      createRequest({ rating: 3.5 }, 'PATCH'),
      createParams('call-1')
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Validation failed');
    expect(data.details.rating).toBe('Rating must be an integer');
  });

  it('should return 400 for non-string rating', async () => {
    (mockPrisma.call.findUnique as jest.Mock).mockResolvedValue(mockCall);

    const response = await PATCH(
      createRequest({ rating: 'five' }, 'PATCH'),
      createParams('call-1')
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Validation failed');
    expect(data.details.rating).toBe('Rating must be an integer');
  });

  it('should return 400 for non-array tags', async () => {
    (mockPrisma.call.findUnique as jest.Mock).mockResolvedValue(mockCall);

    const response = await PATCH(
      createRequest({ tags: 'funny' }, 'PATCH'),
      createParams('call-1')
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Validation failed');
    expect(data.details.tags).toBe('Tags must be an array');
  });

  it('should return 400 for tags with non-string elements', async () => {
    (mockPrisma.call.findUnique as jest.Mock).mockResolvedValue(mockCall);

    const response = await PATCH(
      createRequest({ tags: ['funny', 123, 'good'] }, 'PATCH'),
      createParams('call-1')
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Validation failed');
    expect(data.details.tags).toBe('All tags must be strings');
  });

  it('should return 400 when no valid fields provided', async () => {
    (mockPrisma.call.findUnique as jest.Mock).mockResolvedValue(mockCall);

    const response = await PATCH(
      createRequest({ invalidField: 'value' }, 'PATCH'),
      createParams('call-1')
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('No valid fields to update');
  });

  it('should return 400 for invalid JSON body', async () => {
    (mockPrisma.call.findUnique as jest.Mock).mockResolvedValue(mockCall);

    // Create request with invalid JSON
    const url = new URL('http://localhost:3000/api/calls/call-1');
    const request = new NextRequest(url, {
      method: 'PATCH',
      body: 'invalid json',
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await PATCH(request, createParams('call-1'));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Invalid JSON body');
  });

  it('should return 500 on database error', async () => {
    (mockPrisma.call.findUnique as jest.Mock).mockResolvedValue(mockCall);
    (mockPrisma.call.update as jest.Mock).mockRejectedValue(
      new Error('Database error')
    );

    const response = await PATCH(
      createRequest({ rating: 5 }, 'PATCH'),
      createParams('call-1')
    );
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to update call');
  });
});

describe('DELETE /api/calls/[id]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockCall = {
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
  };

  it('should delete call and return 204', async () => {
    (mockPrisma.call.findUnique as jest.Mock).mockResolvedValue(mockCall);
    (mockPrisma.call.delete as jest.Mock).mockResolvedValue(mockCall);

    const response = await DELETE(
      createRequest(undefined, 'DELETE'),
      createParams('call-1')
    );

    expect(response.status).toBe(204);

    expect(mockPrisma.call.delete).toHaveBeenCalledWith({
      where: { id: 'call-1' },
    });
  });

  it('should return 404 for non-existent call', async () => {
    (mockPrisma.call.findUnique as jest.Mock).mockResolvedValue(null);

    const response = await DELETE(
      createRequest(undefined, 'DELETE'),
      createParams('non-existent')
    );
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Call not found');

    expect(mockPrisma.call.delete).not.toHaveBeenCalled();
  });

  it('should return 500 on database error', async () => {
    (mockPrisma.call.findUnique as jest.Mock).mockResolvedValue(mockCall);
    (mockPrisma.call.delete as jest.Mock).mockRejectedValue(
      new Error('Database error')
    );

    const response = await DELETE(
      createRequest(undefined, 'DELETE'),
      createParams('call-1')
    );
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to delete call');
  });
});
