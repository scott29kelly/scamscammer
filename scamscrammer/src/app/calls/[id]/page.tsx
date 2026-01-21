/**
 * Call Detail Page
 *
 * Server component that generates metadata for social sharing
 * and renders the client-side call detail component.
 */

import type { Metadata, ResolvingMetadata } from 'next';
import prisma from '@/lib/db';
import {
  generateCallTitleDeterministic,
  generateCallDescription,
  getOgImageUrl,
  getCallUrl,
  getSiteUrl,
  type CallWithSegments,
} from '@/lib/og-utils';
import CallDetailClient from './CallDetailClient';

interface PageProps {
  params: Promise<{ id: string }>;
}

/**
 * Generate dynamic metadata for social sharing
 */
export async function generateMetadata(
  { params }: PageProps,
  parent: ResolvingMetadata
): Promise<Metadata> {
  const { id } = await params;

  try {
    // Fetch the call for metadata generation
    const call = await prisma.call.findUnique({
      where: { id },
      include: {
        segments: {
          orderBy: { timestamp: 'asc' },
          take: 10, // Enough for persona detection
        },
      },
    });

    // Return default metadata if call not found
    if (!call) {
      return {
        title: 'Call Not Found | ScamScrammer',
        description: 'The requested call recording could not be found.',
      };
    }

    const callWithSegments = call as CallWithSegments;

    // Generate dynamic title and description
    const title = generateCallTitleDeterministic(callWithSegments);
    const description = generateCallDescription(callWithSegments);
    const ogImageUrl = getOgImageUrl(id);
    const callUrl = getCallUrl(id);
    const siteUrl = getSiteUrl();

    // Get previous images from parent metadata
    const previousImages = (await parent).openGraph?.images || [];

    return {
      title: `${title} | ScamScrammer`,
      description,
      openGraph: {
        title,
        description,
        type: 'article',
        url: callUrl,
        siteName: 'ScamScrammer',
        images: [
          {
            url: ogImageUrl,
            width: 1200,
            height: 630,
            alt: title,
          },
          ...previousImages,
        ],
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
        images: [ogImageUrl],
        creator: '@scamscrammer',
      },
      alternates: {
        canonical: callUrl,
      },
      robots: {
        index: true,
        follow: true,
      },
      other: {
        'og:locale': 'en_US',
        'article:publisher': siteUrl,
      },
    };
  } catch (error) {
    console.error('Error generating metadata for call:', error);

    // Return fallback metadata on error
    return {
      title: 'Call Recording | ScamScrammer',
      description: 'AI-powered scam call entertainment. Listen to scammers get confused by our AI personas.',
    };
  }
}

/**
 * Call Detail Page Component
 */
export default async function CallDetailPage({ params }: PageProps) {
  const { id } = await params;

  return <CallDetailClient callId={id} />;
}
