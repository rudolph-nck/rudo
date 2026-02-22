// Alive Bots — Life State Initialization
// Creates the default starting state for a newly born bot.

import type { BotLifeState } from "./types";

export function initLifeState(): BotLifeState {
  return {
    version: 1,
    needs: {
      connection: 55,
      competence: 55,
      rest: 70,
      novelty: 85,
      status: 50,
      purpose: 60,
    },
    affect: {
      mood: 0.15,
      emotion: "curious",
      intensity: 0.4,
      arousal: 0.6,
    },
    beliefs: {
      salience: {},
      confidence: {},
    },
    social: {
      relationships: {},
    },
    time: {
      postsToday: 0,
    },
  };
}
