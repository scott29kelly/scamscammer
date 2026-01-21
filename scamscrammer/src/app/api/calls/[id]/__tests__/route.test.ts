/**
 * Call Detail API Endpoint Tests
 */

import { GET, PATCH, DELETE } from '../route';
import prisma from '@/lib/db';
import { storageClient } from '@/lib/storage';
import { NextRequest } from 'next/server';
import { CallStatus, Speaker } from '@prisma/client';

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

// Mock the storage client
jest.mock('@/lib/storage', () => ({
  storageClient: {
    deleteRecording: jest.fn(),
  },
}));

const mockPrisma = prisma as jest.Mocked<typeof prisma>;
const mockStorageClient = storageClient as jest.Mocked<typeof storageClient>;

// Helper to create mock call data
const createMockCall = (overrides = {}) => ({
  id: 'call-123',
  twilioSid: 'CA123456789',
  fromNumber: '+15551234567',
  toNumber: '+15559876543',
  status: CallStatus.COMPLETED,
  duration: 300,
  recordingUrl: 'https://example.com/recording.mp3',
  transcriptUrl: null,
  rating: 4,
  notes: 'Great call with funny moments',
  tags: ['funny', 'classic'],
  createdAt: new Date('2026-01-15T10:00:00Z'),
  updatedAt: new Date('2026-01-15T10:05:00Z'),
  segments: [
    {
      id: 'seg-1',
      callId: 'call-123',
      speaker: Speaker.SCAMMER,
      text: 'Hello, this is Microsoft tech support.',
      timestamp: 0,
      createdAt: new Date('2026-01-15T10:00:00Z'),
    },
    {
      id: 'seg-2',
      callId: 'call-123',
      speaker: Speaker.EARL,
      text: 'Oh my, my grandson told me about you folks! Are you the ones who fix the internets?',
      timestamp: 5,
      createdAt: new Date('2026-01-15T10:00:05Z'),
    },
  ],
  ...overrides,
});

// Helper to create mock request
const createMockRequest = (body?: object): NextRequest => {
  const url = 'http://localhost:3000/api/calls/call-123';
  if (body) {
    return new NextRequest(url, {
      method: 'PATCH',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return new NextRequest(url);
};

// Helper to create params
const createParams = (id: string) => ({
  params: Promise.resolve({ id }),
});

describe('GET /api/calls/[id]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return a call with all segments', async () => {
    const mockCall = createMockCall();
    (mockPrisma.call.findUnique as jest.Mock).mockResolvedValue(mockCall);

    const request = createMockRequest();
    const response = await GET(request, createParams('call-123'));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveProperty('id', 'call-123');
    expect(data).toHaveProperty('twilioSid', 'CA123456789');
    expect(data).toHaveProperty('fromNumber', '+15551234567');
    expect(data).toHaveProperty('duration', 300);
    expect(data).toHaveProperty('recordingUrl', 'https://example.com/recording.mp3');
    expect(data).toHaveProperty('rating', 4);
    expect(data).toHaveProperty('notes', 'Great call with funny moments');
    expect(data).toHaveProperty('tags');
    expect(data.tags).toEqual(['funny', 'classic']);
    expect(data).toHaveProperty('segments');
    expect(data.segments).toHaveLength(2);
    expect(data.segments[0]).toHaveProperty('speaker', Speaker.SCAMMER);
    expect(data.segments[1]).toHaveProperty('speaker', Speaker.EARL);

    expect(mockPrisma.call.findUnique).toHaveBeenCalledWith({
      where: { id: 'call-123' },
      include: {
        segments: {
          orderBy: {
            timestamp: 'asc',
          },
        },
      },
    });
  });

  it('should return 404 for non-existent call', async () => {
    (mockPrisma.call.findUnique as jest.Mock).mockResolvedValue(null);

    const request = createMockRequest();
    const response = await GET(request, createParams('non-existent'));
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data).toHaveProperty('error', 'Call not found');
  });

  it('should return 500 on database error', async () => {
    (mockPrisma.call.findUnique as jest.Mock).mockRejectedValue(
      new Error('Database connection failed')
    );

    const request = createMockRequest();
    const response = await GET(request, createParams('call-123'));
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toHaveProperty('error', 'Failed to fetch call');
  });

  it('should return call with empty segments array', async () => {
    const mockCall = createMockCall({ segments: [] });
    (mockPrisma.call.findUnique as jest.Mock).mockResolvedValue(mockCall);

    const request = createMockRequest();
    const response = await GET(request, createParams('call-123'));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.segments).toEqual([]);
  });
});

