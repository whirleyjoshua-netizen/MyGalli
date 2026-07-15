-- Public "last updated" indicator (opt-in, per page).
-- Additive only: both columns are safe on a populated table.
-- No backfill: contentUpdatedAt stays NULL for existing rows, so the badge
-- stays hidden until the owner opts in or makes a visible edit. Backfilling
-- from updatedAt would copy view timestamps and publish them as edit dates.
ALTER TABLE "Display" ADD COLUMN "showLastUpdated" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Display" ADD COLUMN "contentUpdatedAt" TIMESTAMP(3);
