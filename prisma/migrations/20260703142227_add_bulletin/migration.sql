-- CreateTable
CREATE TABLE "BulletinPost" (
    "id" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "text" TEXT,
    "imageUrl" TEXT,
    "blocks" JSONB NOT NULL DEFAULT '[]',
    "settings" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BulletinPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BulletinLike" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BulletinLike_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BulletinResponse" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "responses" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BulletinResponse_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BulletinPost_authorId_idx" ON "BulletinPost"("authorId");

-- CreateIndex
CREATE INDEX "BulletinPost_createdAt_idx" ON "BulletinPost"("createdAt");

-- CreateIndex
CREATE INDEX "BulletinLike_postId_idx" ON "BulletinLike"("postId");

-- CreateIndex
CREATE UNIQUE INDEX "BulletinLike_postId_userId_key" ON "BulletinLike"("postId", "userId");

-- CreateIndex
CREATE INDEX "BulletinResponse_postId_idx" ON "BulletinResponse"("postId");

-- CreateIndex
CREATE UNIQUE INDEX "BulletinResponse_postId_userId_key" ON "BulletinResponse"("postId", "userId");

-- AddForeignKey
ALTER TABLE "BulletinPost" ADD CONSTRAINT "BulletinPost_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BulletinLike" ADD CONSTRAINT "BulletinLike_postId_fkey" FOREIGN KEY ("postId") REFERENCES "BulletinPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BulletinLike" ADD CONSTRAINT "BulletinLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BulletinResponse" ADD CONSTRAINT "BulletinResponse_postId_fkey" FOREIGN KEY ("postId") REFERENCES "BulletinPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BulletinResponse" ADD CONSTRAINT "BulletinResponse_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

