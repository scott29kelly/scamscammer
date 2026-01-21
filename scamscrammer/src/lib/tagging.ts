/**
 * Call Auto-Tagging System
 *
 * Automatically categorizes scam calls based on transcript analysis.
 * Uses keyword matching for MVP, with optional AI classification.
 */

/**
 * Types of scams that can be detected
 */
export enum ScamType {
  IRS = 'irs',
  TECH_SUPPORT = 'tech_support',
  GIFT_CARD = 'gift_card',
  BANK = 'bank',
  MEDICARE = 'medicare',
  WARRANTY = 'warranty',
  LOTTERY = 'lottery',
  SOCIAL_SECURITY = 'social_security',
  CRYPTO = 'crypto',
  ROMANCE = 'romance',
  UNKNOWN = 'unknown',
}

/**
 * Keywords associated with each scam type
 */
const SCAM_KEYWORDS: Record<ScamType, string[]> = {
  [ScamType.IRS]: [
    'irs',
    'internal revenue',
    'tax',
    'taxes',
    'federal tax',
    'tax debt',
    'tax fraud',
    'tax lien',
    'tax refund',
    'audit',
    'tax evasion',
    'treasury',
    'back taxes',
  ],
  [ScamType.TECH_SUPPORT]: [
    'microsoft',
    'windows',
    'computer',
    'virus',
    'malware',
    'infected',
    'hacked',
    'hacker',
    'tech support',
    'technical support',
    'remote access',
    'anydesk',
    'teamviewer',
    'error message',
    'blue screen',
    'security alert',
    'firewall',
    'norton',
    'mcafee',
    'antivirus',
    'apple support',
    'geek squad',
  ],
  [ScamType.GIFT_CARD]: [
    'gift card',
    'giftcard',
    'itunes',
    'google play',
    'amazon card',
    'target card',
    'walmart card',
    'steam card',
    'best buy card',
    'prepaid card',
    'redemption code',
    'scratch off',
  ],
  [ScamType.BANK]: [
    'bank',
    'banking',
    'account',
    'wire transfer',
    'routing number',
    'account number',
    'suspicious activity',
    'fraud alert',
    'chase',
    'wells fargo',
    'bank of america',
    'citibank',
    'credit union',
    'unauthorized transaction',
    'overdraft',
    'direct deposit',
  ],
  [ScamType.MEDICARE]: [
    'medicare',
    'medicaid',
    'health insurance',
    'prescription',
    'medical card',
    'healthcare',
    'new medicare card',
    'benefits',
    'enrollment',
    'coverage',
    'supplement',
    'part d',
    'part b',
  ],
  [ScamType.WARRANTY]: [
    'warranty',
    'extended warranty',
    'car warranty',
    'vehicle warranty',
    'auto warranty',
    'service contract',
    'coverage expiring',
    'factory warranty',
    'bumper to bumper',
  ],
  [ScamType.LOTTERY]: [
    'lottery',
    'sweepstakes',
    'prize',
    'winner',
    'jackpot',
    'you won',
    'congratulations',
    'million dollars',
    'publishers clearing',
    'mega millions',
    'powerball',
    'lucky',
  ],
  [ScamType.SOCIAL_SECURITY]: [
    'social security',
    'ssa',
    'social security number',
    'ssn',
    'benefits suspended',
    'identity theft',
    'social security administration',
    'your number has been',
    'compromised',
    'suspended',
  ],
  [ScamType.CRYPTO]: [
    'bitcoin',
    'cryptocurrency',
    'crypto',
    'ethereum',
    'blockchain',
    'wallet',
    'coinbase',
    'binance',
    'investment opportunity',
    'returns',
    'trading platform',
  ],
  [ScamType.ROMANCE]: [
    'love',
    'dating',
    'relationship',
    'overseas',
    'military',
    'deployment',
    'send money',
    'western union',
    'moneygram',
    'emergency',
    'hospital',
    'customs',
  ],
  [ScamType.UNKNOWN]: [],
};

/**
 * General tags that can be detected from conversation content
 */
const GENERAL_TAG_KEYWORDS: Record<string, string[]> = {
  aggressive: [
    'angry',
    'yelling',
    'screaming',
    'cursing',
    'threatening',
    'threat',
    'police',
    'arrest',
    'lawsuit',
    'lawyer',
  ],
  urgent: [
    'urgent',
    'immediately',
    'right now',
    'today only',
    'act now',
    'expires',
    'deadline',
    'time sensitive',
    'limited time',
  ],
  impersonation: [
    'officer',
    'agent',
    'investigator',
    'detective',
    'federal',
    'government',
    'official',
    'department',
    'authority',
  ],
  payment_request: [
    'payment',
    'pay',
    'send',
    'transfer',
    'wire',
    'money',
    'dollars',
    'fee',
    'deposit',
    'amount',
  ],
  personal_info: [
    'social security',
    'date of birth',
    'address',
    'mother maiden',
    'password',
    'pin',
    'verification',
    'verify',
    'confirm',
  ],
  callback: ['call back', 'callback', 'return call', 'call us back', 'press 1', 'press one'],
  robocall: ['automated', 'recorded', 'press 1', 'press one', 'this is a call from', 'this is an important'],
  successful_waste: ['hold on', 'wait', 'one moment', 'let me check', 'hold please', 'just a minute'],
};

