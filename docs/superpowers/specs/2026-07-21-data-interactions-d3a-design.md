# D3a — Interactions tab: the Element Operating System

**Date:** 2026-07-21
**Phase:** D3a of the Data Intelligence Center program (D1 Overview ✅, D2 Audience ✅)
**Status:** Design approved, ready for planning

## Problem

The Data page treats every element the same. `ElementsTab.tsx` fetches one page's
elements and renders a flat vertical stack of nine card types — no status, no grouping,
no filtering, no sense of which widgets are working. `BulletinAnalyticsTab.tsx` is a
second, unrelated list in its own tab. Neither was touched by D1 or D2, so both still
predate the cockpit.

But elements are not list items. They collect leads, start conversations, sell,
take RSVPs, build waitlists. Each one is a small application with its own state and
its own audience. The page should read like a command center for those applications.

## Solution

Replace the **Elements** and **Bulletin** tabs with a single account-wide
**Interactions** tab: every data-collecting element the user owns, across every page
and their bulletin, grouped by type, each rendered as a status card with live counts,
location, engagement, and quick actions into a detail drawer.

### Tab structure

Final tab set is **Overview · Audience · Interactions**. The Bulletin tab is removed.
`?tab=bulletin` and `?tab=elements` both redirect to `?tab=interactions` so existing
links keep working. The page selector in `PageHero` is hidden while Interactions is
active, because this tab is account-wide rather than page-scoped.

### Scope decisions

| Question | Decision |
|---|---|
| Scope | Account-wide, all pages at once |
| Engagement % | Unique responders ÷ unique page viewers |
| Status | Derived from page + activity, no schema change |
| Inventory | Data-collecting elements only |
| Bulletin | Mixed into type groups with a `Bulletin` chip + source filter |
| Card actions | Slide-over detail drawer |
| Liveness | Lightweight 30s pulse endpoint, patches cards in place |
| Assembly | On-demand aggregation with guards |
| Needs Reply | Reframed to **Needs Attention**; replying does not exist |

## What is in the inventory

Included, because they have a real response store:

| Element types | Store |
|---|---|
| mcq, rating, shortanswer, poll, wedding-rsvp, business-review, rsvp | `FormResponse` |
| comment | `Comment` |
| mailbox | `Message` |
| waitlist | `WaitlistSignup` |
| appointments | `Booking` |
| jersey | `JerseySignature` |
| bulletin poll / rating / question | `BulletinResponse` via `BulletinPost` |

**`Comment` is page-scoped, not element-scoped.** It has no `elementId` column, so
comments cannot be attributed to a specific comment wall. A page's comment total is
shown on the *first* comment element on that page; a second comment element on the same
page reads the same rows and shows 0 rather than double-counting into
`totals.responses`. Comment counts also refresh on full load rather than on the 30s
pulse, since attributing them requires section parsing the pulse endpoint avoids.

Excluded and why:

- **tip-jar** — no store exists; it can only ever report clicks.
- **tracker** — `TrackerEntry` is owner-entered data, not visitor responses.
- **Static elements** (gallery, text, countdown, map, flowchart, whiteboard, link-hub,
  index, audio-player, product-list, …) — nothing to report; they already appear in
  Overview's Widget Performance table.
- **`WaitlistEntry`** is the marketing landing-page list and is unrelated to the
  waitlist element. Do not query it here.

## Metric definitions

These are the definitions the implementation must honour. Past reviews on D1 and D2
caught fabricated and mismatched-denominator metrics; every number below is derivable
from data that exists today.

**Engagement %** = unique visitors who responded to the element ÷ unique visitors who
viewed the page hosting it, over the selected window. Clamped to 0–100. Returns `null`
(rendered as "—") when the page has fewer than 20 unique viewers, so a page with three
views cannot display "100%". Both sides of the ratio are keyed by `visitorId`, the
persistent id D2 introduced — never by event count.

**Status** (derived, mutually exclusive, first match wins):

| Status | Rule |
|---|---|
| `needs-attention` | Unread mailbox messages, or responses newer than the local last-seen stamp, or pending RSVP/waitlist entries |
| `live` | Page is published **and** a response arrived in the last 24h |
| `draft` | Page is not published |
| `idle` | Published, no response in 30 days |

