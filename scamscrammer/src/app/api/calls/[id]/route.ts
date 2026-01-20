/**
 * Single Call API Endpoint
 *
 * GET /api/calls/[id] - Get a single call with segments
 * PATCH /api/calls/[id] - Update call rating, notes, or tags
 * DELETE /api/calls/[id] - Delete a call and its segments
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import type { CallResponse, ApiErrorResponse } from '@/types';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/calls/[id]
 * Fetch a single call with all its segments
 */
export async function GET(
  _request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse<CallResponse | ApiErrorResponse>> {
  try {
    const { id } = await params;

    const call = await prisma.call.findUnique({
      where: { id },
      include: {
        segments: {
          orderBy: {
            timestamp: 'asc',
          },
        },
      },
    });

    if (!call) {
      return NextResponse.json(
        { error: 'Call not found' },
        { status: 404 }
      );
    }

    const response: CallResponse = {
      id: call.id,
      twilioSid: call.twilioSid,
      fromNumber: call.fromNumber,
      toNumber: call.toNumber,
      status: call.status,
      duration: call.duration,
      recordingUrl: call.recordingUrl,
      transcriptUrl: call.transcriptUrl,
      rating: call.rating,
      notes: call.notes,
      tags: call.tags,
      createdAt: call.createdAt,
      updatedAt: call.updatedAt,
      segments: call.segments.map((segment) => ({
        id: segment.id,
        callId: segment.callId,
        speaker: segment.speaker,
        text: segment.text,
        timestamp: segment.timestamp,
        createdAt: segment.createdAt,
      })),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching call:', error);
    return NextResponse.json(
      { error: 'Failed to fetch call' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/calls/[id]
 * Update call rating, notes, or tags
 */
export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse<CallResponse | ApiErrorResponse>> {
  try {
    const { id } = await params;
    const body = await request.json();

    // Validate the call exists
    const existingCall = await prisma.call.findUnique({
      where: { id },
    });

    if (!existingCall) {
      return NextResponse.json(
        { error: 'Call not found' },
        { status: 404 }
      );
    }

    // Build update data - only include fields that are present in the request
    const updateData: {
      rating?: number | null;
      notes?: string | null;
      tags?: string[];
    } = {};

    if ('rating' in body) {
      // Validate rating is 1-5 or null
      if (body.rating !== null && (typeof body.rating !== 'number' || body.rating < 1 || body.rating > 5)) {
        return NextResponse.json(
          {
            error: 'Invalid rating',
            details: { rating: 'Rating must be a number between 1 and 5, or null' },
          },
          { status: 400 }
        );
      }
      updateData.rating = body.rating;
    }

    if ('notes' in body) {
      if (body.notes !== null && typeof body.notes !== 'string') {
        return NextResponse.json(
          {
            error: 'Invalid notes',
            details: { notes: 'Notes must be a string or null' },
          },
          { status: 400 }
        );
      }
      updateData.notes = body.notes;
    }

    if ('tags' in body) {
      if (!Array.isArray(body.tags) || !body.tags.every((tag: unknown) => typeof tag === 'string')) {
        return NextResponse.json(
          {
            error: 'Invalid tags',
            details: { tags: 'Tags must be an array of strings' },
          },
          { status: 400 }
        );
      }
      updateData.tags = body.tags;
    }

    // Update the call
    const updatedCall = await prisma.call.update({
      where: { id },
      data: updateData,
      include: {
        segments: {
          orderBy: {
            timestamp: 'asc',
          },
        },
      },
    });

    const response: CallResponse = {
      id: updatedCall.id,
      twilioSid: updatedCall.twilioSid,
      fromNumber: updatedCall.fromNumber,
      toNumber: updatedCall.toNumber,
      status: updatedCall.status,
      duration: updatedCall.duration,
      recordingUrl: updatedCall.recordingUrl,
      transcriptUrl: updatedCall.transcriptUrl,
      rating: updatedCall.rating,
      notes: updatedCall.notes,
      tags: updatedCall.tags,
      createdAt: updatedCall.createdAt,
      updatedAt: updatedCall.updatedAt,
      segments: updatedCall.segments.map((segment) => ({
        id: segment.id,
        callId: segment.callId,
        speaker: segment.speaker,
        text: segment.text,
        timestamp: segment.timestamp,
        createdAt: segment.createdAt,
      })),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error updating call:', error);
    return NextResponse.json(
      { error: 'Failed to update call' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/calls/[id]
 * Delete a call and all its segments (cascade delete)
 */
export async function DELETE(
  _request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse<{ success: boolean } | ApiErrorResponse>> {
  try {
    const { id } = await params;

    // Validate the call exists
    const existingCall = await prisma.call.findUnique({
      where: { id },
    });

    if (!existingCall) {
      return NextResponse.json(
        { error: 'Call not found' },
        { status: 404 }
      );
    }

    // Delete the call (segments will cascade delete due to schema)
    await prisma.call.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting call:', error);
    return NextResponse.json(
      { error: 'Failed to delete call' },
      { status: 500 }
    );
  }
}
