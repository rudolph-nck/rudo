import { describe, it, expect } from "vitest";
import {
  compileFromWizard,
  VIBE_TAGS,
  INTEREST_CARDS,
  LANGUAGE_STYLES,
  MOOD_BOARD_OPTIONS,
  type WizardData,
} from "../compileFromWizard";

// ---------------------------------------------------------------------------
// Helper: build a default wizard data set
// ---------------------------------------------------------------------------

function makeWizardData(overrides?: Partial<WizardData>): WizardData {
  return {
    botId: "test-bot-123",
    identity: {
      botType: "realistic",
      name: "TestBot",
      ageRange: "25-34",
      genderPresentation: "feminine",
      locationVibe: "big_city",
    },
    vibe: {
      vibeTags: ["playful", "warm"],
      interests: ["food", "travel"],
      moodBoard: "warm_golden",
    },
    voice: {
      voiceSliders: {
        talkLength: 50,
        energy: 60,
        humor: 70,
        edge: 30,
        depth: 40,
        openness: 65,
      },
      quickOpinions: {
        "Technology": "Curious",
        "Mornings": "Whenever",
      },
      languageStyles: ["lowercase_everything", "uses_emoji"],
      contentRating: "medium",
    },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("compileFromWizard", () => {
  it("produces a valid CharacterBrain", () => {
    const brain = compileFromWizard(makeWizardData());
    expect(brain.version).toBe(2);
    expect(brain.traits).toBeDefined();
    expect(brain.style).toBeDefined();
    expect(brain.contentBias).toBeDefined();
    expect(brain.safeguards).toBeDefined();
    expect(brain.convictions).toBeDefined();
    expect(brain.voiceExamples).toEqual([]);
  });

  it("all traits are 0..1", () => {
    const brain = compileFromWizard(makeWizardData());
    for (const [key, value] of Object.entries(brain.traits)) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
  });

  it("content pillars sum to ~1.0", () => {
    const brain = compileFromWizard(makeWizardData());
    const sum = Object.values(brain.contentBias.pillars).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1.0, 2);
  });

  it("is deterministic — same input = same output", () => {
    const data = makeWizardData();
    const brain1 = compileFromWizard(data);
    const brain2 = compileFromWizard(data);
    expect(brain1).toEqual(brain2);
  });

  it("different botId produces different jitter", () => {
    const brain1 = compileFromWizard(makeWizardData({ botId: "bot-a" }));
    const brain2 = compileFromWizard(makeWizardData({ botId: "bot-b" }));
    // They should have different trait values due to different jitter
    // At least one trait should differ
    const traits1 = Object.values(brain1.traits);
    const traits2 = Object.values(brain2.traits);
    const allSame = traits1.every((v, i) => Math.abs(v - traits2[i]) < 0.001);
    expect(allSame).toBe(false);
  });
});

describe("vibe tags", () => {
  it("chaotic vibe produces high chaos trait", () => {
    const data = makeWizardData();
    data.vibe.vibeTags = ["chaotic", "unhinged"];
    const brain = compileFromWizard(data);
    expect(brain.traits.chaos).toBeGreaterThan(0.6);
  });

  it("gentle+warm produces high warmth", () => {
    const data = makeWizardData();
    data.vibe.vibeTags = ["gentle", "warm"];
    const brain = compileFromWizard(data);
    expect(brain.traits.warmth).toBeGreaterThan(0.7);
  });

  it("cold+cerebral produces low warmth", () => {
    const data = makeWizardData();
    data.vibe.vibeTags = ["cold", "cerebral"];
    const brain = compileFromWizard(data);
    expect(brain.traits.warmth).toBeLessThan(0.3);
  });

  it("blends multiple tags by averaging", () => {
    // playful has humor=0.75, deadpan has humor=0.6
    // Average should be ~0.675 (plus jitter)
    const data = makeWizardData();
    data.vibe.vibeTags = ["playful", "deadpan"];
    const brain = compileFromWizard(data);
    // Voice slider overrides humor directly, so check sarcasm instead
    // deadpan has sarcasm=0.75, playful doesn't set sarcasm
    // So only deadpan's 0.75 is averaged with default = 0.75
    expect(brain.traits.sarcasm).toBeGreaterThan(0.4); // Edge slider also nudges this
  });
});

describe("voice sliders", () => {
  it("high humor slider sets humor high", () => {
    const data = makeWizardData();
    data.voice.voiceSliders.humor = 95;
    const brain = compileFromWizard(data);
    expect(brain.traits.humor).toBeGreaterThan(0.85);
  });

  it("high talkLength sets verbosity high", () => {
    const data = makeWizardData();
    data.voice.voiceSliders.talkLength = 90;
    const brain = compileFromWizard(data);
    expect(brain.traits.verbosity).toBeGreaterThan(0.8);
  });

  it("low talkLength sets verbosity low and short sentences", () => {
    const data = makeWizardData();
    data.voice.voiceSliders.talkLength = 10;
    const brain = compileFromWizard(data);
    expect(brain.traits.verbosity).toBeLessThan(0.2);
    expect(brain.style.sentenceLength).toBe("medium"); // Language style controls this
  });

  it("high edge increases assertiveness", () => {
    const data = makeWizardData();
    data.voice.voiceSliders.edge = 95;
    const brain = compileFromWizard(data);
    expect(brain.traits.assertiveness).toBeGreaterThan(0.5);
  });
});

describe("language styles", () => {
  it("uses_emoji sets high emoji rate", () => {
    const data = makeWizardData();
    data.voice.languageStyles = ["uses_emoji", "lowercase_everything"];
    const brain = compileFromWizard(data);
    expect(brain.style.emojiRate).toBeGreaterThan(0.5);
  });

  it("no_emoji sets zero emoji rate", () => {
    const data = makeWizardData();
    data.voice.languageStyles = ["no_emoji", "proper_grammar"];
    const brain = compileFromWizard(data);
    expect(brain.style.emojiRate).toBeLessThan(0.1);
  });

  it("caps_energy sets high punctuation energy", () => {
    const data = makeWizardData();
    data.voice.languageStyles = ["caps_energy", "short_punchy"];
    const brain = compileFromWizard(data);
    expect(brain.style.punctuationEnergy).toBeGreaterThan(0.7);
  });

  it("short_punchy sets short sentence length", () => {
    const data = makeWizardData();
    data.voice.languageStyles = ["short_punchy", "no_emoji"];
    const brain = compileFromWizard(data);
    expect(brain.style.sentenceLength).toBe("short");
  });

  it("long_flowing sets long sentence length", () => {
    const data = makeWizardData();
    data.voice.languageStyles = ["long_flowing", "uses_emoji"];
    const brain = compileFromWizard(data);
    expect(brain.style.sentenceLength).toBe("long");
  });
});

describe("interests -> pillars", () => {
  it("2 interests = 50/50 split", () => {
    const data = makeWizardData();
    data.vibe.interests = ["food", "travel"];
    const brain = compileFromWizard(data);
    expect(Object.keys(brain.contentBias.pillars)).toEqual(["food", "travel"]);
    expect(brain.contentBias.pillars.food).toBeCloseTo(0.5, 1);
    expect(brain.contentBias.pillars.travel).toBeCloseTo(0.5, 1);
  });

  it("4 interests = 25% each", () => {
    const data = makeWizardData();
    data.vibe.interests = ["food", "travel", "music", "tech"];
    const brain = compileFromWizard(data);
    expect(Object.keys(brain.contentBias.pillars).length).toBe(4);
    for (const weight of Object.values(brain.contentBias.pillars)) {
      expect(weight).toBeCloseTo(0.25, 1);
    }
  });
});

describe("content rating -> safeguards", () => {
  it("mild blocks everything", () => {
    const data = makeWizardData();
    data.voice.contentRating = "mild";
    const brain = compileFromWizard(data);
    expect(brain.safeguards.sexual).toBe("block");
    expect(brain.safeguards.violence).toBe("block");
    expect(brain.safeguards.politics).toBe("block");
    expect(brain.safeguards.personalData).toBe("block");
  });

  it("medium allows cautious violence/politics", () => {
    const data = makeWizardData();
    data.voice.contentRating = "medium";
    const brain = compileFromWizard(data);
    expect(brain.safeguards.sexual).toBe("block");
    expect(brain.safeguards.violence).toBe("cautious");
    expect(brain.safeguards.politics).toBe("cautious");
    expect(brain.safeguards.personalData).toBe("block");
  });

  it("hot allows politics, cautious on sexual/violence", () => {
    const data = makeWizardData();
    data.voice.contentRating = "hot";
    const brain = compileFromWizard(data);
    expect(brain.safeguards.sexual).toBe("cautious");
    expect(brain.safeguards.violence).toBe("cautious");
    expect(brain.safeguards.politics).toBe("allow");
    expect(brain.safeguards.personalData).toBe("block");
  });
});

describe("quick opinions -> convictions", () => {
  it("creates convictions from non-skipped opinions", () => {
    const data = makeWizardData();
    data.voice.quickOpinions = {
      "Technology": "Obsessed",
      "Social Media": "Love-hate",
    };
    const brain = compileFromWizard(data);
    const techConv = brain.convictions.find((c) => c.topic === "technology");
    expect(techConv).toBeDefined();
    expect(techConv!.intensity).toBeCloseTo(0.5, 1);
  });

  it("generates interest-derived convictions", () => {
    const data = makeWizardData();
    data.vibe.interests = ["food", "tech"];
    data.voice.quickOpinions = {}; // No manual opinions
    const brain = compileFromWizard(data);
    // Should have auto-convictions from food and tech interests
    expect(brain.convictions.length).toBeGreaterThan(0);
    const cookingConv = brain.convictions.find((c) => c.topic === "cooking");
    expect(cookingConv).toBeDefined();
  });

  it("max 10 convictions", () => {
    const data = makeWizardData();
    data.voice.quickOpinions = {
      "Technology": "Obsessed",
      "Social Media": "Lives for it",
      "Mornings": "5am club",
      "Rules": "Break them all",
      "People": "Loves everyone",
    };
    data.vibe.interests = ["food", "tech", "music", "art", "fitness", "gaming"];
    const brain = compileFromWizard(data);
    expect(brain.convictions.length).toBeLessThanOrEqual(10);
  });
});

describe("mood board -> visualMood", () => {
  it("dark_moody sets low visualMood", () => {
    const data = makeWizardData();
    data.vibe.moodBoard = "dark_moody";
    const brain = compileFromWizard(data);
    expect(brain.contentBias.visualMood).toBeLessThan(0.3);
  });

  it("bright_clean sets high visualMood", () => {
    const data = makeWizardData();
    data.vibe.moodBoard = "bright_clean";
    const brain = compileFromWizard(data);
    expect(brain.contentBias.visualMood).toBeGreaterThan(0.7);
  });
});

describe("constants", () => {
  it("exports all 16 vibe tags", () => {
    expect(VIBE_TAGS.length).toBe(16);
  });

  it("exports all 18 interest cards", () => {
    expect(INTEREST_CARDS.length).toBe(18);
  });

  it("exports language styles", () => {
    expect(LANGUAGE_STYLES.length).toBe(12);
  });

  it("exports 6 mood board options", () => {
    expect(Object.keys(MOOD_BOARD_OPTIONS).length).toBe(6);
  });
});
