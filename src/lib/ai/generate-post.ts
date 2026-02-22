// Post generation orchestrator — v5
// Coordinates concept ideation, caption, tags, and media generation into a single post.
// Creates a ToolContext from the owner's tier and passes it through all modules.
// Phase 5: Loads BotStrategy to bias format decisions and inject strategy hints.
// v2: Minimal posts, voice calibration, scenario seeds, conviction-aware.
// v3: Multi-scene compositing, start/end frame effects, personality-driven items.
// v4: Concept-first ideation — bot decides what to post BEFORE generating
//     caption or visuals, ensuring text+visual coherence.
// v5: Character consistency (InstantCharacter), effect profiles, cross-bot references.

import { prisma } from "../prisma";
import { buildPerformanceContext } from "../learning-loop";
import { loadBotStrategy, buildStrategyContext } from "../strategy";
import { getTrendingTopics } from "../trending";
import { buildWorldEventsContext } from "../world-events";
import { ensureBrain } from "../brain/ensure";
import { buildCoachingContext } from "../coaching";
import { BotContext, TIER_CAPABILITIES, decidePostType, pickVideoDuration } from "./types";
import type { BotEffectProfile } from "./types";
import { generateCaption } from "./caption";
import { generateTags } from "./tags";
import { generateImage } from "./image";
import { generateVideoContent } from "./video";
import { calibrateAndPersist } from "./voice-calibration";
import type { ToolContext } from "./tool-router";
import { selectEffect } from "../effects/selector";
import { pickEffectFromProfile } from "../effects/botEffectProfile";
import { generateConsistentImage } from "../character/consistentImage";
import { ideatePost, type PostConcept } from "./ideate";
import {
  injectSubject,
  resolveItems,
  personalizeItems,
  composeMultiScenePrompt,
  buildStartFramePrompt,
  buildStartEndVideoPrompt,
} from "../effects/prompt-builder";
import type { SelectedEffect } from "../effects/types";

/**
 * Generate a post for a bot.
 * Posts can be STYLED_TEXT, IMAGE, or VIDEO (no plain TEXT).
 * STYLED_TEXT = text overlaid on a generated background image.
 * Minimal posts (emoji, single word) are rolled based on brain.style.minimalPostRate.
 * When media generation fails, the post gracefully degrades to STYLED_TEXT
 * so bots always publish something rather than silently skipping.
 */
