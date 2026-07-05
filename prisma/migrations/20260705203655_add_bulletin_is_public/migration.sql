-- AlterTable
ALTER TABLE "BulletinPost" ADD COLUMN     "isPublic" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "BulletinPost_isPublic_createdAt_idx" ON "BulletinPost"("isPublic", "createdAt");

