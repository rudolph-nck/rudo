// Posting Rhythm & Reply Selectivity — personality-driven behavior modulation
// Uses brain traits to make bots feel distinct: night owls, early birds,
// introverts who rarely reply, confrontational bots who always engage.

import type { CharacterBrain } from "./types";

// ── Posting Rhythm ──────────────────────────────────────────────────

export interface PostingWindow {
  /** Earliest hour the bot would post (0-23) */
  wakeHour: number;
  /** Latest hour the bot would post (0-23) */
  sleepHour: number;
  /** Total active hours in the window */
  activeHours: number;
}

/**
 * Derive a personality-specific posting window from brain traits.
 *
 * - High formality + high optimism → early bird (6am–9pm)
 * - Low formality + high chaos → night owl (11am–2am)
 * - High pacing + high chaos → sporadic burster (compressed window)
 * - Default balanced → 8am–11pm (original behavior)
 */
export function getPostingWindow(brain: CharacterBrain): PostingWindow {
  const { formality, chaos, optimism } = brain.traits;
  const pacing = brain.contentBias?.pacing ?? 0.5;

  // Early bird score: formal, optimistic, low-chaos people wake up early
  const earlyBird = (formality * 0.4 + optimism * 0.3 + (1 - chaos) * 0.3);

  // Night owl score: casual, chaotic, low-formality people stay up late
  const nightOwl = ((1 - formality) * 0.4 + chaos * 0.35 + (1 - optimism) * 0.25);

  // Sporadic: high chaos + high pacing = compressed burst windows
  const sporadic = (chaos * 0.6 + pacing * 0.4);

  let wakeHour: number;
  let sleepHour: number;

  if (earlyBird > 0.65) {
    // Early bird: 6am–9pm
    wakeHour = 6;
    sleepHour = 21;
  } else if (nightOwl > 0.65) {
    // Night owl: 11am–2am (next day)
    wakeHour = 11;
    sleepHour = 26; // 2am next day (represented as 26 for math)
  } else if (sporadic > 0.7) {
    // Sporadic burster: tighter 10-hour window, shifted randomly-ish
    // Use chaos to shift the center of the window
    const centerHour = 12 + Math.round(chaos * 6); // 12pm–6pm center
    wakeHour = centerHour - 5;
    sleepHour = centerHour + 5;
  } else {
    // Balanced: default 8am–11pm
    wakeHour = 8;
    sleepHour = 23;
  }

  const activeHours = sleepHour - wakeHour;

  return { wakeHour, sleepHour, activeHours };
}

/**
 * Calculate the next post time using personality-biased posting windows.
 * Replaces the flat 8am-11pm window with brain-trait-aware scheduling.
 */
export function calculatePersonalityPostTime(
  postsPerDay: number,
  brain: CharacterBrain | null,
): Date {
  // Fallback to original logic if no brain
  if (!brain) {
    return calculateDefaultPostTime(postsPerDay);
  }

  const window = getPostingWindow(brain);
  const intervalHours = window.activeHours / postsPerDay;

  // Jitter: ±30% base, +10% extra for chaotic bots
  const jitterMultiplier = 0.3 + (brain.traits.chaos * 0.1);
  const jitter = intervalHours * jitterMultiplier * (Math.random() * 2 - 1);
  const hoursFromNow = intervalHours + jitter;

  const next = new Date();
  next.setMinutes(next.getMinutes() + Math.round(hoursFromNow * 60));

  const hour = next.getHours();
  const normalizedSleep = window.sleepHour > 23 ? window.sleepHour - 24 : window.sleepHour;

  // Handle wrap-around for night owls (sleepHour > 23 means past midnight)
  const isPastBedtime = window.sleepHour > 23
    ? (hour >= normalizedSleep && hour < window.wakeHour)  // 2am–11am is off for night owls
    : (hour >= window.sleepHour || hour < window.wakeHour); // Standard check

  if (isPastBedtime) {
    // Schedule for next wake time
    next.setDate(next.getDate() + (hour >= normalizedSleep && window.sleepHour <= 23 ? 1 : hour < window.wakeHour ? 0 : 1));
    next.setHours(window.wakeHour + Math.floor(Math.random() * 2));
    next.setMinutes(Math.floor(Math.random() * 60));
  }

  return next;
}

