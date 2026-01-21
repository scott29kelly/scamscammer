/**
 * Open Graph Image Utility Functions
 *
 * Utilities for generating dynamic OG images and metadata for social sharing.
 * Each persona has their own color scheme and style for visual distinction.
 */

import type { Call, CallSegment } from '@prisma/client';
import type { PersonaType } from '@/lib/personas/types';

/**
 * Extended call type with segments for OG generation
 */
export interface CallWithSegments extends Call {
  segments: CallSegment[];
}

/**
 * Persona color configuration for OG images
 */
export interface PersonaColorConfig {
  primary: string;
  secondary: string;
  accent: string;
  gradient: string;
  textColor: string;
}

/**
 * Color configurations for each persona
 */
export const PERSONA_COLORS: Record<PersonaType, PersonaColorConfig> = {
  earl: {
    primary: '#4A90A4',    // Warm teal - friendly elderly vibe
    secondary: '#2D5A6B',  // Darker teal
    accent: '#F5A623',     // Golden yellow for warmth
    gradient: 'linear-gradient(135deg, #2D5A6B 0%, #4A90A4 50%, #6BB5C9 100%)',
    textColor: '#FFFFFF',
  },
  gladys: {
    primary: '#8B5A8B',    // Dusty purple - suspicious librarian
    secondary: '#5A3D5A',  // Darker purple
    accent: '#C9A959',     // Antique gold
    gradient: 'linear-gradient(135deg, #5A3D5A 0%, #8B5A8B 50%, #A678A6 100%)',
    textColor: '#FFFFFF',
  },
  kevin: {
    primary: '#6B8E23',    // Olive green - laid back stoner vibe
    secondary: '#4A6B1A',  // Darker green
    accent: '#FFD700',     // Bright yellow for energy
    gradient: 'linear-gradient(135deg, #4A6B1A 0%, #6B8E23 50%, #8FAF3E 100%)',
    textColor: '#FFFFFF',
  },
  brenda: {
    primary: '#FF69B4',    // Hot pink - MLM boss babe energy
    secondary: '#C44D8C',  // Darker pink
    accent: '#FFD700',     // Gold for "success"
    gradient: 'linear-gradient(135deg, #C44D8C 0%, #FF69B4 50%, #FF8DC7 100%)',
    textColor: '#FFFFFF',
  },
};

/**
 * Default color config when persona is unknown
 */
export const DEFAULT_COLORS: PersonaColorConfig = {
  primary: '#3B82F6',    // Blue
  secondary: '#1E40AF',  // Darker blue
  accent: '#FBBF24',     // Yellow
  gradient: 'linear-gradient(135deg, #1E40AF 0%, #3B82F6 50%, #60A5FA 100%)',
  textColor: '#FFFFFF',
};

/**
 * Persona descriptions for OG images
 */
export const PERSONA_DESCRIPTIONS: Record<PersonaType, string> = {
  earl: 'Earl Pemberton, 81 - Confused but friendly retired refrigerator repairman',
  gladys: 'Gladys Hoffmann, 78 - Deeply suspicious retired librarian',
  kevin: 'Kevin, 22 - Perpetually confused philosophy dropout',
  brenda: 'Brenda Kowalski, 43 - MLM boss babe extraordinaire',
};

/**
 * Action verbs for each persona to use in titles
 */
const PERSONA_ACTIONS: Record<PersonaType, string[]> = {
  earl: [
    'discusses bread carts with',
    'reminisces about Elvis with',
    'adjusts hearing aid for',
    'shares hummingbird tips with',
    'confuses',
    'tells parakeet stories to',
    'rambles at',
  ],
  gladys: [
    'demands credentials from',
    'interrogates',
    'asks for supervisor of',
    'takes notes on',
    'suspiciously questions',
    'requests badge number from',
    'threatens BBB complaint to',
  ],
  kevin: [
    'philosophizes with',
    'spaces out on',
    'asks existential questions of',
    'zones out during call with',
    'confuses Derek for',
    'forgets what they were saying to',
    'ponders the meaning of',
  ],
  brenda: [
    'pitches VitaLife to',
    'tries to recruit',
    'invites to Facebook VIP group',
    'offers business opportunity to',
    'shares testimonials with',
    'reverse-scams',
    'enthusiastically confuses',
  ],
};

