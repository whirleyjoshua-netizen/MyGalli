-- CreateTable
CREATE TABLE "LiveFeed" (
    "id" TEXT NOT NULL,
    "displayId" TEXT NOT NULL,
    "isLive" BOOLEAN NOT NULL DEFAULT false,
    "valueA" INTEGER NOT NULL DEFAULT 0,
    "valueB" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "lastUpdatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LiveFeed_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LiveFeed_displayId_idx" ON "LiveFeed"("displayId");

-- AddForeignKey
ALTER TABLE "LiveFeed" ADD CONSTRAINT "LiveFeed_displayId_fkey" FOREIGN KEY ("displayId") REFERENCES "Display"("id") ON DELETE CASCADE ON UPDATE CASCADE;
