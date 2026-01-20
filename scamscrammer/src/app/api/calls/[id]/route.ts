/**
 * Individual Call API Endpoint
 *
 * GET /api/calls/[id] - Get single call with all segments
 * PATCH /api/calls/[id] - Update call rating, notes, tags
 * DELETE /api/calls/[id] - Delete call and associated data
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import type { CallResponse, ApiErrorResponse } from '@/types';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(
  request: NextRequest,
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

interface UpdateCallBody {
  rating?: number;
  notes?: string;
  tags?: string[];
}

export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse<CallResponse | ApiErrorResponse>> {
  try {
    const { id } = await params;

    // Check if call exists
    const existingCall = await prisma.call.findUnique({
      where: { id },
    });

    if (!existingCall) {
      return NextResponse.json(
        { error: 'Call not found' },
        { status: 404 }
      );
    }

    // Parse request body
    let body: UpdateCallBody;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 }
      );
    }

    // Validate and build update data
    const updateData: { rating?: number; notes?: string; tags?: string[] } = {};
    const validationErrors: Record<string, string> = {};

    // Validate rating if provided
    if (body.rating !== undefined) {
      if (typeof body.rating !== 'number' || !Number.isInteger(body.rating)) {
        validationErrors.rating = 'Rating must be an integer';
      } else if (body.rating < 1 || body.rating > 5) {
        validationErrors.rating = 'Rating must be between 1 and 5';
      } else {
        updateData.rating = body.rating;
      }
    }

    // Validate notes if provided
    if (body.notes !== undefined) {
      if (body.notes !== null && typeof body.notes !== 'string') {
        validationErrors.notes = 'Notes must be a string or null';
      } else {
        updateData.notes = body.notes;
      }
    }

    // Validate tags if provided
    if (body.tags !== undefined) {
      if (!Array.isArray(body.tags)) {
        validationErrors.tags = 'Tags must be an array';
      } else if (!body.tags.every((tag) => typeof tag === 'string')) {
        validationErrors.tags = 'All tags must be strings';
      } else {
        updateData.tags = body.tags;
      }
    }

    // Return validation errors if any
    if (Object.keys(validationErrors).length > 0) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: validationErrors,
        },
        { status: 400 }
      );
    }

    // Check if there's anything to update
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        {
          error: 'No valid fields to update',
          details: { body: 'Provide at least one of: rating, notes, tags' },
        },
        { status: 400 }
      );
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

export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse<null | ApiErrorResponse>> {
  try {
    const { id } = await params;

    // Check if call exists
    const existingCall = await prisma.call.findUnique({
      where: { id },
    });

    if (!existingCall) {
      return NextResponse.json(
        { error: 'Call not found' },
        { status: 404 }
      );
    }

    // Delete the call (segments are deleted via cascade)
    await prisma.call.delete({
      where: { id },
    });

    // TODO: Also delete recording from S3 storage if recordingUrl exists
    // This would require importing the storage service:
    // if (existingCall.recordingUrl) {
    //   await storage.deleteRecording(id);
    // }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('Error deleting call:', error);
    return NextResponse.json(
      { error: 'Failed to delete call' },
      { status: 500 }
    );
  }
}
