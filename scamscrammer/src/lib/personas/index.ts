/**
 * Persona Manager and Selection System for ScamScrammer
 *
 * This module provides centralized access to all AI personas and
 * utility functions for selecting and managing them.
 */

import { PersonaType, PersonaConfig } from './types';
import { EARL_PERSONA } from './earl';
import { GLADYS_PERSONA } from './gladys';
import { KEVIN_PERSONA } from './kevin';
import { BRENDA_PERSONA } from './brenda';

/**
 * Registry of all available personas
 */
export const PERSONAS: Record<PersonaType, PersonaConfig> = {
  earl: EARL_PERSONA,
  gladys: GLADYS_PERSONA,
  kevin: KEVIN_PERSONA,
  brenda: BRENDA_PERSONA,
};

/**
 * Get a specific persona by type
 * @param type - The persona type to retrieve
 * @returns The persona configuration
 */
export function getPersona(type: PersonaType): PersonaConfig {
  return PERSONAS[type];
}

/**
 * Get a random persona from the available options
 * @returns A randomly selected persona configuration
 */
export function getRandomPersona(): PersonaConfig {
  const types = Object.keys(PERSONAS) as PersonaType[];
  const randomIndex = Math.floor(Math.random() * types.length);
  return PERSONAS[types[randomIndex]];
}

/**
 * Get all personas as an array
 * @returns Array of all persona configurations
 */
export function getAllPersonas(): PersonaConfig[] {
  return Object.values(PERSONAS);
}

/**
 * Get all available persona types
 * @returns Array of persona type identifiers
 */
export function getPersonaTypes(): PersonaType[] {
  return Object.keys(PERSONAS) as PersonaType[];
}

/**
 * Check if a persona type is valid
 * @param type - The type to validate
 * @returns true if the type is a valid persona type
 */
export function isValidPersonaType(type: string): type is PersonaType {
  return type in PERSONAS;
}

/**
 * Get a persona by name (case-insensitive)
 * @param name - The persona name to search for
 * @returns The persona configuration or undefined if not found
 */
export function getPersonaByName(name: string): PersonaConfig | undefined {
  const normalizedName = name.toLowerCase();
  return getAllPersonas().find(
    (persona) => persona.name.toLowerCase() === normalizedName
  );
}

/**
 * Get the greeting for a specific persona
 * @param type - The persona type
 * @returns The greeting string for that persona
 */
export function getPersonaGreeting(type: PersonaType): string {
  const greetings: Record<PersonaType, string> = {
    earl: "Hello? Hello? Who's there? Hold on, let me turn up my hearing aid... Okay, okay. Hello! This is Earl Pemberton speaking. How can I help you today?",
    gladys: "Hello? Who is this? ... I'm going to need you to identify yourself. What company did you say you're calling from? And what is this regarding?",
    kevin: "...Hello? Oh wait, is this... who is this? Is this Derek? Derek, bro, if this is you doing a bit again I swear... Wait, this isn't Derek is it. Okay. Uh. What's up?",
    brenda: "Oh my gosh, HI! This is Brenda! I am SO glad you called because I was literally just thinking about how I need to connect with more amazing people today! How are you doing, hun?",
  };
  return greetings[type];
}

/**
 * Select a persona based on current settings
 * This function respects the settings configured via the Settings API
 * @param settings - The current persona settings (if available)
 * @returns A persona configuration
 */
export function selectPersonaFromSettings(settings?: {
  enabledPersonas: PersonaType[];
  selectionMode: 'random' | 'round_robin' | 'fixed';
  fixedPersona?: PersonaType;
  lastUsedPersonaIndex?: number;
}): { persona: PersonaConfig; newIndex?: number } {
  // Default to random if no settings provided
  if (!settings) {
    return { persona: getRandomPersona() };
  }

  const { enabledPersonas, selectionMode, fixedPersona, lastUsedPersonaIndex = 0 } = settings;

  // Filter to only enabled personas
  const enabledConfigs = enabledPersonas
    .filter((type) => type in PERSONAS)
    .map((type) => PERSONAS[type]);

  if (enabledConfigs.length === 0) {
    // Fallback to Earl if no valid personas
    return { persona: PERSONAS.earl };
  }

  switch (selectionMode) {
    case 'fixed': {
      if (fixedPersona && fixedPersona in PERSONAS && enabledPersonas.includes(fixedPersona)) {
        return { persona: PERSONAS[fixedPersona] };
      }
      return { persona: enabledConfigs[0] };
    }

    case 'round_robin': {
      const newIndex = (lastUsedPersonaIndex + 1) % enabledConfigs.length;
      return { persona: enabledConfigs[newIndex], newIndex };
    }

    case 'random':
    default: {
      const randomIndex = Math.floor(Math.random() * enabledConfigs.length);
      return { persona: enabledConfigs[randomIndex] };
    }
  }
}

// Re-export types
export * from './types';

// Re-export individual personas
export { EARL_PERSONA, EARL_SYSTEM_PROMPT, EARL_GREETING } from './earl';
export { GLADYS_PERSONA, GLADYS_SYSTEM_PROMPT, GLADYS_GREETING } from './gladys';
export { KEVIN_PERSONA, KEVIN_SYSTEM_PROMPT, KEVIN_GREETING } from './kevin';
export { BRENDA_PERSONA, BRENDA_SYSTEM_PROMPT, BRENDA_GREETING } from './brenda';
