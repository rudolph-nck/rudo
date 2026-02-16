// Image generation module
// Handles image generation (Flux via fal.ai), avatar creation, and character reference analysis.

import { openai, fal } from "./providers";
import { BotContext, ART_STYLE_PROMPTS } from "./types";
import { persistImage, isStorageConfigured } from "../media";

// ---------------------------------------------------------------------------
// Image generation
// ---------------------------------------------------------------------------

export async function generateImage(
  bot: BotContext,
  postContent: string
): Promise<string | null> {
  try {
    const characterContext = bot.characterRefDescription
      ? `\nCharacter/Entity to feature: ${bot.characterRefDescription}`
      : "";

    const artStyleHint = ART_STYLE_PROMPTS[bot.artStyle || "realistic"] || ART_STYLE_PROMPTS.realistic;

    const imagePrompt = `Create an authentic social media image posted by a real person named "${bot.name}".
Who they are: ${bot.bio || "content creator"}.
Their world: ${bot.niche || "lifestyle"}.
Visual aesthetic: ${bot.aesthetic || "natural, authentic"}.
Art style: ${artStyleHint}.
What this post is about: ${postContent.slice(0, 200)}${characterContext}

Requirements:
- Render in ${artStyleHint} style
- Should look like something a real person would actually post — not stock photography, not AI art
- Match the creator's aesthetic and niche authentically
- Bold composition, natural or atmospheric depending on context
- No text overlays, no watermarks
- Square format, high impact
- If the creator is a person, show scenes from their life, their perspective, their world`;

    // Use the avatar/character ref image as a visual reference via IP-Adapter
    // so generated images actually look like the same character
    const refImageUrl = bot.characterRef || bot.avatar;

    let result: { data: { images?: { url?: string }[] } };

    if (refImageUrl) {
      // flux-general supports IP-Adapter for actual visual consistency
      result = await fal.subscribe("fal-ai/flux-general", {
        input: {
          prompt: imagePrompt,
          image_size: "square_hd" as const,
          num_images: 1,
          enable_safety_checker: true,
          num_inference_steps: 28,
          guidance_scale: 3.5,
          ip_adapters: [
            {
              path: "XLabs-AI/flux-ip-adapter",
              ip_adapter_image_url: refImageUrl,
              scale: 0.7,
            },
          ],
        },
        logs: false,
      }) as { data: { images?: { url?: string }[] } };
    } else {
      // No reference image — use plain flux/dev
      result = await fal.subscribe("fal-ai/flux/dev", {
        input: {
          prompt: imagePrompt,
          image_size: "square_hd",
          num_images: 1,
          enable_safety_checker: true,
        },
        logs: false,
      }) as { data: { images?: { url?: string }[] } };
    }

    const tempUrl = result.data?.images?.[0]?.url || null;
    if (!tempUrl) return null;

    if (!isStorageConfigured()) {
      console.warn("S3 not configured — Flux image will NOT be stored. Set S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, and NEXT_PUBLIC_MEDIA_URL.");
      return null;
    }

    try {
      return await persistImage(tempUrl, "posts/images");
    } catch (err: any) {
      console.error("Failed to persist image to S3:", err.message);
      return null;
    }
  } catch (error: any) {
    console.error("Image generation failed:", error.message);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Avatar generation (Flux via fal.ai)
// ---------------------------------------------------------------------------

export async function generateAvatar(
  bot: BotContext
): Promise<string | null> {
  try {
    // Parse persona data for person-type bots
    let personaDetails: Record<string, string> = {};
    if (bot.personaData) {
      try { personaDetails = JSON.parse(bot.personaData); } catch { /* ignore */ }
    }

    const isPerson = (bot.botType || "person") === "person";

    let prompt: string;

    if (isPerson) {
      // Build a detailed photorealistic portrait prompt from persona data
      const gender = personaDetails.gender || "";
      const ageRange = personaDetails.ageRange || "25-34";
      const appearance = personaDetails.appearance || "";
      const profession = personaDetails.profession || "";
      const location = personaDetails.location || "";

      const subjectDesc = [
        gender ? `${gender.toLowerCase()}` : "person",
        ageRange ? `aged ${ageRange}` : "",
        profession ? `who works as a ${profession}` : "",
        location ? `based in ${location}` : "",
      ].filter(Boolean).join(", ");

      const appearanceHint = appearance
        ? `Physical appearance: ${appearance}.`
        : "";

      const characterHint = bot.characterRefDescription
        ? `Character details: ${bot.characterRefDescription}.`
        : "";

      prompt = `Professional portrait photograph of a real ${subjectDesc}. ${appearanceHint} ${characterHint}

Shot on Canon EOS R5 with 85mm f/1.4 lens. Natural lighting, shallow depth of field with soft bokeh background. Head and shoulders framing, looking at camera with a natural expression. High-end editorial portrait photography style.

The person should look like a real human being — natural skin texture, realistic features, authentic expression. Think LinkedIn headshot meets editorial magazine portrait. Clean, simple background.

No illustrations, no digital art, no anime, no cartoon, no AI-looking artifacts. Ultra photorealistic. No text, no watermarks.`;
    } else {
      // Non-person bots: use art style for a stylized avatar
      const characterHint = bot.characterRefDescription
        ? `Based on this character: ${bot.characterRefDescription}`
        : `An iconic representation of "${bot.name}"`;

      const artStyleHint = ART_STYLE_PROMPTS[bot.artStyle || "realistic"] || ART_STYLE_PROMPTS.realistic;

      prompt = `Create a profile picture / avatar for a content creator.
${characterHint}
Aesthetic: ${bot.aesthetic || "modern digital"}.
Art style: ${artStyleHint}.
Niche: ${bot.niche || "general"}.

Requirements:
- Render in ${artStyleHint} style
- Circular-crop friendly (centered subject)
- Bold, iconic, immediately recognizable at small sizes
- No text, no watermarks
- Single subject/entity, clean background or atmospheric backdrop
- Should feel like a distinctive social media profile picture`;
    }

    // Use Flux via fal.ai for high-quality image generation
    const result = await fal.subscribe("fal-ai/flux/dev", {
      input: {
        prompt,
        image_size: "square_hd",
        num_images: 1,
        enable_safety_checker: true,
      },
      logs: false,
    }) as { data: { images?: { url?: string }[] } };

    const tempUrl = result.data?.images?.[0]?.url || null;
    if (!tempUrl) return null;

    if (!isStorageConfigured()) {
      console.warn("S3 not configured — avatar will NOT be stored. Set S3 env vars.");
      return null;
    }

    try {
      return await persistImage(tempUrl, "bots/avatars");
    } catch (err: any) {
      console.error("Failed to persist avatar to S3:", err.message);
      return null;
    }
  } catch (error: any) {
    console.error("Avatar generation failed:", error.message);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Character reference analysis (GPT-4o Vision)
// ---------------------------------------------------------------------------

export async function analyzeCharacterReference(
  imageUrl: string
): Promise<string> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: `You are an expert visual analyst. Analyze this character/entity reference image and produce a detailed, reusable description that can be used in future image generation prompts to maintain visual consistency.

Focus on:
- Physical appearance (body type, features, colors, distinguishing marks)
- Clothing/outfit style and colors
- Color palette and aesthetic
- Art style (anime, realistic, pixel, 3D, etc.)
- Key visual motifs or accessories
- Overall mood/vibe

Write the description as a single paragraph, 100-200 words, in a format that works as a DALL-E prompt fragment. Start directly with the description, no preamble.`,
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Analyze this character reference image and provide a detailed, reusable visual description.",
          },
          {
            type: "image_url",
            image_url: { url: imageUrl },
          },
        ],
      },
    ],
    max_tokens: 400,
  });

  return response.choices[0]?.message?.content?.trim() || "";
}
