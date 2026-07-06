# Live Feed Element Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `live-feed` page element whose value(s) the page owner controls live from their phone, displayed on the public page via ~3s polling, with three presets (single counter / versus score / goal meter).

**Architecture:** Static config (preset, title, labels, target, color, step) lives in the element JSON like every other element. Live state (isLive, valueA, valueB, startedAt) lives in a new `LiveFeed` DB row keyed by the element's own `id`, created when the page is saved. The phone control page (`/live/[id]`) POSTs owner-only actions; the public element GETs the state on an interval. All state transitions go through one pure reducer.

**Tech Stack:** Next.js 15 App Router, React 19, Prisma + PostgreSQL, Zustand (existing), Tailwind, Vitest.

## Global Constraints

- Package manager: **pnpm**. Do NOT run `pnpm install` unless a new dependency is added; this plan adds **no new dependencies**.
- DB access requires `DATABASE_URL` pointed at the local container over IPv4, set inline per command: `export DATABASE_URL="postgresql://pages:pages@127.0.0.1:5434/pages"` (127.0.0.1, NOT localhost).
- Prisma migrations are non-interactive here — NEVER run `prisma migrate dev`. Create the migration folder + SQL by hand, then `prisma migrate deploy`.
- The `LiveFeed` row key is the **element's own `id`** (`el-<ts>-<rand>`). There is no separate `liveFeedId` field.
- New element wiring must follow the established flow (canvas.ts → components → SlashCommandMenu → ColumnCanvas → elements/index.ts → render-elements.tsx). `PageEditor.handleCommandSelect` needs NO edit (its `default:` case delegates to `createElement()`).
- Values are non-negative integers; the reducer clamps at 0.
- Windows: don't run `pnpm build` while `pnpm dev` is running. Verify with `pnpm test` + `npx tsc --noEmit`.
- Commit after each task.

---

## File Structure

**Create:**
- `src/lib/live-feed.ts` — pure reducer + types (`applyLiveAction`, `LiveFeedState`, `LiveAction`, `IDLE_STATE`).
- `src/lib/live-feed.test.ts` — reducer unit tests.
- `src/lib/live-feed-reconcile.ts` — `findLiveFeedIds(json)` deep-walk.
- `src/lib/live-feed-reconcile.test.ts` — walk tests.
- `src/app/api/live/[liveFeedId]/route.ts` — public GET + owner-only POST.
- `src/app/api/live/[liveFeedId]/route.test.ts` — API tests.
- `src/components/elements/LiveFeedElement.tsx` — editor component.
- `src/components/elements/PublicLiveFeedElement.tsx` — public/preview component (polls).
- `src/components/elements/PublicLiveFeedElement.test.tsx` — preset render tests.
- `src/app/live/[liveFeedId]/page.tsx` — mobile control page (owner-only).

**Modify:**
- `prisma/schema.prisma` — add `LiveFeed` model + `Display.liveFeeds` back-relation.
- `prisma/migrations/<ts>_add_live_feed/migration.sql` — new migration.
- `src/lib/types/canvas.ts` — `ElementType` union, `CanvasElement` fields, `createElement()` default.
- `src/app/api/displays/[id]/route.ts` — reconcile hook in PATCH.
- `src/components/canvas/SlashCommandMenu.tsx` — menu entry + "Live" category.
- `src/components/canvas/ColumnCanvas.tsx` — `renderElement` case.
- `src/components/elements/index.ts` — exports.
- `src/lib/render-elements.tsx` — published-page case.
- `src/middleware.ts` — protect `/live/:path*`.

---

## Task 1: Pure live-state reducer

**Files:**
- Create: `src/lib/live-feed.ts`
- Test: `src/lib/live-feed.test.ts`

**Interfaces:**
- Produces: `LiveFeedState = { isLive: boolean; valueA: number; valueB: number; startedAt: string | null }`; `type LiveAction`; `IDLE_STATE: LiveFeedState`; `applyLiveAction(state: LiveFeedState, action: LiveAction, now: string): LiveFeedState`.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/live-feed.test.ts
import { describe, it, expect } from 'vitest'
import { applyLiveAction, IDLE_STATE } from './live-feed'

const NOW = '2026-07-06T00:00:00.000Z'

