-- CreateTable
CREATE TABLE "HubReport" (
    "id" TEXT NOT NULL,
    "hubId" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "note" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" TEXT,
    CONSTRAINT "HubReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HubBan" (
    "id" TEXT NOT NULL,
    "hubId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bannedById" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HubBan_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "HubDrop" ADD COLUMN "consentText" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "HubReport_hubId_reporterId_targetType_targetId_key" ON "HubReport"("hubId", "reporterId", "targetType", "targetId");
CREATE INDEX "HubReport_hubId_status_idx" ON "HubReport"("hubId", "status");
CREATE UNIQUE INDEX "HubBan_hubId_userId_key" ON "HubBan"("hubId", "userId");
CREATE INDEX "HubBan_hubId_idx" ON "HubBan"("hubId");

-- AddForeignKey
ALTER TABLE "HubReport" ADD CONSTRAINT "HubReport_hubId_fkey" FOREIGN KEY ("hubId") REFERENCES "Hub"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HubReport" ADD CONSTRAINT "HubReport_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HubBan" ADD CONSTRAINT "HubBan_hubId_fkey" FOREIGN KEY ("hubId") REFERENCES "Hub"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HubBan" ADD CONSTRAINT "HubBan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
