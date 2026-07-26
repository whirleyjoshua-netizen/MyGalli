-- Values now live in LiveFeed.values (backfilled in 20260725000000). Drop A/B.
ALTER TABLE "LiveFeed" DROP COLUMN "valueA";
ALTER TABLE "LiveFeed" DROP COLUMN "valueB";
