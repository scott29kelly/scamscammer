/**
 * OpenAI Realtime Voice Client
 *
 * This module provides a WebSocket client for the OpenAI Realtime API,
 * enabling real-time voice conversations with the Earl AI persona.
 */

import { EventEmitter } from 'events';
import WebSocket from 'ws';
import { EARL_SYSTEM_PROMPT } from './persona';

// =============================================================================
// Types
// =============================================================================

/**
 * Audio format configuration
 */
export type AudioFormat = 'pcm16' | 'g711_ulaw' | 'g711_alaw';

/**
 * Turn detection configuration for voice activity detection
 */
export interface TurnDetectionConfig {
  type: 'server_vad';
  threshold?: number;
  prefixPaddingMs?: number;
  silenceDurationMs?: number;
}

/**
 * Connection state of the realtime client
 */
export type ConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'error';

/**
 * Options for connecting to the OpenAI Realtime API
 */
export interface ConnectOptions {
  apiKey?: string;
  sessionConfig?: Partial<SessionConfig>;
}

/**
 * Session configuration for OpenAI Realtime
 */
export interface SessionConfig {
  model: string;
  voice: string;
  instructions: string;
  inputAudioFormat: AudioFormat;
  outputAudioFormat: AudioFormat;
  turnDetection: TurnDetectionConfig | null;
  temperature: number;
  maxResponseOutputTokens: number | 'inf';
  inputAudioTranscription: { model: 'whisper-1' } | null;
}

/**
 * Custom error class for OpenAI Realtime client errors
 */
export class OpenAIRealtimeClientError extends Error {
  public readonly code: string;
  public readonly type: string;
  public readonly param?: string;
  public readonly isRetryable: boolean;

  constructor(
    message: string,
    code: string = 'unknown_error',
    type: string = 'client_error',
    param?: string
  ) {
    super(message);
    this.name = 'OpenAIRealtimeClientError';
    this.code = code;
    this.type = type;
    this.param = param;
    this.isRetryable = this.determineRetryability(code, type);
  }

  private determineRetryability(code: string, type: string): boolean {
    const retryableCodes = [
      'connection_error',
      'timeout',
      'server_error',
      'rate_limit_exceeded',
    ];
    const retryableTypes = ['server_error', 'rate_limit_error'];
    return retryableCodes.includes(code) || retryableTypes.includes(type);
  }
}

// =============================================================================
// Constants
// =============================================================================

const OPENAI_REALTIME_URL = 'wss://api.openai.com/v1/realtime';
const DEFAULT_MODEL = 'gpt-4o-realtime-preview-2024-10-01';
const DEFAULT_VOICE = 'alloy';
const DEFAULT_TEMPERATURE = 0.8;
const DEFAULT_MAX_TOKENS = 4096;

const DEFAULT_TURN_DETECTION: TurnDetectionConfig = {
  type: 'server_vad',
  threshold: 0.5,
  prefixPaddingMs: 300,
  silenceDurationMs: 500,
};

const MAX_RECONNECT_ATTEMPTS = 5;
const INITIAL_RECONNECT_DELAY_MS = 1000;
const MAX_RECONNECT_DELAY_MS = 30000;
const CONNECTION_TIMEOUT_MS = 30000;

// =============================================================================
// OpenAIRealtimeClient Class
// =============================================================================

/**
 * Client for OpenAI Realtime API WebSocket connections.
 *
 * Manages bidirectional audio streaming for real-time voice conversations.
 *
 * @example
 * ```typescript
 * const client = new OpenAIRealtimeClient(process.env.OPENAI_API_KEY);
 *
 * client.on('audio', (data) => {
 *   // Send audio to Twilio
 *   twilioStream.send(data.audio);
 * });
 *
 * client.on('transcript', (data) => {
 *   console.log('Earl said:', data.text);
 * });
 *
 * await client.connect();
 * client.sendAudio(audioChunk);
 * ```
 */
