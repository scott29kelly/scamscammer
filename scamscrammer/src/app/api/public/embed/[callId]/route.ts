/**
 * Public Embed API Endpoint
 *
 * GET /api/public/embed/[callId] - Returns call audio URL and metadata for embedding
 *
 * This endpoint is publicly accessible (no auth required) but only returns
 * data for calls marked as 'public' (isPublic: true).
 *
 * Includes CORS headers for cross-origin embedding.
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

interface RouteParams {
  params: Promise<{ callId: string }>;
}

interface EmbedResponse {
  id: string;
  persona: { id: string; name: string } | null;
  duration: number;
  recordingUrl: string;
  title: string | null;
}

interface ErrorResponse {
  error: string;
  code?: 'NOT_FOUND' | 'PRIVATE' | 'NO_RECORDING';
}

// Persona display names mapping
const PERSONA_NAMES: Record<string, string> = {
  earl: 'Earl',
  gladys: 'Gladys',
  kevin: 'Kevin',
  brenda: 'Brenda',
};

/**
 * Add CORS headers to response
 */
function addCorsHeaders<T>(response: NextResponse<T>): NextResponse<T> {
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
  response.headers.set('Access-Control-Max-Age', '86400');
  return response;
}

/**
 * OPTIONS handler for CORS preflight requests
 */
export async function OPTIONS(): Promise<NextResponse> {
  const response = new NextResponse(null, { status: 204 });
  return addCorsHeaders(response);
}

/**
 * GET /api/public/embed/[callId]
 * Fetch public call data for embedding
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse<EmbedResponse | ErrorResponse>> {
  try {
    const { callId } = await params;

    // Fetch the call from the database
    const call = await prisma.call.findUnique({
      where: { id: callId },
      select: {
        id: true,
        isPublic: true,
        persona: true,
        duration: true,
        recordingUrl: true,
        title: true,
        status: true,
      },
    });

    // Call not found
    if (!call) {
      const response = NextResponse.json(
        { error: 'Call not found', code: 'NOT_FOUND' as const },
        { status: 404 }
      );
      return addCorsHeaders(response);
    }

    // Call exists but is not public
    if (!call.isPublic) {
      const response = NextResponse.json(
        { error: 'This call is not available for public viewing', code: 'PRIVATE' as const },
        { status: 404 }
      );
      return addCorsHeaders(response);
    }

    // Call is public but has no recording
    if (!call.recordingUrl) {
      const response = NextResponse.json(
        { error: 'No recording available for this call', code: 'NO_RECORDING' as const },
        { status: 404 }
      );
      return addCorsHeaders(response);
    }

    // Build persona info if available
    let persona: { id: string; name: string } | null = null;
    if (call.persona) {
      const personaId = call.persona.toLowerCase();
      persona = {
        id: personaId,
        name: PERSONA_NAMES[personaId] || call.persona,
      };
    }

    // Return the embed data
    const response: EmbedResponse = {
      id: call.id,
      persona,
      duration: call.duration || 0,
      recordingUrl: call.recordingUrl,
      title: call.title,
    };

    const jsonResponse = NextResponse.json(response);
    return addCorsHeaders(jsonResponse);
  } catch (error) {
    console.error('Error fetching embed data:', error);
    const response = NextResponse.json(
      { error: 'Failed to fetch call data' },
      { status: 500 }
    );
    return addCorsHeaders(response);
  }
}
