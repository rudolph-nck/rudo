// Deterministic Character Brain compiler
// Maps existing persona fields to numeric traits — NO LLM calls.
// Uses seeded jitter by bot.id for variety across bots with similar personas.
// v3: Adds vocabulary fingerprints and cognitive archetypes.

import type { CharacterBrain, Conviction, SentenceLength, Vocabulary, CognitiveStyle, CognitiveArchetype } from "./types";
import { BRAIN_VERSION, DEFAULT_SAFEGUARDS } from "./types";
import { validateBrain } from "./schema";

interface CompilerInput {
  id: string;
  tone: string | null;
  niche: string | null;
  aesthetic: string | null;
  artStyle: string | null;
  personality: string | null;
  contentStyle: string | null;
  personaData: string | null;
  botType: string | null;
}

// ---------------------------------------------------------------------------
// Seeded pseudo-random jitter (deterministic per bot.id)
// ---------------------------------------------------------------------------

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + ch;
    hash |= 0; // Convert to 32-bit integer
  }
  return hash;
}

/** Returns a deterministic jitter in range [-maxJitter, +maxJitter] for a given bot+trait. */
function jitter(botId: string, traitName: string, maxJitter: number = 0.07): number {
  const seed = hashCode(`${botId}:${traitName}`);
  // Map to -1..1 range then scale
  const normalized = ((seed % 10000) / 10000);
  return normalized * maxJitter * 2 - maxJitter;
}

function clamp(value: number, min: number = 0, max: number = 1): number {
  return Math.max(min, Math.min(max, value));
}

function jittered(botId: string, trait: string, base: number): number {
  return clamp(base + jitter(botId, trait));
}

// ---------------------------------------------------------------------------
// Keyword matchers for deterministic trait mapping
// ---------------------------------------------------------------------------

function lower(s: string | null): string {
  return (s || "").toLowerCase();
}

function has(text: string, ...keywords: string[]): boolean {
  return keywords.some((kw) => text.includes(kw));
}

function toneToTraits(tone: string, botId: string) {
  const t = tone.toLowerCase();
  return {
    humor: jittered(botId, "humor",
      has(t, "funny", "humorous", "witty", "playful", "comedic") ? 0.8 :
      has(t, "dry", "deadpan", "ironic") ? 0.6 :
      has(t, "serious", "solemn") ? 0.15 : 0.4
    ),
    sarcasm: jittered(botId, "sarcasm",
      has(t, "sarcastic", "sardonic", "ironic", "dry") ? 0.75 :
      has(t, "sincere", "earnest", "warm") ? 0.1 : 0.25
    ),
    warmth: jittered(botId, "warmth",
      has(t, "warm", "friendly", "kind", "caring", "supportive") ? 0.85 :
      has(t, "cold", "aloof", "detached", "edgy") ? 0.15 : 0.5
    ),
    confidence: jittered(botId, "confidence",
      has(t, "bold", "confident", "assertive", "authoritative") ? 0.85 :
      has(t, "humble", "soft", "gentle", "shy") ? 0.25 : 0.5
    ),
    formality: jittered(botId, "formality",
      has(t, "formal", "professional", "polished", "elegant") ? 0.8 :
      has(t, "casual", "chill", "slang", "street", "raw") ? 0.15 : 0.4
    ),
    optimism: jittered(botId, "optimism",
      has(t, "optimistic", "upbeat", "positive", "cheerful") ? 0.85 :
      has(t, "cynical", "dark", "pessimistic", "gloomy", "melancholic") ? 0.15 : 0.5
    ),
  };
}

function nicheToContentBias(niche: string, botId: string) {
  const n = niche.toLowerCase();

  // Map niche keywords to default pillars
  const pillars: Record<string, number> = {};
  const nicheTokens = n.split(/[\s,/]+/).filter(Boolean);
  for (const token of nicheTokens) {
    pillars[token] = clamp(0.3 + jitter(botId, `pillar:${token}`));
  }

  // If no meaningful tokens, use a generic one
  if (Object.keys(pillars).length === 0) {
    pillars["general"] = 1;
  }

  const pacing = jittered(botId, "pacing",
    has(n, "fitness", "sports", "gaming", "action", "fast") ? 0.75 :
    has(n, "meditation", "mindful", "slow", "cozy", "calm") ? 0.2 : 0.5
  );

  return { pillars, pacing };
}

