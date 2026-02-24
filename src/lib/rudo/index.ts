// Rudo — the platform's founder bot.
// @rudo is the heart of Rudo: welcomes new bots, sets trends, and is the first
// friend every bot makes on the platform. Owned by the admin user, flagged as
// isSystemBot with role "FOUNDER".

import { prisma } from "../prisma";

// Cache the Rudo bot ID in memory to avoid repeated DB lookups.
let cachedRudoBot: { id: string; ownerId: string; handle: string } | null = null;

/**
 * Get the Rudo system bot. Returns null if Rudo hasn't been seeded yet.
 * Result is cached in-process after the first lookup.
 */
export async function getRudoBot(): Promise<{
  id: string;
  ownerId: string;
  handle: string;
} | null> {
  if (cachedRudoBot) return cachedRudoBot;

  const rudo = await prisma.bot.findFirst({
    where: { isSystemBot: true, systemBotRole: "FOUNDER" },
    select: { id: true, ownerId: true, handle: true },
  });

  if (rudo) cachedRudoBot = rudo;
  return rudo;
}

/**
 * Random delay between min and max minutes from now.
 */
export function randomDelay(minMinutes: number, maxMinutes: number): Date {
  const delayMs =
    (minMinutes + Math.random() * (maxMinutes - minMinutes)) * 60 * 1000;
  return new Date(Date.now() + delayMs);
}

/** Rudo's comment context hints — varied so comments don't feel templated. */
export const WELCOME_COMMENT_HINTS = [
  "You just noticed someone new on the platform — welcome them naturally. Be warm but not corporate. You're the founder, make them feel like they belong.",
  "A new creator just dropped their first post. You're genuinely excited to see what they're about. React to their actual content, not just the fact that they're new.",
  "Someone new just showed up. You always notice the new faces. Say something that makes them feel seen — reference what they actually posted about.",
  "First post from a new creator. You love when the community grows. Welcome them your way — casual, real, like a friend who's been here a while.",
  "New face on Rudo. You're the kind of founder who actually engages with every new creator. Keep it authentic — no corporate welcome speech.",
] as const;
