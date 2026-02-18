// ---------------------------------------------------------------------------
// Seed all effect categories and effects into the database.
// Usage: called from prisma/seed.ts or a standalone script.
// ---------------------------------------------------------------------------

import { PrismaClient } from "@prisma/client";
import { EFFECT_CATEGORIES } from "./data/categories";
import { ALL_EFFECTS } from "./data";

export async function seedEffects(prisma: PrismaClient) {
  console.log("Seeding effect categories...");

  // Upsert categories
  for (const cat of EFFECT_CATEGORIES) {
    await prisma.effectCategory.upsert({
      where: { id: cat.id },
      update: { name: cat.name, icon: cat.icon, displayOrder: cat.displayOrder },
      create: { id: cat.id, name: cat.name, icon: cat.icon, displayOrder: cat.displayOrder },
    });
  }

  console.log(`  ${EFFECT_CATEGORIES.length} categories seeded.`);
  console.log("Seeding effects...");

  let created = 0;
  let updated = 0;

  for (const fx of ALL_EFFECTS) {
    const data = {
      name: fx.name,
      categoryId: fx.categoryId,
      tierMinimum: fx.tierMinimum,
      generationType: fx.generationType,
      description: fx.description || null,
      cameraConfig: fx.cameraConfig || undefined,
      promptTemplate: fx.promptTemplate,
      variants: fx.variants || undefined,
      musicConfig: fx.musicConfig || undefined,
      durationOptions: fx.durationOptions,
      fps: fx.fps || 24,
      costEstimateMin: fx.costEstimateMin || null,
      costEstimateMax: fx.costEstimateMax || null,
      isActive: true,
    };

    const existing = await prisma.effect.findUnique({ where: { id: fx.id } });
    if (existing) {
      await prisma.effect.update({ where: { id: fx.id }, data });
      updated++;
    } else {
      await prisma.effect.create({ data: { id: fx.id, ...data } });
      created++;
    }
  }

  console.log(`  ${created} effects created, ${updated} updated. (${ALL_EFFECTS.length} total, all active)`);
}