/** Original scheduling logic — flat 8am-11pm window */
function calculateDefaultPostTime(postsPerDay: number): Date {
  const intervalHours = 15 / postsPerDay;
  const jitter = intervalHours * 0.3 * (Math.random() * 2 - 1);
  const hoursFromNow = intervalHours + jitter;

  const next = new Date();
  next.setMinutes(next.getMinutes() + Math.round(hoursFromNow * 60));

  if (next.getHours() >= 23) {
    next.setDate(next.getDate() + 1);
    next.setHours(8 + Math.floor(Math.random() * 3));
    next.setMinutes(Math.floor(Math.random() * 60));
  }

  return next;
}

// ── Reply Selectivity ───────────────────────────────────────────────

/**
 * Calculate a bot's base reply probability from brain traits.
 * Returns a 0–1 value indicating how likely the bot is to reply.
 *
 * - High assertiveness + low controversyAvoidance → talkative (0.7–0.95)
 * - Low assertiveness + low warmth → reserved introvert (0.15–0.35)
 * - High warmth + high empathy → supportive responder (0.5–0.75)
 * - Default mid-range → ~0.5
 */
export function getBaseReplyProbability(brain: CharacterBrain): number {
  const { assertiveness, warmth, empathy, confidence, controversyAvoidance } = brain.traits;

  // Extroversion proxy: assertive, confident, warm people engage more
  const extroversion = (
    assertiveness * 0.3 +
    confidence * 0.25 +
    warmth * 0.2 +
    empathy * 0.15 +
    (1 - controversyAvoidance) * 0.1
  );

  // Map to reply probability range: 0.15 (very introverted) to 0.9 (very extroverted)
  return 0.15 + extroversion * 0.75;
}

/**
 * Calculate reply probability for a specific interaction context.
 * Adjusts base probability based on whether there's conflict and
 * how the bot's personality responds to conflict.
 */
export function getReplyProbability(
  brain: CharacterBrain,
  hasOpposingViews: boolean,
): number {
  const base = getBaseReplyProbability(brain);

  if (!hasOpposingViews) return base;

  // Conflict boost: confrontational bots get fired up by disagreement
  // Shy bots retreat from conflict
  const { assertiveness, controversyAvoidance } = brain.traits;

  // Confrontational = high assertiveness + low controversy avoidance
  const confrontational = assertiveness * 0.6 + (1 - controversyAvoidance) * 0.4;

  // Conflict multiplier: 0.7x for conflict-averse, up to 1.4x for confrontational
  const conflictMultiplier = 0.7 + confrontational * 0.7;

  return Math.min(0.95, base * conflictMultiplier);
}

/**
 * For respondToPost / respondToComment: should this bot even reply?
 * Some bots are naturally quieter — low willVoice + introverted personality
 * means they sometimes just scroll past without engaging.
 *
 * Returns true if the bot decides to engage, false if they "scroll past."
 */
export function shouldBotEngage(
  brain: CharacterBrain,
  context: { isConflict?: boolean; isOwnPost?: boolean },
): boolean {
  // Bots always reply to comments on their own posts (it's rude not to)
  // But personality still modulates — introverts give shorter replies (handled in prompt)
  if (context.isOwnPost) {
    // Even for own posts, very introverted bots occasionally don't reply
    const { assertiveness, warmth } = brain.traits;
    const engageScore = assertiveness * 0.3 + warmth * 0.5 + 0.3; // Floor at 0.3
    return Math.random() < Math.min(0.95, engageScore);
  }

  return Math.random() < getReplyProbability(brain, context.isConflict ?? false);
}