describe('PATCH /api/calls/[id]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should update call rating', async () => {
    const mockCall = createMockCall();
    const updatedCall = { ...mockCall, rating: 5 };

    (mockPrisma.call.findUnique as jest.Mock).mockResolvedValue(mockCall);
    (mockPrisma.call.update as jest.Mock).mockResolvedValue(updatedCall);

    const request = createMockRequest({ rating: 5 });
    const response = await PATCH(request, createParams('call-123'));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveProperty('rating', 5);
    expect(mockPrisma.call.update).toHaveBeenCalledWith({
      where: { id: 'call-123' },
      data: { rating: 5 },
      include: {
        segments: {
          orderBy: {
            timestamp: 'asc',
          },
        },
      },
    });
  });

  it('should update call notes', async () => {
    const mockCall = createMockCall();
    const updatedCall = { ...mockCall, notes: 'Updated notes' };

    (mockPrisma.call.findUnique as jest.Mock).mockResolvedValue(mockCall);
    (mockPrisma.call.update as jest.Mock).mockResolvedValue(updatedCall);

    const request = createMockRequest({ notes: 'Updated notes' });
    const response = await PATCH(request, createParams('call-123'));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveProperty('notes', 'Updated notes');
  });

  it('should update call tags', async () => {
    const mockCall = createMockCall();
    const updatedCall = { ...mockCall, tags: ['hilarious', 'long'] };

    (mockPrisma.call.findUnique as jest.Mock).mockResolvedValue(mockCall);
    (mockPrisma.call.update as jest.Mock).mockResolvedValue(updatedCall);

    const request = createMockRequest({ tags: ['hilarious', 'long'] });
    const response = await PATCH(request, createParams('call-123'));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.tags).toEqual(['hilarious', 'long']);
  });

  it('should update multiple fields at once', async () => {
    const mockCall = createMockCall();
    const updatedCall = {
      ...mockCall,
      rating: 5,
      notes: 'Best call ever!',
      tags: ['epic'],
    };

    (mockPrisma.call.findUnique as jest.Mock).mockResolvedValue(mockCall);
    (mockPrisma.call.update as jest.Mock).mockResolvedValue(updatedCall);

    const request = createMockRequest({
      rating: 5,
      notes: 'Best call ever!',
      tags: ['epic'],
    });
    const response = await PATCH(request, createParams('call-123'));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.rating).toBe(5);
    expect(data.notes).toBe('Best call ever!');
    expect(data.tags).toEqual(['epic']);
  });

  it('should return 400 for invalid rating (too low)', async () => {
    const request = createMockRequest({ rating: 0 });
    const response = await PATCH(request, createParams('call-123'));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data).toHaveProperty('error', 'Rating must be an integer between 1 and 5');
  });

  it('should return 400 for invalid rating (too high)', async () => {
    const request = createMockRequest({ rating: 6 });
    const response = await PATCH(request, createParams('call-123'));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data).toHaveProperty('error', 'Rating must be an integer between 1 and 5');
  });

  it('should return 400 for non-integer rating', async () => {
    const request = createMockRequest({ rating: 3.5 });
    const response = await PATCH(request, createParams('call-123'));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data).toHaveProperty('error', 'Rating must be an integer between 1 and 5');
  });

  it('should return 400 for invalid tags (not an array)', async () => {
    const request = createMockRequest({ tags: 'not-an-array' });
    const response = await PATCH(request, createParams('call-123'));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data).toHaveProperty('error', 'Tags must be an array of strings');
  });

  it('should return 400 for invalid tags (non-string elements)', async () => {
    const request = createMockRequest({ tags: [1, 2, 3] });
    const response = await PATCH(request, createParams('call-123'));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data).toHaveProperty('error', 'Tags must be an array of strings');
  });

  it('should return 404 for non-existent call', async () => {
    (mockPrisma.call.findUnique as jest.Mock).mockResolvedValue(null);

    const request = createMockRequest({ rating: 5 });
    const response = await PATCH(request, createParams('non-existent'));
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data).toHaveProperty('error', 'Call not found');
  });

  it('should return 500 on database error', async () => {
    const mockCall = createMockCall();
    (mockPrisma.call.findUnique as jest.Mock).mockResolvedValue(mockCall);
    (mockPrisma.call.update as jest.Mock).mockRejectedValue(
      new Error('Database connection failed')
    );

    const request = createMockRequest({ rating: 5 });
    const response = await PATCH(request, createParams('call-123'));
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toHaveProperty('error', 'Failed to update call');
  });
});

