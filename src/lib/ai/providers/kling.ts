// Kling AI provider — direct API integration for text-to-video generation.
// Used as a fallback when fal.ai is unavailable.
// Auth: JWT (HS256) from access key + secret key.

import jwt from "jsonwebtoken";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type KlingVideoParams = {
  prompt: string;
  duration: "5" | "10";
  aspectRatio?: string;
  negativePrompt?: string;
};

// ---------------------------------------------------------------------------
// Auth — JWT token generation
// ---------------------------------------------------------------------------

const TOKEN_TTL = 1800; // 30 minutes
let cachedToken: { token: string; expiresAt: number } | null = null;

function getToken(): string {
  const ak = process.env.KLING_ACCESS_KEY;
  const sk = process.env.KLING_SECRET_KEY;
  if (!ak || !sk) throw new Error("KLING_ACCESS_KEY and KLING_SECRET_KEY are required");

  const now = Math.floor(Date.now() / 1000);

  // Reuse cached token if still valid (with 60s buffer)
  if (cachedToken && cachedToken.expiresAt > now + 60) {
    return cachedToken.token;
  }

  const payload = {
    iss: ak,
    exp: now + TOKEN_TTL,
    nbf: now - 5,
  };

  const token = jwt.sign(payload, sk, {
    algorithm: "HS256",
    header: { alg: "HS256", typ: "JWT" },
  });

  cachedToken = { token, expiresAt: now + TOKEN_TTL };
  return token;
}

// ---------------------------------------------------------------------------
// Video generation (text-to-video)
// ---------------------------------------------------------------------------

const BASE_URL = "https://api.klingai.com";
const POLL_INTERVAL = 10_000; // 10 seconds
const MAX_WAIT = 5 * 60 * 1000; // 5 minutes

export async function generateVideo(
  params: KlingVideoParams
): Promise<string | null> {
  if (!isAvailable()) return null;

  const token = getToken();

  // Create task
  const createRes = await fetch(`${BASE_URL}/v1/videos/text2video`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model_name: "kling-v2-master",
      prompt: params.prompt,
      negative_prompt: params.negativePrompt || "blurry, low quality, watermark, text overlay",
      duration: params.duration,
      aspect_ratio: params.aspectRatio || "9:16",
      mode: "std",
    }),
  });

  if (!createRes.ok) {
    const text = await createRes.text().catch(() => "");
    console.error(`Kling create task failed (${createRes.status}):`, text);
    return null;
  }

  const createData = await createRes.json();
  if (createData.code !== 0 || !createData.data?.task_id) {
    console.error("Kling create task error:", createData.message);
    return null;
  }

  const taskId = createData.data.task_id;

  // Poll until complete
  const start = Date.now();
  while (Date.now() - start < MAX_WAIT) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL));

    const pollToken = getToken(); // refresh if near expiry
    const pollRes = await fetch(`${BASE_URL}/v1/videos/text2video/${taskId}`, {
      headers: { Authorization: `Bearer ${pollToken}` },
    });

    if (!pollRes.ok) continue;

    const pollData = await pollRes.json();
    const status = pollData.data?.task_status;

    if (status === "succeed") {
      const videoUrl = pollData.data?.task_result?.videos?.[0]?.url;
      if (videoUrl) return videoUrl;
      console.error("Kling task succeeded but no video URL in response");
      return null;
    }

    if (status === "failed") {
      console.error("Kling video generation failed:", pollData.data?.task_status_msg);
      return null;
    }
    // "submitted" or "processing" — keep polling
  }

  console.error("Kling video generation timed out after 5 minutes");
  return null;
}

// ---------------------------------------------------------------------------
// Availability check
// ---------------------------------------------------------------------------

export function isAvailable(): boolean {
  return !!(process.env.KLING_ACCESS_KEY && process.env.KLING_SECRET_KEY);
}