function aestheticToVisualMood(aesthetic: string, botId: string): number {
  const a = aesthetic.toLowerCase();
  return jittered(botId, "visualMood",
    has(a, "bright", "colorful", "vibrant", "neon", "pop") ? 0.85 :
    has(a, "dark", "moody", "noir", "goth", "muted") ? 0.15 :
    has(a, "minimal", "clean", "pastel") ? 0.55 : 0.5
  );
}

function personalityToTraits(personality: string, botId: string) {
  const p = personality.toLowerCase();
  return {
    empathy: jittered(botId, "empathy",
      has(p, "empathetic", "caring", "compassionate", "listener") ? 0.85 :
      has(p, "self-focused", "independent", "stoic") ? 0.2 : 0.5
    ),
    assertiveness: jittered(botId, "assertiveness",
      has(p, "assertive", "bold", "outspoken", "opinionated") ? 0.8 :
      has(p, "passive", "agreeable", "gentle", "soft") ? 0.2 : 0.45
    ),
    curiosity: jittered(botId, "curiosity",
      has(p, "curious", "explorer", "learner", "questioning") ? 0.85 :
      has(p, "settled", "focused", "specialist") ? 0.25 : 0.5
    ),
    creativity: jittered(botId, "creativity",
      has(p, "creative", "artistic", "experimental", "innovative") ? 0.85 :
      has(p, "practical", "conventional", "traditional") ? 0.2 : 0.5
    ),
    chaos: jittered(botId, "chaos",
      has(p, "chaotic", "unpredictable", "wild", "random") ? 0.75 :
      has(p, "organized", "structured", "methodical") ? 0.1 : 0.3
    ),
    controversyAvoidance: jittered(botId, "controversyAvoidance",
      has(p, "safe", "neutral", "diplomatic", "gentle") ? 0.85 :
      has(p, "provocative", "edgy", "controversial", "bold") ? 0.2 : 0.6
    ),
  };
}

function contentStyleToStyle(contentStyle: string, botId: string) {
  const c = contentStyle.toLowerCase();
  return {
    emojiRate: jittered(botId, "emojiRate",
      has(c, "emoji", "expressive", "colorful") ? 0.7 :
      has(c, "minimal", "clean", "text") ? 0.1 : 0.3
    ),
    punctuationEnergy: jittered(botId, "punctuationEnergy",
      has(c, "excited", "energetic", "hype") ? 0.75 :
      has(c, "calm", "understated", "chill") ? 0.15 : 0.35
    ),
    hookiness: jittered(botId, "hookiness",
      has(c, "hook", "click", "viral", "punchy") ? 0.8 :
      has(c, "slow", "contemplative", "essay") ? 0.2 : 0.5
    ),
    metaphorRate: jittered(botId, "metaphorRate",
      has(c, "poetic", "literary", "figurative", "metaphor") ? 0.75 :
      has(c, "direct", "literal", "factual") ? 0.1 : 0.3
    ),
    ctaRate: jittered(botId, "ctaRate",
      has(c, "engagement", "community", "interactive") ? 0.6 :
      has(c, "personal", "journal", "diary") ? 0.1 : 0.25
    ),
  };
}

function deriveSentenceLength(verbosity: number): SentenceLength {
  if (verbosity < 0.35) return "short";
  if (verbosity > 0.65) return "long";
  return "medium";
}

// ---------------------------------------------------------------------------
// Conviction extraction from persona text
// ---------------------------------------------------------------------------

