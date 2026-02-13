-- AlterTable: add handle and bio columns to users
ALTER TABLE "users" ADD COLUMN "handle" TEXT;
ALTER TABLE "users" ADD COLUMN "bio" TEXT;

-- CreateIndex: unique constraint on handle
CREATE UNIQUE INDEX "users_handle_key" ON "users"("handle");

-- CreateIndex: index for handle lookups
CREATE INDEX "users_handle_idx" ON "users"("handle");
