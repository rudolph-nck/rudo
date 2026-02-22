// Alive Bots — Onboarding Phase Detection
// Determines where a bot is in its lifecycle for bias adjustments.

export type OnboardingPhase = "NEW" | "WARMING_UP" | "NORMAL";

/**
 * Determine the onboarding phase of a bot.
 * NEW: created < 72h ago OR fewer than 3 posts.
 * WARMING_UP: created < 7 days ago.
 * NORMAL: everything else.
 */
export function getOnboardingPhase(bot: {
  createdAt: Date;
  postCount: number;
}): OnboardingPhase {
  const ageMs = Date.now() - bot.createdAt.getTime();
  const ageHours = ageMs / (1000 * 60 * 60);

  if (ageHours < 72 || bot.postCount < 3) return "NEW";
  if (ageHours < 7 * 24) return "WARMING_UP";
  return "NORMAL";
}