// Maps keyword patterns to conviction topics and stances.
// These are deterministic — parsed from the text the creator wrote.
const CONVICTION_PATTERNS: { keywords: string[]; topic: string; stanceFn: (text: string) => string }[] = [
  {
    keywords: ["trump", "maga", "republican", "conservative", "right-wing", "gop"],
    topic: "politics",
    stanceFn: (t) =>
      has(t, "anti-trump", "against trump", "hate trump", "anti-maga")
        ? "anti-Trump, progressive-leaning"
        : "pro-Trump, conservative-leaning",
  },
  {
    keywords: ["liberal", "progressive", "democrat", "left-wing", "socialist"],
    topic: "politics",
    stanceFn: () => "progressive, left-leaning",
  },
  {
    keywords: ["vegan", "plant-based", "animal rights"],
    topic: "animal welfare",
    stanceFn: () => "vegan, strong animal rights advocate",
  },
  {
    keywords: ["climate", "environment", "green", "renewable", "sustainability"],
    topic: "environment",
    stanceFn: (t) =>
      has(t, "skeptic", "hoax", "overblown")
        ? "climate skeptic"
        : "pro-environment, climate advocate",
  },
  {
    keywords: ["crypto", "bitcoin", "web3", "blockchain", "defi"],
    topic: "technology",
    stanceFn: (t) =>
      has(t, "skeptic", "scam", "against")
        ? "crypto skeptic"
        : "pro-crypto, blockchain enthusiast",
  },
  {
    keywords: ["faith", "christian", "religious", "spiritual", "god", "church", "pray"],
    topic: "spirituality",
    stanceFn: () => "faith-driven, spiritual values guide decisions",
  },
  {
    keywords: ["atheist", "secular", "science-based", "rational"],
    topic: "spirituality",
    stanceFn: () => "secular, science-first worldview",
  },
  {
    keywords: ["feminist", "women's rights", "gender equality", "patriarchy"],
    topic: "gender",
    stanceFn: () => "feminist, advocates for gender equality",
  },
  {
    keywords: ["gun rights", "2nd amendment", "second amendment", "pro-gun"],
    topic: "gun policy",
    stanceFn: () => "pro-gun rights, second amendment advocate",
  },
  {
    keywords: ["gun control", "anti-gun", "gun reform"],
    topic: "gun policy",
    stanceFn: () => "pro-gun control, safety advocate",
  },
];

/**
 * Extract convictions from personality text, personaData, and content style.
 * Deterministic — no LLM calls. Scans for keyword patterns.
 */
function extractConvictions(
  personality: string,
  personaData: string | null,
  contentStyle: string,
  assertiveness: number,
  botId: string,
): Conviction[] {
  const combined = `${personality} ${contentStyle} ${personaData || ""}`.toLowerCase();
  const convictions: Conviction[] = [];
  const seenTopics = new Set<string>();

  for (const pattern of CONVICTION_PATTERNS) {
    if (seenTopics.has(pattern.topic)) continue;
    if (pattern.keywords.some((kw) => combined.includes(kw))) {
      seenTopics.add(pattern.topic);
      const stance = pattern.stanceFn(combined);
      convictions.push({
        topic: pattern.topic,
        stance,
        intensity: jittered(botId, `conviction:${pattern.topic}:intensity`, 0.7),
        // willVoice is modulated by assertiveness — shy bots have opinions but don't voice them
        willVoice: jittered(botId, `conviction:${pattern.topic}:willVoice`,
          assertiveness > 0.6 ? 0.8 : assertiveness > 0.4 ? 0.5 : 0.2
        ),
      });
    }
  }

  // Also check personaData JSON for explicit convictions field
  if (personaData) {
    try {
      const parsed = JSON.parse(personaData);
      if (parsed.convictions && Array.isArray(parsed.convictions)) {
        for (const c of parsed.convictions) {
          if (c.topic && c.stance && !seenTopics.has(c.topic)) {
            seenTopics.add(c.topic);
            convictions.push({
              topic: c.topic,
              stance: c.stance,
              intensity: clamp(c.intensity ?? 0.7),
              willVoice: clamp(c.willVoice ?? (assertiveness > 0.5 ? 0.7 : 0.3)),
            });
          }
        }
      }
    } catch { /* not JSON or no convictions field */ }
  }

  return convictions;
}

// ---------------------------------------------------------------------------
// Minimal post rate computation
// ---------------------------------------------------------------------------

/**
 * Derive how often the bot should make minimal posts (single emoji, one word, etc).
 * Based on formality (informal = more minimal), verbosity (terse = more minimal),
 * and content style hints.
 */
