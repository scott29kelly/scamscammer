/**
 * Recording Complete Webhook Handler
 *
 * POST /api/twilio/recording - Handles Twilio recording status callbacks
 *
 * When a recording is completed, this endpoint:
 * 1. Validates the Twilio request signature
 * 2. Fetches the recording audio from Twilio
 * 3. Uploads the recording to S3 storage
 * 4. Updates the call record with the recording URL
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import {
  createTwilioClient,
  TwilioClient,
  validateTwilioSignature,
  type TwilioRecordingPayload,
} from '@/lib/twilio';
import { StorageClient, generateStorageKey } from '@/lib/storage';
import type { ApiErrorResponse } from '@/types';

/**
 * Success response for recording webhook
 */
export interface RecordingWebhookResponse {
  success: boolean;
  message: string;
  recordingUrl?: string;
}

/**
 * Parse URL-encoded form data from request body
 */
async function parseFormData(request: NextRequest): Promise<Record<string, string>> {
  const text = await request.text();
  const params: Record<string, string> = {};

  for (const pair of text.split('&')) {
    const [key, value] = pair.split('=');
    if (key && value !== undefined) {
      params[decodeURIComponent(key)] = decodeURIComponent(value.replace(/\+/g, ' '));
    }
  }

  return params;
}

/**
 * Validates the incoming Twilio request
 */
function validateRequest(
  request: NextRequest,
  params: Record<string, string>,
  authToken: string
): boolean {
  const signature = request.headers.get('X-Twilio-Signature');

  if (!signature) {
    console.warn('Recording webhook: Missing X-Twilio-Signature header');
    return false;
  }

  // Build the full URL for signature validation
  const url = request.url;

  return validateTwilioSignature(authToken, signature, url, params);
}

export async function POST(
  request: NextRequest
): Promise<NextResponse<RecordingWebhookResponse | ApiErrorResponse>> {
  try {
    // Parse the form data from Twilio
    const params = await parseFormData(request);

    // Initialize clients
    const twilioClient = createTwilioClient();
    const storageClient = new StorageClient();

    // Validate the request signature in production
    if (process.env.NODE_ENV === 'production' || process.env.VALIDATE_TWILIO_SIGNATURE === 'true') {
      const authToken = twilioClient.getAuthToken();

      if (!authToken) {
        console.error('Recording webhook: Missing Twilio auth token');
        return NextResponse.json(
          { error: 'Server configuration error' },
          { status: 500 }
        );
      }

      if (!validateRequest(request, params, authToken)) {
        console.warn('Recording webhook: Invalid signature');
        return NextResponse.json(
          { error: 'Invalid request signature' },
          { status: 403 }
        );
      }
    }

    // Extract recording details from the payload
    const payload: TwilioRecordingPayload = {
      AccountSid: params.AccountSid || '',
      CallSid: params.CallSid || '',
      RecordingSid: params.RecordingSid || '',
      RecordingUrl: params.RecordingUrl || '',
      RecordingStatus: params.RecordingStatus as TwilioRecordingPayload['RecordingStatus'],
      RecordingDuration: params.RecordingDuration,
      RecordingChannels: params.RecordingChannels,
      RecordingSource: params.RecordingSource,
      RecordingStartTime: params.RecordingStartTime,
      ErrorCode: params.ErrorCode,
    };

    // Validate required fields
    if (!payload.CallSid || !payload.RecordingSid) {
      console.error('Recording webhook: Missing required fields', {
        hasCallSid: !!payload.CallSid,
        hasRecordingSid: !!payload.RecordingSid,
      });
      return NextResponse.json(
        { error: 'Missing required fields: CallSid or RecordingSid' },
        { status: 400 }
      );
    }

    console.log('Recording webhook received:', {
      callSid: payload.CallSid,
      recordingSid: payload.RecordingSid,
      status: payload.RecordingStatus,
      duration: payload.RecordingDuration,
    });

    // Handle different recording statuses
    switch (payload.RecordingStatus) {
      case 'completed': {
        // Recording is complete - fetch, upload, and update database
        return await handleCompletedRecording(
          payload,
          twilioClient,
          storageClient
        );
      }

      case 'failed': {
        // Recording failed - log the error
        console.error('Recording failed:', {
          callSid: payload.CallSid,
          recordingSid: payload.RecordingSid,
          errorCode: payload.ErrorCode,
        });

        // Still acknowledge the webhook
        return NextResponse.json({
          success: true,
          message: 'Recording failure acknowledged',
        });
      }

      case 'in-progress': {
        // Recording is in progress - acknowledge
        return NextResponse.json({
          success: true,
          message: 'Recording in progress acknowledged',
        });
      }

      case 'absent': {
        // No recording was made (e.g., call was too short)
        console.log('No recording made for call:', payload.CallSid);
        return NextResponse.json({
          success: true,
          message: 'Recording absent acknowledged',
        });
      }

      default: {
        console.warn('Unknown recording status:', payload.RecordingStatus);
        return NextResponse.json({
          success: true,
          message: 'Unknown status acknowledged',
        });
      }
    }
  } catch (error) {
    console.error('Recording webhook error:', error);
    return NextResponse.json(
      { error: 'Internal server error processing recording' },
      { status: 500 }
    );
  }
}

