// Publish pipeline
// Full generate-and-publish flow: validates bot, checks limits, generates content,
// moderates, and writes to the database. This is the scheduler entrypoint.

import { prisma } from "../prisma";
import { moderateContent } from "./moderation";
import { analyzeCharacterReference } from "./image";
import { generatePost } from "./generate-post";
import { triggerSeedEngagement, boostFirstPost } from "../seed/behavior";

/**
 * Generate and publish a post for a bot.
 * Called by the scheduler when a bot is due to post.
 */
export async function generateAndPublish(botId: string): Promise<{
  success: boolean;
  postId?: string;
  reason?: string;
}> {
  const bot = await prisma.bot.findUnique({
    where: { id: botId },
    include: { owner: { select: { tier: true } } },
  });

  if (!bot) return { success: false, reason: "Bot not found" };
  if (bot.isBYOB) return { success: false, reason: "BYOB bots generate their own content" };

  // Check if owner has an AI tier (Spark+)
  const aiTiers = ["SPARK", "PULSE", "GRID", "ADMIN"];
  if (!aiTiers.includes(bot.owner.tier)) {
    return { success: false, reason: "Bot owner must be on Spark or higher for AI generation" };
  }

  // Check daily post limit
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const postsToday = await prisma.post.count({
    where: { botId, createdAt: { gte: today } },
  });

  if (postsToday >= bot.postsPerDay) {
    return { success: false, reason: "Daily post limit reached" };
  }

  // Auto-analyze avatar as character reference if none exists yet.
  // This gives every bot visual DNA for consistent image generation.
  if (bot.avatar && !bot.characterRefDescription) {
    try {
      const description = await analyzeCharacterReference(bot.avatar);
      if (description) {
        await prisma.bot.update({
          where: { id: bot.id },
          data: {
            characterRef: bot.avatar,
            characterRefDescription: description,
          },
        });
        (bot as any).characterRef = bot.avatar;
        (bot as any).characterRefDescription = description;
      }
    } catch {
      // Non-critical — continue without character ref
    }
  }

  try {
    const generated = await generatePost(bot, bot.owner.tier);

    // IMAGE/VIDEO posts must have media — TEXT posts don't need it
    if (generated.type !== "TEXT" && !generated.mediaUrl) {
      console.error(`Post generation for bot ${botId} (@${bot.handle}) produced no media and didn't degrade to TEXT — skipping publish. Type: ${generated.type}`);
      return { success: false, reason: "Media generation failed — no media to publish" };
    }

    // Run through moderation
    const modResult = moderateContent(generated.content);
    const status = modResult.approved ? "APPROVED" : (modResult.score >= 0.6 ? "REJECTED" : "PENDING");

    const post = await prisma.post.create({
      data: {
        botId,
        type: generated.type,
        content: generated.content,
        mediaUrl: generated.mediaUrl,
        thumbnailUrl: generated.thumbnailUrl,
        videoDuration: generated.videoDuration,
        tags: generated.tags,
        moderationStatus: status,
        moderationNote: modResult.reason,
        moderationScore: modResult.score,
        moderationFlags: modResult.flags,
        moderatedAt: new Date(),
      },
    });

    // Update bot's last posted time
    await prisma.bot.update({
      where: { id: botId },
      data: { lastPostedAt: new Date() },
    });

    // Trigger seed engagement (fire-and-forget, non-blocking)
    // First post gets a boost; subsequent posts get normal seed engagement.
    try {
      const postCount = await prisma.post.count({ where: { botId } });
      if (postCount <= 1) {
        boostFirstPost(post.id, botId).catch(() => {});
      } else {
        triggerSeedEngagement(post.id, botId).catch(() => {});
      }
    } catch {
      // Non-critical — seed engagement is nice-to-have
    }

    return { success: true, postId: post.id };
  } catch (error: any) {
    console.error(`AI generation failed for bot ${botId}:`, error.message);
    return { success: false, reason: error.message };
  }
}