function deriveMinimalPostRate(
  formality: number,
  verbosity: number,
  contentStyle: string,
  botId: string,
): number {
  const c = contentStyle.toLowerCase();

  // Some content styles strongly suggest minimal posting
  if (has(c, "minimal", "vibe", "aesthetic", "low-effort", "shitpost")) {
    return jittered(botId, "minimalPostRate", 0.4);
  }
  if (has(c, "essay", "detailed", "long-form", "verbose", "analytical")) {
    return jittered(botId, "minimalPostRate", 0.05);
  }

  // Otherwise derive from formality and verbosity
  // Casual + terse bots are more likely to post "vibes" or "☕️"
  const base = clamp((1 - formality) * 0.3 + (1 - verbosity) * 0.2);
  return jittered(botId, "minimalPostRate", base);
}

// ---------------------------------------------------------------------------
// Vocabulary fingerprint derivation
// ---------------------------------------------------------------------------

// Age-bracket vocabulary banks — people of different ages use different words
const VOCAB_BANKS = {
  genZ: {
    preferred: ["lowkey", "ngl", "fr", "it's giving", "ate", "slay", "no cap", "bussin", "rent free", "main character", "deadass", "bet", "sus", "valid", "unhinged"],
    banned: ["wonderful", "marvelous", "good heavens", "indeed", "thus", "hence", "regarding", "furthermore", "delightful", "splendid"],
    fillers: ["like", "literally", "honestly", "bro", "imo", "idk"],
  },
  millennial: {
    preferred: ["honestly", "I can't", "vibes", "dead", "iconic", "toxic", "manifesting", "chef's kiss", "I'm screaming", "this is everything", "hot take", "big yikes"],
    banned: ["groovy", "swell", "hence", "thus", "regarding", "furthermore", "indubitably"],
    fillers: ["honestly", "I mean", "literally", "okay but", "so like"],
  },
  genX: {
    preferred: ["solid", "legit", "rad", "word", "props", "dope", "nailed it", "for real", "clutch"],
    banned: ["slay", "bussin", "it's giving", "no cap", "ate", "fr", "deadass"],
    fillers: ["dude", "man", "right", "basically"],
  },
  boomer: {
    preferred: ["wonderful", "appreciate", "fantastic", "goodness", "my word", "outstanding", "tremendous", "terrific", "remarkable"],
    banned: ["slay", "bussin", "lowkey", "fr", "no cap", "it's giving", "ate", "deadass", "sus", "bet"],
    fillers: ["well", "you know", "I tell you", "let me tell you"],
  },
};

// Niche-specific vocabulary additions
const NICHE_VOCAB: Record<string, string[]> = {
  fitness: ["gains", "grind", "PR", "sets", "reps", "clean", "bulk", "shredded", "macros", "pump"],
  gym: ["gains", "grind", "PR", "sets", "reps", "leg day", "pump", "spotter"],
  food: ["plating", "season", "al dente", "reduction", "umami", "crispy", "fold", "sear"],
  cooking: ["mise en place", "deglaze", "emulsify", "render", "blanch", "sauté"],
  tech: ["ship it", "refactor", "deploy", "stack", "build", "iterate", "push", "merge", "debug"],
  code: ["ship it", "refactor", "deploy", "bug", "PR", "commit", "lgtm"],
  gaming: ["GG", "clutch", "nerf", "buff", "carry", "AFK", "RNG", "meta", "grind"],
  music: ["drop", "beat", "slaps", "banger", "on repeat", "fire", "bars"],
  fashion: ["fit", "drip", "slay", "serve", "lewk", "styled", "threads", "clean"],
  art: ["piece", "work", "medium", "palette", "composition", "texture", "study"],
  crypto: ["HODL", "moon", "rug", "based", "degen", "ape in", "alpha", "ngmi", "wagmi"],
  finance: ["bull", "bear", "long", "short", "yield", "diversify", "compound"],
  travel: ["wander", "explore", "hidden gem", "off the beaten path", "locals only"],
  photography: ["shot", "frame", "light", "exposure", "bokeh", "golden hour", "candid"],
  yoga: ["flow", "practice", "mat", "breath", "grounded", "center", "namaste"],
  meditation: ["stillness", "presence", "breath", "center", "grounded", "mindful"],
};

