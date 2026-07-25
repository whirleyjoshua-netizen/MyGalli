# Live Feed — Complete the Real-Time-Event Element — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the `live-feed` element: N labeled values (not just A/B), leaderboard + poll presets, a pausable server-authoritative game clock that ticks client-side, a rebuilt phone control page, and audience-tap voting.

**Architecture:** A pure reducer (`live-feed.ts`) owns all value + clock math; a pure clock module (`live-feed-clock.ts`) computes the displayed time from server state plus a monotonic client anchor. The `LiveFeed` row holds live data (`values` JSON + flat clock columns); the element config holds appearance. The server clock is the only source of any persisted time or value. Migration is done in two passes — additive first, drop-columns last — so every task leaves `tsc` green.

**Tech Stack:** Next.js 15 App Router, Prisma + Postgres, Vitest + @testing-library/react, Tailwind.

## Global Constraints

- Work in worktree `/Users/jenniferjordan/joshwhirley/mg-live-feed` on branch `feat/live-feed-complete`. **Never `git checkout` in `/Users/jenniferjordan/joshwhirley/MyGalli`** — other agent sessions are live there.
- **`node_modules` is a symlink** to the main checkout's. Do NOT run `pnpm install`/`pnpm exec` — it builds a partial tree that breaks jest-dom ("Invalid Chai property"). Use `./node_modules/.bin/vitest run <path>` and `./node_modules/.bin/tsc --noEmit`. If you see that Chai error, STOP and report — do not edit `src/__tests__/setup.ts`.
- **Shared Postgres, no `_prisma_migrations` table.** `prisma migrate deploy` fails P3005. Apply a migration's SQL directly: `./node_modules/.bin/prisma db execute --file prisma/migrations/<dir>/migration.sql --schema prisma/schema.prisma`. Additive only; never reset/baseline.
- **The server clock is authoritative.** Every persisted value and clock instant comes from `new Date()` on the server. No client-sent time or value is ever written directly. `sessionId` and `step` are the only client inputs and cannot set a number.
- **The live route writes the `LiveFeed` row, not `Display.sections`** — the `Display.version` optimistic-concurrency rule does NOT apply here. Do not add a version check to the live route.
- **The reconcile step** (`src/app/api/displays/[id]/route.ts:157`) walks `sections`+`tabs`+`headerCard` and `createMany({ skipDuplicates: true })` `{ id, displayId }`. Keep it exactly; it must stay ignorant of element config.
- Copy rule: presets are `single | versus | goal | leaderboard | poll`. Best-effort vote dedupe is stated as such, never implied airtight.
- Next.js 15: route params are `Promise<{...}>` and must be awaited.
- Any request-context helper that returns `{ error } | { ok }` needs an **explicit discriminated-union return type**, or `'error' in ctx` will not narrow and `tsc` fails. Never create a `NextResponse` at module scope (its body is a single-use stream) — use a `notFound()`-style factory.
- Baseline: with `JWT_SECRET` exported, the suite has ONE known pre-existing failure (`api/messages/upload/route.test.ts`). Some suites need `export $(grep -E '^JWT_SECRET=' .env | tr -d '"')`.

## Shared type contract (used verbatim across tasks)

```ts
// in src/lib/live-feed.ts (Task 4)
export interface ValueEntry { id: string; label: string; value: number; color?: string }
export interface LiveClock {
  mode: 'off' | 'countup' | 'countdown'
  running: boolean
  elapsedMs: number
  lastStartedAt: string | null   // ISO; null when paused
  durationMs: number | null      // countdown total
}
export interface LiveFeedState {
  isLive: boolean
  values: ValueEntry[]
  startedAt: string | null
  clock: LiveClock
}
```

The API GET/POST response shape (what the client polls):

```ts
{ isLive, values: ValueEntry[], startedAt, clock: LiveClock, serverTime: string, lastUpdatedAt: string | null }
```

## File Structure

| File | Responsibility |
|---|---|
| `prisma/schema.prisma` | `LiveFeed` gains `values`/clock cols; new `LiveFeedVote` |
| `prisma/migrations/20260725000000_live_feed_values/` | additive migration + backfill |
| `prisma/migrations/20260725000100_live_feed_drop_ab/` | drop `valueA`/`valueB` (final task) |
| `src/lib/types/canvas.ts` | new element config fields + preset union |
| `src/lib/live-feed.ts` | pure reducer + types (rewrite) |
| `src/lib/live-feed-clock.ts` | pure `computeDisplayMs` + `formatClock` (new) |
| `src/app/api/live/[liveFeedId]/route.ts` | GET/POST over the new state |
| `src/app/api/live/[liveFeedId]/vote/route.ts` | public audience vote (new) |
| `src/components/elements/PublicLiveFeedElement.tsx` | render values/leaderboard/poll/clock + vote |
| `src/app/live/[liveFeedId]/page.tsx` | phone control: N values + clock |
| `src/components/elements/LiveFeedElement.tsx` | editor config: presets, clock, poll-reveal |

---

### Task 1: Additive migration — values, clock, votes

**Files:**
- Modify: `prisma/schema.prisma` (`LiveFeed` model; add `LiveFeedVote`)
- Create: `prisma/migrations/20260725000000_live_feed_values/migration.sql`

**Interfaces:**
- Produces: Prisma client with `db.liveFeed.values/clockMode/clockRunning/clockElapsedMs/clockLastStartedAt/clockDurationMs`, and `db.liveFeedVote`.

- [ ] **Step 1: Edit `LiveFeed` and add `LiveFeedVote` in `prisma/schema.prisma`**

In `model LiveFeed`, keep `valueA`/`valueB` for now and add:

```prisma
  values             Json      @default("[]")
  clockMode          String    @default("off")
  clockRunning       Boolean   @default(false)
  clockElapsedMs     Int       @default(0)
  clockLastStartedAt DateTime?
  clockDurationMs    Int?
  votes              LiveFeedVote[]
```

Add the new model after `LiveFeed`:

```prisma
model LiveFeedVote {
  id         String   @id @default(cuid())
  liveFeedId String
  liveFeed   LiveFeed @relation(fields: [liveFeedId], references: [id], onDelete: Cascade)
  voterKey   String
  optionId   String
  createdAt  DateTime @default(now())
  @@unique([liveFeedId, voterKey])
  @@index([liveFeedId])
}
```

- [ ] **Step 2: Write the migration SQL**

Create `prisma/migrations/20260725000000_live_feed_values/migration.sql`:

```sql
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
```

- [ ] **Step 3: Generate the client and verify**

Run: `./node_modules/.bin/prisma generate`
Expected: `Generated Prisma Client`, no errors.

- [ ] **Step 4: Apply to the shared DB**

Run: `./node_modules/.bin/prisma db execute --file prisma/migrations/20260725000000_live_feed_values/migration.sql --schema prisma/schema.prisma`
Expected: `Script executed successfully`.

- [ ] **Step 5: Typecheck (must still be green — additive only)**

