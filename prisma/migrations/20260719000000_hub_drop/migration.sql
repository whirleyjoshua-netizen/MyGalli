-- CreateTable
CREATE TABLE "HubDrop" (
    "id" TEXT NOT NULL,
    "hubId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "caption" TEXT,
    "mimeType" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HubDrop_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HubDrop_hubId_createdAt_idx" ON "HubDrop"("hubId", "createdAt");

-- AddForeignKey
ALTER TABLE "HubDrop" ADD CONSTRAINT "HubDrop_hubId_fkey" FOREIGN KEY ("hubId") REFERENCES "Hub"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HubDrop" ADD CONSTRAINT "HubDrop_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
