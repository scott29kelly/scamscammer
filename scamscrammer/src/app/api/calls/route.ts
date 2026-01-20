/**
 * Calls API Endpoint
 *
 * GET /api/calls - Returns paginated list of calls with filtering and sorting
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import type { CallListResponse, ApiErrorResponse, CallListItem } from '@/types';
import { CallStatus, Prisma } from '@prisma/client';

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

type SortField = 'createdAt' | 'duration' | 'rating';
type SortOrder = 'asc' | 'desc';

export async function GET(
  request: NextRequest
): Promise<NextResponse<CallListResponse | ApiErrorResponse>> {
  try {
    const { searchParams } = new URL(request.url);

    // Parse pagination parameters
    const page = Math.max(1, parseInt(searchParams.get('page') || String(DEFAULT_PAGE), 10));
    const limit = Math.min(
      MAX_LIMIT,
      Math.max(1, parseInt(searchParams.get('limit') || String(DEFAULT_LIMIT), 10))
    );
    const skip = (page - 1) * limit;

    // Parse filter parameters
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const minRating = searchParams.get('minRating');
    const tag = searchParams.get('tag');

    // Parse sort parameters
    const sortField = (searchParams.get('sortBy') || 'createdAt') as SortField;
    const sortOrder = (searchParams.get('sortOrder') || 'desc') as SortOrder;

    // Validate sort field
    const validSortFields: SortField[] = ['createdAt', 'duration', 'rating'];
    const validSortOrders: SortOrder[] = ['asc', 'desc'];

    const actualSortField = validSortFields.includes(sortField) ? sortField : 'createdAt';
    const actualSortOrder = validSortOrders.includes(sortOrder) ? sortOrder : 'desc';

    // Build where clause
    const where: Prisma.CallWhereInput = {};

    if (status) {
      // Validate status is a valid CallStatus
      if (Object.values(CallStatus).includes(status as CallStatus)) {
        where.status = status as CallStatus;
      }
    }

    if (search) {
      where.OR = [
        { fromNumber: { contains: search, mode: 'insensitive' } },
        { toNumber: { contains: search, mode: 'insensitive' } },
        { notes: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (minRating) {
      const rating = parseInt(minRating, 10);
      if (!isNaN(rating) && rating >= 1 && rating <= 5) {
        where.rating = { gte: rating };
      }
    }

    if (tag) {
      where.tags = { has: tag };
    }

    // Build orderBy clause
    const orderBy: Prisma.CallOrderByWithRelationInput = {
      [actualSortField]: actualSortOrder,
    };

    // Run count and findMany in parallel
    const [total, calls] = await Promise.all([
      prisma.call.count({ where }),
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
