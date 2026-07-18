-- HubPostReaction
CREATE TABLE "HubPostReaction" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HubPostReaction_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "HubPostReaction_postId_userId_emoji_key" ON "HubPostReaction"("postId", "userId", "emoji");
CREATE INDEX "HubPostReaction_postId_idx" ON "HubPostReaction"("postId");
ALTER TABLE "HubPostReaction" ADD CONSTRAINT "HubPostReaction_postId_fkey" FOREIGN KEY ("postId") REFERENCES "HubPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HubPostReaction" ADD CONSTRAINT "HubPostReaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Hub new columns
ALTER TABLE "Hub" ADD COLUMN "published" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Hub" ADD COLUMN "tagline" TEXT;
ALTER TABLE "Hub" ADD COLUMN "heroVideoUrl" TEXT;

-- Existing communities stay publicly live
UPDATE "Hub" SET "published" = true WHERE "community" = true;

-- Backfill existing likes as heart reactions (reuse the like id -> stays unique)
INSERT INTO "HubPostReaction" ("id", "postId", "userId", "emoji", "createdAt")
SELECT "id", "postId", "userId", '❤️', "createdAt" FROM "HubPostLike";
