/**
 * Tests for Earl AI Persona Configuration
 */

import {
  EARL_SYSTEM_PROMPT,
  EARL_PERSONA,
  EARL_TANGENT_TOPICS,
  EARL_SIGNATURE_PHRASES,
  EARL_MISHEARINGS,
  EARL_RESPONSE_TIMING,
  getRandomTangent,
  getMishearing,
  getRandomPhrase,
  getRandomPauseDuration,
  shouldTangent,
  getEarlGreeting,
  findTriggeredTangents,
} from "../persona";

describe("Earl Persona Configuration", () => {
  describe("EARL_SYSTEM_PROMPT", () => {
    it("should include Earl's name", () => {
      expect(EARL_SYSTEM_PROMPT).toContain("Earl Pemberton");
    });

    it("should include Earl's age", () => {
      expect(EARL_SYSTEM_PROMPT).toContain("81-year-old");
    });

    it("should include Earl's occupation", () => {
      expect(EARL_SYSTEM_PROMPT).toContain("refrigerator repairman");
    });

    it("should include core behaviors", () => {
      expect(EARL_SYSTEM_PROMPT).toContain("CORE BEHAVIORS");
      expect(EARL_SYSTEM_PROMPT).toContain("Mishear things");
      expect(EARL_SYSTEM_PROMPT).toContain("tangents");
    });

    it("should include safety instructions (NEVER section)", () => {
      expect(EARL_SYSTEM_PROMPT).toContain("NEVER");
      expect(EARL_SYSTEM_PROMPT).toContain("personal information");
      expect(EARL_SYSTEM_PROMPT).toContain("Hang up first");
    });
  });

  describe("EARL_PERSONA", () => {
    it("should have correct name", () => {
      expect(EARL_PERSONA.name).toBe("Earl Pemberton");
    });

    it("should have correct age", () => {
      expect(EARL_PERSONA.age).toBe(81);
    });

    it("should have tangent topics", () => {
      expect(EARL_PERSONA.tangentTopics.length).toBeGreaterThan(0);
    });

    it("should have signature phrases", () => {
      expect(EARL_PERSONA.signaturePhrases.length).toBeGreaterThan(0);
    });

    it("should have mishearings", () => {
      expect(Object.keys(EARL_PERSONA.mishearings).length).toBeGreaterThan(0);
    });

    it("should have response timing config", () => {
      expect(EARL_PERSONA.responseTiming.minPauseMs).toBeGreaterThan(0);
      expect(EARL_PERSONA.responseTiming.maxPauseMs).toBeGreaterThan(
        EARL_PERSONA.responseTiming.minPauseMs
      );
    });
  });

  describe("EARL_TANGENT_TOPICS", () => {
    it("should have General Patton topic", () => {
      const generalPatton = EARL_TANGENT_TOPICS.find((t) =>
        t.name.includes("General Patton")
      );
      expect(generalPatton).toBeDefined();
      expect(generalPatton?.description).toContain("parakeet");
    });

    it("should have Elvis topic", () => {
      const elvis = EARL_TANGENT_TOPICS.find((t) =>
        t.name.includes("Elvis")
      );
      expect(elvis).toBeDefined();
      expect(elvis?.description).toContain("refrigerator");
    });

    it("should have trigger words", () => {
      const topicsWithTriggers = EARL_TANGENT_TOPICS.filter(
        (t) => t.triggers && t.triggers.length > 0
      );
      expect(topicsWithTriggers.length).toBeGreaterThan(0);
    });
  });

  describe("EARL_MISHEARINGS", () => {
    it("should have credit card mishearing", () => {
      expect(EARL_MISHEARINGS["credit card"]).toBe("bread cart");
    });

    it("should have microsoft mishearing", () => {
      expect(EARL_MISHEARINGS["microsoft"]).toBe("micro soft-serve");
    });

    it("should have virus mishearing", () => {
      expect(EARL_MISHEARINGS["virus"]).toBe("iris");
    });

    it("should have financial terms", () => {
      expect(EARL_MISHEARINGS["bank"]).toBeDefined();
      expect(EARL_MISHEARINGS["money"]).toBeDefined();
    });

    it("should have scam-related terms", () => {
      expect(EARL_MISHEARINGS["irs"]).toBeDefined();
      expect(EARL_MISHEARINGS["warrant"]).toBeDefined();
    });
  });

  describe("EARL_SIGNATURE_PHRASES", () => {
    it("should have common phrases", () => {
      expect(EARL_SIGNATURE_PHRASES).toContain("Well I'll be dipped!");
      expect(EARL_SIGNATURE_PHRASES.some((p) => p.includes("Phyllis"))).toBe(
        true
      );
    });

    it("should have multiple phrases", () => {
      expect(EARL_SIGNATURE_PHRASES.length).toBeGreaterThan(5);
    });
  });

  describe("EARL_RESPONSE_TIMING", () => {
    it("should have valid timing values", () => {
      expect(EARL_RESPONSE_TIMING.minPauseMs).toBe(500);
      expect(EARL_RESPONSE_TIMING.maxPauseMs).toBe(2000);
      expect(EARL_RESPONSE_TIMING.longPauseProbability).toBe(0.15);
      expect(EARL_RESPONSE_TIMING.longPauseMs).toBe(5000);
    });
  });
});

