-- Persistent per-browser visitor id. Nullable: pre-existing rows have none.
ALTER TABLE "AnalyticsEvent" ADD COLUMN "visitorId" TEXT;

CREATE INDEX "AnalyticsEvent_displayId_visitorId_idx" ON "AnalyticsEvent"("displayId", "visitorId");
