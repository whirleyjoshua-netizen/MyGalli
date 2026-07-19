# Data (Analytics) Overview Redesign — Design

**Date:** 2026-07-19
**Status:** Approved (mockup + user direction)
**Base:** `main` @ `cdea2c0` (PageHero + Library redesign live). Branch `feat/data-redesign` (worktree).
**Program:** 2nd of 3 page content-redesigns toward user mockups (Library ✅ → **Data** → Explore).

## Goal
Redesign the Data page's **Overview** tab to match the mockup: a header **subtitle**, three stat cards each with a **sparkline**, white **card styling** with title icons, **illustrated empty-states** for Device/Browser/Referrers/Activity (replacing plain "No data yet" text), and a green **Insights** panel with four tips + a sprout illustration. Keep all existing analytics behavior (period selector, display selector, tab nav) intact.

### Decisions
- **Real sparkline data for all three stat cards** via a small additive API change (no faking): the analytics route already returns per-day `viewsByDay`; add `uniqueVisitorsByDay` (distinct `sessionId` per day) and `topReferrerByDay` (per-day count for the top referrer domain). Additive JSON fields — safe; the home-page `AnalyticsPanel` sharing this route is unaffected.
- **Extract the reusable `Sparkline`** (currently module-private in `AnalyticsPanel.tsx`) into `src/components/analytics/Sparkline.tsx`, export it, and use it in both places (DRY).
- **Illustrated empty-states** are net-new inline SVG (`DataIllustration.tsx`), decorative, brand-tinted — same pattern as Library's `AppIllustration`. They render only when a card has no data; populated cards keep their existing bars/lists.
- **Insights panel** is static copy + a sprout SVG. On-brand green tint.
- Stat-card metric colors: Views = `galli-aqua`, Visitors = `galli`, Referrer = `galli-violet` (matches the mockup's blue/green/purple, on-brand).

## Architecture / components
- **Changed:** `src/app/api/analytics/[displayId]/route.ts` — add `uniqueVisitorsByDay` + `topReferrerByDay` to the response (additive).
- **New:** `src/components/analytics/Sparkline.tsx` — exported `Sparkline({ values, className })` (extracted verbatim from `AnalyticsPanel`).
- **Changed:** `src/components/dashboard/AnalyticsPanel.tsx` — import the shared `Sparkline` (remove the local copy). No behavior change.
- **New:** `src/components/analytics/DataIllustration.tsx` — inline-SVG spot art, variants `device` / `browser` / `referrer` / `activity` / `sprout`; decorative (`aria-hidden`), self-contained, brand-tinted.
- **Changed:** `src/app/(dashboard)/data/page.tsx` — add the `subtitle` to `PageHero`; rewrite the Overview branch (currently ~228–410): stat cards → sparkline cards; Device/Browser/Referrers/Activity → white cards with title icons + illustrated empty-states; add the Insights panel. All data wiring reuses the existing `analytics` state (now including the two new per-day series).

## Requirements
- **R1 — API:** add `uniqueVisitorsByDay: Record<string, number>` (distinct sessionId count per `YYYY-MM-DD`) and `topReferrerByDay: Record<string, number>` (per-day count for the single top referrer domain; empty if none). Existing fields unchanged. The `AnalyticsData` type in `data/page.tsx` gains the two optional fields.
- **R2 — Subtitle:** `PageHero` for Data gets `subtitle="Insights and analytics to help you understand and grow."`.
- **R3 — Stat cards (3):** white `rounded-2xl border bg-surface shadow-soft` cards; tinted icon chip + label; big value; period subline; a right-aligned `Sparkline` in the metric color. Views spark = `viewsByDay`; Visitors = `uniqueVisitorsByDay`; Referrer = `topReferrerByDay` (each mapped over sorted day keys). Sparkline hidden gracefully when < 2 points (existing `Sparkline` already handles this).
- **R4 — Breakdown/list cards:** Device / Browser / Top Referrers / Recent Activity keep their populated rendering (bars/lists) but move to white card styling with a title icon (`Monitor`/`Globe`/`Link2`/`Clock`). When empty, render a `DataIllustration` + heading ("No data yet") + descriptive copy instead of the plain text line.
- **R5 — Insights panel:** a green-tinted (`bg-galli/5` / `border-galli/20`) rounded panel: lightbulb icon + "Insights" + "Track your growth and discover opportunities."; a 4-col grid of tips (Grow Your Audience / Create Engaging Content / Analyze & Optimize / Achieve Your Goals) each with an icon + title + copy; a `DataIllustration variant="sprout"` on the right (hidden on small screens).

## Verification
- **Unit:** `Sparkline` renders a `<polyline>` for ≥2 values and a placeholder for <2; `DataIllustration` renders an `aria-hidden` `<svg>` per variant; API route helper math for the two new per-day maps (or assert via the route test if one exists). A `data/page` smoke: Overview renders stat cards + Insights panel; empty analytics → illustrated empty-states.
- **Static:** `tsc --noEmit`; authoritative `eslint` (root:true worktree workaround) 0 errors; existing analytics/dashboard tests green (esp. anything covering `AnalyticsPanel`).
- **Visual:** browser check Overview vs mockup — sparklines render, empty-states show illustrations, Insights panel + sprout, period selector still filters.

## Non-goals (later)
- Date-range *picker* component (the existing 7/30/90 select stays; only restyled minimally).
- New analytics metrics/tracking; per-element or funnel analytics.
- High-fidelity illustration art (moderate inline SVG now).
- Explore redesign (separate spec, next).
