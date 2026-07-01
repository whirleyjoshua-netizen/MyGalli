-- Adds the Display.coverImage column that was missing from the baseline
-- migration (schema drift: it existed in the pre-baseline `init` and in
-- schema.prisma, but no migration created it — so fresh databases, i.e.
-- production on Neon, lacked it and every query selecting it failed P2022).
-- IF NOT EXISTS keeps this safe to run against databases that already have it.
ALTER TABLE "Display" ADD COLUMN IF NOT EXISTS "coverImage" TEXT;