describe('DELETE /api/calls/[id]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should delete a call and its S3 recording', async () => {
    const mockCall = createMockCall({
      recordingUrl: 'https://s3.us-east-1.amazonaws.com/scamscrammer-recordings/recordings/2026/01/15/CA123456789/REC123.mp3',
    });

    (mockPrisma.call.findUnique as jest.Mock).mockResolvedValue(mockCall);
    (mockPrisma.call.delete as jest.Mock).mockResolvedValue(mockCall);
    (mockStorageClient.deleteRecording as jest.Mock).mockResolvedValue(true);

    const request = createMockRequest();
    const response = await DELETE(request, createParams('call-123'));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveProperty('success', true);
    expect(data).toHaveProperty('key', 'recordings/2026/01/15/CA123456789/REC123.mp3');

    expect(mockPrisma.call.delete).toHaveBeenCalledWith({
      where: { id: 'call-123' },
    });
    expect(mockStorageClient.deleteRecording).toHaveBeenCalledWith(
      'recordings/2026/01/15/CA123456789/REC123.mp3'
    );
  });

  it('should delete a call without recording URL', async () => {
    const mockCall = createMockCall({
      recordingUrl: null,
    });

    (mockPrisma.call.findUnique as jest.Mock).mockResolvedValue(mockCall);
    (mockPrisma.call.delete as jest.Mock).mockResolvedValue(mockCall);

    const request = createMockRequest();
    const response = await DELETE(request, createParams('call-123'));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveProperty('success', true);
    expect(data.key).toBeUndefined();

    expect(mockPrisma.call.delete).toHaveBeenCalledWith({
      where: { id: 'call-123' },
    });
    expect(mockStorageClient.deleteRecording).not.toHaveBeenCalled();
  });

  it('should return 404 for non-existent call', async () => {
    (mockPrisma.call.findUnique as jest.Mock).mockResolvedValue(null);

    const request = createMockRequest();
    const response = await DELETE(request, createParams('non-existent'));
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data).toHaveProperty('error', 'Call not found');
    expect(mockPrisma.call.delete).not.toHaveBeenCalled();
  });

  it('should still delete call even if S3 deletion fails', async () => {
    const mockCall = createMockCall({
      recordingUrl: 'https://s3.us-east-1.amazonaws.com/bucket/recordings/test.mp3',
    });

    (mockPrisma.call.findUnique as jest.Mock).mockResolvedValue(mockCall);
    (mockPrisma.call.delete as jest.Mock).mockResolvedValue(mockCall);
    (mockStorageClient.deleteRecording as jest.Mock).mockRejectedValue(
      new Error('S3 deletion failed')
    );

    const request = createMockRequest();
    const response = await DELETE(request, createParams('call-123'));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveProperty('success', true);
    expect(mockPrisma.call.delete).toHaveBeenCalled();
  });

  it('should return 500 on database error', async () => {
    const mockCall = createMockCall();
    (mockPrisma.call.findUnique as jest.Mock).mockResolvedValue(mockCall);
    (mockPrisma.call.delete as jest.Mock).mockRejectedValue(
      new Error('Database connection failed')
    );

    const request = createMockRequest();
    const response = await DELETE(request, createParams('call-123'));
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toHaveProperty('error', 'Failed to delete call');
  });

  it('should delete transcript from S3 if it exists', async () => {
    const mockCall = createMockCall({
      recordingUrl: 'https://s3.us-east-1.amazonaws.com/bucket/recordings/call.mp3',
      transcriptUrl: 'https://s3.us-east-1.amazonaws.com/bucket/transcripts/call.txt',
    });

    (mockPrisma.call.findUnique as jest.Mock).mockResolvedValue(mockCall);
    (mockPrisma.call.delete as jest.Mock).mockResolvedValue(mockCall);
    (mockStorageClient.deleteRecording as jest.Mock).mockResolvedValue(true);

    const request = createMockRequest();
    const response = await DELETE(request, createParams('call-123'));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveProperty('success', true);

    // Should have been called twice - once for recording, once for transcript
    expect(mockStorageClient.deleteRecording).toHaveBeenCalledTimes(2);
    expect(mockStorageClient.deleteRecording).toHaveBeenCalledWith('recordings/call.mp3');
    expect(mockStorageClient.deleteRecording).toHaveBeenCalledWith('transcripts/call.txt');
  });

  it('should handle invalid recording URL gracefully', async () => {
    const mockCall = createMockCall({
      recordingUrl: 'not-a-valid-url',
    });

    (mockPrisma.call.findUnique as jest.Mock).mockResolvedValue(mockCall);
    (mockPrisma.call.delete as jest.Mock).mockResolvedValue(mockCall);

    const request = createMockRequest();
    const response = await DELETE(request, createParams('call-123'));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveProperty('success', true);
    expect(mockPrisma.call.delete).toHaveBeenCalled();
    expect(mockStorageClient.deleteRecording).not.toHaveBeenCalled();
  });
});
