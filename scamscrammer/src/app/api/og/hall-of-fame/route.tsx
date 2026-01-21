/**
 * Hall of Fame Open Graph Image Generation
 *
 * Generates a static OG image for the Hall of Fame page showing
 * aggregated stats and all personas.
 */

import { ImageResponse } from 'next/og';
import prisma from '@/lib/db';

export const runtime = 'nodejs';

const WIDTH = 1200;
const HEIGHT = 630;

/**
 * GET /api/og/hall-of-fame
 * Generate a static OG image for the Hall of Fame page
 */
export async function GET(): Promise<ImageResponse> {
  try {
    // Get aggregate stats
    const stats = await prisma.call.aggregate({
      _sum: { duration: true },
      _count: true,
      where: { status: 'COMPLETED' },
    });

    const totalMinutes = Math.floor((stats._sum.duration || 0) / 60);
    const totalHours = Math.floor(totalMinutes / 60);
    const remainingMinutes = totalMinutes % 60;
    const totalCalls = stats._count;

    const timeWastedText = totalHours > 0
      ? `${totalHours}h ${remainingMinutes}m`
      : `${totalMinutes}m`;

    return new ImageResponse(
      (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
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
              backgroundImage: `radial-gradient(circle at 10% 20%, rgba(255, 165, 0, 0.1) 0%, transparent 40%),
                               radial-gradient(circle at 90% 80%, rgba(255, 69, 0, 0.1) 0%, transparent 40%)`,
              display: 'flex',
            }}
          />

          {/* Content */}
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
            {/* Header */}
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
                    background: 'linear-gradient(135deg, #f97316 0%, #dc2626 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '32px',
                  }}
                >
                  🎣
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
                      color: '#FFFFFF',
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
                    Hall of Fame
                  </span>
                </div>
              </div>

              {/* Trophy */}
              <div
                style={{
                  fontSize: '48px',
                  display: 'flex',
                }}
              >
                🏆
              </div>
            </div>

            {/* Main content */}
            <div
              style={{
                display: 'flex',
                flex: 1,
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                gap: '32px',
              }}
            >
              {/* Headline */}
              <div
                style={{
                  fontSize: '56px',
                  fontWeight: 800,
                  color: '#FFFFFF',
                  textAlign: 'center',
                  lineHeight: 1.2,
                  letterSpacing: '-1px',
                  display: 'flex',
                }}
              >
                Greatest Scammer Takedowns
              </div>

              {/* Stats row */}
              <div
                style={{
                  display: 'flex',
                  gap: '48px',
                }}
              >
                {/* Total Calls */}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    padding: '20px 32px',
                    background: 'rgba(255, 255, 255, 0.1)',
                    borderRadius: '16px',
                  }}
                >
                  <span
                    style={{
                      fontSize: '48px',
                      fontWeight: 700,
                      color: '#FBBF24',
                      display: 'flex',
                    }}
                  >
                    {totalCalls.toLocaleString()}
                  </span>
                  <span
                    style={{
                      fontSize: '16px',
                      color: 'rgba(255, 255, 255, 0.8)',
                      display: 'flex',
                    }}
                  >
                    Calls Handled
                  </span>
                </div>

                {/* Time Wasted */}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    padding: '20px 32px',
                    background: 'rgba(255, 255, 255, 0.1)',
                    borderRadius: '16px',
                  }}
                >
                  <span
                    style={{
                      fontSize: '48px',
                      fontWeight: 700,
                      color: '#34D399',
                      display: 'flex',
                    }}
                  >
                    {timeWastedText}
                  </span>
                  <span
                    style={{
                      fontSize: '16px',
                      color: 'rgba(255, 255, 255, 0.8)',
                      display: 'flex',
                    }}
                  >
                    Time Wasted
                  </span>
                </div>
              </div>

              {/* Personas row */}
              <div
                style={{
                  display: 'flex',
                  gap: '24px',
                  marginTop: '16px',
                }}
              >
                {/* Earl */}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <div
                    style={{
                      width: '72px',
                      height: '72px',
                      borderRadius: '50%',
                      background: 'rgba(249, 115, 22, 0.2)',
                      border: '3px solid #F97316',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '36px',
                    }}
                  >
                    👴
                  </div>
                  <span
                    style={{
                      fontSize: '14px',
                      color: '#F97316',
                      fontWeight: 600,
                      display: 'flex',
                    }}
                  >
                    Earl
                  </span>
                </div>

                {/* Gladys */}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <div
                    style={{
                      width: '72px',
                      height: '72px',
                      borderRadius: '50%',
                      background: 'rgba(139, 92, 246, 0.2)',
                      border: '3px solid #8B5CF6',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '36px',
                    }}
                  >
                    👵
                  </div>
                  <span
                    style={{
                      fontSize: '14px',
                      color: '#8B5CF6',
                      fontWeight: 600,
                      display: 'flex',
                    }}
                  >
                    Gladys
                  </span>
                </div>

                {/* Kevin */}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <div
                    style={{
                      width: '72px',
                      height: '72px',
                      borderRadius: '50%',
                      background: 'rgba(34, 197, 94, 0.2)',
                      border: '3px solid #22C55E',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '36px',
                    }}
                  >
                    🧔
                  </div>
                  <span
                    style={{
                      fontSize: '14px',
                      color: '#22C55E',
                      fontWeight: 600,
                      display: 'flex',
                    }}
                  >
                    Kevin
                  </span>
                </div>

                {/* Brenda */}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <div
                    style={{
                      width: '72px',
                      height: '72px',
                      borderRadius: '50%',
                      background: 'rgba(236, 72, 153, 0.2)',
                      border: '3px solid #EC4899',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '36px',
                    }}
                  >
                    💁
                  </div>
                  <span
                    style={{
                      fontSize: '14px',
                      color: '#EC4899',
                      fontWeight: 600,
                      display: 'flex',
                    }}
                  >
                    Brenda
                  </span>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                paddingTop: '24px',
                borderTop: '1px solid rgba(255, 255, 255, 0.1)',
              }}
            >
              <span
                style={{
                  fontSize: '16px',
                  color: 'rgba(255, 255, 255, 0.6)',
                  display: 'flex',
                }}
              >
                scamscrammer.com - Wasting scammers' time so they can't waste yours
              </span>
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
    console.error('Error generating hall-of-fame OG image:', error);

    // Return a simple fallback image
    return new ImageResponse(
      (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
            fontFamily: 'system-ui, -apple-system, sans-serif',
          }}
        >
          <div style={{ fontSize: '64px', marginBottom: '24px', display: 'flex' }}>🏆</div>
          <div
            style={{
              fontSize: '48px',
              fontWeight: 700,
              color: '#FFFFFF',
              marginBottom: '16px',
              display: 'flex',
            }}
          >
            ScamScrammer Hall of Fame
          </div>
          <div
            style={{
              fontSize: '24px',
              color: 'rgba(255, 255, 255, 0.7)',
              display: 'flex',
            }}
          >
            Greatest Scammer Takedowns
          </div>
        </div>
      ),
      {
        width: WIDTH,
        height: HEIGHT,
      }
    );
  }
}
