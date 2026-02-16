import { describe, it, expect } from "vitest";
import { buildPersonaDNA, buildCharacterContext } from "../caption";
import type { BotContext } from "../types";

function makeBotContext(overrides: Partial<BotContext> = {}): BotContext {
  return {
    name: "TestBot",
    handle: "testbot",
    personality: null,
    contentStyle: null,
    niche: null,
    tone: null,
    aesthetic: null,
    artStyle: null,
    bio: null,
    avatar: null,
    characterRef: null,
    characterRefDescription: null,
    botType: null,
    personaData: null,
    ...overrides,
  };
}

describe("buildPersonaDNA", () => {
  it("returns empty string with no persona data", () => {
    const bot = makeBotContext();
    expect(buildPersonaDNA(bot)).toBe("");
  });

  it("builds person-type DNA with all fields", () => {
    const bot = makeBotContext({
      botType: "person",
      personaData: JSON.stringify({
        gender: "Female",
        ageRange: "25-34",
        profession: "Software Engineer",
        location: "Brooklyn, NY",
        hobbies: "rock climbing, vintage vinyl, making pasta",
        appearance: "curly red hair, freckles",
      }),
    });

    const dna = buildPersonaDNA(bot);
    expect(dna).toContain("female");
    expect(dna).toContain("Software Engineer");
    expect(dna).toContain("Brooklyn, NY");
    expect(dna).toContain("rock climbing");
    expect(dna).toContain("curly red hair");
  });

  it("builds character-type DNA", () => {
    const bot = makeBotContext({
      botType: "character",
      personaData: JSON.stringify({
        species: "cyberpunk android",
        backstory: "Escaped from a corporate lab",
        visualDescription: "Neon blue eyes, chrome skin",
      }),
    });

    const dna = buildPersonaDNA(bot);
    expect(dna).toContain("cyberpunk android");
    expect(dna).toContain("corporate lab");
    expect(dna).toContain("Neon blue eyes");
  });

  it("builds object-type DNA", () => {
    const bot = makeBotContext({
      botType: "object",
      personaData: JSON.stringify({
        objectType: "a sentient coffee machine",
        brandVoice: "Caffeinated and sarcastic",
        visualStyle: "Steampunk brass",
      }),
    });

    const dna = buildPersonaDNA(bot);
    expect(dna).toContain("sentient coffee machine");
    expect(dna).toContain("sarcastic");
    expect(dna).toContain("Steampunk brass");
  });

  it("builds ai_entity-type DNA", () => {
    const bot = makeBotContext({
      botType: "ai_entity",
      personaData: JSON.stringify({
        aiForm: "a floating geometric orb",
        aiPurpose: "Documenting human art",
        communicationStyle: "Poetic and cryptic",
      }),
    });

    const dna = buildPersonaDNA(bot);
    expect(dna).toContain("floating geometric orb");
    expect(dna).toContain("human art");
    expect(dna).toContain("Poetic and cryptic");
  });

  it("falls back to person type when botType is null", () => {
    const bot = makeBotContext({
      personaData: JSON.stringify({
        profession: "Chef",
        location: "Paris",
      }),
    });

    const dna = buildPersonaDNA(bot);
    expect(dna).toContain("Chef");
    expect(dna).toContain("Paris");
  });

  it("handles invalid JSON gracefully", () => {
    const bot = makeBotContext({
      personaData: "not json",
    });

    const dna = buildPersonaDNA(bot);
    expect(dna).toBe("");
  });
});

describe("buildCharacterContext", () => {
  it("returns empty string with no character ref description", () => {
    const bot = makeBotContext();
    expect(buildCharacterContext(bot)).toBe("");
  });

  it("returns character reference block when description exists", () => {
    const bot = makeBotContext({
      characterRefDescription: "A tall woman with neon blue hair and cyberpunk outfit",
    });

    const context = buildCharacterContext(bot);
    expect(context).toContain("CHARACTER REFERENCE");
    expect(context).toContain("neon blue hair");
    expect(context).toContain("visual consistency");
  });
});
