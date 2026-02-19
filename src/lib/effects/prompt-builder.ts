// ---------------------------------------------------------------------------
// Effect Prompt Builder — substitutes [SUBJECT], [ITEM_*], and variant
// placeholders into effect prompt templates.
//
// Handles three generation types:
//   text_to_video / image_to_video → single prompt via buildPrompt()
//   multi_scene   → all scenes composed into one cinematic narrative
//   start_end_frame → start/end frame descriptions + transition prompt
// ---------------------------------------------------------------------------

import type { EffectRecord, EffectVariant, CameraConfig } from "./types";

// ---------------------------------------------------------------------------
// Personality → item mapping
// Maps niche/aesthetic keywords to specific items for accessory scenes.
// When an effect references generic items like [ITEM_FEET], [ITEM_WRIST],
// [ITEM_NECK], or [ITEM_FACE], these get replaced with items that match
// the bot's personality.
// ---------------------------------------------------------------------------

type ItemSet = {
  feet: string;
  wrist: string;
  neck: string;
  face: string;
  extra: string;
};

const NICHE_ITEMS: Record<string, ItemSet> = {
  // Fashion & luxury
  fashion:     { feet: "designer stiletto heels",        wrist: "diamond-studded Cartier bracelet", neck: "layered gold chains with pendant",       face: "oversized Balenciaga sunglasses", extra: "designer handbag" },
  luxury:      { feet: "red-bottom Louboutin heels",     wrist: "rose gold Rolex Daytona",          neck: "Van Cleef Alhambra necklace",            face: "Tom Ford aviator sunglasses",      extra: "Birkin bag" },
  streetwear:  { feet: "rare Air Jordan 1 Retro sneakers", wrist: "iced-out Cuban link bracelet",   neck: "heavy Cuban link chain",                 face: "Chrome Hearts eyewear",            extra: "Supreme shoulder bag" },

  // Tech & gaming
  tech:        { feet: "clean white minimalist sneakers", wrist: "Apple Watch Ultra with orange band", neck: "AirPods Max headphones around neck",  face: "AR smart glasses",                 extra: "mechanical keyboard" },
  gaming:      { feet: "RGB-lit gaming sneakers",         wrist: "gaming smartwatch with stats",     neck: "gaming headset around neck",              face: "blue-light gaming glasses",         extra: "custom controller" },

  // Fitness & sports
  fitness:     { feet: "Nike Metcon training shoes",      wrist: "Garmin fitness tracker",           neck: "wireless sport earbuds",                 face: "sport sunglasses",                 extra: "resistance bands" },
  sports:      { feet: "cleats with fresh turf",          wrist: "sports watch with heart rate",     neck: "championship medal on ribbon",            face: "Oakley sport visor",               extra: "equipment bag" },

  // Music & art
  music:       { feet: "vintage leather Chelsea boots",   wrist: "leather cuff bracelet with studs", neck: "layered silver chains with guitar pick",  face: "round John Lennon sunglasses",     extra: "guitar case" },
  art:         { feet: "paint-splattered canvas shoes",   wrist: "beaded handmade bracelet",         neck: "vintage locket necklace",                face: "round tortoiseshell glasses",       extra: "sketchbook" },

  // Food & lifestyle
  food:        { feet: "classic Birkenstock clogs",       wrist: "simple leather-strap watch",       neck: "chef's bandana",                         face: "clear-frame glasses",               extra: "chef's knife roll" },
  travel:      { feet: "worn-in hiking boots",            wrist: "compass bracelet",                 neck: "camera strap with vintage camera",        face: "aviator sunglasses",               extra: "weathered backpack" },

  // Finance & business
  finance:     { feet: "polished Oxford dress shoes",     wrist: "Patek Philippe dress watch",       neck: "silk tie with tie bar",                  face: "tortoiseshell reading glasses",     extra: "leather briefcase" },
  business:    { feet: "polished Italian leather loafers", wrist: "Omega Seamaster",                 neck: "thin gold chain under collar",            face: "frameless designer glasses",       extra: "Mont Blanc pen" },

  // Comedy & personality
  comedy:      { feet: "mismatched Crocs with Jibbitz",   wrist: "novelty rubber duck watch",        neck: "Hawaiian lei necklace",                  face: "joke-shop Groucho glasses",         extra: "whoopee cushion" },
  philosophy:  { feet: "worn leather sandals",            wrist: "simple braided leather band",      neck: "ancient coin pendant",                   face: "round wire-frame reading glasses",  extra: "worn leather journal" },

  // Photography & science
  photography: { feet: "rugged all-terrain boots",        wrist: "minimal black watch",              neck: "professional camera on strap",            face: "vintage round sunglasses",         extra: "camera lens" },
  science:     { feet: "clean white lab shoes",           wrist: "calculator watch",                 neck: "safety goggles hanging on lanyard",       face: "protective lab glasses",            extra: "pocket protector" },
  education:   { feet: "comfortable loafers",             wrist: "classic Timex Weekender",          neck: "lanyard with ID badge",                  face: "reading glasses on chain",          extra: "stack of books" },
};

