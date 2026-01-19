/**
 * Call Detail API Endpoint
 *
 * GET /api/calls/[id] - Returns a single call with all segments
 * PATCH /api/calls/[id] - Updates a call's rating, notes, or tags
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import type { CallResponse, ApiErrorResponse } from '@/types';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/calls/[id]
 * Fetch a single call by ID with all its segments
 */
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

/**
 * PATCH /api/calls/[id]
 * Update a call's rating, notes, or tags
 */
export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse<CallResponse | ApiErrorResponse>> {
  try {
    const { id } = await params;
    const body: UpdateCallBody = await request.json();

    // Validate rating if provided
    if (body.rating !== undefined) {
      if (!Number.isInteger(body.rating) || body.rating < 1 || body.rating > 5) {
        return NextResponse.json(
          { error: 'Rating must be an integer between 1 and 5' },
          { status: 400 }
        );
      }
    }

    // Validate tags if provided
    if (body.tags !== undefined) {
      if (!Array.isArray(body.tags) || !body.tags.every((tag) => typeof tag === 'string')) {
        return NextResponse.json(
          { error: 'Tags must be an array of strings' },
          { status: 400 }
        );
      }
    }

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

    // Build update data
    const updateData: { rating?: number; notes?: string; tags?: string[] } = {};
    if (body.rating !== undefined) updateData.rating = body.rating;
    if (body.notes !== undefined) updateData.notes = body.notes;
    if (body.tags !== undefined) updateData.tags = body.tags;

    // Update the call
    const call = await prisma.call.update({
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
    console.error('Error updating call:', error);
    return NextResponse.json(
      { error: 'Failed to update call' },
      { status: 500 }
    );
  }
}
