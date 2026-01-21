/**
 * Leaderboard API Route
 *
 * GET /api/stats/leaderboard - Returns leaderboard data including:
 * - Longest single call
 * - Most calls in a day
 * - Highest rated call
 * - Best persona by avg duration and rating
 * - Persona usage breakdown
 * - Peak calling hours
 */

import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { apiLogger } from '@/lib/logger';
import { DatabaseError, formatErrorResponse, getErrorStatusCode } from '@/lib/errors';

interface PersonaStats {
  persona: string;
  totalCalls: number;
  totalDuration: number;
  avgDuration: number;
  avgRating: number | null;
}

interface HourlyStats {
  hour: number;
  count: number;
}

interface LeaderboardData {
  longestCall: {
    id: string;
    duration: number;
    persona: string | null;
    createdAt: Date;
  } | null;
  highestRatedCall: {
    id: string;
    rating: number;
    persona: string | null;
    duration: number | null;
    createdAt: Date;
  } | null;
  mostCallsInDay: {
    date: string;
    count: number;
  } | null;
  bestPersonaByDuration: PersonaStats | null;
  bestPersonaByRating: PersonaStats | null;
  personaBreakdown: PersonaStats[];
  peakHours: HourlyStats[];
  totalTimeWasted: number;
  estimatedScammerSalaryWasted: number;
  totalRageQuits: number; // Calls that ended abruptly (short duration)
}

export async function GET(): Promise<NextResponse<LeaderboardData | { error: string }>> {
  const requestLogger = apiLogger.forRequest(`leaderboard-${Date.now()}`);
  requestLogger.debug('Fetching leaderboard data');

  try {
    // Run all queries in parallel
    const [
      longestCallResult,
      highestRatedCallResult,
      mostCallsInDayResult,
      personaStatsResult,
      hourlyStatsResult,
      totalDurationResult,
      shortCallsCount,
    ] = await Promise.all([
      // Longest single call
      prisma.call.findFirst({
        where: { duration: { not: null } },
        orderBy: { duration: 'desc' },
        select: {
          id: true,
          duration: true,
          persona: true,
          createdAt: true,
        },
      }),

      // Highest rated call
      prisma.call.findFirst({
        where: { rating: { not: null } },
        orderBy: { rating: 'desc' },
        select: {
          id: true,
          rating: true,
          persona: true,
          duration: true,
          createdAt: true,
        },
      }),

      // Most calls in a single day
      prisma.$queryRaw<Array<{ date: string; count: bigint }>>`
        SELECT DATE("createdAt")::text as date, COUNT(*)::bigint as count
        FROM "Call"
        GROUP BY DATE("createdAt")
        ORDER BY count DESC
        LIMIT 1
      `,

      // Persona stats aggregated
      prisma.$queryRaw<Array<{
        persona: string | null;
        total_calls: bigint;
        total_duration: bigint | null;
        avg_duration: number | null;
        avg_rating: number | null;
      }>>`
        SELECT
          COALESCE(persona, 'earl') as persona,
          COUNT(*)::bigint as total_calls,
          SUM(duration)::bigint as total_duration,
          AVG(duration)::float as avg_duration,
          AVG(rating)::float as avg_rating
        FROM "Call"
        WHERE status = 'COMPLETED'
        GROUP BY COALESCE(persona, 'earl')
        ORDER BY total_calls DESC
      `,

      // Hourly distribution (when do scammers call most?)
      prisma.$queryRaw<Array<{ hour: number; count: bigint }>>`
        SELECT
          EXTRACT(HOUR FROM "createdAt")::int as hour,
          COUNT(*)::bigint as count
        FROM "Call"
        GROUP BY EXTRACT(HOUR FROM "createdAt")
        ORDER BY hour ASC
      `,

      // Total duration for salary calculation
      prisma.call.aggregate({
        _sum: { duration: true },
        where: { status: 'COMPLETED' },
      }),

      // Count "rage quits" - calls under 30 seconds that ended
      prisma.call.count({
        where: {
          status: 'COMPLETED',
          duration: { lt: 30, gt: 0 },
        },
      }),
    ]);

    // Transform persona stats
    const personaBreakdown: PersonaStats[] = personaStatsResult.map((p) => ({
      persona: p.persona || 'earl',
      totalCalls: Number(p.total_calls),
      totalDuration: Number(p.total_duration || 0),
      avgDuration: Math.round(p.avg_duration || 0),
      avgRating: p.avg_rating ? Math.round(p.avg_rating * 10) / 10 : null,
    }));

    // Find best persona by avg duration
    const bestPersonaByDuration = personaBreakdown.reduce<PersonaStats | null>(
      (best, current) => {
        if (!best || current.avgDuration > best.avgDuration) {
          return current;
        }
        return best;
      },
      null
    );

    // Find best persona by avg rating
    const bestPersonaByRating = personaBreakdown.reduce<PersonaStats | null>(
      (best, current) => {
        if (current.avgRating === null) return best;
        if (!best || !best.avgRating || current.avgRating > best.avgRating) {
          return current;
        }
        return best;
      },
      null
    );

    // Transform hourly stats with all 24 hours
    const hourlyMap = new Map<number, number>();
    hourlyStatsResult.forEach((h) => {
      hourlyMap.set(h.hour, Number(h.count));
    });

    const peakHours: HourlyStats[] = Array.from({ length: 24 }, (_, hour) => ({
      hour,
      count: hourlyMap.get(hour) || 0,
    }));

    // Calculate estimated scammer salary wasted
    // Assume ~$3/hour for overseas call center
    const totalSeconds = totalDurationResult._sum.duration || 0;
    const totalHours = totalSeconds / 3600;
    const estimatedScammerSalaryWasted = Math.round(totalHours * 3 * 100) / 100;

    const leaderboard: LeaderboardData = {
      longestCall: longestCallResult
        ? {
            id: longestCallResult.id,
            duration: longestCallResult.duration!,
            persona: longestCallResult.persona,
            createdAt: longestCallResult.createdAt,
          }
        : null,
      highestRatedCall: highestRatedCallResult
        ? {
            id: highestRatedCallResult.id,
            rating: highestRatedCallResult.rating!,
            persona: highestRatedCallResult.persona,
            duration: highestRatedCallResult.duration,
            createdAt: highestRatedCallResult.createdAt,
          }
        : null,
      mostCallsInDay: mostCallsInDayResult[0]
        ? {
            date: mostCallsInDayResult[0].date,
            count: Number(mostCallsInDayResult[0].count),
          }
        : null,
      bestPersonaByDuration,
      bestPersonaByRating,
      personaBreakdown,
      peakHours,
      totalTimeWasted: totalSeconds,
      estimatedScammerSalaryWasted,
      totalRageQuits: shortCallsCount,
    };

    requestLogger.info('Leaderboard data fetched successfully');
    return NextResponse.json(leaderboard);
  } catch (error) {
    const dbError = DatabaseError.queryFailed('leaderboard');
    requestLogger.logError(error, 'Failed to fetch leaderboard data');

    return NextResponse.json(formatErrorResponse(dbError), {
      status: getErrorStatusCode(dbError),
    });
  }
}