/**
 * Detect persona type from call data
 * Checks tags, notes, or segment content for persona indicators
 */
export function detectPersonaFromCall(call: CallWithSegments): PersonaType | null {
  // Check tags first
  const personaTypes: PersonaType[] = ['earl', 'gladys', 'kevin', 'brenda'];

  for (const persona of personaTypes) {
    if (call.tags?.some((tag) => tag.toLowerCase() === persona)) {
      return persona;
    }
  }

  // Check notes for persona name
  const notesLower = call.notes?.toLowerCase() || '';
  for (const persona of personaTypes) {
    if (notesLower.includes(persona)) {
      return persona;
    }
  }

  // Check segment content for persona indicators
  if (call.segments && call.segments.length > 0) {
    const allText = call.segments
      .filter((s) => s.speaker === 'EARL') // Persona speaker
      .map((s) => s.text.toLowerCase())
      .join(' ');

    // Earl indicators
    if (
      allText.includes('general patton') ||
      allText.includes('hearing aid') ||
      allText.includes('bread cart') ||
      allText.includes('phyllis')
    ) {
      return 'earl';
    }

    // Gladys indicators
    if (
      allText.includes('mr. whiskers') ||
      allText.includes('harold') ||
      allText.includes('badge number') ||
      allText.includes('supervisor')
    ) {
      return 'gladys';
    }

    // Kevin indicators
    if (
      allText.includes('duuude') ||
      allText.includes('bro') ||
      allText.includes('derek') ||
      allText.includes('smoothie')
    ) {
      return 'kevin';
    }

    // Brenda indicators
    if (
      allText.includes('vitalife') ||
      allText.includes('boss babe') ||
      allText.includes('hun') ||
      allText.includes('financial freedom')
    ) {
      return 'brenda';
    }
  }

  // Default to Earl if no match
  return 'earl';
}

/**
 * Get color configuration for a persona type
 */
export function getPersonaColor(personaType: string): PersonaColorConfig {
  const validTypes: PersonaType[] = ['earl', 'gladys', 'kevin', 'brenda'];
  if (validTypes.includes(personaType as PersonaType)) {
    return PERSONA_COLORS[personaType as PersonaType];
  }
  return DEFAULT_COLORS;
}

/**
 * Format duration as human-readable string
 */
export function formatDuration(seconds: number | null): string {
  if (!seconds || seconds <= 0) {
    return 'a few seconds';
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes === 0) {
    return `${remainingSeconds} second${remainingSeconds !== 1 ? 's' : ''}`;
  }

  if (minutes === 1) {
    return remainingSeconds > 0
      ? `1 minute and ${remainingSeconds} seconds`
      : '1 minute';
  }

  return remainingSeconds > 0
    ? `${minutes} minutes and ${remainingSeconds} seconds`
    : `${minutes} minutes`;
}

/**
 * Format duration for display in OG image (shorter format)
 */