**Where status is computed.** Part of the `needs-attention` rule depends on a
`localStorage` stamp the server cannot see, so status is finalised on the client. The
route returns the raw inputs per element — `published`, `lastResponseAt`,
`unreadCount`, `pendingCount` — and `deriveStatus()` runs in the browser, merging the
local stamp. `deriveStatus` therefore takes `lastSeenAt` as an argument and stays pure.

Consequently `totals.needsAttention` is **not** returned by the route; the client
derives it from the finalised statuses. The route returns the other four totals
(`elements`, `responses`, `avgEngagement`, `liveNow`), which depend only on server data.

**Needs Attention count** = the number of elements in `needs-attention`. "Avg. Reply
Time" and "Unanswered" are **not** implemented: no reply capability exists anywhere in
the codebase (`FormResponse` has no reply field; `Message` has only a `read` boolean).

**Last-seen stamps** live in `localStorage` under `galli_element_seen`, keyed by the
composite element key, and are written when the drawer opens for that element.
Per-device by design — this avoids a migration, at the cost of not following the user
between devices.

## Architecture

### `src/lib/element-os.ts` — pure, DB-free

All logic lives here so it is testable without a database (the local dev DB is
`db push`-drifted and unreliable).

- `collectDataElements(sections, tabs)` → `{key, elementId, type, title, pageId,
  sectionIndex, tabLabel}[]`. Walks main sections **and every tab's sections**. D2's
  review caught section engagement silently ignoring tabbed pages; this must not repeat.

  **Sections have no names.** `Section` is `{id, layout, columns}` — there is no title
  field, so the mockup's "Hero Section" is not derivable. The location line renders as
  `Page title · Section 2`, or `Page title · Tab label · Section 2` for tabbed pages,
  using the 1-based position.

  **Elements have no creation date.** Nothing records when an element was added, so
  "Created July 10" is not implementable and sort modes are activity-based rather than
  age-based: most active, least active, recent activity, longest idle.
- `deriveStatus({published, lastResponseAt, unreadCount, pendingCount, lastSeenAt, now})`
  → runs on the client, since `lastSeenAt` comes from `localStorage`
- `computeEngagement({responders, pageViewers})` → `number | null`
- `groupByType(elements)` → ordered groups
- `sortElements(elements, mode)` → most active / least active / newest / oldest

**Keys.** `makeBlock()` element ids are deterministic, so an element id is unique only
*within* a page. Every key in this feature is the composite `displayId:elementId`, and
bulletin instruments key as `bulletin:postId:elementId`. Using a bare element id will
collide across pages.

### `GET /api/data/elements`

1. `display.findMany({ where: { userId } })` — id, title, slug, published, sections, tabs.
2. Parse each display into data-collecting elements. Cap at 200 displays and `log` when
   truncated; never truncate silently.
3. Grouped count queries — `groupBy`, never row loads — scoped to those displayIds:
   `FormResponse`, `Comment`, `Message`, `WaitlistSignup`, `Booking`,
   `JerseySignature`. `BulletinResponse` joins through the user's `BulletinPost`s.
4. `AnalyticsEvent` grouped for unique viewers per page and unique responders per
   element → engagement.
5. Fold into `ElementSummary[]` plus the five strip totals.

Returns `{ elements: ElementSummary[], totals: { elements, responses, avgEngagement,
liveNow } }`. Each `ElementSummary` carries the status inputs (`published`,
`lastResponseAt`, `unreadCount`, `pendingCount`) rather than a finished status.

### `GET /api/data/elements/pulse`

Returns only `[{ key, lastResponseAt, todayCount, live }]` — roughly 1KB. Polled every
30s and merged into existing card state. D1's review flagged the Overview tab refetching
a multi-MB payload on its 20s poll; this tab is account-wide and must not repeat it.

### `GET /api/data/elements/[displayId]/[elementId]`

The drawer payload: full response list or roster, plus a 30-day responses-per-day series.
Bulletin instruments are served through the existing `/api/bulletin/analytics` data.

### Route file constraint

