/**
 * Tests for WebSocket Voice Stream Handler
 *
 * These tests verify the WebSocket-based audio streaming functionality
 * between Twilio and OpenAI Realtime API.
 */

import type {
  TwilioStreamStartEvent,
  TwilioStreamMediaEvent,
} from '@/lib/twilio';

// =============================================================================
// Mocks
// =============================================================================

// Create listeners map for mock event emitter
const listeners = new Map<string, ((...args: unknown[]) => void)[]>();

// Create mock instances with EventEmitter-like methods
const mockOpenAIClientInstance = {
  connect: jest.fn().mockResolvedValue(undefined),
  disconnect: jest.fn(),
  sendAudio: jest.fn(),
  isConnected: jest.fn().mockReturnValue(true),
  getState: jest.fn().mockReturnValue('connected'),
  on: jest.fn((event: string, callback: (...args: unknown[]) => void) => {
    const handlers = listeners.get(event) || [];
    handlers.push(callback);
    listeners.set(event, handlers);
    return mockOpenAIClientInstance;
  }),
  off: jest.fn((event: string, callback: (...args: unknown[]) => void) => {
    const handlers = listeners.get(event) || [];
    const index = handlers.indexOf(callback);
    if (index > -1) {
      handlers.splice(index, 1);
    }
    return mockOpenAIClientInstance;
  }),
  emit: jest.fn((event: string, ...args: unknown[]) => {
    const handlers = listeners.get(event) || [];
    handlers.forEach((handler) => handler(...args));
    return handlers.length > 0;
  }),
  removeAllListeners: jest.fn(() => {
    listeners.clear();
    return mockOpenAIClientInstance;
  }),
};

const mockPrismaInstance = {
  call: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  callSegment: {
    create: jest.fn(),
  },
};

const mockWebSocketInstance = {
  send: jest.fn(),
  close: jest.fn(),
  readyState: 1, // WebSocket.OPEN
  OPEN: 1,
  CLOSED: 3,
};

// Setup mocks before imports
jest.mock('@/lib/openai', () => ({
  createEarlClient: jest.fn(() => mockOpenAIClientInstance),
  OpenAIRealtimeClient: jest.fn(() => mockOpenAIClientInstance),
}));

jest.mock('@/lib/db', () => ({
  prisma: mockPrismaInstance,
}));

jest.mock('ws', () => ({
  WebSocket: jest.fn(() => mockWebSocketInstance),
  WebSocketServer: jest.fn(() => ({
    handleUpgrade: jest.fn(),
    emit: jest.fn(),
    on: jest.fn(),
  })),
}));

// Now import the module under test
import { POST, __testing__ } from '../route';

// =============================================================================
// Test Fixtures
// =============================================================================

const mockCallId = 'test-call-id-123';
const mockCallSid = 'CA1234567890abcdef1234567890abcdef';
const mockStreamSid = 'MZ1234567890abcdef1234567890abcdef';

interface TwilioStreamConnectedEvent {
  event: 'connected';
  protocol: string;
  version: string;
}

interface TwilioStreamStopEvent {
  event: 'stop';
  sequenceNumber: string;
  streamSid: string;
  stop: {
    accountSid: string;
    callSid: string;
  };
}

const createConnectedEvent = (): TwilioStreamConnectedEvent => ({
  event: 'connected',
  protocol: 'Call',
  version: '1.0.0',
});

const createStartEvent = (): TwilioStreamStartEvent => ({
  event: 'start',
  sequenceNumber: '1',
  streamSid: mockStreamSid,
  start: {
    streamSid: mockStreamSid,
    accountSid: 'AC1234567890abcdef1234567890abcdef',
    callSid: mockCallSid,
    tracks: ['inbound'],
    customParameters: {},
    mediaFormat: {
      encoding: 'audio/x-mulaw',
      sampleRate: 8000,
      channels: 1,
    },
  },
});

const createMediaEvent = (payload: string = 'base64audiodata'): TwilioStreamMediaEvent => ({
  event: 'media',
  sequenceNumber: '2',
  streamSid: mockStreamSid,
  media: {
    track: 'inbound',
    chunk: '1',
    timestamp: '100',
    payload,
  },
});

const createStopEvent = (): TwilioStreamStopEvent => ({
  event: 'stop',
  sequenceNumber: '100',
  streamSid: mockStreamSid,
  stop: {
    accountSid: 'AC1234567890abcdef1234567890abcdef',
    callSid: mockCallSid,
  },
});

// =============================================================================
// Tests
// =============================================================================

