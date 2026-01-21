/**
 * Public Hall of Fame API Endpoint
 *
 * GET /api/public/hall-of-fame - Returns top calls for the public Hall of Fame
 *
 * This endpoint is PUBLIC - no authentication required.
 * Used for viral sharing and marketing purposes.
 */

import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import type { PersonaType } from '@/lib/personas/types';

/**
 * Public call entry for the Hall of Fame
 * Sanitized to not expose sensitive information
 */
interface PublicCallEntry {
  id: string;
  duration: number;
  rating: number | null;
  maskedPhoneNumber: string;
  personaId: PersonaType;
  personaName: string;
  excerpt: string | null;
  createdAt: string;
  recordingUrl: string | null;
}

/**
 * Hall of Fame API Response
 */
interface HallOfFameResponse {
  longest: PublicCallEntry[];
  highestRated: PublicCallEntry[];
  featured: PublicCallEntry[];
  stats: {
    totalTimeWasted: number;
    totalCalls: number;
    averageDuration: number;
  };
}

/**
 * Mask a phone number for privacy
 * +1234567890 -> +1***7890
 * Shows country code and last 4 digits only
 */
function maskPhoneNumber(phone: string): string {
  // Remove all non-digit characters except +
  const cleaned = phone.replace(/[^\d+]/g, '');

  if (cleaned.length < 6) {
    return '***' + cleaned.slice(-3);
  }

  // Keep first part (country code) and last 4 digits
  const hasPlus = cleaned.startsWith('+');
  const digits = cleaned.replace('+', '');

  if (digits.length <= 4) {
    return hasPlus ? '+***' + digits : '***' + digits;
  }

  // For US numbers (+1XXXXXXXXXX), show +1***XXXX
  if (digits.length === 11 && digits.startsWith('1')) {
    return '+1***' + digits.slice(-4);
  }

  // For other numbers, show first digit and last 4
  const firstPart = hasPlus ? '+' + digits.slice(0, 1) : digits.slice(0, 1);
  const lastPart = digits.slice(-4);
  return firstPart + '***' + lastPart;
}

/**
 * Persona name mapping
 */
const PERSONA_NAMES: Record<string, string> = {
  earl: 'Earl',
  gladys: 'Gladys',
  kevin: 'Kevin',
  brenda: 'Brenda',
};

/**
 * Get persona info from the persona field or tags
 */
function getPersonaInfo(persona: string | null, tags: string[]): { id: PersonaType; name: string } {
  // First, check if persona field is set
  if (persona && PERSONA_NAMES[persona.toLowerCase()]) {
    const id = persona.toLowerCase() as PersonaType;
    return { id, name: PERSONA_NAMES[id] };
  }

  // Fallback: Check tags for persona info
  const personaTag = tags.find(tag =>
    tag.toLowerCase().includes('earl') ||
    tag.toLowerCase().includes('gladys') ||
    tag.toLowerCase().includes('kevin') ||
    tag.toLowerCase().includes('brenda')
  );

  if (personaTag) {
    const lowerTag = personaTag.toLowerCase();
    if (lowerTag.includes('gladys')) return { id: 'gladys', name: 'Gladys' };
    if (lowerTag.includes('kevin')) return { id: 'kevin', name: 'Kevin' };
    if (lowerTag.includes('brenda')) return { id: 'brenda', name: 'Brenda' };
  }

  // Default to Earl (the original persona)
  return { id: 'earl', name: 'Earl' };
}

/**
 * Generate an excerpt from the first transcript segment
 * Note: This is a placeholder - actual implementation would query CallSegments
 */
function generateExcerpt(notes: string | null): string | null {
  if (!notes) return null;

  // Truncate to ~100 chars and add ellipsis
  if (notes.length > 100) {
    return notes.slice(0, 100).trim() + '...';
  }
  return notes;
}

export async function GET(): Promise<NextResponse<HallOfFameResponse | { error: string }>> {
  try {
    // Build the base where clause - only show public calls
    const baseWhere = {
      status: 'COMPLETED' as const,
      duration: {
        not: null,
        gt: 0,
      },
      isPublic: true,
    };

    // Run all queries in parallel for efficiency
    const [
      longestCalls,
      highestRatedCalls,
      featuredCalls,
      statsAggregation,
      totalCalls,
    ] = await Promise.all([
      // Top 10 longest calls
      prisma.call.findMany({
        where: baseWhere,
        orderBy: {
          duration: 'desc',
        },
        take: 10,
        select: {
          id: true,
          duration: true,
          rating: true,
          fromNumber: true,
          notes: true,
          tags: true,
          persona: true,
          title: true,
          createdAt: true,
          recordingUrl: true,
        },
      }),

      // Top 10 highest rated calls (with rating)
      prisma.call.findMany({
        where: {
          ...baseWhere,
          rating: {
            not: null,
            gte: 3,
          },
        },
        orderBy: [
          { rating: 'desc' },
          { duration: 'desc' },
        ],
        take: 10,
        select: {
          id: true,
          duration: true,
          rating: true,
          fromNumber: true,
          notes: true,
          tags: true,
          persona: true,
          title: true,
          createdAt: true,
          recordingUrl: true,
        },
      }),

      // Featured calls - get calls marked as featured
      prisma.call.findMany({
        where: {
          ...baseWhere,
          isFeatured: true,
        },
        orderBy: [
          { rating: 'desc' },
          { duration: 'desc' },
        ],
        take: 6,
        select: {
          id: true,
          duration: true,
          rating: true,
          fromNumber: true,
          notes: true,
          tags: true,
          persona: true,
          title: true,
          createdAt: true,
          recordingUrl: true,
        },
      }),

      // Total time wasted and average duration
      prisma.call.aggregate({
        _sum: {
          duration: true,
        },
        _avg: {
          duration: true,
        },
        where: {
          status: 'COMPLETED',
          duration: {
            not: null,
          },
        },
      }),

      // Total calls count
      prisma.call.count({
        where: {
          status: 'COMPLETED',
        },
      }),
    ]);

    // Transform calls to public format (sanitized)
    const transformToPublic = (call: {
      id: string;
      duration: number | null;
      rating: number | null;
      fromNumber: string;
      notes: string | null;
      tags: string[];
      persona: string | null;
      title: string | null;
      createdAt: Date;
      recordingUrl: string | null;
    }): PublicCallEntry => {
      const personaInfo = getPersonaInfo(call.persona, call.tags);
      return {
        id: call.id,
        duration: call.duration || 0,
        rating: call.rating,
        maskedPhoneNumber: maskPhoneNumber(call.fromNumber),
        personaId: personaInfo.id,
        personaName: personaInfo.name,
        excerpt: call.title || generateExcerpt(call.notes),
        createdAt: call.createdAt.toISOString(),
        recordingUrl: call.recordingUrl,
      };
    };

    const response: HallOfFameResponse = {
      longest: longestCalls.map(transformToPublic),
      highestRated: highestRatedCalls.map(transformToPublic),
      featured: featuredCalls.map(transformToPublic),
      stats: {
        totalTimeWasted: statsAggregation._sum.duration || 0,
        totalCalls,
        averageDuration: Math.round(statsAggregation._avg.duration || 0),
      },
    };

    // Add cache headers for performance (cache for 5 minutes)
    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    });
  } catch (error) {
    console.error('Error fetching Hall of Fame data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch Hall of Fame data' },
      { status: 500 }
    );
  }
}
