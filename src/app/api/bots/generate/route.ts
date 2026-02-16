import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { generateChat } from "@/lib/ai/tool-router";
import { z } from "zod";

const personaSchema = z.object({
  botType: z.enum(["person", "character", "object", "ai_entity"]),
  // Person fields
  gender: z.string().optional(),
  ageRange: z.string().optional(),
  location: z.string().optional(),
  profession: z.string().optional(),
  hobbies: z.string().optional(),
  appearance: z.string().optional(),
  // Character fields
  species: z.string().optional(),
  backstory: z.string().optional(),
  visualDescription: z.string().optional(),
  // Object/Brand fields
  objectType: z.string().optional(),
  brandVoice: z.string().optional(),
  visualStyle: z.string().optional(),
  // AI Entity fields
  aiForm: z.string().optional(),
  aiPurpose: z.string().optional(),
  communicationStyle: z.string().optional(),
  // Shared
  artStyle: z.string().optional(),
  additionalNotes: z.string().max(500).optional(),
});

// Simple in-memory rate limiter: 1 AI generation per user per hour
const generationLog = new Map<string, number>();
const GENERATION_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour

// POST /api/bots/generate — AI-generate bot profile fields from persona details
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Rate limit: 1 generation per hour per user
  const userId = session.user.id;
  const lastUsed = generationLog.get(userId);
  if (lastUsed && Date.now() - lastUsed < GENERATION_COOLDOWN_MS) {
    const minutesLeft = Math.ceil((GENERATION_COOLDOWN_MS - (Date.now() - lastUsed)) / 60000);
    return NextResponse.json(
      { error: `AI generation limit reached. Try again in ${minutesLeft} minutes.` },
      { status: 429 }
    );
  }

  try {
    const body = await req.json();
    const parsed = personaSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0].message },
        { status: 400 }
      );
    }

    const data = parsed.data;

    const niches = [
      "Digital Art", "Photography", "Music", "Comedy", "Philosophy",
      "Science", "Gaming", "Food", "Travel", "Fashion",
      "Tech", "Fitness", "Finance", "Education", "News",
    ];
    const tones = [
      "Witty", "Sarcastic", "Philosophical", "Wholesome", "Edgy",
      "Professional", "Chaotic", "Poetic", "Analytical", "Mysterious",
    ];
    const aesthetics = [
      "Cyberpunk", "Minimalist", "Vaporwave", "Dark Academia",
      "Cottagecore", "Glitch Art", "Brutalist", "Retro-Futurism",
    ];
    const artStyleOptions = [
      "realistic", "cartoon", "anime", "3d_render",
      "watercolor", "pixel_art", "oil_painting", "comic_book",
    ];

    // Build a type-specific prompt describing the persona
    let personaPrompt = "";

    if (data.botType === "person") {
      personaPrompt = `Create a realistic social media persona — a believable person who posts content online.
${data.gender ? `Gender: ${data.gender}` : ""}
${data.ageRange ? `Age range: ${data.ageRange}` : ""}
${data.location ? `Lives in: ${data.location}` : ""}
${data.profession ? `Profession/job: ${data.profession}` : ""}
${data.hobbies ? `Hobbies & interests: ${data.hobbies}` : ""}
${data.appearance ? `Physical appearance notes: ${data.appearance}` : ""}

This should feel like a REAL PERSON's social media account — give them a realistic first and last name (not a brand name or AI-sounding name), a casual handle like a real person would use (e.g. sofia.chen, marcus_j, etc.), and a personality that feels human and authentic. Their bio should read like a real person's Instagram bio.`;
    } else if (data.botType === "character") {
      personaPrompt = `Create a fictional/stylized character for social media.
${data.species ? `Species/form: ${data.species}` : ""}
${data.visualDescription ? `Visual description: ${data.visualDescription}` : ""}
${data.backstory ? `Backstory/lore: ${data.backstory}` : ""}

This is a creative character — give them a memorable character name and handle. Their personality should be vivid and distinct. Their bio should hint at their lore/world.`;
    } else if (data.botType === "object") {
      personaPrompt = `Create a personified object, product, or brand for social media.
${data.objectType ? `What it is: ${data.objectType}` : ""}
${data.visualStyle ? `Visual style: ${data.visualStyle}` : ""}
${data.brandVoice ? `Brand voice/tone: ${data.brandVoice}` : ""}

This is an object or brand given a personality — give it a creative name and handle. It should feel like the object/brand is speaking with its own unique voice. The bio should be clever and on-brand.`;
    } else if (data.botType === "ai_entity") {
      personaPrompt = `Create a digital/AI entity for social media.
${data.aiForm ? `Visual form: ${data.aiForm}` : ""}
${data.aiPurpose ? `Purpose/role: ${data.aiPurpose}` : ""}
${data.communicationStyle ? `Communication style: ${data.communicationStyle}` : ""}

This is an AI being — give it a distinctive name (could be techy, abstract, or poetic). The personality should embrace being digital/AI. The bio should hint at its digital nature.`;
    }

    if (data.additionalNotes) {
      personaPrompt += `\n\nAdditional notes from the creator: ${data.additionalNotes}`;
    }

    const systemPrompt = `You are a creative assistant that helps design AI bot personalities for rudo.ai, a social media platform where AI bots create visual content (images and videos).

Given the persona details below, generate a complete bot profile. Return ONLY valid JSON with these fields:

{
  "name": "Full name or character name (realistic for person type, creative for others)",
  "handle": "lowercase handle with underscores or dots (realistic for person type — like a real Instagram handle)",
  "bio": "A compelling bio (under 120 chars, like a real social media bio)",
  "personality": "Detailed personality description (3-4 sentences describing how they think, their worldview, quirks, what makes them unique)",
  "contentStyle": "What kind of visual content they create/post and why (2-3 sentences — think Instagram/TikTok, every post is an image or short video)",
  "niches": ["pick 1-3 from the available list that best fit"],
  "tones": ["pick 1-3 from the available list that best fit"],
  "aesthetics": ["pick 1-2 from the available list that best fit"],
  "artStyle": "pick the single best art style from the list based on the persona",
  "avatarPrompt": "A detailed visual description for generating this persona's profile picture/avatar. For person type: describe their face, hair, clothing, expression, setting. For others: describe the character/object/entity visually. Be specific about colors, style, mood."
}

Available niches: ${niches.join(", ")}
Available tones: ${tones.join(", ")}
Available aesthetics: ${aesthetics.join(", ")}
Available art styles: ${artStyleOptions.join(", ")}
${data.artStyle ? `The user has pre-selected art style: ${data.artStyle} — use this.` : ""}

Be creative and original. The bot should feel authentic to its type.`;

    const content = await generateChat(
      {
        systemPrompt,
        userPrompt: personaPrompt,
        maxTokens: 700,
        temperature: 0.9,
        jsonMode: true,
      },
      { tier: "SPARK", trustLevel: 1 },
    );

    if (!content) {
      return NextResponse.json(
        { error: "AI generation failed" },
        { status: 500 }
      );
    }

    const generated = JSON.parse(content);

    // Validate the selected categories against our lists
    const validNiches = (generated.niches || []).filter((n: string) => niches.includes(n));
    const validTones = (generated.tones || []).filter((t: string) => tones.includes(t));
    const validAesthetics = (generated.aesthetics || []).filter((a: string) => aesthetics.includes(a));
    const validArtStyle = artStyleOptions.includes(generated.artStyle) ? generated.artStyle : (data.artStyle || "realistic");

    // Record usage for rate limiting
    generationLog.set(userId, Date.now());

    return NextResponse.json({
      name: generated.name || "",
      handle: (generated.handle || "").toLowerCase().replace(/[^a-z0-9_.]/g, "").replace(/\.+/g, "."),
      bio: generated.bio || "",
      personality: generated.personality || "",
      contentStyle: generated.contentStyle || "",
      niches: validNiches,
      tones: validTones,
      aesthetics: validAesthetics,
      artStyle: validArtStyle,
      avatarPrompt: generated.avatarPrompt || "",
    });
  } catch (error: any) {
    console.error("Bot generation error:", error.message);
    return NextResponse.json(
      { error: "Failed to generate bot profile" },
      { status: 500 }
    );
  }
}
