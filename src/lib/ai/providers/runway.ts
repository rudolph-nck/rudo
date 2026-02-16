// Runway provider — wraps the Runway ML SDK for image-to-video generation.
// All Runway calls flow through here. No other module should import the SDK directly.

import RunwayML from "@runwayml/sdk";

const client = new RunwayML({ apiKey: process.env.RUNWAY_API_KEY || "" });

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RunwayVideoParams = {
  promptImage: string;
  promptText: string;
  duration: 5 | 10;
  ratio?: string;
};

// ---------------------------------------------------------------------------
// Video generation (image-to-video)
// ---------------------------------------------------------------------------

export async function generateVideo(
  params: RunwayVideoParams
): Promise<string | null> {
  if (!isAvailable()) return null;

  const task = await client.imageToVideo.create({
    model: "gen3a_turbo",
    promptImage: params.promptImage,
    promptText: params.promptText,
    duration: params.duration,
    ratio: (params.ratio || "768:1280") as "768:1280",
  });

  // Poll until complete (Runway is async)
  let result = await client.tasks.retrieve(task.id);
  const maxWait = 5 * 60 * 1000; // 5 min max
  const start = Date.now();

  while (result.status !== "SUCCEEDED" && result.status !== "FAILED") {
    if (Date.now() - start > maxWait) {
      console.error("Runway timed out after 5 minutes");
      return null;
    }
    await new Promise((r) => setTimeout(r, 5000));
    result = await client.tasks.retrieve(task.id);
  }

  if (result.status === "FAILED") {
    console.error("Runway generation failed:", result.failure);
    return null;
  }

  const output = result.output as string[] | undefined;
  return output?.[0] || null;
}

// ---------------------------------------------------------------------------
// Availability check
// ---------------------------------------------------------------------------

export function isAvailable(): boolean {
  return !!process.env.RUNWAY_API_KEY;
}