export function formatDurationShort(seconds: number | null): string {
  if (!seconds || seconds <= 0) {
    return '0:00';
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

/**
 * Generate a fun, shareable title for a call
 * Examples:
 * - "Earl discusses bread carts for 12 minutes"
 * - "Gladys demands supervisor's employee ID for 8 minutes"
 * - "Kevin philosophizes about social security numbers"
 * - "Brenda pitches VitaLife to confused scammer"
 */
export function generateCallTitle(call: CallWithSegments): string {
  const persona = detectPersonaFromCall(call);
  const personaType = persona || 'earl';
  const duration = call.duration;

  // Get persona name
  const personaNames: Record<PersonaType, string> = {
    earl: 'Earl',
    gladys: 'Gladys',
    kevin: 'Kevin',
    brenda: 'Brenda',
  };
  const personaName = personaNames[personaType];

  // Get a random action for this persona
  const actions = PERSONA_ACTIONS[personaType];
  const randomAction = actions[Math.floor(Math.random() * actions.length)];

  // Build the title
  if (duration && duration >= 60) {
    const minutes = Math.floor(duration / 60);
    return `${personaName} ${randomAction} a scammer for ${minutes} minute${minutes !== 1 ? 's' : ''}`;
  } else if (duration) {
    return `${personaName} ${randomAction} a scammer for ${duration} seconds`;
  }

  return `${personaName} ${randomAction} a scammer`;
}

/**
 * Generate a deterministic title (same result for same call ID)
 * Used for metadata generation where consistency matters
 */
export function generateCallTitleDeterministic(call: CallWithSegments): string {
  const persona = detectPersonaFromCall(call);
  const personaType = persona || 'earl';
  const duration = call.duration;

  const personaNames: Record<PersonaType, string> = {
    earl: 'Earl',
    gladys: 'Gladys',
    kevin: 'Kevin',
    brenda: 'Brenda',
  };
  const personaName = personaNames[personaType];

  // Use call ID to deterministically select an action
  const actions = PERSONA_ACTIONS[personaType];
  const hash = call.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const actionIndex = hash % actions.length;
  const action = actions[actionIndex];

  if (duration && duration >= 60) {
    const minutes = Math.floor(duration / 60);
    return `${personaName} ${action} a scammer for ${minutes} minute${minutes !== 1 ? 's' : ''}`;
  } else if (duration) {
    return `${personaName} ${action} a scammer for ${duration} seconds`;
  }

  return `${personaName} ${action} a scammer`;
}

/**
 * Generate a brief, shareable description for a call
 */
export function generateCallDescription(call: CallWithSegments): string {
  const persona = detectPersonaFromCall(call);
  const personaType = persona || 'earl';
  const duration = call.duration;

  // Get persona description
  const description = PERSONA_DESCRIPTIONS[personaType];

  // Build the full description
  const durationText = duration
    ? `Wasted ${formatDuration(duration)} of a scammer's time.`
    : 'Another scammer confused.';

  return `${durationText} ${description}. ScamScrammer - AI-powered scam call entertainment.`;
}

/**
 * Generate the headline text for the OG image
 */
export function generateOgHeadline(call: CallWithSegments): string {
  const duration = call.duration;

  if (duration && duration >= 60) {
    const minutes = Math.floor(duration / 60);
    return `Wasted ${minutes} minute${minutes !== 1 ? 's' : ''} of a scammer's time!`;
  } else if (duration && duration > 0) {
    return `Wasted ${duration} second${duration !== 1 ? 's' : ''} of a scammer's time!`;
  }

  return "Confused another scammer!";
}

/**
 * Get the persona avatar emoji/icon
 */
export function getPersonaEmoji(personaType: PersonaType): string {
  const emojis: Record<PersonaType, string> = {
    earl: '👴',
    gladys: '👵',
    kevin: '🧔',
    brenda: '💁‍♀️',
  };
  return emojis[personaType] || '📞';
}

/**
 * Get full persona display name with age
 */
export function getPersonaDisplayName(personaType: PersonaType): string {
  const names: Record<PersonaType, string> = {
    earl: 'Earl Pemberton, 81',
    gladys: 'Gladys Hoffmann, 78',
    kevin: 'Kevin, 22',
    brenda: 'Brenda Kowalski, 43',
  };
  return names[personaType] || 'ScamScrammer AI';
}

/**
 * Get a short tagline for each persona
 */
export function getPersonaTagline(personaType: PersonaType): string {
  const taglines: Record<PersonaType, string> = {
    earl: 'Retired refrigerator repairman from Tulsa',
    gladys: 'Suspicious retired librarian from Milwaukee',
    kevin: 'Confused philosophy dropout',
    brenda: 'MLM boss babe with a business opportunity',
  };
  return taglines[personaType] || 'AI-powered scam fighter';
}

/**
 * Generate site URL for OG tags
 */
export function getSiteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL || process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'https://scamscrammer.com';
}

/**
 * Generate OG image URL for a call
 */
export function getOgImageUrl(callId: string): string {
  const baseUrl = getSiteUrl();
  return `${baseUrl}/api/og/${callId}`;
}

/**
 * Generate call page URL
 */
export function getCallUrl(callId: string): string {
  const baseUrl = getSiteUrl();
  return `${baseUrl}/calls/${callId}`;
}
