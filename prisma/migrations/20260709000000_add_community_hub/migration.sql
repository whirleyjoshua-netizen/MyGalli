-- AlterTable
ALTER TABLE "Hub" ADD COLUMN "community" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "HubMember" (
    "id" TEXT NOT NULL,
    "hubId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HubMember_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "HubMember_hubId_userId_key" ON "HubMember"("hubId", "userId");
CREATE INDEX "HubMember_hubId_idx" ON "HubMember"("hubId");
CREATE INDEX "HubMember_userId_idx" ON "HubMember"("userId");
ALTER TABLE "HubMember" ADD CONSTRAINT "HubMember_hubId_fkey" FOREIGN KEY ("hubId") REFERENCES "Hub"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HubMember" ADD CONSTRAINT "HubMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "HubPost" (
    "id" TEXT NOT NULL,
    "hubId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "text" TEXT,
    "imageUrl" TEXT,
    "blocks" JSONB NOT NULL DEFAULT '[]',
    "settings" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HubPost_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "HubPost_hubId_createdAt_idx" ON "HubPost"("hubId", "createdAt");
ALTER TABLE "HubPost" ADD CONSTRAINT "HubPost_hubId_fkey" FOREIGN KEY ("hubId") REFERENCES "Hub"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HubPost" ADD CONSTRAINT "HubPost_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "HubPostLike" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HubPostLike_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "HubPostLike_postId_userId_key" ON "HubPostLike"("postId", "userId");
CREATE INDEX "HubPostLike_postId_idx" ON "HubPostLike"("postId");
ALTER TABLE "HubPostLike" ADD CONSTRAINT "HubPostLike_postId_fkey" FOREIGN KEY ("postId") REFERENCES "HubPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HubPostLike" ADD CONSTRAINT "HubPostLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
