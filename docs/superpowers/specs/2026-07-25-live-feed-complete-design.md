# Live Feed — Complete the Real-Time-Event Element — Design Spec

## Goal

Finish the `live-feed` element as MyGalli's real-time-event element: the thing a page shows while
something is *happening now* — a scoreboard, a fundraiser thermometer, a countdown, a live
leaderboard, an audience poll. Add N-value support, a pausable game clock, a rebuilt phone
control surface, and audience-tap voting.

## Why

Today the element offers three presets (`single`, `versus`, `goal`) driven by a phone control
page, backed by one volatile `LiveFeed` row with two fixed integer columns (`valueA`, `valueB`).
It cannot express a three-team scoreboard, a multi-option poll, a clock, or audience
participation — the core of what "live" events look like.

## What this is NOT (settled in brainstorm)

- **Not the `tracker` element.** The tracker already owns *progress over time* — dated
  `TrackerEntry` history, a chart, an entry modal, and an `athlete` kit with a "Lift Tracker."
  The student-athlete lifting example is a tracker use case and is already shipped. Live feed
  answers "what's happening right now?"; tracker answers "how am I doing over time?" This spec
  does not touch the tracker.
- **Not a standalone library "app."** A live feed stays **element-bound**: the `LiveFeed` row's
  id *is* the element's id. There is no separate "which display" step and no create/manage
  surface — the feed lives where you drop the element. One feed per placement.

## Current state (as of `5bfcf48`)

- **Model** `LiveFeed` (`prisma/schema.prisma`): `id` (= element id), `displayId`, `isLive`,
  `valueA Int`, `valueB Int`, `startedAt DateTime?`, `lastUpdatedAt`, `createdAt`.
- **Pure reducer** `applyLiveAction(state, action, now)` in `src/lib/live-feed.ts` —
  `start | end | reset | bump | set`. `set` is currently unused by any UI (dead path).
- **API** `src/app/api/live/[liveFeedId]/route.ts` — `GET` public (numbers only, `no-store`,
  read rate-limit 600/min per feed); `POST` owner-only (write rate-limit 240/min), applies one
  action and persists.
- **Public render** `PublicLiveFeedElement.tsx` — polls `GET` every 3s, pauses when the tab is
  hidden, renders one of the three presets. Element config fields on `CanvasElement`:
  `liveFeedPreset`, `liveFeedTitle`, `liveFeedLabelA/B`, `liveFeedTarget`, `liveFeedColor`.
- **Control page** `src/app/live/[liveFeedId]/page.tsx` — owner-only ± steppers for A/B, plus
  Go Live / End / Reset.
- **Reconcile on save** (`src/app/api/displays/[id]/route.ts:157`): `findLiveFeedIds` deep-walks
  the saved `sections`/`tabs`/`headerCard` JSON and `createMany({ skipDuplicates: true })` a row
  per live-feed element id. Idempotent.
- **Precedent for audience voting**: the separate `poll` *element*
  (`src/app/api/displays/[id]/poll/route.ts`) dedupes with a client-generated `sessionId` stored
  against `FormResponse`. This spec follows the same best-effort dedupe idea.

## Decisions (locked in brainstorm)

| Question | Decision |
|---|---|
| What is live feed for? | Real-time, event-scoped numbers an owner updates while an audience watches. |
| Athlete/lifting example | It's the **tracker**, already shipped. Out of scope. |
| Feed binding | **Element-bound** (feed id = element id). Not a standalone app. |
| New presets | Add **leaderboard** (N competitors) and **poll** (N options) to single/versus/goal. |
| Values beyond A/B | Yes — migrate `valueA/valueB` to a **labeled values list**. |
| Timer | A **clock any preset can toggle on**, not a separate preset. |
| Clock type | **Pausable game clock** (server-authoritative, ticks client-side). |
| Poll intake | **Audience-tap voting** in this build (public write path). |
| Realtime transport | **Polling stays** (3s). True SSE/websockets is out of scope. |

## Part A — Data model

`LiveFeed` changes (one Prisma migration, applied to the shared dev DB via `prisma db execute`
per `COORDINATION.md`):