describe("Helper Functions", () => {
  describe("getRandomTangent", () => {
    it("should return a tangent topic", () => {
      const tangent = getRandomTangent();

      expect(tangent).toBeDefined();
      expect(tangent.name).toBeDefined();
      expect(tangent.description).toBeDefined();
    });

    it("should return different tangents over multiple calls", () => {
      const tangents = new Set<string>();
      for (let i = 0; i < 50; i++) {
        tangents.add(getRandomTangent().name);
      }
      // Should have gotten at least a few different tangents
      expect(tangents.size).toBeGreaterThan(1);
    });
  });

  describe("getMishearing", () => {
    it("should return misheard version for known words", () => {
      expect(getMishearing("credit card")).toBe("bread cart");
      expect(getMishearing("microsoft")).toBe("micro soft-serve");
    });

    it("should be case insensitive", () => {
      expect(getMishearing("CREDIT CARD")).toBe("bread cart");
      expect(getMishearing("Microsoft")).toBe("micro soft-serve");
    });

    it("should return original word if no mishearing", () => {
      expect(getMishearing("hello")).toBe("hello");
      expect(getMishearing("random word")).toBe("random word");
    });

    it("should handle partial matches", () => {
      expect(getMishearing("my credit card number")).toContain("bread cart");
    });
  });

  describe("getRandomPhrase", () => {
    it("should return a signature phrase", () => {
      const phrase = getRandomPhrase();

      expect(phrase).toBeDefined();
      expect(typeof phrase).toBe("string");
      expect(EARL_SIGNATURE_PHRASES).toContain(phrase);
    });

    it("should return different phrases over multiple calls", () => {
      const phrases = new Set<string>();
      for (let i = 0; i < 50; i++) {
        phrases.add(getRandomPhrase());
      }
      expect(phrases.size).toBeGreaterThan(1);
    });
  });

  describe("getRandomPauseDuration", () => {
    it("should return a number in valid range", () => {
      for (let i = 0; i < 100; i++) {
        const duration = getRandomPauseDuration();
        expect(duration).toBeGreaterThanOrEqual(EARL_RESPONSE_TIMING.minPauseMs);
        // Could be long pause, so check against that too
        expect(duration).toBeLessThanOrEqual(EARL_RESPONSE_TIMING.longPauseMs);
      }
    });

    it("should sometimes return long pause duration", () => {
      let longPauseCount = 0;
      const iterations = 1000;

      for (let i = 0; i < iterations; i++) {
        const duration = getRandomPauseDuration();
        if (duration === EARL_RESPONSE_TIMING.longPauseMs) {
          longPauseCount++;
        }
      }

      // Should get some long pauses (roughly 15% +/- margin)
      expect(longPauseCount).toBeGreaterThan(50); // At least 5%
      expect(longPauseCount).toBeLessThan(300); // Less than 30%
    });
  });

  describe("shouldTangent", () => {
    it("should return boolean", () => {
      const result = shouldTangent();
      expect(typeof result).toBe("boolean");
    });

    it("should respect probability", () => {
      let tangentCount = 0;
      const iterations = 1000;

      for (let i = 0; i < iterations; i++) {
        if (shouldTangent(0.3)) {
          tangentCount++;
        }
      }

      // Should be roughly 30% (with some variance)
      expect(tangentCount).toBeGreaterThan(200); // At least 20%
      expect(tangentCount).toBeLessThan(400); // Less than 40%
    });

    it("should handle custom probability", () => {
      // With 0 probability, should never tangent
      let count = 0;
      for (let i = 0; i < 100; i++) {
        if (shouldTangent(0)) {
          count++;
        }
      }
      expect(count).toBe(0);

      // With 1 probability, should always tangent
      count = 0;
      for (let i = 0; i < 100; i++) {
        if (shouldTangent(1)) {
          count++;
        }
      }
      expect(count).toBe(100);
    });
  });

  describe("getEarlGreeting", () => {
    it("should return a greeting string", () => {
      const greeting = getEarlGreeting();

      expect(greeting).toBeDefined();
      expect(typeof greeting).toBe("string");
      expect(greeting.length).toBeGreaterThan(10);
    });

    it("should return different greetings over multiple calls", () => {
      const greetings = new Set<string>();
      for (let i = 0; i < 50; i++) {
        greetings.add(getEarlGreeting());
      }
      expect(greetings.size).toBeGreaterThan(1);
    });

    it("should include hearing-related content", () => {
      // Run multiple times to check various greetings
      let hasHearingReference = false;
      for (let i = 0; i < 20; i++) {
        const greeting = getEarlGreeting();
        if (
          greeting.toLowerCase().includes("hear") ||
          greeting.toLowerCase().includes("speak up")
        ) {
          hasHearingReference = true;
          break;
        }
      }
      expect(hasHearingReference).toBe(true);
    });
  });

  describe("findTriggeredTangents", () => {
    it("should find tangents for matching trigger words", () => {
      const tangents = findTriggeredTangents("I have a pet bird at home");

      expect(tangents.length).toBeGreaterThan(0);
      expect(tangents.some((t) => t.name.includes("General Patton"))).toBe(
        true
      );
    });

    it("should return empty array for no matches", () => {
      const tangents = findTriggeredTangents("xyz abc 123");

      expect(tangents).toEqual([]);
    });

    it("should be case insensitive", () => {
      const tangents = findTriggeredTangents("BIRD PET ANIMAL");

      expect(tangents.length).toBeGreaterThan(0);
    });

    it("should not return duplicate tangents", () => {
      const tangents = findTriggeredTangents("bird bird bird pet animal");

      const uniqueNames = new Set(tangents.map((t) => t.name));
      expect(uniqueNames.size).toBe(tangents.length);
    });
  });
});
