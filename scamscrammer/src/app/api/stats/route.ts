/**
 * Stats API Endpoint
 *
 * GET /api/stats - Returns dashboard statistics for call data
 */

import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import type { DashboardStats, ApiErrorResponse, CallListItem } from '@/types';
import { CallStatus } from '@prisma/client';
import { apiLogger } from '@/lib/logger';
import { DatabaseError, formatErrorResponse, getErrorStatusCode } from '@/lib/errors';

export async function GET(): Promise<NextResponse<DashboardStats | ApiErrorResponse>> {
  const requestLogger = apiLogger.forRequest(`stats-${Date.now()}`);
  requestLogger.debug('Fetching dashboard statistics');

  try {
    // Get the date 30 days ago for the callsByDay chart
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    thirtyDaysAgo.setHours(0, 0, 0, 0);

    // Run all queries in parallel for efficiency
    const [
      totalCalls,
      durationAggregation,
      callsByStatusRaw,
      callsByDayRaw,
      topRatedCalls,
      longestCalls,
    ] = await Promise.all([
      // Total number of calls
      prisma.call.count(),

      // Total and average duration (only for calls with duration)
      prisma.call.aggregate({
        _sum: {
          duration: true,
        },
        _avg: {
          duration: true,
        },
        where: {
          duration: {
            not: null,
          },
        },
      }),

      // Calls grouped by status
      prisma.call.groupBy({
        by: ['status'],
        _count: {
          _all: true,
        },
      }),

      // Calls by day for the last 30 days
      prisma.$queryRaw<Array<{ date: Date; count: bigint }>>`
        SELECT DATE(created_at) as date, COUNT(*)::bigint as count
        FROM "Call"
        WHERE created_at >= ${thirtyDaysAgo}
        GROUP BY DATE(created_at)
        ORDER BY date ASC
      `,

      // Top rated calls (highest entertainment value)
      prisma.call.findMany({
        where: {
          rating: {
            not: null,
          },
        },
        orderBy: {
          rating: 'desc',
        },
        take: 5,
        include: {
          _count: {
            select: {
              segments: true,
            },
          },
        },
      }),

      // Longest calls by duration
      prisma.call.findMany({
        where: {
          duration: {
            not: null,
          },
        },
        orderBy: {
          duration: 'desc',
        },
        take: 5,
        include: {
          _count: {
            select: {
              segments: true,
            },
          },
        },
      }),
    ]);

    // Transform calls by status into a record
    const callsByStatus: Record<string, number> = {};
    // Initialize all statuses to 0
    for (const status of Object.values(CallStatus)) {
      callsByStatus[status] = 0;
    }
    // Fill in actual counts
    for (const item of callsByStatusRaw) {
      callsByStatus[item.status] = item._count._all;
    }

    // Transform calls by day, filling in missing days with 0
    const callsByDay: Array<{ date: string; count: number }> = [];
    const callsByDayMap = new Map<string, number>();

    for (const item of callsByDayRaw) {
      const dateStr = item.date.toISOString().split('T')[0];
      callsByDayMap.set(dateStr, Number(item.count));
    }

    // Fill in all 30 days
    for (let i = 0; i < 30; i++) {
      const date = new Date(thirtyDaysAgo);
      date.setDate(date.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];
      callsByDay.push({
        date: dateStr,
        count: callsByDayMap.get(dateStr) || 0,
      });
    }

    // Map calls to CallListItem format
    const mapToCallListItem = (call: typeof topRatedCalls[0]): CallListItem => ({
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
      _count: call._count,
    });

    const stats: DashboardStats = {
      totalCalls,
      totalDuration: durationAggregation._sum.duration || 0,
      averageDuration: Math.round(durationAggregation._avg.duration || 0),
      callsByStatus,
      callsByDay,
      topRatedCalls: topRatedCalls.map(mapToCallListItem),
      longestCalls: longestCalls.map(mapToCallListItem),
    };

    requestLogger.info('Dashboard statistics fetched successfully', {
      totalCalls,
      totalDuration: stats.totalDuration,
    });

    return NextResponse.json(stats);
  } catch (error) {
    const dbError = DatabaseError.queryFailed('stats aggregation');
    requestLogger.logError(error, 'Failed to fetch dashboard statistics', {
      originalError: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      formatErrorResponse(dbError),
      { status: getErrorStatusCode(dbError) }
    );
  }
}
