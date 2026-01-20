/**
 * WebSocket Voice Stream Handler
 *
 * This endpoint handles bidirectional audio streaming between Twilio and OpenAI.
 * It receives audio from incoming scam calls via Twilio's Media Streams,
 * forwards it to OpenAI's Realtime API for the Earl AI persona to process,
 * and sends Earl's audio responses back to Twilio.
 *
 * Flow:
 * 1. Twilio connects via WebSocket when a call starts
 * 2. Twilio sends 'start' event with call metadata
 * 3. We connect to OpenAI Realtime API
 * 4. Twilio sends 'media' events with audio chunks
 * 5. We forward audio to OpenAI
 * 6. OpenAI sends audio responses
 * 7. We forward Earl's audio back to Twilio
 * 8. Conversation segments are saved to the database
 *
 * @see https://www.twilio.com/docs/voice/media-streams
 */

import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { createEarlClient, OpenAIRealtimeClient } from '@/lib/openai';
import { prisma } from '@/lib/db';
import { Speaker } from '@/types';
import type {
  TwilioStreamEvent,
  TwilioStreamStartEvent,
  TwilioStreamMediaEvent,
  TwilioStreamOutgoingMedia,
  TwilioStreamClear,
} from '@/types';

// =============================================================================
// Types
// =============================================================================

/**
 * Session state for an active call
 */
interface CallSession {
  callSid: string;
  streamSid: string;
  callId: string | null;
  openaiClient: OpenAIRealtimeClient;
  startTime: number;
  lastActivityTime: number;
  isConnected: boolean;
}

/**
 * Pending transcript accumulator
 */
interface PendingTranscript {
  speaker: Speaker;
  text: string;
  startTime: number;
}

// =============================================================================
// Module State
// =============================================================================

// Track active sessions by streamSid
const activeSessions = new Map<string, CallSession>();

// Track pending transcripts for saving to database
const pendingTranscripts = new Map<string, PendingTranscript>();

// WebSocket server singleton (reused across requests)
let wss: WebSocketServer | null = null;

// =============================================================================
// WebSocket Server Setup
// =============================================================================

/**
 * Get or create the WebSocket server singleton
 */
function getWebSocketServer(): WebSocketServer {
  if (!wss) {
    wss = new WebSocketServer({ noServer: true });
    console.log('[Voice Stream] WebSocket server created');
  }
  return wss;
}

// =============================================================================
// Session Management
// =============================================================================

/**
 * Create a new call session
 */
async function createSession(
  startEvent: TwilioStreamStartEvent,
  twilioWs: WebSocket
): Promise<CallSession> {
  const { callSid, streamSid } = startEvent.start;

  console.log('[Voice Stream] Creating session for call:', callSid);

  // Find the call record in our database
  let callId: string | null = null;
  try {
    const call = await prisma.call.findUnique({
      where: { twilioSid: callSid },
      select: { id: true },
    });
    callId = call?.id ?? null;

    if (!callId) {
      console.warn('[Voice Stream] Call not found in database:', callSid);
    }
  } catch (error) {
    console.error('[Voice Stream] Error finding call:', error);
  }

  // Create OpenAI Realtime client configured for Earl
  const openaiClient = createEarlClient();

  // Set up event handlers for OpenAI responses
  setupOpenAIHandlers(openaiClient, twilioWs, streamSid, callId);

  // Connect to OpenAI
  try {
    await openaiClient.connect();
    console.log('[Voice Stream] Connected to OpenAI Realtime API');
  } catch (error) {
    console.error('[Voice Stream] Failed to connect to OpenAI:', error);
    throw error;
  }

  const session: CallSession = {
    callSid,
    streamSid,
    callId,
    openaiClient,
    startTime: Date.now(),
    lastActivityTime: Date.now(),
    isConnected: true,
  };

  activeSessions.set(streamSid, session);

  console.log('[Voice Stream] Session created:', {
    callSid,
    streamSid,
    callId,
    activeSessions: activeSessions.size,
  });

  return session;
}

