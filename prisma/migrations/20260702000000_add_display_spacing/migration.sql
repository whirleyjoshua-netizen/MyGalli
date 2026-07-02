-- Adds the Display.spacing column: page-level layout & spacing configuration
-- (content width / side margins, section spacing, element spacing, page padding)
-- stored as JSON. Nullable — legacy pages read null and fall back to
-- DEFAULT_SPACING_CONFIG in the app. IF NOT EXISTS keeps it safe to re-run.
ALTER TABLE "Display" ADD COLUMN IF NOT EXISTS "spacing" JSONB;
