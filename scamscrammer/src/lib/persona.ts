/**
 * Persona Configuration Module
 *
 * @deprecated This file is maintained for backwards compatibility.
 * Please import from '@/lib/personas' or '@/lib/personas/types' instead.
 *
 * New persona system location: src/lib/personas/
 * - types.ts - Type definitions
 * - earl.ts - Earl persona
 * - gladys.ts - Gladys persona
 * - kevin.ts - Kevin persona
 * - brenda.ts - Brenda persona
 * - index.ts - Central manager with getPersona(), getRandomPersona(), etc.
 */

// Re-export types from new location for backwards compatibility
export type {
  PersonaType,
  PersonaConfig,
  TangentTopic,
  MishearingMapping,
  ResponseConfig,
  VoiceConfig,
} from './personas/types';

// Re-export persona manager functions
export {
  PERSONAS,
  getPersona,
  getRandomPersona,
  getAllPersonas,
  getPersonaTypes,
  isValidPersonaType,
  getPersonaByName,
  getPersonaGreeting,
  EARL_PERSONA,
  EARL_SYSTEM_PROMPT,
  EARL_GREETING,
  GLADYS_PERSONA,
  GLADYS_SYSTEM_PROMPT,
  GLADYS_GREETING,
  KEVIN_PERSONA,
  KEVIN_SYSTEM_PROMPT,
  KEVIN_GREETING,
  BRENDA_PERSONA,
  BRENDA_SYSTEM_PROMPT,
  BRENDA_GREETING,
} from './personas';

// Import types for internal backwards-compatible functions
import type { TangentTopic, MishearingMapping, ResponseConfig, PersonaConfig } from './personas/types';
import { EARL_PERSONA } from './personas/earl';

/**
 * @deprecated Use EARL_PERSONA.tangentTopics directly or import from '@/lib/personas/earl'
 * Get a random tangent topic for Earl to ramble about
 * @returns A randomly selected tangent topic
 */
export function getRandomTangent(): TangentTopic {
  const topics = EARL_PERSONA.tangentTopics;
  const index = Math.floor(Math.random() * topics.length);
  return topics[index];
}

/**
 * @deprecated Import from '@/lib/personas/earl' instead
 * Get a mishearing for a given word or phrase
 * @param word - The original word or phrase to check
 * @returns The misheard version if found, or null if no mishearing exists
 */
export function getMishearing(word: string): string | null {
  const normalizedWord = word.toLowerCase().trim();
  const mishearings = EARL_PERSONA.mishearings || [];
  const mapping = mishearings.find(
    (m) => m.original.toLowerCase() === normalizedWord
  );
  return mapping ? mapping.misheard : null;
}

/**
 * @deprecated Use EARL_PERSONA.signaturePhrases directly or import from '@/lib/personas/earl'
 * Get a random signature phrase for Earl
 * @returns A randomly selected signature phrase
 */
export function getRandomPhrase(): string {
  const phrases = EARL_PERSONA.signaturePhrases;
  const index = Math.floor(Math.random() * phrases.length);
  return phrases[index];
}

/**
 * @deprecated Import from '@/lib/personas/earl' or use persona.responseConfig directly
 * Calculate a random pause duration within Earl's response timing
 * @param config - Optional custom response config (defaults to Earl's config)
 * @returns A pause duration in milliseconds
 */
export function getRandomPauseDuration(
  config: ResponseConfig = EARL_PERSONA.responseConfig
): number {
  return (
    Math.floor(Math.random() * (config.maxPauseMs - config.minPauseMs)) +
    config.minPauseMs
  );
}

/**
 * @deprecated Import from '@/lib/personas/earl' or use persona.responseConfig directly
 * Determine if Earl should go on a tangent based on probability
 * @param config - Optional custom response config (defaults to Earl's config)
 * @returns true if Earl should tangent, false otherwise
 */
export function shouldTangent(
  config: ResponseConfig = EARL_PERSONA.responseConfig
): boolean {
  return Math.random() < config.tangentProbability;
}

/**
 * @deprecated Import from '@/lib/personas/earl' or use persona.responseConfig directly
 * Determine if Earl should mishear based on probability
 * @param config - Optional custom response config (defaults to Earl's config)
 * @returns true if Earl should mishear, false otherwise
 */
export function shouldMishear(
  config: ResponseConfig = EARL_PERSONA.responseConfig
): boolean {
  return Math.random() < (config.mishearingProbability || 0);
}

/**
 * @deprecated Import from '@/lib/personas/earl' instead
 * Process text and apply potential mishearings based on probability
 * @param text - The input text to process
 * @param config - Optional custom response config (defaults to Earl's config)
 * @returns The text with potential mishearings applied
 */
export function applyMishearings(
  text: string,
  config: ResponseConfig = EARL_PERSONA.responseConfig
): string {
  if (!shouldMishear(config)) {
    return text;
  }

  const mishearings = EARL_PERSONA.mishearings || [];
  let processedText = text;
  for (const mapping of mishearings) {
    const regex = new RegExp(mapping.original, "gi");
    if (regex.test(processedText) && Math.random() < 0.5) {
      processedText = processedText.replace(regex, mapping.misheard);
      break;
    }
  }
  return processedText;
}

/**
 * @deprecated Use EARL_PERSONA.mishearings directly or import from '@/lib/personas/earl'
 * Get all mishearing mappings
 * @returns Array of all mishearing mappings
 */
export function getAllMishearings(): MishearingMapping[] {
  return [...(EARL_PERSONA.mishearings || [])];
}

/**
 * @deprecated Use EARL_PERSONA.tangentTopics directly or import from '@/lib/personas/earl'
 * Get all tangent topics
 * @returns Array of all tangent topics
 */
export function getAllTangentTopics(): TangentTopic[] {
  return [...EARL_PERSONA.tangentTopics];
}

/**
 * @deprecated Use EARL_PERSONA.signaturePhrases directly or import from '@/lib/personas/earl'
 * Get all signature phrases
 * @returns Array of all signature phrases
 */
export function getAllSignaturePhrases(): string[] {
  return [...EARL_PERSONA.signaturePhrases];
}

/**
 * @deprecated Use getPersona() from '@/lib/personas' instead
 * Create a custom persona configuration based on Earl but with modifications
 * @param overrides - Partial persona config to override Earl's defaults
 * @returns A new PersonaConfig with the overrides applied
 */
export function createCustomPersona(
  overrides: Partial<PersonaConfig>
): PersonaConfig {
  return {
    ...EARL_PERSONA,
    ...overrides,
    responseConfig: {
      ...EARL_PERSONA.responseConfig,
      ...(overrides.responseConfig || {}),
    },
  } as PersonaConfig;
}

export default EARL_PERSONA;
