/**
 * Hall of Fame Page
 *
 * Server component wrapper that provides OG metadata for social sharing
 * while rendering the client-side interactive content.
 */

import type { Metadata } from 'next';
import prisma from '@/lib/db';
import { getSiteUrl, getOgImageUrl } from '@/lib/og-utils';
import HallOfFameClient from './HallOfFameClient';

/**
 * Generate metadata for the Hall of Fame page
 */
export async function generateMetadata(): Promise<Metadata> {
  const siteUrl = getSiteUrl();

  try {
    // Get the top call for the OG image
    const topCall = await prisma.call.findFirst({
      where: {
        status: 'COMPLETED',
        duration: { gt: 0 },
      },
      orderBy: [
        { rating: 'desc' },
        { duration: 'desc' },
      ],
    });

    // Use top call's OG image if available, otherwise use a static fallback
    const ogImageUrl = topCall
      ? getOgImageUrl(topCall.id)
      : `${siteUrl}/api/og/hall-of-fame`;

    // Get total time wasted for the description
    const stats = await prisma.call.aggregate({
      _sum: { duration: true },
      _count: true,
      where: { status: 'COMPLETED' },
    });

    const totalMinutes = Math.floor((stats._sum.duration || 0) / 60);
    const totalHours = Math.floor(totalMinutes / 60);
    const totalCalls = stats._count;

    const timeWastedText = totalHours > 0
      ? `${totalHours} hours`
      : `${totalMinutes} minutes`;

    const description = `${totalCalls.toLocaleString()} scam calls handled. ${timeWastedText} of scammer time wasted. See the best AI-powered scam call entertainment featuring Earl, Gladys, Kevin, and Brenda.`;

    return {
      title: 'Hall of Fame | ScamScrammer',
      description,
      openGraph: {
        title: 'ScamScrammer Hall of Fame - Greatest Scammer Takedowns',
        description,
        type: 'website',
        url: `${siteUrl}/hall-of-fame`,
        siteName: 'ScamScrammer',
        images: [
          {
            url: ogImageUrl,
            width: 1200,
            height: 630,
            alt: 'ScamScrammer Hall of Fame - Greatest scam call moments',
          },
        ],
      },
      twitter: {
        card: 'summary_large_image',
        title: 'ScamScrammer Hall of Fame - Greatest Scammer Takedowns',
        description,
        images: [ogImageUrl],
        creator: '@scamscrammer',
      },
      alternates: {
        canonical: `${siteUrl}/hall-of-fame`,
      },
    };
  } catch (error) {
    console.error('Error generating hall-of-fame metadata:', error);

    return {
      title: 'Hall of Fame | ScamScrammer',
      description: 'The best AI-powered scam call entertainment. See our top calls featuring Earl, Gladys, Kevin, and Brenda wasting scammers time.',
    };
  }
}

/**
 * Hall of Fame Page Component
 */
export default function HallOfFamePage() {
  return <HallOfFameClient />;
}
