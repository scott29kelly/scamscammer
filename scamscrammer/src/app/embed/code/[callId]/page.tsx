/**
 * Embed Code Page
 *
 * Shows the embed code snippet for a call, with preview and size options.
 * Users can copy the iframe code to embed the player on external sites.
 */

import { Metadata } from 'next';
import EmbedCodeClient from './EmbedCodeClient';

interface PageProps {
  params: Promise<{ callId: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { callId } = await params;
  return {
    title: `Get Embed Code - ScamScrammer`,
    description: `Get the embed code for call ${callId}`,
  };
}

export default async function EmbedCodePage({ params }: PageProps) {
  const { callId } = await params;

  return <EmbedCodeClient callId={callId} />;
}
