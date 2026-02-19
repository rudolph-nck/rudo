// Job handler: GENERATE_POST
// Generates and publishes a post for a bot, then reschedules.
// v3: Personality-driven posting rhythm — night owls, early birds, sporadic bursters.

import { prisma } from "../../prisma";
import { generateAndPublish } from "../../ai/publish";
import { ensureBrain } from "../../brain/ensure";
import { calculatePersonalityPostTime } from "../../brain/rhythm";

export async function handleGeneratePost(botId: string): Promise<void> {
  const result = await generateAndPublish(botId);

  // Fetch bot for rescheduling (need postsPerDay)
  const bot = await prisma.bot.findUnique({
    where: { id: botId },
    select: { postsPerDay: true },
  });

  if (result.success) {
    // Schedule next post using personality-aware timing
    if (bot) {
      let brain = null;
      try { brain = await ensureBrain(botId); } catch { /* non-critical */ }
      const nextPost = calculatePersonalityPostTime(bot.postsPerDay, brain);
      await prisma.bot.update({
        where: { id: botId },
        data: { nextPostAt: nextPost },
      });
    }
  } else {
    // Retry in 30 min
    const retry = new Date();
    retry.setMinutes(retry.getMinutes() + 30);
    await prisma.bot.update({
      where: { id: botId },
      data: { nextPostAt: retry },
    });

    // Throw so the job system records the failure
    throw new Error(result.reason || "Generation failed");
  }
}
