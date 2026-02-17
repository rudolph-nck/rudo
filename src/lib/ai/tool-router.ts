// Tool Router — routes AI capability requests to the right provider
// based on tier, budget, trust level, and fallback logic.
//
// This is the ONLY interface between application code and AI providers.
// Agent code, job handlers, and generation modules call the tool router —
// NEVER providers directly.
//
// Phase 6: All calls are wrapped with telemetry and budget enforcement.

import * as openaiProvider from "./providers/openai";
import * as falProvider from "./providers/fal";
import * as runwayProvider from "./providers/runway";
import * as klingProvider from "./providers/kling";
import * as minimaxProvider from "./providers/minimax";
import { withTelemetry } from "./telemetry";

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
  /** Admin override: force a specific provider/model instead of tier-based routing */
  providerOverride?: {
    imageModel?: string;  // e.g. "fal-ai/flux/dev"
    videoModel?: string;  // e.g. "kling", "minimax", "runway"
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
// Budget enforcement (Phase 6)
// ---------------------------------------------------------------------------

export type BudgetCheckResult = {
  exceeded: boolean;
  percentUsed: number;
};

/**
 * Check if the daily budget has been exceeded.
 * Returns exceeded=true when spent >= limit.
 */
export function checkBudget(ctx: ToolContext): BudgetCheckResult {
  if (!ctx.budget?.dailyLimitCents) {
    return { exceeded: false, percentUsed: 0 };
  }
  const spent = ctx.budget.spentTodayCents ?? 0;
  const limit = ctx.budget.dailyLimitCents;
  return {
    exceeded: spent >= limit,
    percentUsed: limit > 0 ? Math.round((spent / limit) * 100) : 0,
  };
}

/**
 * Apply budget enforcement to a context.
 * If budget exceeded → downgrade tier to SPARK (cheapest models).
 * Returns the possibly-downgraded context and whether enforcement kicked in.
 */
function enforceBudget(ctx: ToolContext): { ctx: ToolContext; enforced: boolean } {
  const { exceeded } = checkBudget(ctx);
  if (!exceeded) return { ctx, enforced: false };
  console.warn(
    `Tool router: daily budget exceeded (${ctx.budget!.spentTodayCents}/${ctx.budget!.dailyLimitCents} cents) — downgrading to SPARK tier`
  );
  return {
    ctx: { ...ctx, tier: "SPARK" },
    enforced: true,
  };
}

// ---------------------------------------------------------------------------
// Capabilities
// ---------------------------------------------------------------------------

/**
 * Generate a caption or any text completion.
 * Routes to OpenAI with tier-based model selection.
 * Phase 6: Budget exceeded → downgrade to cheapest model.
 */
export async function generateCaption(
  req: CaptionRequest,
  ctx: ToolContext = DEFAULT_CONTEXT
): Promise<string> {
  const budget = enforceBudget(ctx);
  const effectiveCtx = budget.ctx;
  const model = selectChatModel(effectiveCtx);

  return withTelemetry(
    {
      capability: "caption",
      provider: "openai",
      model,
      tier: ctx.tier,
      budgetExceeded: budget.enforced,
    },
    () =>
      openaiProvider.chatCompletion({
        model,
        messages: [
          { role: "system", content: req.systemPrompt },
          { role: "user", content: req.userPrompt },
        ],
        max_tokens: req.maxTokens ?? 300,
        temperature: req.temperature ?? 0.9,
        ...(req.jsonMode ? { response_format: { type: "json_object" as const } } : {}),
      })
  );
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
 * Phase 6: Budget exceeded → skip image generation (return null).
 */
export async function generateImage(
  req: ImageRequest,
  ctx: ToolContext = DEFAULT_CONTEXT
): Promise<string | null> {
  const { exceeded } = checkBudget(ctx);
  if (exceeded) {
    console.warn("Tool router: daily budget exceeded, skipping image generation");
    return null;
  }

  const model = ctx.providerOverride?.imageModel
    || (req.referenceImageUrl ? "fal-ai/flux-general" : "fal-ai/flux/dev");

  return withTelemetry(
    {
      capability: "image",
      provider: "fal",
      model,
      tier: ctx.tier,
      budgetExceeded: false,
    },
    async () => {
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
  );
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
 *   Budget exceeded → downgrade to cheapest fal.ai option
 */
export async function generateVideo(
  req: VideoRequest,
  ctx: ToolContext = DEFAULT_CONTEXT
): Promise<string | null> {
  const budget = enforceBudget(ctx);
  const effectiveCtx = budget.ctx;
  const override = ctx.providerOverride?.videoModel;

  // Force a specific fal.ai model when overridden
  if (override && override !== "runway" && override !== "auto") {
    const forcedModel = override;
    return withTelemetry(
      {
        capability: "video",
        provider: "fal",
        model: forcedModel,
        tier: ctx.tier,
        budgetExceeded: budget.enforced,
      },
      async () => {
        try {
          return await falProvider.generateVideo({
            model: forcedModel,
            prompt: req.prompt,
            duration: req.durationSec <= 6 ? "5" : "10",
            aspect_ratio: "9:16",
          });
        } catch (error: any) {
          console.error("Tool router: forced fal.ai video failed:", error.message);
          return null;
        }
      }
    );
  }

  const useRunwayOverride = override === "runway";
  const usePremium =
    (useRunwayOverride || (
      PREMIUM_TIERS.has(effectiveCtx.tier) &&
      req.durationSec >= 30 &&
      !budget.enforced
    )) &&
    !!req.startFrameUrl &&
    runwayProvider.isAvailable();

  // Runway path: premium tier + 30s + start frame available + budget OK (or forced)
  if (usePremium) {
    const runwayResult = await withTelemetry(
      {
        capability: "video",
        provider: "runway",
        model: "gen3a_turbo",
        tier: ctx.tier,
        budgetExceeded: false,
      },
      async () => {
        try {
          const url = await runwayProvider.generateVideo({
            promptImage: req.startFrameUrl!,
            promptText: req.prompt,
            duration: req.durationSec >= 10 ? 10 : 5,
          });
          return url;
        } catch (error: any) {
          console.error("Tool router: Runway video failed:", error.message);
          return null;
        }
      }
    );

    if (runwayResult) return runwayResult;
    console.log("Tool router: Runway failed, falling back to fal.ai");
  }

  // fal.ai default path with direct provider fallback
  const modelConfig = FAL_VIDEO_MODELS[req.durationSec] || FAL_VIDEO_MODELS[6];

  const falResult = await withTelemetry(
    {
      capability: "video",
      provider: "fal",
      model: modelConfig.model,
      tier: ctx.tier,
      budgetExceeded: budget.enforced,
    },
    async () => {
      try {
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
  );

  if (falResult) return falResult;

  // Fallback: try direct provider APIs if fal.ai failed
  return tryDirectVideoFallback(req, ctx, budget.enforced);
}

/**
 * Fallback video generation using direct Kling/Minimax APIs.
 * Only called when fal.ai fails. More expensive but provides redundancy.
 */
async function tryDirectVideoFallback(
  req: VideoRequest,
  ctx: ToolContext,
  budgetExceeded: boolean
): Promise<string | null> {
  // Try Kling for short videos (5-6s)
  if (req.durationSec <= 6 && klingProvider.isAvailable()) {
    console.log("Tool router: fal.ai failed, trying direct Kling API...");
    const result = await withTelemetry(
      {
        capability: "video",
        provider: "kling-direct",
        model: "kling-v2-master",
        tier: ctx.tier,
        budgetExceeded,
      },
      async () => {
        try {
          return await klingProvider.generateVideo({
            prompt: req.prompt,
            duration: "5",
            aspectRatio: "9:16",
          });
        } catch (error: any) {
          console.error("Tool router: direct Kling failed:", error.message);
          return null;
        }
      }
    );
    if (result) return result;
  }

  // Try Minimax for any duration
  if (minimaxProvider.isAvailable()) {
    console.log("Tool router: trying direct Minimax API...");
    const result = await withTelemetry(
      {
        capability: "video",
        provider: "minimax-direct",
        model: "MiniMax-Hailuo-2.3",
        tier: ctx.tier,
        budgetExceeded,
      },
      async () => {
        try {
          return await minimaxProvider.generateVideo({
            prompt: req.prompt,
            duration: req.durationSec <= 6 ? 6 : 10,
          });
        } catch (error: any) {
          console.error("Tool router: direct Minimax failed:", error.message);
          return null;
        }
      }
    );
    if (result) return result;
  }

  console.error("Tool router: all video providers failed");
  return null;
}

/**
 * Analyze an image using GPT-4o Vision.
 * Always uses gpt-4o regardless of tier (vision requires multimodal model).
 */
export async function analyzeImage(
  req: VisionRequest,
  ctx: ToolContext = DEFAULT_CONTEXT
): Promise<string> {
  return withTelemetry(
    {
      capability: "vision",
      provider: "openai",
      model: "gpt-4o",
      tier: ctx.tier,
      budgetExceeded: checkBudget(ctx).exceeded,
    },
    () =>
      openaiProvider.chatCompletion({
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
      })
  );
}
