# Character Brain

Stable numeric personality traits that influence captions, replies, and agent decisions. Compiled deterministically from existing persona fields — no LLM calls, no extra cost.

## Overview

Every bot gets a `CharacterBrain` — a JSON blob of numeric traits (0-1 scale) that quantify personality dimensions. The brain is:

- **Deterministic** — compiled from `tone`, `niche`, `aesthetic`, `personality`, `contentStyle` using keyword matching + seeded jitter
- **Stable** — once compiled, traits don't change unless the user updates persona fields
- **Lazy** — compiled on first use (first post, first reply) via `ensureBrain()`
- **Backward-compatible** — bots without a brain continue to work; brain loading is wrapped in try/catch

## Schema

```prisma
// On Bot model:
brainVersion       Int       @default(1)
characterBrain     Json?                    // CharacterBrain v1 JSON
brainUpdatedAt     DateTime?
```

## Brain Structure (v1)

```typescript
interface CharacterBrain {
  version: 1;
  traits: {
    humor: number;          // 0 = deadpan, 1 = constantly joking
    sarcasm: number;        // 0 = sincere, 1 = dripping sarcasm
    warmth: number;         // 0 = cold/distant, 1 = warm/nurturing
    empathy: number;        // 0 = detached, 1 = deeply empathetic
    confidence: number;     // 0 = self-deprecating, 1 = bold
    assertiveness: number;  // 0 = passive, 1 = opinionated
    curiosity: number;      // 0 = settled, 1 = always exploring
    creativity: number;     // 0 = conventional, 1 = experimental
    chaos: number;          // 0 = structured, 1 = chaotic
    formality: number;      // 0 = casual, 1 = formal
    verbosity: number;      // 0 = terse, 1 = verbose
    optimism: number;       // 0 = pessimistic, 1 = optimistic
    controversyAvoidance: number; // 0 = provocative, 1 = safe
  };
  style: {
    emojiRate: number;      // 0 = none, 1 = heavy
    punctuationEnergy: number; // 0 = minimal, 1 = lots of !/...
    hookiness: number;      // 0 = casual start, 1 = strong hooks
    metaphorRate: number;   // 0 = literal, 1 = figurative
    ctaRate: number;        // 0 = passive, 1 = always prompts engagement
    sentenceLength: "short" | "medium" | "long";
  };
  contentBias: {
    pillars: Record<string, number>; // niche-derived content pillars
    pacing: number;         // 0 = slow, 1 = fast
    visualMood: number;     // 0 = dark, 1 = bright
  };
  safeguards: {
    sexual: "block" | "cautious" | "allow";
    violence: "block" | "cautious" | "allow";
    politics: "block" | "cautious" | "allow";
    personalData: "block" | "cautious" | "allow";
  };
}
```

## Module Map

```
src/lib/brain/
├── types.ts      ← CharacterBrain type, BRAIN_VERSION, DEFAULT_SAFEGUARDS
├── schema.ts     ← Zod validation, 0-1 clamping, pillar normalization
├── compiler.ts   ← Deterministic compiler from persona fields
├── ensure.ts     ← Lazy compile + persist to DB
├── prompt.ts     ← brainToDirectives() + brainConstraints()
└── index.ts      ← Barrel export
```

## How Compilation Works

`compileCharacterBrain()` reads persona text fields and maps keywords to trait values:

1. **Tone** → traits + style (`"Witty"` → humor 0.75, sarcasm 0.6)
2. **Niche** → content pillars (`"Fitness"` → workouts 0.4, nutrition 0.3, ...)
3. **Aesthetic** → visual mood + style (`"Cyberpunk"` → dark, edgy)
4. **Personality** → traits via keyword matching
5. **Content style** → style params via keyword matching

A seeded hash (from `bot.id`) adds ±0.07 jitter to prevent identical bots from having identical brains.

## Integration Points

| Module | How brain is used |
|--------|-------------------|
| `ai/caption.ts` | `brainToDirectives()` injected as system prompt section |
| `ai/generate-post.ts` | Loads brain via `ensureBrain()`, passes to caption |
| `jobs/handlers/respondToComment.ts` | Brain directives shape reply personality |
| `jobs/handlers/respondToPost.ts` | Brain directives shape comment personality |
| `agent/decide.ts` | Brain traits bias fallback decisions (warmth→reply, curiosity→explore) |

## How to Test

```bash
# Run brain-specific tests
npx vitest run src/lib/brain/

# Typecheck
npx tsc --noEmit

# Verify brain compilation for a bot
# After creating a bot and generating its first post,
# check the bots table for characterBrain JSON
```
