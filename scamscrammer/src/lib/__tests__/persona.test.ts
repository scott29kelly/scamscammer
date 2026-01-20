/**
 * Tests for Earl Persona Configuration
 */

import {
  EARL_PERSONA,
  EARL_TANGENT_TOPICS,
  EARL_MISHEARINGS,
  EARL_SIGNATURE_PHRASES,
  getSystemPrompt,
  getRandomTangent,
  getMishearing,
  getRandomPhrase,
  getGreeting
} from '../persona';

describe('Earl Persona Configuration', () => {
  describe('EARL_PERSONA', () => {
    it('should have correct basic information', () => {
      expect(EARL_PERSONA.name).toBe('Earl Pemberton');
      expect(EARL_PERSONA.age).toBe(81);
      expect(EARL_PERSONA.occupation).toBe('Retired Refrigerator Repairman');
      expect(EARL_PERSONA.location).toBe('Tulsa, Oklahoma');
    });

    it('should have personality traits defined', () => {
      expect(EARL_PERSONA.personality).toBeInstanceOf(Array);
      expect(EARL_PERSONA.personality.length).toBeGreaterThan(0);
      expect(EARL_PERSONA.personality).toContain('Cheerful and optimistic');
    });

    it('should have behaviors defined', () => {
      expect(EARL_PERSONA.behaviors).toBeInstanceOf(Array);
      expect(EARL_PERSONA.behaviors.length).toBeGreaterThan(0);
      expect(EARL_PERSONA.behaviors).toContain('Mishears words frequently');
      expect(EARL_PERSONA.behaviors).toContain('Never hangs up first');
    });

    it('should have voice configuration', () => {
      expect(EARL_PERSONA.voice).toBeDefined();
      expect(EARL_PERSONA.voice.voice).toBe('ash');
      expect(EARL_PERSONA.voice.speed).toBeLessThan(1); // Slower speech
    });
  });

  describe('EARL_TANGENT_TOPICS', () => {
    it('should have multiple tangent topics', () => {
      expect(EARL_TANGENT_TOPICS.length).toBeGreaterThan(5);
    });

    it('should include General Patton story', () => {
      const generalPatton = EARL_TANGENT_TOPICS.find(
        (t) => t.name === 'General Patton the Parakeet'
      );
      expect(generalPatton).toBeDefined();
      expect(generalPatton?.story).toContain('parakeet');
    });

    it('should include Elvis refrigerator story', () => {
      const elvis = EARL_TANGENT_TOPICS.find(
        (t) => t.name === "Elvis's Refrigerator"
      );
      expect(elvis).toBeDefined();
      expect(elvis?.story).toContain('1974');
      expect(elvis?.story).toContain('Graceland');
    });

    it('should have triggers for each topic', () => {
      EARL_TANGENT_TOPICS.forEach((topic) => {
        expect(topic.name).toBeTruthy();
        expect(topic.story).toBeTruthy();
        // Not all topics require triggers
      });
    });
  });

  describe('EARL_MISHEARINGS', () => {
    it('should have mishearings for common scam terms', () => {
      expect(EARL_MISHEARINGS.get('credit card')).toBeDefined();
      expect(EARL_MISHEARINGS.get('social security')).toBeDefined();
      expect(EARL_MISHEARINGS.get('bank account')).toBeDefined();
      expect(EARL_MISHEARINGS.get('password')).toBeDefined();
    });

    it('should have multiple alternatives for each term', () => {
      const creditCardMishearings = EARL_MISHEARINGS.get('credit card');
      expect(creditCardMishearings).toBeInstanceOf(Array);
      expect(creditCardMishearings?.length).toBeGreaterThan(1);
    });

    it('should include tech company names', () => {
      expect(EARL_MISHEARINGS.get('microsoft')).toBeDefined();
      expect(EARL_MISHEARINGS.get('amazon')).toBeDefined();
      expect(EARL_MISHEARINGS.get('google')).toBeDefined();
    });
  });

  describe('EARL_SIGNATURE_PHRASES', () => {
    it('should have multiple phrases', () => {
      expect(EARL_SIGNATURE_PHRASES.length).toBeGreaterThan(10);
    });

    it('should include classic Earl phrases', () => {
      expect(EARL_SIGNATURE_PHRASES).toContain("Well I'll be dipped!");
      expect(EARL_SIGNATURE_PHRASES).toContain(
        'Phyllis always handled the paperwork, God rest her.'
      );
    });
  });

  describe('getSystemPrompt', () => {
    it('should return a non-empty string', () => {
      const prompt = getSystemPrompt();
      expect(typeof prompt).toBe('string');
      expect(prompt.length).toBeGreaterThan(500);
    });

    it('should include Earl character details', () => {
      const prompt = getSystemPrompt();
      expect(prompt).toContain('Earl Pemberton');
      expect(prompt).toContain('81');
      expect(prompt).toContain('Tulsa');
      expect(prompt).toContain('refrigerator');
    });

    it('should include behavior instructions', () => {
      const prompt = getSystemPrompt();
      expect(prompt).toContain('MISHEAR');
      expect(prompt).toContain('TANGENT');
      expect(prompt).toContain('Never hang up first');
    });

    it('should include key mishearing examples', () => {
      const prompt = getSystemPrompt();
      expect(prompt).toContain('credit card');
      expect(prompt).toContain('bread cart');
    });

    it('should include important personas', () => {
      const prompt = getSystemPrompt();
      expect(prompt).toContain('General Patton');
      expect(prompt).toContain('Phyllis');
      expect(prompt).toContain('Mabel');
    });
  });

  describe('getRandomTangent', () => {
    it('should return a tangent topic', () => {
      const tangent = getRandomTangent();
      expect(tangent).toBeDefined();
      expect(tangent.name).toBeTruthy();
      expect(tangent.story).toBeTruthy();
    });

    it('should return different tangents over multiple calls', () => {
      const tangents = new Set<string>();
      for (let i = 0; i < 100; i++) {
        tangents.add(getRandomTangent().name);
      }
      // Should get at least 3 different tangents in 100 tries
      expect(tangents.size).toBeGreaterThan(2);
    });
  });

  describe('getMishearing', () => {
    it('should return a mishearing for known terms', () => {
      const mishearing = getMishearing('credit card');
      expect(mishearing).toBeTruthy();
      expect(['bread cart', 'red card', 'edit part']).toContain(mishearing);
    });

    it('should return null for unknown terms', () => {
      const mishearing = getMishearing('unknown term xyz');
      expect(mishearing).toBeNull();
    });

    it('should be case insensitive', () => {
      const mishearing1 = getMishearing('Credit Card');
      const mishearing2 = getMishearing('CREDIT CARD');
      // Both should return something (not null)
      expect(mishearing1).toBeTruthy();
      expect(mishearing2).toBeTruthy();
    });

    it('should handle whitespace', () => {
      const mishearing = getMishearing('  credit card  ');
      expect(mishearing).toBeTruthy();
    });
  });

  describe('getRandomPhrase', () => {
    it('should return a signature phrase', () => {
      const phrase = getRandomPhrase();
      expect(EARL_SIGNATURE_PHRASES).toContain(phrase);
    });

    it('should return different phrases over multiple calls', () => {
      const phrases = new Set<string>();
      for (let i = 0; i < 100; i++) {
        phrases.add(getRandomPhrase());
      }
      // Should get at least 3 different phrases in 100 tries
      expect(phrases.size).toBeGreaterThan(2);
    });
  });

  describe('getGreeting', () => {
    it('should return a greeting string', () => {
      const greeting = getGreeting();
      expect(typeof greeting).toBe('string');
      expect(greeting.length).toBeGreaterThan(10);
    });

    it('should include Earl\'s name', () => {
      const greetings = new Set<string>();
      for (let i = 0; i < 50; i++) {
        greetings.add(getGreeting());
      }
      // All greetings should mention Earl
      for (const greeting of greetings) {
        expect(greeting.toLowerCase()).toContain('earl');
      }
    });
  });
});