export class OpenAIRealtimeClient extends EventEmitter {
  private apiKey: string;
  private ws: WebSocket | null = null;
  private connectionState: ConnectionState = 'disconnected';
  private sessionConfig: SessionConfig;
  private reconnectAttempts = 0;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private connectionTimeout: ReturnType<typeof setTimeout> | null = null;
  private pendingMessages: string[] = [];
  private sessionId: string | null = null;
  private currentTranscript: Map<string, string> = new Map();

  constructor(apiKey?: string, config?: Partial<SessionConfig>) {
    super();
    this.apiKey = apiKey || process.env.OPENAI_API_KEY || '';

    this.sessionConfig = {
      model: config?.model || DEFAULT_MODEL,
      voice: config?.voice || DEFAULT_VOICE,
      instructions: config?.instructions || EARL_SYSTEM_PROMPT,
      inputAudioFormat: config?.inputAudioFormat || 'g711_ulaw',
      outputAudioFormat: config?.outputAudioFormat || 'g711_ulaw',
      turnDetection: config?.turnDetection ?? DEFAULT_TURN_DETECTION,
      temperature: config?.temperature ?? DEFAULT_TEMPERATURE,
      maxResponseOutputTokens: config?.maxResponseOutputTokens || DEFAULT_MAX_TOKENS,
      inputAudioTranscription: config?.inputAudioTranscription ?? { model: 'whisper-1' },
    };
  }

  // ===========================================================================
  // Public Methods
  // ===========================================================================

  public getState(): ConnectionState {
    return this.connectionState;
  }

  public getSessionId(): string | null {
    return this.sessionId;
  }

  public isConnected(): boolean {
    return this.connectionState === 'connected' && this.ws?.readyState === WebSocket.OPEN;
  }

  public async connect(options?: ConnectOptions): Promise<void> {
    if (this.connectionState === 'connected') {
      return;
    }

    if (this.connectionState === 'connecting') {
      throw new OpenAIRealtimeClientError(
        'Connection already in progress',
        'connection_in_progress',
        'client_error'
      );
    }

    const apiKey = options?.apiKey || this.apiKey;
    if (!apiKey) {
      throw new OpenAIRealtimeClientError(
        'OpenAI API key is required',
        'missing_api_key',
        'client_error'
      );
    }
    this.apiKey = apiKey;

    if (options?.sessionConfig) {
      this.sessionConfig = { ...this.sessionConfig, ...options.sessionConfig };
    }

    this.setState('connecting');
    this.reconnectAttempts = 0;

    try {
      await this.establishConnection();
    } catch (error) {
      this.setState('error');
      throw error;
    }
  }

  public sendAudio(audioChunk: Buffer | string): void {
    if (!this.isConnected()) {
      throw new OpenAIRealtimeClientError(
        'Cannot send audio: not connected',
        'not_connected',
        'client_error'
      );
    }

    const base64Audio = Buffer.isBuffer(audioChunk)
      ? audioChunk.toString('base64')
      : audioChunk;

    this.sendEvent({
      type: 'input_audio_buffer.append',
      audio: base64Audio,
    });
  }

  public commitAudioBuffer(): void {
    if (!this.isConnected()) {
      throw new OpenAIRealtimeClientError(
        'Cannot commit audio: not connected',
        'not_connected',
        'client_error'
      );
    }

    this.sendEvent({ type: 'input_audio_buffer.commit' });
  }

  public clearAudioBuffer(): void {
    if (!this.isConnected()) {
      return;
    }

    this.sendEvent({ type: 'input_audio_buffer.clear' });
  }

  public onResponse(
    callback: (data: {
      type: 'audio' | 'transcript';
      audio?: string;
      text?: string;
      responseId: string;
      itemId: string;
      isFinal?: boolean;
    }) => void
  ): () => void {
    const audioHandler = (data: { audio: string; responseId: string; itemId: string }) => {
      callback({ type: 'audio', ...data });
    };

    const transcriptHandler = (data: {
      text: string;
      responseId: string;
      itemId: string;
      isFinal: boolean;
    }) => {
      callback({ type: 'transcript', ...data });
    };

    this.on('audio', audioHandler);
    this.on('transcript', transcriptHandler);

    return () => {
      this.off('audio', audioHandler);
      this.off('transcript', transcriptHandler);
    };
  }

