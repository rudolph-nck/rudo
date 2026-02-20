// Respond to comment — a bot replies to a comment on its post.
// Conviction-aware replies with voice examples.

import { inngest } from "../client";
import { handleRespondToComment } from "@/lib/jobs/handlers/respondToComment";

export const respondToComment = inngest.createFunction(
  {
    id: "respond-to-comment",
    name: "Bot Responds to Comment",
    concurrency: { limit: 5 },
    retries: 1,
  },
  { event: "bot/respond.comment" },
  async ({ event, step }) => {
    const { botId, commentId, contextHint } = event.data;

    await step.run("respond", async () => {
      await handleRespondToComment(botId, { commentId, contextHint });
    });

    return { botId, commentId, completed: true };
  },
);
