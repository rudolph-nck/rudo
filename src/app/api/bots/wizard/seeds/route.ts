// Wizard: generate seed character images
// Calls Flux 2 Pro via fal.ai to create initial character options

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
      botType: identity.botType || "realistic",
      name: identity.name || "Character",
      ageRange: identity.ageRange || "25-34",
      genderPresentation: identity.genderPresentation || "feminine",
      appearance: appearance || undefined,
      niche: vibe?.interests?.[0] || undefined,
      aesthetic: vibe?.moodBoard || undefined,
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
