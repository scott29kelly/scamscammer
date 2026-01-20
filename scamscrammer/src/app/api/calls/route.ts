/**
 * Calls API Endpoint
 *
 * GET /api/calls - Returns paginated list of calls with filtering and sorting
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import type { CallListResponse, ApiErrorResponse, PaginationInfo, CallListItem } from '@/types';
import { CallStatus } from '@prisma/client';

interface CallQueryParams {
  page: number;
  limit: number;
  status?: CallStatus;
  startDate?: Date;
  endDate?: Date;
  sortBy: 'createdAt' | 'duration' | 'rating';
  sortOrder: 'asc' | 'desc';
  search?: string;
}

function parseQueryParams(request: NextRequest): CallQueryParams {
  const searchParams = request.nextUrl.searchParams;

  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));

  const statusParam = searchParams.get('status');
  const status = statusParam && Object.values(CallStatus).includes(statusParam as CallStatus)
    ? (statusParam as CallStatus)
    : undefined;

  const startDateParam = searchParams.get('startDate');
  const startDate = startDateParam ? new Date(startDateParam) : undefined;

  const endDateParam = searchParams.get('endDate');
  const endDate = endDateParam ? new Date(endDateParam) : undefined;

  const sortByParam = searchParams.get('sortBy');
  const sortBy = ['createdAt', 'duration', 'rating'].includes(sortByParam || '')
    ? (sortByParam as 'createdAt' | 'duration' | 'rating')
    : 'createdAt';

  const sortOrderParam = searchParams.get('sortOrder');
  const sortOrder = sortOrderParam === 'asc' ? 'asc' : 'desc';

  const search = searchParams.get('search') || undefined;

  return {
    page,
    limit,
    status,
    startDate,
    endDate,
    sortBy,
    sortOrder,
    search,
  };
}

export async function GET(
  request: NextRequest
): Promise<NextResponse<CallListResponse | ApiErrorResponse>> {
  try {
    const params = parseQueryParams(request);

    // Build where clause for filtering
    const where: {
      status?: CallStatus;
      createdAt?: {
        gte?: Date;
        lte?: Date;
      };
      OR?: Array<{
        fromNumber?: { contains: string; mode: 'insensitive' };
        toNumber?: { contains: string; mode: 'insensitive' };
        notes?: { contains: string; mode: 'insensitive' };
      }>;
    } = {};

    if (params.status) {
      where.status = params.status;
    }

    if (params.startDate || params.endDate) {
      where.createdAt = {};
      if (params.startDate) {
        where.createdAt.gte = params.startDate;
      }
      if (params.endDate) {
        where.createdAt.lte = params.endDate;
      }
    }

    if (params.search) {
      where.OR = [
        { fromNumber: { contains: params.search, mode: 'insensitive' } },
        { toNumber: { contains: params.search, mode: 'insensitive' } },
        { notes: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    // Run count and query in parallel
    const [total, calls] = await Promise.all([
      prisma.call.count({ where }),
      prisma.call.findMany({
        where,
        orderBy: {
          [params.sortBy]: params.sortOrder,
        },
        skip: (params.page - 1) * params.limit,
        take: params.limit,
        include: {
          _count: {
            select: {
              segments: true,
            },
          },
        },
      }),
    ]);

    const totalPages = Math.ceil(total / params.limit);

    const pagination: PaginationInfo = {
      total,
      page: params.page,
      limit: params.limit,
      totalPages,
      hasNext: params.page < totalPages,
      hasPrev: params.page > 1,
    };

    // Map to CallListItem type
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

    return NextResponse.json({
      calls: callListItems,
      pagination,
    });
  } catch (error) {
    console.error('Error fetching calls:', error);
    return NextResponse.json(
      { error: 'Failed to fetch calls' },
      { status: 500 }
    );
  }
}
