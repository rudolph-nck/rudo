export { EFFECT_CATEGORIES } from "./categories";
export { CINEMATIC_EFFECTS } from "./cinematic";
export { ACTION_EFFECTS } from "./action";
export { LIFESTYLE_EFFECTS } from "./lifestyle";
export { TECH_EFFECTS } from "./tech";
export { FILM_EFFECTS } from "./film";
export { DRONE_EFFECTS } from "./drone";
export { FASHION_EFFECTS } from "./fashion";
export { TRAVEL_EFFECTS } from "./travel";
export { MUSIC_EFFECTS } from "./music";
export { FUNNY_EFFECTS } from "./funny";

import type { EffectDef } from "../types";
import { CINEMATIC_EFFECTS } from "./cinematic";
import { ACTION_EFFECTS } from "./action";
import { LIFESTYLE_EFFECTS } from "./lifestyle";
import { TECH_EFFECTS } from "./tech";
import { FILM_EFFECTS } from "./film";
import { DRONE_EFFECTS } from "./drone";
import { FASHION_EFFECTS } from "./fashion";
import { TRAVEL_EFFECTS } from "./travel";
import { MUSIC_EFFECTS } from "./music";
import { FUNNY_EFFECTS } from "./funny";

/** All 80 effects in one flat array. */
export const ALL_EFFECTS: EffectDef[] = [
  ...CINEMATIC_EFFECTS,
  ...ACTION_EFFECTS,
  ...LIFESTYLE_EFFECTS,
  ...TECH_EFFECTS,
  ...FILM_EFFECTS,
  ...DRONE_EFFECTS,
  ...FASHION_EFFECTS,
  ...TRAVEL_EFFECTS,
  ...MUSIC_EFFECTS,
  ...FUNNY_EFFECTS,
];

/** Phase 1 launch IDs — first 20 effects to seed as active. */
export const PHASE_1_IDS = new Set([
  "debut", "freedom", "upward_tilt", "left_walking", "scenic_shot",
  "falling_from_sky", "action_hero", "rain_walk",
  "longboarding", "night_drive", "coffee_morning",
  "smartphone_pop_out", "scan_effect",
  "wes_anderson",
  "dronie",
  "runway_walk",
  "hotel_arrival",
  "concert_stage",
  "npc_mode", "main_character",
]);

/** Phase 2 IDs — add in weeks 2-3. */
export const PHASE_2_IDS = new Set([
  "left_circling", "downward_tilt", "stage_left",
  "time_freeze", "shockwave",
  "getting_ready", "record_player",
  "ai_genesis", "matrix_bullet_time",
  "film_noir",
  "reveal_rise",
  "accessory_zoom_cascade",
  "mountain_summit",
  "music_video_walk",
  "expectation_vs_reality",
]);
