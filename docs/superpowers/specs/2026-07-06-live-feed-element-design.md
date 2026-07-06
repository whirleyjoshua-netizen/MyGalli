# Live Feed Element — Design

**Date:** 2026-07-06
**Status:** Approved (brainstorm complete) → ready for implementation plan
**Branch:** `worktree-new-elements`

## Summary

A new page element, `live-feed`, that displays a **live value the page owner
controls from their phone in real time**. The owner drops one element on their
Page, picks a **preset** from a dropdown (the "trackers"), and broadcasts live
from a mobile web control page. Public visitors see the value update every few
seconds via polling.

The core simplification: **one element + a preset dropdown**, instead of many
separate live elements. The phone is the *source*; the page element is the
*display*.

### v1 scope

- **Flagship tracker family:** manual live counter / score (no GPS, sensors, or
  BLE).
- **Presets (the dropdown):** `single`, `versus`, `goal`.
- **Capture surface:** a mobile-friendly **web control page** (`/live/[id]`),
  not a native app.
- **Transport:** **polling** (~3s), consistent with the existing codebase (no
  websockets/SSE anywhere today; the notification bell already polls).
- **Idle behavior:** the element **persists the last value** with an "ended"
  look; a **LIVE badge + pulse** shows only while broadcasting.

### v1 explicitly excludes (clean follow-ons)

Timer/stopwatch preset · GPS/sensor/wearable trackers · time-series history or
sparkline · SSE/instant push · native mobile app · multi-user co-control ·
orphan-row cleanup automation.

## Relationship to the existing `tracker` element

There is already a `tracker` element type, but it is **historical**: a static
chart of past data (e.g. 40-yard times, lifts) sourced from a `TrackerConfig`.
The live-feed element is fundamentally different — **live, phone-sourced,
streaming** — so it is a **new element type**, not a modification of `tracker`.

## Architecture

### The key split: static config vs. live state

This is the heart of the design. Two categories of data, stored separately:

| Data | Where it lives | Who writes it |
|------|----------------|---------------|
| **Static config** — preset, title, side labels, goal target, color, step size | Element JSON in `Display.sections` | Owner, in the normal element editor |
| **Live state** — `isLive`, `valueA`, `valueB`, `startedAt`, `lastUpdatedAt` | New `LiveFeed` DB row, keyed by `liveFeedId` on the element | Owner, from the phone control page (writes) + public page (reads) |

Rationale: the live state changes rapidly and must be readable by the
**unauthenticated** public page and writable independently of saving the whole
Display JSON. Keeping it in its own row decouples it from page saves and keeps
the polled payload tiny. Static config rarely changes and belongs with every
other element's config in the Display JSON.

Consequence: the **phone control page only ever touches the numbers and the
go-live on/off toggle.** Labels, target, and title are set once in the desktop
editor. This keeps the phone UI dead simple.

### Data model

New Prisma model:

```prisma
model LiveFeed {
  id            String   @id                 // = liveFeedId stored on the element
  displayId     String                       // ownership: -> Display.userId
  display       Display  @relation(fields: [displayId], references: [id], onDelete: Cascade)
  isLive        Boolean  @default(false)
  valueA        Int      @default(0)          // single/goal current; versus "home"
  valueB        Int      @default(0)          // versus "away" (ignored by single/goal)
  startedAt     DateTime?
  lastUpdatedAt DateTime @updatedAt
  createdAt     DateTime @default(now())

  @@index([displayId])
}
```

Notes:
- Values are integers in v1 (counters/scores). Money goals are represented in
  whole units (e.g. dollars); fractional/currency formatting is a display
  concern set in static config, not stored here.
- No sensitive fields — public read returns only the live numbers + flags.
- `onDelete: Cascade` from Display means deleting a Display cleans up its
  LiveFeed rows. Deleting a single *element* leaves an orphan row (harmless;
  cleanup deferred — see Edge cases).

### Element fields (in `canvas.ts` `CanvasElement`)

```
liveFeedId?: string          // stable id; generated in createElement(); links to LiveFeed row
liveFeedPreset?: 'single' | 'versus' | 'goal'
liveFeedTitle?: string
liveFeedLabelA?: string      // versus: home label; single/goal: value label
liveFeedLabelB?: string      // versus: away label
liveFeedTarget?: number      // goal: target value
liveFeedStep?: number        // control-page +/- increment (default 1)
liveFeedColor?: string       // accent color
```

## Three surfaces

### 1. Element editor — `LiveFeedElement.tsx` (desktop, in page editor)

- **Preset dropdown** (`single` / `versus` / `goal`) — the "tracker" selector.
- Config fields shown per preset: title, value label(s), goal target, step
  size, accent color.
- A **"Control live from your phone"** panel: the `/live/[liveFeedId]` link, a
  **QR code** (scan → opens on phone), and an "Open control page" button.
- Live preview of the chosen preset's display.
- Standard editor props: `{ element, onChange, onDelete, isSelected, onSelect }`.

### 2. Control page — `/live/[liveFeedId]` (owner-only, mobile-first)

- Reachable via the editor link/QR. Guarded: only the owner of the parent
  Display may control it.
- Preset-appropriate controls:
  - **single:** big current value, +/- buttons (step from config), manual entry.
  - **versus:** two sides (labels from config), each with +/- .
  - **goal:** current value with +/- and a progress bar toward the target.
- Global actions: **Go Live**, **End**, **Reset**.
- Optimistic UI; each change `POST`s to the write API; shows current LIVE state.

