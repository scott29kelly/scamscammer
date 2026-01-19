/**
 * Twilio Recording Complete Webhook Handler
 *
 * This endpoint handles Twilio's recording status callbacks.
 * When a recording is completed:
 * 1. Validates the Twilio signature for security
 * 2. Fetches the recording from Twilio
 * 3. Uploads it to S3 storage
 * 4. Updates the call record with the recording URL
 *
 * @see https://www.twilio.com/docs/voice/api/recording#recordingstatuscallback
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  validateTwilioSignature,
  parseTwilioWebhookBody,
  getTwilioClient,
} from '@/lib/twilio';
import { getStorageClient } from '@/lib/storage';
import { prisma } from '@/lib/db';
import type { TwilioRecordingPayload, TwilioRecordingStatus } from '@/types';

/**
 * Fetches the recording audio from Twilio as a Buffer
 *
 * @param mediaUrl - The URL to the recording media (e.g., .mp3 or .wav)
 * @returns The audio data as a Buffer
 */
async function fetchRecordingFromTwilio(mediaUrl: string): Promise<Buffer> {
  // Twilio requires authentication for recording downloads
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  if (!accountSid || !authToken) {
    throw new Error('Twilio credentials not configured');
  }

  // Create basic auth header
  const credentials = Buffer.from(`${accountSid}:${authToken}`).toString('base64');

  const response = await fetch(mediaUrl, {
    headers: {
      Authorization: `Basic ${credentials}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch recording: ${response.status} ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * POST handler for Twilio recording status callbacks
 *
 * Twilio sends this webhook when a recording's status changes.
 * We're primarily interested in 'completed' status to fetch and store the recording.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  console.log('[Recording Webhook] Received recording status callback');

  try {
    // Parse the form data from Twilio
    const body = await parseTwilioWebhookBody(request);

    // Validate that this request actually came from Twilio
    const isValid = await validateTwilioSignature(request, body);
    if (!isValid) {
      console.warn('[Recording Webhook] Invalid Twilio signature');
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 403 }
      );
    }

    // Cast body to our typed payload
    const payload = body as unknown as TwilioRecordingPayload;

    console.log('[Recording Webhook] Recording status callback received:', {
      callSid: payload.CallSid,
      recordingSid: payload.RecordingSid,
      status: payload.RecordingStatus,
      duration: payload.RecordingDuration,
    });

    // Handle different recording statuses
    const status = payload.RecordingStatus as TwilioRecordingStatus;

    switch (status) {
      case 'completed':
        await handleRecordingCompleted(payload);
        break;

      case 'failed':
        await handleRecordingFailed(payload);
        break;

      case 'in-progress':
        // Recording is still in progress, nothing to do
        console.log('[Recording Webhook] Recording in progress:', payload.RecordingSid);
        break;

      case 'absent':
        // No recording was captured (e.g., call was too short)
        console.log('[Recording Webhook] No recording captured for call:', payload.CallSid);
        break;

      default:
        console.warn('[Recording Webhook] Unknown recording status:', status);
    }

    // Always return 200 to acknowledge receipt
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Recording Webhook] Error processing recording callback:', error);

    // Return 200 anyway to prevent Twilio from retrying
    // We log the error for debugging but don't want Twilio to keep sending the same webhook
    return NextResponse.json(
      { error: 'Internal server error', acknowledged: true },
      { status: 200 }
    );
  }
}

/**
 * Handles a completed recording by fetching it from Twilio,
 * uploading to S3, and updating the database
 */
async function handleRecordingCompleted(payload: TwilioRecordingPayload): Promise<void> {
  const { CallSid, RecordingSid, RecordingUrl, RecordingDuration } = payload;

  console.log('[Recording Webhook] Processing completed recording:', {
    callSid: CallSid,
    recordingSid: RecordingSid,
    duration: RecordingDuration,
  });

  // Find the call record in our database
  const call = await prisma.call.findUnique({
    where: { twilioSid: CallSid },
  });

  if (!call) {
    console.warn('[Recording Webhook] Call not found in database:', CallSid);
    // Don't throw - the call might have been deleted or never created
    return;
  }

  // If we already have a recording URL, skip processing (idempotency)
  if (call.recordingUrl) {
    console.log('[Recording Webhook] Recording already processed for call:', CallSid);
    return;
  }

  try {
    // Get recording details from Twilio
    const twilioClient = getTwilioClient();
    const recordingDetails = await twilioClient.getRecording(RecordingSid);

    console.log('[Recording Webhook] Fetched recording details:', {
      sid: recordingDetails.sid,
      mediaUrl: recordingDetails.mediaUrl,
      duration: recordingDetails.duration,
    });

    // Download the recording from Twilio
    // Use .wav format for better quality (Twilio provides both .mp3 and .wav)
    const wavUrl = recordingDetails.mediaUrl.replace('.mp3', '.wav');
    const audioBuffer = await fetchRecordingFromTwilio(wavUrl);

    console.log('[Recording Webhook] Downloaded recording, size:', audioBuffer.length, 'bytes');

    // Upload to S3
    const storageClient = getStorageClient();
    const uploadResult = await storageClient.uploadRecording(call.id, audioBuffer);

    console.log('[Recording Webhook] Uploaded to S3:', {
      key: uploadResult.key,
      size: uploadResult.size,
    });

    // Update the call record with the recording URL
    // We store the S3 URL, not the Twilio URL, so we have full control over the recording
    await prisma.call.update({
      where: { id: call.id },
      data: {
        recordingUrl: uploadResult.url,
        duration: parseInt(RecordingDuration, 10) || recordingDetails.duration,
      },
    });

    console.log('[Recording Webhook] Successfully processed recording for call:', CallSid);
  } catch (error) {
    console.error('[Recording Webhook] Error processing recording:', {
      callSid: CallSid,
      recordingSid: RecordingSid,
      error: error instanceof Error ? error.message : error,
    });

    // Re-throw to let the outer handler deal with it
    throw error;
  }
}

/**
 * Handles a failed recording by logging the error
 * and optionally updating the call record
 */
async function handleRecordingFailed(payload: TwilioRecordingPayload): Promise<void> {
  const { CallSid, RecordingSid, ErrorCode } = payload;

  console.error('[Recording Webhook] Recording failed:', {
    callSid: CallSid,
    recordingSid: RecordingSid,
    errorCode: ErrorCode,
  });

  // Optionally update the call record to indicate recording failure
  // We don't fail the call itself, just note that recording failed
  try {
    const call = await prisma.call.findUnique({
      where: { twilioSid: CallSid },
    });

    if (call && !call.notes?.includes('Recording failed')) {
      const existingNotes = call.notes || '';
      const failureNote = `Recording failed (Error: ${ErrorCode || 'unknown'})`;

      await prisma.call.update({
        where: { id: call.id },
        data: {
          notes: existingNotes ? `${existingNotes}\n${failureNote}` : failureNote,
        },
      });
    }
  } catch (error) {
    console.error('[Recording Webhook] Error updating call with recording failure:', error);
    // Don't re-throw - we've logged the error, that's sufficient
  }
}