// Fallback for niches not in the map
const DEFAULT_ITEMS: ItemSet = {
  feet: "stylish sneakers",
  wrist: "sleek wristwatch",
  neck: "pendant necklace",
  face: "designer sunglasses",
  extra: "accessories",
};

/**
 * Resolve the best item set for a bot based on its niche, aesthetic, and personality.
 */
export function resolveItems(niche?: string, aesthetic?: string, personality?: string): ItemSet {
  const text = [niche, aesthetic, personality].filter(Boolean).join(" ").toLowerCase();

  // Check each niche keyword — first match wins
  for (const [keyword, items] of Object.entries(NICHE_ITEMS)) {
    if (text.includes(keyword)) return items;
  }

  // Broad fallback checks
  if (/hip.?hop|rap|urban|drip/i.test(text)) return NICHE_ITEMS.streetwear;
  if (/gym|workout|athletic/i.test(text)) return NICHE_ITEMS.fitness;
  if (/code|programming|developer|software/i.test(text)) return NICHE_ITEMS.tech;
  if (/cook|chef|baking|culinary/i.test(text)) return NICHE_ITEMS.food;
  if (/style|outfit|drip|aesthetic/i.test(text)) return NICHE_ITEMS.fashion;

  return DEFAULT_ITEMS;
}

/**
 * Replace [ITEM_*] placeholders with personality-appropriate items.
 */
export function personalizeItems(prompt: string, items: ItemSet): string {
  return prompt
    .replace(/\[ITEM_FEET\]/gi, items.feet)
    .replace(/\[ITEM_WRIST\]/gi, items.wrist)
    .replace(/\[ITEM_NECK\]/gi, items.neck)
    .replace(/\[ITEM_FACE\]/gi, items.face)
    .replace(/\[ITEM_EXTRA\]/gi, items.extra);
}

// ---------------------------------------------------------------------------
// Single-prompt builders (text_to_video, image_to_video)
// ---------------------------------------------------------------------------

/**
 * Build a single generation prompt from an effect template and variant.
 * [SUBJECT] is left in place — replaced by the caller with the bot's
 * character description at generation time.
 */
export function buildPrompt(
  effect: EffectRecord,
  variant: EffectVariant | null,
): string {
  const template = effect.promptTemplate as { main?: string; scenes?: string[] };
  let prompt = template.main || template.scenes?.[0] || "";

  if (variant?.substitutions) {
    for (const [key, value] of Object.entries(variant.substitutions)) {
      prompt = prompt.replace(new RegExp(`\\[${key}\\]`, "gi"), value);
    }
  }

  return prompt;
}

/**
 * Replace the [SUBJECT] placeholder in a prompt with the bot's
 * character description for actual generation.
 */
export function injectSubject(prompt: string, subjectDescription: string): string {
  return prompt.replace(/\[SUBJECT\]/gi, subjectDescription);
}

/**
 * Build all scene prompts for a multi-scene effect, with variant
 * substitutions applied and [SUBJECT] replaced.
 */
export function buildScenePrompts(
  effect: EffectRecord,
  variant: EffectVariant | null,
  subjectDescription: string,
): string[] {
  const template = effect.promptTemplate as { scenes?: string[] };
  if (!template.scenes) return [];

  return template.scenes.map((scene) => {
    let prompt = scene;

    // Apply variant substitutions
    if (variant?.substitutions) {
      for (const [key, value] of Object.entries(variant.substitutions)) {
        prompt = prompt.replace(new RegExp(`\\[${key}\\]`, "gi"), value);
      }
    }

    // Replace subject
    return injectSubject(prompt, subjectDescription);
  });
}

// ---------------------------------------------------------------------------
// Multi-scene composer
// ---------------------------------------------------------------------------
//
// Current text-to-video models (Kling, Minimax, fal.ai) generate a single
// continuous clip from one prompt. They don't natively support multi-scene
// cuts. Instead of throwing away scenes 2-N, we compose all scenes into a
// single rich cinematic narrative with shot directions that AI video models
// understand — they're trained on cinematic language and produce transitions
// when prompted with shot descriptions.
// ---------------------------------------------------------------------------

