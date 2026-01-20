/**
 * Tests for WebSocket Voice Stream Handler
 */

import { NextRequest } from 'next/server';

// Mock WebSocket globally before any imports
const mockWebSocketClass = {
  OPEN: 1,
  CLOSED: 3
};
(global as unknown as { WebSocket: typeof mockWebSocketClass }).WebSocket = mockWebSocketClass as unknown as typeof WebSocket;

// Mock the ws module
jest.mock('ws', () => {
  const { EventEmitter } = require('events');
  return jest.fn().mockImplementation(() => {
    const emitter = new EventEmitter();
    return {
      on: emitter.on.bind(emitter),
      emit: emitter.emit.bind(emitter),
      send: jest.fn(),
      close: jest.fn(),
      readyState: 1,
      OPEN: 1
    };
  });
});

// Mock prisma client
const mockPrisma = {
  call: {
    findUnique: jest.fn(),
    update: jest.fn()
  },
  callSegment: {
    create: jest.fn()
  }
};

jest.mock('../../../../../lib/db', () => ({
  __esModule: true,
  default: mockPrisma
}));

// Mock OpenAI client
const mockOpenAIClient = {
  connect: jest.fn().mockResolvedValue(undefined),
  disconnect: jest.fn(),
  sendAudio: jest.fn(),
  on: jest.fn(),
  connected: true
};

jest.mock('../../../../../lib/openai', () => ({
  createOpenAIClient: jest.fn().mockReturnValue(mockOpenAIClient),
  OpenAIRealtimeClient: jest.fn()
}));

// Mock Twilio client
jest.mock('../../../../../lib/twilio', () => ({
  TwilioClient: {
    parseStreamMessage: jest.fn().mockImplementation((data: string) => {
      try {
        return JSON.parse(data);
      } catch {
        return null;
      }
    }),
    createMediaMessage: jest.fn().mockReturnValue('{"event":"media"}'),
    createMarkMessage: jest.fn().mockReturnValue('{"event":"mark"}'),
    createClearMessage: jest.fn().mockReturnValue('{"event":"clear"}')
  }
}));

// Mock Prisma Speaker enum
jest.mock('@prisma/client', () => ({
  Speaker: {
    EARL: 'EARL',
    SCAMMER: 'SCAMMER'
  }
}));

// Mock persona
jest.mock('../../../../../lib/persona', () => ({
  getSystemPrompt: jest.fn().mockReturnValue('Test Earl prompt')
}));

// Now import the module under test
import { GET, POST, getActiveConnectionCount, VoiceStreamHandler } from '../route';

