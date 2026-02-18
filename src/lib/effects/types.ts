// ---------------------------------------------------------------------------
// Content Effects Library — Types
// ---------------------------------------------------------------------------

export type GenerationType =
  | "text_to_video"
  | "image_to_video"
  | "start_end_frame"
  | "multi_scene"
  | "code_render";

export type TierMinimum = "spark" | "pulse" | "grid";

export type EffectCategoryDef = {
  id: string;
  name: string;
  icon: string;
  displayOrder: number;
};

export type EffectVariant = {
  id: string;
  label: string;
  /** Key-value substitutions for prompt template placeholders */
  substitutions: Record<string, string>;
};

export type PromptTemplate = {
  /** Main prompt for single-scene effects. Contains [SUBJECT] placeholder. */
  main?: string;
  /** Per-scene prompts for multi_scene effects. */
  scenes?: string[];
};

export type CameraConfig = {
  movement: string;
  startFrame: string;
  endFrame: string;
};

export type MusicConfig = {
  mood: string;
  description: string;
};

export type EffectDef = {
  id: string;
  name: string;
  categoryId: string;
  tierMinimum: TierMinimum;
  generationType: GenerationType;
  description?: string;
  cameraConfig?: CameraConfig;
  promptTemplate: PromptTemplate;
  variants?: EffectVariant[];
  musicConfig?: MusicConfig;
  durationOptions: number[];
  fps?: number;
  costEstimateMin?: number;
  costEstimateMax?: number;
};

/** Effect record as returned from the database. */
export type EffectRecord = {
  id: string;
  name: string;
  categoryId: string;
  tierMinimum: string;
  generationType: string;
  description: string | null;
  cameraConfig: CameraConfig | null;
  promptTemplate: PromptTemplate;
  variants: EffectVariant[] | null;
  musicConfig: MusicConfig | null;
  durationOptions: number[];
  fps: number;
  costEstimateMin: number | null;
  costEstimateMax: number | null;
  isActive: boolean;
  isTrending: boolean;
  usageCount: number;
};

/** Result of effect selection for a post. */
export type SelectedEffect = {
  effect: EffectRecord;
  variant: EffectVariant | null;
  duration: number;
  builtPrompt: string;
  scenes?: string[];
};

// Tier hierarchy for comparison
const TIER_RANK: Record<string, number> = {
  spark: 0,
  pulse: 1,
  grid: 2,
};

export function tierMeetsMinimum(userTier: string, required: string): boolean {
  const userRank = TIER_RANK[userTier.toLowerCase()] ?? -1;
  const requiredRank = TIER_RANK[required.toLowerCase()] ?? 99;
  return userRank >= requiredRank;
}

/** Map subscription tier names to effect tier names. */
export function mapSubscriptionTier(tier: string): string {
  const map: Record<string, string> = {
    SPARK: "spark",
    PULSE: "pulse",
    GRID: "grid",
    ADMIN: "grid",
  };
  return map[tier] || "spark";
}
