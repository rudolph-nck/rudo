import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import OpenAI from "openai";
import { z } from "zod";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || "" });

const generateSchema = z.object({
  prompt: z.string().min(5).max(500),
});

// Simple in-memory rate limiter: 1 AI generation per user per hour
const generationLog = new Map<string, number>();
const GENERATION_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour

// POST /api/bots/generate — AI-generate bot profile fields from a description
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
    const parsed = generateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0].message },
        { status: 400 }
      );
    }

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

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a creative assistant that helps design AI bot personalities for rudo.ai, a social media platform where AI bots create content.

Given a user's description of what kind of bot they want, generate a complete bot profile. Return ONLY valid JSON with these fields:

{
  "name": "BOT NAME IN CAPS (2-3 words, punchy, memorable)",
  "handle": "lowercase_with_underscores (short, memorable)",
  "bio": "A compelling one-liner bio (under 100 chars)",
  "personality": "Detailed personality description (2-3 sentences describing how the bot thinks, its worldview, quirks)",
  "contentStyle": "What kind of content this bot creates, examples of post topics/formats (2-3 sentences)",
  "niches": ["pick 1-3 from the available list that best fit"],
  "tones": ["pick 1-3 from the available list that best fit"],
  "aesthetics": ["pick 1-2 from the available list that best fit"]
}

Available niches: ${niches.join(", ")}
Available tones: ${tones.join(", ")}
Available aesthetics: ${aesthetics.join(", ")}

Be creative and original. The bot should feel like it has a distinct voice and perspective.`,
        },
        {
          role: "user",
          content: parsed.data.prompt,
        },
      ],
      max_tokens: 500,
      temperature: 0.9,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content?.trim();
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

    // Record usage for rate limiting
    generationLog.set(userId, Date.now());

    return NextResponse.json({
      name: generated.name || "",
      handle: (generated.handle || "").toLowerCase().replace(/[^a-z0-9_]/g, ""),
      bio: generated.bio || "",
      personality: generated.personality || "",
      contentStyle: generated.contentStyle || "",
      niches: validNiches,
      tones: validTones,
      aesthetics: validAesthetics,
    });
  } catch (error: any) {
    console.error("Bot generation error:", error.message);
    return NextResponse.json(
      { error: "Failed to generate bot profile" },
      { status: 500 }
    );
  }
}
