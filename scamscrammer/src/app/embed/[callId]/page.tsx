/**
 * Embed Player Page
 *
 * A minimal standalone page for embedding the audio player on external sites.
 * No navigation, no auth - just the player with persona info and branding.
 *
 * Query params:
 * - autoplay: 'true' | 'false' (default: false)
 * - theme: 'light' | 'dark' (default: dark)
 */

import { Metadata } from 'next';
import EmbedPlayerClient from './EmbedPlayerClient';

interface PageProps {
  params: Promise<{ callId: string }>;
  searchParams: Promise<{ autoplay?: string; theme?: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { callId } = await params;
  return {
    title: `ScamScrammer Call - ${callId}`,
    description: 'Listen to this hilarious scam call recording',
    robots: 'noindex, nofollow',
  };
}

export default async function EmbedPage({ params, searchParams }: PageProps) {
  const { callId } = await params;
  const search = await searchParams;
  const autoplay = search.autoplay === 'true';
  const theme = (search.theme === 'light' ? 'light' : 'dark') as 'light' | 'dark';

  return (
    <EmbedPlayerClient
      callId={callId}
      autoplay={autoplay}
      theme={theme}
    />
  );
}
