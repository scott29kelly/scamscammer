/**
 * Tests for OpenAI Realtime Voice Client
 */

import { EventEmitter } from 'events';
import WebSocket from 'ws';
import {
  OpenAIRealtimeClient,
  OpenAIRealtimeClientError,
  createEarlClient,
  createRealtimeClient,
  ConnectionState,
} from '../openai';
import { EARL_SYSTEM_PROMPT } from '../persona';

// Mock WebSocket
jest.mock('ws');

const MockWebSocket = WebSocket as jest.MockedClass<typeof WebSocket>;

describe('OpenAIRealtimeClient', () => {
  let client: OpenAIRealtimeClient;
  let mockWs: jest.Mocked<WebSocket>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mock WebSocket instance
    mockWs = new EventEmitter() as jest.Mocked<WebSocket>;
    mockWs.send = jest.fn();
    mockWs.close = jest.fn();
    Object.defineProperty(mockWs, 'readyState', {
      value: WebSocket.OPEN,
      writable: true,
      configurable: true,
    });
    mockWs.removeAllListeners = jest.fn();

    MockWebSocket.mockImplementation(() => mockWs);

    client = new OpenAIRealtimeClient('test-api-key');
  });

  afterEach(() => {
    client.disconnect();
  });

  describe('constructor', () => {
    it('should create client with default configuration', () => {
      const newClient = new OpenAIRealtimeClient('test-key');
      expect(newClient.getState()).toBe('disconnected');
      expect(newClient.getSessionId()).toBeNull();
    });

    it('should create client with custom configuration', () => {
      const newClient = new OpenAIRealtimeClient('test-key', {
        voice: 'shimmer',
        temperature: 0.5,
        inputAudioFormat: 'pcm16',
      });
      expect(newClient.getState()).toBe('disconnected');
    });

    it('should use environment variable if no API key provided', () => {
      const originalEnv = process.env.OPENAI_API_KEY;
      process.env.OPENAI_API_KEY = 'env-api-key';

      const newClient = new OpenAIRealtimeClient();
      expect(newClient).toBeInstanceOf(OpenAIRealtimeClient);

      process.env.OPENAI_API_KEY = originalEnv;
    });
  });

  describe('connect', () => {
    it('should connect to OpenAI Realtime API', async () => {
      const connectPromise = client.connect();

      // Simulate successful connection
      setTimeout(() => {
        mockWs.emit('open');
      }, 10);

      await connectPromise;

      expect(MockWebSocket).toHaveBeenCalledWith(
        expect.stringContaining('wss://api.openai.com/v1/realtime'),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-api-key',
            'OpenAI-Beta': 'realtime=v1',
          }),
        })
      );
      expect(client.getState()).toBe('connected');
    });

    it('should throw error if already connecting', async () => {
      const connectPromise = client.connect();

      // While first connection is in progress
      await expect(client.connect()).rejects.toThrow('Connection already in progress');

      // Clean up by simulating connection complete
      mockWs.emit('open');
      await connectPromise;
    });

    it('should not reconnect if already connected', async () => {
      const connectPromise = client.connect();
      mockWs.emit('open');
      await connectPromise;

      // Second connect should be a no-op
      await client.connect();
      expect(MockWebSocket).toHaveBeenCalledTimes(1);
    });

    it('should throw error if no API key', async () => {
      // Create a client with no API key and ensure env var is also unset
      const originalEnv = process.env.OPENAI_API_KEY;
      delete process.env.OPENAI_API_KEY;

      const noKeyClient = new OpenAIRealtimeClient('');

      try {
        await expect(noKeyClient.connect()).rejects.toThrow('OpenAI API key is required');
      } finally {
        // Restore env var
        if (originalEnv) {
          process.env.OPENAI_API_KEY = originalEnv;
        }
      }
    });

    it('should configure session after connection', async () => {
      const connectPromise = client.connect();
      mockWs.emit('open');
      await connectPromise;

      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"session.update"')
      );
    });

    it('should emit stateChange event', async () => {
      const stateChanges: ConnectionState[] = [];
      client.on('stateChange', (state: ConnectionState) => stateChanges.push(state));

      const connectPromise = client.connect();
      mockWs.emit('open');
      await connectPromise;

      expect(stateChanges).toContain('connecting');
      expect(stateChanges).toContain('connected');
    });

    it('should reject on connection error', async () => {
      // Add an error listener to prevent unhandled error
      client.on('error', () => {});

      const connectPromise = client.connect();

      // Emit error synchronously after promise is set up
      process.nextTick(() => {
        mockWs.emit('error', new Error('Connection failed'));
      });

      await expect(connectPromise).rejects.toThrow('Connection failed');
    });

    it('should reject on WebSocket close during connection', async () => {
      const connectPromise = client.connect();

      setTimeout(() => {
        mockWs.emit('close', 1006, Buffer.from('Connection closed unexpectedly'));
      }, 10);

      await expect(connectPromise).rejects.toThrow();
    });
  });

  describe('sendAudio', () => {
    beforeEach(async () => {
      const connectPromise = client.connect();
      mockWs.emit('open');
      await connectPromise;
    });

    it('should send audio buffer as base64', () => {
      const audioBuffer = Buffer.from('test audio data');
      client.sendAudio(audioBuffer);

      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"input_audio_buffer.append"')
      );
      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining(audioBuffer.toString('base64'))
      );
    });

    it('should send base64 string directly', () => {
      const base64Audio = 'dGVzdCBhdWRpbyBkYXRh';
      client.sendAudio(base64Audio);

      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining(base64Audio)
      );
    });

    it('should throw if not connected', () => {
      const disconnectedClient = new OpenAIRealtimeClient('test-key');
      expect(() => disconnectedClient.sendAudio(Buffer.from('test'))).toThrow(
        'Cannot send audio: not connected'
      );
    });
  });

  describe('commitAudioBuffer', () => {
    beforeEach(async () => {
      const connectPromise = client.connect();
      mockWs.emit('open');
      await connectPromise;
    });

    it('should commit audio buffer', () => {
      client.commitAudioBuffer();

      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"input_audio_buffer.commit"')
      );
    });

    it('should throw if not connected', () => {
      const disconnectedClient = new OpenAIRealtimeClient('test-key');
      expect(() => disconnectedClient.commitAudioBuffer()).toThrow(
        'Cannot commit audio: not connected'
      );
    });
  });

  describe('clearAudioBuffer', () => {
    beforeEach(async () => {
      const connectPromise = client.connect();
      mockWs.emit('open');
      await connectPromise;
    });

    it('should clear audio buffer', () => {
      client.clearAudioBuffer();

      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"input_audio_buffer.clear"')
      );
    });

    it('should not throw if not connected', () => {
      const disconnectedClient = new OpenAIRealtimeClient('test-key');
      expect(() => disconnectedClient.clearAudioBuffer()).not.toThrow();
    });
  });

  describe('onResponse', () => {
    beforeEach(async () => {
      const connectPromise = client.connect();
      mockWs.emit('open');
      await connectPromise;
    });

    it('should register callback and receive audio events', () => {
      const callback = jest.fn();
      client.onResponse(callback);

      // Simulate audio response
      mockWs.emit(
        'message',
        JSON.stringify({
          type: 'response.audio.delta',
          response_id: 'resp_1',
          item_id: 'item_1',
          output_index: 0,
          content_index: 0,
          delta: 'base64audiodata',
        })
      );

      expect(callback).toHaveBeenCalledWith({
        type: 'audio',
        audio: 'base64audiodata',
        responseId: 'resp_1',
        itemId: 'item_1',
      });
    });

    it('should register callback and receive transcript events', () => {
      const callback = jest.fn();
      client.onResponse(callback);

      // Simulate transcript response
      mockWs.emit(
        'message',
        JSON.stringify({
          type: 'response.audio_transcript.delta',
          response_id: 'resp_1',
          item_id: 'item_1',
          output_index: 0,
          content_index: 0,
          delta: 'Hello, ',
        })
      );

      expect(callback).toHaveBeenCalledWith({
        type: 'transcript',
        text: 'Hello, ',
        responseId: 'resp_1',
        itemId: 'item_1',
        isFinal: false,
      });
    });

    it('should return unsubscribe function', () => {
      const callback = jest.fn();
      const unsubscribe = client.onResponse(callback);

      unsubscribe();

      // Simulate audio response after unsubscribe
      mockWs.emit(
        'message',
        JSON.stringify({
          type: 'response.audio.delta',
          response_id: 'resp_1',
          item_id: 'item_1',
          delta: 'data',
        })
      );

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('setSystemPrompt', () => {
    it('should update session config when not connected', () => {
      const newPrompt = 'You are a helpful assistant.';
      client.setSystemPrompt(newPrompt);

      // Should not throw, just store for later
      expect(client.getState()).toBe('disconnected');
    });

    it('should send session update when connected', async () => {
      const connectPromise = client.connect();
      mockWs.emit('open');
      await connectPromise;

      jest.clearAllMocks();

      const newPrompt = 'You are a helpful assistant.';
      client.setSystemPrompt(newPrompt);

      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"session.update"')
      );
      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining(newPrompt)
      );
    });
  });

  describe('updateSession', () => {
    beforeEach(async () => {
      const connectPromise = client.connect();
      mockWs.emit('open');
      await connectPromise;
      jest.clearAllMocks();
    });

    it('should update voice', () => {
      client.updateSession({ voice: 'shimmer' });

      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"voice":"shimmer"')
      );
    });

    it('should update temperature', () => {
      client.updateSession({ temperature: 0.5 });

      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"temperature":0.5')
      );
    });

    it('should update turn detection', () => {
      client.updateSession({
        turnDetection: {
          type: 'server_vad',
          threshold: 0.7,
          silenceDurationMs: 1000,
        },
      });

      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"turn_detection"')
      );
    });
  });

  describe('disconnect', () => {
    it('should disconnect and emit event', async () => {
      const connectPromise = client.connect();
      mockWs.emit('open');
      await connectPromise;

      const disconnectHandler = jest.fn();
      client.on('disconnect', disconnectHandler);

      client.disconnect('test_reason');

      expect(client.getState()).toBe('disconnected');
      expect(disconnectHandler).toHaveBeenCalledWith('test_reason');
    });

    it('should close WebSocket', async () => {
      const connectPromise = client.connect();
      mockWs.emit('open');
      await connectPromise;

      client.disconnect();

      expect(mockWs.close).toHaveBeenCalledWith(1000, 'Client disconnect');
    });

    it('should clear session state', async () => {
      const connectPromise = client.connect();
      mockWs.emit('open');
      await connectPromise;

      // Simulate session created
      mockWs.emit(
        'message',
        JSON.stringify({
          type: 'session.created',
          session: { id: 'sess_123' },
        })
      );

      expect(client.getSessionId()).toBe('sess_123');

      client.disconnect();

      expect(client.getSessionId()).toBeNull();
    });
  });

  describe('createResponse', () => {
    beforeEach(async () => {
      const connectPromise = client.connect();
      mockWs.emit('open');
      await connectPromise;
      jest.clearAllMocks();
    });

    it('should send response.create event', () => {
      client.createResponse();

      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"response.create"')
      );
    });

    it('should throw if not connected', () => {
      const disconnectedClient = new OpenAIRealtimeClient('test-key');
      expect(() => disconnectedClient.createResponse()).toThrow(
        'Cannot create response: not connected'
      );
    });
  });

  describe('event handling', () => {
    beforeEach(async () => {
      const connectPromise = client.connect();
      mockWs.emit('open');
      await connectPromise;
    });

    it('should emit sessionCreated on session.created', () => {
      const sessionHandler = jest.fn();
      client.on('sessionCreated', sessionHandler);

      mockWs.emit(
        'message',
        JSON.stringify({
          type: 'session.created',
          session: { id: 'sess_123', voice: 'alloy' },
        })
      );

      expect(sessionHandler).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'sess_123' })
      );
    });

    it('should emit speechStarted on voice activity', () => {
      const speechHandler = jest.fn();
      client.on('speechStarted', speechHandler);

      mockWs.emit(
        'message',
        JSON.stringify({
          type: 'input_audio_buffer.speech_started',
        })
      );

      expect(speechHandler).toHaveBeenCalled();
    });

    it('should emit speechStopped on silence', () => {
      const speechHandler = jest.fn();
      client.on('speechStopped', speechHandler);

      mockWs.emit(
        'message',
        JSON.stringify({
          type: 'input_audio_buffer.speech_stopped',
        })
      );

      expect(speechHandler).toHaveBeenCalled();
    });

    it('should emit inputTranscript for user speech', () => {
      const transcriptHandler = jest.fn();
      client.on('inputTranscript', transcriptHandler);

      mockWs.emit(
        'message',
        JSON.stringify({
          type: 'conversation.item.input_audio_transcription.completed',
          item_id: 'item_123',
          transcript: 'Hello there',
        })
      );

      expect(transcriptHandler).toHaveBeenCalledWith({
        text: 'Hello there',
        itemId: 'item_123',
      });
    });

    it('should emit responseComplete on response.done', () => {
      const responseHandler = jest.fn();
      client.on('responseComplete', responseHandler);

      mockWs.emit(
        'message',
        JSON.stringify({
          type: 'response.done',
          response: { id: 'resp_123', status: 'completed' },
        })
      );

      expect(responseHandler).toHaveBeenCalledWith({
        responseId: 'resp_123',
        status: 'completed',
      });
    });

    it('should emit error on error event', () => {
      const errorHandler = jest.fn();
      client.on('error', errorHandler);

      mockWs.emit(
        'message',
        JSON.stringify({
          type: 'error',
          error: {
            type: 'invalid_request_error',
            code: 'invalid_audio',
            message: 'Invalid audio format',
          },
        })
      );

      expect(errorHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'invalid_audio',
          message: 'Invalid audio format',
        })
      );
    });

    it('should emit rawEvent for all events', () => {
      const rawHandler = jest.fn();
      client.on('rawEvent', rawHandler);

      mockWs.emit(
        'message',
        JSON.stringify({
          type: 'rate_limits.updated',
          rate_limits: { requests: 100 },
        })
      );

      expect(rawHandler).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'rate_limits.updated' })
      );
    });

    it('should handle transcript accumulation', () => {
      const transcriptHandler = jest.fn();
      client.on('transcript', transcriptHandler);

      // Send partial transcript
      mockWs.emit(
        'message',
        JSON.stringify({
          type: 'response.audio_transcript.delta',
          response_id: 'resp_1',
          item_id: 'item_1',
          delta: 'Hello, ',
        })
      );

      mockWs.emit(
        'message',
        JSON.stringify({
          type: 'response.audio_transcript.delta',
          response_id: 'resp_1',
          item_id: 'item_1',
          delta: 'how are you?',
        })
      );

      // Send final transcript
      mockWs.emit(
        'message',
        JSON.stringify({
          type: 'response.audio_transcript.done',
          response_id: 'resp_1',
          item_id: 'item_1',
        })
      );

      // Check final call has accumulated text
      const finalCall = transcriptHandler.mock.calls.find(
        (call) => call[0].isFinal === true
      );
      expect(finalCall).toBeDefined();
      expect(finalCall[0].text).toBe('Hello, how are you?');
    });

    it('should handle parse errors gracefully', () => {
      const errorHandler = jest.fn();
      client.on('error', errorHandler);

      mockWs.emit('message', 'not valid json');

      expect(errorHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'parse_error',
        })
      );
    });
  });

  describe('reconnection', () => {
    it('should attempt reconnection on unexpected disconnect', async () => {
      const connectPromise = client.connect();
      mockWs.emit('open');
      await connectPromise;

      const stateHandler = jest.fn();
      client.on('stateChange', stateHandler);

      mockWs.emit('close', 1006, Buffer.from('Connection lost'));

      expect(stateHandler).toHaveBeenCalledWith('reconnecting');
    });

    it('should schedule reconnection with delay after disconnect', async () => {
      jest.useFakeTimers();

      const connectPromise = client.connect();
      mockWs.emit('open');
      await connectPromise;

      // Disconnect
      mockWs.emit('close', 1006, Buffer.from('Connection lost'));

      // Verify no immediate reconnection
      expect(MockWebSocket).toHaveBeenCalledTimes(1);

      // Advance time past initial reconnect delay
      jest.advanceTimersByTime(1000);

      // Now reconnection should have been attempted
      expect(MockWebSocket).toHaveBeenCalledTimes(2);

      jest.useRealTimers();
    });
  });

  describe('isConnected', () => {
    it('should return false when disconnected', () => {
      expect(client.isConnected()).toBe(false);
    });

    it('should return true when connected', async () => {
      const connectPromise = client.connect();
      mockWs.emit('open');
      await connectPromise;

      expect(client.isConnected()).toBe(true);
    });

    it('should return false when WebSocket is not open', async () => {
      const connectPromise = client.connect();
      mockWs.emit('open');
      await connectPromise;

      Object.defineProperty(mockWs, 'readyState', {
        value: WebSocket.CLOSING,
        writable: true,
        configurable: true,
      });

      expect(client.isConnected()).toBe(false);
    });
  });
});

