# Public "last updated" indicator — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a page owner opt in, per page, to showing visitors when the page was last meaningfully edited.

**Architecture:** A new `Display.contentUpdatedAt` column is stamped by the editor's PATCH route only when an update touches a field a visitor can actually see. A new `Display.showLastUpdated` boolean gates public rendering. The public page formats the timestamp through a pure, dependency-free helper.

**Tech Stack:** Next.js 15 App Router (server components), Prisma/PostgreSQL, TypeScript, Vitest + Testing Library, Tailwind.

**Spec:** `docs/superpowers/specs/2026-07-15-public-last-updated-design.md`

## Global Constraints

- **Never use `Display.updatedAt` for this feature.** It is `@updatedAt`, and the view counter (`src/app/api/analytics/track/route.ts:108`) writes to the row on every page view, so Prisma restamps it. It means "last viewed **or** edited". Using it makes the badge read "just now" on any page with a visitor.
- **Never run `prisma migrate dev`** — it is interactive and fails here. Never run `prisma migrate diff --from-url $DATABASE_URL` against the dev DB; it is contaminated by concurrent branches' tables and emits spurious `DROP TABLE`s. Hand-author migration SQL.
- **Every command needs the DB URL inline.** A machine-level `DATABASE_URL` points at the wrong database and overrides `.env`. Prefix DB commands with `DATABASE_URL="postgresql://pages:pages@127.0.0.1:5434/pages"`. Use `127.0.0.1`, never `localhost`.
- **Lint in this worktree** must use: `pnpm exec eslint src --no-eslintrc -c .eslintrc.json --ext .ts,.tsx --resolve-plugins-relative-to .` — plain `next lint` fails here because the worktree is nested inside the main checkout (`.eslintrc.json` lacks `"root": true`). Expect exit 0 with 31 pre-existing warnings.
- **Baseline is 540 passing tests.** Report observed totals; never assume.
- Working directory for every command: `C:\Users\whirl\pages-mvp\.claude\worktrees\last-updated-indicator`. `cd` there first.
- Do not modify `src/lib/time-ago.ts` or its consumers.

---

### Task 1: Schema + migration

**Files:**
- Modify: `prisma/schema.prisma` (Display model, near `createdAt`/`updatedAt` ~line 44)
- Create: `prisma/migrations/20260715000000_add_last_updated/migration.sql`

**Interfaces:**
- Consumes: nothing.
- Produces: `Display.showLastUpdated: boolean` and `Display.contentUpdatedAt: Date | null` on the Prisma client. Every later task depends on these names.

- [ ] **Step 1: Add the two fields to the Display model**

In `prisma/schema.prisma`, find these lines in `model Display`:

```prisma
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
```

Replace with:

```prisma
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  // Public "last updated" indicator.
  // NOTE: updatedAt is unusable for this — the view counter writes to this row
  // on every page view, so @updatedAt restamps it. contentUpdatedAt is set only
  // by the PATCH route, and only when an edit touches something a visitor sees.
  // Null means "no visible edit observed yet" — the badge stays hidden.
  showLastUpdated  Boolean   @default(false)
  contentUpdatedAt DateTime?
```

- [ ] **Step 2: Hand-author the migration**

Create `prisma/migrations/20260715000000_add_last_updated/migration.sql`:

```sql
-- Public "last updated" indicator (opt-in, per page).
-- Additive only: both columns are safe on a populated table.
-- No backfill: contentUpdatedAt stays NULL for existing rows, so the badge
-- stays hidden until the owner opts in or makes a visible edit. Backfilling
-- from updatedAt would copy view timestamps and publish them as edit dates.
ALTER TABLE "Display" ADD COLUMN "showLastUpdated" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Display" ADD COLUMN "contentUpdatedAt" TIMESTAMP(3);
```

- [ ] **Step 3: Apply the migration and regenerate the client**

Run:

