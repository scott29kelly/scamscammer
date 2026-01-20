/**
 * Recording Complete Webhook Handler
 *
 * POST /api/twilio/recording - Handles Twilio recording status callbacks
 *
 * When a call recording is completed:
 * 1. Validates the Twilio webhook signature
 * 2. Fetches the recording audio from Twilio
 * 3. Uploads the recording to S3 storage
 * 4. Updates the call record with the recording URL
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { validateTwilioSignature, fetchRecordingAudio } from '@/lib/twilio';
import { uploadRecording, getRecordingUrl } from '@/lib/storage';
import type { TwilioRecordingPayload, ApiErrorResponse } from '@/types';

/**
 * Parse form-urlencoded body from Twilio webhook
 */
async function parseFormData(request: NextRequest): Promise<Record<string, string>> {
  const text = await request.text();
  const params = new URLSearchParams(text);
  const result: Record<string, string> = {};
  params.forEach((value, key) => {
    result[key] = value;
  });
  return result;
}

/**
 * Map Twilio recording payload to typed interface
 */
function parseRecordingPayload(params: Record<string, string>): TwilioRecordingPayload {
  return {
    AccountSid: params.AccountSid || '',
    CallSid: params.CallSid || '',
    RecordingSid: params.RecordingSid || '',
    RecordingUrl: params.RecordingUrl || '',
    RecordingStatus: params.RecordingStatus as 'completed' | 'failed',
    RecordingDuration: params.RecordingDuration || '0',
    RecordingChannels: params.RecordingChannels || '1',
    RecordingSource: params.RecordingSource || '',
    RecordingStartTime: params.RecordingStartTime,
  };
}

/**
 * POST handler for Twilio recording status webhook
 */
export async function POST(
  request: NextRequest
): Promise<NextResponse<{ success: boolean } | ApiErrorResponse>> {
  try {
    // Parse the form-encoded body
    const params = await parseFormData(request);
    const payload = parseRecordingPayload(params);

    // Validate Twilio signature for security
    const signature = request.headers.get('x-twilio-signature') || '';
    const url = request.url;

    // Skip validation in development if no auth token configured
    const shouldValidate = process.env.NODE_ENV === 'production' || process.env.TWILIO_AUTH_TOKEN;
    if (shouldValidate && !validateTwilioSignature(signature, url, params)) {
      console.error('Invalid Twilio signature');
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 403 }
      );
    }

    // Log the incoming webhook
    console.log('Recording webhook received:', {
      callSid: payload.CallSid,
      recordingSid: payload.RecordingSid,
      status: payload.RecordingStatus,
      duration: payload.RecordingDuration,
    });

    // Find the call in our database
    const call = await prisma.call.findUnique({
      where: { twilioSid: payload.CallSid },
    });

    if (!call) {
      console.warn(`Call not found for SID: ${payload.CallSid}`);
      // Return success anyway to prevent Twilio from retrying
      return NextResponse.json({ success: true });
    }

    // Handle recording based on status
    if (payload.RecordingStatus === 'completed') {
      // Fetch the recording audio from Twilio
      const audioBuffer = await fetchRecordingAudio(payload.RecordingUrl);

      if (!audioBuffer) {
        console.error(`Failed to fetch recording audio for call ${call.id}`);
        // Update call to indicate recording fetch failed
        await prisma.call.update({
          where: { id: call.id },
          data: {
            notes: call.notes
              ? `${call.notes}\n[Recording fetch failed]`
              : '[Recording fetch failed]',
          },
        });
        return NextResponse.json({ success: true });
      }

      // Upload to S3 storage
      const storageKey = await uploadRecording(call.id, audioBuffer);

      if (!storageKey) {
        console.error(`Failed to upload recording to S3 for call ${call.id}`);
        // Update call to indicate upload failed
        await prisma.call.update({
          where: { id: call.id },
          data: {
            notes: call.notes
              ? `${call.notes}\n[Recording upload failed]`
              : '[Recording upload failed]',
          },
        });
        return NextResponse.json({ success: true });
      }

      // Generate a signed URL for the recording
      const recordingUrl = await getRecordingUrl(storageKey);

      // Update the call record with the recording URL
      await prisma.call.update({
        where: { id: call.id },
        data: {
          recordingUrl: recordingUrl || storageKey, // Fall back to storage key if URL generation fails
          duration: parseInt(payload.RecordingDuration, 10) || call.duration,
        },
      });

      console.log(`Recording processed successfully for call ${call.id}`);
    } else if (payload.RecordingStatus === 'failed') {
      // Log recording failure
      console.error(`Recording failed for call ${call.id}:`, {
        recordingSid: payload.RecordingSid,
        callSid: payload.CallSid,
      });

      // Update call to indicate recording failed
      await prisma.call.update({
        where: { id: call.id },
        data: {
          notes: call.notes
            ? `${call.notes}\n[Recording failed]`
            : '[Recording failed]',
        },
      });
    }

    // Always return success to Twilio
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error processing recording webhook:', error);
    // Return success to prevent Twilio from retrying on server errors
    // We log the error for investigation but don't block Twilio
    return NextResponse.json({ success: true });
  }
}