  public setSystemPrompt(prompt: string): void {
    this.sessionConfig.instructions = prompt;

    if (this.isConnected()) {
      this.updateSession({ instructions: prompt });
    }
  }

  public updateSession(config: Partial<SessionConfig>): void {
    if (!this.isConnected()) {
      this.sessionConfig = { ...this.sessionConfig, ...config };
      return;
    }

    const updatePayload: Record<string, unknown> = {
      type: 'session.update',
      session: {},
    };

    const session = updatePayload.session as Record<string, unknown>;

    if (config.instructions !== undefined) {
      session.instructions = config.instructions;
    }
    if (config.voice !== undefined) {
      session.voice = config.voice;
    }
    if (config.temperature !== undefined) {
      session.temperature = config.temperature;
    }
    if (config.maxResponseOutputTokens !== undefined) {
      session.max_response_output_tokens = config.maxResponseOutputTokens;
    }
    if (config.turnDetection !== undefined) {
      session.turn_detection = config.turnDetection;
    }
    if (config.inputAudioTranscription !== undefined) {
      session.input_audio_transcription = config.inputAudioTranscription;
    }

    this.sessionConfig = { ...this.sessionConfig, ...config };
    this.sendEvent(updatePayload);
  }

  public disconnect(reason: string = 'client_requested'): void {
    this.cleanup();
    this.setState('disconnected');
    this.emit('disconnect', reason);
  }

  public createResponse(): void {
    if (!this.isConnected()) {
      throw new OpenAIRealtimeClientError(
        'Cannot create response: not connected',
        'not_connected',
        'client_error'
      );
    }

    this.sendEvent({ type: 'response.create' });
  }

  public cancelResponse(): void {
    if (!this.isConnected()) {
      return;
    }

    this.sendEvent({ type: 'response.cancel' });
  }

