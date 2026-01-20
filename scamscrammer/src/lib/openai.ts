/**
 * OpenAI Realtime Voice Client
 *
 * This module provides a WebSocket-based client for the OpenAI Realtime API,
 * enabling real-time voice conversations with AI. It's designed to work with
 * the ScamScrammer application for engaging scam callers in conversation.
 */

import WebSocket from 'ws';
import { EventEmitter } from 'events';
import { EARL_SYSTEM_PROMPT } from './persona';
import type { OpenAIRealtimeConfig } from '../types';

/**
 * OpenAI Realtime API WebSocket URL
 */
const OPENAI_REALTIME_URL = 'wss://api.openai.com/v1/realtime';

/**
 * Default model for realtime voice
 */
const DEFAULT_MODEL = 'gpt-4o-realtime-preview-2024-10-01';

/**
 * Connection states for the client
 */
export enum ConnectionState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  RECONNECTING = 'reconnecting',
  ERROR = 'error',
}

/**
 * Event types emitted by the OpenAI Realtime Client
 */
export interface OpenAIRealtimeEvents {
  /** Connection state changed */
  stateChange: (state: ConnectionState) => void;
  /** Session successfully created */
  sessionCreated: (session: SessionCreatedEvent) => void;
  /** Audio response received from the AI */
  audioResponse: (audio: AudioResponseEvent) => void;
  /** Text transcript received (input or output) */
  transcript: (transcript: TranscriptEvent) => void;
  /** Response started */
  responseStart: (response: ResponseStartEvent) => void;
  /** Response completed */
  responseEnd: (response: ResponseEndEvent) => void;
  /** Error occurred */
  error: (error: OpenAIRealtimeError) => void;
  /** Connection closed */
  disconnect: (reason: string) => void;
  /** Speech started (VAD detected) */
  speechStarted: () => void;
  /** Speech stopped (VAD detected) */
  speechStopped: () => void;
  /** Input audio buffer committed */
  inputAudioCommitted: () => void;
  /** Conversation item created */
  conversationItemCreated: (item: ConversationItemEvent) => void;
}

/**
 * Session created event payload
 */
export interface SessionCreatedEvent {
  id: string;
  model: string;
  voice: string;
}

/**
 * Audio response event payload
 */
export interface AudioResponseEvent {
  /** Base64 encoded audio data */
  audioData: string;
  /** The response item ID this audio belongs to */
  responseId: string;
  /** Item ID */
  itemId: string;
  /** Content index within the item */
  contentIndex: number;
}

/**
 * Transcript event payload
 */
export interface TranscriptEvent {
  /** Type: 'input' for user speech, 'output' for AI response */
  type: 'input' | 'output';
  /** The transcribed text */
  text: string;
  /** Whether this is the final transcript */
  isFinal: boolean;
  /** Item ID if available */
  itemId?: string;
}

/**
 * Response start event payload
 */
export interface ResponseStartEvent {
  responseId: string;
  status: string;
}

/**
 * Response end event payload
 */
export interface ResponseEndEvent {
  responseId: string;
  status: string;
  usage?: {
    totalTokens: number;
    inputTokens: number;
    outputTokens: number;
  };
}

/**
 * Conversation item event payload
 */
export interface ConversationItemEvent {
  id: string;
  type: string;
  role: 'user' | 'assistant' | 'system';
  status: string;
}

/**
 * Custom error class for OpenAI Realtime errors
 */
export class OpenAIRealtimeError extends Error {
  code: string;
  type: string;
  eventId?: string;

  constructor(message: string, code: string, type: string, eventId?: string) {
    super(message);
    this.name = 'OpenAIRealtimeError';
    this.code = code;
    this.type = type;
    this.eventId = eventId;
  }
}

/**
 * Session configuration for connecting to the Realtime API
 */
