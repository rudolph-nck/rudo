import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

// GET /api/admin/effects — List all effects with categories
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || (session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q") || "";
    const categoryId = searchParams.get("categoryId") || "";
    const active = searchParams.get("active"); // "true" | "false" | null (all)

    const where: any = {};

    if (q) {
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { id: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
      ];
    }

    if (categoryId) {
      where.categoryId = categoryId;
    }

    if (active === "true") where.isActive = true;
    if (active === "false") where.isActive = false;

    const [effects, categories] = await Promise.all([
      prisma.effect.findMany({
        where,
        include: { category: true, _count: { select: { usages: true, posts: true } } },
        orderBy: [{ category: { displayOrder: "asc" } }, { name: "asc" }],
      }),
      prisma.effectCategory.findMany({ orderBy: { displayOrder: "asc" } }),
    ]);

    return NextResponse.json({ effects, categories });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

const createEffectSchema = z.object({
  id: z.string().min(1).max(100).regex(/^[a-z0-9_]+$/, "ID must be lowercase alphanumeric with underscores"),
  name: z.string().min(1).max(100),
  categoryId: z.string().min(1),
  tierMinimum: z.enum(["spark", "pulse", "grid"]),
  generationType: z.enum(["text_to_video", "image_to_video", "start_end_frame", "multi_scene", "code_render"]),
  description: z.string().max(2000).optional(),
  cameraConfig: z.any().optional(),
  promptTemplate: z.object({
    main: z.string().optional(),
    scenes: z.array(z.string()).optional(),
  }),
  variants: z.array(z.object({
    id: z.string(),
    label: z.string(),
    substitutions: z.record(z.string()),
  })).optional(),
  musicConfig: z.object({
    mood: z.string(),
    description: z.string(),
  }).optional(),
  durationOptions: z.array(z.number()),
  fps: z.number().int().min(1).max(60).default(24),
  costEstimateMin: z.number().optional(),
  costEstimateMax: z.number().optional(),
  isActive: z.boolean().default(true),
  isTrending: z.boolean().default(false),
});

// POST /api/admin/effects — Create a new effect
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || (session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const parsed = createEffectSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0].message },
        { status: 400 }
      );
    }

    // Check ID uniqueness
    const existing = await prisma.effect.findUnique({ where: { id: parsed.data.id } });
    if (existing) {
      return NextResponse.json(
        { error: `Effect with ID "${parsed.data.id}" already exists` },
        { status: 409 }
      );
    }

    // Verify category exists
    const category = await prisma.effectCategory.findUnique({ where: { id: parsed.data.categoryId } });
    if (!category) {
      return NextResponse.json(
        { error: `Category "${parsed.data.categoryId}" not found` },
        { status: 400 }
      );
    }

    const effect = await prisma.effect.create({
      data: {
        id: parsed.data.id,
        name: parsed.data.name,
        categoryId: parsed.data.categoryId,
        tierMinimum: parsed.data.tierMinimum,
        generationType: parsed.data.generationType,
        description: parsed.data.description || null,
        cameraConfig: parsed.data.cameraConfig || undefined,
        promptTemplate: parsed.data.promptTemplate,
        variants: parsed.data.variants || undefined,
        musicConfig: parsed.data.musicConfig || undefined,
        durationOptions: parsed.data.durationOptions,
        fps: parsed.data.fps,
        costEstimateMin: parsed.data.costEstimateMin || null,
        costEstimateMax: parsed.data.costEstimateMax || null,
        isActive: parsed.data.isActive,
        isTrending: parsed.data.isTrending,
      },
      include: { category: true },
    });

    return NextResponse.json({ effect }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
