-- Replace the overloaded `hidden` boolean with an explicit review status.
ALTER TABLE "HubDrop" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE "HubDrop" ADD COLUMN "reviewedAt" TIMESTAMP(3);
ALTER TABLE "HubDrop" ADD COLUMN "reviewedById" TEXT;
ALTER TABLE "HubDrop" ADD COLUMN "assetDeleted" BOOLEAN NOT NULL DEFAULT false;

-- Backfill: a hidden row was awaiting review; a visible row was effectively approved.
UPDATE "HubDrop" SET "status" = CASE WHEN "hidden" THEN 'pending' ELSE 'approved' END;

CREATE INDEX "HubDrop_hubId_status_createdAt_idx" ON "HubDrop"("hubId", "status", "createdAt");