export interface SessionConfig {
  /** API key (defaults to OPENAI_API_KEY env var) */
  apiKey?: string;
  /** Model to use */
  model?: string;
  /** Voice to use */
  voice?: OpenAIRealtimeConfig['voice'];
  /** System prompt / instructions */
  instructions?: string;
  /** Input audio format */
  inputAudioFormat?: OpenAIRealtimeConfig['inputAudioFormat'];
  /** Output audio format */
  outputAudioFormat?: OpenAIRealtimeConfig['outputAudioFormat'];
  /** Enable input audio transcription */
  inputAudioTranscription?: OpenAIRealtimeConfig['inputAudioTranscription'];
  /** Turn detection settings */
  turnDetection?: OpenAIRealtimeConfig['turnDetection'];
  /** Temperature for generation */
  temperature?: number;
  /** Max response tokens */
  maxResponseOutputTokens?: number | 'inf';
}

/**
 * OpenAI Realtime Voice Client
 *
 * Manages WebSocket connections to the OpenAI Realtime API for real-time
 * voice conversations.
 *
 * @example
 * ```typescript
 * const client = new OpenAIRealtimeClient();
 *
 * client.on('audioResponse', ({ audioData }) => {
 *   // Handle audio data (base64 encoded)
 * });
 *
 * client.on('transcript', ({ type, text }) => {
 *   console.log(`${type}: ${text}`);
 * });
 *
 * await client.connect({
 *   voice: 'ash',
 *   instructions: EARL_SYSTEM_PROMPT,
 * });
 *
 * // Send audio data
 * client.sendAudio(audioBuffer);
 *
 * // Disconnect when done
 * client.disconnect();
 * ```
 */
