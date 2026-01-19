import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import type { CallResponse, CallUpdatePayload, ApiErrorResponse } from '@/types';

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

/**
 * GET /api/calls/:id - Get a single call with all segments
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
          orderBy: { timestamp: 'asc' },
        },
      },
    });

    if (!call) {
      return NextResponse.json(
        { error: 'Call not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(call);
  } catch (error) {
    console.error('Error fetching call:', error);
    return NextResponse.json(
      { error: 'Failed to fetch call' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/calls/:id - Update call rating, notes, or tags
 */
export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse<CallResponse | ApiErrorResponse>> {
  try {
    const { id } = await params;
    const body = await request.json() as CallUpdatePayload;

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

    // Validate and build update data
    const updateData: Partial<CallUpdatePayload> = {};
    const validationErrors: Record<string, string> = {};

    // Validate rating (1-5)
    if (body.rating !== undefined) {
      if (typeof body.rating !== 'number' || body.rating < 1 || body.rating > 5) {
        validationErrors.rating = 'Rating must be a number between 1 and 5';
      } else {
        updateData.rating = Math.floor(body.rating);
      }
    }

    // Validate notes (string)
    if (body.notes !== undefined) {
      if (typeof body.notes !== 'string') {
        validationErrors.notes = 'Notes must be a string';
      } else {
        updateData.notes = body.notes;
      }
    }

    // Validate tags (array of strings)
    if (body.tags !== undefined) {
      if (!Array.isArray(body.tags) || !body.tags.every(tag => typeof tag === 'string')) {
        validationErrors.tags = 'Tags must be an array of strings';
      } else {
        updateData.tags = body.tags;
      }
    }

    // Return validation errors if any
    if (Object.keys(validationErrors).length > 0) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationErrors },
        { status: 400 }
      );
    }

    // Check if there's anything to update
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    // Update the call
    const updatedCall = await prisma.call.update({
      where: { id },
      data: updateData,
      include: {
        segments: {
          orderBy: { timestamp: 'asc' },
        },
      },
    });

    return NextResponse.json(updatedCall);
  } catch (error) {
    console.error('Error updating call:', error);
    return NextResponse.json(
      { error: 'Failed to update call' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/calls/:id - Delete a call and its associated data
 */
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse<null | ApiErrorResponse>> {
  try {
    const { id } = await params;

    // Check if the call exists and get recording URL
    const call = await prisma.call.findUnique({
      where: { id },
      select: { id: true, recordingUrl: true },
    });

    if (!call) {
      return NextResponse.json(
        { error: 'Call not found' },
        { status: 404 }
      );
    }

    // TODO: Delete recording from S3 storage if recordingUrl exists
    // This will be implemented when the storage service is ready
    // if (call.recordingUrl) {
    //   await storage.deleteRecording(call.id);
    // }

    // Delete the call (segments are cascade deleted via Prisma relation)
    await prisma.call.delete({
      where: { id },
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('Error deleting call:', error);
    return NextResponse.json(
      { error: 'Failed to delete call' },
      { status: 500 }
    );
  }
}
