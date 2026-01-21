/**
 * Call Detail API Endpoint
 *
 * GET /api/calls/[id] - Returns a single call with all segments
 * PATCH /api/calls/[id] - Updates a call's rating, notes, or tags
 * DELETE /api/calls/[id] - Deletes a call and its recordings from S3
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import type { CallResponse, ApiErrorResponse, StorageDeleteResult } from '@/types';
import { storageClient } from '@/lib/storage';

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
      isPublic: call.isPublic,
      isFeatured: call.isFeatured,
      persona: call.persona,
      title: call.title,
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
      isPublic: call.isPublic,
      isFeatured: call.isFeatured,
      persona: call.persona,
      title: call.title,
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

/**
 * DELETE /api/calls/[id]
 * Delete a call record and its associated S3 recordings
 */
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse<StorageDeleteResult | ApiErrorResponse>> {
  try {
    const { id } = await params;

    // Find the call to get recording URL before deleting
    const call = await prisma.call.findUnique({
      where: { id },
    });

    if (!call) {
      return NextResponse.json(
        { error: 'Call not found' },
        { status: 404 }
      );
    }

    // Extract S3 key from recording URL if it exists
    let recordingKey: string | undefined;
    if (call.recordingUrl) {
      // Recording URLs are in format: https://endpoint/bucket/key
      // We need to extract the key portion
      try {
        const url = new URL(call.recordingUrl);
        // The path will be /bucket/key, we want everything after the bucket
        const pathParts = url.pathname.split('/').filter(Boolean);
        if (pathParts.length >= 2) {
          // Skip the bucket name (first part) and join the rest as the key
          recordingKey = pathParts.slice(1).join('/');
        }
      } catch {
        // Invalid URL format, skip S3 deletion
        console.warn(`Invalid recording URL format for call ${id}: ${call.recordingUrl}`);
      }
    }

    // Delete the recording from S3 if we have a key
    let recordingDeleted = false;
    if (recordingKey) {
      try {
        recordingDeleted = await storageClient.deleteRecording(recordingKey);
        if (!recordingDeleted) {
          console.warn(`Failed to delete recording from S3 for call ${id}: ${recordingKey}`);
        }
      } catch (storageError) {
        // Log but don't fail the request if S3 deletion fails
        console.error(`Error deleting recording from S3 for call ${id}:`, storageError);
      }
    }

    // Delete transcript from S3 if it exists
    if (call.transcriptUrl) {
      try {
        const transcriptUrl = new URL(call.transcriptUrl);
        const transcriptPathParts = transcriptUrl.pathname.split('/').filter(Boolean);
        if (transcriptPathParts.length >= 2) {
          const transcriptKey = transcriptPathParts.slice(1).join('/');
          await storageClient.deleteRecording(transcriptKey);
        }
      } catch {
        // Log but don't fail if transcript deletion fails
        console.warn(`Failed to delete transcript for call ${id}`);
      }
    }

    // Delete the call from the database (segments will cascade delete due to schema)
    await prisma.call.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      key: recordingKey,
    });
  } catch (error) {
    console.error('Error deleting call:', error);
    return NextResponse.json(
      { error: 'Failed to delete call' },
      { status: 500 }
    );
  }
}
