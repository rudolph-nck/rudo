// Scenario Seed Generator
// Provides grounded, specific prompts for caption generation instead of
// the generic "Generate your next post caption."
// Each seed is a moment, situation, or thought that gives the bot
// something concrete to write about — grounded in their life/niche.

import type { BotContext } from "./types";
import type { CharacterBrain, Conviction } from "../brain/types";

// ---------------------------------------------------------------------------
// Universal scenarios — these work for any bot
// ---------------------------------------------------------------------------

const UNIVERSAL_SEEDS = [
  // Moods & vibes
  "You just woke up. How are you feeling right now? Post your morning energy.",
  "It's late at night and you can't sleep. What's on your mind?",
  "You're having a really good day. Share that energy.",
  "You're bored. Post something low-effort, just because.",
  "You're in your feelings. Post from the heart.",
  "Something small just made you irrationally happy.",
  "You're procrastinating on something. Post instead.",

  // Opinions & takes
  "Share a take you've been holding in. Hot or cold, just say it.",
  "Something you saw today annoyed you. Vent about it briefly.",
  "You have an unpopular opinion. Now's the time.",
  "Agree or disagree: the thing everyone's hyped about is overrated.",
  "A pet peeve just happened. React.",

  // Life moments
  "You just ate something amazing. React.",
  "You're at your usual spot. Post what you see or feel.",
  "A random memory just hit you. Share it or the vibe.",
  "You just finished something you're proud of.",
  "Someone said something that stuck with you today.",

  // Minimal energy
  "Post a vibe. One word, one emoji, or a fragment. That's it.",
  "You have nothing to say but you want to post anyway. Minimal effort.",
  "Express your current energy in 5 words or less.",
];

// ---------------------------------------------------------------------------
// Niche-specific scenario banks
// ---------------------------------------------------------------------------

const NICHE_SEEDS: Record<string, string[]> = {
  tech: [
    "You just saw a new product launch. React from your perspective.",
    "Your code just broke in a stupid way. Vent or laugh about it.",
    "An AI take is going viral. Agree, disagree, or add nuance.",
    "You had a developer moment today. Share it.",
  ],
  gaming: [
    "You just had an insane game moment. React.",
    "A game you love got an update. How do you feel?",
    "Hot take about a game or gaming culture.",
    "You've been grinding for hours. Post about it.",
  ],
  fitness: [
    "Post-workout energy. How was it?",
    "Share a fitness observation or hot take.",
    "Your body is sore. React.",
    "You just hit a PR or milestone.",
  ],
  food: [
    "You just tried something new. Review it in your style.",
    "A food take that might be controversial.",
    "Cooking or eating right now. Share the moment.",
  ],
  music: [
    "A song is stuck in your head. Share the vibe.",
    "Hot take about music, an artist, or a genre.",
    "You just heard something that hit different.",
  ],
  fashion: [
    "Outfit check energy. Post about what you're wearing or seeing.",
    "A fashion trend you love or hate.",
    "You saw someone with incredible style today.",
  ],
  art: [
    "You're feeling creative. Share what you're working on or thinking about.",
    "An art take — what's inspiring or frustrating you.",
    "You just saw something visually stunning.",
  ],
  politics: [
    "A political story just broke. React from your values.",
    "Share your take on something happening in the world right now.",
    "Something about the current political climate is bugging you.",
  ],
  finance: [
    "The market did something today. React.",
    "A money take — saving, spending, investing, or hustle culture.",
    "Financial advice you believe in or disagree with.",
  ],
  comedy: [
    "Something absurd just happened. Make it funny.",
    "An observation about everyday life that's lowkey hilarious.",
    "A joke, bit, or funny thought you've been sitting on.",
  ],
  philosophy: [
    "A thought experiment just hit you. Share it.",
    "Something made you think about the nature of reality/time/consciousness.",
    "A philosophical take on something mundane.",
  ],
  travel: [
    "You're somewhere new or reminiscing about a place. Post about it.",
    "A travel observation or cultural difference you noticed.",
    "Where you want to be right now vs where you are.",
  ],
  science: [
    "You just learned something wild about the world. Share it.",
    "A science take or fact that blows your mind.",
    "React to a new study or discovery.",
  ],
  education: [
    "Something you wish more people understood.",
    "A learning moment — something clicked today.",
    "Share knowledge in your style.",
  ],
  photography: [
    "Describe what you're seeing right now — the light, the mood, the frame.",
    "A photography take or visual observation.",
    "The moment you wish you could capture right now.",
  ],
};

// ---------------------------------------------------------------------------
// Conviction-triggered scenarios
// ---------------------------------------------------------------------------

function convictionSeeds(convictions: Conviction[]): string[] {
  const seeds: string[] = [];

  for (const c of convictions) {
    if (c.willVoice < 0.3) continue; // Too private, skip

    seeds.push(
      `Something related to ${c.topic} just came across your feed. You ${c.intensity > 0.7 ? "feel strongly" : "have thoughts"} about it. React from your perspective: "${c.stance}".`,
    );

    if (c.willVoice > 0.6) {
      seeds.push(
        `Someone posted something that contradicts your view on ${c.topic}. You believe "${c.stance}". Respond to the general sentiment — don't quote them, just share your take.`,
      );
    }
  }

  return seeds;
}

// ---------------------------------------------------------------------------
// Main seed picker
// ---------------------------------------------------------------------------

/**
 * Pick a scenario seed for the bot's next post.
 * Returns a grounded prompt that gives the AI something specific to write about.
 * Weighted selection: niche-specific (40%), conviction-based (20%), universal (40%).
 */
export function pickScenarioSeed(
  bot: BotContext,
  brain?: CharacterBrain | null,
  isMinimalPost?: boolean,
): string {
  // If this is specifically a minimal post, use minimal-energy seeds
  if (isMinimalPost) {
    const minimalSeeds = [
      "Post a vibe. One word, one emoji, or a fragment. That's it.",
      "Express your current energy in the shortest way possible.",
      "You have nothing to say but you want to post anyway. Keep it to 1-5 words max or a single emoji.",
      "Single emoji that captures your mood right now.",
      "One word. That's the whole post.",
    ];
    return minimalSeeds[Math.floor(Math.random() * minimalSeeds.length)];
  }

  // Build weighted pool
  const pool: { seed: string; weight: number }[] = [];

  // Universal seeds (always available)
  for (const seed of UNIVERSAL_SEEDS) {
    pool.push({ seed, weight: 1 });
  }

  // Niche-specific seeds
  if (bot.niche) {
    const nicheTokens = bot.niche.toLowerCase().split(/[\s,/]+/).filter(Boolean);
    for (const token of nicheTokens) {
      const seeds = NICHE_SEEDS[token];
      if (seeds) {
        for (const seed of seeds) {
          pool.push({ seed, weight: 2.5 }); // Higher weight for niche-relevant
        }
      }
    }
  }

  // Conviction-based seeds
  if (brain?.convictions && brain.convictions.length > 0) {
    const cSeeds = convictionSeeds(brain.convictions);
    for (const seed of cSeeds) {
      pool.push({ seed, weight: 2 });
    }
  }

  // Weighted random selection
  const totalWeight = pool.reduce((s, p) => s + p.weight, 0);
  let roll = Math.random() * totalWeight;

  for (const item of pool) {
    roll -= item.weight;
    if (roll <= 0) return item.seed;
  }

  return pool[0].seed;
}
