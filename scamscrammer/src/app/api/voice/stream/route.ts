/**
 * WebSocket Voice Stream Handler
 *
 * This route handles the bidirectional audio stream between Twilio and OpenAI's
 * Realtime API. It serves as the bridge that enables Earl (our AI persona) to
 * have real-time voice conversations with scam callers.
 *
 * Flow:
 * 1. Twilio connects via WebSocket when a call is answered
 * 2. Audio from the caller is forwarded to OpenAI Realtime API
 * 3. Earl's responses from OpenAI are sent back to Twilio
 * 4. Conversation segments are stored in the database for review
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../../../lib/db';
import { OpenAIRealtimeClient, createOpenAIClient } from '../../../../lib/openai';
import {
  TwilioClient,
  TwilioMediaStreamMessage,
  TwilioStartEvent,
  TwilioMediaEvent
} from '../../../../lib/twilio';

// Speaker enum - matches Prisma schema
const Speaker = {
  EARL: 'EARL',
  SCAMMER: 'SCAMMER'
} as const;

// Connection state for each active stream
interface StreamConnection {
  callSid: string;
  streamSid: string;
  openai: OpenAIRealtimeClient;
  callId: string | null;
  startTime: number;
  lastTranscriptTime: number;
}

// Store for active connections (in production, use Redis or similar)
const activeConnections = new Map<string, StreamConnection>();

/**
 * Handle WebSocket upgrade for voice streaming
 *
 * Note: Next.js doesn't natively support WebSocket upgrades in route handlers.
 * This implementation provides the logic that would be used with a custom server
 * or WebSocket-compatible hosting (like Vercel with Edge Runtime or a custom server).
 */
export async function GET(request: NextRequest) {
  // Check for WebSocket upgrade header
  const upgradeHeader = request.headers.get('upgrade');

  if (upgradeHeader !== 'websocket') {
    return NextResponse.json(
      {
        error: 'WebSocket upgrade required',
        message: 'This endpoint only accepts WebSocket connections from Twilio Media Streams'
      },
      { status: 426 }
    );
  }

  // In a real deployment, you would handle the WebSocket upgrade here
  // For Next.js App Router, WebSocket handling requires additional setup:
  // 1. Use a custom server (e.g., with ws library)
  // 2. Use Vercel's Edge Runtime with WebSocket support
  // 3. Use a separate WebSocket server

  return NextResponse.json(
    {
      error: 'WebSocket not configured',
      message:
        'WebSocket connections require custom server setup. See VoiceStreamHandler class for implementation.'
    },
    { status: 501 }
  );
}

/**
 * Health check / info endpoint
 */
export async function POST(request: NextRequest) {
  // This endpoint can be used for testing or receiving webhook data
  return NextResponse.json({
    status: 'ok',
    message: 'Voice stream endpoint is available',
    websocket: 'wss://your-domain.com/api/voice/stream'
  });
}

/**
 * VoiceStreamHandler class
 *
 * This class handles the WebSocket connection lifecycle and audio bridging
 * between Twilio and OpenAI. Use this with a custom WebSocket server.
 *
 * Example usage with ws library:
 *
 * ```typescript
 * import { WebSocketServer } from 'ws';
 * import { VoiceStreamHandler } from './route';
 *
 * const wss = new WebSocketServer({ path: '/api/voice/stream' });
 *
 * wss.on('connection', (ws, req) => {
 *   const handler = new VoiceStreamHandler(ws);
 *   handler.initialize();
 * });
 * ```
 */
export class VoiceStreamHandler {
  private ws: WebSocket;
  private connection: StreamConnection | null = null;
  private isClosing: boolean = false;

  constructor(websocket: WebSocket) {
    this.ws = websocket;
  }

  /**
   * Initialize the handler and set up event listeners
   */
  async initialize(): Promise<void> {
    console.log('[VoiceStream] New WebSocket connection');

    this.ws.addEventListener('message', (event) => this.handleMessage(event));
    this.ws.addEventListener('close', () => this.handleClose());
    this.ws.addEventListener('error', (error) => this.handleError(error));
  }

