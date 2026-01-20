/**
 * Tests for Earl AI Persona Configuration
 */

import {
  EarlPersona,
  EARL_SYSTEM_PROMPT,
  EARL_TANGENT_TOPICS,
  EARL_SIGNATURE_PHRASES,
  EARL_MISHEARINGS,
  EARL_TIMING_CONFIG,
  getRandomTangent,
  getTangentByTrigger,
  getMishearing,
  getMishearingsByCategory,
  getRandomPhrase,
  getResponseDelay,
  shouldPause,
  shouldAskForRepetition,
  getRepetitionRequest,
  PersonaRegistry,
  getPersona,
  getDefaultPersona,
  registerPersona,
  PersonaConfig,
} from '../persona';

describe('Earl AI Persona Configuration', () => {
  describe('EarlPersona object', () => {
    it('should have correct basic properties', () => {
      expect(EarlPersona.id).toBe('earl-pemberton');
      expect(EarlPersona.name).toBe('Earl Pemberton');
      expect(EarlPersona.age).toBe(81);
    });

    it('should have a background', () => {
      expect(EarlPersona.background).toBeDefined();
      expect(EarlPersona.background.length).toBeGreaterThan(0);
      expect(EarlPersona.background).toContain('refrigerator');
      expect(EarlPersona.background).toContain('Tulsa');
    });

    it('should have personality traits', () => {
      expect(EarlPersona.personality).toBeInstanceOf(Array);
      expect(EarlPersona.personality.length).toBeGreaterThan(0);
      expect(EarlPersona.personality).toContain('Cheerful and trusting');
    });

    it('should have tangent topics', () => {
      expect(EarlPersona.tangentTopics).toBe(EARL_TANGENT_TOPICS);
      expect(EarlPersona.tangentTopics.length).toBeGreaterThan(0);
    });

    it('should have signature phrases', () => {
      expect(EarlPersona.signaturePhrases).toBe(EARL_SIGNATURE_PHRASES);
      expect(EarlPersona.signaturePhrases.length).toBeGreaterThan(0);
    });

    it('should have mishearings', () => {
      expect(EarlPersona.mishearings).toBe(EARL_MISHEARINGS);
      expect(EarlPersona.mishearings.length).toBeGreaterThan(0);
    });

    it('should have timing configuration', () => {
      expect(EarlPersona.timing).toBe(EARL_TIMING_CONFIG);
      expect(EarlPersona.timing.minResponseDelay).toBeDefined();
      expect(EarlPersona.timing.maxResponseDelay).toBeDefined();
    });

    it('should have the system prompt', () => {
      expect(EarlPersona.systemPrompt).toBe(EARL_SYSTEM_PROMPT);
    });
  });

  describe('EARL_SYSTEM_PROMPT', () => {
    it('should contain character name and age', () => {
      expect(EARL_SYSTEM_PROMPT).toContain('Earl Pemberton');
      expect(EARL_SYSTEM_PROMPT).toContain('81');
    });

    it('should contain character background', () => {
      expect(EARL_SYSTEM_PROMPT).toContain('refrigerator repairman');
      expect(EARL_SYSTEM_PROMPT).toContain('Tulsa');
    });

    it('should contain core behaviors section', () => {
      expect(EARL_SYSTEM_PROMPT).toContain('CORE BEHAVIORS');
    });

    it('should contain safety instructions (NEVER section)', () => {
      expect(EARL_SYSTEM_PROMPT).toContain('NEVER');
      expect(EARL_SYSTEM_PROMPT).toContain('Provide any actual personal information');
      expect(EARL_SYSTEM_PROMPT).toContain('Break character');
    });

    it('should mention key characters', () => {
      expect(EARL_SYSTEM_PROMPT).toContain('General Patton');
      expect(EARL_SYSTEM_PROMPT).toContain('Phyllis');
      expect(EARL_SYSTEM_PROMPT).toContain('Mabel');
    });
  });

  describe('EARL_TANGENT_TOPICS', () => {
    it('should have multiple tangent topics', () => {
      expect(EARL_TANGENT_TOPICS.length).toBeGreaterThanOrEqual(5);
    });

    it('should have name and description for each topic', () => {
      EARL_TANGENT_TOPICS.forEach((topic) => {
        expect(topic.name).toBeDefined();
        expect(topic.name.length).toBeGreaterThan(0);
        expect(topic.description).toBeDefined();
        expect(topic.description.length).toBeGreaterThan(0);
      });
    });

    it('should include key topics from the plan', () => {
      const topicNames = EARL_TANGENT_TOPICS.map((t) => t.name.toLowerCase());
      expect(topicNames.some((n) => n.includes('general patton'))).toBe(true);
      expect(topicNames.some((n) => n.includes('elvis'))).toBe(true);
      expect(topicNames.some((n) => n.includes('knee'))).toBe(true);
      expect(topicNames.some((n) => n.includes('hummingbird'))).toBe(true);
    });

    it('should have triggers for topics', () => {
      const topicsWithTriggers = EARL_TANGENT_TOPICS.filter(
        (t) => t.triggers && t.triggers.length > 0
      );
      expect(topicsWithTriggers.length).toBeGreaterThan(0);
    });
  });

  describe('EARL_SIGNATURE_PHRASES', () => {
    it('should have multiple signature phrases', () => {
      expect(EARL_SIGNATURE_PHRASES.length).toBeGreaterThanOrEqual(5);
    });

    it('should include key phrases from the plan', () => {
      expect(EARL_SIGNATURE_PHRASES).toContain("Well I'll be dipped!");
      expect(EARL_SIGNATURE_PHRASES.some((p) => p.includes('Phyllis'))).toBe(true);
      expect(EARL_SIGNATURE_PHRASES.some((p) => p.includes('General Patton'))).toBe(true);
    });
  });

  describe('EARL_MISHEARINGS', () => {
    it('should have multiple mishearings', () => {
      expect(EARL_MISHEARINGS.length).toBeGreaterThanOrEqual(10);
    });

    it('should include key mishearings from the plan', () => {
      const creditCard = EARL_MISHEARINGS.find((m) => m.original === 'credit card');
      expect(creditCard).toBeDefined();
      expect(creditCard?.misheard).toBe('bread cart');

      const microsoft = EARL_MISHEARINGS.find((m) => m.original === 'Microsoft');
      expect(microsoft).toBeDefined();
      expect(microsoft?.misheard).toBe('micro soft-serve');
    });

    it('should have categories for mishearings', () => {
      const categorized = EARL_MISHEARINGS.filter((m) => m.category);
      expect(categorized.length).toBeGreaterThan(0);

      const categories = [...new Set(categorized.map((m) => m.category))];
      expect(categories).toContain('financial');
      expect(categories).toContain('tech');
      expect(categories).toContain('scam');
    });
  });

  describe('EARL_TIMING_CONFIG', () => {
    it('should have valid timing values', () => {
      expect(EARL_TIMING_CONFIG.minResponseDelay).toBeGreaterThan(0);
      expect(EARL_TIMING_CONFIG.maxResponseDelay).toBeGreaterThan(
        EARL_TIMING_CONFIG.minResponseDelay
      );
      expect(EARL_TIMING_CONFIG.pauseDuration).toBeGreaterThan(0);
    });

    it('should have probabilities between 0 and 1', () => {
      expect(EARL_TIMING_CONFIG.pauseProbability).toBeGreaterThanOrEqual(0);
      expect(EARL_TIMING_CONFIG.pauseProbability).toBeLessThanOrEqual(1);
      expect(EARL_TIMING_CONFIG.repeatRequestProbability).toBeGreaterThanOrEqual(0);
      expect(EARL_TIMING_CONFIG.repeatRequestProbability).toBeLessThanOrEqual(1);
    });
  });

  describe('getRandomTangent()', () => {
    it('should return a valid tangent topic', () => {
      const tangent = getRandomTangent();
      expect(tangent).toBeDefined();
      expect(tangent.name).toBeDefined();
      expect(tangent.description).toBeDefined();
      expect(EARL_TANGENT_TOPICS).toContain(tangent);
    });

    it('should return different topics over multiple calls (randomness test)', () => {
      const results = new Set<string>();
      // Call 50 times to get variety
      for (let i = 0; i < 50; i++) {
        results.add(getRandomTangent().name);
      }
      // Should get at least 2 different topics
      expect(results.size).toBeGreaterThan(1);
    });
  });

  describe('getTangentByTrigger()', () => {
    it('should find tangent by trigger word', () => {
      const tangent = getTangentByTrigger('bird');
      expect(tangent).toBeDefined();
      expect(tangent?.name.toLowerCase()).toContain('parakeet');
    });

    it('should be case insensitive', () => {
      const tangent1 = getTangentByTrigger('BIRD');
      const tangent2 = getTangentByTrigger('bird');
      expect(tangent1).toEqual(tangent2);
    });

    it('should return undefined for unknown triggers', () => {
      const tangent = getTangentByTrigger('xyznonexistent');
      expect(tangent).toBeUndefined();
    });
  });

  describe('getMishearing()', () => {
    it('should find mishearing for known word', () => {
      const misheard = getMishearing('credit card');
      expect(misheard).toBe('bread cart');
    });

    it('should be case insensitive', () => {
      const misheard = getMishearing('CREDIT CARD');
      expect(misheard).toBe('bread cart');
    });

    it('should find mishearing in partial match', () => {
      const misheard = getMishearing('your credit card number');
      expect(misheard).toBe('bread cart');
    });

    it('should return undefined for unknown words', () => {
      const misheard = getMishearing('hello');
      expect(misheard).toBeUndefined();
    });
  });

  describe('getMishearingsByCategory()', () => {
    it('should return mishearings for a valid category', () => {
      const financialMishearings = getMishearingsByCategory('financial');
      expect(financialMishearings.length).toBeGreaterThan(0);
      financialMishearings.forEach((m) => {
        expect(m.category).toBe('financial');
      });
    });

    it('should return empty array for unknown category', () => {
      const mishearings = getMishearingsByCategory('nonexistent');
      expect(mishearings).toEqual([]);
    });
  });

  describe('getRandomPhrase()', () => {
    it('should return a valid signature phrase', () => {
      const phrase = getRandomPhrase();
      expect(phrase).toBeDefined();
      expect(EARL_SIGNATURE_PHRASES).toContain(phrase);
    });

    it('should return different phrases over multiple calls (randomness test)', () => {
      const results = new Set<string>();
      for (let i = 0; i < 50; i++) {
        results.add(getRandomPhrase());
      }
      expect(results.size).toBeGreaterThan(1);
    });
  });

  describe('getResponseDelay()', () => {
    it('should return a value within configured range', () => {
      for (let i = 0; i < 20; i++) {
        const delay = getResponseDelay();
        expect(delay).toBeGreaterThanOrEqual(EARL_TIMING_CONFIG.minResponseDelay);
        expect(delay).toBeLessThanOrEqual(EARL_TIMING_CONFIG.maxResponseDelay);
      }
    });
  });

  describe('shouldPause()', () => {
    it('should return a boolean', () => {
      const result = shouldPause();
      expect(typeof result).toBe('boolean');
    });
  });

  describe('shouldAskForRepetition()', () => {
    it('should return a boolean', () => {
      const result = shouldAskForRepetition();
      expect(typeof result).toBe('boolean');
    });
  });

  describe('getRepetitionRequest()', () => {
    it('should return a non-empty string', () => {
      const request = getRepetitionRequest();
      expect(typeof request).toBe('string');
      expect(request.length).toBeGreaterThan(0);
    });

    it('should return different requests over multiple calls', () => {
      const results = new Set<string>();
      for (let i = 0; i < 50; i++) {
        results.add(getRepetitionRequest());
      }
      expect(results.size).toBeGreaterThan(1);
    });
  });

  describe('PersonaRegistry', () => {
    it('should contain Earl persona by default', () => {
      expect(PersonaRegistry.has('earl-pemberton')).toBe(true);
      expect(PersonaRegistry.get('earl-pemberton')).toBe(EarlPersona);
    });
  });

  describe('getPersona()', () => {
    it('should return Earl persona by ID', () => {
      const persona = getPersona('earl-pemberton');
      expect(persona).toBe(EarlPersona);
    });

    it('should return undefined for unknown ID', () => {
      const persona = getPersona('nonexistent');
      expect(persona).toBeUndefined();
    });
  });

  describe('getDefaultPersona()', () => {
    it('should return Earl persona', () => {
      const persona = getDefaultPersona();
      expect(persona).toBe(EarlPersona);
    });
  });

  describe('registerPersona()', () => {
    it('should register a new persona', () => {
      const newPersona: PersonaConfig = {
        id: 'test-persona',
        name: 'Test Person',
        age: 50,
        background: 'Test background',
        personality: ['trait1', 'trait2'],
        tangentTopics: [],
        signaturePhrases: ['phrase1'],
        mishearings: [],
        timing: {
          minResponseDelay: 100,
          maxResponseDelay: 200,
          pauseProbability: 0.1,
          pauseDuration: 1000,
          repeatRequestProbability: 0.1,
        },
        systemPrompt: 'Test prompt',
      };

      registerPersona(newPersona);
      expect(PersonaRegistry.has('test-persona')).toBe(true);
      expect(getPersona('test-persona')).toBe(newPersona);

      // Clean up
      PersonaRegistry.delete('test-persona');
    });
  });
});
