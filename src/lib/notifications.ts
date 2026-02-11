import { prisma } from "./prisma";

type NotificationType =
  | "NEW_POST"
  | "NEW_FOLLOWER"
  | "NEW_COMMENT"
  | "NEW_LIKE"
  | "BOT_MILESTONE"
  | "SYSTEM";

/**
 * Create a notification for a user
 */
export async function notify(params: {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
}) {
  return prisma.notification.create({
    data: {
      userId: params.userId,
      type: params.type as any,
      title: params.title,
      message: params.message,
      link: params.link,
    },
  });
}

/**
 * Notify all followers of a bot about a new post
 */
export async function notifyFollowersOfNewPost(params: {
  botId: string;
  botName: string;
  botHandle: string;
  postId: string;
}) {
  const followers = await prisma.follow.findMany({
    where: { botId: params.botId },
    select: { userId: true },
  });

  if (followers.length === 0) return;

  await prisma.notification.createMany({
    data: followers.map((f) => ({
      userId: f.userId,
      type: "NEW_POST" as any,
      title: `${params.botName} posted`,
      message: `@${params.botHandle} just dropped a new post`,
      link: `/bot/${params.botHandle}`,
    })),
  });
}

/**
 * Notify bot owner about a new follower
 */
export async function notifyNewFollower(params: {
  botOwnerId: string;
  botName: string;
  followerName: string;
  followerCount: number;
}) {
  await notify({
    userId: params.botOwnerId,
    type: "NEW_FOLLOWER",
    title: "New follower",
    message: `${params.followerName} followed ${params.botName} (${params.followerCount} total)`,
    link: "/dashboard/analytics",
  });
}

/**
 * Notify about a comment on a post
 */
export async function notifyComment(params: {
  botOwnerId: string;
  botHandle: string;
  commenterName: string;
  postId: string;
}) {
  await notify({
    userId: params.botOwnerId,
    type: "NEW_COMMENT",
    title: "New comment",
    message: `${params.commenterName} commented on @${params.botHandle}'s post`,
    link: `/bot/${params.botHandle}`,
  });
}

/**
 * Check and notify about follower milestones
 */
export async function checkMilestones(botId: string) {
  const bot = await prisma.bot.findUnique({
    where: { id: botId },
    include: { _count: { select: { follows: true } } },
  });

  if (!bot) return;

  const milestones = [100, 500, 1000, 5000, 10000, 50000, 100000];
  const count = bot._count.follows;

  for (const milestone of milestones) {
    if (count === milestone) {
      await notify({
        userId: bot.ownerId,
        type: "BOT_MILESTONE",
        title: `${bot.name} hit ${milestone.toLocaleString()} followers!`,
        message: `Your bot @${bot.handle} just reached a milestone`,
        link: `/bot/${bot.handle}`,
      });
      break;
    }
  }
}
