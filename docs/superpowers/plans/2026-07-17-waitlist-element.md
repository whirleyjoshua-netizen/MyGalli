# Wait List element (MVP) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a free `waitlist` element that collects email signups before a launch, with a live count, countdown, capacity/auto-close, and an owner CSV export.

**Architecture:** A data-collection element in the existing family (Form/Booking/RSVP): a new `WaitlistSignup` table, a rate-limited public `POST /api/waitlist/join`, a public count endpoint, a public element with Hero/Progress styles, an editor element, the 7 standard element seams, and an owner view surfaced in the existing Data tab.

**Tech Stack:** Next.js 15 App Router, Prisma/PostgreSQL, TypeScript, React 19, Vitest + Testing Library, Tailwind.

**Spec:** `docs/superpowers/specs/2026-07-17-waitlist-element-design.md`

## Global Constraints

- **Working directory (every command):** `C:\Users\whirl\pages-mvp\.claude\worktrees\waitlist-element`. `cd` there first; confirm `git rev-parse --abbrev-ref HEAD` → `waitlist-element`.
- **DB commands need the URL inline:** a machine-level `DATABASE_URL` overrides `.env`. Prefix with `DATABASE_URL="postgresql://pages:pages@127.0.0.1:5434/pages"` and use `127.0.0.1`, never `localhost`. For Prisma also set `DATABASE_URL_UNPOOLED` to the same value.
- **Never** `prisma migrate dev` (interactive) or `prisma migrate diff --from-url` on the shared dev DB (contaminated → spurious `DROP TABLE`s). Hand-author migration SQL.
- **Tests need JWT_SECRET loaded** (worktrees don't inherit `.env` into vitest). Before running tests: `set -a && . ./.env && set +a` (bash) so `hub-access`-style suites don't fail spuriously.
- **Lint in this nested worktree:** `pnpm exec eslint src --no-eslintrc -c .eslintrc.json --ext .ts,.tsx --resolve-plugins-relative-to .` — plain `next lint` fails here (config cascade). Expect 0 errors.
- **Element is FREE** — no `isPro`/plan gate anywhere.
- **Config field names are fixed** (from the spec): `waitlistTitle`, `waitlistDescription`, `waitlistCoverImage`, `waitlistStyle` (`'hero'|'progress'`), `waitlistButtonLabel`, `waitlistCollectName`, `waitlistLaunchDate`, `waitlistShowCountdown`, `waitlistCapacity`, `waitlistShowCount`, `waitlistConfirmationMessage`.
- **Dedup is by `(displayId, elementId, email)`** — re-submitting an email is idempotent, never a second row.
- **Capacity is server-enforced** — the disabled button is UX; the API is the truth.
- Don't stage `.claude/settings.local.json` in any commit.

---

### Task 1: `WaitlistSignup` schema + migration

**Files:**
- Modify: `prisma/schema.prisma` (add model; add back-relation to `Display`)
- Create: `prisma/migrations/20260717000000_add_waitlist_signup/migration.sql`

**Interfaces:**
- Consumes: nothing.
- Produces: `db.waitlistSignup` Prisma model with fields `id, displayId, elementId, email, name, userId, createdAt`, unique `(displayId, elementId, email)`.

- [ ] **Step 1: Add the model + back-relation**

In `prisma/schema.prisma`, inside `model Display { ... }`, add a back-relation line near the other relation lists (e.g. after `formResponses FormResponse[]` if present, else near `analytics`):

```prisma
  waitlistSignups WaitlistSignup[]
```

Then add the model near the other collection models (e.g. after `FormResponse`):

```prisma
model WaitlistSignup {
  id        String   @id @default(cuid())
  displayId String
  display   Display  @relation(fields: [displayId], references: [id], onDelete: Cascade)
  elementId String
  email     String
  name      String?
  userId    String?
  createdAt DateTime @default(now())

  @@unique([displayId, elementId, email])
  @@index([displayId, elementId])
}
```

- [ ] **Step 2: Hand-author the migration**

Create `prisma/migrations/20260717000000_add_waitlist_signup/migration.sql`:

```sql
-- Wait List element: one signup row per (display, element, email). Additive only.
CREATE TABLE "WaitlistSignup" (
    "id" TEXT NOT NULL,
    "displayId" TEXT NOT NULL,
    "elementId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WaitlistSignup_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WaitlistSignup_displayId_elementId_email_key" ON "WaitlistSignup"("displayId", "elementId", "email");
CREATE INDEX "WaitlistSignup_displayId_elementId_idx" ON "WaitlistSignup"("displayId", "elementId");

ALTER TABLE "WaitlistSignup" ADD CONSTRAINT "WaitlistSignup_displayId_fkey" FOREIGN KEY ("displayId") REFERENCES "Display"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

- [ ] **Step 3: Apply + regenerate**

```bash
cd "C:/Users/whirl/pages-mvp/.claude/worktrees/waitlist-element"
DATABASE_URL="postgresql://pages:pages@127.0.0.1:5434/pages" DATABASE_URL_UNPOOLED="postgresql://pages:pages@127.0.0.1:5434/pages" pnpm exec prisma migrate deploy
DATABASE_URL="postgresql://pages:pages@127.0.0.1:5434/pages" pnpm exec prisma generate
```
Expected: `migrate deploy` applies `20260717000000_add_waitlist_signup`; `generate` succeeds. (If `prisma generate` EPERMs on Windows because a dev server holds the engine DLL, stop the server and retry — non-blocking.)

- [ ] **Step 4: Verify + typecheck**

```bash
docker exec pages-mvp-postgres-1 psql -U pages -d pages -c '\d "WaitlistSignup"' | grep -E "email|elementId|userId"
pnpm exec tsc --noEmit
```
Expected: columns listed; tsc exits 0.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260717000000_add_waitlist_signup/migration.sql
git commit -m "feat(db): add WaitlistSignup model"
```

---

### Task 2: Pure helpers (`src/lib/waitlist.ts`)

**Files:**
- Create: `src/lib/waitlist.ts`
- Test: `src/lib/waitlist.test.ts`

**Interfaces:**
- Produces:
  - `spotsRemaining(count: number, capacity: number | null | undefined): number | null` — null when no capacity; never negative.
  - `isFull(count: number, capacity: number | null | undefined): boolean` — false when no capacity.
  - `progressPercent(count: number, capacity: number | null | undefined): number` — 0–100, clamped; 0 when no capacity.
  - `waitlistCountdownParts(launchDate: string | null | undefined, now: Date): { days: number; hours: number; minutes: number; isPast: boolean } | null` — null when no date.
  - `collectElements(sections: unknown): Array<Record<string, unknown>>` — flattens `sections[].columns[].elements[]`; tolerant of malformed JSON (returns `[]`).

- [ ] **Step 1: Write the failing tests**

Create `src/lib/waitlist.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { spotsRemaining, isFull, progressPercent, waitlistCountdownParts, collectElements } from './waitlist'

describe('spotsRemaining', () => {
  it('is null with no capacity', () => {
    expect(spotsRemaining(5, null)).toBeNull()
    expect(spotsRemaining(5, undefined)).toBeNull()
  })
  it('is capacity minus count, floored at 0', () => {
    expect(spotsRemaining(3, 10)).toBe(7)
    expect(spotsRemaining(10, 10)).toBe(0)
    expect(spotsRemaining(12, 10)).toBe(0)
  })
})

describe('isFull', () => {
  it('is false with no capacity', () => {
    expect(isFull(999, null)).toBe(false)
  })
  it('is true only at or over capacity', () => {
    expect(isFull(9, 10)).toBe(false)
    expect(isFull(10, 10)).toBe(true)
    expect(isFull(11, 10)).toBe(true)
  })
})

describe('progressPercent', () => {
  it('is 0 with no capacity', () => {
    expect(progressPercent(5, null)).toBe(0)
  })
  it('is a clamped 0-100 integer', () => {
    expect(progressPercent(0, 10)).toBe(0)
    expect(progressPercent(5, 10)).toBe(50)
    expect(progressPercent(10, 10)).toBe(100)
    expect(progressPercent(15, 10)).toBe(100)
  })
})

describe('waitlistCountdownParts', () => {
  const now = new Date('2026-07-17T12:00:00.000Z')
  it('is null with no date', () => {
    expect(waitlistCountdownParts(null, now)).toBeNull()
  })
  it('breaks a future date into days/hours/minutes', () => {
    const r = waitlistCountdownParts('2026-07-20T15:30:00.000Z', now)
    expect(r).toEqual({ days: 3, hours: 3, minutes: 30, isPast: false })
  })
  it('flags a past date', () => {
    const r = waitlistCountdownParts('2026-07-16T12:00:00.000Z', now)
    expect(r?.isPast).toBe(true)
    expect(r?.days).toBe(0)
  })
})

describe('collectElements', () => {
  it('flattens sections -> columns -> elements', () => {
    const sections = [{ columns: [{ elements: [{ id: 'a' }, { id: 'b' }] }, { elements: [{ id: 'c' }] }] }]
    expect(collectElements(sections).map((e) => e.id)).toEqual(['a', 'b', 'c'])
  })
  it('returns [] for malformed input', () => {
    expect(collectElements(null)).toEqual([])
    expect(collectElements('nope')).toEqual([])
    expect(collectElements([{ columns: null }])).toEqual([])
  })
})
```

- [ ] **Step 2: Run to verify failure**

```bash
set -a && . ./.env && set +a
pnpm vitest run src/lib/waitlist.test.ts
```
Expected: FAIL — `Failed to resolve import "./waitlist"`.

- [ ] **Step 3: Implement**

Create `src/lib/waitlist.ts`:

```ts
/** Pure helpers for the Wait List element. No imports, no side effects. */

export function isFull(count: number, capacity: number | null | undefined): boolean {
  if (!capacity || capacity <= 0) return false
  return count >= capacity
}

export function spotsRemaining(count: number, capacity: number | null | undefined): number | null {
  if (!capacity || capacity <= 0) return null
  return Math.max(0, capacity - count)
}

export function progressPercent(count: number, capacity: number | null | undefined): number {
  if (!capacity || capacity <= 0) return 0
  return Math.min(100, Math.max(0, Math.round((count / capacity) * 100)))
}

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

export function waitlistCountdownParts(
  launchDate: string | null | undefined,
  now: Date,
): { days: number; hours: number; minutes: number; isPast: boolean } | null {
  if (!launchDate) return null
  const target = new Date(launchDate).getTime()
  if (Number.isNaN(target)) return null
  const diff = target - now.getTime()
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, isPast: true }
  return {
    days: Math.floor(diff / DAY),
    hours: Math.floor((diff % DAY) / HOUR),
    minutes: Math.floor((diff % HOUR) / MINUTE),
    isPast: false,
  }
}

export function collectElements(sections: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(sections)) return []
  const out: Array<Record<string, unknown>> = []
  for (const section of sections) {
    const columns = (section as { columns?: unknown })?.columns
    if (!Array.isArray(columns)) continue
    for (const column of columns) {
      const elements = (column as { elements?: unknown })?.elements
      if (!Array.isArray(elements)) continue
      for (const el of elements) {
        if (el && typeof el === 'object') out.push(el as Record<string, unknown>)
      }
    }
  }
  return out
}
```

- [ ] **Step 4: Run to verify pass**

```bash
pnpm vitest run src/lib/waitlist.test.ts
```
Expected: PASS — all tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/waitlist.ts src/lib/waitlist.test.ts
git commit -m "feat(waitlist): pure helpers (capacity, progress, countdown, element flatten)"
```

---

### Task 3: Join + count APIs

**Files:**
- Create: `src/app/api/waitlist/join/route.ts`
- Create: `src/app/api/waitlist/[displayId]/[elementId]/count/route.ts`
- Test: `src/app/api/waitlist/join/route.test.ts`

**Interfaces:**
- Consumes: `collectElements` from `@/lib/waitlist`; `isFull` from `@/lib/waitlist`; `db.waitlistSignup`; `rateLimit` from `@/lib/rate-limit`; `getUser` from `@/lib/auth`.
- Produces: `POST /api/waitlist/join` → `{ count }` (201 on new, 200 on duplicate, 409 when full, 400 invalid, 404 unknown element); `GET …/count` → `{ count }`.

- [ ] **Step 1: Write the failing tests**

Create `src/app/api/waitlist/join/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/rate-limit', () => ({ rateLimit: vi.fn().mockResolvedValue(null) }))
vi.mock('@/lib/auth', () => ({ getUser: vi.fn().mockResolvedValue(null) }))
vi.mock('@/lib/db', () => ({
  db: {
    display: { findUnique: vi.fn() },
    waitlistSignup: { count: vi.fn(), create: vi.fn(), findUnique: vi.fn() },
  },
}))

import { getUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { POST } from './route'

const WAITLIST_EL = { id: 'w1', type: 'waitlist', waitlistCapacity: 2 }
const DISPLAY = {
  id: 'd1',
  published: true,
  sections: [{ columns: [{ elements: [WAITLIST_EL] }] }],
}
const req = (body: unknown) =>
  new Request('http://localhost/api/waitlist/join', { method: 'POST', body: JSON.stringify(body) }) as any

beforeEach(() => {
  vi.clearAllMocks()
  ;(db.display.findUnique as any).mockResolvedValue(DISPLAY)
  ;(db.waitlistSignup.findUnique as any).mockResolvedValue(null)
  ;(db.waitlistSignup.count as any).mockResolvedValue(0)
  ;(db.waitlistSignup.create as any).mockResolvedValue({ id: 's1' })
})

describe('POST /api/waitlist/join', () => {
  it('creates a signup and returns the new count', async () => {
    ;(db.waitlistSignup.count as any).mockResolvedValueOnce(0).mockResolvedValueOnce(1)
    const res = await POST(req({ displayId: 'd1', elementId: 'w1', email: 'a@b.com' }))
    expect(res.status).toBe(201)
    expect((await res.json()).count).toBe(1)
    expect(db.waitlistSignup.create).toHaveBeenCalled()
  })

  it('is idempotent for a duplicate email (no second row, 200)', async () => {
    ;(db.waitlistSignup.findUnique as any).mockResolvedValue({ id: 'existing' })
    ;(db.waitlistSignup.count as any).mockResolvedValue(1)
    const res = await POST(req({ displayId: 'd1', elementId: 'w1', email: 'a@b.com' }))
    expect(res.status).toBe(200)
    expect(db.waitlistSignup.create).not.toHaveBeenCalled()
    expect((await res.json()).count).toBe(1)
  })

  it('rejects with 409 when the list is full', async () => {
    ;(db.waitlistSignup.count as any).mockResolvedValue(2) // capacity is 2
    const res = await POST(req({ displayId: 'd1', elementId: 'w1', email: 'new@b.com' }))
    expect(res.status).toBe(409)
    expect(db.waitlistSignup.create).not.toHaveBeenCalled()
  })

  it('captures userId when the visitor is logged in', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'u1' })
    ;(db.waitlistSignup.count as any).mockResolvedValueOnce(0).mockResolvedValueOnce(1)
    await POST(req({ displayId: 'd1', elementId: 'w1', email: 'a@b.com' }))
    expect((db.waitlistSignup.create as any).mock.calls[0][0].data.userId).toBe('u1')
  })

  it('400s on an invalid email', async () => {
    const res = await POST(req({ displayId: 'd1', elementId: 'w1', email: 'notanemail' }))
    expect(res.status).toBe(400)
  })

  it('404s when the element is not a waitlist on the display', async () => {
    const res = await POST(req({ displayId: 'd1', elementId: 'nope', email: 'a@b.com' }))
    expect(res.status).toBe(404)
  })

  it('403s when the display is unpublished', async () => {
    ;(db.display.findUnique as any).mockResolvedValue({ ...DISPLAY, published: false })
    const res = await POST(req({ displayId: 'd1', elementId: 'w1', email: 'a@b.com' }))
    expect(res.status).toBe(403)
  })
})
```

- [ ] **Step 2: Run to verify failure**

```bash
pnpm vitest run "src/app/api/waitlist/join/route.test.ts"
```
Expected: FAIL — cannot import `./route`.

- [ ] **Step 3: Implement the join route**

Create `src/app/api/waitlist/join/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'
import { rateLimit } from '@/lib/rate-limit'
import { collectElements, isFull } from '@/lib/waitlist'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(request: NextRequest) {
  const limited = await rateLimit(request, { limit: 20, windowMs: 60_000, prefix: 'waitlist-join' })
  if (limited) return limited

  const body = await request.json().catch(() => ({}))
  const displayId = typeof body.displayId === 'string' ? body.displayId : ''
  const elementId = typeof body.elementId === 'string' ? body.elementId : ''
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  const name = typeof body.name === 'string' && body.name.trim() ? body.name.trim().slice(0, 200) : null

  if (!displayId || !elementId) return NextResponse.json({ error: 'Missing display or element' }, { status: 400 })
  if (!EMAIL_RE.test(email)) return NextResponse.json({ error: 'Invalid email' }, { status: 400 })

  const display = await db.display.findUnique({
    where: { id: displayId },
    select: { id: true, published: true, sections: true },
  })
  if (!display) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!display.published) return NextResponse.json({ error: 'Not published' }, { status: 403 })

  const el = collectElements(display.sections).find((e) => e.id === elementId)
  if (!el || el.type !== 'waitlist') return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const capacity = typeof el.waitlistCapacity === 'number' ? el.waitlistCapacity : null

  // Idempotent: an email already on this list returns the current count, no new row.
  const existing = await db.waitlistSignup.findUnique({
    where: { displayId_elementId_email: { displayId, elementId, email } },
  })
  if (existing) {
    const count = await db.waitlistSignup.count({ where: { displayId, elementId } })
    return NextResponse.json({ count }, { status: 200 })
  }

  // Capacity is enforced here — the client's disabled button is only UX.
  const current = await db.waitlistSignup.count({ where: { displayId, elementId } })
  if (isFull(current, capacity)) {
    return NextResponse.json({ error: 'Wait list full' }, { status: 409 })
  }

  const user = await getUser(request)
  await db.waitlistSignup.create({
    data: { displayId, elementId, email, name, userId: user?.id ?? null },
  })
  const count = await db.waitlistSignup.count({ where: { displayId, elementId } })
  return NextResponse.json({ count }, { status: 201 })
}
```

Note: the unique-constraint compound key accessor Prisma generates is
`displayId_elementId_email` (from `@@unique([displayId, elementId, email])`).

- [ ] **Step 4: Implement the count route**

Create `src/app/api/waitlist/[displayId]/[elementId]/count/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ displayId: string; elementId: string }> },
) {
  const { displayId, elementId } = await params
  const count = await db.waitlistSignup.count({ where: { displayId, elementId } })
  return NextResponse.json({ count })
}
```

- [ ] **Step 5: Run to verify pass**

```bash
pnpm vitest run "src/app/api/waitlist/join/route.test.ts" && pnpm exec tsc --noEmit
```
Expected: 7 tests PASS; tsc clean.

- [ ] **Step 6: Commit**

```bash
git add "src/app/api/waitlist"
git commit -m "feat(waitlist): join API (dedup + server-enforced capacity) + public count"
```

---

### Task 4: Element type, config fields, and default

**Files:**
- Modify: `src/lib/types/canvas.ts` (ElementType union; CanvasElement fields; `createElement` default)
- Test: `src/lib/types/canvas.waitlist.test.ts` (create)

**Interfaces:**
- Consumes: nothing.
- Produces: `ElementType` includes `'waitlist'`; `createElement('waitlist')` returns an element with all `waitlist*` defaults.

- [ ] **Step 1: Write the failing test**

Create `src/lib/types/canvas.waitlist.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { createElement } from './canvas'

