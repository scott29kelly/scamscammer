/**
 * Twilio Call Status Webhook Handler
 *
 * POST /api/twilio/status - Receives status callbacks from Twilio
 *
 * This endpoint handles status updates throughout a call's lifecycle:
 * - queued, initiated, ringing: Early call stages
 * - in-progress: Call is connected
 * - completed: Call ended normally
 * - busy, no-answer, canceled, failed: Call did not connect
 *
 * @see https://www.twilio.com/docs/voice/twiml#callstatus-values
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import {
  validateTwilioSignature,
  getTwilioAuthToken,
  getWebhookBaseUrl,
  type TwilioCallStatus,
} from '@/lib/twilio';
import { CallStatus } from '@prisma/client';
import type { ApiErrorResponse } from '@/types';

/**
 * Twilio status callback payload structure
 */
interface TwilioStatusPayload {
  CallSid: string;
  AccountSid: string;
  From: string;
  To: string;
  CallStatus: TwilioCallStatus;
  CallDuration?: string;
  Direction: string;
  ApiVersion: string;
  Timestamp?: string;
}

/**
 * Maps Twilio call status to our CallStatus enum
 */
function mapTwilioStatusToCallStatus(twilioStatus: TwilioCallStatus): CallStatus {
  switch (twilioStatus) {
    case 'queued':
    case 'initiated':
      return CallStatus.RINGING;
    case 'ringing':
      return CallStatus.RINGING;
    case 'in-progress':
      return CallStatus.IN_PROGRESS;
    case 'completed':
      return CallStatus.COMPLETED;
    case 'busy':
    case 'canceled':
    case 'failed':
      return CallStatus.FAILED;
    case 'no-answer':
      return CallStatus.NO_ANSWER;
    default:
      // Fallback for any unknown status
      console.warn(`Unknown Twilio status received: ${twilioStatus}`);
      return CallStatus.FAILED;
  }
}

/**
 * Success response structure
 */
interface StatusUpdateResponse {
  success: boolean;
  callId: string;
  previousStatus: CallStatus;
  newStatus: CallStatus;
  duration?: number;
}

export async function POST(
  request: NextRequest
): Promise<NextResponse<StatusUpdateResponse | ApiErrorResponse>> {
  try {
    // Parse the URL-encoded form data from Twilio
    const formData = await request.formData();
    const params: Record<string, string> = {};

    for (const [key, value] of formData.entries()) {
      params[key] = value.toString();
    }

    // Extract required fields
    const payload: TwilioStatusPayload = {
      CallSid: params.CallSid || '',
      AccountSid: params.AccountSid || '',
      From: params.From || '',
      To: params.To || '',
      CallStatus: (params.CallStatus || '') as TwilioCallStatus,
      CallDuration: params.CallDuration,
      Direction: params.Direction || '',
      ApiVersion: params.ApiVersion || '',
      Timestamp: params.Timestamp,
    };

    // Validate required fields
    if (!payload.CallSid || !payload.CallStatus) {
      console.error('Missing required fields in Twilio status callback:', {
        hasCallSid: !!payload.CallSid,
        hasCallStatus: !!payload.CallStatus,
      });
      return NextResponse.json(
        {
          error: 'Missing required fields',
          code: 'MISSING_FIELDS',
          details: {
            CallSid: payload.CallSid ? 'present' : 'missing',
            CallStatus: payload.CallStatus ? 'present' : 'missing',
          },
        },
        { status: 400 }
      );
    }

    // Validate Twilio signature (skip in development if auth token not set)
    const twilioSignature = request.headers.get('X-Twilio-Signature');
    const authToken = process.env.TWILIO_AUTH_TOKEN;

    if (authToken && twilioSignature) {
      const baseUrl = getWebhookBaseUrl();
      const webhookUrl = `${baseUrl}/api/twilio/status`;

      const isValid = validateTwilioSignature(
        authToken,
        twilioSignature,
        webhookUrl,
        params
      );

      if (!isValid) {
        console.error('Invalid Twilio signature for status callback', {
          callSid: payload.CallSid,
        });
        return NextResponse.json(
          { error: 'Invalid signature', code: 'INVALID_SIGNATURE' },
          { status: 401 }
        );
      }
    } else if (process.env.NODE_ENV === 'production') {
      // In production, signature validation is required
      console.error('Missing Twilio signature or auth token in production');
      return NextResponse.json(
        { error: 'Signature validation required', code: 'MISSING_SIGNATURE' },
        { status: 401 }
      );
    }

    // Map Twilio status to our enum
    const newStatus = mapTwilioStatusToCallStatus(payload.CallStatus);
    const duration = payload.CallDuration ? parseInt(payload.CallDuration, 10) : undefined;

    // Log the status transition for debugging
    console.log('Twilio status callback received:', {
      callSid: payload.CallSid,
      twilioStatus: payload.CallStatus,
      mappedStatus: newStatus,
      duration,
    });

    // Find the call by Twilio SID
    const existingCall = await prisma.call.findUnique({
      where: { twilioSid: payload.CallSid },
      select: { id: true, status: true },
    });

    if (!existingCall) {
      // Call not found - this could happen if:
      // 1. The incoming call webhook hasn't been processed yet
      // 2. The call was never created in our system
      console.warn('Call not found for status update:', {
        callSid: payload.CallSid,
        status: payload.CallStatus,
      });

      // Return 200 to acknowledge receipt (Twilio expects this)
      // The incoming call handler should create the call record
      return NextResponse.json(
        { error: 'Call not found', code: 'CALL_NOT_FOUND' },
        { status: 404 }
      );
    }

    const previousStatus = existingCall.status;

    // Update the call status and duration
    const updatedCall = await prisma.call.update({
      where: { twilioSid: payload.CallSid },
      data: {
        status: newStatus,
        // Only update duration if provided and call is completed
        ...(duration !== undefined &&
          newStatus === CallStatus.COMPLETED && { duration }),
      },
      select: { id: true, status: true, duration: true },
    });

    console.log('Call status updated:', {
      callId: updatedCall.id,
      previousStatus,
      newStatus: updatedCall.status,
      duration: updatedCall.duration,
    });

    return NextResponse.json({
      success: true,
      callId: updatedCall.id,
      previousStatus,
      newStatus: updatedCall.status,
      duration: updatedCall.duration ?? undefined,
    });
  } catch (error) {
    console.error('Error processing Twilio status callback:', error);
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
