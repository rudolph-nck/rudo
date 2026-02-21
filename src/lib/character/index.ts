// Character consistency system — barrel exports
// Full pipeline: seed -> avatar -> ref pack -> consistent image/video

export { generateSeedImages } from "./generateSeed";
export { generateContextualAvatars } from "./generateAvatar";
export { generateRefPack } from "./generateRefPack";
export { generateConsistentImage } from "./consistentImage";
export { generateConsistentVideo } from "./consistentVideo";
export { extractAndStoreFace } from "./faceExtract";
export type {
  CharacterAppearance,
  SeedGenerationOptions,
  AvatarGenerationOptions,
  RefPackOptions,
  ConsistentImageOptions,
  ConsistentVideoOptions,
} from "./types";
export { NICHE_SCENE_MAP, REF_PACK_SCENES } from "./types";
