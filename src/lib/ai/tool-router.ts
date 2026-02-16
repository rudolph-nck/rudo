// Tool Router — routes AI capability requests to the right provider
// based on tier, budget, trust level, and fallback logic.
//
// This is the ONLY interface between application code and AI providers.
// Agent code, job handlers, and generation modules call the tool router —
// NEVER providers directly.

import * as openaiProvider from "./providers/openai";
import * as falProvider from "./providers/fal";
import * as runwayProvider from "./providers/runway";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ToolContext = {
  tier: string;
  trustLevel?: number; // 0-1, affects model selection (default: 1)
  budget?: {
    dailyLimitCents?: number;
    spentTodayCents?: number;
  };
};

export const DEFAULT_CONTEXT: ToolContext = { tier: "SPARK", trustLevel: 1 };

export type CaptionRequest = {
  systemPrompt: string;
  userPrompt: string;
  maxTokens?: number;
  temperature?: number;
  jsonMode?: boolean;
};

export type ChatRequest = CaptionRequest;

export type ImageRequest = {
  prompt: string;
  referenceImageUrl?: string; // For IP-adapter grounding
  imageSize?: string;
};

export type VideoRequest = {
  prompt: string;
  durationSec: number;
  startFrameUrl?: string; // For image-to-video (Runway)
};

export type VisionRequest = {
  systemPrompt: string;
  userPrompt: string;
  imageUrl: string;
  maxTokens?: number;
};

// ---------------------------------------------------------------------------
// Tier → model mapping
// ---------------------------------------------------------------------------

const PREMIUM_TIERS = new Set(["GRID", "ADMIN"]);

export function selectChatModel(ctx: ToolContext): string {
  const premium = PREMIUM_TIERS.has(ctx.tier);
  const trusted = (ctx.trustLevel ?? 1) >= 0.5;
  return premium && trusted ? "gpt-4o" : "gpt-4o-mini";
}

// ---------------------------------------------------------------------------
// Budget check (placeholder — enforced in Phase 6)
// ---------------------------------------------------------------------------

function checkBudget(ctx: ToolContext): boolean {
  if (!ctx.budget?.dailyLimitCents) return true;
  const spent = ctx.budget.spentTodayCents ?? 0;
  return spent < ctx.budget.dailyLimitCents;
}

// ---------------------------------------------------------------------------
// Capabilities
// ---------------------------------------------------------------------------

/**
 * Generate a caption or any text completion.
 * Routes to OpenAI with tier-based model selection.
 */
export async function generateCaption(
  req: CaptionRequest,
  ctx: ToolContext = DEFAULT_CONTEXT
): Promise<string> {
  if (!checkBudget(ctx)) {
    console.warn("Tool router: daily budget exceeded, using cheapest model");
    ctx = { ...ctx, tier: "SPARK" };
  }

  const model = selectChatModel(ctx);

  return openaiProvider.chatCompletion({
    model,
    messages: [
      { role: "system", content: req.systemPrompt },
      { role: "user", content: req.userPrompt },
    ],
    max_tokens: req.maxTokens ?? 300,
    temperature: req.temperature ?? 0.9,
    ...(req.jsonMode ? { response_format: { type: "json_object" as const } } : {}),
  });
}

/**
 * General chat completion — semantic alias for generateCaption.
 * Used by agent decisions, comment replies, crew interactions.
 */
export async function generateChat(
  req: ChatRequest,
  ctx: ToolContext = DEFAULT_CONTEXT
): Promise<string> {
  return generateCaption(req, ctx);
}

/**
 * Generate an image via fal.ai.
 * Supports IP-adapter grounding when a reference image is provided.
 */
export async function generateImage(
  req: ImageRequest,
  ctx: ToolContext = DEFAULT_CONTEXT
): Promise<string | null> {
  if (!checkBudget(ctx)) {
    console.warn("Tool router: daily budget exceeded, skipping image generation");
    return null;
  }

  try {
    if (req.referenceImageUrl) {
      return await falProvider.generateImage({
        model: "fal-ai/flux-general",
        prompt: req.prompt,
        image_size: req.imageSize || "square_hd",
        ip_adapters: [
          {
            path: "XLabs-AI/flux-ip-adapter",
            ip_adapter_image_url: req.referenceImageUrl,
            scale: 0.7,
          },
        ],
      });
    }

    return await falProvider.generateImage({
      model: "fal-ai/flux/dev",
      prompt: req.prompt,
      image_size: req.imageSize || "square_hd",
    });
  } catch (error: any) {
    console.error("Tool router: image generation failed:", error.message);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Video model routing by duration
// ---------------------------------------------------------------------------

const FAL_VIDEO_MODELS: Record<number, { model: string; label: string }> = {
  6: { model: "fal-ai/kling-video/v2/master/text-to-video", label: "Kling v2" },
  15: { model: "fal-ai/minimax-video/video-01/text-to-video", label: "Minimax" },
  30: { model: "fal-ai/minimax-video/video-01/text-to-video", label: "Minimax" },
};

/**
 * Generate a video.
 * Routing strategy:
 *   SPARK/PULSE  → fal.ai (Kling for 6s, Minimax for 15s)
 *   GRID 30s     → Runway Gen-3 Alpha Turbo (if start frame available), fallback to fal.ai
 *   Budget exceeded → fal.ai (cheapest option)
 */
export async function generateVideo(
  req: VideoRequest,
  ctx: ToolContext = DEFAULT_CONTEXT
): Promise<string | null> {
  if (!checkBudget(ctx)) {
    console.warn("Tool router: daily budget exceeded, using cheapest video provider");
  }

  const usePremium =
    PREMIUM_TIERS.has(ctx.tier) &&
    req.durationSec >= 30 &&
    !!req.startFrameUrl &&
    runwayProvider.isAvailable() &&
    checkBudget(ctx);

  // Runway path: premium tier + 30s + start frame available
  if (usePremium) {
    try {
      const url = await runwayProvider.generateVideo({
        promptImage: req.startFrameUrl!,
        promptText: req.prompt,
        duration: req.durationSec >= 10 ? 10 : 5,
      });
      if (url) return url;
      console.log("Tool router: Runway failed, falling back to fal.ai");
    } catch (error: any) {
      console.error("Tool router: Runway video failed:", error.message);
    }
  }

  // fal.ai fallback / default path
  try {
    const modelConfig = FAL_VIDEO_MODELS[req.durationSec] || FAL_VIDEO_MODELS[6];
    return await falProvider.generateVideo({
      model: modelConfig.model,
      prompt: req.prompt,
      duration: req.durationSec <= 6 ? "5" : "10",
      aspect_ratio: "9:16",
    });
  } catch (error: any) {
    console.error("Tool router: fal.ai video failed:", error.message);
    return null;
  }
}

/**
 * Analyze an image using GPT-4o Vision.
 * Always uses gpt-4o regardless of tier (vision requires multimodal model).
 */
export async function analyzeImage(
  req: VisionRequest,
  ctx: ToolContext = DEFAULT_CONTEXT
): Promise<string> {
  return openaiProvider.chatCompletion({
    model: "gpt-4o",
    messages: [
      { role: "system", content: req.systemPrompt },
      {
        role: "user",
        content: [
          { type: "text", text: req.userPrompt },
          { type: "image_url", image_url: { url: req.imageUrl } },
        ],
      },
    ],
    max_tokens: req.maxTokens ?? 400,
  });
}