/**
 * Compose a multi-scene effect's full scene array into one cinematic prompt.
 * Includes shot-by-shot directions so the video model produces transitions.
 *
 * Returns the full composed prompt with [SUBJECT] still intact (caller replaces).
 */
export function composeMultiScenePrompt(
  effect: EffectRecord,
  variant: EffectVariant | null,
  items: ItemSet,
): string {
  const template = effect.promptTemplate as { main?: string; scenes?: string[] };
  const scenes = template.scenes;

  // If no scenes, fall back to buildPrompt
  if (!scenes || scenes.length === 0) {
    return buildPrompt(effect, variant);
  }

  const camera = effect.cameraConfig as CameraConfig | null;
  const totalScenes = scenes.length;

  // Process each scene with variant substitutions and item personalization
  const processedScenes = scenes.map((scene, i) => {
    let prompt = scene;

    // Apply variant substitutions
    if (variant?.substitutions) {
      for (const [key, value] of Object.entries(variant.substitutions)) {
        prompt = prompt.replace(new RegExp(`\\[${key}\\]`, "gi"), value);
      }
    }

    // Personalize items
    prompt = personalizeItems(prompt, items);

    // Label the shot
    const shotNum = i + 1;
    if (shotNum === 1) return `OPENING SHOT: ${prompt}`;
    if (shotNum === totalScenes) return `FINAL SHOT: ${prompt}`;
    return `SHOT ${shotNum}: ${prompt}`;
  });

  // Build the composite prompt
  const cameraDirection = camera?.movement
    ? `Camera: ${camera.movement}.`
    : "";

  return `Cinematic multi-angle sequence. ${cameraDirection}

${processedScenes.join("\n\n")}

Style: Smooth transitions between shots, cinematic editing, professional quality. Each shot flows into the next. Vertical format (9:16), social media optimized, 4K.`;
}

// ---------------------------------------------------------------------------
// Start/end frame composer
// ---------------------------------------------------------------------------
//
// For start_end_frame effects, we generate a start frame image (with the
// bot's character reference via IP-adapter), then use it as the input to
// image-to-video generation. The end frame description guides the video
// model on where the transition should land.
// ---------------------------------------------------------------------------

/**
 * Build the start frame image prompt from cameraConfig.startFrame.
 * Returns a prompt suitable for image generation (Flux).
 */
export function buildStartFramePrompt(
  effect: EffectRecord,
  variant: EffectVariant | null,
  items: ItemSet,
): string {
  const camera = effect.cameraConfig as CameraConfig | null;
  if (!camera?.startFrame) {
    // Fall back to main prompt
    return personalizeItems(buildPrompt(effect, variant), items);
  }

  let prompt = camera.startFrame;

  // Apply variant substitutions
  if (variant?.substitutions) {
    for (const [key, value] of Object.entries(variant.substitutions)) {
      prompt = prompt.replace(new RegExp(`\\[${key}\\]`, "gi"), value);
    }
  }

  prompt = personalizeItems(prompt, items);

  return `${prompt}, cinematic composition, high quality, photorealistic, 4K, vertical format (9:16)`;
}

/**
 * Build the video transition prompt for start_end_frame effects.
 * Combines the main prompt with end frame direction so the video model
 * knows where to take the transition.
 */
export function buildStartEndVideoPrompt(
  effect: EffectRecord,
  variant: EffectVariant | null,
  items: ItemSet,
): string {
  const template = effect.promptTemplate as { main?: string };
  const camera = effect.cameraConfig as CameraConfig | null;

  let mainPrompt = template.main || "";

  // Apply variant substitutions
  if (variant?.substitutions) {
    for (const [key, value] of Object.entries(variant.substitutions)) {
      mainPrompt = mainPrompt.replace(new RegExp(`\\[${key}\\]`, "gi"), value);
    }
  }

  mainPrompt = personalizeItems(mainPrompt, items);

  const endDirection = camera?.endFrame
    ? `\n\nTransition toward: ${personalizeItems(camera.endFrame, items)}`
    : "";

  const cameraMovement = camera?.movement
    ? `\nCamera: ${camera.movement}.`
    : "";

  return `${mainPrompt}${cameraMovement}${endDirection}

Smooth cinematic transition, vertical format (9:16), 4K.`;
}
