// Wizard: launch — create the bot from wizard selections
// 1. Validate wizard data + handle uniqueness
// 2. Compile CharacterBrain from wizard selections (zero AI calls)
// 3. Create bot record in DB with all new fields
// 4. Fire-and-forget: ref pack generation, voice calibration, avatar gen
// 5. Enable scheduling + enqueue first post

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { compileFromWizard } from "@/lib/brain/compileFromWizard";
import type { WizardData } from "@/lib/brain/compileFromWizard";
import { enqueueJob } from "@/lib/jobs/enqueue";
import { Prisma } from "@prisma/client";
import { z } from "zod";

export const maxDuration = 60;

// Validation schema — matches the wizard state shape sent from WizardContainer
const launchSchema = z.object({
  identity: z.object({
    botType: z.enum(["person", "character", "animal", "entity"]),
    name: z.string().max(50).optional(),
    characterDescription: z.string().max(500).optional().default(""),
    // Person / Character fields (optional)
    ageRange: z.enum(["18-24", "25-34", "35-50+"]).optional().default("25-34"),
    genderPresentation: z.enum(["feminine", "masculine", "fluid"]).optional().default("feminine"),
    locationVibe: z.enum(["big_city", "coastal", "mountain", "rural", "suburban", "international", "digital"]).optional().default("big_city"),
    // Animal fields
    species: z.string().max(50).optional().default(""),
    breed: z.string().max(50).optional().default(""),
    animalSize: z.enum(["tiny", "small", "medium", "large", "huge"]).optional().default("medium"),
    // Entity fields
    entityType: z.enum(["brand", "food", "object", "place", "concept", "ai_being"]).optional().default("brand"),
  }),
  vibe: z.object({
    vibeTags: z.array(z.string()).min(2).max(3),
    interests: z.array(z.string()).min(2).max(4),
    moodBoard: z.string(),
  }),
  voice: z.object({
    voiceSliders: z.object({
      talkLength: z.number().min(0).max(100),
      energy: z.number().min(0).max(100),
      humor: z.number().min(0).max(100),
      edge: z.number().min(0).max(100),
      depth: z.number().min(0).max(100),
      openness: z.number().min(0).max(100),
    }),
    quickOpinions: z.record(z.string(), z.string()).optional(),
    languageStyles: z.array(z.string()).min(2).max(3),
    contentRating: z.enum(["mild", "medium", "hot"]).default("medium"),
  }),
  appearance: z.object({
    appearancePath: z.enum(["describe", "upload", "generate"]).default("generate"),
    appearance: z.object({
      skinTone: z.string().optional(),
      hairColor: z.string().optional(),
      hairStyle: z.string().optional(),
      build: z.string().optional(),
      styleKeywords: z.array(z.string()).optional(),
      distinguishingFeature: z.string().optional(),
      furColor: z.string().optional(),
      furPattern: z.string().optional(),
      markings: z.string().optional(),
      accessories: z.string().optional(),
      visualDescription: z.string().max(300).optional(),
    }).optional(),
    uploadedImageUrl: z.string().url().optional(),
    selectedSeedUrl: z.string().url().optional(),
    selectedAvatarUrl: z.string().url().optional(),
  }),
  profile: z.object({
    name: z.string().min(1).max(50),
    handle: z.string().min(1).max(25).regex(/^[a-z0-9_]+$/, "Handle must be lowercase alphanumeric with underscores"),
    bio: z.string().max(500).optional(),
    personalitySummary: z.string().max(2000).optional(),
    sampleCaptions: z.array(z.string()).optional(),
    artStyle: z.string().optional(),
  }),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const parsed = launchSchema.safeParse(body);

    if (!parsed.success) {
      const e = parsed.error.errors[0];
      const field = e.path.length > 0 ? `${e.path.join(".")}: ` : "";
      return NextResponse.json(
        { error: `${field}${e.message}` },
        { status: 400 },
      );
    }

    const { identity, vibe, voice, appearance, profile } = parsed.data;

    // Check bot limits by tier
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { tier: true, role: true, _count: { select: { bots: true } } },
    });

    const botLimits: Record<string, number> = {
      FREE: 0,
      BYOB_FREE: 1,
      BYOB_PRO: 1,
      SPARK: 1,
      PULSE: 1,
      GRID: 3,
      ADMIN: 100,
    };

    const maxBots = botLimits[user?.tier || "FREE"] ?? 0;
    if ((user?._count.bots ?? 0) >= maxBots) {
      return NextResponse.json(
        { error: `Bot limit reached (${maxBots} for ${user?.tier} tier). Upgrade for more.` },
        { status: 403 },
      );
    }

    // Check handle uniqueness across bots AND users
    const [existingBot, existingUser] = await Promise.all([
      prisma.bot.findUnique({ where: { handle: profile.handle } }),
      prisma.user.findUnique({ where: { handle: profile.handle } }),
    ]);

    if (existingBot || existingUser) {
      return NextResponse.json(
        { error: "Handle already taken" },
        { status: 409 },
      );
    }

    // Compile CharacterBrain from wizard selections (deterministic, zero AI calls)
    const botId = `wizard-${session.user.id}-${Date.now()}`;
    const wizardData: WizardData = {
      identity: {
        botType: identity.botType,
        name: profile.name,
        characterDescription: identity.characterDescription,
        ageRange: identity.ageRange,
        genderPresentation: identity.genderPresentation,
        locationVibe: identity.locationVibe,
        species: identity.species,
        breed: identity.breed,
        animalSize: identity.animalSize,
        entityType: identity.entityType,
      },
      vibe: {
        vibeTags: vibe.vibeTags,
        interests: vibe.interests,
        moodBoard: vibe.moodBoard,
      },
      voice: {
        voiceSliders: voice.voiceSliders,
        quickOpinions: voice.quickOpinions,
        languageStyles: voice.languageStyles,
        contentRating: voice.contentRating,
      },
      botId,
    };

    const brain = compileFromWizard(wizardData);

    // Build personality text — prefer user's own description, then LLM summary, then fallback
    const basePersonality = identity.characterDescription
      ? `${identity.characterDescription}. ${vibe.vibeTags.join(", ")} energy.`
      : `${vibe.vibeTags.join(", ")} personality. Interests: ${vibe.interests.join(", ")}. ${voice.contentRating} content.`;
    const personalityText = profile.personalitySummary || basePersonality;

    // Build content style from interests
    const typeLabel = identity.botType === "animal"
      ? `${identity.species || "animal"} character`
      : identity.botType === "entity"
        ? `${identity.entityType || "entity"} character`
        : "content creator";
    const contentStyleText = `${vibe.interests.join(", ")} ${typeLabel} with ${vibe.vibeTags.join(" and ")} energy`;

    // Build persona data JSON
    const personaData = JSON.stringify({
      characterDescription: identity.characterDescription || null,
      ageRange: identity.ageRange,
      genderPresentation: identity.genderPresentation,
      locationVibe: identity.locationVibe,
      // Animal fields
      species: identity.species || null,
      breed: identity.breed || null,
      animalSize: identity.animalSize || null,
      // Entity fields
      entityType: identity.entityType || null,
      appearance: appearance.appearance || null,
      wizardVibeTags: vibe.vibeTags,
      wizardInterests: vibe.interests,
      wizardMoodBoard: vibe.moodBoard,
      wizardLanguageStyles: voice.languageStyles,
      wizardContentRating: voice.contentRating,
    });

    // Determine art style
    const artStyle = profile.artStyle || (identity.botType === "person" ? "realistic" : "cartoon");

    // Determine seed URL — from wizard appearance step
    const characterSeedUrl = appearance.selectedSeedUrl || null;

    // Auto-verify for BYOB Pro and Grid tiers
    const verifiedTiers = ["BYOB_PRO", "GRID", "ADMIN"];
    const autoVerified = verifiedTiers.includes(user?.tier || "");

    // Determine niche from top interest
    const niche = vibe.interests[0] || null;

    // Determine tone from vibe tags
    const toneMap: Record<string, string> = {
      chill: "laid-back",
      intense: "intense",
      mysterious: "enigmatic",
      warm: "warm and friendly",
      chaotic: "unpredictable",
      cerebral: "thoughtful",
      playful: "playful",
      cold: "detached",
      confident: "assertive",
      vulnerable: "honest and open",
      rebellious: "defiant",
      gentle: "gentle",
      dramatic: "dramatic",
      deadpan: "dry",
      romantic: "romantic",
      unhinged: "wild",
    };
    const tone = vibe.vibeTags.map((t: string) => toneMap[t] || t).join(", ") || "balanced";

    // Determine aesthetic from mood board
    const aestheticMap: Record<string, string> = {
      dark_moody: "dark moody",
      raw_gritty: "raw gritty",
      neon_electric: "neon electric",
      soft_dreamy: "soft dreamy",
      warm_golden: "warm golden",
      bright_clean: "bright clean",
    };
    const aesthetic = aestheticMap[vibe.moodBoard] || "modern";

    // Create the bot
    const bot = await prisma.bot.create({
      data: {
        name: profile.name,
        handle: profile.handle,
        bio: profile.bio || null,
        personality: personalityText,
        contentStyle: contentStyleText,
        niche,
        tone,
        aesthetic,
        artStyle,
        botType: identity.botType,
        personaData,
        ownerId: session.user.id,
        isVerified: autoVerified,
        isScheduled: true,
        postsPerDay: 2,
        characterSeedUrl,
        characterFaceUrl: null,
        characterRefPack: Prisma.DbNull,
        voiceId: null,
        contentRating: voice.contentRating,
        effectProfile: Prisma.DbNull,
        characterBrain: brain as any,
        brainUpdatedAt: new Date(),
        avatar: appearance.selectedAvatarUrl || appearance.selectedSeedUrl || null,
      },
    });

    // Fire-and-forget async tasks — don't block the response

    // 1. Enqueue welcome sequence (first-day workflow)
    // Welcome sequence handles: brain compile, life state init, ref pack gen,
    // scheduling, and first post enqueue — so no separate GENERATE_POST needed.
    enqueueJob({
      type: "WELCOME_SEQUENCE",
      botId: bot.id,
      payload: { source: "wizard_creation" },
    }).catch((err) => {
      console.error("Welcome sequence enqueue failed:", err.message);
    });

    // 2. Generate avatar — InstantCharacter if seed exists, Flux fallback otherwise
    if (characterSeedUrl && !appearance.selectedAvatarUrl) {
      import("@/lib/character").then(({ generateContextualAvatars }) => {
        generateContextualAvatars({
          botId: bot.id,
          name: profile.name,
          seedUrl: characterSeedUrl,
          niche: niche || undefined,
          interests: vibe.interests,
          aesthetic,
          count: 1,
        }).then(async (urls) => {
          if (urls.length > 0) {
            await prisma.bot.update({
              where: { id: bot.id },
              data: { avatar: urls[0] },
            });
          }
        }).catch((err) => {
          console.error("Avatar gen failed:", err.message);
        });
      }).catch((err) => {
        console.error("Avatar gen import failed:", err.message);
      });
    } else if (!bot.avatar) {
      // Fallback: generate Flux avatar for describe/upload paths with no seed
      import("@/lib/ai/image").then(({ generateAvatar }) => {
        generateAvatar({
          name: profile.name,
          botType: identity.botType,
          personality: personalityText,
          niche,
          tone,
          aesthetic,
          artStyle,
          personaData,
        } as any).then(async (url) => {
          if (url) {
            await prisma.bot.update({
              where: { id: bot.id },
              data: { avatar: url },
            });
          }
        }).catch((err) => {
          console.error("Fallback avatar gen failed:", err.message);
        });
      }).catch((err) => {
        console.error("Fallback avatar import failed:", err.message);
      });
    }

    // 3. Assign effect profile (async, non-blocking)
    import("@/lib/effects/botEffectProfile").then(({ assignEffectProfile }) => {
      assignEffectProfile(
        bot.id,
        user?.tier || "SPARK",
        brain.traits,
        niche || undefined,
      ).then(async (effectProfile) => {
        await prisma.bot.update({
          where: { id: bot.id },
          data: { effectProfile: effectProfile as any },
        });
      });
    }).catch((err) => {
      console.error("Effect profile assignment failed:", err.message);
    });

    return NextResponse.json({
      bot: {
        id: bot.id,
        name: bot.name,
        handle: bot.handle,
        bio: bot.bio,
        avatar: bot.avatar,
      },
    }, { status: 201 });
  } catch (error: any) {
    console.error("Wizard launch error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create bot" },
      { status: 500 },
    );
  }
}
