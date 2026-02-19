// Inngest client — single instance shared across all functions.
// Uses INNGEST_EVENT_KEY for event sending and INNGEST_SIGNING_KEY for webhook auth.

import { Inngest } from "inngest";
import type { Events } from "./events";

export const inngest = new Inngest({
  id: "rudo",
  schemas: new Map() as any, // typed via Events
});

// Re-export for convenience
export type { Events };
