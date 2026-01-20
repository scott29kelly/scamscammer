/**
 * OpenAI Realtime API Client
 *
 * Handles WebSocket connections to OpenAI's Realtime API for voice conversations.
 * Supports bidirectional audio streaming with the Earl persona.
 */

import WebSocket from 'ws';
import { EventEmitter } from 'events';
import { getSystemPrompt } from './persona';

export interface OpenAIRealtimeConfig {
  apiKey: string;
  model?: string;
  voice?: string;
  systemPrompt?: string;
}

export interface SessionConfig {
  modalities: string[];
  instructions: string;
  voice: string;
  input_audio_format: string;
  output_audio_format: string;
  turn_detection: {
    type: string;
    threshold?: number;
    prefix_padding_ms?: number;
    silence_duration_ms?: number;
  };
}

export interface RealtimeEvent {
  type: string;
  [key: string]: unknown;
}

export interface AudioDelta {
  type: 'response.audio.delta';
  response_id: string;
  item_id: string;
  output_index: number;
  content_index: number;
  delta: string; // base64 encoded audio
}

export interface TranscriptDelta {
  type: 'response.audio_transcript.delta';
  response_id: string;
  item_id: string;
  output_index: number;
  content_index: number;
  delta: string;
}

export interface TranscriptDone {
  type: 'response.audio_transcript.done';
  response_id: string;
  item_id: string;
  output_index: number;
  content_index: number;
  transcript: string;
}

export interface InputTranscriptDone {
  type: 'conversation.item.input_audio_transcription.completed';
  item_id: string;
  transcript: string;
}

export interface ResponseDone {
  type: 'response.done';
  response: {
    id: string;
    status: string;
    output: Array<{
      id: string;
      type: string;
      content?: Array<{
        type: string;
        transcript?: string;
      }>;
    }>;
  };
}

export interface ErrorEvent {
  type: 'error';
  error: {
    type: string;
    code: string;
    message: string;
  };
}

export type OpenAIRealtimeEvents = {
  connected: [];
  disconnected: [];
  error: [Error];
  audio: [Buffer]; // decoded audio data
  transcript: [string, 'earl' | 'caller']; // transcript text and speaker
  response_start: [];
  response_end: [];
  input_audio_committed: [];
};

