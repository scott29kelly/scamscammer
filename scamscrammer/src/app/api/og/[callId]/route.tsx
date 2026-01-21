/**
 * Dynamic Open Graph Image Generation API
 *
 * Generates visually striking OG images for social sharing of call recordings.
 * Uses @vercel/og (ImageResponse) for server-side image generation.
 *
 * GET /api/og/[callId] - Returns a 1200x630 PNG image for social sharing
 */

import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import {
  detectPersonaFromCall,
  getPersonaColor,
  getPersonaDisplayName,
  getPersonaTagline,
  formatDurationShort,
  generateOgHeadline,
  type CallWithSegments,
} from '@/lib/og-utils';

export const runtime = 'nodejs';

// Image dimensions for optimal social sharing
const WIDTH = 1200;
const HEIGHT = 630;

interface RouteParams {
  params: Promise<{ callId: string }>;
}

/**
 * GET /api/og/[callId]
 * Generate a dynamic OG image for a specific call
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
): Promise<ImageResponse | Response> {
  try {
    const { callId } = await params;

    // Fetch the call with segments
    const call = await prisma.call.findUnique({
      where: { id: callId },
      include: {
        segments: {
          orderBy: { timestamp: 'asc' },
          take: 5, // Only need a few for persona detection
        },
      },
    });

    // If call not found, return a generic ScamScrammer OG image
    if (!call) {
      return generateFallbackImage();
    }

    const callWithSegments = call as CallWithSegments;

    // Detect persona and get colors
    const personaType = detectPersonaFromCall(callWithSegments) || 'earl';
    const colors = getPersonaColor(personaType);
    const personaName = getPersonaDisplayName(personaType);
    const personaTagline = getPersonaTagline(personaType);
    const headline = generateOgHeadline(callWithSegments);
    const duration = call.duration ? formatDurationShort(call.duration) : null;

    // Generate the image
    return new ImageResponse(
      (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            background: colors.gradient,
            fontFamily: 'system-ui, -apple-system, sans-serif',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Background pattern overlay */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundImage: `radial-gradient(circle at 20% 80%, ${colors.accent}15 0%, transparent 50%),
                               radial-gradient(circle at 80% 20%, ${colors.accent}10 0%, transparent 40%)`,
              display: 'flex',
            }}
          />

          {/* Content container */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              padding: '48px 56px',
              height: '100%',
              position: 'relative',
              zIndex: 1,
            }}
          >
            {/* Header with logo/branding */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '32px',
              }}
            >
              {/* Logo */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                }}
              >
                <div
                  style={{
                    width: '56px',
                    height: '56px',
                    borderRadius: '12px',
                    background: 'rgba(255, 255, 255, 0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '32px',
                  }}
                >
                  <span>📞</span>
                </div>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                >
                  <span
                    style={{
                      fontSize: '28px',
                      fontWeight: 700,
                      color: colors.textColor,
                      letterSpacing: '-0.5px',
                    }}
                  >
                    ScamScrammer
                  </span>
                  <span
                    style={{
                      fontSize: '14px',
                      color: 'rgba(255, 255, 255, 0.7)',
                    }}
                  >
                    AI-Powered Scam Call Entertainment
                  </span>
                </div>
              </div>

              {/* Duration badge */}
              {duration && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    background: 'rgba(0, 0, 0, 0.3)',
                    borderRadius: '24px',
                    padding: '12px 24px',
                  }}
                >
                  <span
                    style={{
                      fontSize: '14px',
                      color: 'rgba(255, 255, 255, 0.8)',
                      textTransform: 'uppercase',
                      letterSpacing: '1px',
                    }}
                  >
                    Call Duration
                  </span>
                  <span
                    style={{
                      fontSize: '24px',
                      fontWeight: 700,
                      color: colors.accent,
                    }}
                  >
                    {duration}
                  </span>
                </div>
              )}
            </div>

            {/* Main content area */}
            <div
              style={{
                display: 'flex',
                flex: 1,
                flexDirection: 'column',
                justifyContent: 'center',
                gap: '24px',
              }}
            >
              {/* Headline */}
              <div
                style={{
                  fontSize: '64px',
                  fontWeight: 800,
                  color: colors.textColor,
                  lineHeight: 1.1,
                  letterSpacing: '-2px',
                  textShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
                  display: 'flex',
                }}
              >
                {headline}
              </div>

              {/* Persona info */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '20px',
                }}
              >
                {/* Persona avatar */}
                <div
                  style={{
                    width: '80px',
                    height: '80px',
                    borderRadius: '50%',
                    background: 'rgba(255, 255, 255, 0.2)',
                    border: `3px solid ${colors.accent}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '40px',
                  }}
                >
                  {personaType === 'earl' && '👴'}
                  {personaType === 'gladys' && '👵'}
                  {personaType === 'kevin' && '🧔'}
                  {personaType === 'brenda' && '💁'}
                </div>

                {/* Persona details */}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                >
                  <span
                    style={{
                      fontSize: '28px',
                      fontWeight: 700,
                      color: colors.textColor,
                    }}
                  >
                    {personaName}
                  </span>
                  <span
                    style={{
                      fontSize: '18px',
                      color: 'rgba(255, 255, 255, 0.8)',
                    }}
                  >
                    {personaTagline}
                  </span>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingTop: '24px',
                borderTop: '1px solid rgba(255, 255, 255, 0.2)',
              }}
            >
              <span
                style={{
                  fontSize: '16px',
                  color: 'rgba(255, 255, 255, 0.7)',
                }}
              >
                scamscrammer.com
              </span>

              {/* Stats badges */}
              <div
                style={{
                  display: 'flex',
                  gap: '16px',
                }}
              >
                {call.rating && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      background: 'rgba(0, 0, 0, 0.2)',
                      borderRadius: '8px',
                      padding: '8px 12px',
                    }}
                  >
                    <span style={{ color: colors.accent }}>★</span>
                    <span
                      style={{
                        fontSize: '14px',
                        color: colors.textColor,
                        fontWeight: 600,
                      }}
                    >
                      {call.rating}/5 Entertainment
                    </span>
                  </div>
                )}

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    background: colors.accent,
                    borderRadius: '8px',
                    padding: '8px 16px',
                  }}
                >
                  <span
                    style={{
                      fontSize: '14px',
                      color: '#000',
                      fontWeight: 700,
                    }}
                  >
                    Listen Now
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      ),
      {
        width: WIDTH,
        height: HEIGHT,
      }
    );
  } catch (error) {
    console.error('Error generating OG image:', error);
    return generateFallbackImage();
  }
}

/**
 * Generate a fallback OG image when call is not found or errors occur
 */
function generateFallbackImage(): ImageResponse {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: 'linear-gradient(135deg, #1E40AF 0%, #3B82F6 50%, #60A5FA 100%)',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Background pattern */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundImage: `radial-gradient(circle at 20% 80%, rgba(251, 191, 36, 0.15) 0%, transparent 50%),
                             radial-gradient(circle at 80% 20%, rgba(251, 191, 36, 0.1) 0%, transparent 40%)`,
            display: 'flex',
          }}
        />

        {/* Content */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            padding: '48px',
            position: 'relative',
            zIndex: 1,
          }}
        >
          {/* Logo */}
          <div
            style={{
              width: '120px',
              height: '120px',
              borderRadius: '24px',
              background: 'rgba(255, 255, 255, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '64px',
              marginBottom: '32px',
            }}
          >
            📞
          </div>

          {/* Title */}
          <div
            style={{
              fontSize: '72px',
              fontWeight: 800,
              color: '#FFFFFF',
              letterSpacing: '-2px',
              marginBottom: '16px',
              display: 'flex',
            }}
          >
            ScamScrammer
          </div>

          {/* Tagline */}
          <div
            style={{
              fontSize: '28px',
              color: 'rgba(255, 255, 255, 0.9)',
              marginBottom: '48px',
              display: 'flex',
            }}
          >
            AI-Powered Scam Call Entertainment
          </div>

          {/* Persona row */}
          <div
            style={{
              display: 'flex',
              gap: '24px',
            }}
          >
            {['👴', '👵', '🧔', '💁'].map((emoji, i) => (
              <div
                key={i}
                style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  background: 'rgba(255, 255, 255, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '32px',
                }}
              >
                {emoji}
              </div>
            ))}
          </div>

          {/* Footer */}
          <div
            style={{
              position: 'absolute',
              bottom: '32px',
              fontSize: '18px',
              color: 'rgba(255, 255, 255, 0.7)',
              display: 'flex',
            }}
          >
            Wasting scammers' time, one call at a time
          </div>
        </div>
      </div>
    ),
    {
      width: WIDTH,
      height: HEIGHT,
    }
  );
}