/**
 * Clean up a session when the call ends
 */
async function cleanupSession(streamSid: string): Promise<void> {
  const session = activeSessions.get(streamSid);
  if (!session) {
    return;
  }

  console.log('[Voice Stream] Cleaning up session:', streamSid);

  session.isConnected = false;

  // Disconnect from OpenAI
  try {
    session.openaiClient.disconnect('call_ended');
  } catch (error) {
    console.error('[Voice Stream] Error disconnecting OpenAI:', error);
  }

  // Save any pending transcripts
  await savePendingTranscript(streamSid);

  // Remove from active sessions
  activeSessions.delete(streamSid);
  pendingTranscripts.delete(streamSid);

  const duration = Math.floor((Date.now() - session.startTime) / 1000);
  console.log('[Voice Stream] Session cleaned up:', {
    streamSid,
    duration,
    activeSessions: activeSessions.size,
  });
}

// =============================================================================
// OpenAI Event Handlers
// =============================================================================

/**
 * Set up handlers for OpenAI Realtime client events
 */
function setupOpenAIHandlers(
  openaiClient: OpenAIRealtimeClient,
  twilioWs: WebSocket,
  streamSid: string,
  callId: string | null
): void {
  // Handle audio from OpenAI (Earl's voice)
  openaiClient.on('audio', (data: { audio: string; responseId: string; itemId: string }) => {
    if (twilioWs.readyState !== WebSocket.OPEN) {
      return;
    }

    // Send audio to Twilio
    const message: TwilioStreamOutgoingMedia = {
      event: 'media',
      streamSid,
      media: {
        payload: data.audio,
      },
    };

    twilioWs.send(JSON.stringify(message));
  });

  // Handle transcripts from OpenAI (Earl's words)
  openaiClient.on('transcript', (data: {
    text: string;
    responseId: string;
    itemId: string;
    isFinal: boolean;
  }) => {
    if (data.isFinal && data.text && callId) {
      // Save Earl's transcript to database
      saveTranscriptSegment(callId, Speaker.EARL, data.text).catch((error) => {
        console.error('[Voice Stream] Error saving Earl transcript:', error);
      });
    }
  });

  // Handle input transcripts (scammer's words)
  openaiClient.on('inputTranscript', (data: { text: string; itemId: string }) => {
    if (data.text && callId) {
      // Accumulate scammer transcript
      const key = streamSid;
      const pending = pendingTranscripts.get(key);

      if (pending && pending.speaker === Speaker.SCAMMER) {
        pending.text += ' ' + data.text;
      } else {
        // Save previous pending transcript and start new one
        if (pending) {
          saveTranscriptSegment(callId, pending.speaker, pending.text).catch((error) => {
            console.error('[Voice Stream] Error saving pending transcript:', error);
          });
        }
        pendingTranscripts.set(key, {
          speaker: Speaker.SCAMMER,
          text: data.text,
          startTime: Date.now(),
        });
      }
    }
  });

  // Handle speech started (scammer started talking)
  openaiClient.on('speechStarted', () => {
    console.log('[Voice Stream] Speech started (scammer talking)');

    // Clear Twilio's audio buffer when scammer interrupts
    if (twilioWs.readyState === WebSocket.OPEN) {
      const clearMessage: TwilioStreamClear = {
        event: 'clear',
        streamSid,
      };
      twilioWs.send(JSON.stringify(clearMessage));
    }
  });

  // Handle speech stopped
  openaiClient.on('speechStopped', () => {
    console.log('[Voice Stream] Speech stopped (scammer stopped talking)');

    // Save accumulated scammer transcript
    savePendingTranscript(streamSid).catch((error) => {
      console.error('[Voice Stream] Error saving pending transcript:', error);
    });
  });

  // Handle response complete
  openaiClient.on('responseComplete', (data: { responseId: string; status: string }) => {
    console.log('[Voice Stream] Response complete:', data.responseId);
  });

  // Handle errors
  openaiClient.on('error', (error) => {
    console.error('[Voice Stream] OpenAI error:', error);
  });

  // Handle disconnection
  openaiClient.on('disconnect', (reason: string) => {
    console.log('[Voice Stream] OpenAI disconnected:', reason);
  });

  // Handle state changes
  openaiClient.on('stateChange', (state: string) => {
    console.log('[Voice Stream] OpenAI state changed:', state);
  });
}

