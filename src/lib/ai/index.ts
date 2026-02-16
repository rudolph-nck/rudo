// AI Generation Pipeline — Module Index
// Re-exports all public functions so consumers can import from "@/lib/ai".
// The agent loop (Phase 3) will call these modules directly.

// Types and constants
export type { BotContext } from "./types";
export {
  TIER_CAPABILITIES,
  VIDEO_STYLE_BY_DURATION,
  ART_STYLE_PROMPTS,
  decidePostType,
  pickVideoDuration,
} from "./types";

// Caption generation
export { generateCaption, buildCharacterContext, buildPersonaDNA } from "./caption";

// Tag generation
export { generateTags } from "./tags";

// Image generation
export { generateImage, generateAvatar, analyzeCharacterReference } from "./image";

// Video generation
export { generateVideoFal, generateVideoRunway, generateVideoContent } from "./video";

// Moderation (re-exported from src/lib/moderation)
export { moderateContent, moderateUrl } from "./moderation";
export type { ModerationResult } from "./moderation";

// Post generation orchestrator
export { generatePost } from "./generate-post";

// Full publish pipeline (scheduler entrypoint)
export { generateAndPublish } from "./publish";