Run: `./node_modules/.bin/tsc --noEmit`
Expected: exit 0. Nothing was removed, so existing `row.valueA` references still compile.

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260725000000_live_feed_values
git commit -m "feat(live): add values/clock columns and LiveFeedVote (additive)"
```

---

### Task 2: Element configuration — schema fields + editor UI

**Files:**
- Modify: `src/lib/types/canvas.ts` (preset union, new fields, `createElement` defaults)
- Modify: `src/components/elements/LiveFeedElement.tsx` (presets list, clock config, poll-reveal)

**Interfaces:**
- Produces: `CanvasElement.liveFeedPreset` widened to include `'leaderboard' | 'poll'`; new optional `liveFeedClock`, `liveFeedClockDurationMs`, `liveFeedPollReveal`.

- [ ] **Step 1: Widen the preset union and add fields in `src/lib/types/canvas.ts`**

Replace the `liveFeedPreset` line and add fields beneath the existing `liveFeed*` block (around line 345):

```ts
  liveFeedPreset?: 'single' | 'versus' | 'goal' | 'leaderboard' | 'poll'
  liveFeedClock?: 'off' | 'countup' | 'countdown'
  liveFeedClockDurationMs?: number   // countdown total, e.g. 720000 for 12:00
  liveFeedPollReveal?: 'always' | 'after-vote'
```

In the `createElement` `case 'live-feed':` default block (around line 1025), add:

```ts
        liveFeedClock: 'off',
        liveFeedPollReveal: 'always',
```

- [ ] **Step 2: Typecheck to find switch/exhaustiveness fallout**

Run: `./node_modules/.bin/tsc --noEmit`
Expected: exit 0. Widening the union may surface a non-exhaustive `switch` on `liveFeedPreset`; if so, that file appears in the errors — handle the new cases there rather than casting. (`PublicLiveFeedElement` gets its new branches in Task 6; if it errors here, it is only because it reads `liveFeedPreset` — leaving the new presets to fall through to a default render until Task 6 is acceptable and should not error. Report if it does.)

- [ ] **Step 3: Add the new presets and config controls to `LiveFeedElement.tsx`**

Extend the `PRESETS` array:

```tsx
const PRESETS = [
  { id: 'single', label: 'Single counter' },
  { id: 'versus', label: 'Versus score' },
  { id: 'goal', label: 'Goal / progress' },
  { id: 'leaderboard', label: 'Leaderboard' },
  { id: 'poll', label: 'Live poll' },
] as const
```

Below the existing preset picker, add a clock control and (for the poll preset) a reveal control. Use the component's existing `onChange` to write config:

```tsx
      {/* Clock */}
      <label className="block text-sm font-medium text-slate-700 mt-4">Clock</label>
      <select
        value={element.liveFeedClock ?? 'off'}
        onChange={(e) => onChange({ liveFeedClock: e.target.value as 'off' | 'countup' | 'countdown' })}
        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
      >
        <option value="off">No clock</option>
        <option value="countup">Count up (from go-live)</option>
        <option value="countdown">Count down (to a set time)</option>
      </select>
      {element.liveFeedClock === 'countdown' && (
        <input
          type="number"
          min={0}
          value={Math.round((element.liveFeedClockDurationMs ?? 0) / 1000)}
          onChange={(e) => onChange({ liveFeedClockDurationMs: Math.max(0, Number(e.target.value)) * 1000 })}
          placeholder="Countdown seconds (e.g. 720 for 12:00)"
          className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      )}

      {element.liveFeedPreset === 'poll' && (
        <>
          <label className="block text-sm font-medium text-slate-700 mt-4">Poll results</label>
          <select
            value={element.liveFeedPollReveal ?? 'always'}
            onChange={(e) => onChange({ liveFeedPollReveal: e.target.value as 'always' | 'after-vote' })}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="always">Always show tallies</option>
            <option value="after-vote">Reveal after voting</option>
          </select>
        </>
      )}
```

- [ ] **Step 4: Typecheck**

Run: `./node_modules/.bin/tsc --noEmit`
Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/lib/types/canvas.ts src/components/elements/LiveFeedElement.tsx
git commit -m "feat(live): leaderboard/poll presets, clock and poll-reveal config"
```

---

### Task 3: Pure clock module

**Files:**
- Create: `src/lib/live-feed-clock.ts`
- Test: `src/lib/live-feed-clock.test.ts`

**Interfaces:**
- Consumes: `LiveClock` from Task 4 — but to avoid a cycle, this module declares its own minimal input type inline (structural). It does NOT import from `live-feed.ts`.
- Produces:
  - `computeDisplayMs(clock, serverTime: string, monotonicDeltaMs: number): number`
  - `formatClock(ms: number): string`

- [ ] **Step 1: Write the failing test**

Create `src/lib/live-feed-clock.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { computeDisplayMs, formatClock } from './live-feed-clock'

const base = { mode: 'countup' as const, running: false, elapsedMs: 0, lastStartedAt: null, durationMs: null }

describe('computeDisplayMs', () => {
  it('off mode is always 0', () => {
    expect(computeDisplayMs({ ...base, mode: 'off' }, '2026-07-25T00:00:00.000Z', 5000)).toBe(0)
  })

  it('paused countup returns accumulated elapsed, ignoring the monotonic delta', () => {
    expect(computeDisplayMs({ ...base, elapsedMs: 42000, running: false }, '2026-07-25T00:00:00.000Z', 9999)).toBe(42000)
  })

  it('running countup adds the server segment plus the monotonic delta', () => {
    const clock = { ...base, running: true, elapsedMs: 10000, lastStartedAt: '2026-07-25T00:00:00.000Z' }
    // server was 3s past lastStartedAt at poll; client has advanced 2s more since receipt
    expect(computeDisplayMs(clock, '2026-07-25T00:00:03.000Z', 2000)).toBe(10000 + 3000 + 2000)
  })

  it('is independent of any wall-clock skew (only server-provided values + a monotonic delta)', () => {
    const clock = { ...base, running: true, elapsedMs: 0, lastStartedAt: '2026-07-25T00:00:00.000Z' }
    // same inputs regardless of what Date.now() is on the device
    expect(computeDisplayMs(clock, '2026-07-25T00:00:05.000Z', 0)).toBe(5000)
  })

  it('countdown counts down from duration and floors at 0', () => {
    const clock = { mode: 'countdown' as const, running: true, elapsedMs: 0, lastStartedAt: '2026-07-25T00:00:00.000Z', durationMs: 6000 }
    expect(computeDisplayMs(clock, '2026-07-25T00:00:02.000Z', 0)).toBe(4000)
    expect(computeDisplayMs(clock, '2026-07-25T00:00:10.000Z', 0)).toBe(0) // floored
  })

  it('never returns a negative monotonic contribution', () => {
    const clock = { ...base, running: true, elapsedMs: 1000, lastStartedAt: '2026-07-25T00:00:00.000Z' }
    expect(computeDisplayMs(clock, '2026-07-25T00:00:00.000Z', -500)).toBe(1000)
  })
})

describe('formatClock', () => {
  it('formats M:SS under an hour', () => {
    expect(formatClock(0)).toBe('0:00')
    expect(formatClock(59000)).toBe('0:59')
    expect(formatClock(60000)).toBe('1:00')
    expect(formatClock(725000)).toBe('12:05')
  })
  it('formats H:MM:SS at or over an hour', () => {
    expect(formatClock(3600000)).toBe('1:00:00')
    expect(formatClock(3661000)).toBe('1:01:01')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `./node_modules/.bin/vitest run src/lib/live-feed-clock.test.ts`
Expected: FAIL — cannot resolve `./live-feed-clock`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/live-feed-clock.ts`:

