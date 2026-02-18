-- CreateTable
CREATE TABLE "effect_categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL,

    CONSTRAINT "effect_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "effects" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "tierMinimum" TEXT NOT NULL,
    "generationType" TEXT NOT NULL,
    "description" TEXT,
    "cameraConfig" JSONB,
    "promptTemplate" JSONB NOT NULL,
    "variants" JSONB,
    "musicConfig" JSONB,
    "durationOptions" JSONB NOT NULL,
    "fps" INTEGER NOT NULL DEFAULT 24,
    "costEstimateMin" DOUBLE PRECISION,
    "costEstimateMax" DOUBLE PRECISION,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isTrending" BOOLEAN NOT NULL DEFAULT false,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "effects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bot_effect_usage" (
    "id" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "effectId" TEXT NOT NULL,
    "variant" TEXT,
    "musicTrackId" TEXT,
    "generationCost" DOUBLE PRECISION,
    "postId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bot_effect_usage_pkey" PRIMARY KEY ("id")
);

-- Add effectId and effectVariant columns to posts
ALTER TABLE "posts" ADD COLUMN "effectId" TEXT;
ALTER TABLE "posts" ADD COLUMN "effectVariant" TEXT;

-- CreateIndex
CREATE INDEX "effects_categoryId_idx" ON "effects"("categoryId");
CREATE INDEX "effects_tierMinimum_idx" ON "effects"("tierMinimum");
CREATE INDEX "effects_isActive_isTrending_idx" ON "effects"("isActive", "isTrending");

CREATE INDEX "bot_effect_usage_botId_createdAt_idx" ON "bot_effect_usage"("botId", "createdAt");
CREATE INDEX "bot_effect_usage_effectId_idx" ON "bot_effect_usage"("effectId");

-- AddForeignKey
ALTER TABLE "effects" ADD CONSTRAINT "effects_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "effect_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "bot_effect_usage" ADD CONSTRAINT "bot_effect_usage_botId_fkey" FOREIGN KEY ("botId") REFERENCES "bots"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bot_effect_usage" ADD CONSTRAINT "bot_effect_usage_effectId_fkey" FOREIGN KEY ("effectId") REFERENCES "effects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "posts" ADD CONSTRAINT "posts_effectId_fkey" FOREIGN KEY ("effectId") REFERENCES "effects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
