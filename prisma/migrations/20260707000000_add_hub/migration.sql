-- CreateTable
CREATE TABLE "Hub" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "displayId" TEXT,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'Untitled Hub',
    "description" TEXT,
    "coverImage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Hub_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "HubFolder" (
    "id" TEXT NOT NULL,
    "hubId" TEXT NOT NULL,
    "parentId" TEXT,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HubFolder_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "HubItem" (
    "id" TEXT NOT NULL,
    "hubId" TEXT NOT NULL,
    "folderId" TEXT,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT,
    "content" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HubItem_pkey" PRIMARY KEY ("id")
);
-- Indexes
CREATE UNIQUE INDEX "Hub_userId_slug_key" ON "Hub"("userId", "slug");
CREATE INDEX "Hub_userId_idx" ON "Hub"("userId");
CREATE INDEX "Hub_displayId_idx" ON "Hub"("displayId");
CREATE INDEX "HubFolder_hubId_idx" ON "HubFolder"("hubId");
CREATE INDEX "HubFolder_parentId_idx" ON "HubFolder"("parentId");
CREATE INDEX "HubItem_hubId_idx" ON "HubItem"("hubId");
CREATE INDEX "HubItem_folderId_idx" ON "HubItem"("folderId");
-- Foreign keys
ALTER TABLE "Hub" ADD CONSTRAINT "Hub_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HubFolder" ADD CONSTRAINT "HubFolder_hubId_fkey" FOREIGN KEY ("hubId") REFERENCES "Hub"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HubItem" ADD CONSTRAINT "HubItem_hubId_fkey" FOREIGN KEY ("hubId") REFERENCES "Hub"("id") ON DELETE CASCADE ON UPDATE CASCADE;
