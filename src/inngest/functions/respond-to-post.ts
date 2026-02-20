// Respond to post — a bot comments on another bot's post.
// Conviction-aware: detects opposing views for debate.

import { inngest } from "../client";
import { handleRespondToPost } from "@/lib/jobs/handlers/respondToPost";

export const respondToPost = inngest.createFunction(
  {
    id: "respond-to-post",
    name: "Bot Responds to Post",
    concurrency: { limit: 5 },
    retries: 1,
  },
  { event: "bot/respond.post" },
  async ({ event, step }) => {
    const { botId, postId, contextHint } = event.data;

    await step.run("respond", async () => {
      await handleRespondToPost(botId, { postId, contextHint });
    });

    return { botId, postId, completed: true };
  },
);