// =============================================================================
// Transcript Management
// =============================================================================

/**
 * Save a transcript segment to the database
 */
async function saveTranscriptSegment(
  callId: string,
  speaker: Speaker,
  text: string
): Promise<void> {
  if (!text.trim()) {
    return;
  }

  try {
    await prisma.callSegment.create({
      data: {
        callId,
        speaker,
        text: text.trim(),
        timestamp: Date.now() / 1000, // Convert to seconds
      },
    });

    console.log('[Voice Stream] Saved transcript segment:', {
      callId,
      speaker,
      textLength: text.length,
    });
  } catch (error) {
    console.error('[Voice Stream] Error saving transcript segment:', error);
  }
}

/**
 * Save any pending transcript for a stream
 */
async function savePendingTranscript(streamSid: string): Promise<void> {
  const session = activeSessions.get(streamSid);
  const pending = pendingTranscripts.get(streamSid);

  if (pending && session?.callId && pending.text.trim()) {
    await saveTranscriptSegment(session.callId, pending.speaker, pending.text);
    pendingTranscripts.delete(streamSid);
  }
}

// =============================================================================
// Twilio WebSocket Message Handlers
// =============================================================================

/**
 * Handle incoming WebSocket messages from Twilio
 */
async function handleTwilioMessage(
  twilioWs: WebSocket,
  data: string
): Promise<void> {
  let event: TwilioStreamEvent;

  try {
    event = JSON.parse(data);
  } catch (error) {
    console.error('[Voice Stream] Failed to parse message:', error);
    return;
  }

  switch (event.event) {
    case 'connected':
      console.log('[Voice Stream] Twilio connected:', {
        protocol: event.protocol,
        version: event.version,
      });
      break;

    case 'start':
      await handleStart(twilioWs, event);
      break;

    case 'media':
      handleMedia(event);
      break;

    case 'stop':
      await handleStop(event);
      break;

    case 'mark':
      console.log('[Voice Stream] Mark received:', event.mark?.name);
      break;

    default:
      console.log('[Voice Stream] Unknown event type:', (event as TwilioStreamEvent).event);
  }
}

/**
 * Handle the 'start' event from Twilio
 */
async function handleStart(
  twilioWs: WebSocket,
  event: TwilioStreamStartEvent
): Promise<void> {
  console.log('[Voice Stream] Stream started:', {
    callSid: event.start.callSid,
    streamSid: event.streamSid,
    mediaFormat: event.start.mediaFormat,
  });

  try {
    await createSession(event, twilioWs);
  } catch (error) {
    console.error('[Voice Stream] Failed to create session:', error);
    // Close the WebSocket if we can't create a session
    twilioWs.close(1011, 'Failed to initialize session');
  }
}

/**
 * Handle 'media' events from Twilio (audio chunks)
 */
function handleMedia(event: TwilioStreamMediaEvent): void {
  const session = activeSessions.get(event.streamSid);
  if (!session || !session.isConnected) {
    return;
  }

  // Update activity timestamp
  session.lastActivityTime = Date.now();

  // Forward audio to OpenAI
  // The payload is base64-encoded mulaw audio, which OpenAI accepts directly
  try {
    session.openaiClient.sendAudio(event.media.payload);
  } catch (error) {
    console.error('[Voice Stream] Error sending audio to OpenAI:', error);
  }
}

/**
 * Handle the 'stop' event from Twilio
 */
async function handleStop(event: TwilioStreamEvent): Promise<void> {
  const streamSid = event.streamSid;
  if (!streamSid) {
    return;
  }

  console.log('[Voice Stream] Stream stopped:', streamSid);
  await cleanupSession(streamSid);
}

// =============================================================================
// WebSocket Connection Handler
// =============================================================================

