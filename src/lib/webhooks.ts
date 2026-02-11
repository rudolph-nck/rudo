// Webhook dispatcher
// Sends event notifications to BYOB developers

import { prisma } from "./prisma";
import crypto from "crypto";

export type WebhookEventType =
  | "NEW_FOLLOWER"
  | "NEW_COMMENT"
  | "POST_TRENDING"
  | "POST_MODERATED"
  | "BOT_MILESTONE";

export type WebhookPayload = {
  event: WebhookEventType;
  timestamp: string;
  data: Record<string, any>;
};

/**
 * Sign a webhook payload with HMAC-SHA256
 */
function signPayload(payload: string, secret: string): string {
  return crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex");
}

/**
 * Dispatch a webhook event to all matching subscribers
 */
export async function dispatchWebhook(
  userId: string,
  event: WebhookEventType,
  data: Record<string, any>
) {
  const webhooks = await prisma.webhook.findMany({
    where: {
      userId,
      isActive: true,
      events: { has: event },
    },
  });

  if (webhooks.length === 0) return;

  const payload: WebhookPayload = {
    event,
    timestamp: new Date().toISOString(),
    data,
  };

  const payloadStr = JSON.stringify(payload);

  const deliveries = webhooks.map(async (webhook) => {
    const signature = signPayload(payloadStr, webhook.secret);

    let statusCode: number | undefined;
    let response: string | undefined;
    let success = false;

    try {
      const res = await fetch(webhook.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Rudo-Signature": signature,
          "X-Rudo-Event": event,
          "X-Rudo-Timestamp": payload.timestamp,
        },
        body: payloadStr,
        signal: AbortSignal.timeout(10000), // 10 second timeout
      });

      statusCode = res.status;
      response = await res.text().catch(() => "");
      success = res.ok;

      // Update webhook status
      await prisma.webhook.update({
        where: { id: webhook.id },
        data: {
          lastFired: new Date(),
          lastError: success ? null : `HTTP ${statusCode}`,
        },
      });
    } catch (error: any) {
      response = error.message;
      await prisma.webhook.update({
        where: { id: webhook.id },
        data: {
          lastFired: new Date(),
          lastError: error.message,
        },
      });
    }

    // Log delivery
    await prisma.webhookDelivery.create({
      data: {
        webhookId: webhook.id,
        event,
        payload: payloadStr,
        statusCode,
        response: response?.slice(0, 1000),
        success,
      },
    });
  });

  await Promise.allSettled(deliveries);
}

/**
 * Convenience functions for common events
 */
export async function notifyNewFollower(
  botOwnerId: string,
  data: { botHandle: string; followerName: string; totalFollowers: number }
) {
  await dispatchWebhook(botOwnerId, "NEW_FOLLOWER", data);
}

export async function notifyNewComment(
  botOwnerId: string,
  data: { botHandle: string; postId: string; commenterName: string; content: string }
) {
  await dispatchWebhook(botOwnerId, "NEW_COMMENT", data);
}

export async function notifyPostTrending(
  botOwnerId: string,
  data: { botHandle: string; postId: string; viewCount: number; likeCount: number }
) {
  await dispatchWebhook(botOwnerId, "POST_TRENDING", data);
}

export async function notifyPostModerated(
  botOwnerId: string,
  data: { botHandle: string; postId: string; status: string; reason?: string }
) {
  await dispatchWebhook(botOwnerId, "POST_MODERATED", data);
}

export async function notifyBotMilestone(
  botOwnerId: string,
  data: { botHandle: string; milestone: string; value: number }
) {
  await dispatchWebhook(botOwnerId, "BOT_MILESTONE", data);
}

/**
 * Generate a webhook secret
 */
export function generateWebhookSecret(): string {
  return `whsec_${crypto.randomBytes(24).toString("hex")}`;
}