  /**
   * Handle incoming WebSocket messages from Twilio
   */
  private async handleMessage(event: MessageEvent): Promise<void> {
    const message = TwilioClient.parseStreamMessage(
      typeof event.data === 'string' ? event.data : event.data.toString()
    );

    if (!message) {
      console.warn('[VoiceStream] Failed to parse message');
      return;
    }

    switch (message.event) {
      case 'connected':
        console.log('[VoiceStream] Twilio connected');
        break;

      case 'start':
        await this.handleStart(message as TwilioStartEvent);
        break;

      case 'media':
        this.handleMedia(message as TwilioMediaEvent);
        break;

      case 'stop':
        await this.handleStop();
        break;

      case 'mark':
        // Handle synchronization marks if needed
        console.log('[VoiceStream] Mark received:', (message as { mark: { name: string } }).mark.name);
        break;

      default:
        console.log('[VoiceStream] Unknown event:', (message as TwilioMediaStreamMessage).event);
    }
  }

  /**
   * Handle stream start event from Twilio
   */
  private async handleStart(message: TwilioStartEvent): Promise<void> {
    const { streamSid, callSid, mediaFormat } = message.start;

    console.log('[VoiceStream] Stream started:', {
      streamSid,
      callSid,
      encoding: mediaFormat.encoding,
      sampleRate: mediaFormat.sampleRate
    });

    try {
      // Create OpenAI Realtime connection
      const openai = createOpenAIClient();

      // Set up OpenAI event handlers
      this.setupOpenAIHandlers(openai, streamSid);

      // Connect to OpenAI
      await openai.connect();

      // Create or find the call record
      const callId = await this.findOrCreateCall(callSid);

      // Store connection state
      this.connection = {
        callSid,
        streamSid,
        openai,
        callId,
        startTime: Date.now(),
        lastTranscriptTime: 0
      };

      activeConnections.set(streamSid, this.connection);

      console.log('[VoiceStream] Connection established for call:', callSid);
    } catch (error) {
      console.error('[VoiceStream] Failed to initialize:', error);
      this.ws.close(1011, 'Failed to initialize OpenAI connection');
    }
  }

  /**
   * Handle incoming media (audio) from Twilio
   */
  private handleMedia(message: TwilioMediaEvent): void {
    if (!this.connection?.openai.connected) {
      return;
    }

    // Decode base64 audio payload and send to OpenAI
    const audioBuffer = Buffer.from(message.media.payload, 'base64');
    this.connection.openai.sendAudio(audioBuffer);
  }

  /**
   * Handle stream stop event
   */
  private async handleStop(): Promise<void> {
    console.log('[VoiceStream] Stream stopping');
    await this.cleanup();
  }

  /**
   * Handle WebSocket close
   */
  private async handleClose(): Promise<void> {
    console.log('[VoiceStream] WebSocket closed');
    await this.cleanup();
  }

  /**
   * Handle WebSocket errors
   */
  private handleError(error: Event): void {
    console.error('[VoiceStream] WebSocket error:', error);
  }

  /**
   * Set up OpenAI Realtime event handlers
   */
  private setupOpenAIHandlers(openai: OpenAIRealtimeClient, streamSid: string): void {
    // Handle audio responses from Earl
    openai.on('audio', (audioBuffer: Buffer) => {
      if (this.isClosing) return;

      // Send audio back to Twilio
      const message = TwilioClient.createMediaMessage(
        streamSid,
        audioBuffer.toString('base64')
      );

      if (this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(message);
      }
    });

    // Handle transcript events for database storage
    openai.on('transcript', async (text: string, speaker: 'earl' | 'caller') => {
      if (!this.connection?.callId || !text.trim()) return;

      const timestamp = Math.floor((Date.now() - this.connection.startTime) / 1000);

      try {
        await prisma.callSegment.create({
          data: {
            callId: this.connection.callId,
            speaker: speaker === 'earl' ? Speaker.EARL : Speaker.SCAMMER,
            text: text.trim(),
            timestamp
          }
        });

        this.connection.lastTranscriptTime = timestamp;
        console.log(`[VoiceStream] Transcript saved [${speaker}]: ${text.substring(0, 50)}...`);
      } catch (error) {
        console.error('[VoiceStream] Failed to save transcript:', error);
      }
    });

    // Handle response lifecycle events
    openai.on('response_start', () => {
      console.log('[VoiceStream] Earl is responding...');
    });

    openai.on('response_end', () => {
      // Send a mark for synchronization
      if (this.ws.readyState === WebSocket.OPEN) {
        const mark = TwilioClient.createMarkMessage(streamSid, `response-${Date.now()}`);
        this.ws.send(mark);
      }
    });

    // Handle OpenAI errors
    openai.on('error', (error: Error) => {
      console.error('[VoiceStream] OpenAI error:', error);
    });

    // Handle disconnection
    openai.on('disconnected', () => {
      console.log('[VoiceStream] OpenAI disconnected');
      if (!this.isClosing) {
        this.cleanup();
      }
    });
  }

