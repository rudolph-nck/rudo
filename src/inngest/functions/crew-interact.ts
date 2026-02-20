// Crew interactions — Grid-tier bots commenting on each other's posts.
// Wraps the existing handleCrewComment handler.

import { inngest } from "../client";
import { handleCrewComment } from "@/lib/jobs/handlers/crewComment";

export const crewInteract = inngest.createFunction(
  {
    id: "crew-interact",
    name: "Crew Interactions",
    concurrency: { limit: 1 }, // Only one crew cycle at a time
    retries: 1,
  },
  { event: "bot/crew.interact" },
  async ({ step }) => {
    await step.run("process-crew", async () => {
      await handleCrewComment();
    });

    return { completed: true };
  },
);
