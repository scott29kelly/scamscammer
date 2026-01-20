/**
 * Call Status Webhook Handler
 *
 * Receives status update callbacks from Twilio throughout the call lifecycle.
 * Updates the call record in the database based on status transitions.
 *
 * Twilio Call Status Flow:
 * - queued -> ringing -> in-progress -> completed
 *                    \-> busy/failed/no-answer/canceled
 *
 * @see https://www.twilio.com/docs/voice/api/call-resource#statuscallback
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { validateTwilioSignature, parseTwilioWebhookBody } from '@/lib/twilio';
import {
  TwilioStatusPayload,
  TwilioCallStatus,
  CallStatus,
  mapTwilioStatusToCallStatus,
} from '@/types';

/**
 * POST /api/twilio/status
 *
 * Handles call status callback webhooks from Twilio.
 * Updates the call record in the database with the new status.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Parse the webhook body
    const body = await parseTwilioWebhookBody(request);

    // Validate Twilio signature for security
    const isValid = await validateTwilioSignature(request, body);
    if (!isValid) {
      console.warn('[Status Webhook] Invalid Twilio signature');
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 403 }
      );
    }

    // Cast body to TwilioStatusPayload for type safety
    const payload = body as unknown as TwilioStatusPayload;

    // Validate required fields
    const callSid = payload.CallSid;
    if (!callSid) {
      console.warn('[Status Webhook] Missing CallSid');
      return NextResponse.json(
        { error: 'Missing CallSid' },
        { status: 400 }
      );
    }

    const twilioStatus = payload.CallStatus as TwilioCallStatus;
    if (!twilioStatus) {
      console.warn('[Status Webhook] Missing CallStatus');
      return NextResponse.json(
        { error: 'Missing CallStatus' },
        { status: 400 }
      );
    }

    // Map Twilio status to internal status
    const newStatus = mapTwilioStatusToCallStatus(twilioStatus);

    // Parse duration if available (only present on 'completed' status)
    let duration: number | undefined;
    if (payload.CallDuration) {
      const parsedDuration = parseInt(payload.CallDuration, 10);
      if (!isNaN(parsedDuration) && parsedDuration >= 0) {
        duration = parsedDuration;
      } else {
        console.warn(`[Status Webhook] Invalid CallDuration: ${payload.CallDuration}`);
      }
    }

    // Find the existing call record
    const existingCall = await prisma.call.findUnique({
      where: { twilioSid: callSid },
      select: { id: true, status: true },
    });

    if (!existingCall) {
      // Call not found - this can happen if status webhook arrives before
      // incoming webhook (race condition) or for outbound calls
      console.warn(`[Status Webhook] Call not found: ${callSid}`);

      // Return 200 to acknowledge receipt (Twilio retries on non-2xx)
      // The call may be created by incoming webhook shortly
      return NextResponse.json(
        { warning: 'Call not found', callSid },
        { status: 200 }
      );
    }

    // Check if this is a valid status transition
    // Avoid updating if the call is already in a terminal state
    const terminalStates: CallStatus[] = [
      CallStatus.COMPLETED,
      CallStatus.FAILED,
      CallStatus.NO_ANSWER,
    ];

    if (terminalStates.includes(existingCall.status as CallStatus)) {
      // Call is already in a terminal state, don't update
      console.log(
        `[Status Webhook] Call ${callSid} already in terminal state ${existingCall.status}, ignoring ${twilioStatus}`
      );
      return NextResponse.json({ success: true, status: 'already_terminal' });
    }

    // Build the update data
    const updateData: {
      status: CallStatus;
      duration?: number;
    } = {
      status: newStatus,
    };

    // Add duration if this is a completed call
    if (newStatus === CallStatus.COMPLETED && duration !== undefined) {
      updateData.duration = duration;
    }

    // Update the call record
    const updatedCall = await prisma.call.update({
      where: { twilioSid: callSid },
      data: updateData,
      select: { id: true, status: true, duration: true },
    });

    // Log the status transition for debugging
    console.log(
      `[Status Webhook] Call ${callSid} status updated: ${existingCall.status} -> ${newStatus}` +
        (duration !== undefined ? ` (duration: ${duration}s)` : '')
    );

    // Return success response
    // Twilio expects a 200 response within 15 seconds
    return NextResponse.json({
      success: true,
      callId: updatedCall.id,
      status: updatedCall.status,
      duration: updatedCall.duration,
    });
  } catch (error) {
    // Log the error with context
    console.error('[Status Webhook] Error processing status update:', error);

    // Return 500 for internal errors
    // Twilio will retry failed webhooks
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Respond to other HTTP methods with 405 Method Not Allowed
 */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  );
}

export async function PUT(): Promise<NextResponse> {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  );
}

export async function DELETE(): Promise<NextResponse> {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  );
}