  /**
   * Find existing call or create a placeholder
   */
  private async findOrCreateCall(callSid: string): Promise<string | null> {
    try {
      // Try to find existing call record
      const existingCall = await prisma.call.findUnique({
        where: { twilioSid: callSid },
        select: { id: true }
      });

      if (existingCall) {
        // Update status to IN_PROGRESS
        await prisma.call.update({
          where: { id: existingCall.id },
          data: { status: 'IN_PROGRESS' }
        });
        return existingCall.id;
      }

      // If no existing call, the incoming webhook hasn't created it yet
      // We'll try again later or let the incoming webhook handle it
      console.log('[VoiceStream] Call record not found for:', callSid);
      return null;
    } catch (error) {
      console.error('[VoiceStream] Database error:', error);
      return null;
    }
  }

  /**
   * Clean up resources when connection ends
   */
  private async cleanup(): Promise<void> {
    if (this.isClosing) return;
    this.isClosing = true;

    console.log('[VoiceStream] Cleaning up connection');

    if (this.connection) {
      // Disconnect OpenAI
      this.connection.openai.disconnect();

      // Update call duration if we have a call record
      if (this.connection.callId) {
        const duration = Math.floor((Date.now() - this.connection.startTime) / 1000);

        try {
          await prisma.call.update({
            where: { id: this.connection.callId },
            data: {
              status: 'COMPLETED',
              duration
            }
          });
          console.log(`[VoiceStream] Call completed, duration: ${duration}s`);
        } catch (error) {
          console.error('[VoiceStream] Failed to update call:', error);
        }
      }

      // Remove from active connections
      activeConnections.delete(this.connection.streamSid);
    }

    // Close WebSocket if still open
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.close(1000, 'Stream ended');
    }
  }
}

/**
 * Create a WebSocket server handler for use with a custom server
 *
 * Example integration with a custom Next.js server:
 *
 * ```typescript
 * // server.ts
 * import { createServer } from 'http';
 * import { parse } from 'url';
 * import next from 'next';
 * import { WebSocketServer } from 'ws';
 * import { createVoiceStreamServer } from './src/app/api/voice/stream/route';
 *
 * const app = next({ dev: process.env.NODE_ENV !== 'production' });
 * const handle = app.getRequestHandler();
 *
 * app.prepare().then(() => {
 *   const server = createServer((req, res) => {
 *     handle(req, res);
 *   });
 *
 *   createVoiceStreamServer(server);
 *
 *   server.listen(3000);
 * });
 * ```
 */
export function createVoiceStreamServer(httpServer: unknown): void {
  // This would be implemented with the ws library
  // Keeping as a stub for documentation purposes
  console.log('[VoiceStream] Creating WebSocket server (stub)');

  // In actual implementation:
  // const wss = new WebSocketServer({ server: httpServer, path: '/api/voice/stream' });
  // wss.on('connection', (ws) => {
  //   const handler = new VoiceStreamHandler(ws as unknown as WebSocket);
  //   handler.initialize();
  // });
}

/**
 * Get count of active connections
 */
export function getActiveConnectionCount(): number {
  return activeConnections.size;
}

/**
 * Get active connection by stream SID
 */
export function getActiveConnection(streamSid: string): StreamConnection | undefined {
  return activeConnections.get(streamSid);
}
