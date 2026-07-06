-- CreateTable
CREATE TABLE "CollectionMember" (
    "id" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CollectionMember_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CollectionMember_collectionId_idx" ON "CollectionMember"("collectionId");

-- CreateIndex
CREATE INDEX "CollectionMember_memberId_idx" ON "CollectionMember"("memberId");

-- CreateIndex
CREATE UNIQUE INDEX "CollectionMember_collectionId_memberId_key" ON "CollectionMember"("collectionId", "memberId");

-- AddForeignKey
ALTER TABLE "CollectionMember" ADD CONSTRAINT "CollectionMember_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Display"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionMember" ADD CONSTRAINT "CollectionMember_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Display"("id") ON DELETE CASCADE ON UPDATE CASCADE;
