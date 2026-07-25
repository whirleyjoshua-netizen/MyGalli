-- Live feed: labeled N-value list + pausable clock + audience votes.
ALTER TABLE "LiveFeed" ADD COLUMN "values" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "LiveFeed" ADD COLUMN "clockMode" TEXT NOT NULL DEFAULT 'off';
ALTER TABLE "LiveFeed" ADD COLUMN "clockRunning" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "LiveFeed" ADD COLUMN "clockElapsedMs" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "LiveFeed" ADD COLUMN "clockLastStartedAt" TIMESTAMP(3);
ALTER TABLE "LiveFeed" ADD COLUMN "clockDurationMs" INTEGER;

-- Backfill values from the old A/B columns (labels empty; the client resolves
-- empty labels against the element config).
UPDATE "LiveFeed" SET "values" = json_build_array(
  json_build_object('id', 'a', 'label', '', 'value', "valueA"),
  json_build_object('id', 'b', 'label', '', 'value', "valueB")
)::jsonb;

CREATE TABLE "LiveFeedVote" (
  "id" TEXT NOT NULL,
  "liveFeedId" TEXT NOT NULL,
  "voterKey" TEXT NOT NULL,
  "optionId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LiveFeedVote_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "LiveFeedVote_liveFeedId_voterKey_key" ON "LiveFeedVote"("liveFeedId", "voterKey");
CREATE INDEX "LiveFeedVote_liveFeedId_idx" ON "LiveFeedVote"("liveFeedId");
ALTER TABLE "LiveFeedVote" ADD CONSTRAINT "LiveFeedVote_liveFeedId_fkey"
  FOREIGN KEY ("liveFeedId") REFERENCES "LiveFeed"("id") ON DELETE CASCADE ON UPDATE CASCADE;
