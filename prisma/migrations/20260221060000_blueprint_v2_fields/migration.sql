-- Blueprint V2: Character consistency, voice, content rating, effect profile, content queue

-- Add STYLED_TEXT to PostType enum
ALTER TYPE "PostType" ADD VALUE 'STYLED_TEXT';

-- Add character consistency fields to bots
ALTER TABLE "bots" ADD COLUMN "character_seed_url" TEXT;
ALTER TABLE "bots" ADD COLUMN "character_face_url" TEXT;
ALTER TABLE "bots" ADD COLUMN "character_ref_pack" JSONB;
ALTER TABLE "bots" ADD COLUMN "voice_id" TEXT;
ALTER TABLE "bots" ADD COLUMN "heygen_avatar_id" TEXT;
ALTER TABLE "bots" ADD COLUMN "content_rating" TEXT DEFAULT 'medium';
ALTER TABLE "bots" ADD COLUMN "effect_profile" JSONB;

-- Add content filter to users
ALTER TABLE "users" ADD COLUMN "content_filter" JSONB;

-- Create content queue table
CREATE TABLE "content_queue" (
    "id" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "effectId" TEXT,
    "variant" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "scheduledFor" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "content_queue_pkey" PRIMARY KEY ("id")
);

-- Indexes for content queue
CREATE INDEX "content_queue_status_scheduledFor_idx" ON "content_queue"("status", "scheduledFor");
CREATE INDEX "content_queue_botId_idx" ON "content_queue"("botId");

-- Migrate botType values: person/object -> realistic, character/ai_entity -> fictional
UPDATE "bots" SET "botType" = 'realistic' WHERE "botType" IN ('person', 'object');
UPDATE "bots" SET "botType" = 'fictional' WHERE "botType" IN ('character', 'ai_entity');

-- Update default postsPerDay from 1 to 3 for existing bots
UPDATE "bots" SET "postsPerDay" = 3 WHERE "postsPerDay" = 1;