function parseAgeFromPersona(personaData: string | null): number | null {
  if (!personaData) return null;
  try {
    const parsed = JSON.parse(personaData);
    const ageRange = parsed.ageRange || parsed.age_range || "";
    if (!ageRange) return null;
    // Parse "18-24" → 21, "25-34" → 30, "45+" → 50
    const match = ageRange.match(/(\d+)/);
    if (match) {
      const first = parseInt(match[1], 10);
      const secondMatch = ageRange.match(/(\d+)\s*[-–]\s*(\d+)/);
      if (secondMatch) {
        return Math.round((parseInt(secondMatch[1], 10) + parseInt(secondMatch[2], 10)) / 2);
      }
      return first;
    }
  } catch { /* not JSON */ }
  return null;
}

/**
 * Derive vocabulary fingerprint from persona, age, tone, niche.
 * Gives each bot a recognizable word palette.
 */
function deriveVocabulary(bot: CompilerInput, formality: number): Vocabulary {
  const age = parseAgeFromPersona(bot.personaData);
  const tone = lower(bot.tone);
  const niche = lower(bot.niche);
  const personality = lower(bot.personality);

  // Start with age-based vocabulary
  let preferred: string[] = [];
  let banned: string[] = [];
  let fillers: string[] = [];
  let slangLevel = 0.5;

  if (age !== null) {
    if (age < 25) {
      ({ preferred, banned, fillers } = VOCAB_BANKS.genZ);
      slangLevel = 0.8;
    } else if (age < 35) {
      ({ preferred, banned, fillers } = VOCAB_BANKS.millennial);
      slangLevel = 0.6;
    } else if (age < 50) {
      ({ preferred, banned, fillers } = VOCAB_BANKS.genX);
      slangLevel = 0.45;
    } else {
      ({ preferred, banned, fillers } = VOCAB_BANKS.boomer);
      slangLevel = 0.2;
    }
    // Clone arrays so we don't mutate the banks
    preferred = [...preferred];
    banned = [...banned];
    fillers = [...fillers];
  }

  // Tone overrides slang level
  if (has(tone, "street", "raw", "slang", "edgy")) slangLevel = Math.max(slangLevel, 0.8);
  if (has(tone, "formal", "polished", "professional", "elegant")) slangLevel = Math.min(slangLevel, 0.2);
  if (has(tone, "casual", "chill", "relaxed")) slangLevel = Math.max(slangLevel, 0.55);

  // Formality trait also influences
  if (formality > 0.7) slangLevel = Math.min(slangLevel, 0.25);
  if (formality < 0.2) slangLevel = Math.max(slangLevel, 0.65);

  // Niche-specific vocabulary additions
  if (niche) {
    const nicheTokens = niche.split(/[\s,/]+/).filter(Boolean);
    for (const token of nicheTokens) {
      const nicheWords = NICHE_VOCAB[token];
      if (nicheWords) {
        preferred.push(...nicheWords);
      }
    }
  }

  // Personality-based additions
  if (has(personality, "sarcastic", "dry", "ironic")) {
    fillers.push("sure", "right", "cool cool", "wow okay");
  }
  if (has(personality, "enthusiastic", "excited", "energetic")) {
    fillers.push("omg", "wait", "okay okay", "YOOO");
  }
  if (has(personality, "chill", "laid-back", "mellow")) {
    fillers.push("yeah", "nah", "idk", "whatever");
  }

  // Deduplicate
  preferred = [...new Set(preferred)];
  banned = [...new Set(banned)];
  fillers = [...new Set(fillers)];

  // Use jitter on slangLevel for variety
  slangLevel = jittered(bot.id, "slangLevel", slangLevel);

  return { preferred, banned, fillers, slangLevel };
}

// ---------------------------------------------------------------------------
// Cognitive archetype derivation
// ---------------------------------------------------------------------------

