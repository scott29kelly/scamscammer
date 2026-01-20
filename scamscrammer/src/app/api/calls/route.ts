/**
 * Calls API Endpoint
 *
 * GET /api/calls - List calls with pagination, filtering, and sorting
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import type { CallListResponse, ApiErrorResponse, CallListItem } from '@/types';
import { CallStatus, Prisma } from '@prisma/client';

export async function GET(
  request: NextRequest
): Promise<NextResponse<CallListResponse | ApiErrorResponse>> {
  try {
    const searchParams = request.nextUrl.searchParams;

    // Parse pagination parameters
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)));
    const skip = (page - 1) * limit;

    // Parse filter parameters
    const status = searchParams.get('status');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // Parse sorting parameters
    const sortBy = searchParams.get('sortBy') ?? 'createdAt';
    const sortOrder = searchParams.get('sortOrder') ?? 'desc';

    // Validate sortBy parameter
    const validSortFields = ['createdAt', 'duration', 'rating'];
    if (!validSortFields.includes(sortBy)) {
      return NextResponse.json(
        {
          error: 'Invalid sort field',
          details: { sortBy: `Must be one of: ${validSortFields.join(', ')}` },
        },
        { status: 400 }
      );
    }

    // Validate sortOrder parameter
    if (!['asc', 'desc'].includes(sortOrder)) {
      return NextResponse.json(
        {
          error: 'Invalid sort order',
          details: { sortOrder: 'Must be either "asc" or "desc"' },
        },
        { status: 400 }
      );
    }

    // Validate status parameter if provided
    if (status && !Object.values(CallStatus).includes(status as CallStatus)) {
      return NextResponse.json(
        {
          error: 'Invalid status filter',
          details: { status: `Must be one of: ${Object.values(CallStatus).join(', ')}` },
        },
        { status: 400 }
      );
    }

    // Build where clause
    const where: Prisma.CallWhereInput = {};

    if (status) {
      where.status = status as CallStatus;
    }

    if (startDate) {
      const parsedStartDate = new Date(startDate);
      if (isNaN(parsedStartDate.getTime())) {
        return NextResponse.json(
          {
            error: 'Invalid start date',
            details: { startDate: 'Must be a valid ISO date string' },
          },
          { status: 400 }
        );
      }
      where.createdAt = { ...((where.createdAt as Prisma.DateTimeFilter) || {}), gte: parsedStartDate };
    }

    if (endDate) {
      const parsedEndDate = new Date(endDate);
      if (isNaN(parsedEndDate.getTime())) {
        return NextResponse.json(
          {
            error: 'Invalid end date',
            details: { endDate: 'Must be a valid ISO date string' },
          },
          { status: 400 }
        );
      }
      where.createdAt = { ...((where.createdAt as Prisma.DateTimeFilter) || {}), lte: parsedEndDate };
    }

    // Build orderBy clause
    const orderBy: Prisma.CallOrderByWithRelationInput = {
      [sortBy]: sortOrder as 'asc' | 'desc',
    };

    // Execute queries in parallel
    const [calls, total] = await Promise.all([
      prisma.call.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          _count: {
            select: {
              segments: true,
            },
          },
        },
      }),
      prisma.call.count({ where }),
    ]);

    // Calculate pagination info
    const totalPages = Math.ceil(total / limit);

    // Map to CallListItem format
    const callListItems: CallListItem[] = calls.map((call) => ({
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
      _count: call._count,
    }));

    const response: CallListResponse = {
      calls: callListItems,
      pagination: {
        total,
        page,
        limit,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching calls:', error);
    return NextResponse.json(
      { error: 'Failed to fetch calls' },
      { status: 500 }
    );
  }
}
