-- CreateTable
CREATE TABLE "HubNote" (
    "id" TEXT NOT NULL,
    "hubId" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "content" TEXT NOT NULL DEFAULT '',
    "linkedItemId" TEXT,
    "visibility" TEXT NOT NULL DEFAULT 'public',
    "minimized" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HubNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HubNote_hubId_idx" ON "HubNote"("hubId");

-- AddForeignKey
ALTER TABLE "HubNote" ADD CONSTRAINT "HubNote_hubId_fkey" FOREIGN KEY ("hubId") REFERENCES "Hub"("id") ON DELETE CASCADE ON UPDATE CASCADE;