describe('applyLiveAction', () => {
  it('start sets isLive and stamps startedAt once', () => {
    const s1 = applyLiveAction(IDLE_STATE, { action: 'start' }, NOW)
    expect(s1.isLive).toBe(true)
    expect(s1.startedAt).toBe(NOW)
    const s2 = applyLiveAction(s1, { action: 'start' }, '2026-07-06T01:00:00.000Z')
    expect(s2.startedAt).toBe(NOW) // not overwritten
  })

  it('end clears isLive but keeps values', () => {
    const live = { isLive: true, valueA: 5, valueB: 3, startedAt: NOW }
    expect(applyLiveAction(live, { action: 'end' }, NOW)).toEqual({ ...live, isLive: false })
  })

  it('bump adjusts the chosen side and clamps at 0', () => {
    let s = applyLiveAction(IDLE_STATE, { action: 'bump', side: 'A', delta: 3 }, NOW)
    expect(s.valueA).toBe(3)
    s = applyLiveAction(s, { action: 'bump', side: 'B', delta: 2 }, NOW)
    expect(s.valueB).toBe(2)
    s = applyLiveAction(s, { action: 'bump', side: 'A', delta: -10 }, NOW)
    expect(s.valueA).toBe(0) // clamped
  })

  it('bump defaults to side A', () => {
    const s = applyLiveAction(IDLE_STATE, { action: 'bump', delta: 1 }, NOW)
    expect(s.valueA).toBe(1)
  })

  it('set overrides given sides, clamps and floors', () => {
    const s = applyLiveAction(IDLE_STATE, { action: 'set', valueA: 42.9, valueB: -5 }, NOW)
    expect(s.valueA).toBe(42)
    expect(s.valueB).toBe(0)
  })

  it('reset zeroes everything and ends', () => {
    const live = { isLive: true, valueA: 9, valueB: 4, startedAt: NOW }
    expect(applyLiveAction(live, { action: 'reset' }, NOW)).toEqual(IDLE_STATE)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/live-feed.test.ts`
Expected: FAIL — cannot find module `./live-feed`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/live-feed.ts
export type LiveFeedPreset = 'single' | 'versus' | 'goal'

export interface LiveFeedState {
  isLive: boolean
  valueA: number
  valueB: number
  startedAt: string | null // ISO timestamp
}

export type LiveAction =
  | { action: 'start' }
  | { action: 'end' }
  | { action: 'reset' }
  | { action: 'bump'; side?: 'A' | 'B'; delta: number }
  | { action: 'set'; valueA?: number; valueB?: number }

export const IDLE_STATE: LiveFeedState = { isLive: false, valueA: 0, valueB: 0, startedAt: null }

const clamp = (n: number) => Math.max(0, Math.floor(n))

export function applyLiveAction(state: LiveFeedState, action: LiveAction, now: string): LiveFeedState {
  switch (action.action) {
    case 'start':
      return { ...state, isLive: true, startedAt: state.startedAt ?? now }
    case 'end':
      return { ...state, isLive: false }
    case 'reset':
      return { ...IDLE_STATE }
    case 'bump': {
      const side = action.side ?? 'A'
      if (side === 'B') return { ...state, valueB: clamp(state.valueB + action.delta) }
      return { ...state, valueA: clamp(state.valueA + action.delta) }
    }
    case 'set':
      return {
        ...state,
        valueA: action.valueA != null ? clamp(action.valueA) : state.valueA,
        valueB: action.valueB != null ? clamp(action.valueB) : state.valueB,
      }
    default:
      return state
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/live-feed.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/live-feed.ts src/lib/live-feed.test.ts
git commit -m "feat(live-feed): pure live-state reducer + tests"
```

---

## Task 2: Reconcile helper (find live-feed element ids)

**Files:**
- Create: `src/lib/live-feed-reconcile.ts`
- Test: `src/lib/live-feed-reconcile.test.ts`

**Interfaces:**
- Produces: `findLiveFeedIds(json: unknown): string[]` — returns unique ids of every object with `type === 'live-feed'` and a string `id`, anywhere in the JSON tree.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/live-feed-reconcile.test.ts
import { describe, it, expect } from 'vitest'
import { findLiveFeedIds } from './live-feed-reconcile'

describe('findLiveFeedIds', () => {
  it('finds ids nested in sections/columns/elements', () => {
    const sections = [
      { id: 's1', columns: [
        { id: 'c1', elements: [
          { id: 'el-1', type: 'text' },
          { id: 'el-2', type: 'live-feed' },
        ] },
      ] },
    ]
    expect(findLiveFeedIds(sections)).toEqual(['el-2'])
  })

  it('finds ids inside tab-shaped nesting and dedupes repeats', () => {
    const tabs = [
      { id: 't1', sections: [{ columns: [{ elements: [{ id: 'el-9', type: 'live-feed' }] }] }] },
      { id: 't2', sections: [{ columns: [{ elements: [{ id: 'el-9', type: 'live-feed' }] }] }] },
    ]
    expect(findLiveFeedIds(tabs)).toEqual(['el-9']) // deduped
  })

  it('returns [] for non-objects and empty input', () => {
    expect(findLiveFeedIds(null)).toEqual([])
    expect(findLiveFeedIds([])).toEqual([])
    expect(findLiveFeedIds('nope')).toEqual([])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/live-feed-reconcile.test.ts`
Expected: FAIL — cannot find module `./live-feed-reconcile`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/live-feed-reconcile.ts
// Deep-walk any JSON (sections, tabs, headerCard) and collect the ids of
// every element whose type is 'live-feed'. Structure-agnostic on purpose so
// it keeps working if nesting changes.
export function findLiveFeedIds(json: unknown): string[] {
  const ids: string[] = []
  const walk = (node: unknown) => {
    if (Array.isArray(node)) {
      for (const item of node) walk(item)
      return
    }
    if (node && typeof node === 'object') {
      const obj = node as Record<string, unknown>
      if (obj.type === 'live-feed' && typeof obj.id === 'string') ids.push(obj.id)
      for (const value of Object.values(obj)) walk(value)
    }
  }
  walk(json)
  return Array.from(new Set(ids))
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/live-feed-reconcile.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/live-feed-reconcile.ts src/lib/live-feed-reconcile.test.ts
git commit -m "feat(live-feed): findLiveFeedIds deep-walk helper + tests"
```

---

## Task 3: Prisma `LiveFeed` model + migration

**Files:**
- Modify: `prisma/schema.prisma` (after the `DisplayCollaborator` model, ~line 151; and add a back-relation to `Display`)
- Create: `prisma/migrations/20260706120000_add_live_feed/migration.sql`

**Interfaces:**
- Produces: Prisma model `LiveFeed` accessible as `db.liveFeed` with fields `id, displayId, isLive, valueA, valueB, startedAt, lastUpdatedAt, createdAt`.

- [ ] **Step 1: Add the back-relation to the `Display` model**

In `prisma/schema.prisma`, inside `model Display { ... }`, next to the other relations (e.g. after `trackerEntries  TrackerEntry[]` ~line 119), add:

```prisma
  liveFeeds       LiveFeed[]
```

- [ ] **Step 2: Add the `LiveFeed` model**

Append after the `DisplayCollaborator` model (~line 151):

```prisma
model LiveFeed {
  id            String    @id
  displayId     String
  display       Display   @relation(fields: [displayId], references: [id], onDelete: Cascade)
  isLive        Boolean   @default(false)
  valueA        Int       @default(0)
  valueB        Int       @default(0)
  startedAt     DateTime?
  lastUpdatedAt DateTime  @updatedAt
  createdAt     DateTime  @default(now())

  @@index([displayId])
}
```

- [ ] **Step 3: Create the migration SQL**

Create `prisma/migrations/20260706120000_add_live_feed/migration.sql`:

```sql
-- CreateTable
CREATE TABLE "LiveFeed" (
    "id" TEXT NOT NULL,
    "displayId" TEXT NOT NULL,
    "isLive" BOOLEAN NOT NULL DEFAULT false,
    "valueA" INTEGER NOT NULL DEFAULT 0,
    "valueB" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "lastUpdatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LiveFeed_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LiveFeed_displayId_idx" ON "LiveFeed"("displayId");

-- AddForeignKey
ALTER TABLE "LiveFeed" ADD CONSTRAINT "LiveFeed_displayId_fkey" FOREIGN KEY ("displayId") REFERENCES "Display"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

- [ ] **Step 4: Apply migration + regenerate client**

Run:
```bash
export DATABASE_URL="postgresql://pages:pages@127.0.0.1:5434/pages"
npx prisma migrate deploy
npx prisma generate
```
Expected: "1 migration applied" (or "already applied" if re-run) and "Generated Prisma Client". If `prisma generate` EPERMs on Windows (dev server holding the DLL), stop dev and retry.

- [ ] **Step 5: Verify the schema matches (no drift)**

Run:
```bash
export DATABASE_URL="postgresql://pages:pages@127.0.0.1:5434/pages"
npx prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --exit-code
```
Expected: exit code 0 and "No difference detected".

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260706120000_add_live_feed
git commit -m "feat(live-feed): LiveFeed prisma model + migration"
```

---

## Task 4: Live API routes (public GET + owner-only POST)

**Files:**
- Create: `src/app/api/live/[liveFeedId]/route.ts`
- Test: `src/app/api/live/[liveFeedId]/route.test.ts`

**Interfaces:**
- Consumes: `applyLiveAction`, `IDLE_STATE`, `LiveAction` (Task 1); `db.liveFeed` (Task 3); `getUser` (`src/lib/auth.ts`); `rateLimit` (`src/lib/rate-limit.ts`).
- Produces: `GET /api/live/[liveFeedId]` → `{ isLive, valueA, valueB, startedAt, lastUpdatedAt }`; `POST /api/live/[liveFeedId]` (body = `LiveAction`) → same shape. 401 no-auth, 403 non-owner, 404 no-row-on-POST.

- [ ] **Step 1: Write the failing test**

```ts
// src/app/api/live/[liveFeedId]/route.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/rate-limit', () => ({ rateLimit: vi.fn().mockResolvedValue(null) }))
vi.mock('@/lib/auth', () => ({ getUser: vi.fn() }))
vi.mock('@/lib/db', () => ({
  db: { liveFeed: { findUnique: vi.fn(), update: vi.fn() } },
}))

import { GET, POST } from './route'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'

const ctx = (liveFeedId: string) => ({ params: Promise.resolve({ liveFeedId }) })
const req = (body?: unknown) =>
  new NextRequest('http://localhost/api/live/el-1', {
    method: body ? 'POST' : 'GET',
    body: body ? JSON.stringify(body) : undefined,
  })

beforeEach(() => vi.clearAllMocks())

describe('GET /api/live/[liveFeedId]', () => {
  it('returns idle default when no row exists', async () => {
    ;(db.liveFeed.findUnique as any).mockResolvedValue(null)
    const res = await GET(req(), ctx('el-1'))
    const json = await res.json()
    expect(json).toMatchObject({ isLive: false, valueA: 0, valueB: 0, startedAt: null })
  })

  it('returns the stored state when a row exists', async () => {
    ;(db.liveFeed.findUnique as any).mockResolvedValue({
      isLive: true, valueA: 3, valueB: 1, startedAt: new Date('2026-07-06T00:00:00Z'),
      lastUpdatedAt: new Date('2026-07-06T00:01:00Z'),
    })
    const res = await GET(req(), ctx('el-1'))
    const json = await res.json()
    expect(json).toMatchObject({ isLive: true, valueA: 3, valueB: 1 })
  })
})

describe('POST /api/live/[liveFeedId]', () => {
  it('401 when unauthenticated', async () => {
    ;(getUser as any).mockResolvedValue(null)
    const res = await POST(req({ action: 'start' }), ctx('el-1'))
    expect(res.status).toBe(401)
  })

  it('404 when the row does not exist yet', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'u1' })
    ;(db.liveFeed.findUnique as any).mockResolvedValue(null)
    const res = await POST(req({ action: 'start' }), ctx('el-1'))
    expect(res.status).toBe(404)
  })

  it('403 when the requester is not the owner', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'u1' })
    ;(db.liveFeed.findUnique as any).mockResolvedValue({
      id: 'el-1', isLive: false, valueA: 0, valueB: 0, startedAt: null, display: { userId: 'someone-else' },
    })
    const res = await POST(req({ action: 'bump', delta: 1 }), ctx('el-1'))
    expect(res.status).toBe(403)
  })

  it('applies the action for the owner', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'u1' })
    ;(db.liveFeed.findUnique as any).mockResolvedValue({
      id: 'el-1', isLive: false, valueA: 0, valueB: 0, startedAt: null, display: { userId: 'u1' },
    })
    ;(db.liveFeed.update as any).mockResolvedValue({
      isLive: false, valueA: 1, valueB: 0, startedAt: null, lastUpdatedAt: new Date('2026-07-06T00:00:00Z'),
    })
    const res = await POST(req({ action: 'bump', delta: 1 }), ctx('el-1'))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.valueA).toBe(1)
    expect(db.liveFeed.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'el-1' }, data: expect.objectContaining({ valueA: 1 }) })
    )
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run "src/app/api/live/[liveFeedId]/route.test.ts"`
Expected: FAIL — cannot find module `./route`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/app/api/live/[liveFeedId]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'
import { rateLimit } from '@/lib/rate-limit'
import { applyLiveAction, IDLE_STATE, type LiveAction, type LiveFeedState } from '@/lib/live-feed'

type Params = { params: Promise<{ liveFeedId: string }> }

function serialize(row: {
  isLive: boolean; valueA: number; valueB: number; startedAt: Date | null; lastUpdatedAt: Date
}) {
  return {
    isLive: row.isLive,
    valueA: row.valueA,
    valueB: row.valueB,
    startedAt: row.startedAt ? row.startedAt.toISOString() : null,
    lastUpdatedAt: row.lastUpdatedAt.toISOString(),
  }
}

// GET — public, numbers only, no caching so polling sees fresh values.
export async function GET(request: NextRequest, { params }: Params) {
  const limited = await rateLimit(request, { limit: 120, windowMs: 60_000, prefix: 'live-read' })
  if (limited) return limited

  const { liveFeedId } = await params
  const row = await db.liveFeed.findUnique({ where: { id: liveFeedId } })

  const body = row
    ? serialize(row)
    : { ...IDLE_STATE, lastUpdatedAt: null }

  return NextResponse.json(body, { headers: { 'Cache-Control': 'no-store' } })
}

// POST — owner-only. Row must already exist (created on page save).
export async function POST(request: NextRequest, { params }: Params) {
  const limited = await rateLimit(request, { limit: 240, windowMs: 60_000, prefix: 'live-write' })
  if (limited) return limited

  const { liveFeedId } = await params
  const user = await getUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const row = await db.liveFeed.findUnique({
    where: { id: liveFeedId },
    include: { display: { select: { userId: true } } },
  })
  if (!row) return NextResponse.json({ error: 'Not found — save your page first' }, { status: 404 })
  if (row.display.userId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let action: LiveAction
  try {
    action = (await request.json()) as LiveAction
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  const current: LiveFeedState = {
    isLive: row.isLive,
    valueA: row.valueA,
    valueB: row.valueB,
    startedAt: row.startedAt ? row.startedAt.toISOString() : null,
  }
  const next = applyLiveAction(current, action, new Date().toISOString())

  const updated = await db.liveFeed.update({
    where: { id: liveFeedId },
    data: {
      isLive: next.isLive,
      valueA: next.valueA,
      valueB: next.valueB,
      startedAt: next.startedAt ? new Date(next.startedAt) : null,
    },
  })

  return NextResponse.json(serialize(updated))
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run "src/app/api/live/[liveFeedId]/route.test.ts"`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add "src/app/api/live/[liveFeedId]"
git commit -m "feat(live-feed): GET/POST /api/live/[liveFeedId] with owner-only writes"
```

---

## Task 5: Reconcile live rows on page save

**Files:**
- Modify: `src/app/api/displays/[id]/route.ts` (PATCH handler, after `db.display.update`, ~line 108)
- Test: extends `src/lib/live-feed-reconcile.test.ts` is not enough — add an integration-style check via a new test file below.

**Interfaces:**
- Consumes: `findLiveFeedIds` (Task 2), `db.liveFeed.createMany` (Task 3).
- Produces: after a PATCH that saves sections/tabs, a `LiveFeed` row exists (id = element id, displayId = the display) for every `live-feed` element; existing rows are untouched (`skipDuplicates`).

- [ ] **Step 1: Write the failing test**

```ts
// src/app/api/displays/[id]/live-reconcile.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', () => ({ getUser: vi.fn().mockResolvedValue({ id: 'u1', name: 'U', username: 'u', avatar: null }) }))
vi.mock('@/lib/collab', () => ({
  canEdit: () => true,
  splitUpdate: (known: Record<string, unknown>) => ({ data: known, rejected: [] }),
  COLLAB_FIELDS: ['sections', 'tabs', 'background', 'spacing', 'headerCard'],
}))
vi.mock('@/lib/categories', () => ({ isValidCategory: () => true }))
vi.mock('@/lib/notifications', () => ({ notifyFollowers: vi.fn() }))
vi.mock('@/lib/db', () => ({
  db: {
    display: {
      findUnique: vi.fn().mockResolvedValue({ id: 'd1', userId: 'u1', published: false, version: 0, collaborators: [] }),
      update: vi.fn(),
    },
    liveFeed: { createMany: vi.fn().mockResolvedValue({ count: 1 }) },
  },
}))

import { PATCH } from './route'
import { db } from '@/lib/db'

const sections = [{ id: 's1', columns: [{ id: 'c1', elements: [{ id: 'el-live', type: 'live-feed' }] }] }]

beforeEach(() => vi.clearAllMocks())

it('creates a LiveFeed row for each live-feed element on save', async () => {
  ;(db.display.update as any).mockResolvedValue({ id: 'd1', sections, tabs: null })
  const request = new NextRequest('http://localhost/api/displays/d1', {
    method: 'PATCH',
    body: JSON.stringify({ sections, version: 0 }),
  })
  const res = await PATCH(request, { params: Promise.resolve({ id: 'd1' }) })
  expect(res.status).toBe(200)
  expect(db.liveFeed.createMany).toHaveBeenCalledWith({
    data: [{ id: 'el-live', displayId: 'd1' }],
    skipDuplicates: true,
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run "src/app/api/displays/[id]/live-reconcile.test.ts"`
Expected: FAIL — `createMany` not called (reconcile not wired yet).

- [ ] **Step 3: Add the reconcile hook**

In `src/app/api/displays/[id]/route.ts`, add the import at the top with the other imports:

```ts
import { findLiveFeedIds } from '@/lib/live-feed-reconcile'
```

Then, immediately after the `const updated = await db.display.update({ ... })` call (~line 108) and before the `if (data.published === true ...)` block, insert:

```ts
    // Reconcile live-feed rows: ensure a LiveFeed row exists for every
    // live-feed element in the saved content (id = element id). Idempotent.
    try {
      const liveIds = Array.from(new Set([
        ...findLiveFeedIds(updated.sections),
        ...findLiveFeedIds(updated.tabs),
      ]))
      if (liveIds.length > 0) {
        await db.liveFeed.createMany({
          data: liveIds.map((lfId) => ({ id: lfId, displayId: id })),
          skipDuplicates: true,
        })
      }
    } catch (err) {
      console.error('live-feed reconcile failed:', err)
    }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run "src/app/api/displays/[id]/live-reconcile.test.ts"`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add "src/app/api/displays/[id]/route.ts" "src/app/api/displays/[id]/live-reconcile.test.ts"
git commit -m "feat(live-feed): reconcile LiveFeed rows on display save"
```

---

## Task 6: Element type, fields, and default

**Files:**
- Modify: `src/lib/types/canvas.ts` (union ~line 65; `CanvasElement` fields after tracker fields ~line 248; `createElement()` switch ~line 774)

**Interfaces:**
- Produces: `ElementType` includes `'live-feed'`; `CanvasElement` gains `liveFeedPreset`, `liveFeedTitle`, `liveFeedLabelA`, `liveFeedLabelB`, `liveFeedTarget`, `liveFeedStep`, `liveFeedColor`; `createElement('live-feed')` returns sane defaults.

- [ ] **Step 1: Add to the `ElementType` union**

In `src/lib/types/canvas.ts`, after the `'jersey'` entry (~line 70) in the `ElementType` union, add:

```ts
  // Batch 2: Live
  | 'live-feed'    // Phone-controlled live counter/score (single/versus/goal)
```

- [ ] **Step 2: Add the fields to `CanvasElement`**

After the tracker-specific fields block (the line `trackerTimeRange?: '7d' | '30d' | '90d' | '1y' | 'all'`, ~line 248), add:

```ts
  // Live Feed specific (phone-controlled live counter/score). Row key = element id.
  liveFeedPreset?: 'single' | 'versus' | 'goal'
  liveFeedTitle?: string
  liveFeedLabelA?: string          // single/goal: value label; versus: home side label
  liveFeedLabelB?: string          // versus: away side label
  liveFeedTarget?: number          // goal: target value
  liveFeedStep?: number            // control-page +/- increment
  liveFeedColor?: string           // accent color
```

- [ ] **Step 3: Add the `createElement` default**

In the `createElement` switch, after the `case 'jersey':` block returns (~line 774, before `case 'kit-profile':` or wherever jersey ends), add a new case:

```ts
    case 'live-feed':
      return {
        ...base,
        liveFeedPreset: 'single',
        liveFeedTitle: 'Live Count',
        liveFeedLabelA: 'Home',
        liveFeedLabelB: 'Away',
        liveFeedTarget: 100,
        liveFeedStep: 1,
        liveFeedColor: '#39D98A',
      }
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS (no errors). (Components/switches added in later tasks; the union addition alone compiles because `render-elements`/`ColumnCanvas` switches have `default` cases.)

Note: if `tsc` reports a missing case in an exhaustive switch without a default, proceed — Task 8 adds the switch cases; re-run tsc at the end of Task 8.

- [ ] **Step 5: Commit**

```bash
git add src/lib/types/canvas.ts
git commit -m "feat(live-feed): element type, fields, and createElement default"
```

---

## Task 7: Public element (polling display, 3 presets)

**Files:**
- Create: `src/components/elements/PublicLiveFeedElement.tsx`
- Test: `src/components/elements/PublicLiveFeedElement.test.tsx`

**Interfaces:**
- Consumes: `CanvasElement` (uses `element.id` + `liveFeed*` fields); `GET /api/live/[element.id]` (Task 4).
- Produces: `export function PublicLiveFeedElement({ element }: { element: CanvasElement })`.

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/elements/PublicLiveFeedElement.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { PublicLiveFeedElement } from './PublicLiveFeedElement'
import type { CanvasElement } from '@/lib/types/canvas'

function el(overrides: Partial<CanvasElement>): CanvasElement {
  return { id: 'el-1', type: 'live-feed', ...overrides } as CanvasElement
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ isLive: true, valueA: 7, valueB: 2, startedAt: null, lastUpdatedAt: null }),
  }))
})
afterEach(() => vi.unstubAllGlobals())

describe('PublicLiveFeedElement', () => {
  it('single preset shows the value and title', async () => {
    render(<PublicLiveFeedElement element={el({ liveFeedPreset: 'single', liveFeedTitle: 'Push-ups', liveFeedLabelA: 'Reps' })} />)
    await waitFor(() => expect(screen.getByText('7')).toBeTruthy())
    expect(screen.getByText('Push-ups')).toBeTruthy()
    expect(screen.getByText(/LIVE/i)).toBeTruthy() // isLive badge
  })

  it('versus preset shows both values and labels', async () => {
    render(<PublicLiveFeedElement element={el({ liveFeedPreset: 'versus', liveFeedLabelA: 'HOME', liveFeedLabelB: 'AWAY' })} />)
    await waitFor(() => expect(screen.getByText('7')).toBeTruthy())
    expect(screen.getByText('2')).toBeTruthy()
    expect(screen.getByText('HOME')).toBeTruthy()
    expect(screen.getByText('AWAY')).toBeTruthy()
  })

  it('goal preset shows value toward target', async () => {
    render(<PublicLiveFeedElement element={el({ liveFeedPreset: 'goal', liveFeedTarget: 10, liveFeedTitle: 'Goal' })} />)
    await waitFor(() => expect(screen.getByText('7')).toBeTruthy())
    expect(screen.getByText(/10/)).toBeTruthy() // target shown somewhere
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/elements/PublicLiveFeedElement.test.tsx`
Expected: FAIL — cannot find module `./PublicLiveFeedElement`.

- [ ] **Step 3: Write the implementation**

```tsx
// src/components/elements/PublicLiveFeedElement.tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { Radio } from 'lucide-react'
import type { CanvasElement } from '@/lib/types/canvas'

interface LiveState {
  isLive: boolean
  valueA: number
  valueB: number
  startedAt: string | null
  lastUpdatedAt: string | null
}

const POLL_MS = 3000

export function PublicLiveFeedElement({ element }: { element: CanvasElement }) {
  const preset = element.liveFeedPreset ?? 'single'
  const title = element.liveFeedTitle ?? 'Live'
  const labelA = element.liveFeedLabelA ?? ''
  const labelB = element.liveFeedLabelB ?? ''
  const target = element.liveFeedTarget ?? 0
  const color = element.liveFeedColor ?? '#39D98A'

  const [state, setState] = useState<LiveState>({
    isLive: false, valueA: 0, valueB: 0, startedAt: null, lastUpdatedAt: null,
  })
  const inFlight = useRef(false)

  useEffect(() => {
    let cancelled = false
    const poll = async () => {
      if (inFlight.current || document.visibilityState === 'hidden') return
      inFlight.current = true
      try {
        const res = await fetch(`/api/live/${element.id}`, { cache: 'no-store' })
        if (res.ok) {
          const data = (await res.json()) as LiveState
          if (!cancelled) setState(data)
        }
      } catch {
        /* keep last known state */
      } finally {
        inFlight.current = false
      }
    }
    poll()
    const timer = setInterval(poll, POLL_MS)
    return () => { cancelled = true; clearInterval(timer) }
  }, [element.id])

  const liveBadge = state.isLive ? (
    <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-red-600">
      <Radio className="w-3.5 h-3.5 animate-pulse" /> Live
    </span>
  ) : (
    <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Not live</span>
  )

  const dim = state.isLive ? '' : 'opacity-80'

  return (
    <div className={`rounded-2xl border border-slate-200 bg-white p-6 ${dim}`} style={{ borderTopColor: color, borderTopWidth: 3 }}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-bold text-slate-900">{title}</h3>
        {liveBadge}
      </div>

      {preset === 'single' && (
        <div className="text-center py-2">
          <div className="text-6xl font-extrabold tabular-nums" style={{ color }}>{state.valueA}</div>
          {labelA && <div className="mt-1 text-sm font-medium text-slate-500">{labelA}</div>}
        </div>
      )}

      {preset === 'versus' && (
        <div className="flex items-center justify-around py-2">
          <div className="text-center flex-1">
            <div className="text-5xl font-extrabold tabular-nums text-slate-900">{state.valueA}</div>
            <div className="mt-1 text-sm font-semibold text-slate-600">{labelA || 'Home'}</div>
          </div>
          <div className="text-2xl font-bold text-slate-300 px-3">–</div>
          <div className="text-center flex-1">
            <div className="text-5xl font-extrabold tabular-nums text-slate-900">{state.valueB}</div>
            <div className="mt-1 text-sm font-semibold text-slate-600">{labelB || 'Away'}</div>
          </div>
        </div>
      )}

      {preset === 'goal' && (
        <div className="py-2">
          <div className="flex items-baseline justify-between mb-2">
            <span className="text-3xl font-extrabold tabular-nums" style={{ color }}>{state.valueA}</span>
            <span className="text-sm font-medium text-slate-500">of {target}</span>
          </div>
          <div className="h-3 rounded-full bg-slate-100 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${target > 0 ? Math.min(100, (state.valueA / target) * 100) : 0}%`, backgroundColor: color }}
            />
          </div>
          {labelA && <div className="mt-2 text-sm font-medium text-slate-500">{labelA}</div>}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/elements/PublicLiveFeedElement.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/elements/PublicLiveFeedElement.tsx src/components/elements/PublicLiveFeedElement.test.tsx
git commit -m "feat(live-feed): public polling element with single/versus/goal presets"
```

---

## Task 8: Editor element + wiring

**Files:**
- Create: `src/components/elements/LiveFeedElement.tsx`
- Modify: `src/components/elements/index.ts`
- Modify: `src/components/canvas/SlashCommandMenu.tsx`
- Modify: `src/components/canvas/ColumnCanvas.tsx`
- Modify: `src/lib/render-elements.tsx`

**Interfaces:**
- Consumes: `CanvasElement`; editor props `{ element, onChange, onDelete, isSelected, onSelect }`; `PublicLiveFeedElement` (Task 7).
- Produces: `export function LiveFeedElement(props)`; menu entry; both render switches route `'live-feed'`.

- [ ] **Step 1: Create the editor component**

```tsx
// src/components/elements/LiveFeedElement.tsx
'use client'

import { useState } from 'react'
import { Radio, Trash2, Smartphone, Copy, Check } from 'lucide-react'
import type { CanvasElement } from '@/lib/types/canvas'

interface Props {
  element: CanvasElement
  onChange: (updates: Partial<CanvasElement>) => void
  onDelete: () => void
  isSelected: boolean
  onSelect: () => void
}

const PRESETS = [
  { id: 'single', label: 'Single counter' },
  { id: 'versus', label: 'Versus score' },
  { id: 'goal', label: 'Goal / progress' },
] as const

export function LiveFeedElement({ element, onChange, onDelete, isSelected, onSelect }: Props) {
  const preset = element.liveFeedPreset ?? 'single'
  const [copied, setCopied] = useState(false)

  const controlPath = `/live/${element.id}`
  const controlUrl = typeof window !== 'undefined' ? `${window.location.origin}${controlPath}` : controlPath

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(controlUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch { /* clipboard blocked */ }
  }

  return (
    <div
      onClick={onSelect}
      className={`rounded-xl border-2 bg-white p-4 cursor-pointer transition-colors ${isSelected ? 'border-primary' : 'border-slate-200'}`}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-700">
          <Radio className="w-4 h-4 text-primary" /> Live Feed
        </span>
        <button onClick={(e) => { e.stopPropagation(); onDelete() }} className="p-1 text-slate-400 hover:text-red-500" aria-label="Delete">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Preset dropdown — the "tracker" selector */}
      <label className="block text-xs font-medium text-slate-500 mb-1">Tracker</label>
      <select
        value={preset}
        onChange={(e) => onChange({ liveFeedPreset: e.target.value as 'single' | 'versus' | 'goal' })}
        onClick={(e) => e.stopPropagation()}
        className="w-full mb-3 px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
      >
        {PRESETS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
      </select>

      <label className="block text-xs font-medium text-slate-500 mb-1">Title</label>
      <input
        value={element.liveFeedTitle ?? ''}
        onChange={(e) => onChange({ liveFeedTitle: e.target.value })}
        onClick={(e) => e.stopPropagation()}
        className="w-full mb-3 px-3 py-2 border border-slate-200 rounded-lg text-sm"
        placeholder="Title"
      />

      {preset === 'versus' && (
        <div className="grid grid-cols-2 gap-2 mb-3">
          <input value={element.liveFeedLabelA ?? ''} onChange={(e) => onChange({ liveFeedLabelA: e.target.value })} onClick={(e) => e.stopPropagation()} className="px-3 py-2 border border-slate-200 rounded-lg text-sm" placeholder="Home label" />
          <input value={element.liveFeedLabelB ?? ''} onChange={(e) => onChange({ liveFeedLabelB: e.target.value })} onClick={(e) => e.stopPropagation()} className="px-3 py-2 border border-slate-200 rounded-lg text-sm" placeholder="Away label" />
        </div>
      )}

      {preset === 'single' && (
        <input value={element.liveFeedLabelA ?? ''} onChange={(e) => onChange({ liveFeedLabelA: e.target.value })} onClick={(e) => e.stopPropagation()} className="w-full mb-3 px-3 py-2 border border-slate-200 rounded-lg text-sm" placeholder="Value label (e.g. Reps)" />
      )}

      {preset === 'goal' && (
        <div className="grid grid-cols-2 gap-2 mb-3">
          <input value={element.liveFeedLabelA ?? ''} onChange={(e) => onChange({ liveFeedLabelA: e.target.value })} onClick={(e) => e.stopPropagation()} className="px-3 py-2 border border-slate-200 rounded-lg text-sm" placeholder="Label" />
          <input type="number" value={element.liveFeedTarget ?? 0} onChange={(e) => onChange({ liveFeedTarget: Number(e.target.value) })} onClick={(e) => e.stopPropagation()} className="px-3 py-2 border border-slate-200 rounded-lg text-sm" placeholder="Target" />
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 mb-3">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Step</label>
          <input type="number" min={1} value={element.liveFeedStep ?? 1} onChange={(e) => onChange({ liveFeedStep: Math.max(1, Number(e.target.value)) })} onClick={(e) => e.stopPropagation()} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Color</label>
          <input type="color" value={element.liveFeedColor ?? '#39D98A'} onChange={(e) => onChange({ liveFeedColor: e.target.value })} onClick={(e) => e.stopPropagation()} className="w-full h-9 px-1 border border-slate-200 rounded-lg" />
        </div>
      </div>

      {/* Control-from-phone panel */}
      <div className="rounded-lg bg-slate-50 border border-slate-200 p-3">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 mb-2">
          <Smartphone className="w-3.5 h-3.5" /> Control live from your phone
        </div>
        <p className="text-[11px] text-slate-500 mb-2">Save the page first, then open this link on your phone to go live.</p>
        <div className="flex items-center gap-2">
          <code className="flex-1 truncate text-[11px] bg-white border border-slate-200 rounded px-2 py-1.5">{controlUrl}</code>
          <button onClick={(e) => { e.stopPropagation(); copyLink() }} className="px-2.5 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700" aria-label="Copy link">
            {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
          <a href={controlPath} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold">Open</a>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Add exports**

In `src/components/elements/index.ts`, under the `// Batch 2` section (after the audio-player exports), add:

```ts
export { LiveFeedElement } from './LiveFeedElement'
export { PublicLiveFeedElement } from './PublicLiveFeedElement'
```

- [ ] **Step 3: Add the slash-menu entry + "Live" category**

In `src/components/canvas/SlashCommandMenu.tsx`:

(a) Add `Radio` to the lucide-react import list (near `MapPin`):
```ts
  Radio,
```
(b) In the `commands` array, after the `audio-player` entry (~line 146), add:
```ts
  { id: 'live-feed', label: 'Live Feed', icon: Radio, description: 'Live counter/score you control from your phone', category: 'Live' },
```
(c) Add `'Live'` to `CATEGORY_ORDER` (~line 149) — place it after `'Media'`:
```ts
const CATEGORY_ORDER = ['Content', 'Data & Visuals', 'Media', 'Live', 'Forms', 'Social', 'Apps', 'Kit']
```

- [ ] **Step 4: Add the `ColumnCanvas` render case**

In `src/components/canvas/ColumnCanvas.tsx`:

(a) Add the imports near the other element imports (e.g. beside `PublicPollElement` ~line 105 and its editor peers):
```ts
import { LiveFeedElement } from '@/components/elements/LiveFeedElement'
import { PublicLiveFeedElement } from '@/components/elements/PublicLiveFeedElement'
```
(b) In the `renderElement` switch, add a case following the same shape as `case 'kit-profile':` (preview → Public with no displayId):
```tsx
      case 'live-feed':
        if (isPreviewMode) {
          return <PublicLiveFeedElement element={element} />
        }
        return (
          <LiveFeedElement
            element={element}
            onChange={(updates) => onUpdateElement(sectionId, columnId, element.id, updates)}
            onDelete={() => onDeleteElement(sectionId, columnId, element.id)}
            isSelected={commonProps.isSelected}
            onSelect={commonProps.onSelect}
          />
        )
```

- [ ] **Step 5: Add the published-page case**

In `src/lib/render-elements.tsx`:

(a) Add the import near `PublicPollElement` (~line 9):
```ts
import { PublicLiveFeedElement } from '@/components/elements/PublicLiveFeedElement'
```
(b) In the switch (after `case 'audio-player':` ~line 540), add:
```tsx
    case 'live-feed':
      return <PublicLiveFeedElement element={element} />
```

- [ ] **Step 6: Typecheck + full test run**

Run:
```bash
npx tsc --noEmit
npx vitest run src/lib/live-feed.test.ts src/lib/live-feed-reconcile.test.ts src/components/elements/PublicLiveFeedElement.test.tsx
```
Expected: tsc clean; all listed tests PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/elements/LiveFeedElement.tsx src/components/elements/index.ts src/components/canvas/SlashCommandMenu.tsx src/components/canvas/ColumnCanvas.tsx src/lib/render-elements.tsx
git commit -m "feat(live-feed): editor element + slash menu, canvas, and published-page wiring"
```

---

## Task 9: Mobile control page + middleware guard

**Files:**
- Create: `src/app/live/[liveFeedId]/page.tsx`
- Modify: `src/middleware.ts` (add `/live/:path*` to the protected matcher)

**Interfaces:**
- Consumes: `GET`/`POST /api/live/[liveFeedId]` (Task 4); `CanvasElement` field semantics for labels/target are NOT available here (the page only knows numbers), so the control UI is label-agnostic (Side A / Side B).
- Produces: an owner-only mobile page that drives the live value.

- [ ] **Step 1: Confirm the middleware matcher shape**

Open `src/middleware.ts` and locate the exported `config.matcher` array (it lists protected route globs like `/dashboard/:path*`, `/editor/:path*`). Add `/live/:path*` to that array. Example (match the existing style exactly — only add the one entry):

```ts
export const config = {
  matcher: [
    // ...existing entries...
    '/live/:path*',
  ],
}
```

If `middleware.ts` guards by checking the `galli-auth` cookie and redirecting to `/login`, no other change is needed — an unauthenticated visitor to `/live/...` gets redirected, and the POST API still enforces ownership independently.

- [ ] **Step 2: Create the control page**

```tsx
// src/app/live/[liveFeedId]/page.tsx
'use client'

import { use, useEffect, useState } from 'react'
import { Radio, Plus, Minus, RotateCcw } from 'lucide-react'
import type { LiveAction } from '@/lib/live-feed'

interface LiveState {
  isLive: boolean
  valueA: number
  valueB: number
  startedAt: string | null
  lastUpdatedAt: string | null
}

export default function LiveControlPage({ params }: { params: Promise<{ liveFeedId: string }> }) {
  const { liveFeedId } = use(params)
  const [state, setState] = useState<LiveState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    fetch(`/api/live/${liveFeedId}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => setState(d))
      .catch(() => setError('Could not load this live feed.'))
  }, [liveFeedId])

  const send = async (action: LiveAction) => {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/live/${liveFeedId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(action),
      })
      if (res.status === 404) { setError('Save your page first, then reopen this link.'); return }
      if (res.status === 401 || res.status === 403) { setError('You must be signed in as the page owner.'); return }
      if (res.ok) setState(await res.json())
    } catch {
      setError('Network error — try again.')
    } finally {
      setBusy(false)
    }
  }

  if (error && !state) {
    return <div className="min-h-screen grid place-items-center p-6 text-center text-slate-600">{error}</div>
  }
  if (!state) {
    return <div className="min-h-screen grid place-items-center text-slate-400">Loading…</div>
  }

  const stepper = (side: 'A' | 'B', value: number, label: string) => (
    <div className="flex-1 text-center">
      <div className="text-sm font-semibold text-slate-500 mb-2">{label}</div>
      <div className="text-6xl font-extrabold tabular-nums text-slate-900 mb-4">{value}</div>
      <div className="flex items-center justify-center gap-3">
        <button onClick={() => send({ action: 'bump', side, delta: -1 })} className="w-16 h-16 rounded-full bg-slate-200 active:bg-slate-300 grid place-items-center" aria-label={`Decrease ${label}`}>
          <Minus className="w-7 h-7" />
        </button>
        <button onClick={() => send({ action: 'bump', side, delta: 1 })} className="w-16 h-16 rounded-full bg-primary text-primary-foreground active:brightness-95 grid place-items-center" aria-label={`Increase ${label}`}>
          <Plus className="w-7 h-7" />
        </button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col p-5 gap-6 max-w-md mx-auto">
      <header className="flex items-center justify-between pt-2">
        <span className="inline-flex items-center gap-1.5 font-bold text-slate-800">
          <Radio className="w-5 h-5 text-primary" /> Live Control
        </span>
        <span className={`text-xs font-bold uppercase tracking-wide ${state.isLive ? 'text-red-600' : 'text-slate-400'}`}>
          {state.isLive ? '● Live' : 'Off'}
        </span>
      </header>

      {error && <div className="rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm px-3 py-2">{error}</div>}

      <div className="flex items-start gap-4 bg-white rounded-2xl border border-slate-200 p-6">
        {stepper('A', state.valueA, 'Side A')}
        {stepper('B', state.valueB, 'Side B')}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {state.isLive ? (
          <button onClick={() => send({ action: 'end' })} disabled={busy} className="col-span-2 py-4 rounded-xl bg-slate-800 text-white font-bold disabled:opacity-50">End broadcast</button>
        ) : (
          <button onClick={() => send({ action: 'start' })} disabled={busy} className="col-span-2 py-4 rounded-xl bg-primary text-primary-foreground font-bold disabled:opacity-50">Go Live</button>
        )}
        <button onClick={() => send({ action: 'reset' })} disabled={busy} className="col-span-2 py-3 rounded-xl border border-slate-300 text-slate-600 font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-50">
          <RotateCcw className="w-4 h-4" /> Reset
        </button>
      </div>

      <p className="text-center text-xs text-slate-400">Single & goal presets use Side A. Versus uses both.</p>
    </div>
  )
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Manual smoke test (documented, run once)**

With the dev server running (`export DATABASE_URL="postgresql://pages:pages@127.0.0.1:5434/pages"; pnpm dev`), signed in as a page owner:
1. Add a Live Feed element to a page, pick "Versus score", **save the page**.
2. Click "Open" in the element's phone panel → the control page loads.
3. Hit **Go Live**, tap **+** on Side A twice.
4. Open the published page in another tab → within ~3s it shows `2 – 0` with a LIVE badge.
5. Hit **End** → published element keeps showing `2 – 0`, badge drops to "Not live".

Expected: all five steps behave as described. (This is a documentation step — no code change.)

- [ ] **Step 5: Commit**

```bash
git add src/app/live src/middleware.ts
git commit -m "feat(live-feed): mobile control page + /live route auth guard"
```

---

## Self-Review

**Spec coverage:**
- Preset dropdown (single/versus/goal) → Task 6 (fields/default), Task 8 (editor dropdown), Task 7 (public render). ✓
- Config/live-state split → static in element JSON (Task 6); live in `LiveFeed` row (Task 3). ✓
- Row created on save + ownership always derivable → Task 5 (reconcile), Task 4 (POST derives owner via row). ✓
- Web control page `/live/[id]` → Task 9. ✓
- Polling ~3s, single-flight, pause on hidden tab → Task 7. ✓
- Public GET (numbers only, no-store, rate-limited) + owner-only POST (401/403/404) → Task 4. ✓
- Idle = persisted last value + LIVE badge only while live → Task 7. ✓
- Pure reducer, unit-tested → Task 1. ✓
- Standard element wiring → Task 8. ✓
- Middleware admits `/live` → Task 9. ✓

**Deviations from spec (intentional, noted):**
- **No separate `liveFeedId` field** — the element's own `id` is the `LiveFeed` key (simpler, still unique). Documented in Global Constraints.
- **QR code deferred** — the spec mentioned a QR in the editor panel; v1 ships link + copy + "Open" to avoid a new dependency. QR is a clean follow-on (add `qrcode` → `toDataURL`). Flagged here so it isn't mistaken for an omission.
- **Control page is label-agnostic** (Side A / Side B) — it only reads live numbers, not the element's static labels (which live in the page JSON the control page doesn't load). Acceptable for v1; a later enhancement can pass labels via query string.

**Placeholder scan:** none — every step has concrete code/commands.

**Type consistency:** `LiveFeedState`/`LiveAction`/`applyLiveAction` signatures match across Tasks 1, 4, 7, 9. `db.liveFeed` fields match the model in Task 3. Element field names (`liveFeed*`) match across Tasks 6, 7, 8.
