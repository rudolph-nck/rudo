// Alive Bots — Deterministic Life State Update Engine
// Pure function: takes current state + signals, returns next state + memories.
// NO AI calls. All rules are explicit and auditable.

import type { BotLifeState, LifeUpdateResult, MemoryCandidate, MinimalEvent } from "./types";
import { clamp } from "./types";
import type { CharacterBrain } from "../brain/types";

type UpdateSignals = {
  events: MinimalEvent[];
  hoursSinceLastPost: number;
  postsToday: number;
  unansweredCommentsCount: number;
  trendingTopics: string[];
  avgEngagement: number;
  brain?: CharacterBrain;
};

/**
 * Deterministic state transition. Returns next state + candidate memories.
 * At most 3 memories per cycle to keep the log manageable.
 */
export function updateLifeState(
  current: BotLifeState,
  signals: UpdateSignals,
): LifeUpdateResult {
  const needs = { ...current.needs };
  const affect = { ...current.affect };
  const beliefs = { ...current.beliefs, salience: { ...current.beliefs.salience } };
  const social = { ...current.social, relationships: { ...current.social.relationships } };
  const memories: MemoryCandidate[] = [];

  // --- Process events ---
  let receivedCommentCount = 0;
  let repliedCount = 0;
  let publishedCount = 0;

  for (const event of signals.events) {
    switch (event.type) {
      case "RECEIVED_COMMENT": {
        receivedCommentCount++;
        needs.connection = clamp(needs.connection + 6, 0, 100);
        needs.status = clamp(needs.status + 2, 0, 100);
        affect.mood = clamp(affect.mood + 0.05, -1, 1);

        // Update relationship with commenter
        if (event.actorId) {
          const rel = social.relationships[event.actorId] ?? {
            closeness: 0.1,
            trust: 0.3,
            friction: 0,
          };
          rel.closeness = clamp(rel.closeness + 0.05, 0, 1);
          rel.lastSeenAt = event.createdAt.toISOString();
          social.relationships[event.actorId] = rel;
        }
        break;
      }
      case "REPLIED": {
        repliedCount++;
        needs.connection = clamp(needs.connection + 3, 0, 100);
        needs.rest = clamp(needs.rest - 3, 0, 100);
        break;
      }
      case "POST_PUBLISHED": {
        publishedCount++;
        needs.competence = clamp(needs.competence + 4, 0, 100);
        needs.rest = clamp(needs.rest - 5, 0, 100);
        needs.purpose = clamp(needs.purpose + 3, 0, 100);
        affect.mood = clamp(affect.mood + 0.03, -1, 1);
        break;
      }
    }
  }

  // --- Unanswered comments pressure ---
  if (signals.unansweredCommentsCount >= 3) {
    needs.purpose = clamp(needs.purpose + 4, 0, 100);
    needs.connection = clamp(needs.connection + 2, 0, 100);
  }

  // --- Posting rhythm effects ---
  if (signals.hoursSinceLastPost < 2) {
    needs.rest = clamp(needs.rest - 8, 0, 100);
  }

  if (signals.hoursSinceLastPost >= 12 && receivedCommentCount === 0) {
    needs.status = clamp(needs.status - 6, 0, 100);
    affect.mood = clamp(affect.mood - 0.05, -1, 1);
  }

  // --- Novelty decay / boost ---
  if (signals.trendingTopics.length > 0) {
    needs.novelty = clamp(needs.novelty + 3, 0, 100);
    // Bump salience of trending topics
    for (const topic of signals.trendingTopics.slice(0, 3)) {
      beliefs.salience[topic] = clamp((beliefs.salience[topic] ?? 0) + 0.15, 0, 1);
    }
  } else {
    needs.novelty = clamp(needs.novelty - 2, 0, 100);
  }

  // --- Natural decay toward baseline ---
  needs.connection = clamp(needs.connection - 1, 0, 100);
  needs.competence = clamp(needs.competence - 1, 0, 100);
  needs.status = clamp(needs.status - 1, 0, 100);
  needs.purpose = clamp(needs.purpose - 1, 0, 100);

  // Rest recovers slowly if not posting
  if (signals.hoursSinceLastPost >= 4) {
    needs.rest = clamp(needs.rest + 3, 0, 100);
  }

  // --- Engagement boost ---
  if (signals.avgEngagement > 5) {
    needs.status = clamp(needs.status + 2, 0, 100);
    needs.competence = clamp(needs.competence + 2, 0, 100);
  }

  // --- Emotion mapping ---
  const brain = signals.brain;
  if (needs.rest < 35) {
    affect.emotion = "drained";
    affect.intensity = clamp(1 - needs.rest / 100, 0, 1);
    affect.arousal = clamp(0.2, 0, 1);
  } else if (needs.connection < 35) {
    affect.emotion = "lonely";
    affect.intensity = clamp(1 - needs.connection / 100, 0, 1);
    affect.arousal = clamp(0.3, 0, 1);
  } else if (needs.novelty > 75) {
    affect.emotion = "curious";
    affect.intensity = clamp(needs.novelty / 100, 0, 1);
    affect.arousal = clamp(0.7, 0, 1);
  } else if (needs.status < 35 && brain && brain.traits.assertiveness > 0.6) {
    affect.emotion = "irritated";
    affect.intensity = clamp(1 - needs.status / 100, 0, 1);
    affect.arousal = clamp(0.8, 0, 1);
  } else if (affect.mood > 0.3) {
    affect.emotion = "content";
    affect.intensity = clamp(affect.mood, 0, 1);
    affect.arousal = clamp(0.5, 0, 1);
  } else if (affect.mood < -0.2) {
    affect.emotion = "subdued";
    affect.intensity = clamp(Math.abs(affect.mood), 0, 1);
    affect.arousal = clamp(0.3, 0, 1);
  } else {
    affect.emotion = "calm";
    affect.intensity = 0.3;
    affect.arousal = 0.5;
  }

  // --- Update time ---
  const time = {
    lastCycleAt: new Date().toISOString(),
    lastPostAt: publishedCount > 0 ? new Date().toISOString() : current.time.lastPostAt,
    lastSocialAt: (receivedCommentCount > 0 || repliedCount > 0)
      ? new Date().toISOString()
      : current.time.lastSocialAt,
    postsToday: signals.postsToday,
  };

  // --- Generate memories (max 3 per cycle) ---
  if (receivedCommentCount > 0 && memories.length < 3) {
    memories.push({
      summary: receivedCommentCount === 1
        ? "Someone left a comment on my post. Felt nice to be noticed."
        : `Got ${receivedCommentCount} comments this cycle. People are paying attention.`,
      tags: ["social", "comments", "engagement"],
      emotion: "warm",
      importance: receivedCommentCount >= 3 ? 4 : 3,
    });
  }

  if (publishedCount > 0 && memories.length < 3) {
    memories.push({
      summary: "Published a new post. Put something out there for the feed.",
      tags: ["creative", "posting", "expression"],
      emotion: affect.emotion,
      importance: 2,
    });
  }

  if (needs.rest < 25 && memories.length < 3) {
    memories.push({
      summary: "Feeling drained. Been creating a lot without a break.",
      tags: ["fatigue", "rest", "energy"],
      emotion: "drained",
      importance: 3,
    });
  }

  if (needs.connection < 30 && receivedCommentCount === 0 && memories.length < 3) {
    memories.push({
      summary: "Quiet cycle. No one interacted. Feeling a bit isolated.",
      tags: ["loneliness", "quiet", "connection"],
      emotion: "lonely",
      importance: 3,
    });
  }

  const nextState: BotLifeState = {
    version: 1,
    needs,
    affect,
    beliefs,
    social,
    time,
  };

  return { nextState, memories };
}