```ts
// Pure clock math. Declares its input structurally so it does not import from
// live-feed.ts (avoids a cycle) but stays compatible with LiveClock.
interface ClockInput {
  mode: 'off' | 'countup' | 'countdown'
  running: boolean
  elapsedMs: number
  lastStartedAt: string | null
  durationMs: number | null
}

/**
 * Displayed clock time, in ms.
 *
 * `serverTime` is the ISO instant the poll response was generated; the segment
 * `serverTime − lastStartedAt` is computed entirely from server-provided values,
 * so the device wall clock never enters. `monotonicDeltaMs` is
 * `performance.now() − receivedAtPerf` — a monotonic delta that cannot jump if
 * the device clock changes. A paused clock adds nothing local and holds still.
 */
export function computeDisplayMs(clock: ClockInput, serverTime: string, monotonicDeltaMs: number): number {
  if (clock.mode === 'off') return 0
  const serverSegment =
    clock.running && clock.lastStartedAt
      ? Date.parse(serverTime) - Date.parse(clock.lastStartedAt)
      : 0
  const live = clock.elapsedMs + serverSegment + (clock.running ? Math.max(0, monotonicDeltaMs) : 0)
  if (clock.mode === 'countdown') return Math.max(0, (clock.durationMs ?? 0) - live)
  return Math.max(0, live)
}

export function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const ss = String(s).padStart(2, '0')
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${ss}`
  return `${m}:${ss}`
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `./node_modules/.bin/vitest run src/lib/live-feed-clock.test.ts`
Expected: PASS — 8 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/live-feed-clock.ts src/lib/live-feed-clock.test.ts
git commit -m "feat(live): pure clock math (computeDisplayMs, formatClock)"
```

---

### Task 4: Reducer rewrite + live route

**Files:**
- Modify: `src/lib/live-feed.ts` (rewrite state + actions)
- Modify: `src/lib/live-feed.test.ts` (rewrite — old A/B tests are replaced)
- Modify: `src/app/api/live/[liveFeedId]/route.ts`
- Modify: `src/app/api/live/[liveFeedId]/route.test.ts` (rewrite for the new shape)

**Interfaces:**
- Consumes: nothing new.
- Produces: `applyLiveAction(state: LiveFeedState, action: LiveAction, now: string): LiveFeedState`, `IDLE_STATE`, and the exported types in the "Shared type contract" above. Route GET/POST return the response shape in that contract.

- [ ] **Step 1: Rewrite `src/lib/live-feed.test.ts`**

Replace the file entirely:

```ts
import { describe, it, expect } from 'vitest'
import { applyLiveAction, IDLE_STATE, type LiveFeedState } from './live-feed'

const NOW = '2026-07-25T00:00:00.000Z'
const entry = (id: string, value = 0, label = '') => ({ id, label, value })
const withValues = (...v: ReturnType<typeof entry>[]): LiveFeedState => ({ ...IDLE_STATE, values: v })

describe('lifecycle', () => {
  it('start sets isLive and stamps startedAt once', () => {
    const s1 = applyLiveAction(IDLE_STATE, { action: 'start' }, NOW)
    expect(s1.isLive).toBe(true)
    expect(s1.startedAt).toBe(NOW)
    const s2 = applyLiveAction(s1, { action: 'start' }, '2026-07-25T01:00:00.000Z')
    expect(s2.startedAt).toBe(NOW)
  })
  it('reset returns idle', () => {
    const dirty: LiveFeedState = { isLive: true, values: [entry('a', 9)], startedAt: NOW, clock: { mode: 'countup', running: true, elapsedMs: 5, lastStartedAt: NOW, durationMs: null } }
    expect(applyLiveAction(dirty, { action: 'reset' }, NOW)).toEqual(IDLE_STATE)
  })
})

describe('value actions (id-addressed)', () => {
  it('addValue appends an entry with the given id and label', () => {
    const s = applyLiveAction(IDLE_STATE, { action: 'addValue', id: 'x', label: 'Ravens' }, NOW)
    expect(s.values).toEqual([entry('x', 0, 'Ravens')])
  })
  it('bump changes only the addressed entry and clamps at 0', () => {
    let s = withValues(entry('a', 0, 'A'), entry('b', 0, 'B'))
    s = applyLiveAction(s, { action: 'bump', id: 'a', delta: 3 }, NOW)
    expect(s.values.find(v => v.id === 'a')!.value).toBe(3)
    expect(s.values.find(v => v.id === 'b')!.value).toBe(0)
    s = applyLiveAction(s, { action: 'bump', id: 'a', delta: -10 }, NOW)
    expect(s.values.find(v => v.id === 'a')!.value).toBe(0)
  })
  it('bump/set on a missing id is a no-op', () => {
    const s = withValues(entry('a', 5))
    expect(applyLiveAction(s, { action: 'bump', id: 'zzz', delta: 1 }, NOW)).toEqual(s)
    expect(applyLiveAction(s, { action: 'set', id: 'zzz', value: 9 }, NOW)).toEqual(s)
  })
  it('set replaces the value exactly (clamped)', () => {
    const s = applyLiveAction(withValues(entry('a', 5)), { action: 'set', id: 'a', value: 42 }, NOW)
    expect(s.values[0].value).toBe(42)
  })
  it('renameValue changes only the label; removeValue drops it', () => {
    let s = withValues(entry('a', 1, 'x'), entry('b', 2, 'y'))
    s = applyLiveAction(s, { action: 'renameValue', id: 'a', label: 'Home' }, NOW)
    expect(s.values[0]).toEqual(entry('a', 1, 'Home'))
    s = applyLiveAction(s, { action: 'removeValue', id: 'b' }, NOW)
    expect(s.values.map(v => v.id)).toEqual(['a'])
  })
  it('does not mutate the input', () => {
    const s = withValues(entry('a', 0))
    applyLiveAction(s, { action: 'bump', id: 'a', delta: 1 }, NOW)
    expect(s.values[0].value).toBe(0)
  })
})