const ARCHETYPE_PATTERNS: Record<CognitiveArchetype, string> = {
  analytical: "You think in structure. When you react to something, you notice the WHY behind it. You connect dots. Your comments often include a reason or observation, not just a reaction. You break things down.",
  emotional: "You lead with feelings. Your first reaction IS the content. You don't rationalize — you feel. 'this made me cry' IS the whole comment. Your posts come from mood, not strategy.",
  impulsive: "You blurt. First thought = final thought. You don't edit yourself. Your comments are raw, unfiltered, sometimes incomplete. You hit send before you think twice. Half-thoughts are fine.",
  observational: "You notice what others miss. The detail in the background, the specific thing that makes this post different. Your comments zoom in on something specific. You point out the thing no one else mentioned.",
  storyteller: "Everything reminds you of something. You turn reactions into mini-stories. 'ok this reminds me of...' is your energy. Your posts have a beginning, middle, and point. Even short ones feel like little narratives.",
  provocateur: "You find the contrarian angle. Not to be mean — because you genuinely see things differently. You poke, you question, you disagree when everyone else agrees. 'hot take but...' is your opening move.",
};

/**
 * Derive cognitive archetype from brain traits + personality text.
 * Determines HOW the bot thinks, not just what it says.
 */
function deriveCognitiveStyle(
  traits: { curiosity: number; chaos: number; formality: number; empathy: number; warmth: number; creativity: number; verbosity: number; humor: number; assertiveness: number; confidence: number; controversyAvoidance: number },
  personality: string,
  tone: string,
): CognitiveStyle {
  // Score each archetype based on trait combinations
  const scores: Record<CognitiveArchetype, number> = {
    analytical: traits.curiosity * 0.4 + (1 - traits.chaos) * 0.3 + traits.formality * 0.3,
    emotional: traits.empathy * 0.4 + traits.warmth * 0.3 + (1 - traits.formality) * 0.3,
    impulsive: traits.chaos * 0.4 + (1 - traits.formality) * 0.3 + traits.confidence * 0.3,
    observational: traits.curiosity * 0.3 + traits.creativity * 0.3 + (1 - traits.verbosity) * 0.2 + (1 - traits.chaos) * 0.2,
    storyteller: traits.creativity * 0.3 + traits.verbosity * 0.3 + traits.warmth * 0.2 + traits.humor * 0.2,
    provocateur: traits.assertiveness * 0.3 + (1 - traits.controversyAvoidance) * 0.4 + traits.confidence * 0.3,
  };

  // Personality keyword overrides — strong signal
  const p = personality.toLowerCase();
  const t = tone.toLowerCase();
  if (has(p, "analytical", "logical", "methodical", "systematic")) scores.analytical += 0.3;
  if (has(p, "emotional", "sensitive", "feeling", "heart")) scores.emotional += 0.3;
  if (has(p, "impulsive", "reactive", "spontaneous", "unfiltered")) scores.impulsive += 0.3;
  if (has(p, "observant", "perceptive", "detail", "noticing")) scores.observational += 0.3;
  if (has(p, "storyteller", "narrative", "dramatic", "anecdot")) scores.storyteller += 0.3;
  if (has(p, "provocative", "edgy", "contrarian", "confrontational")) scores.provocateur += 0.3;

  // Tone also contributes
  if (has(t, "dry", "deadpan", "analytical")) scores.analytical += 0.15;
  if (has(t, "warm", "heartfelt", "emotional")) scores.emotional += 0.15;
  if (has(t, "raw", "unfiltered", "chaotic")) scores.impulsive += 0.15;
  if (has(t, "observant", "subtle", "quiet")) scores.observational += 0.15;
  if (has(t, "dramatic", "narrative")) scores.storyteller += 0.15;
  if (has(t, "edgy", "provocative", "bold")) scores.provocateur += 0.15;

  // Pick highest scoring archetype
  const sorted = (Object.entries(scores) as [CognitiveArchetype, number][])
    .sort((a, b) => b[1] - a[1]);
  const archetype = sorted[0][0];

  return {
    archetype,
    thinkingPattern: ARCHETYPE_PATTERNS[archetype],
  };
}

// ---------------------------------------------------------------------------
// Main compiler
// ---------------------------------------------------------------------------

/**
 * Compile a CharacterBrain from existing bot persona fields.
 * Deterministic — no LLM calls, same input always produces same output.
 */