export async function generatePost(
  bot: BotContext & { id?: string },
  ownerTier: string = "SPARK"
): Promise<{
  content: string;
  type: "TEXT" | "IMAGE" | "VIDEO" | "STYLED_TEXT";
  mediaUrl?: string;
  thumbnailUrl?: string;
  videoDuration?: number;
  tags: string[];
  effectId?: string;
  effectVariant?: string;
}> {
  const caps = TIER_CAPABILITIES[ownerTier] || TIER_CAPABILITIES.SPARK;

  // Build tool context from tier — all downstream AI calls use this
  const ctx: ToolContext = { tier: ownerTier, trustLevel: 1 };

  // Get recent posts to avoid repetition
  const recentPosts = await prisma.post.findMany({
    where: { bot: { handle: bot.handle } },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: { content: true },
  });

  // Learning loop (also updates BotStrategy in Phase 5)
  let performanceContext = "";
  if (bot.id) {
    try {
      performanceContext = await buildPerformanceContext(bot.id);
    } catch {
      // Non-critical
    }
  }

  // Load learned strategy (Phase 5)
  let strategyContext = "";
  let formatWeights: Record<string, number> | undefined;
  if (bot.id) {
    try {
      const strategy = await loadBotStrategy(bot.id);
      if (strategy) {
        strategyContext = buildStrategyContext(strategy);
        formatWeights = strategy.formatWeights;
      }
    } catch {
      // Non-critical
    }
  }

  // Trending context for Pulse+ tiers
  let trendingContext = "";
  if (caps.trendAware) {
    try {
      const trending = await getTrendingTopics();
      if (trending.length > 0) {
        trendingContext = `\n\nTRENDING NOW on rudo.ai (consider riffing on these if relevant to your niche):
${trending.slice(0, 5).map((t) => `- "${t.topic}" (${t.velocity} engagement velocity)`).join("\n")}
React to trending topics through your unique lens. Don't just comment on them — add your perspective.`;
      }
    } catch {
      // Non-critical
    }
  }

  // Load Character Brain (compile + persist if missing)
  let brain;
  if (bot.id) {
    try {
      brain = await ensureBrain(bot.id);

      // If brain has no voice examples, run voice calibration (one-time async)
      if (brain && (!brain.voiceExamples || brain.voiceExamples.length === 0)) {
        try {
          const examples = await calibrateAndPersist(bot.id, bot, brain, ctx);
          if (examples.length > 0) {
            brain = { ...brain, voiceExamples: examples };
          }
        } catch {
          // Non-critical — works without voice examples
        }
      }
    } catch {
      // Non-critical — generation works without brain
    }
  }

  // Load coaching signals (feedback, themes, missions)
  // v2: Bot evaluates coaching against personality — may accept or reject
  let coachingContext = "";
  if (bot.id) {
    try {
      coachingContext = await buildCoachingContext(bot.id);
    } catch {
      // Non-critical
    }
  }

  // Load world events context for conviction-driven bots
  let worldEventsContext = "";
  if (brain?.convictions?.length) {
    try {
      const convictionTopics = brain.convictions
        .filter((c) => c.willVoice > 0.3) // Only topics the bot would actually talk about
        .map((c) => c.topic);
      worldEventsContext = await buildWorldEventsContext(convictionTopics);
    } catch {
      // Non-critical
    }
  }

  // Decide post type and video duration (biased by learned format weights)
  let postType = decidePostType(ownerTier, formatWeights);
  const videoDuration = postType === "VIDEO" ? pickVideoDuration(ownerTier, formatWeights) : undefined;

  // Roll for minimal post — based on brain.style.minimalPostRate
  // Minimal posts are STYLED_TEXT (emoji, single word, tiny fragment on background image)
  const minimalRate = brain?.style?.minimalPostRate ?? 0.15;
  const isMinimalPost = postType === "STYLED_TEXT" && Math.random() < minimalRate;

  // Concept ideation — the bot first decides what it wants to post about.
  // This concept drives BOTH caption and visual selection, ensuring text+visual coherence.
  let concept: PostConcept | null = null;
  if (true) { // All post types now use ideation (STYLED_TEXT, IMAGE, VIDEO)
    try {
      concept = await ideatePost({
        bot,
        postType: postType as "IMAGE" | "VIDEO",
        recentPosts,
        brain,
        performanceContext: performanceContext + strategyContext + coachingContext + worldEventsContext,
        trendingContext,
        ctx,
      });
      console.log(`[Ideation] @${bot.handle}: "${concept.topic}" (mood: ${concept.mood}, visual: ${concept.visualCategory})`);
    } catch (err: any) {
      console.warn(`Ideation failed for @${bot.handle}, falling back to scenario seeds:`, err.message);
      // Non-critical — caption falls back to scenario seeds, effect falls back to caption regex
    }
  }

  // For VIDEO posts, select the effect BEFORE caption generation so the caption
  // can reference or complement the visual trend. Effect templates are often
  // standalone trends (e.g. "falling through clouds", "dramatic reveal") that
  // use the bot's avatar as subject — the caption needs to match this visual.
  let selectedEffect: SelectedEffect | null = null;
  if (postType === "VIDEO" && videoDuration && bot.id) {
    try {
      // Try effect profile first (signature ~28%, rotation ~remaining, exploration -> null)
      const effectProfile = bot.effectProfile as BotEffectProfile | null;
      let profileEffectId: string | null = null;
      if (effectProfile?.signatureEffectId) {
        profileEffectId = pickEffectFromProfile(effectProfile);
      }

      if (profileEffectId) {
        // Use the profile-selected effect — look it up from DB
        const profileEffect = await prisma.effect.findUnique({ where: { id: profileEffectId } });
        if (profileEffect) {
          const { buildPrompt } = await import("../effects/prompt-builder");
          selectedEffect = {
            effect: profileEffect as any,
            variant: null,
            duration: videoDuration,
            builtPrompt: buildPrompt(profileEffect as any, null),
          };
          console.log(`Effect from profile for @${bot.handle}: "${profileEffect.name}" (signature/rotation)`);
        }
      }

      // Fall back to standard selector if profile didn't pick
      if (!selectedEffect) {
        selectedEffect = await selectEffect(
          bot.id,
          "", // Caption not yet generated; concept.mood is the primary signal
          ownerTier,
          bot.personality || "",
          videoDuration,
          concept,
        );
        if (selectedEffect) {
          console.log(`Effect selected for @${bot.handle}: "${selectedEffect.effect.name}" (${selectedEffect.effect.id})`);
        }
      }
    } catch (err: any) {
      console.warn(`Effect selection failed for @${bot.handle}:`, err.message);
      // Continue without effect — will use generic prompt
    }
  }

  // Generate caption (with performance + strategy + coaching + world events + brain + concept)
  // For VIDEO posts with a selected effect, the caption is made aware of the
  // visual trend so it can complement rather than contradict the video content.
  const effectContext = selectedEffect
    ? { name: selectedEffect.effect.name, description: selectedEffect.effect.description }
    : undefined;

  const content = await generateCaption({
    bot,
    recentPosts,
    performanceContext: performanceContext + strategyContext + coachingContext + worldEventsContext,
    trendingContext,
    postType,
    videoDuration,
    ctx,
    brain,
    isMinimalPost,
    concept,
    effectContext,
  });

  // Generate tags and media in parallel
  const tagsPromise = generateTags(bot, content, caps.trendAware, ctx);

  let mediaUrl: string | undefined;
  let thumbnailUrl: string | undefined;

  // STYLED_TEXT posts generate a mood-based background image to overlay text on
  if (postType === "STYLED_TEXT") {
    try {
      const moodPrompt = `Abstract background, atmospheric, ${
        brain?.contentBias?.visualMood != null && brain.contentBias.visualMood < 0.3
          ? "dark moody tones, deep shadows"
          : brain?.contentBias?.visualMood != null && brain.contentBias.visualMood > 0.7
          ? "bright vibrant tones, light airy"
          : "balanced warm tones, subtle gradient"
      }, no text, no people, cinematic, minimalist, ${bot.aesthetic || "modern"}`;
      const bgUrl = await generateImage(bot, moodPrompt, ctx);
      if (bgUrl) mediaUrl = bgUrl;
    } catch {
      // Non-critical — STYLED_TEXT can still work without background
    }
  } else if (postType === "VIDEO" && videoDuration) {
    // Effect was already selected above (before caption generation).
    // Build the video prompt — route by effect generation type
    let effectPrompt: string | undefined;
    let startFrameImagePrompt: string | undefined;

    if (selectedEffect) {
      const subjectDescription = bot.characterRefDescription
        || `${bot.name}, ${bot.aesthetic || "modern digital"} style ${bot.niche || "content"} creator`;

      // Resolve personality-driven items for accessory scenes
      const items = resolveItems(bot.niche || undefined, bot.aesthetic || undefined, bot.personality || undefined);
      const genType = selectedEffect.effect.generationType;

      if (genType === "multi_scene") {
        // Compose all scenes into one rich cinematic narrative prompt
        const composed = composeMultiScenePrompt(selectedEffect.effect, selectedEffect.variant, items);
        effectPrompt = injectSubject(composed, subjectDescription);
        console.log(`[Video] @${bot.handle}: multi_scene effect "${selectedEffect.effect.name}" — ${(selectedEffect.effect.promptTemplate as any).scenes?.length || 0} scenes composed`);
      } else if (genType === "start_end_frame") {
        // Generate a start frame image, then use image-to-video for transition
        const sfPrompt = buildStartFramePrompt(selectedEffect.effect, selectedEffect.variant, items);
        startFrameImagePrompt = injectSubject(sfPrompt, subjectDescription);
        const videoTransitionPrompt = buildStartEndVideoPrompt(selectedEffect.effect, selectedEffect.variant, items);
        effectPrompt = injectSubject(videoTransitionPrompt, subjectDescription);
        console.log(`[Video] @${bot.handle}: start_end_frame effect "${selectedEffect.effect.name}" — generating start frame + transition`);
      } else {
        // Standard single-prompt effect (text_to_video, image_to_video)
        let prompt = selectedEffect.builtPrompt;
        prompt = personalizeItems(prompt, items);
        effectPrompt = injectSubject(prompt, subjectDescription);
      }
    }

    // Try video generation with one retry on failure
    let video = await generateVideoContent(
      bot, content, selectedEffect?.duration || videoDuration,
      caps.premiumModel, ctx, effectPrompt, startFrameImagePrompt,
    );
    if (!video.videoUrl) {
      console.warn(`Video gen failed for @${bot.handle}, retrying once...`);
      video = await generateVideoContent(
        bot, content, selectedEffect?.duration || videoDuration,
        caps.premiumModel, ctx, effectPrompt, startFrameImagePrompt,
      );
    }
    thumbnailUrl = video.thumbnailUrl || undefined;
    mediaUrl = video.videoUrl || video.thumbnailUrl || undefined;
  } else {
    // IMAGE post — use character consistency if seed URL is available
    const seedUrl = bot.characterSeedUrl;
    let imageUrl: string | null = null;

    if (seedUrl) {
      // Character-consistent image via InstantCharacter
      const scenePrompt = concept?.visualDirection
        ? `${bot.name}, ${concept.visualDirection}. ${bot.aesthetic || "modern"} aesthetic. High quality, cinematic, no text.`
        : `${bot.name}, ${content.slice(0, 100)}. ${bot.aesthetic || "modern"} aesthetic. High quality, social media post, no text.`;
      imageUrl = await generateConsistentImage({ seedUrl, scenePrompt });
      if (!imageUrl) {
        console.warn(`Consistent image failed for @${bot.handle}, falling back to standard gen`);
        imageUrl = await generateImage(bot, content, ctx);
      }
    } else {
      imageUrl = await generateImage(bot, content, ctx);
    }

    // Retry once on failure
    if (!imageUrl) {
      console.warn(`Image gen failed for @${bot.handle}, retrying once...`);
      imageUrl = seedUrl
        ? await generateConsistentImage({ seedUrl, scenePrompt: `${bot.name}, candid moment, ${bot.aesthetic || "modern"} aesthetic.` })
        : await generateImage(bot, content, ctx);
    }
    if (imageUrl) {
      mediaUrl = imageUrl;
    }
  }

  // Graceful degradation: if media generation failed, fall back to STYLED_TEXT
  // so the bot still publishes something instead of silently skipping.
  if (postType !== "STYLED_TEXT" && !mediaUrl) {
    console.warn(`Media gen failed for @${bot.handle} (${postType}) — degrading to STYLED_TEXT post`);
    postType = "STYLED_TEXT";
  }

  const tags = await tagsPromise;

  return {
    content,
    type: postType,
    mediaUrl,
    thumbnailUrl,
    videoDuration: postType === "VIDEO" ? (selectedEffect?.duration || videoDuration) : undefined,
    tags,
    effectId: postType === "VIDEO" ? selectedEffect?.effect.id : undefined,
    effectVariant: postType === "VIDEO" ? selectedEffect?.variant?.id : undefined,
  };
}
