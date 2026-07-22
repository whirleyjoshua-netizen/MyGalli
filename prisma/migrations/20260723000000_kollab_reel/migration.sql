-- Additive only. No existing column is altered or dropped.
ALTER TABLE "HubDrop" ADD COLUMN "durationSec" DOUBLE PRECISION;
ALTER TABLE "HubDrop" ADD COLUMN "aiTags" JSONB;

CREATE TABLE "KollabReel" (
    "id" TEXT NOT NULL,
    "hubId" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "preset" TEXT,
    "prompt" TEXT,
    "title" TEXT NOT NULL,
    "edl" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "KollabReel_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "KollabReel_hubId_status_createdAt_idx" ON "KollabReel"("hubId", "status", "createdAt");

ALTER TABLE "KollabReel" ADD CONSTRAINT "KollabReel_hubId_fkey"
    FOREIGN KEY ("hubId") REFERENCES "Hub"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KollabReel" ADD CONSTRAINT "KollabReel_creatorId_fkey"
    FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
