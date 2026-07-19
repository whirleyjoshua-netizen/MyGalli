# Data Intelligence Center — D1: Event Layer + Overview Cockpit — Design

**Date:** 2026-07-19
**Status:** Approved (mockup + user direction)
**Base:** `origin/main` @ `c206403`. Branch `feat/data-cockpit-d1` (worktree `.claude/worktrees/data-cockpit`).
**Supersedes the Overview portion of:** `2026-07-19-data-redesign-design.md` (that redesign shipped as `bca64db`).

## Context

The Data page today is an analytics page: 4 tabs (Overview / Elements / Bulletin / Messages), 3 sparkline
stat cards, four breakdown cards, a static Insights panel.

The agreed direction is that Data becomes Galli's **Intelligence Center** — the operational brain answering
"what is happening with this thing I created?" — eventually across every publishable object (pages, boards,
hubs, workspaces, events), with a consistent five-tab model: **Overview · Audience · Interactions · Insights ·
Automation**.

That full vision is a multi-phase program, not one spec. It is decomposed as:

| Phase | Scope | Depends on |
|---|---|---|
| **D1** (this spec) | Event layer + Overview cockpit | — |
| D2 | Audience tab (geo, devices, sources, new vs returning, peak hours) | D1 events |
| D3 | Interactions tab (per-element mini-dashboards; absorbs Elements + Bulletin) | D1 events |
| D4 | Insights tab (AI summaries + recommendations) | D1–D3 data |
| D5 | Automation (IF/THEN rules engine) | own schema; a product in itself |
| D6 | Breadth: same five tabs for Hubs / Boards / Workspaces / Events | D1–D4 shape settled |

**Why the event layer comes first.** Investigation of the schema found that `AnalyticsEvent.eventType`
defaults to `'view'` and *nothing in the codebase ever writes any other value*; `country`/`city` columns
exist but are never populated. Live Activity, Widget Performance, the engagement heat map, Page Health, all
of Audience and all of Insights therefore have no data source today. Building the cockpit UI first would
render placeholder panels over data that does not exist. D1 fixes the foundation and the surface together so
every panel that ships is real.

## Decisions

- **Five stat cards, all real:** Views, Unique Visitors, Followers, Shares, Interactions. The mockup's
  *Bookmarks* card is dropped — page-level bookmarking is not a feature in Galli (the existing
  `HubNoteBookmark` is an unrelated PDF-highlight concept inside Hub notes). A visitor-facing bookmark
  feature is out of scope here and would need its own spec.
- **Generic interaction event.** `eventType` gains `'interact'` and `'share'`; `'interact'` carries
  `metadata: { elementId, elementType, action }`. Chosen over an explicit event type per interaction so new
  element types need no schema or query changes.
- **Geo via platform header.** `country` is populated from `x-vercel-ip-country` in the track route. No
  third-party GeoIP service, no extra latency. Country granularity only.
- **Page Health is a pure growth score**, matching the mockup, with an insufficient-data guard (below).
- **Live Activity polls** every 20s while the tab is visible — consistent with the existing
  `NotificationBell` polling pattern, no new infra. SSE was rejected: in-memory presence on serverless is
  already a known backlog problem.
- **Right rail = Page Health + Quick Actions + Top Referrers.** The mockup's *Recent Automations* panel is
  D5; the Top Referrers donut moves into the rail to balance column height and leaves a clean slot for
  Automations later. No disabled/"coming soon" placeholder panels.
- **Only working tabs are shown.** Audience / Interactions / Insights / Automation do not appear in the
  strip until their phase ships. Messages moves out of Data to its own sidebar item (it is an inbox, not
  analytics). Elements and Bulletin remain as tabs until D3 absorbs them.
- **Section labels are derived, not stored.** `Section` is `{ id, layout, columns }` with no name field. The
  heat map labels each section from its first heading element's text, falling back to its dominant element
  type ("Gallery", "Timeline"), falling back to "Section N".

## Architecture

### Data layer

No new models and no migration for the event work — `AnalyticsEvent` already carries `metadata`, `country`,
`city`.

- **Changed:** `src/lib/analytics.ts` — add `trackInteraction(displayId, elementId, elementType, action)`
  and `trackShare(displayId, channel)` alongside the existing `trackPageView`.
- **Changed:** `src/app/api/analytics/track/route.ts` — accept the new event types, validate `metadata`
  shape, and populate `country` from `x-vercel-ip-country`.
- **Changed (call sites):** fire `trackInteraction` from the public element components — poll vote, rating
  submit, form submit, link-hub click, video/audio play, calendar save, tip jar, RSVP. Fire `trackShare`
  from the existing social-share UI.
- Followers are read from `Follow.createdAt`; no event needed.

### API

`GET /api/analytics/[displayId]?days=N` gains the following **additive** fields. The Home-page
`AnalyticsPanel` shares this route and must remain unaffected.

- `summary` gains `interactions`, `shares`, `followers`.
- `previous` — the same five metrics over the immediately preceding window of equal length, so deltas are
  computed from real data rather than faked.
- `health` — `{ score: number, band: 'excellent'|'good'|'fair'|'needs-attention', drivers: {label, delta}[],
  insufficientData: boolean }`.