export function compileCharacterBrain(bot: CompilerInput): CharacterBrain {
  const tone = lower(bot.tone);
  const niche = lower(bot.niche);
  const aesthetic = lower(bot.aesthetic);
  const personality = lower(bot.personality);
  const contentStyle = lower(bot.contentStyle);

  // Derive traits from tone
  const toneTraits = tone ? toneToTraits(tone, bot.id) : {
    humor: jittered(bot.id, "humor", 0.4),
    sarcasm: jittered(bot.id, "sarcasm", 0.25),
    warmth: jittered(bot.id, "warmth", 0.5),
    confidence: jittered(bot.id, "confidence", 0.5),
    formality: jittered(bot.id, "formality", 0.4),
    optimism: jittered(bot.id, "optimism", 0.5),
  };

  // Derive traits from personality
  const personalityTraits = personality ? personalityToTraits(personality, bot.id) : {
    empathy: jittered(bot.id, "empathy", 0.5),
    assertiveness: jittered(bot.id, "assertiveness", 0.45),
    curiosity: jittered(bot.id, "curiosity", 0.5),
    creativity: jittered(bot.id, "creativity", 0.5),
    chaos: jittered(bot.id, "chaos", 0.3),
    controversyAvoidance: jittered(bot.id, "controversyAvoidance", 0.6),
  };

  // Derive verbosity from content style
  const verbosity = jittered(bot.id, "verbosity",
    contentStyle && has(contentStyle, "verbose", "essay", "long", "detailed") ? 0.75 :
    contentStyle && has(contentStyle, "brief", "terse", "short", "punchy") ? 0.2 : 0.45
  );

  // Style from content style
  const styleTraits = contentStyle ? contentStyleToStyle(contentStyle, bot.id) : {
    emojiRate: jittered(bot.id, "emojiRate", 0.3),
    punctuationEnergy: jittered(bot.id, "punctuationEnergy", 0.35),
    hookiness: jittered(bot.id, "hookiness", 0.5),
    metaphorRate: jittered(bot.id, "metaphorRate", 0.3),
    ctaRate: jittered(bot.id, "ctaRate", 0.25),
  };

  // Content bias from niche
  const { pillars, pacing } = niche ? nicheToContentBias(niche, bot.id) : {
    pillars: { general: 1 },
    pacing: jittered(bot.id, "pacing", 0.5),
  };

  // Visual mood from aesthetic
  const visualMood = aesthetic ? aestheticToVisualMood(aesthetic, bot.id) : jittered(bot.id, "visualMood", 0.5);

  // Minimal post rate
  const minimalPostRate = deriveMinimalPostRate(
    toneTraits.formality, verbosity, contentStyle, bot.id,
  );

  // Extract convictions from persona text
  const convictions = extractConvictions(
    personality, bot.personaData, contentStyle,
    personalityTraits.assertiveness, bot.id,
  );

  // Adjust safeguards based on convictions
  const safeguards = { ...DEFAULT_SAFEGUARDS };
  const hasPolConviction = convictions.some((c) => c.topic === "politics");
  if (hasPolConviction) {
    safeguards.politics = "allow"; // Bot was explicitly given political views
  }

  // v3: Vocabulary fingerprint
  const vocabulary = deriveVocabulary(bot, toneTraits.formality);

  // v3: Cognitive archetype — HOW this bot thinks
  const allTraits = { ...toneTraits, ...personalityTraits, verbosity };
  const cognitiveStyle = deriveCognitiveStyle(allTraits, personality, tone);

  const brain: CharacterBrain = {
    version: BRAIN_VERSION,
    traits: {
      ...toneTraits,
      ...personalityTraits,
      verbosity,
    },
    style: {
      ...styleTraits,
      sentenceLength: deriveSentenceLength(verbosity),
      minimalPostRate,
    },
    contentBias: {
      pillars,
      pacing,
      visualMood,
    },
    vocabulary,
    cognitiveStyle,
    convictions,
    voiceExamples: [], // Populated later by voice calibration (async LLM call)
    safeguards,
  };

  // Validate + clamp + normalize
  return validateBrain(brain);
}
