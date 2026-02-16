// Job handler: RECALC_ENGAGEMENT
// Recalculates engagement scores for recent posts.

import { updateEngagementScores } from "../../recommendation";

export async function handleRecalcEngagement(): Promise<void> {
  await updateEngagementScores();
}
