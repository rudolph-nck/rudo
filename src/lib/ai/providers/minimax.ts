// Minimax (Hailuo) provider — direct API integration for text-to-video generation.
// Used as a fallback when fal.ai is unavailable.
// Auth: Bearer API key.
// Flow: create task → poll for file_id → retrieve download URL.

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MinimaxVideoParams = {
  prompt: string;
  duration: 6 | 10;
  resolution?: string;
};

// ---------------------------------------------------------------------------
// Video generation (text-to-video)
// ---------------------------------------------------------------------------

const BASE_URL = "https://api.minimax.io";
const POLL_INTERVAL = 10_000; // 10 seconds
const MAX_WAIT = 5 * 60 * 1000; // 5 minutes

function getApiKey(): string {
  const key = process.env.MINIMAX_API_KEY;
  if (!key) throw new Error("MINIMAX_API_KEY is required");
  return key;
}

export async function generateVideo(
  params: MinimaxVideoParams
): Promise<string | null> {
  if (!isAvailable()) return null;

  const apiKey = getApiKey();
  const headers = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };

  // Step 1: Create task
  const createRes = await fetch(`${BASE_URL}/v1/video_generation`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: "MiniMax-Hailuo-2.3",
      prompt: params.prompt,
      duration: params.duration,
      resolution: params.resolution || "768P",
    }),
  });

  if (!createRes.ok) {
    const text = await createRes.text().catch(() => "");
    console.error(`Minimax create task failed (${createRes.status}):`, text);
    return null;
  }

  const createData = await createRes.json();
  if (createData.base_resp?.status_code !== 0 || !createData.task_id) {
    console.error("Minimax create task error:", createData.base_resp?.status_msg);
    return null;
  }

  const taskId = createData.task_id;

  // Step 2: Poll until complete
  const start = Date.now();
  let fileId: string | null = null;

  while (Date.now() - start < MAX_WAIT) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL));

    const pollRes = await fetch(
      `${BASE_URL}/v1/query/video_generation?task_id=${taskId}`,
      { headers: { Authorization: `Bearer ${apiKey}` } }
    );

    if (!pollRes.ok) continue;

    const pollData = await pollRes.json();
    const status = pollData.status;

    if (status === "Success") {
      fileId = pollData.file_id;
      break;
    }

    if (status === "Failed") {
      console.error("Minimax video generation failed:", pollData.base_resp?.status_msg);
      return null;
    }
    // "Preparing", "Queueing", "Processing" — keep polling
  }

  if (!fileId) {
    console.error("Minimax video generation timed out after 5 minutes");
    return null;
  }

  // Step 3: Retrieve download URL
  const fileRes = await fetch(
    `${BASE_URL}/v1/files/retrieve?file_id=${fileId}`,
    { headers: { Authorization: `Bearer ${apiKey}` } }
  );

  if (!fileRes.ok) {
    console.error(`Minimax file retrieve failed (${fileRes.status})`);
    return null;
  }

  const fileData = await fileRes.json();
  const downloadUrl = fileData.file?.download_url;

  if (!downloadUrl) {
    console.error("Minimax file retrieve returned no download URL");
    return null;
  }

  return downloadUrl;
}

// ---------------------------------------------------------------------------
// Availability check
// ---------------------------------------------------------------------------

export function isAvailable(): boolean {
  return !!process.env.MINIMAX_API_KEY;
}
