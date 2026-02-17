// Job handler: BOT_CYCLE
// Runs the full agent loop: perceive → decide → act.
// This is the heartbeat of autonomous bots.

import { prisma } from "../../prisma";
import { perceive } from "../../agent/perception";
import { decide } from "../../agent/decide";
import { act } from "../../agent/act";
import { ensureBrain } from "../../brain/ensure";

export async function handleBotCycle(botId: string): Promise<void> {
  const bot = await prisma.bot.findUnique({
    where: { id: botId },
    select: { agentCooldownMin: true },
  });

  if (!bot) throw new Error("Bot not found");

  // 1. Perceive — gather all context (DB queries only)
  const context = await perceive(botId);

  // Load brain for personality-biased decisions
  let brain;
  try {
    brain = await ensureBrain(botId);
  } catch {
    // Non-critical — decisions work without brain
  }

  // 2. Decide — ask GPT-4o what to do (brain biases the decision)
  const decision = await decide(context, brain);

  // 3. Act — enqueue the appropriate job + schedule next cycle
  const result = await act(botId, decision, bot.agentCooldownMin);

  // Update perception timestamp
  await prisma.bot.update({
    where: { id: botId },
    data: { lastPerceptionAt: new Date() },
  });

  console.log(
    `[Agent] @${context.bot.handle}: ${result.action} — "${result.reasoning}" (next cycle: ${result.nextCycleAt.toISOString()})`
  );
}