```prisma
model LiveFeed {
  id            String    @id
  displayId     String
  display       Display   @relation(fields: [displayId], references: [id], onDelete: Cascade)
  isLive        Boolean   @default(false)
  values        Json      @default("[]")   // ordered [{ id, label, value, color? }]
  startedAt     DateTime?
  // Pausable clock (see Part C for the algorithm)
  clockMode     String    @default("off")  // 'off' | 'countup' | 'countdown'
  clockRunning  Boolean   @default(false)
  clockElapsedMs Int      @default(0)      // accumulated ms while running, as of last change
  clockLastStartedAt DateTime?             // server time the clock last started/resumed; null when paused
  clockDurationMs Int?                     // countdown total, e.g. 720000 for 12:00
  lastUpdatedAt DateTime  @updatedAt
  createdAt     DateTime  @default(now())
  votes         LiveFeedVote[]
  @@index([displayId])
}

model LiveFeedVote {
  id         String   @id @default(cuid())
  liveFeedId String
  liveFeed   LiveFeed @relation(fields: [liveFeedId], references: [id], onDelete: Cascade)
  voterKey   String   // client sessionId — best-effort, not identity
  optionId   String
  createdAt  DateTime @default(now())
  @@unique([liveFeedId, voterKey])   // one vote per (feed, visitor)
  @@index([liveFeedId])
}
```

Migration backfill: `values = [{ id, label: "", value: valueA }, { id, label: "", value: valueB }]`
built from the old integer columns (index 0 = `valueA`, index 1 = `valueB`), then drop
`valueA`/`valueB`. Labels are left empty on purpose — see the label rule below, which resolves
empty entry labels against the element config, so the migration never needs to read element JSON.
The backfill SQL builds the array from the existing columns before the drop, so no live counts
are lost. `reset` and new rows use `[]`.

**A value list entry** is `{ id: string, label: string, value: number, color?: string }`. `id`
is a short stable key (e.g. `cuid`/nanoid) so bumps and votes target an entry that survives
reorder/rename. `value` is clamped to `[0, 1_000_000_000]` (existing `MAX_VALUE`).

**Where data lives.** The **element config** (`CanvasElement`) owns *appearance*: preset, clock
settings, poll-reveal mode, color, title, and the seed labels `liveFeedLabelA/B`. The **row**
owns *live data*: the values list and clock state. Competitor/option rosters are built at event
time on the control page, not in the page editor — a lineup is event data, not page design.

**Label rule (resolves the seeding question cleanly).** A value entry's displayed label is
`entry.label || elementFallback(index)`, where the fallback is `liveFeedLabelA` for index 0,
`liveFeedLabelB` for index 1, and empty otherwise. So `single`/`versus`/`goal` get their labels
from the element config for free (entries carry empty labels), while `leaderboard`/`poll` entries
— which have no element fallback — must be named on the control page, which is exactly right.
The control page writes `entry.label` via `renameValue`, overriding the fallback.

**Empty-row rule.** A freshly reconciled row has `values: []`. Both the public element and the
control page render a **preset-shaped default at zero** derived from the element config when the
row is empty: `single`/`goal` → one entry, `versus` → two entries (labels from the fallback),
`leaderboard`/`poll` → an empty state prompting the owner to add competitors/options. The row
becomes authoritative the moment the owner's first action persists real entries. This keeps the
reconcile step ignorant of element config — it only ever writes `{ id, displayId }`.

New `CanvasElement` fields (all optional, additive to `src/lib/types/canvas.ts`):

```ts
  liveFeedPreset?: 'single' | 'versus' | 'goal' | 'leaderboard' | 'poll'
  liveFeedClock?: 'off' | 'countup' | 'countdown'   // owner can also toggle live; this is the default
  liveFeedPollReveal?: 'always' | 'after-vote'
  // existing: liveFeedTitle, liveFeedLabelA/B, liveFeedTarget, liveFeedColor
```

## Part B — Reducer and actions

`applyLiveAction` moves from A/B to id-addressed value actions, keeping its pure
`(state, action, now) => state` shape (the server always passes its own clock as `now`, so no
client time can set a value — the invariant held across the codebase).

New `LiveAction` union:

```ts
type LiveAction =
  // feed lifecycle
  | { action: 'start' } | { action: 'end' } | { action: 'reset' }
  // value list
  | { action: 'addValue'; label: string }
  | { action: 'removeValue'; id: string }
  | { action: 'renameValue'; id: string; label: string }
  | { action: 'bump'; id: string; delta: number }
  | { action: 'set'; id: string; value: number }
  // clock
  | { action: 'clockConfig'; mode: 'off' | 'countup' | 'countdown'; durationMs?: number }
  | { action: 'clockStart' } | { action: 'clockPause' }
  | { action: 'clockSet'; elapsedMs: number } | { action: 'clockReset' }
```

- `reset` returns the idle state: `isLive:false`, `values:[]`, `startedAt:null`, clock off/zeroed.
- `bump`/`set` locate the entry by `id`; a missing id is a no-op (returns state unchanged), never
  a throw — mirrors the current reducer's defensive style.
- `removeValue` also deletes nothing else; votes referencing a removed option are simply orphaned
  (harmless — tallies live on the value, not recomputed from votes).
- Clock actions are specified in Part C.

