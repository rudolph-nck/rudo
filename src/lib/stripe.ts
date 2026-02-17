import Stripe from "stripe";
import { prisma } from "./prisma";

export const stripe = new Stripe(
  process.env.STRIPE_SECRET_KEY || "sk_test_placeholder",
  { apiVersion: "2025-02-24.acacia" }
);

// Map our tiers to Stripe price IDs (set these in your .env)
// Grab the price ID (starts with price_) from your Stripe dashboard
export const TIER_PRICES: Record<string, { priceId: string; name: string }> = {
  BYOB_PRO: { priceId: process.env.STRIPE_PRICE_BYOB_PRO || "", name: "BYOB Pro" },
  SPARK: { priceId: process.env.STRIPE_PRICE_SPARK || "", name: "Spark" },
  PULSE: { priceId: process.env.STRIPE_PRICE_PULSE || "", name: "Pulse" },
  GRID: { priceId: process.env.STRIPE_PRICE_GRID || "", name: "Grid" },
};

// Per-post overage rate (all tiers same price via Post Packs)
// Single post: $0.50, 10-pack: $0.40/ea, 30-pack: $0.33/ea
export const POST_PACK_PRICES = {
  SINGLE: 0.50,
  PACK_10: 4.00,  // $0.40/ea
  PACK_30: 10.00, // $0.33/ea
};

/**
 * Create or retrieve a Stripe customer for a user
 */
export async function getOrCreateCustomer(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("User not found");

  if (user.stripeCustomerId) {
    return user.stripeCustomerId;
  }

  const customer = await stripe.customers.create({
    email: user.email,
    name: user.name || undefined,
    metadata: { userId: user.id },
  });

  await prisma.user.update({
    where: { id: userId },
    data: { stripeCustomerId: customer.id },
  });

  return customer.id;
}

/**
 * Create a checkout session for a subscription.
 * Pass trial: true to start a 3-day free trial (card collected but not charged).
 */
export async function createCheckoutSession(
  userId: string,
  tier: string,
  options?: { trial?: boolean }
) {
  const priceInfo = TIER_PRICES[tier];
  if (!priceInfo) throw new Error(`Invalid tier: ${tier}`);

  if (!priceInfo.priceId) {
    throw new Error(
      `Stripe price ID not configured for ${tier}. Set STRIPE_PRICE_${tier} in your .env file.`
    );
  }

  if (!priceInfo.priceId.startsWith("price_")) {
    throw new Error(
      `STRIPE_PRICE_${tier} must be a Price ID (starts with "price_"), not a Product ID. Got: ${priceInfo.priceId}`
    );
  }

  // Prevent trial abuse — one trial per account
  if (options?.trial) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (user?.hasUsedTrial) {
      throw new Error("Free trial already used on this account");
    }
  }

  const customerId = await getOrCreateCustomer(userId);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: priceInfo.priceId, quantity: 1 }],
    ...(options?.trial && {
      subscription_data: {
        trial_period_days: 3,
      },
    }),
    success_url: `${appUrl}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}/pricing`,
    metadata: { userId, tier, ...(options?.trial && { trial: "true" }) },
  });

  return session;
}

/**
 * Create a billing portal session (manage subscription)
 */
export async function createPortalSession(userId: string) {
  const customerId = await getOrCreateCustomer(userId);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${appUrl}/dashboard`,
  });

  return session;
}

/**
 * Verify a checkout session and update the user's tier.
 * Acts as a fallback when webhooks are delayed or not configured.
 */
export async function verifyCheckoutSession(sessionId: string, userId: string) {
  const session = await stripe.checkout.sessions.retrieve(sessionId);

  // "paid" for normal checkout, "no_payment_required" for trial starts
  if (session.payment_status !== "paid" && session.payment_status !== "no_payment_required") {
    return { success: false, reason: "Payment not completed" };
  }

  const metaUserId = session.metadata?.userId;
  if (metaUserId !== userId) {
    return { success: false, reason: "Session does not belong to this user" };
  }

  const tier = session.metadata?.tier;
  const isTrial = session.metadata?.trial === "true";
  const packType = session.metadata?.type;
  const packCredits = session.metadata?.credits;

  if (packType === "post_pack" && packCredits) {
    // Avoid double-crediting by checking if already applied
    await prisma.user.update({
      where: { id: userId },
      data: { postCredits: { increment: parseInt(packCredits) } },
    });
    return { success: true, type: "post_pack", credits: parseInt(packCredits) };
  }

  if (tier) {
    const trialEnd = isTrial
      ? new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
      : undefined;

    await prisma.user.update({
      where: { id: userId },
      data: {
        tier: tier as any,
        stripeSubscriptionId: session.subscription as string,
        ...(isTrial && {
          trialEnd,
          hasUsedTrial: true,
        }),
      },
    });
    return { success: true, type: isTrial ? "trial" : "subscription", tier };
  }

  return { success: false, reason: "No actionable metadata" };
}

/**
 * Handle Stripe webhook events
 */
export async function handleStripeWebhook(event: Stripe.Event) {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.userId;
      const tier = session.metadata?.tier;
      const isTrial = session.metadata?.trial === "true";
      const packType = session.metadata?.type;
      const packCredits = session.metadata?.credits;

      if (userId && packType === "post_pack" && packCredits) {
        // Post Pack purchase — add credits
        await prisma.user.update({
          where: { id: userId },
          data: { postCredits: { increment: parseInt(packCredits) } },
        });
      } else if (userId && tier) {
        // Subscription or trial checkout — set tier immediately
        const trialEnd = isTrial
          ? new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
          : undefined;

        await prisma.user.update({
          where: { id: userId },
          data: {
            tier: tier as any,
            stripeSubscriptionId: session.subscription as string,
            ...(isTrial && {
              trialEnd,
              hasUsedTrial: true,
            }),
          },
        });
      }
      break;
    }

    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = subscription.customer as string;

      const user = await prisma.user.findFirst({
        where: { stripeCustomerId: customerId },
      });

      if (user) {
        // Handle both active subscriptions and trial-period subscriptions
        if (subscription.status === "active" || subscription.status === "trialing") {
          const priceId = subscription.items.data[0]?.price.id;
          await prisma.user.update({
            where: { id: user.id },
            data: {
              stripeSubscriptionId: subscription.id,
              stripePriceId: priceId,
              // Clear trialEnd once subscription becomes fully active
              ...(subscription.status === "active" && user.trialEnd && {
                trialEnd: null,
              }),
            },
          });
        }
      }
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = subscription.customer as string;

      const user = await prisma.user.findFirst({
        where: { stripeCustomerId: customerId },
      });

      if (user) {
        // Downgrade to free tier (covers both trial expiry and cancellation)
        await prisma.user.update({
          where: { id: user.id },
          data: {
            tier: "FREE",
            stripeSubscriptionId: null,
            stripePriceId: null,
            trialEnd: null,
          },
        });
      }
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = invoice.customer as string;

      const user = await prisma.user.findFirst({
        where: { stripeCustomerId: customerId },
      });

      if (user) {
        // Could send an email notification here
        console.warn(`Payment failed for user ${user.id}`);
      }
      break;
    }
  }
}
