# Data Intelligence Center — D2: Audience Tab — Design

**Date:** 2026-07-20
**Status:** Approved (user direction)
**Base:** `origin/main` @ `1a5661b`. Branch `feat/data-audience-d2` (worktree `.claude/worktrees/data-audience`).
**Follows:** `2026-07-19-data-cockpit-d1-design.md` (D1 shipped and live).

## Context

D1 built the event layer and the Overview cockpit. D2 adds the second of the five tabs:
**Audience** — who is visiting, from where, on what device, and when.

Investigation before designing turned up one finding that reshapes this phase and corrects a
defect in shipped code:

**Visitor identity is `sessionStorage`-based.** `getSessionId()` in `src/lib/analytics.ts` stores
`pages_session_id` in `sessionStorage`, which is per-tab and cleared when the tab closes. So the same
person returning tomorrow, or opening a second tab, is counted as a new id. Two consequences:

1. The **"Visitors" card shipped in D1 counts sessions, not people** — it overcounts.
2. **New vs Returning and Repeat Visits are not computable at all** with the current tracking.

Everything else on the D2 wishlist is derivable from data already collected:

| Metric | Source | Status |
|---|---|---|
| Geography | `AnalyticsEvent.country` | ✅ collecting since 2026-07-19 |
| Devices | `deviceType` | ✅ already collected |
| Sources | `referrer`, `utmSource/Medium/Campaign` | ✅ already collected |
| Avg session | last − first event per session | ✅ derivable, no leave-tracking needed |
| Bounce rate | sessions with exactly one event | ✅ derivable |
| Peak hours | `createdAt` | ✅ derivable, needs a timezone decision |
| New vs returning, repeat visits | — | ❌ blocked, see above |
| Interests / "most viewed tags" | — | ❌ no tag data exists anywhere |

## Decisions

- **Add a persistent visitor id.** A random opaque string in `localStorage` (`galli_visitor_id`),
  sent alongside the per-tab session id. "Visitors" then means people; "Sessions" becomes its own
  number. Chosen over relabelling alone because the Audience tab's most valuable question — do people
  come back? — is otherwise unanswerable.
- **Historical data is not backfillable.** Events before this deploy have `visitorId = null`. Reads
  fall back to `sessionId` when `visitorId` is absent, so past periods still produce a number. That
  number overcounts, and the UI says so rather than hiding it.
- **Peak hours render in the viewing owner's local timezone**, converted client-side from UTC. No new
  column. Chosen over per-visitor timezone (needs new collection, not backfillable) and raw UTC
  (unreadable without mental arithmetic).
- **Geography is a ranked list** — flag emoji + country name + share bar. We hold country-level data
  only, so a choropleth would be a heavy way to render a short list, and it reads poorly until
  traffic diversifies. No new dependency.
- **Device and Browser breakdowns move from Overview to Audience.** One home per fact. Overview
  returns to the cockpit layout the mockup shows.
- **Audience gets its own API route**, not an extension of the Overview route. Overview's route
  already performs an unbounded event scan; combining them would make one slow endpoint serve two
  tabs. A separate route also means the work only happens when the tab is opened.
- **"Interests / most viewed tags" is dropped.** No tagging feature exists; building the metric would
  mean inventing the feature first.

## Architecture

### Data layer

- **Migration (first in this line of work):** add `visitorId String?` to `AnalyticsEvent` plus
  `@@index([displayId, visitorId])`. **Hand-author `migration.sql` containing only these
  statements** — `migrate diff --from-url` is contaminated on the shared dev database and emits
  spurious `DROP TABLE`s for concurrent branches' tables. Then `migrate deploy`.
- **Changed:** `src/lib/analytics.ts` — add a module-private `getVisitorId()` reading/writing
  `localStorage`, generating a random id on first visit. Every event body gains `visitorId`.
- **Changed:** `src/app/api/analytics/track/route.ts` — accept and persist `visitorId`, validated
  with the same 64-character cap already applied to interact metadata.

### API

**New:** `GET /api/analytics/[displayId]/audience?days=N`, owner-authenticated exactly like the
Overview route. Returns:

- `summary` — `{ visitors, sessions, newVisitors, returningVisitors, avgSessionSeconds, bounceRate }`
- `identityFallback: boolean` — true when any event in the window lacked `visitorId`, so the UI can
  disclose that the figure overcounts
- `peakHours` — 24 UTC-hour buckets; the client shifts them into its own timezone
- `geography` — `{ country, count }[]` ranked descending
- `sources` — `{ source, count }[]` using the classifier below
- `devices`, `browsers` — `Record<string, number>`, same shape the Overview route already returns

### Pure modules

**New:** `src/lib/data-audience.ts` — no I/O, no framework imports, imported by both the route and
client components:

- `sessionStats(events): { avgSessionSeconds, bounceRate, measuredSessions }` — groups by session id,
  duration is last minus first event timestamp (events are not assumed to arrive sorted). A session
  with exactly one event has no measurable duration: it counts toward `bounceRate` but is
  **excluded** from `avgSessionSeconds`, because averaging in zeros would report a duration no
  visitor actually experienced and would fall as bounces rise — two independent signals collapsed
  into one misleading number. `measuredSessions` reports how many sessions the average was computed
  from, so the UI can show "avg over N sessions" rather than implying it covers all traffic. When no
  session has two or more events, `avgSessionSeconds` is `null` and the panel shows an empty state
  rather than `0s`.
- `visitorSplit(current, prior): { newVisitors, returningVisitors }` — `current` is the set of
  visitor ids in the window; `prior` is the set of ids that appear in any event before the window
  start, supplied by the route as a separate bounded query. A visitor is *returning* when their id
  appears in both.
- `peakHours(hourCounts, utcOffsetMinutes): number[]` — rotates 24 UTC buckets into local hours.
- `classifySource(referrer, utm): SourceCategory` — `'search' | 'social' | 'direct' | 'community' |
  'referral'`, driven by an explicit host map (google/bing/duckduckgo → search;
  instagram/tiktok/x/twitter/facebook/linkedin → social; own host → community; absent → direct;
  anything else → referral). UTM source wins over referrer when present.
- `countryLabel(code): { flag, name }` — regional-indicator flag emoji from the ISO code, with a
  name map and a graceful fallback to the raw code for anything unmapped.

### Components

**New:** `src/components/analytics/audience/` — `AudienceHeadline`, `PeakHoursChart`,
`GeographyList`, `SourcesBreakdown`.
**Moved:** `AudienceBreakdowns` (device + browser) relocates here from the Overview column.
**Changed:** `src/app/(dashboard)/data/page.tsx` — add the Audience tab, fetch on first open, drop
the breakdowns row from Overview.

## Requirements

- **R1 — Visitor id.** Every tracked event carries a `visitorId` from `localStorage`, generated once
  per browser. The track route validates it (≤64 chars) and persists it. A tracking failure never
  breaks a visitor interaction.
- **R2 — Migration.** Additive column plus index only. No existing column is altered or dropped.
  `migrate diff --from-migrations --to-schema-datamodel` must be empty before deploying.
- **R3 — Headline row.** Visitors, Sessions, New vs Returning, Avg Session, Bounce Rate. Sessions and
  Visitors are shown as distinct numbers so the difference is legible. Avg Session is captioned with
  the number of sessions it was measured over, and renders its empty state (not `0s`) when no
  session had two or more events.
- **R4 — Identity disclosure.** When `identityFallback` is true, the panel states that figures before
  2026-07-20 count sessions rather than people and therefore overcount. Never silently mix the two.
- **R5 — Peak hours.** 24 bars in the viewer's local timezone, peak hour labelled. The timezone in
  use is stated on the panel.
- **R6 — Geography.** Ranked list, flag + name + percentage bar, share computed against the total of
  events carrying a country. Events with no country are excluded from the denominator, and the panel
  discloses how many were excluded.
- **R7 — Sources.** Ranked by the classifier's categories, each with its share.
- **R8 — Devices/Browsers.** Rendered in Audience, removed from Overview. No duplication.
- **R9 — Empty states.** Every panel has an illustrated empty state via `DataIllustration`. No
  fabricated or sample data anywhere.
- **R10 — Tab.** Audience appears between Overview and Elements. The other unbuilt phases
  (Interactions, Insights, Automation) still must NOT appear as placeholder tabs.

## Verification

- **Unit (TDD):** every function in `data-audience.ts` — session grouping including a single-event
  session and events out of order; new-vs-returning including a visitor appearing in both windows;
  peak-hour rotation across the midnight boundary and negative offsets; source classification for
  each category plus an unmapped host and a UTM override; flag/name derivation including an unmapped
  code.
- **Component:** each panel populated and empty; the disclosure renders when `identityFallback`.
- **API:** the new route returns the documented shape; the Overview route is untouched.
- **Static:** `tsc --noEmit`; ESLint via the worktree workaround (`next lint` is masked by the nested
  config — see below); full `pnpm test`.
- **Build:** `pnpm exec next build` must pass. `tsc` alone is insufficient: an App Router `route.ts`
  may only export handlers and known config keys, and a stray export fails only at build time. Keep
  helpers in sibling modules.
- **Visual:** browser check at desktop and mobile widths.

## Open item requiring a decision before ship

**Consent for persistent storage.** A `localStorage` identifier that survives across visits is a
materially different privacy posture from a per-tab session id. Under GDPR/ePrivacy this class of
storage commonly requires notice or consent, even though the value is first-party, opaque and
contains no PII. This design does not add a consent gate. Recommended minimum before ship: a short
disclosure line on published pages or in a privacy note. **Flagged for the owner's decision — not
resolved by this spec.**

## Non-goals

- Interactions, Insights and Automation tabs (D3–D5).
- Per-visitor timezone capture.
- Choropleth map rendering.
- Backfilling `visitorId` onto historical events — impossible by construction.
- Tag/interest analytics — requires a tagging feature that does not exist.
- Extending Audience to Hubs / Boards / Workspaces (D6).