- `liveActivity` — the most recent ~20 events as `{ type, country, label, at }`.
- `widgetPerformance` — interact events grouped by `metadata.elementType` with a per-type primary stat.
- `sectionEngagement` — derived section label + interact count, ordered descending.

### Components

Layout moves from `max-w-6xl` single column to **`max-w-7xl` with `lg:grid-cols-[1fr_320px]`**; the rail
stacks below the main column on narrow screens.

New, under `src/components/analytics/overview/`:

| Component | Purpose |
|---|---|
| `StatCardRow` | Five metric cards: value, delta badge, sparkline |
| `HealthGauge` | SVG arc score + band + growth drivers |
| `LiveActivityFeed` | Visibility-gated 20s poll, relative timestamps, country flag |
| `SectionEngagementBars` | Derived-label horizontal bars |
| `WidgetPerformanceTable` | Per-element-type rows with trend sparkline |
| `ReferrerDonut` | Donut + legend with percentages |
| `QuickActions` | Create page / Share / View as visitor / Page settings |

Reuses the existing `Sparkline` and `DataIllustration`. `src/app/(dashboard)/data/page.tsx` composes them;
its Overview branch is replaced.

## Requirements

- **R1 — Event types.** `trackInteraction` and `trackShare` write `AnalyticsEvent` rows with
  `eventType: 'interact' | 'share'`. Interact rows carry `metadata: { elementId, elementType, action }`.
  Malformed metadata is rejected by the route, not persisted.
- **R2 — Geo.** The track route sets `country` from `x-vercel-ip-country` when present, leaving it null
  otherwise (local dev). `city` is never written. Raw IPs are never stored.
- **R3 — Instrumentation.** Every call site listed above fires its event exactly once per user action, and a
  tracking failure never blocks or breaks the visitor-facing interaction.
- **R4 — Stat cards.** Five cards, each showing the period value, a delta vs. `previous`, and a sparkline.
- **R5 — Deltas.** Percentage change vs. the preceding equal-length window. A zero baseline with a non-zero
  current value renders "New", never `+∞%` or `+100%`.
- **R6 — Page Health.** A 0–100 score derived purely from period-over-period growth. Each of the five
  metrics contributes an equally-weighted 20 points, scored on its growth rate vs. the previous window:
  a metric that is flat scores 10/20, one that has grown 50%+ scores the full 20, one that has fallen 50%+
  scores 0, and growth in between interpolates linearly. A metric with a zero baseline and any positive
  value scores the full 20. The total is rounded to an integer and banded: ≥85 excellent, ≥70 good,
  ≥50 fair, below that needs-attention. `drivers` lists the metrics with the largest absolute movement.
  When the period has fewer than 20 views, `insufficientData` is true and the panel renders "Not enough
  data yet — keep sharing" instead of a score.
- **R7 — Live Activity.** Renders the most recent events with relative time and country. Polls every 20s
  only while `document.visibilityState === 'visible'`. Never identifies a visitor beyond country.
- **R8 — Widget Performance.** Interact events grouped by `elementType`, each row showing a trend sparkline
  and a primary stat chosen by an explicit per-type map: poll → "% of viewers who voted"; rating →
  "N interactions"; form → "N submissions"; video/audio → "N plays"; calendar → "N saves"; link-hub →
  "N clicks"; tip-jar → "N tips". Any element type absent from the map falls back to "N interactions".
- **R9 — Section engagement.** Sections labelled by the derivation rule above, ranked by interact count.
- **R10 — Right rail.** Page Health, Quick Actions, Top Referrers, in that order; stacks below main on
  mobile.
- **R11 — Tab strip.** Overview / Elements / Bulletin only. Messages is removed from Data and reachable from
  the sidebar. No placeholder tabs for unbuilt phases.
- **R12 — Empty states.** Every panel has an illustrated empty-state via `DataIllustration`; none renders a
  bare "No data yet" line, and none renders fabricated sample data.

## Verification

- **Unit (pure functions, TDD):** health scoring including the insufficient-data guard and zero-baseline
  cases; delta math; section-label derivation across all three fallbacks; widget grouping; live-activity
  event → label shaping.
- **Component:** smoke tests for each new component in populated and empty states; `LiveActivityFeed`
  asserts polling pauses when the document is hidden.
- **API:** the route returns the new fields and the pre-existing response shape is unchanged (guarding
  `AnalyticsPanel`).
- **Static:** `tsc --noEmit` clean; authoritative ESLint clean (worktree needs `root:true` + direct
  `eslint`, not `next lint`); full `pnpm test` green.
- **Visual:** browser check of Overview against the mockup at desktop and mobile widths — five cards wrap
  sensibly, rail stacks, gauge renders, feed ticks.

## Non-goals

- Audience, Interactions, Insights and Automation tabs (D2–D5).
- Page-level bookmarking as a feature, and therefore the Bookmarks stat card.
- Session duration / bounce rate / peak hours — these need leave-event tracking and belong to D2's Audience
  work.
- Extending the cockpit to Hubs / Boards / Workspaces / Events (D6).
- Real-time transport (SSE/WebSocket) for Live Activity.
- Backfilling historical interaction data — deltas and panels start accumulating from deploy.
