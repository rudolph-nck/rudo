// Voice creation module — ElevenLabs Voice Design API
// Creates a unique synthetic voice for each bot based on their persona.
// Used for talking head videos (HeyGen) and audio content.
//
// Requires ELEVENLABS_API_KEY env var.

const ELEVENLABS_API_URL = "https://api.elevenlabs.io/v1";

export interface VoiceDesignParams {
  genderPresentation: "feminine" | "masculine" | "fluid";
  ageRange: "18-24" | "25-34" | "35-50+";
  traits?: {
    warmth?: number;     // 0-1
    confidence?: number; // 0-1
    energy?: number;     // 0-1 (from voiceSliders)
    humor?: number;      // 0-1
  };
  accent?: string;
  name: string; // Bot name, used as voice label
}

export interface CreatedVoice {
  voiceId: string;
  previewUrl?: string;
}

// ---------------------------------------------------------------------------
// Gender/age -> ElevenLabs voice parameters
// ---------------------------------------------------------------------------

function mapGender(genderPresentation: string): string {
  switch (genderPresentation) {
    case "feminine": return "female";
    case "masculine": return "male";
    default: return "neutral";
  }
}

function mapAge(ageRange: string): string {
  switch (ageRange) {
    case "18-24": return "young";
    case "25-34": return "middle_aged";
    case "35-50+": return "old";
    default: return "middle_aged";
  }
}

function buildVoiceDescription(params: VoiceDesignParams): string {
  const parts: string[] = [];

  if (params.traits) {
    if (params.traits.warmth && params.traits.warmth > 0.7) {
      parts.push("warm and friendly");
    } else if (params.traits.warmth && params.traits.warmth < 0.3) {
      parts.push("cool and measured");
    }

    if (params.traits.confidence && params.traits.confidence > 0.7) {
      parts.push("confident and clear");
    }

    if (params.traits.energy && params.traits.energy > 0.7) {
      parts.push("energetic and dynamic");
    } else if (params.traits.energy && params.traits.energy < 0.3) {
      parts.push("calm and relaxed");
    }

    if (params.traits.humor && params.traits.humor > 0.7) {
      parts.push("with a hint of playfulness");
    }
  }

  if (parts.length === 0) {
    parts.push("natural and conversational");
  }

  return `A ${parts.join(", ")} voice suitable for social media content`;
}

// ---------------------------------------------------------------------------
// API interaction
// ---------------------------------------------------------------------------

function getApiKey(): string {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) throw new Error("ELEVENLABS_API_KEY not configured");
  return key;
}

/**
 * Create a unique synthetic voice using ElevenLabs Voice Design API.
 * This is a one-time operation during bot creation.
 *
 * @param params - Voice design parameters from bot persona
 * @returns Created voice ID and optional preview URL
 */
export async function createVoice(
  params: VoiceDesignParams,
): Promise<CreatedVoice> {
  const apiKey = getApiKey();

  const gender = mapGender(params.genderPresentation);
  const age = mapAge(params.ageRange);
  const description = buildVoiceDescription(params);

  // Use the Voice Design endpoint to generate a new voice
  const response = await fetch(`${ELEVENLABS_API_URL}/voice-generation/generate-voice`, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      gender,
      age,
      accent: params.accent || "american",
      accent_strength: 1.0,
      text: description,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "unknown error");
    throw new Error(`ElevenLabs voice generation failed (${response.status}): ${errorText}`);
  }

  // The response contains audio preview and generated_voice_id
  const data = await response.json();
  const voiceId = data.generated_voice_id;

  if (!voiceId) {
    throw new Error("ElevenLabs returned no voice ID");
  }

  // Save the voice with the bot's name as label
  await fetch(`${ELEVENLABS_API_URL}/voice-generation/create-voice`, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      generated_voice_id: voiceId,
      voice_name: `rudo_${params.name.toLowerCase().replace(/\s+/g, "_")}`,
      voice_description: description,
    }),
  });

  return {
    voiceId,
    previewUrl: data.audio_url || undefined,
  };
}

/**
 * Check if ElevenLabs is configured and available.
 */
export function isVoiceAvailable(): boolean {
  return !!process.env.ELEVENLABS_API_KEY;
}

/**
 * Generate speech audio from text using a bot's voice.
 *
 * @param voiceId - The bot's ElevenLabs voice ID
 * @param text - The text to convert to speech
 * @returns Audio URL or null on failure
 */
export async function generateSpeech(
  voiceId: string,
  text: string,
): Promise<ArrayBuffer | null> {
  try {
    const apiKey = getApiKey();

    const response = await fetch(
      `${ELEVENLABS_API_URL}/text-to-speech/${voiceId}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text,
          model_id: "eleven_turbo_v2_5",
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0.3,
          },
        }),
      },
    );

    if (!response.ok) {
      console.error(`ElevenLabs TTS failed (${response.status})`);
      return null;
    }

    return await response.arrayBuffer();
  } catch (error: any) {
    console.error("Speech generation failed:", error.message);
    return null;
  }
}
