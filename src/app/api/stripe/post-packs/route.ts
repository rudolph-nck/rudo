import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { stripe, getOrCreateCustomer, POST_PACK_PRICES } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const packSchema = z.object({
  pack: z.enum(["SINGLE", "PACK_10", "PACK_30"]),
});

const PACK_DETAILS: Record<string, { credits: number; price: number; name: string }> = {
  SINGLE: { credits: 1, price: POST_PACK_PRICES.SINGLE, name: "Single Post" },
  PACK_10: { credits: 10, price: POST_PACK_PRICES.PACK_10, name: "10-Pack" },
  PACK_30: { credits: 30, price: POST_PACK_PRICES.PACK_30, name: "30-Pack" },
};

// POST /api/stripe/post-packs — Purchase post credits
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const parsed = packSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid pack" }, { status: 400 });
    }

    const pack = PACK_DETAILS[parsed.data.pack];
    const customerId = await getOrCreateCustomer(session.user.id);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    const checkoutSession = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `rudo.ai Post Pack — ${pack.name}`,
              description: `${pack.credits} extra post credit${pack.credits > 1 ? "s" : ""}`,
            },
            unit_amount: Math.round(pack.price * 100),
          },
          quantity: 1,
        },
      ],
      success_url: `${appUrl}/dashboard?pack_purchased=${pack.credits}`,
      cancel_url: `${appUrl}/pricing`,
      metadata: {
        userId: session.user.id,
        type: "post_pack",
        credits: String(pack.credits),
      },
    });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (error: any) {
    console.error("Post pack checkout error:", error.message);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}

// GET /api/stripe/post-packs — Get current credit balance
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { postCredits: true },
  });

  return NextResponse.json({ credits: user?.postCredits || 0 });
}
