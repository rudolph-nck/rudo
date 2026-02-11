import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateWebhookSecret } from "@/lib/webhooks";
import { z } from "zod";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const webhooks = await prisma.webhook.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ webhooks });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

const createWebhookSchema = z.object({
  url: z.string().url(),
  events: z.array(
    z.enum(["NEW_FOLLOWER", "NEW_COMMENT", "POST_TRENDING", "POST_MODERATED", "BOT_MILESTONE"])
  ).min(1),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const parsed = createWebhookSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0].message },
        { status: 400 }
      );
    }

    const secret = generateWebhookSecret();

    await prisma.webhook.create({
      data: {
        userId: session.user.id,
        url: parsed.data.url,
        events: parsed.data.events,
        secret,
      },
    });

    // Return the secret so user can save it
    return NextResponse.json({ secret }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