describe('OpenAIRealtimeClientError', () => {
  it('should create error with all properties', () => {
    const error = new OpenAIRealtimeClientError(
      'Test error',
      'test_code',
      'test_type',
      'test_param'
    );

    expect(error.message).toBe('Test error');
    expect(error.code).toBe('test_code');
    expect(error.type).toBe('test_type');
    expect(error.param).toBe('test_param');
    expect(error.name).toBe('OpenAIRealtimeClientError');
  });

  it('should mark connection errors as retryable', () => {
    const error = new OpenAIRealtimeClientError(
      'Connection failed',
      'connection_error',
      'client_error'
    );

    expect(error.isRetryable).toBe(true);
  });

  it('should mark rate limit errors as retryable', () => {
    const error = new OpenAIRealtimeClientError(
      'Rate limited',
      'rate_limit_exceeded',
      'rate_limit_error'
    );

    expect(error.isRetryable).toBe(true);
  });

  it('should mark invalid request errors as not retryable', () => {
    const error = new OpenAIRealtimeClientError(
      'Invalid request',
      'invalid_request',
      'invalid_request_error'
    );

    expect(error.isRetryable).toBe(false);
  });
});

describe('createEarlClient', () => {
  it('should create client with Earl persona configuration', () => {
    const earlClient = createEarlClient('test-key');

    expect(earlClient).toBeInstanceOf(OpenAIRealtimeClient);
    expect(earlClient.getState()).toBe('disconnected');
  });

  it('should use EARL_SYSTEM_PROMPT', async () => {
    const earlClient = createEarlClient('test-key');

    const connectPromise = earlClient.connect();

    // Get the mock instance
    const mockInstance = MockWebSocket.mock.results[0].value;
    mockInstance.emit('open');

    await connectPromise;

    // Verify EARL_SYSTEM_PROMPT was used in session config
    expect(mockInstance.send).toHaveBeenCalledWith(
      expect.stringContaining('Earl Pemberton')
    );

    earlClient.disconnect();
  });
});

describe('createRealtimeClient', () => {
  it('should create client with default configuration', () => {
    const realtimeClient = createRealtimeClient('test-key');

    expect(realtimeClient).toBeInstanceOf(OpenAIRealtimeClient);
  });

  it('should create client with custom configuration', () => {
    const realtimeClient = createRealtimeClient('test-key', {
      voice: 'shimmer',
      temperature: 0.3,
    });

    expect(realtimeClient).toBeInstanceOf(OpenAIRealtimeClient);
  });
});
