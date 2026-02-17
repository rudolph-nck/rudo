import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3 = new S3Client({
  region: process.env.S3_REGION || "auto",
  endpoint: process.env.S3_ENDPOINT || undefined,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || "",
  },
  forcePathStyle: true,
});

const BUCKET = process.env.S3_BUCKET || "rudo-media";
const MEDIA_URL = process.env.NEXT_PUBLIC_MEDIA_URL || "";

/**
 * Check if S3/R2 storage is properly configured.
 * If not, persistImage will fail and we should NOT store temporary URLs.
 */
export function isStorageConfigured(): boolean {
  return !!(
    process.env.S3_ACCESS_KEY_ID &&
    process.env.S3_SECRET_ACCESS_KEY &&
    process.env.S3_BUCKET &&
    process.env.NEXT_PUBLIC_MEDIA_URL
  );
}

const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "video/mp4": "mp4",
  "video/webm": "webm",
};

const MAX_SIZE = 50 * 1024 * 1024; // 50MB

/**
 * Generate a presigned upload URL.
 * Client uploads directly to S3/R2, bypassing our server.
 */
export async function createUploadUrl(params: {
  fileName: string;
  contentType: string;
  userId: string;
}): Promise<{ uploadUrl: string; key: string; publicUrl: string }> {
  const ext = ALLOWED_TYPES[params.contentType];
  if (!ext) {
    throw new Error(
      `Unsupported file type: ${params.contentType}. Allowed: ${Object.keys(ALLOWED_TYPES).join(", ")}`
    );
  }

  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 8);
  const key = `uploads/${params.userId}/${timestamp}-${random}.${ext}`;

  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: params.contentType,
  });

  const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 600 }); // 10 min

  return {
    uploadUrl,
    key,
    publicUrl: `${MEDIA_URL}/${key}`,
  };
}

/**
 * Download an image from a URL and persist it to S3/R2.
 * Used to save DALL-E generated images before their temporary URLs expire (~1 hour).
 * Returns the permanent public URL.
 */
export async function persistImage(
  imageUrl: string,
  folder: string = "generated"
): Promise<string> {
  const res = await fetch(imageUrl);
  if (!res.ok) throw new Error(`Failed to download image: ${res.status}`);

  const contentType = res.headers.get("content-type") || "image/png";
  const ext = contentType.includes("jpeg") || contentType.includes("jpg") ? "jpg" : "png";
  const buffer = Buffer.from(await res.arrayBuffer());

  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 8);
  const key = `${folder}/${timestamp}-${random}.${ext}`;

  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
    })
  );

  return `${MEDIA_URL}/${key}`;
}

/**
 * Download a video from a URL and persist it to S3/R2.
 * Used to save generated videos before their temporary URLs expire (~1 hour).
 * Returns the permanent public URL.
 */
export async function persistVideo(
  videoUrl: string,
  folder: string = "posts/videos"
): Promise<string> {
  const res = await fetch(videoUrl);
  if (!res.ok) throw new Error(`Failed to download video: ${res.status}`);

  const contentType = res.headers.get("content-type") || "video/mp4";
  const ext = contentType.includes("webm") ? "webm" : "mp4";
  const buffer = Buffer.from(await res.arrayBuffer());

  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 8);
  const key = `${folder}/${timestamp}-${random}.${ext}`;

  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
    })
  );

  return `${MEDIA_URL}/${key}`;
}

/**
 * Delete a media file from storage.
 */
export async function deleteMedia(key: string) {
  await s3.send(
    new DeleteObjectCommand({
      Bucket: BUCKET,
      Key: key,
    })
  );
}

/**
 * Validate upload params from client
 */
export function validateUpload(contentType: string, size: number) {
  if (!ALLOWED_TYPES[contentType]) {
    return {
      valid: false,
      error: `Unsupported file type. Allowed: ${Object.keys(ALLOWED_TYPES).join(", ")}`,
    };
  }
  if (size > MAX_SIZE) {
    return { valid: false, error: `File too large. Max: ${MAX_SIZE / 1024 / 1024}MB` };
  }
  return { valid: true, error: null };
}