/**
 * Handle a new WebSocket connection from Twilio
 */
function handleConnection(twilioWs: WebSocket, request: IncomingMessage): void {
  const clientIp = request.socket.remoteAddress;
  console.log('[Voice Stream] New WebSocket connection from:', clientIp);

  twilioWs.on('message', async (data: Buffer | string) => {
    try {
      const message = typeof data === 'string' ? data : data.toString();
      await handleTwilioMessage(twilioWs, message);
    } catch (error) {
      console.error('[Voice Stream] Error handling message:', error);
    }
  });

  twilioWs.on('close', (code: number, reason: Buffer) => {
    console.log('[Voice Stream] WebSocket closed:', {
      code,
      reason: reason.toString(),
    });

    // Clean up any sessions associated with this WebSocket
    for (const [streamSid, session] of activeSessions.entries()) {
      if (session.isConnected) {
        cleanupSession(streamSid).catch((error) => {
          console.error('[Voice Stream] Error cleaning up session:', error);
        });
      }
    }
  });

  twilioWs.on('error', (error: Error) => {
    console.error('[Voice Stream] WebSocket error:', error);
  });
}

// =============================================================================
// Route Handler
// =============================================================================

/**
 * GET handler - upgrades HTTP to WebSocket
 *
 * Note: Next.js doesn't natively support WebSocket upgrades in App Router.
 * This implementation uses a workaround that works in development and
 * with certain deployment configurations.
 *
 * For production, you may need to:
 * 1. Use a custom server (e.g., with express/fastify)
 * 2. Deploy to a platform that supports WebSocket upgrades
 * 3. Use a separate WebSocket service
 */
export async function GET(request: Request): Promise<Response> {
  // Check if this is a WebSocket upgrade request
  const upgradeHeader = request.headers.get('upgrade');

  if (upgradeHeader !== 'websocket') {
    return new Response('Expected WebSocket upgrade request', {
      status: 426,
      headers: {
        'Upgrade': 'websocket',
        'Connection': 'Upgrade',
      },
    });
  }

  // In Next.js App Router, we need to access the underlying Node.js
  // request and response objects for WebSocket upgrade
  // This is a simplified implementation - in production you'd use
  // a custom server or middleware
  try {
    // Access the raw request/response if available (custom server setup)
    // @ts-expect-error - Accessing internals for WebSocket upgrade
    const socket = request.socket;
    // @ts-expect-error - Accessing internals for WebSocket upgrade
    const head = request.head || Buffer.alloc(0);

    if (socket) {
      const wssInstance = getWebSocketServer();

      wssInstance.handleUpgrade(request as unknown as IncomingMessage, socket, head, (ws) => {
        wssInstance.emit('connection', ws, request);
        handleConnection(ws, request as unknown as IncomingMessage);
      });

      // Return empty response as WebSocket takes over
      return new Response(null, { status: 101 });
    }
  } catch {
    // WebSocket upgrade not available in this context
    console.warn('[Voice Stream] WebSocket upgrade not available in this deployment context');
  }

  // Fallback response for environments that don't support WebSocket
  return new Response(JSON.stringify({
    error: 'WebSocket upgrade not supported in this deployment context',
    message: 'Please deploy with a custom server that supports WebSocket upgrades',
    documentation: 'https://www.twilio.com/docs/voice/media-streams',
  }), {
    status: 501,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

/**
 * POST handler - alternative HTTP-based endpoint for testing
 */
export async function POST(request: Request): Promise<Response> {
  // This endpoint can be used for health checks or testing
  const body = await request.json().catch(() => ({}));

  return new Response(JSON.stringify({
    status: 'ok',
    message: 'Voice stream handler is running',
    activeSessions: activeSessions.size,
    timestamp: new Date().toISOString(),
    ...body,
  }), {
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

// =============================================================================
// Exports for Testing
// =============================================================================

export const __testing__ = {
  activeSessions,
  pendingTranscripts,
  createSession,
  cleanupSession,
  handleTwilioMessage,
  saveTranscriptSegment,
};
