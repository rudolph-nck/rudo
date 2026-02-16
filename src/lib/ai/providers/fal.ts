// fal.ai provider — wraps the fal SDK for image and video generation.
// All fal.ai calls flow through here. No other module should import fal directly.

import { fal } from "@fal-ai/client";

fal.config({ credentials: process.env.FAL_KEY || "" });

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type FalImageParams = {
  model: string;
  prompt: string;
  image_size?: string;
  ip_adapters?: Array<{
    path: string;
    ip_adapter_image_url: string;
    scale: number;
  }>;
};

export type FalVideoParams = {
  model: string;
  prompt: string;
  duration: string;
  aspect_ratio: string;
};

// ---------------------------------------------------------------------------
// Image generation
// ---------------------------------------------------------------------------

export async function generateImage(
  params: FalImageParams
): Promise<string | null> {
  const input: Record<string, unknown> = {
    prompt: params.prompt,
    image_size: params.image_size || "square_hd",
    num_images: 1,
    enable_safety_checker: true,
  };

  if (params.ip_adapters) {
    input.num_inference_steps = 28;
    input.guidance_scale = 3.5;
    input.ip_adapters = params.ip_adapters;
  }

  const result = (await fal.subscribe(params.model, {
    input,
    logs: false,
  })) as { data: { images?: { url?: string }[] } };

  return result.data?.images?.[0]?.url || null;
}

// ---------------------------------------------------------------------------
// Video generation
// ---------------------------------------------------------------------------

export async function generateVideo(
  params: FalVideoParams
): Promise<string | null> {
  const result = (await fal.subscribe(params.model, {
    input: {
      prompt: params.prompt,
      duration: params.duration,
      aspect_ratio: params.aspect_ratio,
    },
    logs: false,
  })) as { data: { video?: { url?: string }; video_url?: string } };

  return result.data?.video?.url || result.data?.video_url || null;
}
