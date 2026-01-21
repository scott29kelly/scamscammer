/**
 * Standardized Persona Types for ScamScrammer
 *
 * This module defines the type system for all AI personas used to
 * engage with scam callers.
 */

/**
 * Available persona types in the system
 */
export type PersonaType = 'earl' | 'gladys' | 'kevin' | 'brenda';

/**
 * Complete configuration for an AI persona
 */
export interface PersonaConfig {
  /** Unique identifier matching PersonaType */
  id: PersonaType;
  /** Display name for the persona */
  name: string;
  /** Full name of the character */
  fullName: string;
  /** Age of the character */
  age: number;
  /** Character's background/occupation */
  background: string;
  /** Personality traits description */
  personality: string;
  /** Geographic location */
  location: string;
  /** Living situation description */
  livingStatus: string;
  /** Full system prompt for the AI */
  systemPrompt: string;
  /** Characteristic phrases the persona uses */
  signaturePhrases: string[];
  /** Topics the persona tends to ramble about */
  tangentTopics: TangentTopic[];
  /** Words/phrases the persona mishears (optional for some personas) */
  mishearings?: MishearingMapping[];
  /** Response timing configuration */
  responseConfig: ResponseConfig;
  /** Voice configuration for future ElevenLabs integration */
  voiceConfig?: VoiceConfig;
}

/**
 * A topic the persona loves to ramble about
 */
export interface TangentTopic {
  /** Brief subject name */
  subject: string;
  /** Detailed description of the tangent */
  details: string;
}

/**
 * Mapping for mishearing words/phrases
 */
export interface MishearingMapping {
  /** The original word/phrase */
  original: string;
  /** What the persona mishears it as */
  misheard: string;
  /** Optional context for the mishearing */
  context?: string;
}

/**
 * Configuration for response timing and behavior probabilities
 */
export interface ResponseConfig {
  /** Minimum pause duration in milliseconds */
  minPauseMs: number;
  /** Maximum pause duration in milliseconds */
  maxPauseMs: number;
  /** Optional delay for hearing aid adjustment */
  hearingAidDelayMs?: number;
  /** Probability (0-1) of going on a tangent */
  tangentProbability: number;
  /** Probability (0-1) of mishearing something */
  mishearingProbability?: number;
}

/**
 * Voice configuration for text-to-speech integration
 */
export interface VoiceConfig {
  /** Voice pitch adjustment */
  pitch?: number;
  /** Voice speed adjustment */
  speed?: number;
  /** Voice ID or name for TTS service */
  voice?: string;
}