describe("createElement('waitlist')", () => {
  it('returns sane defaults', () => {
    const el = createElement('waitlist') as any
    expect(el.type).toBe('waitlist')
    expect(el.waitlistStyle).toBe('hero')
    expect(el.waitlistButtonLabel).toBe('Join Wait List')
    expect(el.waitlistShowCount).toBe(true)
    expect(el.waitlistShowCountdown).toBe(true)
    expect(el.waitlistCollectName).toBe(false)
    expect(el.waitlistConfirmationMessage).toContain("on the list")
    expect(el.waitlistCapacity ?? null).toBeNull()
    expect(el.id).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run to verify failure**

```bash
pnpm vitest run src/lib/types/canvas.waitlist.test.ts
```
Expected: FAIL — `createElement('waitlist')` hits the default branch and lacks `waitlistStyle`.

- [ ] **Step 3: Add to the ElementType union**

In `src/lib/types/canvas.ts`, in the `export type ElementType =` union, add near the Commerce-ish/engagement elements (after `'product-list'` if present, else anywhere in the union):

```ts
  | 'waitlist'     // Pre-launch signup collector
```

- [ ] **Step 4: Add config fields to `CanvasElement`**

In the `export interface CanvasElement { ... }`, add (near the other element field groups, e.g. after the `rsvp*` block):

```ts
  // Wait List element
  waitlistTitle?: string
  waitlistDescription?: string
  waitlistCoverImage?: string | null
  waitlistStyle?: 'hero' | 'progress'
  waitlistButtonLabel?: string
  waitlistCollectName?: boolean
  waitlistLaunchDate?: string | null   // ISO; powers countdown + "Opens ..." text
  waitlistShowCountdown?: boolean
  waitlistCapacity?: number | null      // when set: progress bar + auto-close
  waitlistShowCount?: boolean
  waitlistConfirmationMessage?: string
```

- [ ] **Step 5: Add the `createElement` default**

In `createElement`, add a case alongside the others (e.g. after `case 'rsvp':`):

```ts
    case 'waitlist':
      return {
        ...base,
        waitlistTitle: 'Join the Wait List',
        waitlistDescription: '',
        waitlistCoverImage: null,
        waitlistStyle: 'hero',
        waitlistButtonLabel: 'Join Wait List',
        waitlistCollectName: false,
        waitlistLaunchDate: null,
        waitlistShowCountdown: true,
        waitlistCapacity: null,
        waitlistShowCount: true,
        waitlistConfirmationMessage: "You're on the list! 🎉",
      }
```

- [ ] **Step 6: Run to verify pass + typecheck**

```bash
pnpm vitest run src/lib/types/canvas.waitlist.test.ts && pnpm exec tsc --noEmit
```
Expected: PASS; tsc clean.

- [ ] **Step 7: Commit**

```bash
git add src/lib/types/canvas.ts src/lib/types/canvas.waitlist.test.ts
git commit -m "feat(waitlist): element type, config fields, createElement default"
```

---

### Task 5: Public element component

**Files:**
- Create: `src/components/elements/PublicWaitlistElement.tsx`
- Test: `src/components/elements/PublicWaitlistElement.test.tsx`

**Interfaces:**
- Consumes: `CanvasElement` type; `spotsRemaining`, `isFull`, `progressPercent`, `waitlistCountdownParts` from `@/lib/waitlist`. Props: `{ element: CanvasElement; displayId: string }`.
- Produces: `<PublicWaitlistElement element displayId />` for the render seams (Task 7).

- [ ] **Step 1: Write the failing tests**

Create `src/components/elements/PublicWaitlistElement.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { PublicWaitlistElement } from './PublicWaitlistElement'

const base = {
  id: 'w1', type: 'waitlist', waitlistTitle: 'Creator Academy',
  waitlistButtonLabel: 'Join Wait List', waitlistShowCount: true,
  waitlistConfirmationMessage: "You're on the list! 🎉", waitlistStyle: 'hero',
} as any

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async (url: string, opts?: any) => {
    if (String(url).includes('/count')) return { ok: true, json: async () => ({ count: 41 }) } as any
    return { ok: true, status: 201, json: async () => ({ count: 42 }) } as any // join
  }))
})
afterEach(() => vi.unstubAllGlobals())

describe('PublicWaitlistElement', () => {
  it('renders the title and the live count', async () => {
    render(<PublicWaitlistElement element={base} displayId="d1" />)
    expect(screen.getByText('Creator Academy')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText(/41/)).toBeInTheDocument())
  })

  it('shows the confirmation after a successful join', async () => {
    render(<PublicWaitlistElement element={base} displayId="d1" />)
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'a@b.com' } })
    fireEvent.click(screen.getByRole('button', { name: /join wait list/i }))
    await waitFor(() => expect(screen.getByText(/on the list/i)).toBeInTheDocument())
    expect(screen.queryByRole('button', { name: /join wait list/i })).not.toBeInTheDocument()
  })

  it('renders the progress bar and disables joining when full', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ count: 100 }) })) as any)
    render(<PublicWaitlistElement element={{ ...base, waitlistStyle: 'progress', waitlistCapacity: 100 }} displayId="d1" />)
    await waitFor(() => expect(screen.getByText(/100 \/ 100/)).toBeInTheDocument())
    expect(screen.getByRole('button', { name: /full/i })).toBeDisabled()
  })
})
```

- [ ] **Step 2: Run to verify failure**

```bash
pnpm vitest run src/components/elements/PublicWaitlistElement.test.tsx
```
Expected: FAIL — cannot import the component.

- [ ] **Step 3: Implement the component**

Create `src/components/elements/PublicWaitlistElement.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'
import type { CanvasElement } from '@/lib/types/canvas'
import { isFull, progressPercent, spotsRemaining, waitlistCountdownParts } from '@/lib/waitlist'

export function PublicWaitlistElement({ element, displayId }: { element: CanvasElement; displayId: string }) {
  const capacity = element.waitlistCapacity ?? null
  const [count, setCount] = useState(0)
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [joined, setJoined] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    fetch(`/api/waitlist/${displayId}/${element.id}/count`)
      .then((r) => (r.ok ? r.json() : { count: 0 }))
      .then((d) => { if (alive) setCount(d.count ?? 0) })
      .catch(() => {})
    return () => { alive = false }
  }, [displayId, element.id])

  const full = isFull(count, capacity)
  const parts = element.waitlistShowCountdown ? waitlistCountdownParts(element.waitlistLaunchDate, new Date()) : null

  async function join(e: React.FormEvent) {
    e.preventDefault()
    if (busy || full) return
    setBusy(true); setError(null)
    try {
      const res = await fetch('/api/waitlist/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayId, elementId: element.id, email, name: name || undefined }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        if (typeof data.count === 'number') setCount(data.count)
        setJoined(true)
      } else {
        setError(data.error || 'Something went wrong')
        if (typeof data.count === 'number') setCount(data.count)
      }
    } catch {
      setError('Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  const remaining = spotsRemaining(count, capacity)

  return (
    <div className="rounded-2xl border border-border bg-surface overflow-hidden shadow-soft">
      {element.waitlistStyle === 'hero' && element.waitlistCoverImage && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={element.waitlistCoverImage} alt="" className="w-full h-40 object-cover" />
      )}
      <div className="p-5 space-y-3">
        {element.waitlistTitle && <h3 className="text-xl font-extrabold tracking-tight">{element.waitlistTitle}</h3>}
        {element.waitlistDescription && <p className="text-sm text-muted-foreground">{element.waitlistDescription}</p>}

        {parts && (
          <p className="text-sm font-semibold text-galli-dark">
            {parts.isPast ? 'Launching now' : `Opens in ${parts.days}d ${parts.hours}h ${parts.minutes}m`}
          </p>
        )}

        {capacity != null && (
          <div className="space-y-1">
            <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
              <div className="h-full bg-galli" style={{ width: `${progressPercent(count, capacity)}%` }} />
            </div>
            <p className="text-xs font-medium text-muted-foreground">{count} / {capacity} spots reserved</p>
          </div>
        )}

        {element.waitlistShowCount && capacity == null && (
          <p className="text-sm font-semibold">{count.toLocaleString()} {count === 1 ? 'person is' : 'people are'} already waiting.</p>
        )}

        {joined ? (
          <p className="rounded-xl bg-galli/10 px-4 py-3 text-sm font-semibold text-galli-dark">
            {element.waitlistConfirmationMessage || "You're on the list! 🎉"}
          </p>
        ) : (
          <form onSubmit={join} className="space-y-2">
            {element.waitlistCollectName && (
              <input
                aria-label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none"
              />
            )}
            <input
              aria-label="Email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none"
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
            <button
              type="submit" disabled={busy || full}
              className="w-full rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-soft transition hover:brightness-105 disabled:opacity-50"
            >
              {full ? 'Wait list full' : busy ? 'Joining…' : (element.waitlistButtonLabel || 'Join Wait List')}
            </button>
            {remaining != null && !full && (
              <p className="text-center text-xs text-muted-foreground">{remaining} spots left</p>
            )}
          </form>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run to verify pass**

```bash
pnpm vitest run src/components/elements/PublicWaitlistElement.test.tsx && pnpm exec tsc --noEmit
```
Expected: 3 tests PASS; tsc clean.

- [ ] **Step 5: Commit**

```bash
git add src/components/elements/PublicWaitlistElement.tsx src/components/elements/PublicWaitlistElement.test.tsx
git commit -m "feat(waitlist): public element (hero/progress, countdown, join, confirmation)"
```

---

### Task 6: Editor element component

**Files:**
- Create: `src/components/elements/WaitlistElement.tsx`
- Test: `src/components/elements/WaitlistElement.test.tsx`

**Interfaces:**
- Consumes: `CanvasElement`. Props (the standard editor element contract): `{ element: CanvasElement; onChange: (updates: Partial<CanvasElement>) => void; onDelete: () => void; isSelected: boolean; onSelect: () => void }`.
- Produces: `<WaitlistElement ... />` for the render seams (Task 7).

- [ ] **Step 1: Write the failing test**

Create `src/components/elements/WaitlistElement.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { WaitlistElement } from './WaitlistElement'

const el = { id: 'w1', type: 'waitlist', waitlistTitle: 'Join the Wait List', waitlistStyle: 'hero', waitlistButtonLabel: 'Join Wait List' } as any

describe('WaitlistElement (editor)', () => {
  it('edits the title through onChange', () => {
    const onChange = vi.fn()
    render(<WaitlistElement element={el} onChange={onChange} onDelete={vi.fn()} isSelected onSelect={vi.fn()} />)
    fireEvent.change(screen.getByLabelText(/title/i), { target: { value: 'Beta Access' } })
    expect(onChange).toHaveBeenCalledWith({ waitlistTitle: 'Beta Access' })
  })

  it('switches style through onChange', () => {
    const onChange = vi.fn()
    render(<WaitlistElement element={el} onChange={onChange} onDelete={vi.fn()} isSelected onSelect={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /progress/i }))
    expect(onChange).toHaveBeenCalledWith({ waitlistStyle: 'progress' })
  })
})
```

- [ ] **Step 2: Run to verify failure**

```bash
pnpm vitest run src/components/elements/WaitlistElement.test.tsx
```
Expected: FAIL — cannot import the component.

- [ ] **Step 3: Implement the component**

Create `src/components/elements/WaitlistElement.tsx`:

```tsx
'use client'

import type { CanvasElement } from '@/lib/types/canvas'

type Props = {
  element: CanvasElement
  onChange: (updates: Partial<CanvasElement>) => void
  onDelete: () => void
  isSelected: boolean
  onSelect: () => void
}

const field = 'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none'
const label = 'block text-xs font-semibold text-muted-foreground mb-1'

export function WaitlistElement({ element, onChange, onSelect, isSelected }: Props) {
  const style = element.waitlistStyle ?? 'hero'
  return (
    <div
      onClick={onSelect}
      className={`rounded-2xl border bg-surface p-4 space-y-3 ${isSelected ? 'border-primary' : 'border-border'}`}
    >
      <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Wait List</p>

      <div>
        <label className={label} htmlFor="wl-title">Title</label>
        <input id="wl-title" className={field} value={element.waitlistTitle ?? ''} onChange={(e) => onChange({ waitlistTitle: e.target.value })} />
      </div>

      <div>
        <label className={label} htmlFor="wl-desc">Description</label>
        <textarea id="wl-desc" className={field} rows={2} value={element.waitlistDescription ?? ''} onChange={(e) => onChange({ waitlistDescription: e.target.value })} />
      </div>

      <div>
        <span className={label}>Style</span>
        <div className="flex gap-2">
          {(['hero', 'progress'] as const).map((s) => (
            <button
              key={s} type="button" onClick={() => onChange({ waitlistStyle: s })}
              className={`rounded-lg px-3 py-1.5 text-sm capitalize ${style === s ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={label} htmlFor="wl-btn">Button label</label>
          <input id="wl-btn" className={field} value={element.waitlistButtonLabel ?? ''} onChange={(e) => onChange({ waitlistButtonLabel: e.target.value })} />
        </div>
        <div>
          <label className={label} htmlFor="wl-cap">Capacity (optional)</label>
          <input
            id="wl-cap" type="number" min={0} className={field}
            value={element.waitlistCapacity ?? ''}
            onChange={(e) => onChange({ waitlistCapacity: e.target.value === '' ? null : Number(e.target.value) })}
          />
        </div>
      </div>

      <div>
        <label className={label} htmlFor="wl-date">Launch date (optional)</label>
        <input
          id="wl-date" type="datetime-local" className={field}
          value={element.waitlistLaunchDate ? element.waitlistLaunchDate.slice(0, 16) : ''}
          onChange={(e) => onChange({ waitlistLaunchDate: e.target.value ? new Date(e.target.value).toISOString() : null })}
        />
      </div>

      <div className="flex flex-wrap gap-4 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={element.waitlistCollectName ?? false} onChange={(e) => onChange({ waitlistCollectName: e.target.checked })} />
          Collect name
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={element.waitlistShowCount ?? true} onChange={(e) => onChange({ waitlistShowCount: e.target.checked })} />
          Show count
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={element.waitlistShowCountdown ?? true} onChange={(e) => onChange({ waitlistShowCountdown: e.target.checked })} />
          Show countdown
        </label>
      </div>

      <div>
        <label className={label} htmlFor="wl-confirm">Confirmation message</label>
        <input id="wl-confirm" className={field} value={element.waitlistConfirmationMessage ?? ''} onChange={(e) => onChange({ waitlistConfirmationMessage: e.target.value })} />
      </div>
    </div>
  )
}
```

Note: cover-image upload is intentionally omitted from the editor MVP (a cover can be
set once we wire the shared `ImageUploadField`; the public component already renders
`waitlistCoverImage` when present). This keeps the editor task focused; add upload in a
fast follow if desired. Flag this in the task report so the reviewer sees it is deliberate.

- [ ] **Step 4: Run to verify pass**

```bash
pnpm vitest run src/components/elements/WaitlistElement.test.tsx && pnpm exec tsc --noEmit
```
Expected: 2 tests PASS; tsc clean.

- [ ] **Step 5: Commit**

```bash
git add src/components/elements/WaitlistElement.tsx src/components/elements/WaitlistElement.test.tsx
git commit -m "feat(waitlist): editor element (config fields)"
```

---

### Task 7: Wire the element seams

**Files:**
- Modify: `src/components/elements/index.ts`
- Modify: `src/components/canvas/SlashCommandMenu.tsx`
- Modify: `src/components/canvas/ColumnCanvas.tsx`
- Modify: `src/lib/render-elements.tsx`

**Interfaces:**
- Consumes: `WaitlistElement`, `PublicWaitlistElement` (Tasks 5-6); the `'waitlist'` type + default (Task 4).
- Produces: the element is insertable from the slash menu and renders in editor + public + share/hub.

- [ ] **Step 1: Export from the element barrel**

In `src/components/elements/index.ts`, add:

```ts
export { WaitlistElement } from './WaitlistElement'
export { PublicWaitlistElement } from './PublicWaitlistElement'
```

- [ ] **Step 2: Add the slash-menu entry**

In `src/components/canvas/SlashCommandMenu.tsx`: import an icon (add `Rocket` to the existing `lucide-react` import), then add to the commands array next to `product-list`:

```ts
  { id: 'waitlist', label: 'Wait List', icon: Rocket, description: 'Collect signups before a launch, with a live count', category: 'Commerce' },
```

- [ ] **Step 3: Add the editor/public render case in ColumnCanvas**

In `src/components/canvas/ColumnCanvas.tsx`, add imports next to the product-list imports:

```ts
import { WaitlistElement } from '@/components/elements/WaitlistElement'
import { PublicWaitlistElement } from '@/components/elements/PublicWaitlistElement'
```

Add a case in `renderElement`, mirroring the **data-collecting** elements (`rsvp`,
`poll`) — `displayId` is already a prop of `ColumnCanvas` and in scope here:

```tsx
      case 'waitlist':
        if (isPreviewMode && displayId) {
          return <PublicWaitlistElement element={element} displayId={displayId} />
        }
        return (
          <WaitlistElement
            element={element}
            onChange={(updates) => onUpdateElement(sectionId, columnId, element.id, updates)}
            onDelete={() => onDeleteElement(sectionId, columnId, element.id)}
            isSelected={commonProps.isSelected}
            onSelect={commonProps.onSelect}
          />
        )
```

(In preview without a `displayId`, this falls to the editor component — the same
behaviour the existing `rsvp`/`poll` cases have.)

- [ ] **Step 4: Add the public render case**

In `src/lib/render-elements.tsx`, add the import near the other public imports:

```ts
import { PublicWaitlistElement } from '@/components/elements/PublicWaitlistElement'
```

Add the case (mirror `mcq`/`rsvp`, which pass `displayId`):

```tsx
    case 'waitlist':
      return <PublicWaitlistElement element={element} displayId={displayId || ''} />
```

- [ ] **Step 5: Verify integration**

```bash
pnpm exec tsc --noEmit
pnpm vitest run src/components/elements/PublicWaitlistElement.test.tsx src/lib/types/canvas.waitlist.test.ts
pnpm exec eslint src --no-eslintrc -c .eslintrc.json --ext .ts,.tsx --resolve-plugins-relative-to .
```
Expected: tsc clean; tests pass; eslint 0 errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/elements/index.ts src/components/canvas/SlashCommandMenu.tsx src/components/canvas/ColumnCanvas.tsx src/lib/render-elements.tsx
git commit -m "feat(waitlist): wire element seams (slash menu, canvas, render)"
```

---

### Task 8: Owner view (Data tab card + CSV)

**Files:**
- Modify: `src/app/api/analytics/[displayId]/elements/route.ts` (include waitlist signups)
- Create: `src/components/analytics/element-cards/WaitlistCard.tsx`
- Modify: `src/components/analytics/element-cards/index.ts` (export)
- Modify: `src/components/analytics/ElementsTab.tsx` (dispatch `case 'waitlist'`)
- Test: `src/app/api/analytics/[displayId]/elements/waitlist.test.ts` (create)

**Interfaces:**
- Consumes: `db.waitlistSignup`; `collectElements` from `@/lib/waitlist`; the owner-gate already in the analytics route.
- Produces: an element entry `{ elementId, type: 'waitlist', title, count, capacity, signups: Array<{ email; name: string | null; joinedAt: string }> }`; a `WaitlistCard` rendering it with a client-side CSV download.

- [ ] **Step 1: Write the failing test**

Create `src/app/api/analytics/[displayId]/elements/waitlist.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({ getUser: vi.fn() }))
vi.mock('@/lib/db', () => ({
  db: {
    display: { findUnique: vi.fn() },
    formResponse: { findMany: vi.fn().mockResolvedValue([]) },
    comment: { findMany: vi.fn().mockResolvedValue([]) },
    waitlistSignup: { findMany: vi.fn() },
  },
}))

import { getUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { GET } from './route'

const WAITLIST_EL = { id: 'w1', type: 'waitlist', waitlistTitle: 'Beta', waitlistCapacity: 500 }
const ctx = { params: Promise.resolve({ displayId: 'd1' }) }
const req = () => new Request('http://localhost/api/analytics/d1/elements') as any

beforeEach(() => {
  vi.clearAllMocks()
  ;(db.display.findUnique as any).mockResolvedValue({
    id: 'd1', userId: 'owner',
    sections: [{ columns: [{ elements: [WAITLIST_EL] }] }],
    tabs: null,
  })
  ;(db.waitlistSignup.findMany as any).mockResolvedValue([
    { elementId: 'w1', email: 'a@b.com', name: 'A', createdAt: new Date('2026-01-01T00:00:00Z') },
    { elementId: 'w1', email: 'c@d.com', name: null, createdAt: new Date('2026-01-02T00:00:00Z') },
  ])
})

describe('GET analytics elements — waitlist', () => {
  it('returns the waitlist with its signups for the owner', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'owner' })
    const res = await GET(req(), ctx)
    const body = await res.json()
    const wl = body.elements.find((e: any) => e.type === 'waitlist')
    expect(wl).toBeTruthy()
    expect(wl.count).toBe(2)
    expect(wl.capacity).toBe(500)
    expect(wl.signups.map((s: any) => s.email)).toEqual(['a@b.com', 'c@d.com'])
  })

  it('403s a non-owner (no signups leak)', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'someone-else' })
    const res = await GET(req(), ctx)
    expect(res.status).toBe(403)
  })
})
```

- [ ] **Step 2: Run to verify failure**

```bash
pnpm vitest run "src/app/api/analytics/[displayId]/elements/waitlist.test.ts"
```
Expected: FAIL — no waitlist entry in the response.

- [ ] **Step 3: Extend the analytics route**

In `src/app/api/analytics/[displayId]/elements/route.ts`:

Add the import at the top:

```ts
import { collectElements } from '@/lib/waitlist'
```

The route already parses `mainSections` (from `display.sections`) and `tabsConfig`
(from `display.tabs`) — both are in scope. `waitlist` is **not** in
`INTERACTIVE_TYPES`, so `extractInteractiveElements` correctly ignores it; gather
waitlist elements separately with the `collectElements` helper (which reads the raw
element, where `el.waitlistTitle`/`el.waitlistCapacity` live directly). Insert this
just **before** the `return NextResponse.json({ ... })` at the end of the `try`:

```ts
    // Wait List signups (owner-only; the ownership check above already gated this route)
    const waitlistEls = [
      ...collectElements(mainSections),
      ...((tabsConfig?.tabs || []).flatMap((t) => collectElements(t.sections))),
    ].filter((e) => e.type === 'waitlist')

    let waitlistCards: Array<Record<string, unknown>> = []
    if (waitlistEls.length) {
      const signups = await db.waitlistSignup.findMany({
        where: { displayId, elementId: { in: waitlistEls.map((e) => String(e.id)) } },
        orderBy: { createdAt: 'asc' },
        select: { elementId: true, email: true, name: true, createdAt: true },
      })
      waitlistCards = waitlistEls.map((el) => {
        const rows = signups.filter((s) => s.elementId === el.id)
        return {
          elementId: String(el.id),
          type: 'waitlist',
          title: (el.waitlistTitle as string) || 'Wait List',
          capacity: typeof el.waitlistCapacity === 'number' ? el.waitlistCapacity : null,
          count: rows.length,
          signups: rows.map((r) => ({ email: r.email, name: r.name, joinedAt: r.createdAt.toISOString() })),
        }
      })
    }
```

Then change the existing return from:

```ts
    return NextResponse.json({
      display: { id: display.id, title: display.title },
      elements,
    })
```

to:

```ts
    return NextResponse.json({
      display: { id: display.id, title: display.title },
      elements: [...elements, ...waitlistCards],
    })
```

Do not change the interactive-element (`elements`) logic — only append.

- [ ] **Step 4: Create the card**

Create `src/components/analytics/element-cards/WaitlistCard.tsx`:

```tsx
'use client'

import { Rocket, Download } from 'lucide-react'

interface WaitlistData {
  elementId: string
  type: 'waitlist'
  title: string
  capacity: number | null
  count: number
  signups: { email: string; name: string | null; joinedAt: string }[]
}

function toCsv(rows: WaitlistData['signups']): string {
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`
  const header = 'email,name,joinedAt'
  const body = rows.map((r) => [esc(r.email), esc(r.name ?? ''), esc(r.joinedAt)].join(',')).join('\n')
  return `${header}\n${body}`
}

export function WaitlistCard({ data }: { data: WaitlistData }) {
  function download() {
    const blob = new Blob([toCsv(data.signups)], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `waitlist-${data.elementId}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-4 shadow-soft">
      <div className="flex items-center justify-between mb-3">
        <h3 className="flex items-center gap-2 font-bold"><Rocket className="w-4 h-4 text-primary" /> {data.title}</h3>
        <button onClick={download} disabled={!data.signups.length} className="flex items-center gap-1.5 rounded-lg bg-muted px-3 py-1.5 text-sm font-medium disabled:opacity-50">
          <Download className="w-4 h-4" /> Download CSV
        </button>
      </div>
      <p className="text-sm text-muted-foreground mb-3">
        {data.count.toLocaleString()} {data.count === 1 ? 'signup' : 'signups'}{data.capacity != null ? ` of ${data.capacity}` : ''}
      </p>
      <div className="max-h-64 overflow-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
            <tr><th className="px-3 py-2">Email</th><th className="px-3 py-2">Name</th><th className="px-3 py-2">Joined</th></tr>
          </thead>
          <tbody>
            {data.signups.map((s, i) => (
              <tr key={i} className="border-t border-border">
                <td className="px-3 py-2">{s.email}</td>
                <td className="px-3 py-2">{s.name ?? '—'}</td>
                <td className="px-3 py-2">{new Date(s.joinedAt).toLocaleDateString()}</td>
              </tr>
            ))}
            {!data.signups.length && <tr><td colSpan={3} className="px-3 py-6 text-center text-muted-foreground">No signups yet</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Register + dispatch the card**

In `src/components/analytics/element-cards/index.ts`, add:

```ts
export { WaitlistCard } from './WaitlistCard'
```

In `src/components/analytics/ElementsTab.tsx`: add `WaitlistCard` to the import from `./element-cards`, and add a case in the `switch (element.type)`:

```tsx
          case 'waitlist':
            return <WaitlistCard key={element.elementId} data={element} />
```

- [ ] **Step 6: Run to verify pass**

```bash
pnpm vitest run "src/app/api/analytics/[displayId]/elements/waitlist.test.ts" && pnpm exec tsc --noEmit
```
Expected: 2 tests PASS; tsc clean.

- [ ] **Step 7: Commit**

```bash
git add "src/app/api/analytics/[displayId]/elements/route.ts" src/components/analytics/element-cards/WaitlistCard.tsx src/components/analytics/element-cards/index.ts src/components/analytics/ElementsTab.tsx "src/app/api/analytics/[displayId]/elements/waitlist.test.ts"
git commit -m "feat(waitlist): owner Data-tab card with signups + CSV export"
```

---

### Task 9: Full verification + browser smoke

**Files:** none (verification only).

- [ ] **Step 1: Gate on the full suite + types + lint**

```bash
cd "C:/Users/whirl/pages-mvp/.claude/worktrees/waitlist-element"
set -a && . ./.env && set +a
pnpm exec tsc --noEmit
pnpm test
pnpm exec eslint src --no-eslintrc -c .eslintrc.json --ext .ts,.tsx --resolve-plugins-relative-to .
```
Expected: tsc clean; suite green (baseline + the new waitlist tests; report observed totals); eslint 0 errors. Note: the baseline suite total here is whatever `main` (`dda8508`) was — report the observed number, do not assume.

- [ ] **Step 2: Browser / end-to-end smoke**

Prefer the API-driven smoke pattern (the repo's convention — verify persistence via API/DB, not UI timing). Start the dev server on a FREE port (3000/3010/3020 were used earlier; pick a free one), then drive:

1. Create a published page with a waitlist element (via the editor or a seed script).
2. `POST /api/waitlist/join` with an email → 201, count increments.
3. Same email again → 200, count unchanged, no second row (verify via `db.waitlistSignup.count`).
4. Set capacity low, fill it → next join returns 409.
5. Load the public page → the element renders (Hero and Progress); the count shows.
6. As the owner, open the Data tab → the WaitlistCard shows the signups; CSV downloads.

Verify persistence via the count endpoint or a direct `psql`/Prisma query, never by UI timing (dev first-compile runs 20-110s). Confirm which checkout owns any port before using it (a concurrent session may hold 3000/3100/3200).

- [ ] **Step 3: Update the SDD ledger + memory**

Record the outcome in `.superpowers/sdd/progress.md` and the `[[community-hub]]`-style element memory (a new memory for the waitlist element).

---

## Ship

The MVP is one shippable unit. After Task 9: final whole-branch review, then `superpowers:finishing-a-development-branch`. Deferred phases (Compact style, custom questions, auto-email blast, Waiting Room bubbles, Portal integration) are separate specs.
