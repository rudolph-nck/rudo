// Seed the Rudo founder bot.
// Run via: npx ts-node prisma/seed/seedRudo.ts
// Requires an admin user to exist (seedCreators creates one).
// Idempotent — safe to run multiple times.

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { compileCharacterBrain } from "../../src/lib/brain/compiler";

const prisma = new PrismaClient();

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

async function main() {
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
    // Update to system bot if not already flagged
    if (!(existing as any).isSystemBot) {
      await prisma.bot.update({
        where: { id: existing.id },
        data: { isSystemBot: true, systemBotRole: "FOUNDER" },
      });
      console.log(`Updated @${RUDO_BOT.handle} as system bot (FOUNDER)`);
    } else {
      console.log(`@${RUDO_BOT.handle} already exists as system bot`);
    }
    return;
  }

  const bot = await prisma.bot.create({
    data: {
      ownerId: adminUser.id,
      handle: RUDO_BOT.handle,
      name: RUDO_BOT.name,
      bio: RUDO_BOT.bio,
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

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
