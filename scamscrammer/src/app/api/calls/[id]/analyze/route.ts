/**
 * Call Analysis API Route
 *
 * POST /api/calls/[id]/analyze - Analyze a call and auto-tag it
 *
 * Triggers transcript analysis to detect scam type and add relevant tags.
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { analyzeCallForTags, ScamType } from '@/lib/tagging';
import { apiLogger } from '@/lib/logger';
import { DatabaseError, formatErrorResponse, getErrorStatusCode } from '@/lib/errors';

interface RouteParams {
  params: Promise<{ id: string }>;
}

interface AnalyzeResponse {
  id: string;
  scamType: ScamType;
  tags: string[];
  confidence: number;
  updated: boolean;
}

/**
 * POST /api/calls/[id]/analyze
 * Analyze a call's transcript and update with detected tags
 */
export async function POST(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse<AnalyzeResponse | { error: string }>> {
  const requestLogger = apiLogger.forRequest(`analyze-${Date.now()}`);

  try {
    const { id } = await params;
    requestLogger.debug('Analyzing call', { callId: id });

    // Fetch the call with its segments
    const call = await prisma.call.findUnique({
      where: { id },
      include: {
        segments: {
          orderBy: { timestamp: 'asc' },
        },
      },
    });

    if (!call) {
      throw DatabaseError.recordNotFound('Call', id);
    }

    // Build transcript from segments
    let transcript = '';
    for (const segment of call.segments) {
      transcript += `${segment.speaker}: ${segment.text}\n`;
    }

    // If no segments, we can't analyze
    if (!transcript.trim()) {
      return NextResponse.json({
        id: call.id,
        scamType: ScamType.UNKNOWN,
        tags: call.tags,
        confidence: 0,
        updated: false,
      });
    }

    // Analyze the transcript
    const analysis = analyzeCallForTags(transcript);
    requestLogger.debug('Analysis complete', {
      callId: id,
      scamType: analysis.scamType,
      tagCount: analysis.tags.length,
      confidence: analysis.confidence,
    });

    // Merge new tags with existing tags (avoid duplicates)
    const existingTags = new Set(call.tags);
    const newTags = analysis.tags.filter((tag) => !existingTags.has(tag));
    const mergedTags = [...call.tags, ...newTags];

    // Update the call with the analysis results
    const updatedCall = await prisma.call.update({
      where: { id },
      data: {
        tags: mergedTags,
      },
    });

    requestLogger.info('Call analysis updated', {
      callId: id,
      scamType: analysis.scamType,
      newTags: newTags.length,
      totalTags: mergedTags.length,
    });

    return NextResponse.json({
      id: updatedCall.id,
      scamType: analysis.scamType,
      tags: mergedTags,
      confidence: analysis.confidence,
      updated: newTags.length > 0,
    });
  } catch (error) {
    requestLogger.logError(error, 'Failed to analyze call');

    if (error instanceof DatabaseError) {
      return NextResponse.json(formatErrorResponse(error), {
        status: getErrorStatusCode(error),
      });
    }

    return NextResponse.json(
      { error: 'Failed to analyze call' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/calls/[id]/analyze
 * Get the analysis/tags for a call without modifying it
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse<AnalyzeResponse | { error: string }>> {
  const requestLogger = apiLogger.forRequest(`analyze-get-${Date.now()}`);

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
      throw DatabaseError.recordNotFound('Call', id);
    }

    // Build transcript from segments
    let transcript = '';
    for (const segment of call.segments) {
      transcript += `${segment.speaker}: ${segment.text}\n`;
    }

    // Analyze without saving
    const analysis = transcript.trim()
      ? analyzeCallForTags(transcript)
      : { scamType: ScamType.UNKNOWN, tags: [], confidence: 0 };

    return NextResponse.json({
      id: call.id,
      scamType: analysis.scamType,
      tags: call.tags,
      confidence: analysis.confidence,
      updated: false,
    });
  } catch (error) {
    requestLogger.logError(error, 'Failed to get call analysis');

    if (error instanceof DatabaseError) {
      return NextResponse.json(formatErrorResponse(error), {
        status: getErrorStatusCode(error),
      });
    }

    return NextResponse.json(
      { error: 'Failed to get call analysis' },
      { status: 500 }
    );
  }
}