```bash
cd "C:/Users/whirl/pages-mvp/.claude/worktrees/last-updated-indicator"
DATABASE_URL="postgresql://pages:pages@127.0.0.1:5434/pages" \
DATABASE_URL_UNPOOLED="postgresql://pages:pages@127.0.0.1:5434/pages" \
pnpm exec prisma migrate deploy
DATABASE_URL="postgresql://pages:pages@127.0.0.1:5434/pages" pnpm exec prisma generate
```

Expected: `migrate deploy` reports `1 migration found` and applies `20260715000000_add_last_updated`. `generate` reports `Generated Prisma Client`.

If Docker Postgres is not running, start it first: `docker compose up -d`.
If `prisma generate` fails with EPERM on Windows, a dev server is holding the engine DLL — stop it and retry.

- [ ] **Step 4: Verify the columns exist and typecheck**

Run:

```bash
docker exec pages-mvp-postgres-1 psql -U pages -d pages -c '\d "Display"' | grep -E "showLastUpdated|contentUpdatedAt"
pnpm exec tsc --noEmit
```

Expected: both columns listed (`showLastUpdated | boolean | not null default false`, `contentUpdatedAt | timestamp(3) without time zone`), and tsc exits 0.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260715000000_add_last_updated/migration.sql
git commit -m "feat(db): add showLastUpdated + contentUpdatedAt to Display"
```

---

### Task 2: The formatter

**Files:**
- Create: `src/lib/last-updated.ts`
- Test: `src/lib/last-updated.test.ts`

**Interfaces:**
- Consumes: nothing (pure module, no imports).
- Produces:
  - `formatLastUpdated(date: Date, now: Date): string` — the relative label, e.g. `3 days ago`.
  - `absoluteLastUpdated(date: Date): string` — the hover date, e.g. `July 15, 2026`.

  `now` is a required parameter, not `new Date()` inside, so tests are deterministic instead of racing the clock.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/last-updated.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { formatLastUpdated, absoluteLastUpdated } from './last-updated'

const NOW = new Date('2026-07-15T12:00:00.000Z')
const SEC = 1000
const MIN = 60 * SEC
const HOUR = 60 * MIN
const DAY = 24 * HOUR

/** A date `ms` milliseconds before NOW. */
const ago = (ms: number) => new Date(NOW.getTime() - ms)

describe('formatLastUpdated', () => {
  it('says "just now" under a minute', () => {
    expect(formatLastUpdated(ago(0), NOW)).toBe('just now')
    expect(formatLastUpdated(ago(59 * SEC), NOW)).toBe('just now')
  })

  it('reports whole minutes, flooring, singular at 1', () => {
    expect(formatLastUpdated(ago(60 * SEC), NOW)).toBe('1 minute ago')
    expect(formatLastUpdated(ago(90 * SEC), NOW)).toBe('1 minute ago')
    expect(formatLastUpdated(ago(2 * MIN), NOW)).toBe('2 minutes ago')
    expect(formatLastUpdated(ago(59 * MIN), NOW)).toBe('59 minutes ago')
  })

  it('reports whole hours', () => {
    expect(formatLastUpdated(ago(HOUR), NOW)).toBe('1 hour ago')
    expect(formatLastUpdated(ago(23 * HOUR), NOW)).toBe('23 hours ago')
  })

  it('reports whole days', () => {
    expect(formatLastUpdated(ago(DAY), NOW)).toBe('1 day ago')
    expect(formatLastUpdated(ago(6 * DAY), NOW)).toBe('6 days ago')
  })

  it('reports weeks from 7 days', () => {
    expect(formatLastUpdated(ago(7 * DAY), NOW)).toBe('1 week ago')
    expect(formatLastUpdated(ago(29 * DAY), NOW)).toBe('4 weeks ago')
  })

  it('reports months from 30 days', () => {
    expect(formatLastUpdated(ago(30 * DAY), NOW)).toBe('1 month ago')
    expect(formatLastUpdated(ago(364 * DAY), NOW)).toBe('12 months ago')
  })

  it('falls back to an absolute date at a year', () => {
    expect(formatLastUpdated(ago(365 * DAY), NOW)).toBe('Jul 15, 2025')
  })

  // Clock skew between the DB and the server must never render "in 3 hours".
  it('treats a future date as just now', () => {
    expect(formatLastUpdated(new Date(NOW.getTime() + 3 * HOUR), NOW)).toBe('just now')
  })
})

describe('absoluteLastUpdated', () => {
  it('renders a long, unambiguous date', () => {
    expect(absoluteLastUpdated(new Date('2026-07-15T12:00:00.000Z'))).toBe('July 15, 2026')
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test src/lib/last-updated.test.ts`