The API route keeps its shape: owner-check, parse action, `applyLiveAction(current, action, now)`,
persist, return the serialized row. `serialize()` gains `values`, all clock fields, and a
`serverTime` (the response's `new Date().toISOString()`) — the clock algorithm needs it.

## Part C — The pausable clock (the careful part)

**Requirement:** a game clock that stops and starts (football clocks pause constantly), ticks
smoothly on every viewer's screen without a server round-trip per second, and never drifts or
lets a client's wall clock forge the time.

**Server state** (on the row): `clockMode`, `clockRunning`, `clockElapsedMs`,
`clockLastStartedAt`, `clockDurationMs`. `clockElapsedMs` is the total elapsed time accumulated
across all *completed* run segments — i.e. the elapsed value as of the last start/pause/set.

**Reducer transitions** (all use the server-supplied `now`):

- `clockConfig(mode, durationMs)` → set `clockMode`, `clockDurationMs`; leave elapsed/running as
  they are unless mode becomes `off`, which zeroes and stops.
- `clockStart` → if not running: `{ clockRunning: true, clockLastStartedAt: now }`. (No-op if
  already running.)
- `clockPause` → if running: `{ clockRunning: false, clockLastStartedAt: null,
  clockElapsedMs: clockElapsedMs + (now − clockLastStartedAt) }`. The just-run segment is folded
  into the accumulator. (No-op if already paused.)
- `clockSet(elapsedMs)` → `clockElapsedMs = clamp(elapsedMs)`; if running, also
  `clockLastStartedAt = now` (so the new base starts ticking from here). Lets the owner correct
  the clock to an exact time.
- `clockReset` → `{ clockElapsedMs: 0, clockRunning: false, clockLastStartedAt: null }`.

**Client render** (both the public element and the control page). On each poll the client stores
the payload together with a **monotonic** local anchor (`performance.now()`), never `Date.now()`:

```
receivedAtPerf = performance.now()                    // captured when the poll response arrives
// elapsed on the SERVER at the instant of the poll:
serverElapsedAtPoll = clockElapsedMs
  + (clockRunning ? (Date.parse(serverTime) − Date.parse(clockLastStartedAt)) : 0)
// to render at any later moment:
liveElapsed = serverElapsedAtPoll
  + (clockRunning ? (performance.now() − receivedAtPerf) : 0)
displayMs = clockMode === 'countdown'
  ? Math.max(0, clockDurationMs − liveElapsed)
  : liveElapsed
```

Why this is correct and skew-proof: the server-side segment
`serverTime − clockLastStartedAt` is computed **entirely from server-provided values**, so the
client's wall-clock offset never enters. The only client contribution is a *monotonic delta*
since the response arrived, which cannot jump if the device clock changes. A paused clock adds
nothing local, so it holds perfectly still. Between polls the clock ticks locally; a poll only
re-anchors it. Countdown floors at `00:00`.

Formatting: `H:MM:SS` when ≥ 1 hour, else `M:SS`. Rendered in a `<time>`; ticked with a 250ms
`requestAnimationFrame`/interval on the client, independent of the 3s data poll.

The clock needs a server round-trip only on **state changes** (start/pause/set/reset/config),
never per tick — so it adds no polling load.

## Part D — Intake: the rebuilt phone control page

`/live/[liveFeedId]` is still owner-only and still the single control surface. It gains:

- **A row per value**: label (inline-editable → `renameValue`), the current number, − / + steppers
  (`bump ±step`), and a "set exact" affordance (`set` — the formerly-dead action). Add/remove
  entries (`addValue`/`removeValue`) for leaderboard/poll rosters. `single`/`goal` pin to one
  entry; `versus` to two; leaderboard/poll allow many.
- **Clock controls** when `clockMode !== 'off'`: Start / Pause (toggles on `clockRunning`), a
  set-time affordance (`clockSet`), Reset (`clockReset`). The clock display ticks live using the
  Part C algorithm.
- **Feed lifecycle**: Go Live / End / Reset unchanged.
- The `step` query param behaviour is preserved.

The control page is presentation over the same `POST` endpoint; each control sends one
`LiveAction` and applies the returned row, exactly as today.

## Part E — Audience-tap voting (poll preset)

New public endpoint `POST /api/live/[liveFeedId]/vote`, body `{ optionId, sessionId }`:

1. Rate-limit by IP (e.g. 30/min, `prefix: 'live-vote'`).
2. Load the row; **404** if absent.
3. Reject unless the row's element preset is `poll` **and** `isLive` is true (voting is only open
   on a live poll) → **409 `{ error: 'Voting is closed' }`**.
4. Reject if `optionId` is not a current value entry → **400**.
5. Insert `LiveFeedVote { liveFeedId, voterKey: sessionId, optionId }`. On the `@@unique`
   violation (`P2002`) → **409 `{ error: 'Already voted' }`** — do not check-then-insert.
