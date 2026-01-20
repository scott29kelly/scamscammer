/**
 * Twilio Call Status Webhook Handler
 *
 * POST /api/twilio/status - Receives call status updates from Twilio
 *
 * This endpoint is called by Twilio whenever the status of a call changes.
 * It updates the corresponding call record in the database with the new status
 * and duration (when available).
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import type { TwilioStatusPayload, ApiErrorResponse } from '@/types';
import { CallStatus } from '@prisma/client';

/**
 * Maps Twilio call status strings to our CallStatus enum
 */
function mapTwilioStatusToCallStatus(twilioStatus: TwilioStatusPayload['CallStatus']): CallStatus {
  switch (twilioStatus) {
    case 'queued':
    case 'ringing':
      return CallStatus.RINGING;
    case 'in-progress':
      return CallStatus.IN_PROGRESS;
    case 'completed':
      return CallStatus.COMPLETED;
    case 'busy':
    case 'no-answer':
    case 'canceled':
      return CallStatus.NO_ANSWER;
    case 'failed':
      return CallStatus.FAILED;
    default:
      // TypeScript should catch this, but handle unknown statuses gracefully
      console.warn(`Unknown Twilio status: ${twilioStatus}, defaulting to FAILED`);
      return CallStatus.FAILED;
  }
}

/**
 * Validates that the payload contains required fields
 */
function isValidTwilioStatusPayload(payload: unknown): payload is TwilioStatusPayload {
  if (typeof payload !== 'object' || payload === null) {
    return false;
  }

  const p = payload as Record<string, unknown>;

  // Required fields
  if (typeof p.CallSid !== 'string' || p.CallSid.length === 0) {
    return false;
  }
  if (typeof p.AccountSid !== 'string' || p.AccountSid.length === 0) {
    return false;
  }
  if (typeof p.From !== 'string') {
    return false;
  }
  if (typeof p.To !== 'string') {
    return false;
  }
  if (typeof p.CallStatus !== 'string') {
    return false;
  }
  if (typeof p.Direction !== 'string') {
    return false;
  }

  // Validate CallStatus is one of the expected values
  const validStatuses = ['queued', 'ringing', 'in-progress', 'completed', 'busy', 'failed', 'no-answer', 'canceled'];
  if (!validStatuses.includes(p.CallStatus)) {
    return false;
  }

  return true;
}

/**
 * Success response for Twilio webhooks
 */
interface TwilioWebhookSuccessResponse {
  success: true;
  callId: string;
  status: CallStatus;
}

export async function POST(
  request: NextRequest
): Promise<NextResponse<TwilioWebhookSuccessResponse | ApiErrorResponse>> {
  try {
    // Parse the request body
    // Twilio sends form-urlencoded data by default, but can also send JSON
    const contentType = request.headers.get('content-type') || '';
    let payload: unknown;

    if (contentType.includes('application/x-www-form-urlencoded')) {
      const formData = await request.formData();
      payload = Object.fromEntries(formData.entries());
    } else if (contentType.includes('application/json')) {
      payload = await request.json();
    } else {
      // Try to parse as form data (Twilio default)
      try {
        const formData = await request.formData();
        payload = Object.fromEntries(formData.entries());
      } catch {
        // Fall back to JSON parsing
        const text = await request.text();
        payload = JSON.parse(text);
      }
    }

    // Validate the payload
    if (!isValidTwilioStatusPayload(payload)) {
      console.error('Invalid Twilio status payload:', payload);
      return NextResponse.json(
        {
          error: 'Invalid payload',
          code: 'INVALID_PAYLOAD',
          details: { message: 'Missing or invalid required fields' },
        },
        { status: 400 }
      );
    }

    // Map Twilio status to our CallStatus enum
    const callStatus = mapTwilioStatusToCallStatus(payload.CallStatus);

    // Parse duration if available (Twilio sends it as a string)
    const duration = payload.CallDuration ? parseInt(payload.CallDuration, 10) : undefined;

    // Try to find and update the existing call record
    const existingCall = await prisma.call.findUnique({
      where: { twilioSid: payload.CallSid },
    });

    if (existingCall) {
      // Update existing call
      const updatedCall = await prisma.call.update({
        where: { twilioSid: payload.CallSid },
        data: {
          status: callStatus,
          ...(duration !== undefined && { duration }),
        },
      });

      console.log(
        `Call status updated: ${payload.CallSid} -> ${callStatus}${duration !== undefined ? ` (${duration}s)` : ''}`
      );

      return NextResponse.json({
        success: true,
        callId: updatedCall.id,
        status: updatedCall.status,
      });
    } else {
      // Create new call record if it doesn't exist
      // This can happen if the status callback arrives before the incoming call handler
      const newCall = await prisma.call.create({
        data: {
          twilioSid: payload.CallSid,
          fromNumber: payload.From,
          toNumber: payload.To,
          status: callStatus,
          ...(duration !== undefined && { duration }),
        },
      });

      console.log(
        `New call created from status webhook: ${payload.CallSid} -> ${callStatus}${duration !== undefined ? ` (${duration}s)` : ''}`
      );

      return NextResponse.json({
        success: true,
        callId: newCall.id,
        status: newCall.status,
      });
    }
  } catch (error) {
    // Log the full error for debugging
    console.error('Error processing call status webhook:', error);

    // Check for specific Prisma errors
    if (error instanceof Error) {
      // Handle unique constraint violations or other known errors
      if (error.message.includes('Unique constraint')) {
        return NextResponse.json(
          {
            error: 'Call already exists',
            code: 'DUPLICATE_CALL',
          },
          { status: 409 }
        );
      }
    }

    return NextResponse.json(
      {
        error: 'Failed to process call status update',
        code: 'INTERNAL_ERROR',
      },
      { status: 500 }
    );
  }
}