export class OpenAIRealtimeClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private connectionState: ConnectionState = ConnectionState.DISCONNECTED;
  private sessionId: string | null = null;
  private currentConfig: SessionConfig | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 3;
  private reconnectDelay = 1000;
  private pingInterval: NodeJS.Timeout | null = null;
  private responseAudioBuffer: Map<string, string[]> = new Map();

  constructor() {
    super();
  }

  /**
   * Get the current connection state
   */
  getState(): ConnectionState {
    return this.connectionState;
  }

  /**
   * Get the current session ID
   */
  getSessionId(): string | null {
    return this.sessionId;
  }

  /**
   * Check if the client is connected
   */
  isConnected(): boolean {
    return this.connectionState === ConnectionState.CONNECTED && this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Connect to the OpenAI Realtime API
   *
   * @param config - Session configuration options
   * @returns Promise that resolves when connected
   */
  async connect(config: SessionConfig = {}): Promise<void> {
    if (this.connectionState === ConnectionState.CONNECTED) {
      throw new OpenAIRealtimeError('Already connected', 'ALREADY_CONNECTED', 'connection');
    }

    const apiKey = config.apiKey || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new OpenAIRealtimeError(
        'OpenAI API key is required. Set OPENAI_API_KEY environment variable or pass apiKey in config.',
        'MISSING_API_KEY',
        'configuration'
      );
    }

    this.currentConfig = config;
    this.setConnectionState(ConnectionState.CONNECTING);

    const model = config.model || DEFAULT_MODEL;
    const url = `${OPENAI_REALTIME_URL}?model=${encodeURIComponent(model)}`;

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(url, {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'OpenAI-Beta': 'realtime=v1',
          },
        });

        this.ws.on('open', () => {
          this.handleOpen(config);
          resolve();
        });

        this.ws.on('message', (data: WebSocket.Data) => {
          this.handleMessage(data);
        });

        this.ws.on('close', (code: number, reason: Buffer) => {
          this.handleClose(code, reason.toString());
        });

        this.ws.on('error', (error: Error) => {
          this.handleError(error);
          if (this.connectionState === ConnectionState.CONNECTING) {
            reject(new OpenAIRealtimeError(error.message, 'CONNECTION_ERROR', 'websocket'));
          }
        });
      } catch (error) {
        this.setConnectionState(ConnectionState.ERROR);
        reject(error);
      }
    });
  }

  /**
   * Disconnect from the OpenAI Realtime API
   *
   * @param reason - Optional reason for disconnection
   */
  disconnect(reason = 'Client initiated disconnect'): void {
    this.stopPingInterval();
    this.reconnectAttempts = this.maxReconnectAttempts; // Prevent reconnection

    if (this.ws) {
      this.ws.close(1000, reason);
      this.ws = null;
    }

    this.sessionId = null;
    this.currentConfig = null;
    this.responseAudioBuffer.clear();
    this.setConnectionState(ConnectionState.DISCONNECTED);
    this.emit('disconnect', reason);
  }

  /**
   * Send audio data to the OpenAI Realtime API
   *
   * @param audioChunk - Audio data as Buffer (raw PCM or G.711)
   */
  sendAudio(audioChunk: Buffer): void {
    if (!this.isConnected()) {
      throw new OpenAIRealtimeError('Not connected to OpenAI Realtime API', 'NOT_CONNECTED', 'connection');
    }

    const base64Audio = audioChunk.toString('base64');
    this.sendEvent('input_audio_buffer.append', {
      audio: base64Audio,
    });
  }

  /**
   * Commit the current audio buffer, signaling end of speech
   * Use this when you detect the user has stopped speaking
   */
  commitAudioBuffer(): void {
    if (!this.isConnected()) {
      throw new OpenAIRealtimeError('Not connected to OpenAI Realtime API', 'NOT_CONNECTED', 'connection');
    }

    this.sendEvent('input_audio_buffer.commit', {});
  }

  /**
   * Clear the current input audio buffer
   */
  clearAudioBuffer(): void {
    if (!this.isConnected()) {
      return;
    }

    this.sendEvent('input_audio_buffer.clear', {});
  }

  /**
   * Cancel the current response from the AI
   */
  cancelResponse(): void {
    if (!this.isConnected()) {
      return;
    }

    this.sendEvent('response.cancel', {});
  }

  /**
   * Trigger a response from the AI
   * Useful when not using server VAD
   */
  triggerResponse(): void {
    if (!this.isConnected()) {
      throw new OpenAIRealtimeError('Not connected to OpenAI Realtime API', 'NOT_CONNECTED', 'connection');
    }

    this.sendEvent('response.create', {});
  }

  /**
   * Set or update the system prompt for the session
   *
   * @param prompt - The new system prompt / instructions
   */
  setSystemPrompt(prompt: string): void {
    if (!this.isConnected()) {
      throw new OpenAIRealtimeError('Not connected to OpenAI Realtime API', 'NOT_CONNECTED', 'connection');
    }

    this.sendEvent('session.update', {
      session: {
        instructions: prompt,
      },
    });
  }

  /**
   * Update session configuration
   *
   * @param config - Partial configuration to update
   */
  updateSession(config: Partial<SessionConfig>): void {
    if (!this.isConnected()) {
      throw new OpenAIRealtimeError('Not connected to OpenAI Realtime API', 'NOT_CONNECTED', 'connection');
    }

    const sessionUpdate: Record<string, unknown> = {};

    if (config.voice) {
      sessionUpdate.voice = config.voice;
    }
    if (config.instructions) {
      sessionUpdate.instructions = config.instructions;
    }
    if (config.inputAudioFormat) {
      sessionUpdate.input_audio_format = config.inputAudioFormat;
    }
    if (config.outputAudioFormat) {
      sessionUpdate.output_audio_format = config.outputAudioFormat;
    }
    if (config.inputAudioTranscription) {
      sessionUpdate.input_audio_transcription = config.inputAudioTranscription;
    }
    if (config.turnDetection) {
      sessionUpdate.turn_detection = this.formatTurnDetection(config.turnDetection);
    }
    if (config.temperature !== undefined) {
      sessionUpdate.temperature = config.temperature;
    }
    if (config.maxResponseOutputTokens !== undefined) {
      sessionUpdate.max_response_output_tokens = config.maxResponseOutputTokens;
    }

    this.sendEvent('session.update', {
      session: sessionUpdate,
    });
  }

  /**
   * Register callback for audio responses
   *
   * @param callback - Function to call when audio is received
   * @returns Unsubscribe function
   */
  onResponse(callback: (audio: AudioResponseEvent) => void): () => void {
    this.on('audioResponse', callback);
    return () => this.off('audioResponse', callback);
  }

  /**
   * Register callback for transcripts
   *
   * @param callback - Function to call when transcript is received
   * @returns Unsubscribe function
   */
  onTranscript(callback: (transcript: TranscriptEvent) => void): () => void {
    this.on('transcript', callback);
    return () => this.off('transcript', callback);
  }

  /**
   * Register callback for errors
   *
   * @param callback - Function to call when error occurs
   * @returns Unsubscribe function
   */
  onError(callback: (error: OpenAIRealtimeError) => void): () => void {
    this.on('error', callback);
    return () => this.off('error', callback);
  }

  /**
   * Register callback for disconnection
   *
   * @param callback - Function to call when disconnected
   * @returns Unsubscribe function
   */
  onDisconnect(callback: (reason: string) => void): () => void {
    this.on('disconnect', callback);
    return () => this.off('disconnect', callback);
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private setConnectionState(state: ConnectionState): void {
    if (this.connectionState !== state) {
      this.connectionState = state;
      this.emit('stateChange', state);
    }
  }

  private handleOpen(config: SessionConfig): void {
    this.setConnectionState(ConnectionState.CONNECTED);
    this.reconnectAttempts = 0;
    this.startPingInterval();

    // Configure the session
    const sessionConfig = this.buildSessionConfig(config);
    this.sendEvent('session.update', { session: sessionConfig });
  }

  private buildSessionConfig(config: SessionConfig): Record<string, unknown> {
    const sessionConfig: Record<string, unknown> = {
      modalities: ['text', 'audio'],
      instructions: config.instructions || EARL_SYSTEM_PROMPT,
      voice: config.voice || 'ash',
      input_audio_format: config.inputAudioFormat || 'g711_ulaw',
      output_audio_format: config.outputAudioFormat || 'g711_ulaw',
    };

    if (config.inputAudioTranscription) {
      sessionConfig.input_audio_transcription = {
        model: config.inputAudioTranscription.model,
      };
    } else {
      // Enable transcription by default for logging purposes
      sessionConfig.input_audio_transcription = {
        model: 'whisper-1',
      };
    }

    if (config.turnDetection) {
      sessionConfig.turn_detection = this.formatTurnDetection(config.turnDetection);
    } else {
      // Default to server VAD for natural conversation flow
      sessionConfig.turn_detection = {
        type: 'server_vad',
        threshold: 0.5,
        prefix_padding_ms: 300,
        silence_duration_ms: 500,
      };
    }

    if (config.temperature !== undefined) {
      sessionConfig.temperature = config.temperature;
    }

    if (config.maxResponseOutputTokens !== undefined) {
      sessionConfig.max_response_output_tokens = config.maxResponseOutputTokens;
    }

    return sessionConfig;
  }

  private formatTurnDetection(
    turnDetection: NonNullable<OpenAIRealtimeConfig['turnDetection']>
  ): Record<string, unknown> {
    return {
      type: turnDetection.type,
      threshold: turnDetection.threshold,
      prefix_padding_ms: turnDetection.prefixPaddingMs,
      silence_duration_ms: turnDetection.silenceDurationMs,
    };
  }

  private handleMessage(data: WebSocket.Data): void {
    try {
      const message = JSON.parse(data.toString());
      this.processServerEvent(message);
    } catch (error) {
      console.error('[OpenAI Realtime] Failed to parse message:', error);
    }
  }

  private processServerEvent(event: Record<string, unknown>): void {
    const eventType = event.type as string;

    switch (eventType) {
      case 'session.created':
        this.handleSessionCreated(event);
        break;

      case 'session.updated':
        // Session configuration was updated successfully
        break;

      case 'input_audio_buffer.committed':
        this.emit('inputAudioCommitted');
        break;

      case 'input_audio_buffer.speech_started':
        this.emit('speechStarted');
        break;

      case 'input_audio_buffer.speech_stopped':
        this.emit('speechStopped');
        break;

      case 'conversation.item.created':
        this.handleConversationItemCreated(event);
        break;

      case 'conversation.item.input_audio_transcription.completed':
        this.handleInputTranscript(event);
        break;

      case 'response.created':
        this.handleResponseCreated(event);
        break;

      case 'response.audio.delta':
        this.handleAudioDelta(event);
        break;

      case 'response.audio.done':
        this.handleAudioDone(event);
        break;

      case 'response.audio_transcript.delta':
        this.handleOutputTranscriptDelta(event);
        break;

      case 'response.audio_transcript.done':
        this.handleOutputTranscriptDone(event);
        break;

      case 'response.done':
        this.handleResponseDone(event);
        break;

      case 'error':
        this.handleServerError(event);
        break;

      default:
        // Unknown event type - ignore
        break;
    }
  }

  private handleSessionCreated(event: Record<string, unknown>): void {
    const session = event.session as Record<string, unknown>;
    this.sessionId = session.id as string;

    this.emit('sessionCreated', {
      id: session.id as string,
      model: session.model as string,
      voice: session.voice as string,
    });
  }

  private handleConversationItemCreated(event: Record<string, unknown>): void {
    const item = event.item as Record<string, unknown>;

    this.emit('conversationItemCreated', {
      id: item.id as string,
      type: item.type as string,
      role: item.role as 'user' | 'assistant' | 'system',
      status: item.status as string,
    });
  }

  private handleInputTranscript(event: Record<string, unknown>): void {
    const transcript = event.transcript as string;
    const itemId = event.item_id as string;

    this.emit('transcript', {
      type: 'input',
      text: transcript,
      isFinal: true,
      itemId,
    });
  }

  private handleResponseCreated(event: Record<string, unknown>): void {
    const response = event.response as Record<string, unknown>;

    this.emit('responseStart', {
      responseId: response.id as string,
      status: response.status as string,
    });
  }

  private handleAudioDelta(event: Record<string, unknown>): void {
    const responseId = event.response_id as string;
    const itemId = event.item_id as string;
    const contentIndex = event.content_index as number;
    const delta = event.delta as string;

    // Emit audio chunk immediately for streaming
    this.emit('audioResponse', {
      audioData: delta,
      responseId,
      itemId,
      contentIndex,
    });

    // Also buffer for complete audio if needed
    const bufferKey = `${responseId}:${itemId}:${contentIndex}`;
    if (!this.responseAudioBuffer.has(bufferKey)) {
      this.responseAudioBuffer.set(bufferKey, []);
    }
    this.responseAudioBuffer.get(bufferKey)!.push(delta);
  }

  private handleAudioDone(event: Record<string, unknown>): void {
    const responseId = event.response_id as string;
    const itemId = event.item_id as string;
    const contentIndex = event.content_index as number;

    // Clean up buffer
    const bufferKey = `${responseId}:${itemId}:${contentIndex}`;
    this.responseAudioBuffer.delete(bufferKey);
  }

  private handleOutputTranscriptDelta(event: Record<string, unknown>): void {
    const delta = event.delta as string;
    const itemId = event.item_id as string;

    this.emit('transcript', {
      type: 'output',
      text: delta,
      isFinal: false,
      itemId,
    });
  }

  private handleOutputTranscriptDone(event: Record<string, unknown>): void {
    const transcript = event.transcript as string;
    const itemId = event.item_id as string;

    this.emit('transcript', {
      type: 'output',
      text: transcript,
      isFinal: true,
      itemId,
    });
  }

  private handleResponseDone(event: Record<string, unknown>): void {
    const response = event.response as Record<string, unknown>;
    const usage = response.usage as Record<string, unknown> | undefined;

    this.emit('responseEnd', {
      responseId: response.id as string,
      status: response.status as string,
      usage: usage
        ? {
            totalTokens: usage.total_tokens as number,
            inputTokens: usage.input_tokens as number,
            outputTokens: usage.output_tokens as number,
          }
        : undefined,
    });
  }

  private handleServerError(event: Record<string, unknown>): void {
    const error = event.error as Record<string, unknown>;
    const openAIError = new OpenAIRealtimeError(
      error.message as string,
      error.code as string,
      error.type as string,
      event.event_id as string | undefined
    );

    this.emit('error', openAIError);
  }

  private handleClose(code: number, reason: string): void {
    this.stopPingInterval();
    const wasConnected = this.connectionState === ConnectionState.CONNECTED;

    if (code !== 1000 && wasConnected && this.reconnectAttempts < this.maxReconnectAttempts) {
      // Unexpected close, attempt reconnection
      this.attemptReconnect();
    } else {
      this.setConnectionState(ConnectionState.DISCONNECTED);
      this.sessionId = null;
      this.emit('disconnect', reason || `Connection closed with code ${code}`);
    }
  }

  private handleError(error: Error): void {
    const openAIError = new OpenAIRealtimeError(error.message, 'WEBSOCKET_ERROR', 'websocket');

    this.emit('error', openAIError);

    if (this.connectionState === ConnectionState.CONNECTED) {
      this.setConnectionState(ConnectionState.ERROR);
    }
  }

  private async attemptReconnect(): Promise<void> {
    this.reconnectAttempts++;
    this.setConnectionState(ConnectionState.RECONNECTING);

    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    await this.sleep(delay);

    if (this.currentConfig && this.reconnectAttempts <= this.maxReconnectAttempts) {
      try {
        await this.connect(this.currentConfig);
      } catch {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
          this.setConnectionState(ConnectionState.ERROR);
          this.emit('disconnect', 'Max reconnection attempts reached');
        }
      }
    }
  }

  private sendEvent(type: string, payload: Record<string, unknown>): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new OpenAIRealtimeError('WebSocket not open', 'NOT_CONNECTED', 'connection');
    }

    const event = {
      type,
      ...payload,
    };

    this.ws.send(JSON.stringify(event));
  }

  private startPingInterval(): void {
    this.stopPingInterval();
    // Send ping every 30 seconds to keep connection alive
    this.pingInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.ping();
      }
    }, 30000);
  }

  private stopPingInterval(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Create a pre-configured OpenAI Realtime client for the Earl persona
 *
 * @param overrides - Optional configuration overrides
 * @returns Configured OpenAIRealtimeClient instance
 */
export function createEarlClient(overrides?: Partial<SessionConfig>): OpenAIRealtimeClient {
  const client = new OpenAIRealtimeClient();

  // Store default config for when connect is called
  const defaultConfig: SessionConfig = {
    voice: 'ash', // Older male voice suits Earl
    instructions: EARL_SYSTEM_PROMPT,
    inputAudioFormat: 'g711_ulaw', // Twilio's format
    outputAudioFormat: 'g711_ulaw',
    inputAudioTranscription: { model: 'whisper-1' },
    turnDetection: {
      type: 'server_vad',
      threshold: 0.5,
      prefixPaddingMs: 300,
      silenceDurationMs: 800, // Slightly longer for Earl's slow responses
    },
    temperature: 0.8, // Add some variability for natural conversation
    ...overrides,
  };

  // Return client with a modified connect that uses defaults
  const originalConnect = client.connect.bind(client);
  client.connect = (config?: SessionConfig) => originalConnect({ ...defaultConfig, ...config });

  return client;
}

// Default export
export default OpenAIRealtimeClient;