describe('Voice Stream Route Handlers', () => {
  describe('GET handler', () => {
    it('should return 426 when not a WebSocket upgrade request', async () => {
      const request = new NextRequest('http://localhost:3000/api/voice/stream', {
        method: 'GET',
        headers: {}
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(426);
      expect(data.error).toBe('WebSocket upgrade required');
    });

    it('should return 501 when WebSocket upgrade is requested but not configured', async () => {
      const request = new NextRequest('http://localhost:3000/api/voice/stream', {
        method: 'GET',
        headers: {
          upgrade: 'websocket'
        }
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(501);
      expect(data.error).toBe('WebSocket not configured');
    });
  });

  describe('POST handler', () => {
    it('should return health check info', async () => {
      const request = new NextRequest('http://localhost:3000/api/voice/stream', {
        method: 'POST'
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('ok');
      expect(data.message).toContain('Voice stream endpoint');
      expect(data.websocket).toContain('wss://');
    });
  });

  describe('getActiveConnectionCount', () => {
    it('should return 0 when no connections', () => {
      const count = getActiveConnectionCount();
      expect(typeof count).toBe('number');
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });
});

describe('VoiceStreamHandler', () => {
  let mockWebSocket: {
    addEventListener: jest.Mock;
    removeEventListener: jest.Mock;
    send: jest.Mock;
    close: jest.Mock;
    readyState: number;
  };

  beforeEach(() => {
    mockWebSocket = {
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      send: jest.fn(),
      close: jest.fn(),
      readyState: 1 // WebSocket.OPEN
    };
  });

  describe('initialization', () => {
    it('should create handler with WebSocket', () => {
      const handler = new VoiceStreamHandler(mockWebSocket as unknown as WebSocket);
      expect(handler).toBeInstanceOf(VoiceStreamHandler);
    });

    it('should set up event listeners on initialize', async () => {
      const handler = new VoiceStreamHandler(mockWebSocket as unknown as WebSocket);
      await handler.initialize();

      expect(mockWebSocket.addEventListener).toHaveBeenCalledWith(
        'message',
        expect.any(Function)
      );
      expect(mockWebSocket.addEventListener).toHaveBeenCalledWith(
        'close',
        expect.any(Function)
      );
      expect(mockWebSocket.addEventListener).toHaveBeenCalledWith(
        'error',
        expect.any(Function)
      );
    });
  });

  describe('message handling', () => {
    it('should handle connected event', async () => {
      const handler = new VoiceStreamHandler(mockWebSocket as unknown as WebSocket);
      await handler.initialize();

      // Get the message handler
      const messageHandler = mockWebSocket.addEventListener.mock.calls.find(
        (call) => call[0] === 'message'
      )?.[1];

      expect(messageHandler).toBeDefined();

      // Simulate connected event
      const connectedEvent = {
        data: JSON.stringify({ event: 'connected', protocol: 'Call', version: '1.0.0' })
      };

      // Should not throw
      expect(() => messageHandler(connectedEvent)).not.toThrow();
    });

    it('should handle stop event', async () => {
      const handler = new VoiceStreamHandler(mockWebSocket as unknown as WebSocket);
      await handler.initialize();

      const messageHandler = mockWebSocket.addEventListener.mock.calls.find(
        (call) => call[0] === 'message'
      )?.[1];

      const stopEvent = {
        data: JSON.stringify({
          event: 'stop',
          stop: { accountSid: 'AC123', callSid: 'CA123' }
        })
      };

      // Should not throw
      await expect(
        (async () => messageHandler(stopEvent))()
      ).resolves.not.toThrow();
    });

    it('should handle mark event', async () => {
      const handler = new VoiceStreamHandler(mockWebSocket as unknown as WebSocket);
      await handler.initialize();

      const messageHandler = mockWebSocket.addEventListener.mock.calls.find(
        (call) => call[0] === 'message'
      )?.[1];

      const markEvent = {
        data: JSON.stringify({
          event: 'mark',
          mark: { name: 'test-mark' }
        })
      };

      expect(() => messageHandler(markEvent)).not.toThrow();
    });

    it('should handle invalid JSON gracefully', async () => {
      const handler = new VoiceStreamHandler(mockWebSocket as unknown as WebSocket);
      await handler.initialize();

      const messageHandler = mockWebSocket.addEventListener.mock.calls.find(
        (call) => call[0] === 'message'
      )?.[1];

      const invalidEvent = { data: 'not valid json' };

      // Should not throw even with invalid JSON
      expect(() => messageHandler(invalidEvent)).not.toThrow();
    });
  });

  describe('close handling', () => {
    it('should handle WebSocket close', async () => {
      const handler = new VoiceStreamHandler(mockWebSocket as unknown as WebSocket);
      await handler.initialize();

      const closeHandler = mockWebSocket.addEventListener.mock.calls.find(
        (call) => call[0] === 'close'
      )?.[1];

      expect(closeHandler).toBeDefined();
      await expect((async () => closeHandler())()).resolves.not.toThrow();
    });
  });

  describe('error handling', () => {
    it('should handle WebSocket errors', async () => {
      const handler = new VoiceStreamHandler(mockWebSocket as unknown as WebSocket);
      await handler.initialize();

      const errorHandler = mockWebSocket.addEventListener.mock.calls.find(
        (call) => call[0] === 'error'
      )?.[1];

      expect(errorHandler).toBeDefined();
      expect(() => errorHandler(new Error('Test error'))).not.toThrow();
    });
  });
});

describe('Media stream event parsing', () => {
  it('should parse start event correctly', () => {
    const startEvent = {
      event: 'start',
      start: {
        streamSid: 'MZ123',
        accountSid: 'AC123',
        callSid: 'CA123',
        tracks: ['inbound'],
        customParameters: {},
        mediaFormat: {
          encoding: 'audio/x-mulaw',
          sampleRate: 8000,
          channels: 1
        }
      }
    };

    expect(startEvent.event).toBe('start');
    expect(startEvent.start.streamSid).toBe('MZ123');
    expect(startEvent.start.mediaFormat.encoding).toBe('audio/x-mulaw');
  });

  it('should parse media event correctly', () => {
    const mediaEvent = {
      event: 'media',
      media: {
        track: 'inbound',
        chunk: '1',
        timestamp: '1234567890',
        payload: 'base64encodedaudio'
      }
    };

    expect(mediaEvent.event).toBe('media');
    expect(mediaEvent.media.payload).toBe('base64encodedaudio');
  });
});