/**
 * Analyze transcript text and return detected scam type and tags
 */
export function analyzeCallForTags(transcript: string): {
  scamType: ScamType;
  tags: string[];
  confidence: number;
} {
  const normalizedTranscript = transcript.toLowerCase();
  const tags: string[] = [];
  const scamTypeScores: Record<ScamType, number> = {} as Record<ScamType, number>;

  // Initialize scores
  for (const scamType of Object.values(ScamType)) {
    scamTypeScores[scamType] = 0;
  }

  // Check for scam type keywords
  for (const [scamType, keywords] of Object.entries(SCAM_KEYWORDS)) {
    for (const keyword of keywords) {
      if (normalizedTranscript.includes(keyword.toLowerCase())) {
        scamTypeScores[scamType as ScamType] += 1;
      }
    }
  }

  // Check for general tags
  for (const [tag, keywords] of Object.entries(GENERAL_TAG_KEYWORDS)) {
    for (const keyword of keywords) {
      if (normalizedTranscript.includes(keyword.toLowerCase())) {
        if (!tags.includes(tag)) {
          tags.push(tag);
        }
        break; // Only need one match per tag
      }
    }
  }

  // Determine the scam type with highest score
  let detectedScamType = ScamType.UNKNOWN;
  let highestScore = 0;
  let totalScore = 0;

  for (const [scamType, score] of Object.entries(scamTypeScores)) {
    totalScore += score;
    if (score > highestScore) {
      highestScore = score;
      detectedScamType = scamType as ScamType;
    }
  }

  // Calculate confidence (0-1)
  const confidence = totalScore > 0 ? Math.min(highestScore / Math.max(totalScore, 5), 1) : 0;

  // Only use the detected type if we have reasonable confidence
  if (highestScore < 2) {
    detectedScamType = ScamType.UNKNOWN;
  }

  // Add the scam type as a tag if detected
  if (detectedScamType !== ScamType.UNKNOWN) {
    const scamTypeTag = detectedScamType.replace('_', '-');
    if (!tags.includes(scamTypeTag)) {
      tags.unshift(scamTypeTag); // Add to beginning
    }
  }

  return {
    scamType: detectedScamType,
    tags,
    confidence,
  };
}

/**
 * Get a human-readable label for a scam type
 */
export function getScamTypeLabel(scamType: ScamType): string {
  const labels: Record<ScamType, string> = {
    [ScamType.IRS]: 'IRS/Tax Scam',
    [ScamType.TECH_SUPPORT]: 'Tech Support Scam',
    [ScamType.GIFT_CARD]: 'Gift Card Scam',
    [ScamType.BANK]: 'Banking Scam',
    [ScamType.MEDICARE]: 'Medicare Scam',
    [ScamType.WARRANTY]: 'Warranty Scam',
    [ScamType.LOTTERY]: 'Lottery/Sweepstakes Scam',
    [ScamType.SOCIAL_SECURITY]: 'Social Security Scam',
    [ScamType.CRYPTO]: 'Cryptocurrency Scam',
    [ScamType.ROMANCE]: 'Romance Scam',
    [ScamType.UNKNOWN]: 'Unknown Type',
  };
  return labels[scamType] || 'Unknown Type';
}

/**
 * Get color for a scam type (for UI)
 */
export function getScamTypeColor(scamType: ScamType): string {
  const colors: Record<ScamType, string> = {
    [ScamType.IRS]: '#EF4444', // red
    [ScamType.TECH_SUPPORT]: '#3B82F6', // blue
    [ScamType.GIFT_CARD]: '#F59E0B', // amber
    [ScamType.BANK]: '#10B981', // emerald
    [ScamType.MEDICARE]: '#6366F1', // indigo
    [ScamType.WARRANTY]: '#8B5CF6', // violet
    [ScamType.LOTTERY]: '#EC4899', // pink
    [ScamType.SOCIAL_SECURITY]: '#F97316', // orange
    [ScamType.CRYPTO]: '#14B8A6', // teal
    [ScamType.ROMANCE]: '#F472B6', // pink
    [ScamType.UNKNOWN]: '#6B7280', // gray
  };
  return colors[scamType] || '#6B7280';
}

/**
 * Get color for a general tag
 */
export function getTagColor(tag: string): string {
  const colors: Record<string, string> = {
    aggressive: '#EF4444',
    urgent: '#F59E0B',
    impersonation: '#8B5CF6',
    payment_request: '#10B981',
    personal_info: '#EC4899',
    callback: '#6366F1',
    robocall: '#64748B',
    successful_waste: '#22C55E',
  };
  return colors[tag] || '#6B7280';
}

/**
 * Format tag for display
 */
export function formatTagLabel(tag: string): string {
  return tag
    .replace(/_/g, ' ')
    .replace(/-/g, ' ')
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
