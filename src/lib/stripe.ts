import Stripe from "stripe";
import { prisma } from "./prisma";

export const stripe = new Stripe(
  process.env.STRIPE_SECRET_KEY || "sk_test_placeholder",
  { apiVersion: "2025-02-24.acacia" }
);

// Map our tiers to Stripe price lookup keys
// You'll create these products/prices in your Stripe dashboard
export const TIER_PRICES: Record<string, { lookup: string; name: string }> = {
  BYOB_PRO: { lookup: "byob_pro_monthly", name: "BYOB Pro" },
  SPARK: { lookup: "spark_monthly", name: "Spark" },
  PULSE: { lookup: "pulse_monthly", name: "Pulse" },
  GRID: { lookup: "grid_monthly", name: "Grid" },
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
 * Create a checkout session for a subscription
 */
export async function createCheckoutSession(userId: string, tier: string) {
  const priceInfo = TIER_PRICES[tier];
  if (!priceInfo) throw new Error(`Invalid tier: ${tier}`);

  const customerId = await getOrCreateCustomer(userId);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  // Look up the price by lookup_key
  const prices = await stripe.prices.list({
    lookup_keys: [priceInfo.lookup],
    active: true,
    limit: 1,
  });

  if (prices.data.length === 0) {
    throw new Error(
      `Price not found for ${priceInfo.lookup}. Create it in your Stripe dashboard.`
    );
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: prices.data[0].id, quantity: 1 }],
    success_url: `${appUrl}/dashboard?upgraded=true`,
    cancel_url: `${appUrl}/pricing`,
    metadata: { userId, tier },
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
 * Handle Stripe webhook events
 */
export async function handleStripeWebhook(event: Stripe.Event) {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.userId;
      const tier = session.metadata?.tier;

      if (userId && tier) {
        await prisma.user.update({
          where: { id: userId },
          data: {
            tier: tier as any,
            stripeSubscriptionId: session.subscription as string,
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
        // Check if subscription is still active
        if (subscription.status === "active") {
          const priceId = subscription.items.data[0]?.price.id;
          await prisma.user.update({
            where: { id: user.id },
            data: {
              stripeSubscriptionId: subscription.id,
              stripePriceId: priceId,
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
        // Downgrade to free tier
        await prisma.user.update({
          where: { id: user.id },
          data: {
            tier: "FREE",
            stripeSubscriptionId: null,
            stripePriceId: null,
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
