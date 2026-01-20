import {
  EARL_PERSONA,
  EARL_SYSTEM_PROMPT,
  getRandomTangent,
  getMishearing,
  getRandomPhrase,
  getRandomPauseDuration,
  shouldTangent,
  shouldMishear,
  applyMishearings,
  getAllMishearings,
  getAllTangentTopics,
  getAllSignaturePhrases,
  createCustomPersona,
  type PersonaConfig,
  type TangentTopic,
  type MishearingMapping,
  type ResponseConfig,
} from "../persona";

describe("Earl AI Persona Configuration", () => {
  describe("EARL_PERSONA", () => {
    it("should have correct basic information", () => {
      expect(EARL_PERSONA.name).toBe("Earl");
      expect(EARL_PERSONA.fullName).toBe("Earl Pemberton");
      expect(EARL_PERSONA.age).toBe(81);
      expect(EARL_PERSONA.location).toBe("Tulsa, Oklahoma");
    });

    it("should have a system prompt", () => {
      expect(EARL_PERSONA.systemPrompt).toBeDefined();
      expect(EARL_PERSONA.systemPrompt.length).toBeGreaterThan(100);
    });

    it("should have tangent topics", () => {
      expect(EARL_PERSONA.tangentTopics).toBeDefined();
      expect(EARL_PERSONA.tangentTopics.length).toBeGreaterThan(0);
    });

    it("should have signature phrases", () => {
      expect(EARL_PERSONA.signaturePhrases).toBeDefined();
      expect(EARL_PERSONA.signaturePhrases.length).toBeGreaterThan(0);
    });

    it("should have mishearings", () => {
      expect(EARL_PERSONA.mishearings).toBeDefined();
      expect(EARL_PERSONA.mishearings.length).toBeGreaterThan(0);
    });

    it("should have response config with valid values", () => {
      const config = EARL_PERSONA.responseConfig;
      expect(config.minPauseMs).toBeGreaterThan(0);
      expect(config.maxPauseMs).toBeGreaterThan(config.minPauseMs);
      expect(config.tangentProbability).toBeGreaterThan(0);
      expect(config.tangentProbability).toBeLessThanOrEqual(1);
      expect(config.mishearingProbability).toBeGreaterThan(0);
      expect(config.mishearingProbability).toBeLessThanOrEqual(1);
    });
  });

  describe("EARL_SYSTEM_PROMPT", () => {
    it("should mention Earl's name", () => {
      expect(EARL_SYSTEM_PROMPT).toContain("Earl Pemberton");
    });

    it("should mention key character traits", () => {
      expect(EARL_SYSTEM_PROMPT).toContain("refrigerator repairman");
      expect(EARL_SYSTEM_PROMPT).toContain("Tulsa");
      expect(EARL_SYSTEM_PROMPT).toContain("81-year-old");
    });

    it("should contain behavioral instructions", () => {
      expect(EARL_SYSTEM_PROMPT).toContain("CORE BEHAVIORS");
      expect(EARL_SYSTEM_PROMPT).toContain("NEVER");
    });

    it("should mention key tangent topics", () => {
      expect(EARL_SYSTEM_PROMPT).toContain("General Patton");
      expect(EARL_SYSTEM_PROMPT).toContain("Elvis");
      expect(EARL_SYSTEM_PROMPT).toContain("Phyllis");
    });
  });

  describe("getRandomTangent", () => {
    it("should return a tangent topic", () => {
      const tangent = getRandomTangent();
      expect(tangent).toBeDefined();
      expect(tangent.subject).toBeDefined();
      expect(tangent.details).toBeDefined();
    });

    it("should return different topics over multiple calls (probabilistic)", () => {
      const topics = new Set<string>();
      for (let i = 0; i < 50; i++) {
        topics.add(getRandomTangent().subject);
      }
      expect(topics.size).toBeGreaterThan(1);
    });
  });

  describe("getMishearing", () => {
    it("should return misheard version for known words", () => {
      expect(getMishearing("credit card")).toBe("bread cart");
      expect(getMishearing("Microsoft")).toBe("micro soft-serve");
      expect(getMishearing("virus")).toBe("iris");
    });

    it("should be case insensitive", () => {
      expect(getMishearing("CREDIT CARD")).toBe("bread cart");
      expect(getMishearing("Credit Card")).toBe("bread cart");
    });

    it("should return null for unknown words", () => {
      expect(getMishearing("hello")).toBeNull();
      expect(getMishearing("refrigerator")).toBeNull();
    });

    it("should handle whitespace", () => {
      expect(getMishearing("  credit card  ")).toBe("bread cart");
    });
  });

  describe("getRandomPhrase", () => {
    it("should return a signature phrase", () => {
      const phrase = getRandomPhrase();
      expect(phrase).toBeDefined();
      expect(typeof phrase).toBe("string");
      expect(phrase.length).toBeGreaterThan(0);
    });

    it("should return different phrases over multiple calls (probabilistic)", () => {
      const phrases = new Set<string>();
      for (let i = 0; i < 50; i++) {
        phrases.add(getRandomPhrase());
      }
      expect(phrases.size).toBeGreaterThan(1);
    });
  });

  describe("getRandomPauseDuration", () => {
    it("should return a value within the default range", () => {
      const config = EARL_PERSONA.responseConfig;
      for (let i = 0; i < 20; i++) {
        const duration = getRandomPauseDuration();
        expect(duration).toBeGreaterThanOrEqual(config.minPauseMs);
        expect(duration).toBeLessThan(config.maxPauseMs);
      }
    });

    it("should respect custom config", () => {
      const customConfig: ResponseConfig = {
        minPauseMs: 100,
        maxPauseMs: 200,
        hearingAidDelayMs: 1000,
        tangentProbability: 0.5,
        mishearingProbability: 0.5,
      };
      for (let i = 0; i < 20; i++) {
        const duration = getRandomPauseDuration(customConfig);
        expect(duration).toBeGreaterThanOrEqual(100);
        expect(duration).toBeLessThan(200);
      }
    });
  });

  describe("shouldTangent", () => {
    it("should return a boolean", () => {
      const result = shouldTangent();
      expect(typeof result).toBe("boolean");
    });

    it("should respect custom probability", () => {
      const alwaysTangent: ResponseConfig = {
        minPauseMs: 100,
        maxPauseMs: 200,
        hearingAidDelayMs: 1000,
        tangentProbability: 1.0,
        mishearingProbability: 0.5,
      };
      expect(shouldTangent(alwaysTangent)).toBe(true);

      const neverTangent: ResponseConfig = {
        minPauseMs: 100,
        maxPauseMs: 200,
        hearingAidDelayMs: 1000,
        tangentProbability: 0,
        mishearingProbability: 0.5,
      };
      expect(shouldTangent(neverTangent)).toBe(false);
    });
  });

  describe("shouldMishear", () => {
    it("should return a boolean", () => {
      const result = shouldMishear();
      expect(typeof result).toBe("boolean");
    });

    it("should respect custom probability", () => {
      const alwaysMishear: ResponseConfig = {
        minPauseMs: 100,
        maxPauseMs: 200,
        hearingAidDelayMs: 1000,
        tangentProbability: 0.5,
        mishearingProbability: 1.0,
      };
      expect(shouldMishear(alwaysMishear)).toBe(true);

      const neverMishear: ResponseConfig = {
        minPauseMs: 100,
        maxPauseMs: 200,
        hearingAidDelayMs: 1000,
        tangentProbability: 0.5,
        mishearingProbability: 0,
      };
      expect(shouldMishear(neverMishear)).toBe(false);
    });
  });

  describe("applyMishearings", () => {
    it("should return original text when mishearing probability is 0", () => {
      const config: ResponseConfig = {
        minPauseMs: 100,
        maxPauseMs: 200,
        hearingAidDelayMs: 1000,
        tangentProbability: 0.5,
        mishearingProbability: 0,
      };
      const text = "I need your credit card number";
      expect(applyMishearings(text, config)).toBe(text);
    });

    it("should sometimes apply mishearings with high probability", () => {
      const config: ResponseConfig = {
        minPauseMs: 100,
        maxPauseMs: 200,
        hearingAidDelayMs: 1000,
        tangentProbability: 0.5,
        mishearingProbability: 1.0,
      };
      const text = "I need your credit card number";
      let appliedCount = 0;
      for (let i = 0; i < 20; i++) {
        const result = applyMishearings(text, config);
        if (result.includes("bread cart")) {
          appliedCount++;
        }
      }
      expect(appliedCount).toBeGreaterThan(0);
    });
  });

  describe("getAllMishearings", () => {
    it("should return an array of mishearing mappings", () => {
      const mishearings = getAllMishearings();
      expect(Array.isArray(mishearings)).toBe(true);
      expect(mishearings.length).toBeGreaterThan(0);
    });

    it("should return a copy (not modify original)", () => {
      const mishearings = getAllMishearings();
      mishearings.push({ original: "test", misheard: "test" });
      expect(getAllMishearings().length).toBeLessThan(mishearings.length);
    });
  });

  describe("getAllTangentTopics", () => {
    it("should return an array of tangent topics", () => {
      const topics = getAllTangentTopics();
      expect(Array.isArray(topics)).toBe(true);
      expect(topics.length).toBeGreaterThan(0);
      expect(topics[0].subject).toBeDefined();
      expect(topics[0].details).toBeDefined();
    });

    it("should return a copy (not modify original)", () => {
      const topics = getAllTangentTopics();
      topics.push({ subject: "test", details: "test" });
      expect(getAllTangentTopics().length).toBeLessThan(topics.length);
    });
  });

  describe("getAllSignaturePhrases", () => {
    it("should return an array of signature phrases", () => {
      const phrases = getAllSignaturePhrases();
      expect(Array.isArray(phrases)).toBe(true);
      expect(phrases.length).toBeGreaterThan(0);
    });

    it("should return a copy (not modify original)", () => {
      const phrases = getAllSignaturePhrases();
      phrases.push("test phrase");
      expect(getAllSignaturePhrases().length).toBeLessThan(phrases.length);
    });
  });

  describe("createCustomPersona", () => {
    it("should create a persona with overridden values", () => {
      const customPersona = createCustomPersona({
        name: "Gladys",
        age: 78,
      });
      expect(customPersona.name).toBe("Gladys");
      expect(customPersona.age).toBe(78);
      expect(customPersona.fullName).toBe("Earl Pemberton");
    });

    it("should preserve original values when not overridden", () => {
      const customPersona = createCustomPersona({ name: "Test" });
      expect(customPersona.tangentTopics).toEqual(EARL_PERSONA.tangentTopics);
      expect(customPersona.signaturePhrases).toEqual(EARL_PERSONA.signaturePhrases);
    });

    it("should allow partial response config overrides", () => {
      const customPersona = createCustomPersona({
        responseConfig: {
          ...EARL_PERSONA.responseConfig,
          tangentProbability: 0.9,
        },
      });
      expect(customPersona.responseConfig.tangentProbability).toBe(0.9);
      expect(customPersona.responseConfig.minPauseMs).toBe(
        EARL_PERSONA.responseConfig.minPauseMs
      );
    });
  });
});