An App Router `route.ts` may export **only** route handlers and known config keys.
Exporting a helper for testability fails `next build` with
`not assignable to type 'never'` — invisible to `tsc`, and it broke a prod deploy
already. All helpers go in `src/lib/element-os.ts` or a sibling module.

## UI

Components live in `src/components/analytics/interactions/`.

Layout is two columns, `lg:grid-cols-[1fr_320px]`, matching Overview's cockpit so the
tabs read as one product:

```
┌─────────────────────────────────────┬──────────────────┐
│ InsightsStrip (5 stats)             │ FilterRail       │
├─────────────────────────────────────┤  search          │
│ TypeGroup "Polls" (4)      View all │  type chips      │
│  [ElementCard] [ElementCard] [...]  │  status + counts │
├─────────────────────────────────────┤  source          │
│ TypeGroup "Questions" (2)           │  sort            │
└─────────────────────────────────────┴──────────────────┘
```

- **`InteractionsTab.tsx`** — owns the fetch, the pulse poll, and filter state.
- **`InsightsStrip.tsx`** — Elements · Responses · Avg Engagement · Needs Attention ·
  Live Now. The last two are clickable and set the matching filter.
- **`FilterRail.tsx`** — search, type chips, status checkboxes with counts, source
  (All / Pages / Bulletin), sort select. Collapses above the grid on mobile.
- **`TypeGroup.tsx`** — collapsible, sticky header with count.
- **`ElementCard.tsx`** — shared chrome: title, `Page · Section` location or a
  `Bulletin` chip with post date, status pill, primary stats, last-activity line,
  actions row (`Analytics` · `Responses` · `Edit` · ⋮).
- **`card-bodies/`** — one small component per type: distribution bars for poll/MCQ,
  star average for rating, latest excerpts for short answer/comment, capacity meter for
  waitlist, next slot for appointments, unread count for mailbox. Reuses the existing
  `DistributionBar`.
- **`ElementDrawer.tsx`** — slide-over with Responses and Analytics tabs. The nine
  existing `element-cards/*` bodies move in here largely intact, preserving today's
  rosters and CSV export.

`Edit` deep-links into the editor at the owning page. Bulletin instruments link to the
bulletin post instead.

**States.** Skeleton cards on first load, so the grid's shape appears immediately.
Empty state uses `DataIllustration` with an "Add a poll or form to a page" CTA. Error
state offers Retry, matching Overview.

**Live behavior.** Pulse patches counts in place; a card whose count rises briefly
highlights and its LIVE pill animates. Polling stops when `document.hidden`.

## Testing

- **`element-os.ts`** carries the weight: collection across main **and tabbed**
  sections; status derivation at each boundary (published/unpublished, 24h, 30d);
  engagement clamping and the below-floor `null`; grouping; sorting; and composite-key
  uniqueness when two pages hold the same deterministic element id.
- **Routes**, with mocked Prisma: ownership (another user's displays never appear), the
  bulletin join, pulse payload shape, the 200-display cap logging.
- **Components**: filter and search interaction, strip click-to-filter, group collapse,
  drawer open/close, skeleton and empty states.
- **`/api/bulletin/analytics`** gets its first tests, since the drawer now depends on it.

The entire feature must be testable without a database.

## Risks

1. **Ownership leakage** — this route reaches across seven tables at once. Every query
   carries an explicit user scope, with a test asserting a second user's rows never
   surface. The M3b cross-tenant Blob-deletion bug is the precedent.
2. **`route.ts` export constraint** — see above; broke prod once.
3. **Query fan-out** — counts only, never row loads; the drawer pays for detail.
4. **Missing `'use client'`** — D1's review found two public elements missing it,
   500-ing published pages. Verify each new file.
5. **Removing `BulletinAnalyticsTab`** drops the only consumer of
   `/api/bulletin/analytics`; the route stays for the drawer and gains tests.
6. **Stale Prisma client** — merging a branch carrying a new model produces phantom
   `tsc` errors; `pnpm exec prisma generate` fixes it.

## Non-goals (deferred to D3b / D3c)

Preview thumbnails, per-element timeline, health rings, bulk actions, AI insight cards,
and connections (element ↔ workspace ↔ community ↔ automation — depends on D5
Automation existing). Also out: replying to responses, tip-jar and tracker cards, and
`Avg. Reply Time`.
