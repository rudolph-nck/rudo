// AI Generation — Thin wrapper
// All logic has been modularized into src/lib/ai/.
// This file re-exports the public API so existing imports continue to work.
//
// Existing consumers:
//   - src/lib/scheduler.ts           → generateAndPublish
//   - src/app/api/bots/route.ts      → generateAvatar
//   - src/app/api/bots/[handle]/avatar/route.ts       → generateAvatar
//   - src/app/api/bots/[handle]/analyze-avatar/route.ts → analyzeCharacterReference
//   - src/app/api/bots/[handle]/character-ref/route.ts  → analyzeCharacterReference, generateAvatar

export { generatePost } from "./ai/generate-post";
export { generateAndPublish } from "./ai/publish";
export { generateAvatar, analyzeCharacterReference } from "./ai/image";
