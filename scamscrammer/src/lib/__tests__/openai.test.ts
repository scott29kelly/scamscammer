/**
 * Tests for OpenAI Realtime Client
 */

import { OpenAIRealtimeClient, createOpenAIClient } from '../openai';
import { EventEmitter } from 'events';

// Mock the ws module
jest.mock('ws', () => {
  return jest.fn().mockImplementation(() => {
    const emitter = new EventEmitter();
    return {
      on: emitter.on.bind(emitter),
      emit: emitter.emit.bind(emitter),
      send: jest.fn(),
      close: jest.fn(),
      readyState: 1, // WebSocket.OPEN
      OPEN: 1
    };
  });
});

// Mock the persona module
jest.mock('../persona', () => ({
  getSystemPrompt: jest.fn().mockReturnValue('Test system prompt for Earl')
}));

describe('OpenAIRealtimeClient', () => {
  let client: OpenAIRealtimeClient;

  beforeEach(() => {
    client = new OpenAIRealtimeClient({
      apiKey: 'test-api-key'
    });
  });

  afterEach(() => {
    client.disconnect();
  });

  describe('constructor', () => {
    it('should create client with default config', () => {
      expect(client).toBeInstanceOf(OpenAIRealtimeClient);
      expect(client).toBeInstanceOf(EventEmitter);
    });

    it('should accept custom voice setting', () => {
      const customClient = new OpenAIRealtimeClient({
        apiKey: 'test-key',
        voice: 'alloy'
      });
      expect(customClient).toBeInstanceOf(OpenAIRealtimeClient);
    });

    it('should accept custom model setting', () => {
      const customClient = new OpenAIRealtimeClient({
        apiKey: 'test-key',
        model: 'gpt-4o-realtime-preview'
      });
      expect(customClient).toBeInstanceOf(OpenAIRealtimeClient);
    });
  });

  describe('connected property', () => {
    it('should return false before connection', () => {
      expect(client.connected).toBe(false);
    });
  });

  describe('disconnect', () => {
    it('should safely handle disconnect when not connected', () => {
      expect(() => client.disconnect()).not.toThrow();
    });
  });

  describe('sendAudio', () => {
    it('should not throw when not connected', () => {
      const audioBuffer = Buffer.from('test audio');
      expect(() => client.sendAudio(audioBuffer)).not.toThrow();
    });
  });

  describe('commitAudio', () => {
    it('should not throw when not connected', () => {
      expect(() => client.commitAudio()).not.toThrow();
    });
  });

  describe('clearAudioBuffer', () => {
    it('should not throw when not connected', () => {
      expect(() => client.clearAudioBuffer()).not.toThrow();
    });
  });

  describe('sendText', () => {
    it('should not throw when not connected', () => {
      expect(() => client.sendText('Hello')).not.toThrow();
    });
  });

  describe('cancelResponse', () => {
    it('should not throw when not connected', () => {
      expect(() => client.cancelResponse()).not.toThrow();
    });
  });

  describe('updateInstructions', () => {
    it('should not throw when not connected', () => {
      expect(() => client.updateInstructions('New instructions')).not.toThrow();
    });
  });

  describe('event emitter', () => {
    it('should support event listeners', () => {
      const mockCallback = jest.fn();
      client.on('connected', mockCallback);

      client.emit('connected');
      expect(mockCallback).toHaveBeenCalled();
    });

    it('should support multiple event types', () => {
      const events = [
        'connected',
        'disconnected',
        'error',
        'audio',
        'transcript',
        'response_start',
        'response_end'
      ];

      events.forEach((event) => {
        const callback = jest.fn();
        client.on(event, callback);
        expect(() => client.emit(event)).not.toThrow();
      });
    });
  });
});

describe('createOpenAIClient', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('should create client with provided API key', () => {
    const client = createOpenAIClient('test-api-key');
    expect(client).toBeInstanceOf(OpenAIRealtimeClient);
  });

  it('should use environment variable when no key provided', () => {
    process.env.OPENAI_API_KEY = 'env-api-key';
    const client = createOpenAIClient();
    expect(client).toBeInstanceOf(OpenAIRealtimeClient);
  });

  it('should throw when no API key available', () => {
    delete process.env.OPENAI_API_KEY;
    expect(() => createOpenAIClient()).toThrow('OpenAI API key is required');
  });
});
