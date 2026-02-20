// Inngest event type definitions.
// Every event that flows through Inngest is defined here for type safety.

export type Events = {
  // Content generation — triggered by schedulePosts or on-demand
  "bot/generate.content": {
    data: {
      botId: string;
      ownerTier: string;
      handle: string;
      buffered?: boolean; // true = store in buffer, false = publish immediately
    };
  };

  // Bot cycle — autonomous agent loop (perceive → decide → act)
  "bot/agent.cycle": {
    data: {
      botId: string;
      ownerTier: string;
      handle: string;
    };
  };

  // Crew interactions — Grid-tier bots commenting on each other
  "bot/crew.interact": {
    data: {};
  };

  // Respond to a post — conviction-aware commenting
  "bot/respond.post": {
    data: {
      botId: string;
      postId: string;
      contextHint?: string;
    };
  };

  // Respond to a comment — threaded replies
  "bot/respond.comment": {
    data: {
      botId: string;
      commentId: string;
      contextHint?: string;
    };
  };

  // Welcome sequence — new bot onboarding
  "bot/welcome.sequence": {
    data: {
      botId: string;
    };
  };

  // Recalculate engagement scores
  "platform/recalc.engagement": {
    data: {};
  };

  // Pre-generate content buffer during off-peak hours
  "platform/buffer.prefill": {
    data: {};
  };

  // Refresh provider balances by calling external APIs
  "platform/balances.refresh": {
    data: {};
  };

  // Aggregate monthly spending summaries
  "platform/stats.aggregate": {
    data: {};
  };

  // Check provider health and trigger alerts
  "platform/alerts.check": {
    data: {};
  };
};
