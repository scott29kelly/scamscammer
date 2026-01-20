/**
 * Tests for OpenAI Realtime Voice Client
 */

import { EventEmitter } from 'events';
import WebSocket from 'ws';
import {
  OpenAIRealtimeClient,
  OpenAIRealtimeError,
  ConnectionState,
  createEarlClient,
  SessionConfig,
  AudioResponseEvent,
  TranscriptEvent,
} from '../openai';
import { EARL_SYSTEM_PROMPT } from '../persona';

// Mock the ws module
jest.mock('ws');

const MockWebSocket = WebSocket as jest.MockedClass<typeof WebSocket>;

describe('OpenAI Realtime Voice Client', () => {
  let client: OpenAIRealtimeClient;
  let mockWsInstance: EventEmitter & {
    send: jest.Mock;
    close: jest.Mock;
    ping: jest.Mock;
    readyState: number;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    client = new OpenAIRealtimeClient();

    // Create a mock WebSocket instance that extends EventEmitter
    const emitter = new EventEmitter();
    mockWsInstance = Object.assign(emitter, {
      send: jest.fn(),
      close: jest.fn(),
      ping: jest.fn(),
      readyState: WebSocket.OPEN,
      CONNECTING: 0,
      OPEN: 1,
      CLOSING: 2,
      CLOSED: 3,
    });

    // Make MockWebSocket return our mock instance
    MockWebSocket.mockImplementation(() => mockWsInstance as unknown as WebSocket);
  });

  afterEach(() => {
    client.disconnect();
  });

  describe('constructor', () => {
    it('should create a new instance', () => {
      expect(client).toBeInstanceOf(OpenAIRealtimeClient);
      expect(client).toBeInstanceOf(EventEmitter);
    });

    it('should start in disconnected state', () => {
      expect(client.getState()).toBe(ConnectionState.DISCONNECTED);
    });

    it('should have null session ID initially', () => {
      expect(client.getSessionId()).toBeNull();
    });

    it('should not be connected initially', () => {
      expect(client.isConnected()).toBe(false);
    });
  });

  describe('connect()', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = { ...originalEnv, OPENAI_API_KEY: 'test-api-key' };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it('should throw error if no API key is available', async () => {
      delete process.env.OPENAI_API_KEY;

      await expect(client.connect()).rejects.toThrow(OpenAIRealtimeError);
      await expect(client.connect()).rejects.toThrow('OpenAI API key is required');
    });

    it('should accept API key from config', async () => {
      delete process.env.OPENAI_API_KEY;

      const connectPromise = client.connect({ apiKey: 'config-api-key' });

      // Simulate WebSocket open
      setImmediate(() => mockWsInstance.emit('open'));

      await expect(connectPromise).resolves.toBeUndefined();
    });

    it('should transition to connecting state', async () => {
      const stateChanges: ConnectionState[] = [];
      client.on('stateChange', (state) => stateChanges.push(state));

      const connectPromise = client.connect();
      expect(client.getState()).toBe(ConnectionState.CONNECTING);

      setImmediate(() => mockWsInstance.emit('open'));
      await connectPromise;

      expect(stateChanges).toContain(ConnectionState.CONNECTING);
    });

    it('should transition to connected state on successful connection', async () => {
      const connectPromise = client.connect();

      setImmediate(() => mockWsInstance.emit('open'));
      await connectPromise;

      expect(client.getState()).toBe(ConnectionState.CONNECTED);
    });

    it('should throw error if already connected', async () => {
      const connectPromise = client.connect();
      setImmediate(() => mockWsInstance.emit('open'));
      await connectPromise;

      await expect(client.connect()).rejects.toThrow('Already connected');
    });

    it('should create WebSocket with correct URL and headers', async () => {
      const connectPromise = client.connect({ model: 'gpt-4o-realtime-preview' });
      setImmediate(() => mockWsInstance.emit('open'));
      await connectPromise;

      expect(MockWebSocket).toHaveBeenCalledWith(
        'wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview',
        expect.objectContaining({
          headers: {
            Authorization: 'Bearer test-api-key',
            'OpenAI-Beta': 'realtime=v1',
          },
        })
      );
    });

    it('should send session.update event after connection', async () => {
      const connectPromise = client.connect({
        voice: 'shimmer',
        instructions: 'Test instructions',
      });

      setImmediate(() => mockWsInstance.emit('open'));
      await connectPromise;

      expect(mockWsInstance.send).toHaveBeenCalled();
      const sentEvent = JSON.parse(mockWsInstance.send.mock.calls[0][0] as string);
      expect(sentEvent.type).toBe('session.update');
      expect(sentEvent.session.voice).toBe('shimmer');
      expect(sentEvent.session.instructions).toBe('Test instructions');
    });

    it('should use EARL_SYSTEM_PROMPT as default instructions', async () => {
      const connectPromise = client.connect();

      setImmediate(() => mockWsInstance.emit('open'));
      await connectPromise;

      const sentEvent = JSON.parse(mockWsInstance.send.mock.calls[0][0] as string);
      expect(sentEvent.session.instructions).toBe(EARL_SYSTEM_PROMPT);
    });

    it('should enable input audio transcription by default', async () => {
      const connectPromise = client.connect();

      setImmediate(() => mockWsInstance.emit('open'));
      await connectPromise;

      const sentEvent = JSON.parse(mockWsInstance.send.mock.calls[0][0] as string);
      expect(sentEvent.session.input_audio_transcription).toEqual({
        model: 'whisper-1',
      });
    });

    it('should configure turn detection by default', async () => {
      const connectPromise = client.connect();

      setImmediate(() => mockWsInstance.emit('open'));
      await connectPromise;

      const sentEvent = JSON.parse(mockWsInstance.send.mock.calls[0][0] as string);
      expect(sentEvent.session.turn_detection).toEqual({
        type: 'server_vad',
        threshold: 0.5,
        prefix_padding_ms: 300,
        silence_duration_ms: 500,
      });
    });
  });

  describe('disconnect()', () => {
    beforeEach(() => {
      process.env.OPENAI_API_KEY = 'test-api-key';
    });

    it('should close the WebSocket connection', async () => {
      const connectPromise = client.connect();
      setImmediate(() => mockWsInstance.emit('open'));
      await connectPromise;

      client.disconnect();

      expect(mockWsInstance.close).toHaveBeenCalledWith(1000, 'Client initiated disconnect');
    });

    it('should emit disconnect event', async () => {
      const connectPromise = client.connect();
      setImmediate(() => mockWsInstance.emit('open'));
      await connectPromise;

      const disconnectHandler = jest.fn();
      client.on('disconnect', disconnectHandler);

      client.disconnect('Custom reason');

      expect(disconnectHandler).toHaveBeenCalledWith('Custom reason');
    });

    it('should transition to disconnected state', async () => {
      const connectPromise = client.connect();
      setImmediate(() => mockWsInstance.emit('open'));
      await connectPromise;

      client.disconnect();

      expect(client.getState()).toBe(ConnectionState.DISCONNECTED);
    });

    it('should clear session ID', async () => {
      const connectPromise = client.connect();
      setImmediate(() => mockWsInstance.emit('open'));
      await connectPromise;

      // Simulate session.created event
      mockWsInstance.emit(
        'message',
        JSON.stringify({
          type: 'session.created',
          session: { id: 'test-session-id', model: 'gpt-4o', voice: 'ash' },
        })
      );

      expect(client.getSessionId()).toBe('test-session-id');

      client.disconnect();

      expect(client.getSessionId()).toBeNull();
    });
  });

  describe('sendAudio()', () => {
    beforeEach(async () => {
      process.env.OPENAI_API_KEY = 'test-api-key';
      const connectPromise = client.connect();
      setImmediate(() => mockWsInstance.emit('open'));
      await connectPromise;
    });

    it('should send audio buffer as base64', () => {
      const audioBuffer = Buffer.from([0x00, 0x01, 0x02, 0x03]);
      client.sendAudio(audioBuffer);

      expect(mockWsInstance.send).toHaveBeenCalledTimes(2); // session.update + audio
      const sentEvent = JSON.parse(mockWsInstance.send.mock.calls[1][0] as string);
      expect(sentEvent.type).toBe('input_audio_buffer.append');
      expect(sentEvent.audio).toBe(audioBuffer.toString('base64'));
    });

    it('should throw if not connected', async () => {
      client.disconnect();
      mockWsInstance.readyState = WebSocket.CLOSED;

      expect(() => client.sendAudio(Buffer.from([0x00]))).toThrow('Not connected');
    });
  });

  describe('commitAudioBuffer()', () => {
    beforeEach(async () => {
      process.env.OPENAI_API_KEY = 'test-api-key';
      const connectPromise = client.connect();
      setImmediate(() => mockWsInstance.emit('open'));
      await connectPromise;
    });

    it('should send commit event', () => {
      client.commitAudioBuffer();

      const sentEvent = JSON.parse(mockWsInstance.send.mock.calls[1][0] as string);
      expect(sentEvent.type).toBe('input_audio_buffer.commit');
    });

    it('should throw if not connected', async () => {
      client.disconnect();
      mockWsInstance.readyState = WebSocket.CLOSED;

      expect(() => client.commitAudioBuffer()).toThrow('Not connected');
    });
  });

  describe('clearAudioBuffer()', () => {
    beforeEach(async () => {
      process.env.OPENAI_API_KEY = 'test-api-key';
      const connectPromise = client.connect();
      setImmediate(() => mockWsInstance.emit('open'));
      await connectPromise;
    });

    it('should send clear event', () => {
      client.clearAudioBuffer();

      const sentEvent = JSON.parse(mockWsInstance.send.mock.calls[1][0] as string);
      expect(sentEvent.type).toBe('input_audio_buffer.clear');
    });
  });

  describe('cancelResponse()', () => {
    beforeEach(async () => {
      process.env.OPENAI_API_KEY = 'test-api-key';
      const connectPromise = client.connect();
      setImmediate(() => mockWsInstance.emit('open'));
      await connectPromise;
    });

    it('should send cancel event', () => {
      client.cancelResponse();

      const sentEvent = JSON.parse(mockWsInstance.send.mock.calls[1][0] as string);
      expect(sentEvent.type).toBe('response.cancel');
    });
  });

  describe('triggerResponse()', () => {
    beforeEach(async () => {
      process.env.OPENAI_API_KEY = 'test-api-key';
      const connectPromise = client.connect();
      setImmediate(() => mockWsInstance.emit('open'));
      await connectPromise;
    });

    it('should send response.create event', () => {
      client.triggerResponse();

      const sentEvent = JSON.parse(mockWsInstance.send.mock.calls[1][0] as string);
      expect(sentEvent.type).toBe('response.create');
    });

    it('should throw if not connected', async () => {
      client.disconnect();
      mockWsInstance.readyState = WebSocket.CLOSED;

      expect(() => client.triggerResponse()).toThrow('Not connected');
    });
  });

  describe('setSystemPrompt()', () => {
    beforeEach(async () => {
      process.env.OPENAI_API_KEY = 'test-api-key';
      const connectPromise = client.connect();
      setImmediate(() => mockWsInstance.emit('open'));
      await connectPromise;
    });

    it('should send session.update with new instructions', () => {
      client.setSystemPrompt('New system prompt');

      const sentEvent = JSON.parse(mockWsInstance.send.mock.calls[1][0] as string);
      expect(sentEvent.type).toBe('session.update');
      expect(sentEvent.session.instructions).toBe('New system prompt');
    });

    it('should throw if not connected', async () => {
      client.disconnect();
      mockWsInstance.readyState = WebSocket.CLOSED;

      expect(() => client.setSystemPrompt('test')).toThrow('Not connected');
    });
  });

  describe('updateSession()', () => {
    beforeEach(async () => {
      process.env.OPENAI_API_KEY = 'test-api-key';
      const connectPromise = client.connect();
      setImmediate(() => mockWsInstance.emit('open'));
      await connectPromise;
    });

    it('should send session.update with specified config', () => {
      client.updateSession({
        voice: 'coral',
        temperature: 0.9,
        maxResponseOutputTokens: 4096,
      });

      const sentEvent = JSON.parse(mockWsInstance.send.mock.calls[1][0] as string);
      expect(sentEvent.type).toBe('session.update');
      expect(sentEvent.session.voice).toBe('coral');
      expect(sentEvent.session.temperature).toBe(0.9);
      expect(sentEvent.session.max_response_output_tokens).toBe(4096);
    });

    it('should format turn detection correctly', () => {
      client.updateSession({
        turnDetection: {
          type: 'server_vad',
          threshold: 0.7,
          prefixPaddingMs: 200,
          silenceDurationMs: 600,
        },
      });

      const sentEvent = JSON.parse(mockWsInstance.send.mock.calls[1][0] as string);
      expect(sentEvent.session.turn_detection).toEqual({
        type: 'server_vad',
        threshold: 0.7,
        prefix_padding_ms: 200,
        silence_duration_ms: 600,
      });
    });
  });

  describe('Event Handling', () => {
    beforeEach(async () => {
      process.env.OPENAI_API_KEY = 'test-api-key';
      const connectPromise = client.connect();
      setImmediate(() => mockWsInstance.emit('open'));
      await connectPromise;
    });

    describe('session.created', () => {
      it('should emit sessionCreated event', () => {
        const handler = jest.fn();
        client.on('sessionCreated', handler);

        mockWsInstance.emit(
          'message',
          JSON.stringify({
            type: 'session.created',
            session: {
              id: 'sess_123',
              model: 'gpt-4o-realtime-preview',
              voice: 'ash',
            },
          })
        );

        expect(handler).toHaveBeenCalledWith({
          id: 'sess_123',
          model: 'gpt-4o-realtime-preview',
          voice: 'ash',
        });
      });

      it('should store session ID', () => {
        mockWsInstance.emit(
          'message',
          JSON.stringify({
            type: 'session.created',
            session: { id: 'sess_456', model: 'gpt-4o', voice: 'ash' },
          })
        );

        expect(client.getSessionId()).toBe('sess_456');
      });
    });

    describe('input_audio_buffer events', () => {
      it('should emit speechStarted event', () => {
        const handler = jest.fn();
        client.on('speechStarted', handler);

        mockWsInstance.emit(
          'message',
          JSON.stringify({
            type: 'input_audio_buffer.speech_started',
          })
        );

        expect(handler).toHaveBeenCalled();
      });

      it('should emit speechStopped event', () => {
        const handler = jest.fn();
        client.on('speechStopped', handler);

        mockWsInstance.emit(
          'message',
          JSON.stringify({
            type: 'input_audio_buffer.speech_stopped',
          })
        );

        expect(handler).toHaveBeenCalled();
      });

      it('should emit inputAudioCommitted event', () => {
        const handler = jest.fn();
        client.on('inputAudioCommitted', handler);

        mockWsInstance.emit(
          'message',
          JSON.stringify({
            type: 'input_audio_buffer.committed',
          })
        );

        expect(handler).toHaveBeenCalled();
      });
    });

    describe('conversation.item.created', () => {
      it('should emit conversationItemCreated event', () => {
        const handler = jest.fn();
        client.on('conversationItemCreated', handler);

        mockWsInstance.emit(
          'message',
          JSON.stringify({
            type: 'conversation.item.created',
            item: {
              id: 'item_123',
              type: 'message',
              role: 'assistant',
              status: 'completed',
            },
          })
        );

        expect(handler).toHaveBeenCalledWith({
          id: 'item_123',
          type: 'message',
          role: 'assistant',
          status: 'completed',
        });
      });
    });

    describe('input audio transcription', () => {
      it('should emit transcript event for input transcription', () => {
        const handler = jest.fn();
        client.on('transcript', handler);

        mockWsInstance.emit(
          'message',
          JSON.stringify({
            type: 'conversation.item.input_audio_transcription.completed',
            transcript: 'Hello, how are you?',
            item_id: 'item_789',
          })
        );

        expect(handler).toHaveBeenCalledWith({
          type: 'input',
          text: 'Hello, how are you?',
          isFinal: true,
          itemId: 'item_789',
        });
      });
    });

    describe('response events', () => {
      it('should emit responseStart event', () => {
        const handler = jest.fn();
        client.on('responseStart', handler);

        mockWsInstance.emit(
          'message',
          JSON.stringify({
            type: 'response.created',
            response: {
              id: 'resp_123',
              status: 'in_progress',
            },
          })
        );

        expect(handler).toHaveBeenCalledWith({
          responseId: 'resp_123',
          status: 'in_progress',
        });
      });

      it('should emit audioResponse event for audio delta', () => {
        const handler = jest.fn();
        client.on('audioResponse', handler);

        mockWsInstance.emit(
          'message',
          JSON.stringify({
            type: 'response.audio.delta',
            response_id: 'resp_123',
            item_id: 'item_456',
            content_index: 0,
            delta: 'base64audiodata==',
          })
        );

        expect(handler).toHaveBeenCalledWith({
          audioData: 'base64audiodata==',
          responseId: 'resp_123',
          itemId: 'item_456',
          contentIndex: 0,
        });
      });

      it('should emit transcript event for output transcript delta', () => {
        const handler = jest.fn();
        client.on('transcript', handler);

        mockWsInstance.emit(
          'message',
          JSON.stringify({
            type: 'response.audio_transcript.delta',
            delta: 'Hello there',
            item_id: 'item_456',
          })
        );

        expect(handler).toHaveBeenCalledWith({
          type: 'output',
          text: 'Hello there',
          isFinal: false,
          itemId: 'item_456',
        });
      });

      it('should emit final transcript event when transcript done', () => {
        const handler = jest.fn();
        client.on('transcript', handler);

        mockWsInstance.emit(
          'message',
          JSON.stringify({
            type: 'response.audio_transcript.done',
            transcript: 'Hello there, how may I help you?',
            item_id: 'item_456',
          })
        );

        expect(handler).toHaveBeenCalledWith({
          type: 'output',
          text: 'Hello there, how may I help you?',
          isFinal: true,
          itemId: 'item_456',
        });
      });

      it('should emit responseEnd event with usage', () => {
        const handler = jest.fn();
        client.on('responseEnd', handler);

        mockWsInstance.emit(
          'message',
          JSON.stringify({
            type: 'response.done',
            response: {
              id: 'resp_123',
              status: 'completed',
              usage: {
                total_tokens: 100,
                input_tokens: 30,
                output_tokens: 70,
              },
            },
          })
        );

        expect(handler).toHaveBeenCalledWith({
          responseId: 'resp_123',
          status: 'completed',
          usage: {
            totalTokens: 100,
            inputTokens: 30,
            outputTokens: 70,
          },
        });
      });
    });

    describe('error event', () => {
      it('should emit error event for server errors', () => {
        const handler = jest.fn();
        client.on('error', handler);

        mockWsInstance.emit(
          'message',
          JSON.stringify({
            type: 'error',
            event_id: 'evt_123',
            error: {
              message: 'Invalid session',
              code: 'invalid_session',
              type: 'invalid_request_error',
            },
          })
        );

        expect(handler).toHaveBeenCalled();
        const error = handler.mock.calls[0][0] as OpenAIRealtimeError;
        expect(error.message).toBe('Invalid session');
        expect(error.code).toBe('invalid_session');
        expect(error.type).toBe('invalid_request_error');
        expect(error.eventId).toBe('evt_123');
      });
    });
  });

  describe('Callback Registration', () => {
    it('onResponse should register and unregister callback', () => {
      const callback = jest.fn();
      const unsubscribe = client.onResponse(callback);

      const testEvent: AudioResponseEvent = {
        audioData: 'test',
        responseId: 'resp_1',
        itemId: 'item_1',
        contentIndex: 0,
      };

      client.emit('audioResponse', testEvent);
      expect(callback).toHaveBeenCalledWith(testEvent);

      unsubscribe();
      client.emit('audioResponse', testEvent);
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('onTranscript should register and unregister callback', () => {
      const callback = jest.fn();
      const unsubscribe = client.onTranscript(callback);

      const testEvent: TranscriptEvent = {
        type: 'input',
        text: 'Hello',
        isFinal: true,
      };

      client.emit('transcript', testEvent);
      expect(callback).toHaveBeenCalledWith(testEvent);

      unsubscribe();
      client.emit('transcript', testEvent);
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('onError should register and unregister callback', () => {
      const callback = jest.fn();
      const unsubscribe = client.onError(callback);

      const testError = new OpenAIRealtimeError('Test error', 'TEST', 'test');

      client.emit('error', testError);
      expect(callback).toHaveBeenCalledWith(testError);

      // Re-register a dummy listener to prevent unhandled error after unsubscribe
      const dummyListener = jest.fn();
      client.on('error', dummyListener);

      unsubscribe();
      client.emit('error', testError);
      expect(callback).toHaveBeenCalledTimes(1);
      expect(dummyListener).toHaveBeenCalledTimes(1);

      // Clean up
      client.off('error', dummyListener);
    });

    it('onDisconnect should register and unregister callback', () => {
      const callback = jest.fn();
      const unsubscribe = client.onDisconnect(callback);

      client.emit('disconnect', 'Test reason');
      expect(callback).toHaveBeenCalledWith('Test reason');

      unsubscribe();
      client.emit('disconnect', 'Test reason 2');
      expect(callback).toHaveBeenCalledTimes(1);
    });
  });

  describe('Connection Lifecycle', () => {
    beforeEach(() => {
      process.env.OPENAI_API_KEY = 'test-api-key';
    });

    it('should handle WebSocket close event', async () => {
      const connectPromise = client.connect();
      setImmediate(() => mockWsInstance.emit('open'));
      await connectPromise;

      const disconnectHandler = jest.fn();
      client.on('disconnect', disconnectHandler);

      // Simulate unexpected close
      mockWsInstance.emit('close', 1006, Buffer.from('Connection lost'));

      // Give reconnection logic a chance to run
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(client.getState()).toBe(ConnectionState.RECONNECTING);
    });

    it('should handle WebSocket error event', async () => {
      const connectPromise = client.connect();
      setImmediate(() => mockWsInstance.emit('open'));
      await connectPromise;

      const errorHandler = jest.fn();
      client.on('error', errorHandler);

      mockWsInstance.emit('error', new Error('Connection error'));

      expect(errorHandler).toHaveBeenCalled();
    });

    it('should handle clean close (code 1000)', async () => {
      const connectPromise = client.connect();
      setImmediate(() => mockWsInstance.emit('open'));
      await connectPromise;

      const disconnectHandler = jest.fn();
      client.on('disconnect', disconnectHandler);

      mockWsInstance.emit('close', 1000, Buffer.from('Normal closure'));

      expect(client.getState()).toBe(ConnectionState.DISCONNECTED);
      expect(disconnectHandler).toHaveBeenCalledWith('Normal closure');
    });
  });

  describe('OpenAIRealtimeError', () => {
    it('should create error with all properties', () => {
      const error = new OpenAIRealtimeError('Test message', 'TEST_CODE', 'test_type', 'evt_123');

      expect(error.message).toBe('Test message');
      expect(error.code).toBe('TEST_CODE');
      expect(error.type).toBe('test_type');
      expect(error.eventId).toBe('evt_123');
      expect(error.name).toBe('OpenAIRealtimeError');
    });

    it('should be instanceof Error', () => {
      const error = new OpenAIRealtimeError('Test', 'CODE', 'type');
      expect(error).toBeInstanceOf(Error);
    });
  });

  describe('createEarlClient()', () => {
    beforeEach(() => {
      process.env.OPENAI_API_KEY = 'test-api-key';
    });

    it('should create a client with Earl configuration', () => {
      const earlClient = createEarlClient();
      expect(earlClient).toBeInstanceOf(OpenAIRealtimeClient);
    });

    it('should use Earl defaults when connecting', async () => {
      const earlClient = createEarlClient();
      const connectPromise = earlClient.connect();

      setImmediate(() => mockWsInstance.emit('open'));
      await connectPromise;

      const sentEvent = JSON.parse(mockWsInstance.send.mock.calls[0][0] as string);
      expect(sentEvent.session.voice).toBe('ash');
      expect(sentEvent.session.instructions).toBe(EARL_SYSTEM_PROMPT);
      expect(sentEvent.session.input_audio_format).toBe('g711_ulaw');
      expect(sentEvent.session.output_audio_format).toBe('g711_ulaw');
      expect(sentEvent.session.temperature).toBe(0.8);

      earlClient.disconnect();
    });

    it('should allow overriding Earl defaults', async () => {
      const earlClient = createEarlClient({ voice: 'coral', temperature: 0.5 });
      const connectPromise = earlClient.connect();

      setImmediate(() => mockWsInstance.emit('open'));
      await connectPromise;

      const sentEvent = JSON.parse(mockWsInstance.send.mock.calls[0][0] as string);
      expect(sentEvent.session.voice).toBe('coral');
      expect(sentEvent.session.temperature).toBe(0.5);
      // Should still use Earl's system prompt
      expect(sentEvent.session.instructions).toBe(EARL_SYSTEM_PROMPT);

      earlClient.disconnect();
    });
  });

  describe('ConnectionState enum', () => {
    it('should have all expected states', () => {
      expect(ConnectionState.DISCONNECTED).toBe('disconnected');
      expect(ConnectionState.CONNECTING).toBe('connecting');
      expect(ConnectionState.CONNECTED).toBe('connected');
      expect(ConnectionState.RECONNECTING).toBe('reconnecting');
      expect(ConnectionState.ERROR).toBe('error');
    });
  });
});