  public addConversationItem(item: {
    type: 'message';
    role: 'user' | 'assistant' | 'system';
    content: Array<{
      type: 'input_text' | 'input_audio' | 'text';
      text?: string;
      audio?: string;
    }>;
  }): void {
    if (!this.isConnected()) {
      throw new OpenAIRealtimeClientError(
        'Cannot add item: not connected',
        'not_connected',
        'client_error'
      );
    }

    this.sendEvent({
      type: 'conversation.item.create',
      item,
    });
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  private setState(state: ConnectionState): void {
    if (this.connectionState !== state) {
      this.connectionState = state;
      this.emit('stateChange', state);
    }
  }

  private async establishConnection(): Promise<void> {
    return new Promise((resolve, reject) => {
      const url = `${OPENAI_REALTIME_URL}?model=${this.sessionConfig.model}`;

      this.ws = new WebSocket(url, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'OpenAI-Beta': 'realtime=v1',
        },
      });

      this.connectionTimeout = setTimeout(() => {
        if (this.connectionState === 'connecting') {
          this.ws?.close();
          reject(
            new OpenAIRealtimeClientError(
              'Connection timeout',
              'timeout',
              'connection_error'
            )
          );
        }
      }, CONNECTION_TIMEOUT_MS);

      this.ws.on('open', () => {
        this.clearConnectionTimeout();
        this.setState('connected');
        this.reconnectAttempts = 0;
        this.configureSession();
        this.flushPendingMessages();
        resolve();
      });

      this.ws.on('message', (data: WebSocket.Data) => {
        this.handleMessage(data);
      });

      this.ws.on('error', (error: Error) => {
        this.clearConnectionTimeout();
        const clientError = new OpenAIRealtimeClientError(
          error.message,
          'connection_error',
          'websocket_error'
        );
        this.emit('error', clientError);

        if (this.connectionState === 'connecting') {
          reject(clientError);
        }
      });

      this.ws.on('close', (code: number, reason: Buffer) => {
        this.clearConnectionTimeout();
        const reasonStr = reason.toString() || `WebSocket closed with code ${code}`;

        if (this.connectionState === 'connecting') {
          reject(
            new OpenAIRealtimeClientError(
              reasonStr,
              'connection_closed',
              'websocket_error'
            )
          );
        } else if (this.connectionState === 'connected') {
          this.handleUnexpectedDisconnect(reasonStr);
        }
      });
    });
  }

  private configureSession(): void {
    const sessionUpdate: Record<string, unknown> = {
      type: 'session.update',
      session: {
        modalities: ['text', 'audio'],
        instructions: this.sessionConfig.instructions,
        voice: this.sessionConfig.voice,
        input_audio_format: this.sessionConfig.inputAudioFormat,
        output_audio_format: this.sessionConfig.outputAudioFormat,
        turn_detection: this.sessionConfig.turnDetection,
        temperature: this.sessionConfig.temperature,
        max_response_output_tokens: this.sessionConfig.maxResponseOutputTokens,
      },
    };

    if (this.sessionConfig.inputAudioTranscription) {
      (sessionUpdate.session as Record<string, unknown>).input_audio_transcription =
        this.sessionConfig.inputAudioTranscription;
    }

    this.sendEvent(sessionUpdate);
  }

  private handleMessage(data: WebSocket.Data): void {
    try {
      const event = JSON.parse(data.toString()) as Record<string, unknown>;
      this.emit('rawEvent', event);

      switch (event.type) {
        case 'session.created':
        case 'session.updated':
          this.handleSessionEvent(event);
          break;

        case 'response.audio.delta':
          this.handleAudioDelta(event);
          break;

        case 'response.audio_transcript.delta':
          this.handleTranscriptDelta(event);
          break;

        case 'response.audio_transcript.done':
          this.handleTranscriptDone(event);
          break;

        case 'input_audio_buffer.speech_started':
          this.emit('speechStarted');
          break;

        case 'input_audio_buffer.speech_stopped':
          this.emit('speechStopped');
          break;

        case 'conversation.item.input_audio_transcription.completed':
          this.handleInputTranscript(event);
          break;

        case 'response.done':
          this.handleResponseDone(event);
          break;

        case 'error':
          this.handleErrorEvent(event);
          break;

        case 'rate_limits.updated':
          // Log rate limits for monitoring
          break;

        default:
          // Other events can be handled by rawEvent listeners
          break;
      }
    } catch (error) {
      const parseError = new OpenAIRealtimeClientError(
        `Failed to parse message: ${error instanceof Error ? error.message : 'unknown error'}`,
        'parse_error',
        'client_error'
      );
      this.emit('error', parseError);
    }
  }

  private handleSessionEvent(event: Record<string, unknown>): void {
    if (event.session) {
      const session = event.session as Record<string, unknown>;
      if (session.id) {
        this.sessionId = session.id as string;
      }
      this.emit('sessionCreated', session);
    }
  }

  private handleAudioDelta(event: Record<string, unknown>): void {
    this.emit('audio', {
      audio: event.delta as string,
      responseId: event.response_id as string,
      itemId: event.item_id as string,
    });
  }

  private handleTranscriptDelta(event: Record<string, unknown>): void {
    const key = `${event.response_id}:${event.item_id}`;
    const existing = this.currentTranscript.get(key) || '';
    this.currentTranscript.set(key, existing + (event.delta as string));

    this.emit('transcript', {
      text: event.delta as string,
      responseId: event.response_id as string,
      itemId: event.item_id as string,
      isFinal: false,
    });
  }

  private handleTranscriptDone(event: Record<string, unknown>): void {
    const key = `${event.response_id}:${event.item_id}`;
    const fullText = this.currentTranscript.get(key) || '';
    this.currentTranscript.delete(key);

    this.emit('transcript', {
      text: fullText,
      responseId: event.response_id as string,
      itemId: event.item_id as string,
      isFinal: true,
    });
  }

  private handleInputTranscript(event: Record<string, unknown>): void {
    if (event.transcript && event.item_id) {
      this.emit('inputTranscript', {
        text: event.transcript as string,
        itemId: event.item_id as string,
      });
    }
  }

  private handleResponseDone(event: Record<string, unknown>): void {
    if (event.response) {
      const response = event.response as Record<string, unknown>;
      this.emit('responseComplete', {
        responseId: (response.id as string) || '',
        status: (response.status as string) || 'completed',
      });
    }
  }

  private handleErrorEvent(event: Record<string, unknown>): void {
    const errorData = event.error as Record<string, unknown>;
    const error = new OpenAIRealtimeClientError(
      errorData.message as string,
      errorData.code as string,
      errorData.type as string,
      errorData.param as string | undefined
    );
    this.emit('error', error);

    if (error.isRetryable && this.connectionState === 'connected') {
      this.handleUnexpectedDisconnect(error.message);
    }
  }

  private handleUnexpectedDisconnect(reason: string): void {
    this.setState('reconnecting');

    if (this.reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
      const delay = Math.min(
        INITIAL_RECONNECT_DELAY_MS * Math.pow(2, this.reconnectAttempts),
        MAX_RECONNECT_DELAY_MS
      );

      this.reconnectAttempts++;

      this.reconnectTimeout = setTimeout(async () => {
        try {
          await this.establishConnection();
        } catch {
          if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
            this.setState('error');
            this.emit('disconnect', `Max reconnection attempts reached: ${reason}`);
          }
        }
      }, delay);
    } else {
      this.setState('error');
      this.emit('disconnect', `Max reconnection attempts reached: ${reason}`);
    }
  }

  private sendEvent(event: Record<string, unknown>): void {
    const message = JSON.stringify(event);

    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(message);
    } else {
      this.pendingMessages.push(message);
    }
  }

  private flushPendingMessages(): void {
    while (this.pendingMessages.length > 0 && this.ws?.readyState === WebSocket.OPEN) {
      const message = this.pendingMessages.shift();
      if (message) {
        this.ws.send(message);
      }
    }
  }

  private clearConnectionTimeout(): void {
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
      this.connectionTimeout = null;
    }
  }

  private cleanup(): void {
    this.clearConnectionTimeout();

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.ws) {
      this.ws.removeAllListeners();
      if (
        this.ws.readyState === WebSocket.OPEN ||
        this.ws.readyState === WebSocket.CONNECTING
      ) {
        this.ws.close(1000, 'Client disconnect');
      }
      this.ws = null;
    }

    this.sessionId = null;
    this.currentTranscript.clear();
    this.pendingMessages = [];
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create a new OpenAI Realtime client with Earl persona configuration.
 *
 * @param apiKey - OpenAI API key (optional, falls back to env var)
 * @returns Configured OpenAIRealtimeClient instance
 */
export function createEarlClient(apiKey?: string): OpenAIRealtimeClient {
  return new OpenAIRealtimeClient(apiKey, {
    instructions: EARL_SYSTEM_PROMPT,
    voice: 'echo', // Lower male voice works well for elderly character
    temperature: 0.9, // Higher temperature for more varied responses
    turnDetection: {
      type: 'server_vad',
      threshold: 0.6,
      prefixPaddingMs: 400,
      silenceDurationMs: 800, // Longer silence for elderly speech pattern
    },
  });
}

/**
 * Create a basic OpenAI Realtime client with default configuration.
 *
 * @param apiKey - OpenAI API key (optional, falls back to env var)
 * @param config - Optional partial session configuration
 * @returns Configured OpenAIRealtimeClient instance
 */
export function createRealtimeClient(
  apiKey?: string,
  config?: Partial<SessionConfig>
): OpenAIRealtimeClient {
  return new OpenAIRealtimeClient(apiKey, config);
}

export default OpenAIRealtimeClient;