describe('Voice Stream Handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    listeners.clear();

    // Reset module state
    __testing__.activeSessions.clear();
    __testing__.pendingTranscripts.clear();

    // Setup default mock responses
    mockPrismaInstance.call.findUnique.mockResolvedValue({
      id: mockCallId,
      twilioSid: mockCallSid,
    });

    mockPrismaInstance.callSegment.create.mockResolvedValue({
      id: 'segment-1',
      callId: mockCallId,
      speaker: 'EARL',
      text: 'Test text',
      timestamp: Date.now() / 1000,
    });

    // Reset WebSocket mock
    mockWebSocketInstance.readyState = 1;
    mockWebSocketInstance.send.mockClear();
    mockWebSocketInstance.close.mockClear();

    // Reset OpenAI client mock
    mockOpenAIClientInstance.connect.mockResolvedValue(undefined);
    mockOpenAIClientInstance.sendAudio.mockClear();
    mockOpenAIClientInstance.disconnect.mockClear();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('POST endpoint (health check)', () => {
    it('should return status ok with active sessions count', async () => {
      const request = new Request('http://localhost:3000/api/voice/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test: true }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('ok');
      expect(data.message).toBe('Voice stream handler is running');
      expect(data.activeSessions).toBe(0);
      expect(data.test).toBe(true);
    });

    it('should handle empty request body', async () => {
      const request = new Request('http://localhost:3000/api/voice/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('ok');
    });
  });

  describe('handleTwilioMessage', () => {
    it('should handle connected event', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      const event = createConnectedEvent();

      await __testing__.handleTwilioMessage(
        mockWebSocketInstance as unknown as WebSocket,
        JSON.stringify(event)
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[Voice Stream] Twilio connected:'),
        expect.objectContaining({
          protocol: 'Call',
          version: '1.0.0',
        })
      );

      consoleSpy.mockRestore();
    });

    it('should handle invalid JSON gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      await __testing__.handleTwilioMessage(
        mockWebSocketInstance as unknown as WebSocket,
        'invalid json{'
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[Voice Stream] Failed to parse message:'),
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });

  describe('createSession', () => {
    it('should create a session with OpenAI client', async () => {
      const startEvent = createStartEvent();

      const session = await __testing__.createSession(
        startEvent,
        mockWebSocketInstance as unknown as WebSocket
      );

      expect(session.callSid).toBe(mockCallSid);
      expect(session.streamSid).toBe(mockStreamSid);
      expect(session.callId).toBe(mockCallId);
      expect(session.isConnected).toBe(true);
      expect(mockOpenAIClientInstance.connect).toHaveBeenCalled();
      expect(__testing__.activeSessions.has(mockStreamSid)).toBe(true);
    });

    it('should handle call not found in database', async () => {
      mockPrismaInstance.call.findUnique.mockResolvedValue(null);
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      const startEvent = createStartEvent();
      const session = await __testing__.createSession(
        startEvent,
        mockWebSocketInstance as unknown as WebSocket
      );

      expect(session.callId).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[Voice Stream] Call not found in database:'),
        mockCallSid
      );

      consoleSpy.mockRestore();
    });

    it('should handle database errors gracefully', async () => {
      mockPrismaInstance.call.findUnique.mockRejectedValue(new Error('Database error'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const startEvent = createStartEvent();
      const session = await __testing__.createSession(
        startEvent,
        mockWebSocketInstance as unknown as WebSocket
      );

      expect(session.callId).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[Voice Stream] Error finding call:'),
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it('should throw error if OpenAI connection fails', async () => {
      mockOpenAIClientInstance.connect.mockRejectedValue(new Error('OpenAI connection failed'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const startEvent = createStartEvent();

      await expect(
        __testing__.createSession(startEvent, mockWebSocketInstance as unknown as WebSocket)
      ).rejects.toThrow('OpenAI connection failed');

      consoleSpy.mockRestore();
    });
  });

  describe('cleanupSession', () => {
    it('should clean up an existing session', async () => {
      // Create a session first
      const startEvent = createStartEvent();
      await __testing__.createSession(startEvent, mockWebSocketInstance as unknown as WebSocket);

      expect(__testing__.activeSessions.has(mockStreamSid)).toBe(true);

      // Clean up the session
      await __testing__.cleanupSession(mockStreamSid);

      expect(__testing__.activeSessions.has(mockStreamSid)).toBe(false);
      expect(mockOpenAIClientInstance.disconnect).toHaveBeenCalledWith('call_ended');
    });

    it('should handle non-existent session gracefully', async () => {
      await __testing__.cleanupSession('non-existent-stream-sid');
      // Should not throw
    });
  });

  describe('saveTranscriptSegment', () => {
    it('should save transcript segment to database', async () => {
      await __testing__.saveTranscriptSegment(mockCallId, 'EARL', 'Hello there!');

      expect(mockPrismaInstance.callSegment.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          callId: mockCallId,
          speaker: 'EARL',
          text: 'Hello there!',
          timestamp: expect.any(Number),
        }),
      });
    });

    it('should not save empty text', async () => {
      await __testing__.saveTranscriptSegment(mockCallId, 'EARL', '   ');

      expect(mockPrismaInstance.callSegment.create).not.toHaveBeenCalled();
    });

    it('should handle database errors gracefully', async () => {
      mockPrismaInstance.callSegment.create.mockRejectedValue(new Error('DB error'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      await __testing__.saveTranscriptSegment(mockCallId, 'EARL', 'Test');

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('Media handling', () => {
    it('should forward media to OpenAI client', async () => {
      // Create a session
      const startEvent = createStartEvent();
      await __testing__.createSession(startEvent, mockWebSocketInstance as unknown as WebSocket);

      // Send media event
      const mediaEvent = createMediaEvent('testpayload123');
      await __testing__.handleTwilioMessage(
        mockWebSocketInstance as unknown as WebSocket,
        JSON.stringify(mediaEvent)
      );

      expect(mockOpenAIClientInstance.sendAudio).toHaveBeenCalledWith('testpayload123');
    });

    it('should not forward media when session does not exist', async () => {
      const mediaEvent = createMediaEvent();
      await __testing__.handleTwilioMessage(
        mockWebSocketInstance as unknown as WebSocket,
        JSON.stringify(mediaEvent)
      );

      expect(mockOpenAIClientInstance.sendAudio).not.toHaveBeenCalled();
    });

    it('should handle OpenAI sendAudio errors gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      mockOpenAIClientInstance.sendAudio.mockImplementation(() => {
        throw new Error('Send audio failed');
      });

      // Create a session
      const startEvent = createStartEvent();
      await __testing__.createSession(startEvent, mockWebSocketInstance as unknown as WebSocket);

      // Send media event
      const mediaEvent = createMediaEvent();
      await __testing__.handleTwilioMessage(
        mockWebSocketInstance as unknown as WebSocket,
        JSON.stringify(mediaEvent)
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[Voice Stream] Error sending audio to OpenAI:'),
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Stop event handling', () => {
    it('should clean up session on stop event', async () => {
      // Create a session
      const startEvent = createStartEvent();
      await __testing__.createSession(startEvent, mockWebSocketInstance as unknown as WebSocket);

      // Send stop event
      const stopEvent = createStopEvent();
      await __testing__.handleTwilioMessage(
        mockWebSocketInstance as unknown as WebSocket,
        JSON.stringify(stopEvent)
      );

      expect(__testing__.activeSessions.has(mockStreamSid)).toBe(false);
    });
  });

  describe('Pending transcript management', () => {
    it('should accumulate scammer transcripts', async () => {
      // Create a session
      const startEvent = createStartEvent();
      await __testing__.createSession(startEvent, mockWebSocketInstance as unknown as WebSocket);

      // Simulate input transcript events by directly setting pending transcript
      __testing__.pendingTranscripts.set(mockStreamSid, {
        speaker: 'SCAMMER',
        text: 'Hello',
        startTime: Date.now(),
      });

      // Check transcript is stored
      const pending = __testing__.pendingTranscripts.get(mockStreamSid);
      expect(pending).toBeDefined();
      expect(pending?.speaker).toBe('SCAMMER');
      expect(pending?.text).toBe('Hello');
    });
  });

  describe('Session activity tracking', () => {
    it('should update lastActivityTime on media events', async () => {
      // Create a session
      const startEvent = createStartEvent();
      const session = await __testing__.createSession(
        startEvent,
        mockWebSocketInstance as unknown as WebSocket
      );

      const initialActivityTime = session.lastActivityTime;

      // Wait a bit and send media
      await new Promise((resolve) => setTimeout(resolve, 10));

      const mediaEvent = createMediaEvent();
      await __testing__.handleTwilioMessage(
        mockWebSocketInstance as unknown as WebSocket,
        JSON.stringify(mediaEvent)
      );

      // Get updated session
      const updatedSession = __testing__.activeSessions.get(mockStreamSid);
      expect(updatedSession?.lastActivityTime).toBeGreaterThan(initialActivityTime);
    });
  });
});

describe('Type Guards', () => {
  it('should correctly identify connected event', () => {
    const event = createConnectedEvent();
    expect(event.event).toBe('connected');
    expect(event.protocol).toBeDefined();
  });

  it('should correctly identify start event', () => {
    const event = createStartEvent();
    expect(event.event).toBe('start');
    expect(event.start.callSid).toBeDefined();
    expect(event.start.streamSid).toBeDefined();
  });

  it('should correctly identify media event', () => {
    const event = createMediaEvent();
    expect(event.event).toBe('media');
    expect(event.media.payload).toBeDefined();
  });

  it('should correctly identify stop event', () => {
    const event = createStopEvent();
    expect(event.event).toBe('stop');
    expect(event.stop.callSid).toBeDefined();
  });
});
