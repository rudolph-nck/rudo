// Character consistency system — types
// Used across seed generation, avatar creation, ref packs, and consistent image/video.

export interface CharacterAppearance {
  // Human-like fields (person/character)
  skinTone?: string;
  hairColor?: string;
  hairStyle?: string;
  build?: string;
  styleKeywords?: string[];
  distinguishingFeature?: string;
  // Animal fields
  furColor?: string;
  furPattern?: string;
  markings?: string;
  accessories?: string;
  // Universal free-text visual description
  visualDescription?: string;
}

export interface SeedGenerationOptions {
  botId: string;
  botType: "person" | "character" | "animal" | "entity" | "realistic" | "fictional";
  name: string;
  ageRange?: string;
  genderPresentation?: string;
  appearance?: CharacterAppearance;
  niche?: string;
  aesthetic?: string;
  /** Free-text character description from the builder */
  characterDescription?: string;
  /** Animal species (e.g. "dog", "cat") */
  species?: string;
  /** Animal breed (e.g. "Golden Retriever") */
  breed?: string;
  /** Animal size */
  animalSize?: string;
  /** Entity type (e.g. "brand", "food", "object") */
  entityType?: string;
  /** Number of seed options to generate (default: 4) */
  count?: number;
}

export interface AvatarGenerationOptions {
  botId: string;
  name: string;
  seedUrl: string;
  niche?: string;
  interests?: string[];
  aesthetic?: string;
  /** Number of avatar options to generate (default: 3) */
  count?: number;
}

export interface RefPackOptions {
  botId: string;
  name: string;
  seedUrl: string;
  niche?: string;
  personality?: string;
  aesthetic?: string;
}

export interface ConsistentImageOptions {
  seedUrl: string;
  scenePrompt: string;
  imageSize?: string;
}

export interface ConsistentVideoOptions {
  seedUrl: string;
  motionPrompt: string;
  duration: 6 | 15 | 30;
}

/** Scene prompts for reference pack generation */
export const REF_PACK_SCENES = [
  "action shot, dynamic pose, in their element",
  "mood shot, contemplative, atmospheric lighting",
  "casual shot, relaxed, candid everyday moment",
  "signature shot, iconic pose, defining moment",
] as const;

/** Niche to avatar scene mapping */
export const NICHE_SCENE_MAP: Record<string, string> = {
  comedy:       "mid-laugh on comedy club stage, spotlight, brick wall background",
  fitness:      "mid-workout in gritty gym, chalk dust, dramatic lighting",
  food:         "in warm busy kitchen, steam rising from pan, amber lighting",
  travel:       "at scenic overlook, backpack on, golden hour",
  gaming:       "in neon-lit gaming setup, RGB glow, focused expression",
  music:        "on stage with instrument, concert lighting, crowd silhouettes",
  fashion:      "urban street style, architectural background, editorial pose",
  tech:         "in modern workspace, multiple screens, cool lighting",
  photography:  "holding camera, golden hour light, shallow depth of field",
  art:          "in paint-splattered studio, natural light, creative chaos",
  film:         "on set with dramatic lighting, cinematic composition",
  books:        "in cozy library corner, warm lamplight, surrounded by books",
  nature:       "in wilderness setting, dramatic landscape, natural light",
  sports:       "in athletic gear, stadium or field, action frozen mid-motion",
  business:     "in modern office, city skyline through windows, power stance",
  spirituality: "serene meditation space, soft light, peaceful atmosphere",
  science:      "in lab setting, interesting equipment, curious expression",
  nightlife:    "in vibrant club or bar, neon lighting, after-dark energy",
};