Expected: FAIL — `Failed to resolve import "./last-updated"`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/last-updated.ts`:

```ts
/**
 * Formatting for the public "last updated" indicator.
 *
 * Deliberately separate from `time-ago.ts`: that one is tuned for bulletin
 * posts, renders compact forms ("3d"), and caps at days — a year-old page would
 * read "412d ago". This module renders prose and graduates to an absolute date.
 *
 * `now` is injected rather than read from the clock so tests are deterministic.
 * All dates are formatted in UTC so output does not vary with server timezone.
 */

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

function plural(count: number, unit: string): string {
  return `${count} ${unit}${count === 1 ? '' : 's'} ago`
}

export function formatLastUpdated(date: Date, now: Date): string {
  const elapsed = now.getTime() - date.getTime()

  // Also catches negative elapsed (clock skew) — never render "in 3 hours".
  if (elapsed < MINUTE) return 'just now'

  const minutes = Math.floor(elapsed / MINUTE)
  if (minutes < 60) return plural(minutes, 'minute')

  const hours = Math.floor(elapsed / HOUR)
  if (hours < 24) return plural(hours, 'hour')

  const days = Math.floor(elapsed / DAY)
  if (days < 7) return plural(days, 'day')
  if (days < 30) return plural(Math.floor(days / 7), 'week')
  if (days < 365) return plural(Math.floor(days / 30), 'month')

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

export function absoluteLastUpdated(date: Date): string {
  return date.toLocaleDateString('en-US', { dateStyle: 'long', timeZone: 'UTC' })
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm test src/lib/last-updated.test.ts`

Expected: PASS — 9 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/last-updated.ts src/lib/last-updated.test.ts
git commit -m "feat(lib): add last-updated formatter"
```

---

### Task 3: Stamp `contentUpdatedAt` in the PATCH route

This is the load-bearing task. Everything else is presentation.

**Files:**
- Modify: `src/lib/collab.ts` (append after `COLLAB_FIELDS`, line 1)
- Modify: `src/app/api/displays/[id]/route.ts` (the allowlist ~line 113, and the update ~line 135)
- Test: `src/app/api/displays/[id]/last-updated.test.ts` (create)

**Interfaces:**
- Consumes: `COLLAB_FIELDS`, `splitUpdate` from `@/lib/collab`; `Display.contentUpdatedAt` / `Display.showLastUpdated` from Task 1.
- Produces: `VISIBLE_FIELDS` exported from `@/lib/collab`.

- [ ] **Step 1: Write the failing tests**

Create `src/app/api/displays/[id]/last-updated.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({ getUser: vi.fn() }))
vi.mock('@/lib/db', () => ({
  db: {
    display: { findUnique: vi.fn(), update: vi.fn() },
    liveFeed: { createMany: vi.fn() },
  },
}))
vi.mock('@/lib/notifications', () => ({ notifyFollowers: vi.fn() }))

import { getUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { PATCH } from './route'

function req(body: unknown) {
  return new Request('http://localhost/api/displays/d1', {
    method: 'PATCH',
    body: JSON.stringify(body),
  }) as any
}
const ctx = { params: Promise.resolve({ id: 'd1' }) }

const page = {
  id: 'd1',
  userId: 'u1',
  kind: 'page',
  version: 1,
  published: true,
  slug: 'portfolio',
  title: 'Portfolio',
  showLastUpdated: false,
  contentUpdatedAt: null as Date | null,
  collaborators: [],
}

/** The `data` object handed to db.display.update by the route. */
function updateData() {
  return (db.display.update as any).mock.calls[0][0].data
}

beforeEach(() => {
  vi.clearAllMocks()
  ;(db.display.update as any).mockResolvedValue({ ...page, sections: [], tabs: null, headerCard: null })
})

describe('PATCH /api/displays/[id] — contentUpdatedAt stamping', () => {
  it('stamps when a visible field (title) changes', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'u1', username: 'josh' })
    ;(db.display.findUnique as any).mockResolvedValue(page)

    await PATCH(req({ title: 'New title' }), ctx)

    expect(updateData().contentUpdatedAt).toBeInstanceOf(Date)
  })

  it('stamps when the canvas changes', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'u1', username: 'josh' })
    ;(db.display.findUnique as any).mockResolvedValue(page)

    await PATCH(req({ sections: [], version: 1 }), ctx)

    expect(updateData().contentUpdatedAt).toBeInstanceOf(Date)
  })

  // Publishing changes nothing a visitor can see on the page itself.
  it('does not stamp on publish alone', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'u1', username: 'josh' })
    ;(db.display.findUnique as any).mockResolvedValue({ ...page, published: false })

    await PATCH(req({ published: true, category: 'art' }), ctx)

    expect(updateData().contentUpdatedAt).toBeUndefined()
  })

  // The whole point of the feature: a view must never look like an edit.
  it('does not stamp when only the toggle changes', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'u1', username: 'josh' })
    ;(db.display.findUnique as any).mockResolvedValue({
      ...page,
      contentUpdatedAt: new Date('2026-01-01T00:00:00.000Z'),
    })

    await PATCH(req({ showLastUpdated: true }), ctx)

    expect(updateData().contentUpdatedAt).toBeUndefined()
  })

  it('bootstraps the date when enabling on a page that has never been stamped', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'u1', username: 'josh' })
    ;(db.display.findUnique as any).mockResolvedValue({ ...page, contentUpdatedAt: null })

    await PATCH(req({ showLastUpdated: true }), ctx)

    expect(updateData().contentUpdatedAt).toBeInstanceOf(Date)
  })

  it('does not bootstrap when disabling', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'u1', username: 'josh' })
    ;(db.display.findUnique as any).mockResolvedValue({ ...page, contentUpdatedAt: null, showLastUpdated: true })

    await PATCH(req({ showLastUpdated: false }), ctx)

    expect(updateData().contentUpdatedAt).toBeUndefined()
  })

  it('lets a collaborator edit the canvas but not the toggle', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'u2', username: 'helper' })
    ;(db.display.findUnique as any).mockResolvedValue({
      ...page,
      collaborators: [{ userId: 'u2' }],
    })

    const res = await PATCH(req({ showLastUpdated: true }), ctx)

    expect(res.status).toBe(403)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test src/app/api/displays/\[id\]/last-updated.test.ts`

Expected: FAIL. The stamping tests fail with `expected undefined to be an instance of Date`; the collaborator test may already pass (`showLastUpdated` is not yet in the allowlist, so it is dropped before `splitUpdate` — it must still pass at the end, for the right reason).

- [ ] **Step 3: Export `VISIBLE_FIELDS`**

In `src/lib/collab.ts`, after line 1, add:

```ts
/**
 * Fields a visitor can actually see rendered on the public page. Editing any of
 * them is what "last updated" means to a reader.
 *
 * Wider than COLLAB_FIELDS (which governs who may edit and optimistic
 * concurrency) because title, description and cover are visible too — but
 * narrower than "every field", because `published` and `category` change
 * nothing a visitor sees on the page itself.
 */
export const VISIBLE_FIELDS = [
  ...COLLAB_FIELDS,
  'title',
  'description',
  'coverImage',
] as const
```

- [ ] **Step 4: Stamp in the route**

In `src/app/api/displays/[id]/route.ts`:

Change the import on line 4 from:

```ts
import { canEdit, splitUpdate, COLLAB_FIELDS } from '@/lib/collab'
```

to:

```ts
import { canEdit, splitUpdate, COLLAB_FIELDS, VISIBLE_FIELDS } from '@/lib/collab'
```

Add `showLastUpdated` to the allowlist. Change:

```ts
    for (const k of ['title', 'description', 'published', 'sections', 'background', 'spacing', 'headerCard', 'tabs', 'coverImage', 'category']) {
```

to:

```ts
    for (const k of ['title', 'description', 'published', 'sections', 'background', 'spacing', 'headerCard', 'tabs', 'coverImage', 'category', 'showLastUpdated']) {
```

`showLastUpdated` is not in `COLLAB_FIELDS`, so `splitUpdate` rejects it for
collaborators automatically — owner-only for free.

Then, immediately before the `db.display.update` call (currently line 135), insert:

```ts
    // "Last updated" tracks visible edits only. Deliberately NOT display.updatedAt:
    // the view counter writes to this row on every page view, so @updatedAt would
    // restamp it and the badge would always read "just now".
    const touchesVisible = Object.keys(data).some((k) =>
      (VISIBLE_FIELDS as readonly string[]).includes(k),
    )
    // Enabling the badge on a page with no recorded edit sets the date to now:
    // the owner asserting the page is current, rather than a date we invented.
    const bootstraps =
      data.showLastUpdated === true && display.contentUpdatedAt === null

    if (touchesVisible || bootstraps) {
      data.contentUpdatedAt = new Date()
    }
```

The existing update call already spreads `data`, so no change is needed there:

```ts
    const updated = await db.display.update({
      where: { id },
      data: { ...data, ...(touchesContent ? { version: { increment: 1 } } : {}) },
    })
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm test src/app/api/displays/\[id\]/last-updated.test.ts`

Expected: PASS — 7 tests.

- [ ] **Step 6: Guard the view path**

The feature's core claim is that a view is not an edit. Today that holds only
because the track route happens not to write `contentUpdatedAt`. Pin it, so a
future "helpful" addition there fails loudly instead of silently corrupting every
page's date.

Create `src/app/api/analytics/track/view-does-not-stamp.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/rate-limit', () => ({ rateLimit: vi.fn().mockResolvedValue(null) }))
vi.mock('@/lib/db', () => ({
  db: {
    display: { findUnique: vi.fn(), update: vi.fn() },
    analyticsEvent: { create: vi.fn() },
  },
}))

import { db } from '@/lib/db'
import { POST } from './route'

beforeEach(() => vi.clearAllMocks())

describe('POST /api/analytics/track', () => {
  // Display.updatedAt is @updatedAt, so this view increment already restamps it.
  // That is exactly why the badge reads contentUpdatedAt instead — and why this
  // route must never touch contentUpdatedAt.
  it('increments views without touching contentUpdatedAt', async () => {
    ;(db.display.findUnique as any).mockResolvedValue({ id: 'd1', published: true })
    ;(db.analyticsEvent.create as any).mockResolvedValue({ id: 'e1' })
    ;(db.display.update as any).mockResolvedValue({})

    const req = new Request('http://localhost/api/analytics/track', {
      method: 'POST',
      body: JSON.stringify({ displayId: 'd1', eventType: 'view' }),
    }) as any

    await POST(req)

    // Exact-match: any extra field here — contentUpdatedAt above all — fails.
    expect(db.display.update).toHaveBeenCalledWith({
      where: { id: 'd1' },
      data: { views: { increment: 1 } },
    })
  })
})
```

Run: `pnpm test src/app/api/analytics/track/view-does-not-stamp.test.ts`

Expected: PASS — 1 test. It passes immediately; it is a regression guard, not a
red-green step. Confirm it can fail by temporarily adding
`contentUpdatedAt: new Date()` to that route's update call, re-running (expect
FAIL), then reverting.

- [ ] **Step 7: Verify no regression in the neighbouring route tests**

Run: `pnpm test src/app/api`

Expected: PASS, all files. Report the observed total.

- [ ] **Step 8: Commit**

```bash
git add src/lib/collab.ts "src/app/api/displays/[id]/route.ts" "src/app/api/displays/[id]/last-updated.test.ts" src/app/api/analytics/track/view-does-not-stamp.test.ts
git commit -m "feat(api): stamp contentUpdatedAt on visible edits only"
```

---

### Task 4: The badge on the public page

**Files:**
- Create: `src/components/ui/LastUpdatedBadge.tsx`
- Test: `src/components/ui/LastUpdatedBadge.test.tsx`
- Modify: `src/app/[username]/[slug]/page.tsx` (imports ~line 26; tabs branch ~line 218; footer ~line 283)

**Interfaces:**
- Consumes: `formatLastUpdated`, `absoluteLastUpdated` from `@/lib/last-updated` (Task 2); `Display.showLastUpdated` / `contentUpdatedAt` (Task 1).
- Produces: `<LastUpdatedBadge date={Date} />` — an inline `<time>` element. It owns no layout or positioning, so each render branch can place it.

- [ ] **Step 1: Write the failing tests**

Create `src/components/ui/LastUpdatedBadge.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LastUpdatedBadge } from './LastUpdatedBadge'

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-07-15T12:00:00.000Z'))
})
afterEach(() => vi.useRealTimers())

describe('LastUpdatedBadge', () => {
  it('renders the relative time in prose', () => {
    render(<LastUpdatedBadge date={new Date('2026-07-12T12:00:00.000Z')} />)
    expect(screen.getByText('Updated 3 days ago')).toBeInTheDocument()
  })

  it('exposes the exact date on hover and to machines', () => {
    render(<LastUpdatedBadge date={new Date('2026-07-12T12:00:00.000Z')} />)
    const el = screen.getByText('Updated 3 days ago')
    expect(el.tagName).toBe('TIME')
    expect(el).toHaveAttribute('dateTime', '2026-07-12T12:00:00.000Z')
    expect(el).toHaveAttribute('title', 'July 12, 2026')
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test src/components/ui/LastUpdatedBadge.test.tsx`

Expected: FAIL — `Failed to resolve import "./LastUpdatedBadge"`.

- [ ] **Step 3: Write the component**

Create `src/components/ui/LastUpdatedBadge.tsx`:

```tsx
import { formatLastUpdated, absoluteLastUpdated } from '@/lib/last-updated'

/**
 * Public "last updated" stamp. Server-rendered: the public page is dynamic
 * (it reads the auth cookie), so the relative time is computed per request and
 * cannot go stale. There is no client render, so no hydration mismatch.
 *
 * Owns no layout — callers place it.
 */
export function LastUpdatedBadge({ date }: { date: Date }) {
  return (
    <time
      dateTime={date.toISOString()}
      title={absoluteLastUpdated(date)}
      className="text-sm opacity-50"
    >
      Updated {formatLastUpdated(date, new Date())}
    </time>
  )
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm test src/components/ui/LastUpdatedBadge.test.tsx`

Expected: PASS — 2 tests.

- [ ] **Step 5: Render it on the public page — both branches**

In `src/app/[username]/[slug]/page.tsx`, add after the `BackButton` import (line 26):

```ts
import { LastUpdatedBadge } from '@/components/ui/LastUpdatedBadge'
```

Find the `creatorChip` block (ends ~line 132) and add immediately after it:

```tsx
  // Opt-in freshness stamp. Computed once and rendered in both layout branches,
  // exactly like creatorChip above — when tabs are on, PublicTabView is the whole
  // page and there is no footer to hang it in.
  const lastUpdatedBadge =
    display.showLastUpdated && display.contentUpdatedAt ? (
      <LastUpdatedBadge date={display.contentUpdatedAt} />
    ) : null
```

In the **tabs branch**, change:

```tsx
        {creatorChip}
      </>
    )
  }
```

to:

```tsx
        {lastUpdatedBadge && (
          <footer className="pb-8 text-center">{lastUpdatedBadge}</footer>
        )}
        {creatorChip}
      </>
    )
  }
```

In the **main branch footer**, change:

```tsx
          <footer className="mt-16 pt-8 border-t border-current/10 text-center">
            <p className="text-sm opacity-50">
              Made with{' '}
              <Link href="/" className="underline hover:opacity-80">
                My Galli
              </Link>
            </p>
```

to:

```tsx
          <footer className="mt-16 pt-8 border-t border-current/10 text-center">
            {lastUpdatedBadge && <p className="mb-1">{lastUpdatedBadge}</p>}
            <p className="text-sm opacity-50">
              Made with{' '}
              <Link href="/" className="underline hover:opacity-80">
                My Galli
              </Link>
            </p>
```

- [ ] **Step 6: Verify the page compiles and nothing regressed**

Run:

```bash
pnpm exec tsc --noEmit
pnpm test src/components/ui
```

Expected: tsc exits 0; tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/components/ui/LastUpdatedBadge.tsx src/components/ui/LastUpdatedBadge.test.tsx "src/app/[username]/[slug]/page.tsx"
git commit -m "feat(page): show the last-updated stamp when opted in"
```

---

### Task 5: The owner's toggle

**Files:**
- Create: `src/components/editor/panel/LastUpdatedSettings.tsx`
- Test: `src/components/editor/panel/LastUpdatedSettings.test.tsx`
- Modify: `src/components/editor/panel/PageTab.tsx` (props ~line 13-19; sections ~line 45)
- Modify: `src/components/editor/PageEditor.tsx` (state near line 57; `<PageTab .../>` ~line 1318)

**Interfaces:**
- Consumes: `Display.showLastUpdated` (Task 1); the PATCH allowlist (Task 3).
- Produces: `<LastUpdatedSettingsBody value={boolean} onChange={(next: boolean) => void} />`; `PageTab` gains `showLastUpdated: boolean` and `onShowLastUpdatedChange: (next: boolean) => void`.

- [ ] **Step 1: Write the failing tests**

Create `src/components/editor/panel/LastUpdatedSettings.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { LastUpdatedSettingsBody } from './LastUpdatedSettings'

describe('LastUpdatedSettingsBody', () => {
  it('reflects the current value', () => {
    render(<LastUpdatedSettingsBody value onChange={vi.fn()} />)
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true')
  })

  it('reflects being off', () => {
    render(<LastUpdatedSettingsBody value={false} onChange={vi.fn()} />)
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false')
  })

  it('toggles to the opposite value', () => {
    const onChange = vi.fn()
    render(<LastUpdatedSettingsBody value={false} onChange={onChange} />)
    fireEvent.click(screen.getByRole('switch'))
    expect(onChange).toHaveBeenCalledWith(true)
  })

  // The owner must know the date becomes public before flipping it.
  it('states that the date is public', () => {
    render(<LastUpdatedSettingsBody value={false} onChange={vi.fn()} />)
    expect(screen.getByText(/visitors/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test src/components/editor/panel/LastUpdatedSettings.test.tsx`

Expected: FAIL — `Failed to resolve import "./LastUpdatedSettings"`.

- [ ] **Step 3: Write the component**

Create `src/components/editor/panel/LastUpdatedSettings.tsx`:

```tsx
'use client'

export function LastUpdatedSettingsBody({
  value,
  onChange,
}: {
  value: boolean
  onChange: (next: boolean) => void
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm">Show when this page was last updated</span>
        <button
          type="button"
          role="switch"
          aria-checked={value}
          aria-label="Show when this page was last updated"
          onClick={() => onChange(!value)}
          className={`relative h-5 w-9 shrink-0 rounded-full transition cursor-pointer ${
            value ? 'bg-primary' : 'bg-muted'
          }`}
        >
          <span
            className={`absolute top-0.5 h-4 w-4 rounded-full bg-background shadow-soft transition-all ${
              value ? 'left-[1.125rem]' : 'left-0.5'
            }`}
          />
        </button>
      </div>
      <p className="text-xs text-muted-foreground">
        Visitors will see the date you last changed this page. Off by default.
      </p>
    </div>
  )
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm test src/components/editor/panel/LastUpdatedSettings.test.tsx`

Expected: PASS — 4 tests.

- [ ] **Step 5: Add the section to PageTab**

In `src/components/editor/panel/PageTab.tsx`, add to the imports:

```ts
import { LastUpdatedSettingsBody } from './LastUpdatedSettings'
```

Add to `PageTabProps` (after `currentSections: Section[]`):

```ts
  showLastUpdated: boolean; onShowLastUpdatedChange: (next: boolean) => void
```

Add a section after the `Tabs` section, before the closing `</div>`:

```tsx
      <Section_ title="Last updated">
        <LastUpdatedSettingsBody
          value={props.showLastUpdated}
          onChange={props.onShowLastUpdatedChange}
        />
      </Section_>
```

- [ ] **Step 6: Wire PageEditor with its own PATCH**

In `src/components/editor/PageEditor.tsx`, add state next to the other page-level state (near line 57):

```ts
  const [showLastUpdated, setShowLastUpdated] = useState(false)
```

Add the handler above the JSX return (place it beside the other callbacks):

```ts
  // Deliberately its own PATCH rather than joining the autosave: the autosave
  // always ships sections/background/etc, which count as visible edits, so
  // riding along would stamp contentUpdatedAt and reset the page's real edit
  // date every time the owner flipped this. Same narrow-payload pattern as
  // PublishDialog.
  const changeShowLastUpdated = async (next: boolean) => {
    const previous = showLastUpdated
    setShowLastUpdated(next) // optimistic
    try {
      const res = await fetch(`/api/displays/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ showLastUpdated: next }),
      })
      if (!res.ok) setShowLastUpdated(previous)
    } catch {
      setShowLastUpdated(previous)
    }
  }
```

Seed the state from the loaded display. In the hydration block at lines 217-225,
change:

```ts
      if (res.ok) {
        const data = await res.json()
        setId(data.id)
        setTitle(data.title)
        setSlug(data.slug)
        setPublished(data.published)
        setCategory(data.category ?? null)
        setCoverImage(data.coverImage ?? null)
```

to:

```ts
      if (res.ok) {
        const data = await res.json()
        setId(data.id)
        setTitle(data.title)
        setSlug(data.slug)
        setPublished(data.published)
        setCategory(data.category ?? null)
        setCoverImage(data.coverImage ?? null)
        setShowLastUpdated(!!data.showLastUpdated)
```

Only this block needs it. The other `setTitle(data.title)` (line ~301) runs after
creating a brand-new page, where the column already defaults to `false`.

Pass both props to `<PageTab>` (~line 1318), after `currentSections`:

```tsx
                showLastUpdated={showLastUpdated}
                onShowLastUpdatedChange={changeShowLastUpdated}
```

- [ ] **Step 7: Verify the whole suite and the gates**

Run:

```bash
pnpm test
pnpm exec tsc --noEmit
pnpm exec eslint src --no-eslintrc -c .eslintrc.json --ext .ts,.tsx --resolve-plugins-relative-to .
```

Expected: tests pass — baseline was 540, this plan adds 23 (9 formatter + 8 API + 2 badge + 4 toggle), so expect **563**. Report the observed number rather than assuming. tsc exits 0. eslint exits 0 with 31 pre-existing warnings and 0 errors.

- [ ] **Step 8: Commit**

```bash
git add src/components/editor/panel/LastUpdatedSettings.tsx src/components/editor/panel/LastUpdatedSettings.test.tsx src/components/editor/panel/PageTab.tsx src/components/editor/PageEditor.tsx
git commit -m "feat(editor): add the last-updated toggle to page settings"
```

---

## Manual verification (after Task 5)

The automated tests cannot see a browser. Verify by hand:

1. Start Postgres and the dev server:
   ```bash
   docker compose up -d
   DATABASE_URL="postgresql://pages:pages@127.0.0.1:5434/pages" \
   DATABASE_URL_UNPOOLED="postgresql://pages:pages@127.0.0.1:5434/pages" \
   pnpm exec next dev -p 3000
   ```
   Port 3000 matters: the Google OAuth client only authorises `http://localhost:3000`.
2. Open a page in the editor → **Page** tab → **Last updated** → toggle on.
3. Visit the public page. The stamp should appear in the footer.
4. Reload the public page several times. **The date must not change** — this is the regression the whole design exists to prevent.
5. Edit the page's title, save, reload. The date should move to "just now".
6. Toggle off → the stamp disappears.
7. If the page has tabs enabled, repeat 3-4 with tabs on to check the other branch.
