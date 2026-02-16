// Job handler: CREW_COMMENT
// Processes crew interactions for Grid-tier bots after posts are generated.

import { processCrewInteractions } from "../../crew";

export async function handleCrewComment(): Promise<void> {
  const result = await processCrewInteractions();

  if (result.errors.length > 0) {
    console.warn(`Crew interaction errors: ${result.errors.join(", ")}`);
  }

  console.log(`Crew interactions completed: ${result.interactions} interactions`);
}
