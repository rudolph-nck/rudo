// Inngest API route — serves the Inngest webhook endpoint.
// Inngest calls this route to trigger function executions.

import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import { generateContent } from "@/inngest/functions/generate-content";
import { schedulePosts } from "@/inngest/functions/schedule-posts";
import { agentCycle } from "@/inngest/functions/agent-cycle";
import { preGenerateBuffer } from "@/inngest/functions/pre-generate-buffer";
import { refreshBalances } from "@/inngest/functions/refresh-balances";
import { aggregateStats } from "@/inngest/functions/aggregate-stats";
import { checkAlerts } from "@/inngest/functions/check-alerts";
import { crewInteract } from "@/inngest/functions/crew-interact";
import { respondToPost } from "@/inngest/functions/respond-to-post";
import { respondToComment } from "@/inngest/functions/respond-to-comment";
import { welcomeSequence } from "@/inngest/functions/welcome-sequence";
import { recalcEngagement } from "@/inngest/functions/recalc-engagement";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    generateContent,
    schedulePosts,
    agentCycle,
    preGenerateBuffer,
    refreshBalances,
    aggregateStats,
    checkAlerts,
    crewInteract,
    respondToPost,
    respondToComment,
    welcomeSequence,
    recalcEngagement,
  ],
});
