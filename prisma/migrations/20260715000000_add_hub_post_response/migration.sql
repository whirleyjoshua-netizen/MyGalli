-- CreateTable
CREATE TABLE "HubPostResponse" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "responses" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HubPostResponse_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HubPostResponse_postId_idx" ON "HubPostResponse"("postId");

-- CreateIndex
CREATE UNIQUE INDEX "HubPostResponse_postId_userId_key" ON "HubPostResponse"("postId", "userId");

-- AddForeignKey
ALTER TABLE "HubPostResponse" ADD CONSTRAINT "HubPostResponse_postId_fkey" FOREIGN KEY ("postId") REFERENCES "HubPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HubPostResponse" ADD CONSTRAINT "HubPostResponse_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
