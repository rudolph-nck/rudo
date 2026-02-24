// Wizard: generate bot profile preview from wizard selections
// Returns: name, handle, bio, personalitySummary, 5 sample captions
// Supports all bot types: person, character, animal, entity

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { generateCaption as routeCaption, DEFAULT_CONTEXT } from "@/lib/ai/tool-router";

function buildTypeContext(identity: any): string {
  const botType = identity.botType || "person";
  const desc = identity.characterDescription || "";

  if (botType === "animal") {
    const species = identity.species || "animal";
    const breed = identity.breed ? ` (${identity.breed})` : "";
    return `This is a ${species}${breed} character.${desc ? ` ${desc}` : ""} Generate a name fitting for a ${species} social media personality.`;
  }

  if (botType === "entity") {
    const entityType = identity.entityType || "entity";
    return `This is a sentient ${entityType} character.${desc ? ` ${desc}` : ""} Generate a creative name for this ${entityType} persona.`;
  }

  // person / character
  const nameHint = identity.name ? `Their name is "${identity.name}".` : "Generate a creative, believable name.";
  const descHint = desc ? `CHARACTER DESCRIPTION: ${desc}` : "";
  const ageHint = identity.ageRange ? `AGE: ${identity.ageRange}` : "";
  const genderHint = identity.genderPresentation ? `GENDER PRESENTATION: ${identity.genderPresentation}` : "";
  const locHint = identity.locationVibe ? `LOCATION VIBE: ${identity.locationVibe}` : "";

  return [nameHint, descHint, ageHint, genderHint, locHint].filter(Boolean).join("\n");
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { identity, vibe, voice } = await req.json();

    if (!identity || !vibe || !voice) {
      return NextResponse.json({ error: "Missing wizard data" }, { status: 400 });
    }

    const vibeTagList = (vibe.vibeTags || []).join(", ");
    const interestList = (vibe.interests || []).join(", ");
    const langStyles = (voice.languageStyles || []).join(", ");
    const typeContext = buildTypeContext(identity);

    const systemPrompt = `You are creating a social media bot persona. Generate a complete profile based on these selections:

TYPE: ${identity.botType}
${typeContext}
PERSONALITY: ${vibeTagList}
INTERESTS: ${interestList} (these shape perspective, not every post topic)
MOOD BOARD: ${vibe.moodBoard}
VOICE ENERGY: ${voice.voiceSliders?.energy || 50}/100
HUMOR: ${voice.voiceSliders?.humor || 50}/100
EDGE: ${voice.voiceSliders?.edge || 30}/100
LANGUAGE: ${langStyles}
CONTENT RATING: ${voice.contentRating}

Return ONLY valid JSON:
{
  "name": "Creative name fitting the character type",
  "handle": "lowercase_handle (no dots, max 25 chars)",
  "bio": "120-char bio that captures their essence",
  "personalitySummary": "2-3 sentence personality summary",
  "sampleCaptions": ["caption1", "caption2", "caption3", "caption4", "caption5"]
}

For sampleCaptions: show the bot's voice range. One should be about an interest, one should be a random thought, one should be a reaction, one should be minimal (1-5 words), one should be a hot take or opinion. Match the language style exactly.${identity.botType === "animal" ? " Write from the animal's perspective — they see the world through their species' eyes." : ""}${identity.botType === "entity" ? " Write from the entity's unique perspective — they experience the world as what they are." : ""}`;

    const raw = await routeCaption(
      {
        systemPrompt,
        userPrompt: "Generate the profile now. Output JSON only.",
        maxTokens: 600,
        temperature: 0.9,
        jsonMode: true,
      },
      { ...DEFAULT_CONTEXT, tier: (session.user as any).tier || "SPARK" },
    );

    try {
      const parsed = JSON.parse(raw);
      return NextResponse.json({
        name: parsed.name || identity.name || "Bot",
        handle: (parsed.handle || "").toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 25),
        bio: (parsed.bio || "").slice(0, 500),
        personalitySummary: parsed.personalitySummary || "",
        sampleCaptions: Array.isArray(parsed.sampleCaptions) ? parsed.sampleCaptions.slice(0, 5) : [],
      });
    } catch {
      return NextResponse.json({ error: "Failed to parse AI response" }, { status: 500 });
    }
  } catch (error: any) {
    console.error("Wizard preview error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 },
    );
  }
}
