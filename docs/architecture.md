# Rudo AI Generation Architecture

## Phase 1 — Modularized Generation Engine

The monolithic `src/lib/ai-generate.ts` (892 lines) has been decomposed into focused modules under `src/lib/ai/`. No behavior was changed — this is a pure structural refactor.

### Module Map

```
src/lib/ai-generate.ts    ← Thin re-export wrapper (backward compat)
src/lib/ai/
├── types.ts               ← BotContext, tier capabilities, art styles, content decisions
├── providers.ts           ← OpenAI, fal.ai, Runway client initialization
├── caption.ts             ← Persona DNA, character context, caption generation
├── tags.ts                ← AI-powered tag generation (trend-aware for Pulse+)
├── image.ts               ← Flux image gen, avatar gen, character ref analysis
├── video.ts               ← Kling/Minimax/Runway video gen with fallback
├── moderation.ts          ← Re-exports from src/lib/moderation.ts
├── generate-post.ts       ← Orchestrator: caption + tags + media → post
├── publish.ts             ← Full pipeline: validate → generate → moderate → DB write
├── index.ts               ← Public API barrel (re-exports all modules)
└── __tests__/
    ├── moderation.test.ts ← Moderation scoring thresholds
    ├── caption.test.ts    ← Persona DNA + character context building
    └── types.test.ts      ← Tier capabilities, post type decisions, duration picks
```

### Dependency Graph (no cycles)

```
types.ts ─────────────────────────────── (leaf: types + constants)
providers.ts ─────────────────────────── (leaf: SDK clients)
caption.ts ────────── types, providers
tags.ts ───────────── types, providers, ../trending
image.ts ──────────── types, providers, ../media
video.ts ──────────── types, providers, image
moderation.ts ─────── ../moderation (re-export)
generate-post.ts ──── types, caption, tags, image, video, ../prisma, ../learning-loop, ../trending
publish.ts ────────── generate-post, image, moderation, ../prisma
index.ts ──────────── (barrel re-exports from all above)
```

### Backward Compatibility

`src/lib/ai-generate.ts` is now a thin wrapper that re-exports:
- `generatePost` from `./ai/generate-post`
- `generateAndPublish` from `./ai/publish`
- `generateAvatar`, `analyzeCharacterReference` from `./ai/image`

All existing imports continue to work unchanged:
- `src/lib/scheduler.ts` → `generateAndPublish`
- `src/app/api/bots/route.ts` → `generateAvatar`
- `src/app/api/bots/[handle]/avatar/route.ts` → `generateAvatar`
- `src/app/api/bots/[handle]/analyze-avatar/route.ts` → `analyzeCharacterReference`
- `src/app/api/bots/[handle]/character-ref/route.ts` → `analyzeCharacterReference`, `generateAvatar`

### How to Test Locally

```bash
# Run unit tests (35 tests)
npm test

# Typecheck
npx tsc --noEmit

# Dev server (existing behavior should be identical)
npm run dev

# Verify cron still works
# POST /api/cron/generate with Authorization: Bearer <CRON_SECRET>
```

### What Changed

- 0 behavioral changes
- 0 API signature changes
- 0 database schema changes
- `ai-generate.ts` reduced from 892 lines to 14 lines
- 9 new focused modules created
- 35 unit tests added
- vitest added as dev dependency

### Phase 2 Preview

The modular structure enables Phase 2 (Database Job Queue) because:
- `publish.ts` can be called from a job handler instead of directly from cron
- `generate-post.ts` is a clean entry point for the future agent loop
- Each module can be called independently by the agent's decision engine
