'use client';

import Link from 'next/link';
import type { PersonaType } from '@/lib/personas/types';

/**
 * Represents a call entry for the Hall of Fame
 */
export interface HallOfFameCallEntry {
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

interface HallOfFameCardProps {
  call: HallOfFameCallEntry;
  rank?: number;
  category: 'longest' | 'highestRated' | 'featured';
}

/**
 * Persona color configuration for badges
 */
const PERSONA_COLORS: Record<PersonaType, { bg: string; text: string; border: string }> = {
  earl: { bg: 'bg-orange-500/20', text: 'text-orange-400', border: 'border-orange-500/30' },
  gladys: { bg: 'bg-purple-500/20', text: 'text-purple-400', border: 'border-purple-500/30' },
  kevin: { bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500/30' },
  brenda: { bg: 'bg-pink-500/20', text: 'text-pink-400', border: 'border-pink-500/30' },
};

/**
 * Persona emoji/avatar for display
 */
const PERSONA_AVATARS: Record<PersonaType, string> = {
  earl: String.fromCodePoint(0x1F474), // old man emoji
  gladys: String.fromCodePoint(0x1F475), // old woman emoji
  kevin: String.fromCodePoint(0x1F468, 0x200D, 0x1F4BB), // man with laptop
  brenda: String.fromCodePoint(0x1F469, 0x200D, 0x1F4BC), // woman with briefcase
};

/**
 * Format duration in a fun, engaging way
 */
function formatDurationFun(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;

  if (mins >= 60) {
    const hours = Math.floor(mins / 60);
    const remainingMins = mins % 60;
    return `${hours}h ${remainingMins}m ${secs}s`;
  }

  return `${mins} min ${secs} sec`;
}

/**
 * Get a fun tagline based on duration
 */
function getDurationTagline(seconds: number): string {
  if (seconds >= 3600) return "LEGENDARY - Over an hour of wasted scammer time!";
  if (seconds >= 1800) return "EPIC - Half an hour of pure confusion!";
  if (seconds >= 900) return "15+ minutes of scammer frustration!";
  if (seconds >= 600) return "10+ minutes of masterful time-wasting!";
  if (seconds >= 300) return "5+ minutes of glorious confusion!";
  return "Another scammer's time wasted!";
}

/**
 * Get rank badge styling
 */
function getRankBadge(rank: number | undefined): { bg: string; text: string } | null {
  if (!rank) return null;

  switch (rank) {
    case 1:
      return { bg: 'bg-gradient-to-r from-yellow-500 to-amber-500', text: 'text-black' };
    case 2:
      return { bg: 'bg-gradient-to-r from-gray-300 to-gray-400', text: 'text-black' };
    case 3:
      return { bg: 'bg-gradient-to-r from-amber-600 to-orange-700', text: 'text-white' };
    default:
      return { bg: 'bg-gray-700', text: 'text-gray-300' };
  }
}

/**
 * Share button component
 */
function ShareButtons({ call, category }: { call: HallOfFameCallEntry; category: string }) {
  const shareUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/calls/${call.id}`
    : `/calls/${call.id}`;

  const shareText = `Check out this ${category === 'longest' ? formatDurationFun(call.duration) + ' long' : 'amazing'} scam call on ScamScrammer! ${call.personaName} wasted the scammer's time beautifully.`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      // Could add a toast notification here
    } catch (err) {
      console.error('Failed to copy link:', err);
    }
  };

  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;
  const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}&quote=${encodeURIComponent(shareText)}`;

  return (
    <div className="flex items-center gap-2">
      {/* Twitter/X Share */}
      <a
        href={twitterUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="p-2 rounded-lg bg-gray-700/50 hover:bg-blue-500/20 text-gray-400 hover:text-blue-400 transition-colors"
        title="Share on X (Twitter)"
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      </a>

      {/* Facebook Share */}
      <a
        href={facebookUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="p-2 rounded-lg bg-gray-700/50 hover:bg-blue-600/20 text-gray-400 hover:text-blue-500 transition-colors"
        title="Share on Facebook"
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
        </svg>
      </a>

      {/* Copy Link */}
      <button
        onClick={handleCopyLink}
        className="p-2 rounded-lg bg-gray-700/50 hover:bg-gray-600/50 text-gray-400 hover:text-white transition-colors"
        title="Copy link"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      </button>
    </div>
  );
}

/**
 * Rating stars component
 */
function RatingStars({ rating }: { rating: number | null }) {
  if (rating === null) return null;

  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <span
          key={star}
          className={`text-lg ${star <= rating ? 'text-yellow-400' : 'text-gray-600'}`}
        >
          {String.fromCodePoint(0x2605)}
        </span>
      ))}
    </div>
  );
}

/**
 * Hall of Fame Card Component
 *
 * Displays a single call entry in the Hall of Fame with fun, engaging styling.
 * Includes persona badge, duration, rating, excerpt, play button, and share buttons.
 */
export default function HallOfFameCard({ call, rank, category }: HallOfFameCardProps) {
  const personaColors = PERSONA_COLORS[call.personaId] || PERSONA_COLORS.earl;
  const personaAvatar = PERSONA_AVATARS[call.personaId] || PERSONA_AVATARS.earl;
  const rankBadge = getRankBadge(rank);

  const formattedDate = new Date(call.createdAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className="relative bg-gradient-to-br from-gray-800/80 to-gray-900/80 rounded-2xl border border-gray-700/50 overflow-hidden hover:border-gray-600/50 transition-all hover:shadow-lg hover:shadow-orange-500/5 group">
      {/* Rank Badge */}
      {rankBadge && (
        <div className={`absolute top-4 left-4 w-8 h-8 rounded-full ${rankBadge.bg} flex items-center justify-center shadow-lg`}>
          <span className={`font-bold text-sm ${rankBadge.text}`}>#{rank}</span>
        </div>
      )}

      {/* Featured Badge */}
      {category === 'featured' && (
        <div className="absolute top-4 left-4 px-3 py-1 rounded-full bg-gradient-to-r from-orange-500 to-red-500 text-white text-xs font-bold shadow-lg">
          {String.fromCodePoint(0x2B50)} FEATURED
        </div>
      )}

      <div className="p-6 pt-14">
        {/* Header: Persona and Duration */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            {/* Persona Avatar */}
            <div className={`w-12 h-12 rounded-full ${personaColors.bg} border ${personaColors.border} flex items-center justify-center text-2xl`}>
              {personaAvatar}
            </div>
            <div>
              <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${personaColors.bg} ${personaColors.text}`}>
                {call.personaName}
              </span>
              <p className="text-gray-500 text-sm mt-1">{formattedDate}</p>
            </div>
          </div>

          {/* Rating */}
          {call.rating && category === 'highestRated' && (
            <RatingStars rating={call.rating} />
          )}
        </div>

        {/* Duration Display */}
        <div className="mb-4">
          <div className="text-3xl font-bold text-white mb-1">
            {formatDurationFun(call.duration)}
          </div>
          <p className="text-sm text-orange-400 font-medium">
            {getDurationTagline(call.duration)}
          </p>
        </div>

        {/* Excerpt/Title */}
        {call.excerpt && (
          <p className="text-gray-400 text-sm mb-4 line-clamp-2 italic">
            &ldquo;{call.excerpt}&rdquo;
          </p>
        )}

        {/* Phone Number (masked) */}
        <p className="text-gray-500 text-xs mb-4 font-mono">
          Caller: {call.maskedPhoneNumber}
        </p>

        {/* Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-700/50">
          {/* Play/View Button */}
          <Link
            href={`/calls/${call.id}`}
            className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-500 rounded-lg font-medium text-sm transition-colors group-hover:shadow-lg group-hover:shadow-orange-500/20"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
            Listen Now
          </Link>

          {/* Share Buttons */}
          <ShareButtons call={call} category={category} />
        </div>
      </div>
    </div>
  );
}
