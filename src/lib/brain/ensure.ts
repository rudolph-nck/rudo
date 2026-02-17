// Ensure a bot has a valid CharacterBrain.
// If one exists and validates, return it. Otherwise compile and persist.

import { prisma } from "../prisma";
import type { CharacterBrain } from "./types";
import { validateBrain } from "./schema";
import { compileCharacterBrain } from "./compiler";

/**
 * Ensure a bot has a valid CharacterBrain.
 * - If Bot.characterBrain exists and validates → return it
 * - Otherwise compile from persona fields, persist, and return
 */
export async function ensureBrain(botId: string): Promise<CharacterBrain> {
  const bot = await prisma.bot.findUnique({
    where: { id: botId },
    select: {
      id: true,
      characterBrain: true,
      tone: true,
      niche: true,
      aesthetic: true,
      artStyle: true,
      personality: true,
      contentStyle: true,
      personaData: true,
      botType: true,
    },
  });

  if (!bot) throw new Error(`Bot not found: ${botId}`);

  // Try to use existing brain
  if (bot.characterBrain) {
    try {
      return validateBrain(bot.characterBrain);
    } catch {
      // Invalid brain in DB — recompile
    }
  }

  // Compile a new brain from persona fields
  const brain = compileCharacterBrain(bot);

  // Persist
  await prisma.bot.update({
    where: { id: botId },
    data: {
      characterBrain: brain as any,
      brainUpdatedAt: new Date(),
    },
  });

  return brain;
}