6. On success, `bump` that option's value by 1 and persist. Return the serialized row.

**Dedupe is best-effort, and the spec says so out loud.** `sessionId` is a client-generated key
(localStorage, same idea as the existing poll element); a determined visitor can clear it and
vote again. True one-person-one-vote needs accounts and is out of scope. The unique constraint
plus the IP rate-limit make casual double-voting inconvenient, which is the right bar for a live
audience poll.

**Reveal-after-vote** (`liveFeedPollReveal: 'after-vote'`) is a **display nudge, not a security
control** — the `GET` endpoint still returns tallies (they are public numbers). The public
element simply hides the bars until the visitor's local `hasVoted` flag is set. Stated plainly so
no one mistakes it for secrecy. Default `always`.

## Part F — Public render

`PublicLiveFeedElement` keeps the 3s data poll and adds branches:

- **leaderboard** — value entries sorted by `value` desc, ranked rows (`1. Ravens 21`), the
  leader emphasized.
- **poll** — each option a proportional bar (`share = value / sum`), percentage label; when
  `after-vote` and not yet voted, bars are hidden behind a "tap to vote" state; tapping an option
  calls the vote endpoint, sets local `hasVoted`, reveals results.
- **clock** — when `clockMode !== 'off'`, a live-ticking clock rendered by the shared clock
  component (Part C), placed by preset (inline for versus/leaderboard, beneath the number/bar for
  single/goal).

`single`/`versus`/`goal` keep their current look, now reading from `values` instead of
`valueA/valueB`. The "Live" badge stays.

## Module boundaries

- `src/lib/live-feed.ts` — pure reducer + types + clock transition helpers. No Prisma, no React,
  no network. The one place value and clock math lives.
- `src/lib/live-feed-clock.ts` (new) — pure `computeDisplayMs(state, serverTime, perfNow, anchor)`
  and `formatClock(ms)`, shared by the public element and the control page so the two never drift.
- API routes — auth, persistence, vote dedupe. No presentation.
- `PublicLiveFeedElement` / control page — presentation and local ticking; they trust the row.

## Security invariants

1. Every value and clock instant is computed server-side from the server clock; no client-sent
   time or value is ever persisted directly. `sessionId` and `step` are the only client inputs,
   and neither can set a number.
2. Only the display owner may drive a feed (`POST /api/live/[id]`), unchanged.
3. Voting is public but gated: poll preset only, live only, one row per `(feed, voterKey)` by DB
   constraint, IP rate-limited.
4. The vote endpoint may bump only the addressed option of the addressed feed — never another
   feed, never a non-poll feed, never an arbitrary value.

## Testing

Reducer (`src/lib/live-feed.test.ts`, extend): id-addressed bump/set/add/remove/rename;
missing-id no-ops; reset; and the full clock transition table — start accumulates, pause folds
the segment using `now`, set re-anchors while running, reset zeroes, countdown vs countup.

Clock math (`src/lib/live-feed-clock.test.ts`, new): a running clock's `computeDisplayMs` advances
with the monotonic anchor and is independent of a shifted wall clock; a paused clock is constant;
countdown floors at 0; formatting boundaries (59s, 1:00, 59:59, 1:00:00).

Vote endpoint (`.../vote/route.test.ts`, new): first vote 201 and bumps the option; second vote
same `sessionId` → 409; vote on a non-poll feed → 409; vote while not live → 409; unknown
`optionId` → 400; unknown feed → 404; the bump targets only the named option.

Live route (extend): actions apply and persist; `serialize` includes `values`, clock fields, and
`serverTime`; owner-only still enforced.

Render (extend `PublicLiveFeedElement.test.tsx`): leaderboard ranks by value; poll bars are
proportional; `after-vote` hides tallies until voted; a stamped clock renders and ticks; the
three legacy presets read from `values`.

## Out of scope

- The `tracker` element (owns progress-over-time; already ships the athlete case).
- Standalone/library-app feeds and reuse across displays (ruled out — element-bound).
- True realtime transport (SSE/websockets). Polling stays; the clock ticks locally.
- Account-based vote identity. Dedupe is best-effort by design.
- Pause/resume history or per-segment logs; the clock keeps only its current accumulated elapsed.

## Related

- `src/lib/live-feed.ts` — the reducer this extends
- `src/app/api/displays/[id]/route.ts:157` — the reconcile-on-save this keeps working
- `src/app/api/displays/[id]/poll/route.ts` — the sessionId dedupe precedent for voting
- `src/components/elements/{TrackerElement,PublicTrackerElement}.tsx` — the neighbor this must
  stay distinct from
