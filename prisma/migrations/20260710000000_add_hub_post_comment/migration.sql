CREATE TABLE "HubPostComment" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HubPostComment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "HubPostComment_postId_createdAt_idx" ON "HubPostComment"("postId", "createdAt");
ALTER TABLE "HubPostComment" ADD CONSTRAINT "HubPostComment_postId_fkey" FOREIGN KEY ("postId") REFERENCES "HubPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HubPostComment" ADD CONSTRAINT "HubPostComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