export class OpenAIRealtimeClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private config: OpenAIRealtimeConfig;
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 3;
  private currentTranscript: string = '';

  constructor(config: OpenAIRealtimeConfig) {
    super();
    this.config = {
      model: 'gpt-4o-realtime-preview-2024-12-17',
      voice: 'ash', // Good for elderly male voice
      ...config
    };
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const url = `wss://api.openai.com/v1/realtime?model=${this.config.model}`;

      this.ws = new WebSocket(url, {
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'OpenAI-Beta': 'realtime=v1'
        }
      });

      const connectionTimeout = setTimeout(() => {
        if (!this.isConnected) {
          this.ws?.close();
          reject(new Error('Connection timeout'));
        }
      }, 10000);

      this.ws.on('open', () => {
        clearTimeout(connectionTimeout);
        this.isConnected = true;
        this.reconnectAttempts = 0;
        console.log('[OpenAI] WebSocket connected');

        // Configure the session
        this.configureSession();

        this.emit('connected');
        resolve();
      });

      this.ws.on('message', (data: WebSocket.Data) => {
        this.handleMessage(data);
      });

      this.ws.on('close', (code: number, reason: Buffer) => {
        clearTimeout(connectionTimeout);
        this.isConnected = false;
        console.log(`[OpenAI] WebSocket closed: ${code} - ${reason.toString()}`);
        this.emit('disconnected');
      });

      this.ws.on('error', (error: Error) => {
        clearTimeout(connectionTimeout);
        console.error('[OpenAI] WebSocket error:', error);
        this.emit('error', error);
        if (!this.isConnected) {
          reject(error);
        }
      });
    });
  }

  private configureSession(): void {
    const sessionConfig: SessionConfig = {
      modalities: ['text', 'audio'],
      instructions: this.config.systemPrompt || getSystemPrompt(),
      voice: this.config.voice || 'ash',
      input_audio_format: 'g711_ulaw', // Twilio uses μ-law
      output_audio_format: 'g711_ulaw', // Output in μ-law for Twilio
      turn_detection: {
        type: 'server_vad',
        threshold: 0.5,
        prefix_padding_ms: 300,
        silence_duration_ms: 500 // Lower to make Earl respond quicker
      }
    };

    this.send({
      type: 'session.update',
      session: sessionConfig
    });

    console.log('[OpenAI] Session configured with Earl persona');
  }

  private handleMessage(data: WebSocket.Data): void {
    try {
      const event: RealtimeEvent = JSON.parse(data.toString());

      switch (event.type) {
        case 'session.created':
          console.log('[OpenAI] Session created');
          break;

        case 'session.updated':
          console.log('[OpenAI] Session updated');
          break;

        case 'response.audio.delta':
          this.handleAudioDelta(event as unknown as AudioDelta);
          break;

        case 'response.audio_transcript.delta':
          this.handleTranscriptDelta(event as unknown as TranscriptDelta);
          break;

        case 'response.audio_transcript.done':
          this.handleTranscriptDone(event as unknown as TranscriptDone);
          break;

        case 'conversation.item.input_audio_transcription.completed':
          this.handleInputTranscript(event as unknown as InputTranscriptDone);
          break;

        case 'response.created':
          this.emit('response_start');
          break;

        case 'response.done':
          this.handleResponseDone(event as unknown as ResponseDone);
          break;

        case 'input_audio_buffer.committed':
          this.emit('input_audio_committed');
          break;

        case 'error':
          this.handleError(event as unknown as ErrorEvent);
          break;

        case 'rate_limits.updated':
          // Silently handle rate limit updates
          break;

        default:
          // Log unknown event types for debugging
          if (process.env.NODE_ENV === 'development') {
            console.log(`[OpenAI] Unhandled event type: ${event.type}`);
          }
      }
    } catch (error) {
      console.error('[OpenAI] Error parsing message:', error);
    }
  }

  private handleAudioDelta(event: AudioDelta): void {
    // Decode base64 audio and emit for Twilio
    const audioBuffer = Buffer.from(event.delta, 'base64');
    this.emit('audio', audioBuffer);
  }

  private handleTranscriptDelta(event: TranscriptDelta): void {
    this.currentTranscript += event.delta;
  }

  private handleTranscriptDone(event: TranscriptDone): void {
    // Emit completed Earl transcript
    this.emit('transcript', event.transcript, 'earl');
    this.currentTranscript = '';
  }

  private handleInputTranscript(event: InputTranscriptDone): void {
    // Emit caller's speech transcript
    this.emit('transcript', event.transcript, 'caller');
  }

  private handleResponseDone(event: ResponseDone): void {
    console.log(`[OpenAI] Response completed: ${event.response.status}`);
    this.emit('response_end');
  }

  private handleError(event: ErrorEvent): void {
    console.error('[OpenAI] API Error:', event.error);
    this.emit('error', new Error(`${event.error.type}: ${event.error.message}`));
  }

  /**
   * Send audio data to OpenAI
   * @param audioBuffer - μ-law encoded audio from Twilio
   */
  sendAudio(audioBuffer: Buffer): void {
    if (!this.isConnected || !this.ws) {
      console.warn('[OpenAI] Cannot send audio: not connected');
      return;
    }

    // Audio is already in μ-law format from Twilio
    const base64Audio = audioBuffer.toString('base64');

    this.send({
      type: 'input_audio_buffer.append',
      audio: base64Audio
    });
  }

  /**
   * Commit the current audio buffer to trigger processing
   */
  commitAudio(): void {
    if (!this.isConnected || !this.ws) return;

    this.send({
      type: 'input_audio_buffer.commit'
    });
  }

  /**
   * Clear the input audio buffer
   */
  clearAudioBuffer(): void {
    if (!this.isConnected || !this.ws) return;

    this.send({
      type: 'input_audio_buffer.clear'
    });
  }

  /**
   * Send a text message to create a response (for testing/debugging)
   */
  sendText(text: string): void {
    if (!this.isConnected || !this.ws) return;

    this.send({
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'user',
        content: [
          {
            type: 'input_text',
            text
          }
        ]
      }
    });

    this.send({
      type: 'response.create'
    });
  }

  /**
   * Cancel the current response
   */
  cancelResponse(): void {
    if (!this.isConnected || !this.ws) return;

    this.send({
      type: 'response.cancel'
    });
  }

  /**
   * Update the system prompt mid-session
   */
  updateInstructions(instructions: string): void {
    if (!this.isConnected || !this.ws) return;

    this.send({
      type: 'session.update',
      session: {
        instructions
      }
    });
  }

  private send(event: RealtimeEvent): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(event));
    }
  }

  /**
   * Disconnect from OpenAI
   */
  disconnect(): void {
    if (this.ws) {
      this.isConnected = false;
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
  }

  /**
   * Check if connected
   */
  get connected(): boolean {
    return this.isConnected;
  }
}

/**
 * Create a new OpenAI Realtime client instance
 */
export function createOpenAIClient(apiKey?: string): OpenAIRealtimeClient {
  const key = apiKey || process.env.OPENAI_API_KEY;

  if (!key) {
    throw new Error('OpenAI API key is required. Set OPENAI_API_KEY environment variable.');
  }

  return new OpenAIRealtimeClient({
    apiKey: key
  });
}

export default OpenAIRealtimeClient;
