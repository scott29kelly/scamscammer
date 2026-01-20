/**
 * Single Call API Endpoint Tests
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

// Helper to create mock request
const createMockRequest = (body?: object): NextRequest => {
  return {
    json: () => Promise.resolve(body || {}),
  } as unknown as NextRequest;
};

// Helper to create route params
const createParams = (id: string) => ({
  params: Promise.resolve({ id }),
});

// Sample call data
const mockCall = {
  id: 'call-123',
  twilioSid: 'CA123456789',
  fromNumber: '+15551234567',
  toNumber: '+15559876543',
  status: CallStatus.COMPLETED,
  duration: 300,
  recordingUrl: 'https://example.com/recording.mp3',
  transcriptUrl: null,
  rating: 4,
  notes: 'Test notes',
  tags: ['funny', 'scam'],
  createdAt: new Date('2026-01-15T10:00:00Z'),
  updatedAt: new Date('2026-01-15T10:05:00Z'),
};

const mockSegments = [
  {
    id: 'seg-1',
    callId: 'call-123',
    speaker: Speaker.SCAMMER,
    text: 'Hello, this is the IRS.',
    timestamp: 0,
    createdAt: new Date('2026-01-15T10:00:00Z'),
  },
  {
    id: 'seg-2',
    callId: 'call-123',
    speaker: Speaker.EARL,
    text: 'Oh my, the IRS you say?',
    timestamp: 5,
    createdAt: new Date('2026-01-15T10:00:05Z'),
  },
  {
    id: 'seg-3',
    callId: 'call-123',
    speaker: Speaker.SCAMMER,
    text: 'Yes, you owe back taxes.',
    timestamp: 10,
    createdAt: new Date('2026-01-15T10:00:10Z'),
  },
];

describe('GET /api/calls/[id]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return a call with segments', async () => {
    const callWithSegments = { ...mockCall, segments: mockSegments };
    (mockPrisma.call.findUnique as jest.Mock).mockResolvedValue(callWithSegments);

    const response = await GET(
      createMockRequest(),
      createParams('call-123')
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.id).toBe('call-123');
    expect(data.twilioSid).toBe('CA123456789');
    expect(data.fromNumber).toBe('+15551234567');
    expect(data.toNumber).toBe('+15559876543');
    expect(data.status).toBe(CallStatus.COMPLETED);
    expect(data.duration).toBe(300);
    expect(data.recordingUrl).toBe('https://example.com/recording.mp3');
    expect(data.rating).toBe(4);
    expect(data.notes).toBe('Test notes');
    expect(data.tags).toEqual(['funny', 'scam']);
    expect(data.segments).toHaveLength(3);
    expect(data.segments[0].speaker).toBe(Speaker.SCAMMER);
    expect(data.segments[1].speaker).toBe(Speaker.EARL);
  });

  it('should return 404 for non-existent call', async () => {
    (mockPrisma.call.findUnique as jest.Mock).mockResolvedValue(null);

    const response = await GET(
      createMockRequest(),
      createParams('non-existent')
    );
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Call not found');
  });

  it('should return 500 on database error', async () => {
    (mockPrisma.call.findUnique as jest.Mock).mockRejectedValue(
      new Error('Database error')
    );

    const response = await GET(
      createMockRequest(),
      createParams('call-123')
    );
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to fetch call');
  });

  it('should return call without recording URL when not available', async () => {
    const callNoRecording = { ...mockCall, recordingUrl: null, segments: [] };
    (mockPrisma.call.findUnique as jest.Mock).mockResolvedValue(callNoRecording);

    const response = await GET(
      createMockRequest(),
      createParams('call-123')
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.recordingUrl).toBeNull();
    expect(data.segments).toEqual([]);
  });
});

describe('PATCH /api/calls/[id]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should update rating successfully', async () => {
    (mockPrisma.call.findUnique as jest.Mock).mockResolvedValue(mockCall);
    const updatedCall = { ...mockCall, rating: 5, segments: mockSegments };
    (mockPrisma.call.update as jest.Mock).mockResolvedValue(updatedCall);

    const response = await PATCH(
      createMockRequest({ rating: 5 }),
      createParams('call-123')
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.rating).toBe(5);
    expect(mockPrisma.call.update).toHaveBeenCalledWith({
      where: { id: 'call-123' },
      data: { rating: 5 },
      include: {
        segments: {
          orderBy: { timestamp: 'asc' },
        },
      },
    });
  });

  it('should update notes successfully', async () => {
    (mockPrisma.call.findUnique as jest.Mock).mockResolvedValue(mockCall);
    const updatedCall = { ...mockCall, notes: 'New notes', segments: mockSegments };
    (mockPrisma.call.update as jest.Mock).mockResolvedValue(updatedCall);

    const response = await PATCH(
      createMockRequest({ notes: 'New notes' }),
      createParams('call-123')
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.notes).toBe('New notes');
  });

  it('should update tags successfully', async () => {
    (mockPrisma.call.findUnique as jest.Mock).mockResolvedValue(mockCall);
    const updatedCall = { ...mockCall, tags: ['new', 'tags'], segments: mockSegments };
    (mockPrisma.call.update as jest.Mock).mockResolvedValue(updatedCall);

    const response = await PATCH(
      createMockRequest({ tags: ['new', 'tags'] }),
      createParams('call-123')
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.tags).toEqual(['new', 'tags']);
  });

  it('should update multiple fields at once', async () => {
    (mockPrisma.call.findUnique as jest.Mock).mockResolvedValue(mockCall);
    const updatedCall = {
      ...mockCall,
      rating: 3,
      notes: 'Updated notes',
      tags: ['updated'],
      segments: mockSegments,
    };
    (mockPrisma.call.update as jest.Mock).mockResolvedValue(updatedCall);

    const response = await PATCH(
      createMockRequest({ rating: 3, notes: 'Updated notes', tags: ['updated'] }),
      createParams('call-123')
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.rating).toBe(3);
    expect(data.notes).toBe('Updated notes');
    expect(data.tags).toEqual(['updated']);
  });

  it('should allow setting rating to null', async () => {
    (mockPrisma.call.findUnique as jest.Mock).mockResolvedValue(mockCall);
    const updatedCall = { ...mockCall, rating: null, segments: mockSegments };
    (mockPrisma.call.update as jest.Mock).mockResolvedValue(updatedCall);

    const response = await PATCH(
      createMockRequest({ rating: null }),
      createParams('call-123')
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.rating).toBeNull();
  });

  it('should return 400 for invalid rating (too high)', async () => {
    (mockPrisma.call.findUnique as jest.Mock).mockResolvedValue(mockCall);

    const response = await PATCH(
      createMockRequest({ rating: 6 }),
      createParams('call-123')
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Invalid rating');
  });

  it('should return 400 for invalid rating (too low)', async () => {
    (mockPrisma.call.findUnique as jest.Mock).mockResolvedValue(mockCall);

    const response = await PATCH(
      createMockRequest({ rating: 0 }),
      createParams('call-123')
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Invalid rating');
  });

  it('should return 400 for invalid notes type', async () => {
    (mockPrisma.call.findUnique as jest.Mock).mockResolvedValue(mockCall);

    const response = await PATCH(
      createMockRequest({ notes: 123 }),
      createParams('call-123')
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Invalid notes');
  });

  it('should return 400 for invalid tags type', async () => {
    (mockPrisma.call.findUnique as jest.Mock).mockResolvedValue(mockCall);

    const response = await PATCH(
      createMockRequest({ tags: 'not-an-array' }),
      createParams('call-123')
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Invalid tags');
  });

  it('should return 400 for tags with non-string elements', async () => {
    (mockPrisma.call.findUnique as jest.Mock).mockResolvedValue(mockCall);

    const response = await PATCH(
      createMockRequest({ tags: ['valid', 123] }),
      createParams('call-123')
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Invalid tags');
  });

  it('should return 404 for non-existent call', async () => {
    (mockPrisma.call.findUnique as jest.Mock).mockResolvedValue(null);

    const response = await PATCH(
      createMockRequest({ rating: 5 }),
      createParams('non-existent')
    );
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Call not found');
  });

  it('should return 500 on database error', async () => {
    (mockPrisma.call.findUnique as jest.Mock).mockResolvedValue(mockCall);
    (mockPrisma.call.update as jest.Mock).mockRejectedValue(
      new Error('Database error')
    );

    const response = await PATCH(
      createMockRequest({ rating: 5 }),
      createParams('call-123')
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

  it('should delete a call successfully', async () => {
    (mockPrisma.call.findUnique as jest.Mock).mockResolvedValue(mockCall);
    (mockPrisma.call.delete as jest.Mock).mockResolvedValue(mockCall);

    const response = await DELETE(
      createMockRequest(),
      createParams('call-123')
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockPrisma.call.delete).toHaveBeenCalledWith({
      where: { id: 'call-123' },
    });
  });

  it('should return 404 for non-existent call', async () => {
    (mockPrisma.call.findUnique as jest.Mock).mockResolvedValue(null);

    const response = await DELETE(
      createMockRequest(),
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
      createMockRequest(),
      createParams('call-123')
    );
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to delete call');
  });
});
