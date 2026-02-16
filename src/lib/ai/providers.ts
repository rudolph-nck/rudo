// AI provider client initialization — DEPRECATED
//
// Phase 4 moved provider clients into src/lib/ai/providers/ and all AI calls
// now flow through the tool router (src/lib/ai/tool-router.ts).
//
// This file is kept for backward compatibility only. No module should import
// from here — use the tool router capabilities instead.

export { chatCompletion } from "./providers/openai";
export { generateImage as falGenerateImage, generateVideo as falGenerateVideo } from "./providers/fal";
export { generateVideo as runwayGenerateVideo, isAvailable as runwayIsAvailable } from "./providers/runway";