### 3. Public element — `PublicLiveFeedElement.tsx`

- Renders the preset's display from **static props** (title/labels/target/color).
- **Polls** `GET /api/live/[liveFeedId]` every ~3s for `{isLive, valueA, valueB,
  ...}` (see Polling hygiene).
- **LIVE badge + pulse** while `isLive`; otherwise the persisted last value with
  a subtle "ended / not live" treatment.
- Standard public props: `{ element }`.

## APIs

### `POST /api/live/[liveFeedId]` — owner-only

- Body: `{ action: 'start' | 'end' | 'bump' | 'set' | 'reset', side?: 'A'|'B',
  delta?: number, valueA?: number, valueB?: number }`.
- Auth (two cases, because the row may not exist yet — see Row creation &
  ownership):
  - **Row exists:** `getUser` → `display.userId === user.id` via
    `LiveFeed.displayId`, else `403`.
  - **Row absent (should be rare):** reject with `404` and a "save the page
    first" hint — the row is normally created on Display save, so a missing row
    means the element hasn't been saved. (This keeps write-path auth simple: it
    never has to trust a client-supplied `displayId`.)
- Applies the transition via the pure reducer, returns the new state.
- Rate-limited (reuse `src/lib/rate-limit.ts`).

### `GET /api/live/[liveFeedId]` — public

- No auth. Returns only `{ isLive, valueA, valueB, startedAt, lastUpdatedAt }`.
- If no row exists yet → return a default idle state (`isLive:false`, zeros).
- Short cache headers (effectively no-store / `s-maxage=1`) so polling sees
  fresh values. Rate-limited.

## Live-state reducer (pure, unit-tested)

A pure function `applyLiveAction(state, action) -> state` encapsulates all
transitions, independent of DB/HTTP:

- `start` → `isLive=true`, set `startedAt` if unset.
- `end` → `isLive=false`.
- `bump` → adjust `valueA` or `valueB` by `delta` (clamped at ≥ 0).
- `set` → set `valueA`/`valueB` to explicit values (clamped at ≥ 0).
- `reset` → `valueA=0`, `valueB=0`, `isLive=false`, clear `startedAt`.

## Wiring (standard "add an element" flow)

1. `ElementType` union + the `liveFeed*` fields in `src/lib/types/canvas.ts`.
2. `createElement()` default in `canvas.ts` (single source of defaults;
   `liveFeedId` generated here so the element is self-contained; the DB row is
   created when the Display is saved — see Row creation & ownership).
3. `src/components/elements/LiveFeedElement.tsx` (editor) +
   `PublicLiveFeedElement.tsx` (public).
4. `SlashCommandMenu.tsx` — new entry; its category must be in `CATEGORY_ORDER`
   (add a "Live" category or reuse "Interactive").
5. `ColumnCanvas.tsx` `renderElement` switch (preview → Public, else editor).
6. `src/components/elements/index.ts` export.
7. `src/lib/render-elements.tsx` case (the published page).

**Net-new pieces beyond a normal element:**
- Prisma `LiveFeed` model + migration (generated via `prisma migrate diff`,
  non-interactive — see project migration gotcha).
- Two API routes under `src/app/api/live/[liveFeedId]/`.
- The `/live/[liveFeedId]` control page (owner-only; ensure `middleware.ts`
  admits it under the authenticated set).
- A **reconcile step in the Display save path** that upserts a `LiveFeed` row per
  `live-feed` element (see Row creation & ownership).

## Edge cases & lifecycle

- **Row creation & ownership (revised from lazy):** the `LiveFeed` row is
  **reconciled on Display save**. The display save path already writes the
  `sections` JSON; it gains a step that, for each `live-feed` element found,
  upserts a `LiveFeed` row keyed by `liveFeedId` with the owning `displayId`
  (and prunes rows whose element was removed — optional, deferred). This means:
  - Ownership is **always derivable from the row** (`LiveFeed.displayId`), so no
    endpoint ever trusts a client-supplied `displayId`.
  - Public `GET` before the first save (no row) returns default idle state.
  - The write API expects the row to exist (created at save time); a missing row
    → `404` "save first".
- **Reset** zeroes values and ends live, keeping static config.
- **Deleted element:** orphan `LiveFeed` row remains (harmless). Deleting the
  whole Display cascades. Automated per-element cleanup deferred.
- **Polling hygiene:** ~3s interval, single-flight (no overlapping requests),
  and **pause when the tab is hidden** (`visibilitychange`) so backgrounded
  public pages don't hammer the API.
- **Auth:** control page + write API owner-only; public read open but
  rate-limited and numbers-only.
- **Published vs draft:** live state works regardless; the public page reads by
  the `liveFeedId` embedded in the published element JSON.

## Testing

- **Pure reducer:** `applyLiveAction` transitions (`start`/`end`/`bump`/`set`/
  `reset`, clamping, `startedAt` handling).
- **API:** ownership enforcement (non-owner → 403); public read shape and
  default-idle behavior when no row exists.
- **Components:** public element renders each of the three presets; polling hook
  fires on interval and pauses when the tab is hidden.

## Success criteria

1. Owner adds a Live Feed element, picks a preset, sets labels/target.
2. Owner opens `/live/[id]` on their phone (via link/QR), hits Go Live, and
   changes the value.
3. Within ~3s, a visitor on the published Page sees the value update and a LIVE
   indicator.
4. Owner hits End; the public element keeps showing the last value in an
   "ended" state.
5. Non-owners cannot write to the feed.
