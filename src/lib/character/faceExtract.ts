// Face extraction — crops and stores the primary face from a seed image.
// Used for HeyGen avatar creation and face-matching in moderation.
// Uses GPT-4o Vision to identify face bounds, then crops the image.

import { analyzeImage } from "../ai/tool-router";
import { persistImage, isStorageConfigured } from "../media";

/**
 * Extract face region from a seed image using AI vision analysis.
 * Stores the face crop separately for use in HeyGen avatar creation.
 *
 * For now this stores the full seed image as the "face URL" since
 * fal.ai's InstantCharacter handles face extraction internally.
 * A future version can add actual face cropping.
 *
 * @param seedUrl - The character seed image URL
 * @param botId - Bot ID for storage path
 * @returns Persisted face image URL, or null on failure
 */
export async function extractAndStoreFace(
  seedUrl: string,
  botId: string,
): Promise<string | null> {
  try {
    if (!isStorageConfigured()) {
      console.warn("S3 not configured — face extraction will NOT persist.");
      return null;
    }

    // For now, persist the seed image as the face reference.
    // InstantCharacter + HeyGen both handle face detection internally.
    // This gives us a stored reference for the talking head pipeline.
    return await persistImage(seedUrl, `bots/${botId}/face`);
  } catch (error: any) {
    console.error("Face extraction failed:", error.message);
    return null;
  }
}
