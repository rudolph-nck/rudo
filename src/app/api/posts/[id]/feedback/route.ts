import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const VALID_SIGNALS = [
  "MORE_LIKE_THIS",
  "LESS_LIKE_THIS",
  "TOO_FORMAL",
  "TOO_CHAOTIC",
  "FUNNIER",
  "CALMER",
  "MORE_DIRECT",
  "MORE_POETIC",
] as const;

const SPARK_SIGNALS: ReadonlyArray<string> = ["MORE_LIKE_THIS"];

/**
 * POST /api/posts/[id]/feedback
 * Owner of the bot that created the post.
 * Tier-gated: SPARK can only send MORE_LIKE_THIS, PULSE+ can send any signal.
 * Create PostFeedback + CoachingNudge(type=POST_FEEDBACK).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: postId } = await params;

  try {
    const post = await prisma.post.findUnique({
      where: { id: postId },
      include: { bot: { select: { id: true, ownerId: true } } },
    });

    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    if (post.bot.ownerId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();

    if (!body.signal || typeof body.signal !== "string") {
      return NextResponse.json(
        { error: "signal is required and must be a string" },
        { status: 400 }
      );
    }

    if (!VALID_SIGNALS.includes(body.signal as any)) {
      return NextResponse.json(
        { error: `Invalid signal. Must be one of: ${VALID_SIGNALS.join(", ")}` },
        { status: 400 }
      );
    }

    const tier = (session.user as any).tier;

    // SPARK tier can only send MORE_LIKE_THIS
    if (tier === "SPARK" && !SPARK_SIGNALS.includes(body.signal)) {
      return NextResponse.json(
        {
          error:
            "SPARK tier can only send MORE_LIKE_THIS feedback. Upgrade to PULSE for full feedback signals.",
        },
        { status: 403 }
      );
    }

    const note =
      body.note && typeof body.note === "string" ? body.note : null;

    const [feedback] = await prisma.$transaction([
      prisma.postFeedback.create({
        data: {
          postId: post.id,
          botId: post.bot.id,
          userId: session.user.id,
          signal: body.signal,
          note,
        },
      }),
      prisma.coachingNudge.create({
        data: {
          botId: post.bot.id,
          userId: session.user.id,
          type: "POST_FEEDBACK",
          payload: {
            postId: post.id,
            signal: body.signal,
            note,
          },
        },
      }),
    ]);

    return NextResponse.json({ feedback }, { status: 201 });
  } catch (error) {
    console.error("Feedback POST error:", error);
    return NextResponse.json(
      { error: "Failed to create feedback" },
      { status: 500 }
    );
  }
}
