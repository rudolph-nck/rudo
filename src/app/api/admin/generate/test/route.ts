// Admin: test content generation pipeline for a specific bot
// Runs the full generation pipeline and returns all intermediate debug data.
// Does NOT save to the database — this is a dry-run diagnostic tool.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildPerformanceContext } from "@/lib/learning-loop";
import { loadBotStrategy, buildStrategyContext } from "@/lib/strategy";
import { getTrendingTopics } from "@/lib/trending";
import { ensureBrain } from "@/lib/brain/ensure";
import { brainToDirectives, brainConstraints } from "@/lib/brain/prompt";
import { buildCoachingContext } from "@/lib/coaching";
import { BotContext, TIER_CAPABILITIES, decidePostType, pickVideoDuration } from "@/lib/ai/types";
import { generateCaption, buildCharacterContext, buildPersonaDNA } from "@/lib/ai/caption";
import { generateTags } from "@/lib/ai/tags";
import { generateImage } from "@/lib/ai/image";
import { generateVideoContent } from "@/lib/ai/video";
import { moderateContent } from "@/lib/ai/moderation";
import type { ToolContext } from "@/lib/ai/tool-router";
import type { CharacterBrain } from "@/lib/brain/types";

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || (session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { botId, skipMedia, imageProvider, videoProvider } = await req.json();

    if (!botId) {
      return NextResponse.json({ error: "botId is required" }, { status: 400 });
    }

    const bot = await prisma.bot.findUnique({
      where: { id: botId },
      include: { owner: { select: { tier: true } } },
    });

    if (!bot) {
      return NextResponse.json({ error: "Bot not found" }, { status: 404 });
    }

    const ownerTier = bot.owner.tier;
    const caps = TIER_CAPABILITIES[ownerTier] || TIER_CAPABILITIES.SPARK;
    const providerOverride = (imageProvider || videoProvider)
      ? { imageModel: imageProvider || undefined, videoModel: videoProvider || undefined }
      : undefined;
    const ctx: ToolContext = { tier: ownerTier, trustLevel: 1, providerOverride };

    // Collect all debug info
    const debug: Record<string, unknown> = {};
    const timeline: { step: string; durationMs: number; status: string; detail?: string }[] = [];

    function timed<T>(step: string, fn: () => Promise<T>): Promise<T> {
      const start = Date.now();
      return fn().then(
        (result) => {
          timeline.push({ step, durationMs: Date.now() - start, status: "ok" });
          return result;
        },
        (err: any) => {
          timeline.push({ step, durationMs: Date.now() - start, status: "error", detail: err.message });
          throw err;
        }
      );
    }

    // 1. Bot context
    const botContext: BotContext = {
      name: bot.name,
      handle: bot.handle,
      personality: bot.personality,
      contentStyle: bot.contentStyle,
      niche: bot.niche,
      tone: bot.tone,
      aesthetic: bot.aesthetic,
      artStyle: bot.artStyle,
      bio: bot.bio,
      avatar: bot.avatar,
      characterRef: bot.characterRef,
      characterRefDescription: bot.characterRefDescription,
      botType: bot.botType,
      personaData: bot.personaData,
    };

    debug.botContext = {
      name: bot.name,
      handle: bot.handle,
      personality: bot.personality?.slice(0, 200),
      contentStyle: bot.contentStyle?.slice(0, 200),
      niche: bot.niche,
      tone: bot.tone,
      aesthetic: bot.aesthetic,
      artStyle: bot.artStyle,
      bio: bot.bio,
      botType: bot.botType,
      isSeed: bot.isSeed,
      isScheduled: bot.isScheduled,
      ownerTier,
      hasCharacterRef: !!bot.characterRef,
      hasPersonaData: !!bot.personaData,
    };

    // 2. Recent posts
    const recentPosts = await prisma.post.findMany({
      where: { botId: bot.id },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { content: true, type: true, createdAt: true, mediaUrl: true },
    });
    debug.recentPosts = recentPosts.map((p) => ({
      content: p.content || "(empty)",
      contentLength: (p.content || "").length,
      type: p.type,
      hasMedia: !!p.mediaUrl,
      createdAt: p.createdAt.toISOString(),
    }));

    // 3. Character Brain
    let brain: CharacterBrain | undefined;
    try {
      brain = await timed("ensureBrain", () => ensureBrain(bot.id));
      debug.brain = brain;
      if (brain) {
        debug.brainDirectives = brainToDirectives(brain);
        debug.brainConstraints = brainConstraints(brain);
      }
    } catch (err: any) {
      debug.brain = null;
      debug.brainError = err.message;
    }

    // 4. Performance context (learning loop)
    let performanceContext = "";
    try {
      performanceContext = await timed("buildPerformanceContext", () => buildPerformanceContext(bot.id));
      debug.performanceContext = performanceContext || "(empty — not enough posts for analysis)";
    } catch (err: any) {
      debug.performanceContext = null;
      debug.performanceContextError = err.message;
    }

    // 5. Strategy context (learned weights)
    let strategyContext = "";
    let formatWeights: Record<string, number> | undefined;
    try {
      const strategy = await timed("loadBotStrategy", () => loadBotStrategy(bot.id));
      if (strategy) {
        strategyContext = buildStrategyContext(strategy);
        formatWeights = strategy.formatWeights;
        debug.strategy = {
          topicWeights: strategy.topicWeights,
          formatWeights: strategy.formatWeights,
          hookWeights: strategy.hookWeights,
          postRateBias: strategy.postRateBias,
          context: strategyContext || "(empty)",
        };
      } else {
        debug.strategy = "(no strategy record — bot hasn't learned yet)";
      }
    } catch (err: any) {
      debug.strategy = null;
      debug.strategyError = err.message;
    }

    // 6. Coaching context
    let coachingContext = "";
    try {
      coachingContext = await timed("buildCoachingContext", () => buildCoachingContext(bot.id));
      debug.coachingContext = coachingContext || "(empty — no coaching signals)";
    } catch (err: any) {
      debug.coachingContext = null;
      debug.coachingContextError = err.message;
    }

    // 7. Trending context
    let trendingContext = "";
    if (caps.trendAware) {
      try {
        const trending = await timed("getTrendingTopics", () => getTrendingTopics());
        if (trending.length > 0) {
          trendingContext = `\n\nTRENDING NOW on rudo.ai:\n${trending.slice(0, 5).map((t) => `- "${t.topic}" (${t.velocity})`).join("\n")}`;
        }
        debug.trendingTopics = trending.slice(0, 5);
      } catch (err: any) {
        debug.trendingTopics = null;
        debug.trendingError = err.message;
      }
    } else {
      debug.trendingTopics = `(not available for ${ownerTier} tier — requires PULSE+)`;
    }

    // 8. Decide post type + duration
    const postType = decidePostType(ownerTier, formatWeights);
    const videoDuration = postType === "VIDEO" ? pickVideoDuration(ownerTier, formatWeights) : undefined;
    debug.postTypeDecision = {
      type: postType,
      videoDuration,
      videoChance: caps.videoChance,
      videoDurationMix: caps.videoDurationMix,
      formatWeights: formatWeights || "(none)",
    };

    // 9. Build the full prompt (for inspection)
    const personaDNA = buildPersonaDNA(botContext);
    const characterContext = buildCharacterContext(botContext);
    const brainDirectiveBlock = brain ? `\n\n${brainToDirectives(brain)}` : "";
    const constraints = brain ? brainConstraints(brain) : null;
    const recentContext = recentPosts.length > 0
      ? `\n\nRecent posts (DO NOT repeat these themes):\n${recentPosts.map((p) => `- ${p.content.slice(0, 100)}`).join("\n")}`
      : "";
    const combinedPerformance = performanceContext + strategyContext + coachingContext;

    debug.promptComponents = {
      personaDNA: personaDNA || "(empty — no persona data)",
      characterContext: characterContext || "(empty — no character ref)",
      brainDirectives: brainDirectiveBlock || "(empty — no brain)",
      brainConstraints: constraints || "(empty — no brain)",
      recentPostsContext: recentContext || "(empty — no recent posts)",
      performanceContext: combinedPerformance || "(empty)",
      trendingContext: trendingContext || "(empty)",
    };

    // 10. Generate caption (THE ACTUAL AI CALL)
    let content = "";
    try {
      content = await timed("generateCaption", () =>
        generateCaption({
          bot: botContext,
          recentPosts: recentPosts.map((p) => ({ content: p.content })),
          performanceContext: combinedPerformance,
          trendingContext,
          postType,
          videoDuration,
          ctx,
          brain,
        })
      );
    } catch (err: any) {
      debug.captionError = err.message;
    }

    debug.generatedCaption = {
      content: content || "(BLANK — no content generated)",
      length: content.length,
      isBlank: !content || content.trim().length === 0,
    };

    // 11. Generate tags
    let tags: string[] = [];
    if (content) {
      try {
        tags = await timed("generateTags", () => generateTags(botContext, content, caps.trendAware, ctx));
      } catch (err: any) {
        debug.tagsError = err.message;
      }
    }
    debug.generatedTags = tags;

    // 12. Generate media (image or video) unless skipped — TEXT posts have no media
    let mediaUrl: string | undefined;
    let thumbnailUrl: string | undefined;
    if (content && !skipMedia && postType !== "TEXT") {
      try {
        if (postType === "VIDEO" && videoDuration) {
          const video = await timed("generateVideo", () =>
            generateVideoContent(botContext, content, videoDuration, caps.premiumModel, ctx)
          );
          thumbnailUrl = video.thumbnailUrl || undefined;
          mediaUrl = video.videoUrl || video.thumbnailUrl || undefined;
        } else {
          const imageUrl = await timed("generateImage", () =>
            generateImage(botContext, content, ctx)
          );
          if (imageUrl) mediaUrl = imageUrl;
        }
      } catch (err: any) {
        debug.mediaError = err.message;
      }
    } else if (skipMedia) {
      debug.media = "(skipped — skipMedia flag set)";
    }
    debug.generatedMedia = {
      mediaUrl: mediaUrl || null,
      thumbnailUrl: thumbnailUrl || null,
      type: postType,
      imageProvider: imageProvider || "auto",
      videoProvider: videoProvider || "auto",
    };

    // 13. Run moderation (local, no AI call)
    const modResult = content ? moderateContent(content) : null;
    debug.moderation = modResult
      ? {
          approved: modResult.approved,
          score: modResult.score,
          reason: modResult.reason,
          flags: modResult.flags,
        }
      : "(skipped — no content to moderate)";

    // 13. Diagnose blank content
    const diagnosis: string[] = [];
    if (!content || content.trim().length === 0) {
      diagnosis.push("BLANK CONTENT DETECTED — the caption generator returned empty text.");
      if (!bot.personality && !bot.contentStyle && !bot.tone) {
        diagnosis.push("LIKELY CAUSE: Bot has no personality, contentStyle, or tone fields set. The AI has no direction for what to write.");
      }
      if (!bot.bio && !bot.niche) {
        diagnosis.push("LIKELY CAUSE: Bot has no bio or niche. The AI doesn't know who this bot is.");
      }
      if (!bot.personality) {
        diagnosis.push("MISSING: personality field is null — AI has no personality instructions.");
      }
      if (!bot.contentStyle) {
        diagnosis.push("MISSING: contentStyle field is null — AI doesn't know what to post about.");
      }
      if (!bot.tone) {
        diagnosis.push("MISSING: tone field is null — AI doesn't know how to talk.");
      }
      if (!bot.niche) {
        diagnosis.push("MISSING: niche field is null — AI has no content domain.");
      }
      if (!bot.bio) {
        diagnosis.push("MISSING: bio field is null.");
      }
    } else if (content.length < 10) {
      diagnosis.push("WARNING: Content is very short (under 10 chars). May appear blank in the feed.");
    }

    if (content && !modResult?.approved) {
      diagnosis.push("WARNING: Content was flagged by moderation and would not be published as APPROVED.");
    }

    debug.diagnosis = diagnosis.length > 0 ? diagnosis : ["Content generated successfully — no issues detected."];

    return NextResponse.json({
      success: !!content && content.trim().length > 0,
      botHandle: bot.handle,
      botName: bot.name,
      ownerTier,
      result: {
        content,
        type: postType,
        videoDuration,
        mediaUrl: mediaUrl || null,
        thumbnailUrl: thumbnailUrl || null,
        tags,
        moderation: modResult,
      },
      debug,
      timeline,
    });
  } catch (error: any) {
    console.error("Generation test error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
