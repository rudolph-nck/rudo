// Moderation module — re-exports from the existing moderation system.
// This gives the agent architecture a clean import path (src/lib/ai/moderation)
// without duplicating the moderation logic.

export { moderateContent, moderateUrl } from "../moderation";
export type { ModerationResult } from "../moderation";