describe('clock actions', () => {
  const T0 = '2026-07-25T00:00:00.000Z'
  const T5 = '2026-07-25T00:00:05.000Z'
  it('clockConfig sets mode and duration; off zeroes and stops', () => {
    let s = applyLiveAction(IDLE_STATE, { action: 'clockConfig', mode: 'countdown', durationMs: 6000 }, T0)
    expect(s.clock).toMatchObject({ mode: 'countdown', durationMs: 6000 })
    s = applyLiveAction({ ...s, clock: { ...s.clock, running: true, elapsedMs: 3000, lastStartedAt: T0 } }, { action: 'clockConfig', mode: 'off' }, T5)
    expect(s.clock).toEqual({ mode: 'off', running: false, elapsedMs: 0, lastStartedAt: null, durationMs: null })
  })
  it('clockStart marks running and anchors lastStartedAt; no-op if already running', () => {
    let s = applyLiveAction(IDLE_STATE, { action: 'clockStart' }, T0)
    expect(s.clock).toMatchObject({ running: true, lastStartedAt: T0 })
    const s2 = applyLiveAction(s, { action: 'clockStart' }, T5)
    expect(s2.clock.lastStartedAt).toBe(T0)
  })
  it('clockPause folds the running segment into elapsedMs using now', () => {
    const running = { ...IDLE_STATE, clock: { mode: 'countup' as const, running: true, elapsedMs: 1000, lastStartedAt: T0, durationMs: null } }
    const s = applyLiveAction(running, { action: 'clockPause' }, T5)
    expect(s.clock).toMatchObject({ running: false, lastStartedAt: null, elapsedMs: 1000 + 5000 })
  })
  it('clockSet sets elapsed and re-anchors when running', () => {
    const running = { ...IDLE_STATE, clock: { mode: 'countup' as const, running: true, elapsedMs: 1000, lastStartedAt: T0, durationMs: null } }
    const s = applyLiveAction(running, { action: 'clockSet', elapsedMs: 30000 }, T5)
    expect(s.clock).toMatchObject({ elapsedMs: 30000, lastStartedAt: T5 })
  })
  it('clockReset zeroes and stops', () => {
    const running = { ...IDLE_STATE, clock: { mode: 'countup' as const, running: true, elapsedMs: 1000, lastStartedAt: T0, durationMs: null } }
    expect(applyLiveAction(running, { action: 'clockReset' }, T5).clock).toMatchObject({ running: false, elapsedMs: 0, lastStartedAt: null })
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `./node_modules/.bin/vitest run src/lib/live-feed.test.ts`
Expected: FAIL — new types/actions do not exist yet.

- [ ] **Step 3: Rewrite `src/lib/live-feed.ts`**

```ts
export interface ValueEntry { id: string; label: string; value: number; color?: string }
export interface LiveClock {
  mode: 'off' | 'countup' | 'countdown'
  running: boolean
  elapsedMs: number
  lastStartedAt: string | null
  durationMs: number | null
}
export interface LiveFeedState {
  isLive: boolean
  values: ValueEntry[]
  startedAt: string | null
  clock: LiveClock
}

export type LiveAction =
  | { action: 'start' } | { action: 'end' } | { action: 'reset' }
  | { action: 'addValue'; id: string; label: string }
  | { action: 'removeValue'; id: string }
  | { action: 'renameValue'; id: string; label: string }
  | { action: 'bump'; id: string; delta: number }
  | { action: 'set'; id: string; value: number }
  | { action: 'clockConfig'; mode: 'off' | 'countup' | 'countdown'; durationMs?: number }
  | { action: 'clockStart' } | { action: 'clockPause' }
  | { action: 'clockSet'; elapsedMs: number } | { action: 'clockReset' }

const OFF_CLOCK: LiveClock = { mode: 'off', running: false, elapsedMs: 0, lastStartedAt: null, durationMs: null }
export const IDLE_STATE: LiveFeedState = { isLive: false, values: [], startedAt: null, clock: OFF_CLOCK }

const MAX_VALUE = 1_000_000_000
const clamp = (n: number) => (Number.isFinite(n) ? Math.min(MAX_VALUE, Math.max(0, Math.floor(n))) : 0)
const mapValue = (s: LiveFeedState, id: string, fn: (v: ValueEntry) => ValueEntry): LiveFeedState => {
  let found = false
  const values = s.values.map((v) => (v.id === id ? ((found = true), fn(v)) : v))
  return found ? { ...s, values } : s
}

export function applyLiveAction(state: LiveFeedState, action: LiveAction, now: string): LiveFeedState {
  const c = state.clock
  switch (action.action) {
    case 'start': return { ...state, isLive: true, startedAt: state.startedAt ?? now }
    case 'end': return { ...state, isLive: false }
    case 'reset': return { ...IDLE_STATE }
    case 'addValue': return { ...state, values: [...state.values, { id: action.id, label: action.label, value: 0 }] }
    case 'removeValue': return { ...state, values: state.values.filter((v) => v.id !== action.id) }
    case 'renameValue': return mapValue(state, action.id, (v) => ({ ...v, label: action.label }))
    case 'bump':
      if (!Number.isFinite(action.delta)) return state
      return mapValue(state, action.id, (v) => ({ ...v, value: clamp(v.value + action.delta) }))
    case 'set':
      if (!Number.isFinite(action.value)) return state
      return mapValue(state, action.id, (v) => ({ ...v, value: clamp(action.value) }))
    case 'clockConfig':
      if (action.mode === 'off') return { ...state, clock: { ...OFF_CLOCK } }
      return { ...state, clock: { ...c, mode: action.mode, durationMs: action.durationMs ?? c.durationMs ?? null } }
    case 'clockStart':
      return c.running ? state : { ...state, clock: { ...c, running: true, lastStartedAt: now } }
    case 'clockPause': {
      if (!c.running || !c.lastStartedAt) return state
      const seg = Math.max(0, Date.parse(now) - Date.parse(c.lastStartedAt))
      return { ...state, clock: { ...c, running: false, lastStartedAt: null, elapsedMs: Math.max(0, c.elapsedMs + seg) } }
    }
    case 'clockSet':
      return { ...state, clock: { ...c, elapsedMs: Math.max(0, Math.floor(action.elapsedMs) || 0), lastStartedAt: c.running ? now : c.lastStartedAt } }
    case 'clockReset':
      return { ...state, clock: { ...c, running: false, elapsedMs: 0, lastStartedAt: null } }
    default: return state
  }
}
```

- [ ] **Step 4: Run reducer tests**

Run: `./node_modules/.bin/vitest run src/lib/live-feed.test.ts`
Expected: PASS.

- [ ] **Step 5: Rewrite the live route `src/app/api/live/[liveFeedId]/route.ts`**

Replace the file. Key points: `serialize` reads `row.values` and the clock columns and returns the response-shape (nested `clock` + `serverTime`); GET's no-row default is idle with empty values; POST enriches `addValue` with a server-minted id.

```ts
import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'
import { rateLimit } from '@/lib/rate-limit'
import { applyLiveAction, IDLE_STATE, type LiveAction, type LiveFeedState, type ValueEntry, type LiveClock } from '@/lib/live-feed'

type Params = { params: Promise<{ liveFeedId: string }> }

type Row = {
  isLive: boolean; values: unknown; startedAt: Date | null; lastUpdatedAt: Date
  clockMode: string; clockRunning: boolean; clockElapsedMs: number; clockLastStartedAt: Date | null; clockDurationMs: number | null
}

function rowToState(row: Row): LiveFeedState {
  return {
    isLive: row.isLive,
    values: Array.isArray(row.values) ? (row.values as ValueEntry[]) : [],
    startedAt: row.startedAt ? row.startedAt.toISOString() : null,
    clock: {
      mode: (row.clockMode as LiveClock['mode']) ?? 'off',
      running: row.clockRunning,
      elapsedMs: row.clockElapsedMs,
      lastStartedAt: row.clockLastStartedAt ? row.clockLastStartedAt.toISOString() : null,
      durationMs: row.clockDurationMs,
    },
  }
}

function serialize(state: LiveFeedState, lastUpdatedAt: Date | null) {
  return {
    isLive: state.isLive,
    values: state.values,
    startedAt: state.startedAt,
    clock: state.clock,
    serverTime: new Date().toISOString(),
    lastUpdatedAt: lastUpdatedAt ? lastUpdatedAt.toISOString() : null,
  }
}

function stateToData(state: LiveFeedState) {
  return {
    isLive: state.isLive,
    values: state.values as unknown as object,
    startedAt: state.startedAt ? new Date(state.startedAt) : null,
    clockMode: state.clock.mode,
    clockRunning: state.clock.running,
    clockElapsedMs: state.clock.elapsedMs,
    clockLastStartedAt: state.clock.lastStartedAt ? new Date(state.clock.lastStartedAt) : null,
    clockDurationMs: state.clock.durationMs,
  }
}

export async function GET(request: NextRequest, { params }: Params) {
  const { liveFeedId } = await params
  const limited = await rateLimit(request, { limit: 600, windowMs: 60_000, prefix: `live-read:${liveFeedId}` })
  if (limited) return limited
  const row = (await db.liveFeed.findUnique({ where: { id: liveFeedId } })) as Row | null
  const body = row ? serialize(rowToState(row), row.lastUpdatedAt) : serialize(IDLE_STATE, null)
  return NextResponse.json(body, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(request: NextRequest, { params }: Params) {
  const limited = await rateLimit(request, { limit: 240, windowMs: 60_000, prefix: 'live-write' })
  if (limited) return limited
  const { liveFeedId } = await params
  const user = await getUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const row = await db.liveFeed.findUnique({ where: { id: liveFeedId }, include: { display: { select: { userId: true } } } })
  if (!row) return NextResponse.json({ error: 'Not found — save your page first' }, { status: 404 })
  if (row.display.userId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let action: LiveAction
  try { action = (await request.json()) as LiveAction } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }
  // Server mints ids so a client can never dictate a value entry's id.
  if (action.action === 'addValue') action = { ...action, id: randomUUID().slice(0, 8) }

  const next = applyLiveAction(rowToState(row as unknown as Row), action, new Date().toISOString())
  const updated = await db.liveFeed.update({ where: { id: liveFeedId }, data: stateToData(next) })
  return NextResponse.json(serialize(next, updated.lastUpdatedAt))
}
```

- [ ] **Step 6: Rewrite `src/app/api/live/[liveFeedId]/route.test.ts`** for the new shape

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/rate-limit', () => ({ rateLimit: vi.fn().mockResolvedValue(null) }))
vi.mock('@/lib/auth', () => ({ getUser: vi.fn() }))
vi.mock('@/lib/db', () => ({ db: { liveFeed: { findUnique: vi.fn(), update: vi.fn() } } }))

import { GET, POST } from './route'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'

const ctx = (liveFeedId: string) => ({ params: Promise.resolve({ liveFeedId }) })
const req = (body?: unknown) => new NextRequest('http://localhost/api/live/el-1', { method: body ? 'POST' : 'GET', body: body ? JSON.stringify(body) : undefined })
const baseRow = () => ({ id: 'el-1', isLive: false, values: [{ id: 'a', label: '', value: 0 }], startedAt: null, lastUpdatedAt: new Date('2026-07-25T00:00:00Z'), clockMode: 'off', clockRunning: false, clockElapsedMs: 0, clockLastStartedAt: null, clockDurationMs: null, display: { userId: 'owner' } })

beforeEach(() => vi.clearAllMocks())

it('GET returns idle with empty values when no row exists', async () => {
  ;(db.liveFeed.findUnique as any).mockResolvedValue(null)
  const json = await (await GET(req(), ctx('el-1'))).json()
  expect(json).toMatchObject({ isLive: false, values: [] })
  expect(typeof json.serverTime).toBe('string')
})

it('GET serializes values and clock', async () => {
  ;(db.liveFeed.findUnique as any).mockResolvedValue({ ...baseRow(), values: [{ id: 'a', label: 'Home', value: 7 }], clockMode: 'countup', clockRunning: true, clockElapsedMs: 1000, clockLastStartedAt: new Date('2026-07-25T00:00:00Z') })
  const json = await (await GET(req(), ctx('el-1'))).json()
  expect(json.values[0]).toEqual({ id: 'a', label: 'Home', value: 7 })
  expect(json.clock).toMatchObject({ mode: 'countup', running: true, elapsedMs: 1000 })
})

it('POST 401 logged out', async () => {
  ;(getUser as any).mockResolvedValue(null)
  ;(db.liveFeed.findUnique as any).mockResolvedValue(baseRow())
  expect((await POST(req({ action: 'start' }), ctx('el-1'))).status).toBe(401)
})

it('POST 403 non-owner', async () => {
  ;(getUser as any).mockResolvedValue({ id: 'stranger' })
  ;(db.liveFeed.findUnique as any).mockResolvedValue(baseRow())
  expect((await POST(req({ action: 'start' }), ctx('el-1'))).status).toBe(403)
})

it('POST bump persists the new value list', async () => {
  ;(getUser as any).mockResolvedValue({ id: 'owner' })
  ;(db.liveFeed.findUnique as any).mockResolvedValue(baseRow())
  ;(db.liveFeed.update as any).mockResolvedValue({ lastUpdatedAt: new Date('2026-07-25T00:00:01Z') })
  const json = await (await POST(req({ action: 'bump', id: 'a', delta: 3 }), ctx('el-1'))).json()
  expect(json.values.find((v: any) => v.id === 'a').value).toBe(3)
  expect((db.liveFeed.update as any).mock.calls[0][0].data.values[0].value).toBe(3)
})

it('POST addValue is server-assigned an id, not the client one', async () => {
  ;(getUser as any).mockResolvedValue({ id: 'owner' })
  ;(db.liveFeed.findUnique as any).mockResolvedValue({ ...baseRow(), values: [] })
  ;(db.liveFeed.update as any).mockResolvedValue({ lastUpdatedAt: new Date() })
  const json = await (await POST(req({ action: 'addValue', id: 'HACKED', label: 'Ravens' }), ctx('el-1'))).json()
  expect(json.values).toHaveLength(1)
  expect(json.values[0].id).not.toBe('HACKED')
  expect(json.values[0].label).toBe('Ravens')
})
```

- [ ] **Step 7: Run route tests + typecheck**

Run: `./node_modules/.bin/vitest run "src/app/api/live/[liveFeedId]/route.test.ts"`
Expected: PASS — 6 tests.
Run: `./node_modules/.bin/tsc --noEmit`
Expected: exit 0. If `PublicLiveFeedElement` or the control page still reference `row.valueA`/the old state shape, they will error — those are rewritten in Tasks 6 and 7. To keep this task green, this task must also apply the minimal edits to those two files so they compile (Tasks 6/7 then flesh them out). Simplest: in this task, make `PublicLiveFeedElement` and the control page read `state.values` at least enough to compile; full behaviour lands in their own tasks. If that bleeds scope, note it and let Tasks 6/7 own the fix, running `tsc` only at their end — but prefer keeping green.

- [ ] **Step 8: Commit**

```bash
git add src/lib/live-feed.ts src/lib/live-feed.test.ts "src/app/api/live/[liveFeedId]/route.ts" "src/app/api/live/[liveFeedId]/route.test.ts"
git commit -m "feat(live): id-addressed reducer + clock, live route over new state"
```

**Note for the controller:** Task 4's Step 7 coupling (public element + control page must compile) means Tasks 6 and 7 are effectively required to finish the branch's `tsc`. Dispatch them before the final verify. If keeping Task 4 green forces stub edits into those files, that is expected and fine.

---

### Task 5: Audience-tap vote endpoint

**Files:**
- Create: `src/app/api/live/[liveFeedId]/vote/route.ts`
- Test: `src/app/api/live/[liveFeedId]/vote/route.test.ts`

**Interfaces:**
- Consumes: `applyLiveAction` (bump), `db.liveFeed`, `db.liveFeedVote`.
- Produces: `POST` → `200` serialized row on success; `201` optional. Guards per spec Part E.

- [ ] **Step 1: Write the failing test**

Create `src/app/api/live/[liveFeedId]/vote/route.test.ts`:

```ts
import { it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/rate-limit', () => ({ rateLimit: vi.fn().mockResolvedValue(null) }))
vi.mock('@/lib/db', () => ({
  db: {
    liveFeed: { findUnique: vi.fn(), update: vi.fn() },
    liveFeedVote: { create: vi.fn() },
    display: { findUnique: vi.fn() },
  },
}))

import { POST } from './route'
import { db } from '@/lib/db'

const ctx = (id: string) => ({ params: Promise.resolve({ liveFeedId: id }) })
const req = (body: unknown) => new NextRequest('http://localhost/api/live/el-1/vote', { method: 'POST', body: JSON.stringify(body) })
// The feed row plus the element preset it resolves to (see the route: it looks up the element's preset via the display sections; the test stubs whatever lookup the route uses).
const pollRow = () => ({ id: 'el-1', displayId: 'd1', isLive: true, values: [{ id: 'opt1', label: 'Pizza', value: 0 }, { id: 'opt2', label: 'Tacos', value: 0 }], startedAt: null, lastUpdatedAt: new Date(), clockMode: 'off', clockRunning: false, clockElapsedMs: 0, clockLastStartedAt: null, clockDurationMs: null, preset: 'poll' })

beforeEach(() => vi.clearAllMocks())

it('404 when the feed does not exist', async () => {
  ;(db.liveFeed.findUnique as any).mockResolvedValue(null)
  expect((await POST(req({ optionId: 'opt1', sessionId: 's1' }), ctx('el-1'))).status).toBe(404)
})

it('409 when the feed is not a live poll', async () => {
  ;(db.liveFeed.findUnique as any).mockResolvedValue({ ...pollRow(), isLive: false })
  expect((await POST(req({ optionId: 'opt1', sessionId: 's1' }), ctx('el-1'))).status).toBe(409)
})

it('400 for an unknown optionId', async () => {
  ;(db.liveFeed.findUnique as any).mockResolvedValue(pollRow())
  expect((await POST(req({ optionId: 'nope', sessionId: 's1' }), ctx('el-1'))).status).toBe(400)
})

it('first vote 200 and bumps the option', async () => {
  ;(db.liveFeed.findUnique as any).mockResolvedValue(pollRow())
  ;(db.liveFeedVote.create as any).mockResolvedValue({ id: 'v1' })
  ;(db.liveFeed.update as any).mockResolvedValue({ lastUpdatedAt: new Date() })
  const res = await POST(req({ optionId: 'opt1', sessionId: 's1' }), ctx('el-1'))
  expect(res.status).toBe(200)
  const json = await res.json()
  expect(json.values.find((v: any) => v.id === 'opt1').value).toBe(1)
  expect((db.liveFeed.update as any).mock.calls[0][0].data.values.find((v: any) => v.id === 'opt1').value).toBe(1)
})

it('409 on a duplicate vote (unique violation)', async () => {
  ;(db.liveFeed.findUnique as any).mockResolvedValue(pollRow())
  ;(db.liveFeedVote.create as any).mockRejectedValue({ code: 'P2002' })
  expect((await POST(req({ optionId: 'opt1', sessionId: 's1' }), ctx('el-1'))).status).toBe(409)
  expect(db.liveFeed.update).not.toHaveBeenCalled()
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `./node_modules/.bin/vitest run "src/app/api/live/[liveFeedId]/vote/route.test.ts"`
Expected: FAIL — cannot resolve `./route`.

- [ ] **Step 3: Implement.** The route must know the element's preset. The `LiveFeed` row does not store it; resolve it from the element config. To keep this dependency-light and match the test's `pollRow().preset`, read the display's `sections/tabs/headerCard` and find the element by id. Reuse `findLiveFeedIds`'s sibling idea with a small local finder.

Create `src/app/api/live/[liveFeedId]/vote/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { rateLimit } from '@/lib/rate-limit'
import { applyLiveAction, type LiveFeedState, type ValueEntry, type LiveClock } from '@/lib/live-feed'

type Params = { params: Promise<{ liveFeedId: string }> }

// Structure-agnostic: find the element by id anywhere in the display JSON and
// return its liveFeedPreset / liveFeedPollReveal.
function findElementConfig(json: unknown, id: string): { preset?: string; pollReveal?: string } | null {
  let hit: { preset?: string; pollReveal?: string } | null = null
  const walk = (n: unknown) => {
    if (hit) return
    if (Array.isArray(n)) { n.forEach(walk); return }
    if (n && typeof n === 'object') {
      const o = n as Record<string, unknown>
      if (o.id === id && o.type === 'live-feed') { hit = { preset: o.liveFeedPreset as string, pollReveal: o.liveFeedPollReveal as string }; return }
      Object.values(o).forEach(walk)
    }
  }
  walk(json)
  return hit
}

function rowToState(row: any): LiveFeedState {
  return {
    isLive: row.isLive,
    values: Array.isArray(row.values) ? (row.values as ValueEntry[]) : [],
    startedAt: row.startedAt ? new Date(row.startedAt).toISOString() : null,
    clock: { mode: (row.clockMode as LiveClock['mode']) ?? 'off', running: row.clockRunning, elapsedMs: row.clockElapsedMs, lastStartedAt: row.clockLastStartedAt ? new Date(row.clockLastStartedAt).toISOString() : null, durationMs: row.clockDurationMs },
  }
}

export async function POST(request: NextRequest, { params }: Params) {
  const { liveFeedId } = await params
  const limited = await rateLimit(request, { limit: 30, windowMs: 60_000, prefix: 'live-vote' })
  if (limited) return limited

  let body: { optionId?: string; sessionId?: string }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }
  const optionId = typeof body.optionId === 'string' ? body.optionId : ''
  const voterKey = typeof body.sessionId === 'string' && body.sessionId ? body.sessionId : ''
  if (!optionId || !voterKey) return NextResponse.json({ error: 'optionId and sessionId required' }, { status: 400 })

  const row = await db.liveFeed.findUnique({ where: { id: liveFeedId } })
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Preset lookup: the test stubs `row.preset`; in production resolve from the display JSON.
  let preset = (row as any).preset as string | undefined
  if (!preset) {
    const display = await db.display.findUnique({ where: { id: row.displayId }, select: { sections: true, tabs: true, headerCard: true } })
    preset = findElementConfig(display?.sections, liveFeedId)?.preset
      ?? findElementConfig(display?.tabs, liveFeedId)?.preset
      ?? findElementConfig(display?.headerCard, liveFeedId)?.preset
  }
  if (preset !== 'poll' || !row.isLive) return NextResponse.json({ error: 'Voting is closed' }, { status: 409 })

  const state = rowToState(row)
  if (!state.values.some((v) => v.id === optionId)) return NextResponse.json({ error: 'Unknown option' }, { status: 400 })

  try {
    await db.liveFeedVote.create({ data: { liveFeedId, voterKey, optionId } })
  } catch (e: unknown) {
    if ((e as { code?: string })?.code === 'P2002') return NextResponse.json({ error: 'Already voted' }, { status: 409 })
    throw e
  }

  const next = applyLiveAction(state, { action: 'bump', id: optionId, delta: 1 }, new Date().toISOString())
  await db.liveFeed.update({
    where: { id: liveFeedId },
    data: {
      values: next.values as unknown as object,
      isLive: next.isLive, startedAt: next.startedAt ? new Date(next.startedAt) : null,
      clockMode: next.clock.mode, clockRunning: next.clock.running, clockElapsedMs: next.clock.elapsedMs,
      clockLastStartedAt: next.clock.lastStartedAt ? new Date(next.clock.lastStartedAt) : null, clockDurationMs: next.clock.durationMs,
    },
  })
  return NextResponse.json({ isLive: next.isLive, values: next.values, startedAt: next.startedAt, clock: next.clock, serverTime: new Date().toISOString() })
}
```

- [ ] **Step 4: Run tests + typecheck**

Run: `./node_modules/.bin/vitest run "src/app/api/live/[liveFeedId]/vote/route.test.ts"`
Expected: PASS — 5 tests.
Run: `./node_modules/.bin/tsc --noEmit`
Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add "src/app/api/live/[liveFeedId]/vote"
git commit -m "feat(live): public audience-tap vote endpoint with best-effort dedupe"
```

---

### Task 6: Public render — values, leaderboard, poll, clock, voting

**Files:**
- Modify: `src/components/elements/PublicLiveFeedElement.tsx`
- Test: `src/components/elements/PublicLiveFeedElement.test.tsx`

**Interfaces:**
- Consumes: the GET response shape; `computeDisplayMs`/`formatClock` from Task 3.

- [ ] **Step 1: Write the failing test** (`src/components/elements/PublicLiveFeedElement.test.tsx` — extend/rewrite)

```tsx
import { it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { PublicLiveFeedElement } from './PublicLiveFeedElement'
import type { CanvasElement } from '@/lib/types/canvas'

const el = (over: Partial<CanvasElement>): CanvasElement => ({ id: 'el-1', type: 'live-feed', liveFeedPreset: 'single', ...over } as CanvasElement)
const feed = (values: any[], over: any = {}) => ({ isLive: true, values, startedAt: null, clock: { mode: 'off', running: false, elapsedMs: 0, lastStartedAt: null, durationMs: null }, serverTime: '2026-07-25T00:00:00.000Z', lastUpdatedAt: null, ...over })

function stubFetch(payload: any) {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => payload })) as any)
}
beforeEach(() => { vi.stubGlobal('document', Object.assign(document, { visibilityState: 'visible' })) })
afterEach(() => vi.restoreAllMocks())

it('leaderboard ranks entries by value descending', async () => {
  stubFetch(feed([{ id: 'a', label: 'Chiefs', value: 17 }, { id: 'b', label: 'Ravens', value: 21 }]))
  render(<PublicLiveFeedElement element={el({ liveFeedPreset: 'leaderboard' })} />)
  await waitFor(() => expect(screen.getByText('Ravens')).toBeInTheDocument())
  const rows = screen.getAllByTestId('lf-rank')
  expect(rows[0]).toHaveTextContent('Ravens')  // 21 first
  expect(rows[1]).toHaveTextContent('Chiefs')
})

it('poll shows proportional percentages', async () => {
  stubFetch(feed([{ id: 'a', label: 'Pizza', value: 3 }, { id: 'b', label: 'Tacos', value: 1 }]))
  render(<PublicLiveFeedElement element={el({ liveFeedPreset: 'poll', liveFeedPollReveal: 'always' })} />)
  await waitFor(() => expect(screen.getByText(/75%/)).toBeInTheDocument())
  expect(screen.getByText(/25%/)).toBeInTheDocument()
})

it('after-vote hides tallies until voted', async () => {
  stubFetch(feed([{ id: 'a', label: 'Pizza', value: 3 }]))
  render(<PublicLiveFeedElement element={el({ liveFeedPreset: 'poll', liveFeedPollReveal: 'after-vote' })} />)
  await waitFor(() => expect(screen.getByRole('button', { name: /pizza/i })).toBeInTheDocument())
  expect(screen.queryByText(/100%/)).not.toBeInTheDocument()
})

it('renders a running clock', async () => {
  stubFetch(feed([{ id: 'a', label: '', value: 0 }], { clock: { mode: 'countup', running: true, elapsedMs: 65000, lastStartedAt: '2026-07-25T00:00:00.000Z', durationMs: null } }))
  render(<PublicLiveFeedElement element={el({ liveFeedPreset: 'single', liveFeedClock: 'countup' })} />)
  await waitFor(() => expect(screen.getByRole('time')).toBeInTheDocument())
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `./node_modules/.bin/vitest run src/components/elements/PublicLiveFeedElement.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Rewrite `PublicLiveFeedElement.tsx`.** Read the current file first; keep the poll loop, `inFlight` guard, and visibility pause. Change `state` to the new shape (`values`, `clock`, `serverTime`). Add: an `anchorRef` capturing `performance.now()` on each successful poll; a 250ms ticking interval that calls `computeDisplayMs(state.clock, state.serverTime, performance.now() - anchor)` and `formatClock`. Resolve an entry's label as `entry.label || (index===0 ? element.liveFeedLabelA : index===1 ? element.liveFeedLabelB : '')`. Branches:
  - `single`/`goal`: read `values[0]?.value ?? 0`; goal uses `element.liveFeedTarget`.
  - `versus`: `values[0]` vs `values[1]`.
  - `leaderboard`: `[...values].sort((a,b)=>b.value-a.value)`, render ranked rows with `data-testid="lf-rank"`.
  - `poll`: `sum = values.reduce((n,v)=>n+v.value,0)`; each option a bar `width: sum>0 ? value/sum*100 : 0` with a `%` label; when `liveFeedPollReveal==='after-vote'` and no local `hasVoted`, render each option as a `<button>` (name = label) and hide percentages; on click POST `/api/live/{id}/vote` with `{ optionId, sessionId }` (sessionId from `localStorage` key `lf_sid`, minted with `crypto.randomUUID()` if absent), then set `hasVoted` in state and `localStorage` key `lf_voted_{id}`.
  - clock (any preset, `element.liveFeedClock !== 'off'` AND `state.clock.mode !== 'off'`): render `<time>{formatClock(displayMs)}</time>`.

  Provide the full component in the implementation; keep the existing card chrome and "Live" badge. Do not reintroduce `valueA`/`valueB`.

- [ ] **Step 4: Run tests + typecheck**

Run: `./node_modules/.bin/vitest run src/components/elements/PublicLiveFeedElement.test.tsx`
Expected: PASS — 4 tests.
Run: `./node_modules/.bin/tsc --noEmit`
Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/components/elements/PublicLiveFeedElement.tsx src/components/elements/PublicLiveFeedElement.test.tsx
git commit -m "feat(live): render values/leaderboard/poll/clock and audience voting"
```

---

### Task 7: Rebuild the phone control page

**Files:**
- Modify: `src/app/live/[liveFeedId]/page.tsx`

**Interfaces:**
- Consumes: POST `/api/live/[id]` actions; `computeDisplayMs`/`formatClock`.

- [ ] **Step 1: Rewrite the control page.** Read the current file first (it has the load/`send`/error scaffolding — keep it). Replace the fixed A/B steppers with a rendered list over `state.values`: each row shows the (fallback-resolved) label, the value, `−`/`+` (`bump ±step`), an inline label edit (`renameValue`), a "set exact" input (`set`), and a remove button (`removeValue`). An "Add" control (`addValue`, label only — the server mints the id) shown for `leaderboard`/`poll`; hidden for `single` (pin 1) and `versus` (pin 2). When the fetched `values` is empty, seed the on-screen list from the preset (one row for single/goal, two for versus, empty for leaderboard/poll) so the first `bump`/`add` persists real entries. Add clock controls when `state.clock.mode !== 'off'`: Start/Pause (`clockStart`/`clockPause`), a set-time field (`clockSet`, seconds→ms), Reset (`clockReset`), with a live-ticking display via `computeDisplayMs`. Keep Go Live / End / Reset and the `step` query param.

  Because this is a client page with no unit test, the gate is `tsc` plus the Task 9 browser smoke test.

- [ ] **Step 2: Typecheck**

Run: `./node_modules/.bin/tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add "src/app/live/[liveFeedId]/page.tsx"
git commit -m "feat(live): rebuild phone control for N values and the clock"
```

---

### Task 8: Drop the legacy A/B columns

**Files:**
- Modify: `prisma/schema.prisma` (remove `valueA`/`valueB` from `LiveFeed`)
- Create: `prisma/migrations/20260725000100_live_feed_drop_ab/migration.sql`

- [ ] **Step 1: Confirm no code references remain**

Run: `grep -rn "valueA\|valueB" src`
Expected: no matches under `src`. If any remain, they belong to earlier tasks — fix them before dropping the columns.

- [ ] **Step 2: Remove the fields** from `model LiveFeed` in `prisma/schema.prisma` (delete the `valueA Int @default(0)` and `valueB Int @default(0)` lines).

- [ ] **Step 3: Write the migration**

Create `prisma/migrations/20260725000100_live_feed_drop_ab/migration.sql`:

```sql
-- Values now live in LiveFeed.values (backfilled in 20260725000000). Drop A/B.
ALTER TABLE "LiveFeed" DROP COLUMN "valueA";
ALTER TABLE "LiveFeed" DROP COLUMN "valueB";
```

- [ ] **Step 4: Generate, apply, typecheck**

Run: `./node_modules/.bin/prisma generate`
Run: `./node_modules/.bin/prisma db execute --file prisma/migrations/20260725000100_live_feed_drop_ab/migration.sql --schema prisma/schema.prisma`
Run: `./node_modules/.bin/tsc --noEmit`
Expected: all clean. A `tsc` error here means a stray `valueA/valueB` reference survived Step 1.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260725000100_live_feed_drop_ab
git commit -m "feat(live): drop legacy valueA/valueB columns"
```

---

### Task 9: Full verification and browser smoke test

- [ ] **Step 1: Typecheck**

Run: `./node_modules/.bin/tsc --noEmit` → exit 0.

- [ ] **Step 2: Full suite**

Run: `export $(grep -E '^JWT_SECRET=' .env | tr -d '"'); ./node_modules/.bin/vitest run`
Expected: only the known pre-existing `api/messages/upload` failure. Report exact counts.

- [ ] **Step 3: Browser smoke test.** Start the dev server from this worktree on a free port. Create a fixture Display owned by the smoke user with a live-feed element in `sections` (preset `versus` with a `countdown` clock, and a second element preset `poll`). Save so reconcile creates the rows. Then:
  1. Open `/live/{elementId}` as the owner: add/rename two competitors, bump each, Start the clock, confirm it ticks, Pause, confirm it holds.
  2. Open the public page: confirm the versus score and a ticking clock render; confirm the value persists after reload (server-side, not local).
  3. On the poll element's public render, tap to vote; confirm the tally increments and a second vote from the same browser is refused.
  4. Confirm the clock shows the *same* time on the control page and the public page within a second (server-authoritative).
  Do not skip this — unit tests mock fetch and cannot catch a clock-anchor bug, a reconcile gap, or a hydration mismatch.

- [ ] **Step 4: Remove fixtures.** Delete the fixture Display and its rows (cascade). The dev DB is shared.

## Done when

- A live feed holds N labeled values; leaderboard ranks them, poll shows proportions.
- The clock pauses/resumes without drift and shows the same time to owner and audience.
- Audience taps vote once (best-effort); non-poll or closed feeds refuse votes.
- No client-sent value or time is ever persisted; the server clock is authoritative.
- `tsc` exit 0; suite shows only the known pre-existing failure.
