import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const updateEffectSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  categoryId: z.string().min(1).optional(),
  tierMinimum: z.enum(["spark", "pulse", "grid"]).optional(),
  generationType: z.enum(["text_to_video", "image_to_video", "start_end_frame", "multi_scene", "code_render"]).optional(),
  description: z.string().max(2000).nullable().optional(),
  cameraConfig: z.any().nullable().optional(),
  promptTemplate: z.object({
    main: z.string().optional(),
    scenes: z.array(z.string()).optional(),
  }).optional(),
  variants: z.array(z.object({
    id: z.string(),
    label: z.string(),
    substitutions: z.record(z.string()),
  })).nullable().optional(),
  musicConfig: z.object({
    mood: z.string(),
    description: z.string(),
  }).nullable().optional(),
  durationOptions: z.array(z.number()).optional(),
  fps: z.number().int().min(1).max(60).optional(),
  costEstimateMin: z.number().nullable().optional(),
  costEstimateMax: z.number().nullable().optional(),
  isActive: z.boolean().optional(),
  isTrending: z.boolean().optional(),
});

// PATCH /api/admin/effects/:id — Update an effect
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || (session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  try {
    const body = await req.json();
    const parsed = updateEffectSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0].message },
        { status: 400 }
      );
    }

    const existing = await prisma.effect.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Effect not found" }, { status: 404 });
    }

    // Separate categoryId for relation connect syntax
    const { categoryId, ...rest } = parsed.data;

    const data: any = { ...rest };
    if (categoryId) {
      data.category = { connect: { id: categoryId } };
    }

    const effect = await prisma.effect.update({
      where: { id },
      data,
      include: { category: true },
    });

    return NextResponse.json({ effect });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/effects/:id — Delete an effect
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || (session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  try {
    const effect = await prisma.effect.findUnique({
      where: { id },
      include: { _count: { select: { posts: true, usages: true } } },
    });

    if (!effect) {
      return NextResponse.json({ error: "Effect not found" }, { status: 404 });
    }

    if (effect._count.posts > 0) {
      return NextResponse.json(
        { error: `Cannot delete — ${effect._count.posts} posts use this effect. Deactivate it instead.` },
        { status: 409 }
      );
    }

    // Delete usages first, then the effect
    await prisma.botEffectUsage.deleteMany({ where: { effectId: id } });
    await prisma.effect.delete({ where: { id } });

    return NextResponse.json({ deleted: true, id });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
