-- AlterTable
ALTER TABLE "HubFolder" ADD COLUMN "visibility" TEXT NOT NULL DEFAULT 'public';
ALTER TABLE "HubFolder" ADD COLUMN "passcodeHash" TEXT;
ALTER TABLE "HubItem" ADD COLUMN "visibility" TEXT NOT NULL DEFAULT 'public';
ALTER TABLE "HubItem" ADD COLUMN "passcodeHash" TEXT;
-- CreateTable
CREATE TABLE "HubCollaborator" (
    "id" TEXT NOT NULL,
    "hubId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HubCollaborator_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "HubCollaborator_hubId_userId_key" ON "HubCollaborator"("hubId", "userId");
CREATE INDEX "HubCollaborator_hubId_idx" ON "HubCollaborator"("hubId");
CREATE INDEX "HubCollaborator_userId_idx" ON "HubCollaborator"("userId");
ALTER TABLE "HubCollaborator" ADD CONSTRAINT "HubCollaborator_hubId_fkey" FOREIGN KEY ("hubId") REFERENCES "Hub"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HubCollaborator" ADD CONSTRAINT "HubCollaborator_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