/**
 * Handles a completed recording
 *
 * 1. Fetches the recording from Twilio
 * 2. Uploads to S3
 * 3. Updates the call record with the recording URL
 */
async function handleCompletedRecording(
  payload: TwilioRecordingPayload,
  twilioClient: TwilioClient,
  storageClient: StorageClient
): Promise<NextResponse<RecordingWebhookResponse | ApiErrorResponse>> {
  const { CallSid, RecordingSid, RecordingUrl, RecordingDuration } = payload;

  // Find the call record in our database
  const call = await prisma.call.findFirst({
    where: {
      twilioSid: CallSid,
    },
  });

  if (!call) {
    console.error('Call not found for recording:', CallSid);
    // Still return 200 to acknowledge - Twilio will retry on non-2xx
    return NextResponse.json({
      success: true,
      message: 'Recording received but call not found in database',
    });
  }

  // Fetch the recording audio from Twilio
  const recordingBuffer = await twilioClient.fetchRecordingAudio(RecordingUrl);

  if (!recordingBuffer) {
    console.error('Failed to fetch recording from Twilio:', RecordingSid);
    return NextResponse.json(
      { error: 'Failed to fetch recording from Twilio' },
      { status: 502 }
    );
  }

  // Generate storage key and upload to S3
  const storageKey = generateStorageKey(CallSid, RecordingSid);
  const duration = RecordingDuration ? parseInt(RecordingDuration, 10) : undefined;

  let uploadResult;
  try {
    uploadResult = await storageClient.uploadRecording(storageKey, recordingBuffer, {
      callSid: CallSid,
      recordingSid: RecordingSid,
      duration,
      contentType: 'audio/mpeg',
      uploadedAt: new Date().toISOString(),
    });
  } catch (uploadError) {
    console.error('Failed to upload recording to S3:', uploadError);
    return NextResponse.json(
      { error: 'Failed to upload recording to storage' },
      { status: 502 }
    );
  }

  // Update the call record with the recording URL
  await prisma.call.update({
    where: {
      id: call.id,
    },
    data: {
      recordingUrl: uploadResult.url,
      // Update duration if we have it and call doesn't have duration yet
      ...(duration !== undefined && call.duration === null && { duration }),
    },
  });

  console.log('Recording processed successfully:', {
    callSid: CallSid,
    recordingSid: RecordingSid,
    storageUrl: uploadResult.url,
  });

  return NextResponse.json({
    success: true,
    message: 'Recording processed successfully',
    recordingUrl: uploadResult.url,
  });
}
