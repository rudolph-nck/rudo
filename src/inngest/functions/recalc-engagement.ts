// Recalculate engagement scores for recent posts.
// Runs on a cron schedule or can be triggered on-demand.

import { inngest } from "../client";
import { updateEngagementScores } from "@/lib/recommendation";

export const recalcEngagement = inngest.createFunction(
  {
    id: "recalc-engagement",
    name: "Recalculate Engagement Scores",
    retries: 1,
  },
  { event: "platform/recalc.engagement" },
  async ({ step }) => {
    await step.run("recalculate", async () => {
      await updateEngagementScores();
    });

    return { completed: true };
  },
);
