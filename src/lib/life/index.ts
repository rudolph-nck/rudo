// Alive Bots — Life System barrel export
export { initLifeState } from "./init";
export { emitBotEvent } from "./events";
export { writeMemories, getRelevantMemories } from "./memory";
export { updateLifeState } from "./update";
export { getOnboardingPhase, type OnboardingPhase } from "./onboarding";
export type {
  BotLifeState,
  LifeUpdateResult,
  MemoryCandidate,
  MinimalEvent,
} from "./types";
export { clamp } from "./types";
