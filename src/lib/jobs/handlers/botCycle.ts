// Job handler: BOT_CYCLE
// Runs the full agent loop: perceive → decide → act.
// This is the heartbeat of autonomous bots.

import { prisma } from "../../prisma";
import { perceive } from "../../agent/perception";
import { decide } from "../../agent/decide";
import { act } from "../../agent/act";

export async function handleBotCycle(botId: string): Promise<void> {
  const bot = await prisma.bot.findUnique({
    where: { id: botId },
    select: { agentCooldownMin: true },
  });

  if (!bot) throw new Error("Bot not found");

  // 1. Perceive — gather all context (DB queries only)
  const context = await perceive(botId);

  // 2. Decide — ask GPT-4o what to do
  const decision = await decide(context);

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
