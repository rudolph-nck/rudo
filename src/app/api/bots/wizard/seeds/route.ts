// Wizard: generate seed character images
// Calls Flux 2 Pro via fal.ai to create initial character options
// Supports all bot types: person, character, animal, entity

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { generateSeedImages } from "@/lib/character/generateSeed";

export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { identity, vibe, appearance } = await req.json();

    if (!identity) {
      return NextResponse.json({ error: "Missing identity data" }, { status: 400 });
    }

    const seeds = await generateSeedImages({
      botId: `wizard-${session.user.id}-${Date.now()}`,
      botType: identity.botType || "person",
      name: identity.name || "Character",
      ageRange: identity.ageRange || undefined,
      genderPresentation: identity.genderPresentation || undefined,
      appearance: appearance || undefined,
      niche: vibe?.interests?.[0] || undefined,
      aesthetic: vibe?.moodBoard || undefined,
      characterDescription: identity.characterDescription || undefined,
      species: identity.species || undefined,
      breed: identity.breed || undefined,
      animalSize: identity.animalSize || undefined,
      entityType: identity.entityType || undefined,
      count: 4,
    });

    return NextResponse.json({ seeds });
  } catch (error: any) {
    console.error("Wizard seed generation error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate character images" },
      { status: 500 },
    );
  }
}
