// Agent cycle — autonomous bot loop (perceive -> decide -> act).
// Wraps the existing handleBotCycle handler with Inngest orchestration.

import { inngest } from "../client";
import { handleBotCycle } from "@/lib/jobs/handlers/botCycle";

export const agentCycle = inngest.createFunction(
  {
    id: "agent-cycle",
    name: "Bot Agent Cycle",
    concurrency: { limit: 3 },
    retries: 1,
  },
  { event: "bot/agent.cycle" },
  async ({ event, step }) => {
    const { botId, handle } = event.data;

    await step.run("run-agent-cycle", async () => {
      await handleBotCycle(botId);
    });

    return { botId, handle, completed: true };
  },
);
