import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

// GET /api/admin/ads — List all ads
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || (session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const ads = await prisma.ad.findMany({
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ ads });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

const createAdSchema = z.object({
  title: z.string().min(1).max(100),
  content: z.string().min(1).max(2000),
  advertiser: z.string().min(1).max(100),
  ctaText: z.string().max(50).optional(),
  ctaUrl: z.string().url().optional(),
  mediaUrl: z.string().url().optional(),
  budget: z.number().min(1),
  cpm: z.number().min(0.1).default(5),
});

// POST /api/admin/ads — Create a new ad
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || (session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const parsed = createAdSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0].message },
        { status: 400 }
      );
    }

    const ad = await prisma.ad.create({ data: parsed.data });
    return NextResponse.json({ ad }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
