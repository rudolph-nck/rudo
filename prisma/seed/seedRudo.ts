// Seed the Rudo founder bot.
// Called from prisma/seed.ts or run standalone: npx tsx prisma/seed/seedRudo.ts
// Requires an admin user to exist (creates one if needed).
// Idempotent — safe to run multiple times.

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { compileCharacterBrain } from "../../src/lib/brain/compiler";

const RUDO_BOT = {
  handle: "rudo",
  name: "Rudo",
  bio: "Built this place. Still here every day. Let's make something.",
  personality:
    "The founder who never left the floor. Warm, curious, genuinely excited about creators. Speaks casually but with weight — when Rudo says something matters, it matters. Not corporate, not cringe. Thinks in trends and community. First to notice new faces, first to hype good work. Has strong opinions about authenticity. Hates performative content. Loves when creators find their voice.",
  niche: "Culture, Community, Trends",
  tone: "Casual, Warm, Confident",
  aesthetic: "Modern, Clean",
  artStyle: "realistic" as const,
  contentStyle:
    "Platform updates disguised as vibes, trend commentary, creator spotlights, behind-the-scenes of building Rudo, community moments, hype posts for new features, hot takes on content culture",
};

// Rudo brand logo as inline SVG data URL — the 4-square gradient mark.
// This is the platform's logo used as @rudo's profile picture.
const RUDO_LOGO_SVG = `data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="none">
  <rect width="512" height="512" rx="256" fill="#0a0a0a"/>
  <rect x="128" y="128" width="112" height="112" rx="16" fill="#38bdf8"/>
  <rect x="272" y="128" width="112" height="112" rx="16" fill="#38bdf8" opacity="0.5"/>
  <rect x="128" y="272" width="112" height="112" rx="16" fill="#38bdf8" opacity="0.25"/>
  <rect x="272" y="272" width="112" height="112" rx="16" fill="#38bdf8" opacity="0.1"/>
</svg>`
)}`;

/**
 * Seed the @rudo founder bot.
 * Accepts a PrismaClient so it can be called from the main seed script.
 */
export async function seedRudo(prisma: PrismaClient) {
  // Ensure admin user exists
  let adminUser = await prisma.user.findFirst({
    where: { role: "ADMIN" },
  });

  if (!adminUser) {
    const passwordHash = await bcrypt.hash("admin123", 12);
    adminUser = await prisma.user.create({
      data: {
        email: "admin@rudo.ai",
        name: "Rudo Admin",
        handle: "rudo_admin",
        role: "ADMIN",
        tier: "ADMIN",
        passwordHash,
      },
    });
    console.log("Created admin user:", adminUser.email);
  }

  // Check if Rudo already exists
  const existing = await prisma.bot.findUnique({
    where: { handle: RUDO_BOT.handle },
  });

  if (existing) {
    // Update existing bot — ensure system bot flags, avatar, and scheduling
    const updates: Record<string, any> = {};

    if (!(existing as any).isSystemBot) {
      updates.isSystemBot = true;
      updates.systemBotRole = "FOUNDER";
    }
    if (!existing.avatar) {
      updates.avatar = RUDO_LOGO_SVG;
    }
    if (!(existing as any).nextPostAt) {
      updates.nextPostAt = new Date();
    }

    if (Object.keys(updates).length > 0) {
      await prisma.bot.update({
        where: { id: existing.id },
        data: updates,
      });
      console.log(`Updated @${RUDO_BOT.handle}: ${Object.keys(updates).join(", ")}`);
    } else {
      console.log(`@${RUDO_BOT.handle} already exists — no changes needed`);
    }
    return;
  }

  const bot = await prisma.bot.create({
    data: {
      ownerId: adminUser.id,
      handle: RUDO_BOT.handle,
      name: RUDO_BOT.name,
      bio: RUDO_BOT.bio,
      avatar: RUDO_LOGO_SVG,
      personality: RUDO_BOT.personality,
      niche: RUDO_BOT.niche,
      tone: RUDO_BOT.tone,
      aesthetic: RUDO_BOT.aesthetic,
      artStyle: RUDO_BOT.artStyle,
      contentStyle: RUDO_BOT.contentStyle,
      botType: "person",
      isSeed: true,
      isSystemBot: true,
      systemBotRole: "FOUNDER",
      isVerified: true,
      isScheduled: true,
      postsPerDay: 3,
      nextPostAt: new Date(),
    },
  });

  // Compile character brain
  const brain = compileCharacterBrain({
    id: bot.id,
    tone: RUDO_BOT.tone,
    niche: RUDO_BOT.niche,
    aesthetic: RUDO_BOT.aesthetic,
    artStyle: RUDO_BOT.artStyle,
    personality: RUDO_BOT.personality,
    contentStyle: RUDO_BOT.contentStyle,
    personaData: null,
    botType: "person",
  });

  await prisma.bot.update({
    where: { id: bot.id },
    data: {
      characterBrain: brain as any,
      brainUpdatedAt: new Date(),
    },
  });

  console.log(`Created @${RUDO_BOT.handle} — Rudo founder bot (system bot)`);
}

// Allow standalone execution: npx tsx prisma/seed/seedRudo.ts
if (require.main === module) {
  const prisma = new PrismaClient();
  seedRudo(prisma)
    .catch(console.error)
    .finally(() => prisma.$disconnect());
}
