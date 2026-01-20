import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import type { CallListResponse, CallListQueryParams, ApiErrorResponse } from '@/types';
import { CallStatus } from '@prisma/client';

/**
 * GET /api/calls - List all calls with pagination, filtering, and sorting
 */
export async function GET(request: NextRequest): Promise<NextResponse<CallListResponse | ApiErrorResponse>> {
  try {
    const searchParams = request.nextUrl.searchParams;
    const params: CallListQueryParams = {
      page: searchParams.get('page') ?? undefined,
      limit: searchParams.get('limit') ?? undefined,
      status: searchParams.get('status') as CallStatus | undefined,
      startDate: searchParams.get('startDate') ?? undefined,
      endDate: searchParams.get('endDate') ?? undefined,
      sortBy: searchParams.get('sortBy') as 'createdAt' | 'duration' | undefined,
      sortOrder: searchParams.get('sortOrder') as 'asc' | 'desc' | undefined,
    };

    // Parse pagination parameters
    const page = Math.max(1, parseInt(params.page ?? '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(params.limit ?? '20', 10)));
    const skip = (page - 1) * limit;

    // Build where clause for filtering
    const where: {
      status?: CallStatus;
      createdAt?: {
        gte?: Date;
        lte?: Date;
      };
    } = {};

    // Filter by status
    if (params.status && Object.values(CallStatus).includes(params.status)) {
      where.status = params.status;
    }

    // Filter by date range
    if (params.startDate || params.endDate) {
      where.createdAt = {};
      if (params.startDate) {
        const startDate = new Date(params.startDate);
        if (!isNaN(startDate.getTime())) {
          where.createdAt.gte = startDate;
        }
      }
      if (params.endDate) {
        const endDate = new Date(params.endDate);
        if (!isNaN(endDate.getTime())) {
          // Set to end of day
          endDate.setHours(23, 59, 59, 999);
          where.createdAt.lte = endDate;
        }
      }
    }

    // Build orderBy clause
    const sortBy = params.sortBy ?? 'createdAt';
    const sortOrder = params.sortOrder ?? 'desc';
    const orderBy = { [sortBy]: sortOrder };

    // Execute queries in parallel
    const [calls, total] = await Promise.all([
      prisma.call.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          _count: {
            select: { segments: true },
          },
        },
      }),
      prisma.call.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    const response: CallListResponse = {
      calls,
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
