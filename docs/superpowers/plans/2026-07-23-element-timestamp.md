# Element Timestamp ("stamp") Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a page author stamp an individual element with the server's current date and time, shown as a muted line beneath the element on the public page.

**Architecture:** Two optional fields ride inside the existing `Display.sections` JSON — no migration. The value is written only by a server endpoint, never by the browser. Display is one wrapper inside `renderElement`, and the control is one block inside `ElementRow` — each sitting *outside* its type-specific switch/registry, so all ~40 element types are covered without per-type work.

**Tech Stack:** Next.js 15 App Router, Prisma + Postgres, Vitest + @testing-library/react, Tailwind, `Intl.DateTimeFormat`.

## Global Constraints

- Work in worktree `/Users/jenniferjordan/joshwhirley/mg-element-timestamp` on branch `feat/element-timestamp`. **Never `git checkout` in `/Users/jenniferjordan/joshwhirley/MyGalli`** — other agent sessions are live there. See `COORDINATION.md`.
- **No Prisma migration.** `Display.sections` is a `Json` column; the new fields live inside it. Do not touch `prisma/schema.prisma`.
- **The stamp instant is always `new Date()` on the server.** No code path may write a client-supplied time. `tz` is the only client-supplied value and affects display only.
- Authorisation uses `canEdit(userId, ownerId, collaboratorIds)` from `src/lib/collab.ts` — owner **or collaborator**, not owner-only.
- **A failed `canEdit` returns `404`, not `403`**, matching `PATCH /api/displays/[id]`, so the endpoint is not an existence oracle for other displays.
- Copy rule: the control and all labels say **"Stamp"**. Never "Last updated" or "Updated" — a separate page-level feature already owns those words (`LastUpdatedSettings`, `Display.showLastUpdated`).
- Next.js 15: route handler params are `Promise<{ ... }>` and must be awaited.
- Run one test file with `pnpm exec vitest run <path>`. Plain `pnpm test` ignores path arguments. Paths with `[` need quoting.
- Baseline: `src/app/api/messages/upload/route.test.ts` has one known pre-existing failure on this machine. "All green" means that one failure and nothing else.
- If `pnpm` is missing: `export PATH=~/.local/bin:$PATH`. Some suites need `export $(grep -E '^JWT_SECRET=' .env | tr -d '"')`.

## File Structure

| File | Responsibility |
|---|---|
| `src/lib/types/canvas.ts` | `stampedAt` / `stampedTz` on `CanvasElement` |
| `src/lib/element-stamp.ts` | Pure helpers: find/set/clear a stamp in a `Section[]`, validate a tz. No Prisma, no React |
| `src/app/api/displays/[id]/elements/[elementId]/stamp/route.ts` | `POST` / `DELETE`. Auth + server clock + persistence |
| `src/components/elements/ElementStamp.tsx` | Presentational. Formats one stamp line |
| `src/lib/render-elements.tsx` | Public render path: `renderElement` becomes a wrapper over a private `renderElementBody` |
| `src/components/canvas/ColumnCanvas.tsx` | Editor render path: its own local `renderElement` gets the same wrapper treatment |
| `src/components/editor/panel/ElementRow.tsx` | The Stamp / Re-stamp / Remove control |

**There are two independent element render paths in this codebase.**
`src/lib/render-elements.tsx` serves public pages; `ColumnCanvas`'s local `renderElement`
serves the editor canvas. They do not share code. Task 4 wraps both — changing only one leaves
the stamp visible to visitors but invisible to the author who created it, or vice versa.

---

### Task 1: Types and pure stamp helpers

**Files:**
- Modify: `src/lib/types/canvas.ts` (add two fields to `CanvasElement`)
- Create: `src/lib/element-stamp.ts`
- Test: `src/lib/element-stamp.test.ts`

**Interfaces:**
- Consumes: `Section`, `Column`, `CanvasElement` from `@/lib/types/canvas`
- Produces:
  - `isValidTimeZone(tz: unknown): tz is string`
  - `findElement(sections: Section[], elementId: string): CanvasElement | null`
  - `setStamp(sections: Section[], elementId: string, stampedAt: string, stampedTz?: string): Section[] | null`
  - `clearStamp(sections: Section[], elementId: string): Section[] | null`

  `setStamp`/`clearStamp` return a NEW `Section[]`, or `null` when the element id is absent.

- [ ] **Step 1: Add the fields to `CanvasElement`**

In `src/lib/types/canvas.ts`, inside `export interface CanvasElement`, immediately after `id` and `type`:

```ts
  // Timestamp ("stamp") — written only by the server when the author stamps this
  // element. Absent means unstamped. Never written from a client-supplied time.
  stampedAt?: string   // ISO-8601 instant, UTC
  stampedTz?: string   // IANA zone of the author at stamp time, e.g. 'America/New_York'
```

- [ ] **Step 2: Write the failing test**

Create `src/lib/element-stamp.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import type { Section } from '@/lib/types/canvas'
import { isValidTimeZone, findElement, setStamp, clearStamp } from './element-stamp'

function sections(): Section[] {
  return [
    { id: 's1', layout: 'single', columns: [
      { id: 'c1', elements: [{ id: 'e1', type: 'text', content: 'hello' }] },
    ] },
    { id: 's2', layout: 'single', columns: [
      { id: 'c2', elements: [
        { id: 'e2', type: 'image', url: 'https://x/a.jpg' },
        { id: 'e3', type: 'heading', content: 'hi', stampedAt: '2026-01-01T00:00:00.000Z', stampedTz: 'UTC' },
      ] },
    ] },
  ]
}

describe('isValidTimeZone', () => {
  it('accepts a real IANA zone', () => {
    expect(isValidTimeZone('America/New_York')).toBe(true)
  })
  it('rejects nonsense, non-strings and empty', () => {
    expect(isValidTimeZone('Mars/Olympus_Mons')).toBe(false)
    expect(isValidTimeZone(42)).toBe(false)
    expect(isValidTimeZone('')).toBe(false)
    expect(isValidTimeZone(undefined)).toBe(false)
  })
})

describe('findElement', () => {
  it('finds an element in a later section and column', () => {
    expect(findElement(sections(), 'e3')?.type).toBe('heading')
  })
  it('returns null for an unknown id', () => {
    expect(findElement(sections(), 'nope')).toBeNull()
  })
})

describe('setStamp', () => {
  it('sets both fields on the target element only', () => {
    const next = setStamp(sections(), 'e1', '2026-07-23T19:30:00.000Z', 'America/New_York')!
    expect(findElement(next, 'e1')).toMatchObject({
      stampedAt: '2026-07-23T19:30:00.000Z', stampedTz: 'America/New_York',
    })
    expect(findElement(next, 'e2')?.stampedAt).toBeUndefined()
  })

  it('overwrites an existing stamp (re-stamp)', () => {
    const next = setStamp(sections(), 'e3', '2026-07-23T19:30:00.000Z', 'Europe/London')!
    expect(findElement(next, 'e3')).toMatchObject({
      stampedAt: '2026-07-23T19:30:00.000Z', stampedTz: 'Europe/London',
    })
  })

  it('omits stampedTz when not supplied', () => {
    const next = setStamp(sections(), 'e1', '2026-07-23T19:30:00.000Z')!
    expect(findElement(next, 'e1')?.stampedTz).toBeUndefined()
  })

  it('does not mutate the input', () => {
    const input = sections()
    setStamp(input, 'e1', '2026-07-23T19:30:00.000Z', 'UTC')
    expect(findElement(input, 'e1')?.stampedAt).toBeUndefined()
  })

  it('preserves every other field of the target element', () => {
    const next = setStamp(sections(), 'e2', '2026-07-23T19:30:00.000Z', 'UTC')!
    expect(findElement(next, 'e2')).toMatchObject({ type: 'image', url: 'https://x/a.jpg' })
  })

  it('returns null for an unknown id', () => {
    expect(setStamp(sections(), 'nope', '2026-07-23T19:30:00.000Z', 'UTC')).toBeNull()
  })
})

describe('clearStamp', () => {
  it('removes both fields', () => {
    const next = clearStamp(sections(), 'e3')!
    const el = findElement(next, 'e3')!
    expect(el.stampedAt).toBeUndefined()
    expect(el.stampedTz).toBeUndefined()
    expect(el.content).toBe('hi')
  })
  it('returns null for an unknown id', () => {
    expect(clearStamp(sections(), 'nope')).toBeNull()
  })
})
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `pnpm exec vitest run src/lib/element-stamp.test.ts`
Expected: FAIL — `Failed to resolve import "./element-stamp"`.

- [ ] **Step 4: Write the implementation**

Create `src/lib/element-stamp.ts`:

```ts
import type { CanvasElement, Section } from '@/lib/types/canvas'

/**
 * True only for zones this runtime actually knows. The tz is the sole
 * client-supplied input to stamping, so it is validated rather than trusted;
 * an unknown zone would throw inside Intl at render time on every viewer.
 */
export function isValidTimeZone(tz: unknown): tz is string {
  if (typeof tz !== 'string' || !tz) return false
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz })
    return true
  } catch {
    return false
  }
}

export function findElement(sections: Section[], elementId: string): CanvasElement | null {
  for (const section of sections) {
    for (const column of section.columns) {
      for (const element of column.elements) {
        if (element.id === elementId) return element
      }
    }
  }
  return null
}

/** Rebuild `sections` with `mutate` applied to one element. Null if absent. */
function mapElement(
  sections: Section[],
  elementId: string,
  mutate: (el: CanvasElement) => CanvasElement,
): Section[] | null {
  let found = false
  const next = sections.map((section) => ({
    ...section,
    columns: section.columns.map((column) => ({
      ...column,
      elements: column.elements.map((element) => {
        if (element.id !== elementId) return element
        found = true
        return mutate(element)
      }),
    })),
  }))
  return found ? next : null
}

export function setStamp(
  sections: Section[],
  elementId: string,
  stampedAt: string,
  stampedTz?: string,
): Section[] | null {
  return mapElement(sections, elementId, (el) => {
    const next: CanvasElement = { ...el, stampedAt }
    if (stampedTz) next.stampedTz = stampedTz
    else delete next.stampedTz
    return next
  })
}

export function clearStamp(sections: Section[], elementId: string): Section[] | null {
  return mapElement(sections, elementId, (el) => {
    const next = { ...el }
    delete next.stampedAt
    delete next.stampedTz
    return next
  })
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm exec vitest run src/lib/element-stamp.test.ts`
Expected: PASS — 12 tests.

- [ ] **Step 6: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: exit 0, no output.

- [ ] **Step 7: Commit**

```bash
git add src/lib/types/canvas.ts src/lib/element-stamp.ts src/lib/element-stamp.test.ts
git commit -m "feat(stamp): CanvasElement stamp fields and pure section helpers"
```

---

### Task 2: Stamp endpoint

**Files:**
- Create: `src/app/api/displays/[id]/elements/[elementId]/stamp/route.ts`
- Test: `src/app/api/displays/[id]/elements/[elementId]/stamp/route.test.ts`

**Interfaces:**
- Consumes: `isValidTimeZone`, `setStamp`, `clearStamp` from Task 1; `canEdit` from `@/lib/collab`; `getUser` from `@/lib/auth`; `db` from `@/lib/db`
- Produces: `POST` → `200 { stampedAt, stampedTz }`; `DELETE` → `200 { ok: true }`

- [ ] **Step 1: Write the failing test**

Create `src/app/api/displays/[id]/elements/[elementId]/stamp/route.test.ts`:

```ts
import { it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({ getUser: vi.fn() }))
vi.mock('@/lib/db', () => ({
  db: { display: { findUnique: vi.fn(), update: vi.fn(async () => ({})) } },
}))

import { getUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { POST, DELETE } from './route'

const ctx = { params: Promise.resolve({ id: 'd1', elementId: 'e1' }) }
const req = (body?: unknown) => ({ json: async () => body ?? {} } as any)

function display(overrides: Record<string, unknown> = {}) {
  return {
    id: 'd1',
    userId: 'owner',
    collaborators: [{ userId: 'collab' }],
    sections: [
      { id: 's1', layout: 'single', columns: [
        { id: 'c1', elements: [
          { id: 'e1', type: 'text', content: 'hello' },
          { id: 'e2', type: 'image', url: 'https://x/a.jpg' },
        ] },
      ] },
    ],
    ...overrides,
  }
}

beforeEach(() => vi.resetAllMocks())

it('POST 401 when logged out', async () => {
  ;(getUser as any).mockResolvedValue(null)
  expect((await POST(req(), ctx)).status).toBe(401)
})

it('POST 404 when the display does not exist', async () => {
  ;(getUser as any).mockResolvedValue({ id: 'owner' })
  ;(db.display.findUnique as any).mockResolvedValue(null)
  expect((await POST(req(), ctx)).status).toBe(404)
})

it('POST 404 (not 403) for a signed-in stranger', async () => {
  ;(getUser as any).mockResolvedValue({ id: 'stranger' })
  ;(db.display.findUnique as any).mockResolvedValue(display())
  const res = await POST(req(), ctx)
  expect(res.status).toBe(404)
  expect(db.display.update).not.toHaveBeenCalled()
})

it('POST 404 when the element id is not in the page', async () => {
  ;(getUser as any).mockResolvedValue({ id: 'owner' })
  ;(db.display.findUnique as any).mockResolvedValue(display())
  const res = await POST(req(), { params: Promise.resolve({ id: 'd1', elementId: 'nope' }) })
  expect(res.status).toBe(404)
})

it('POST stamps for the owner using SERVER time, not the request body', async () => {
  ;(getUser as any).mockResolvedValue({ id: 'owner' })
  ;(db.display.findUnique as any).mockResolvedValue(display())
  const before = Date.now()
  const res = await POST(req({ stampedAt: '1999-01-01T00:00:00.000Z', tz: 'UTC' }), ctx)
  const after = Date.now()
  expect(res.status).toBe(200)
  const data = await res.json()
  const written = Date.parse(data.stampedAt)
  expect(written).toBeGreaterThanOrEqual(before)
  expect(written).toBeLessThanOrEqual(after)
  expect(data.stampedAt).not.toBe('1999-01-01T00:00:00.000Z')
})

it('POST succeeds for a COLLABORATOR, not just the owner', async () => {
  ;(getUser as any).mockResolvedValue({ id: 'collab' })
  ;(db.display.findUnique as any).mockResolvedValue(display())
  expect((await POST(req({ tz: 'UTC' }), ctx)).status).toBe(200)
})

it('POST stores a valid tz and ignores an invalid one', async () => {
  ;(getUser as any).mockResolvedValue({ id: 'owner' })
  ;(db.display.findUnique as any).mockResolvedValue(display())
  const ok = await (await POST(req({ tz: 'America/New_York' }), ctx)).json()
  expect(ok.stampedTz).toBe('America/New_York')

  ;(getUser as any).mockResolvedValue({ id: 'owner' })
  ;(db.display.findUnique as any).mockResolvedValue(display())
  const bad = await (await POST(req({ tz: 'Mars/Olympus_Mons' }), ctx)).json()
  expect(bad.stampedTz).toBeUndefined()
  expect(bad.stampedAt).toBeTruthy()
})

it('POST writes only the target element and leaves siblings untouched', async () => {
  ;(getUser as any).mockResolvedValue({ id: 'owner' })
  ;(db.display.findUnique as any).mockResolvedValue(display())
  await POST(req({ tz: 'UTC' }), ctx)
  const written = (db.display.update as any).mock.calls[0][0].data.sections
  const els = written[0].columns[0].elements
  expect(els[0].stampedAt).toBeTruthy()
  expect(els[0].content).toBe('hello')
  expect(els[1].stampedAt).toBeUndefined()
  expect(els[1].url).toBe('https://x/a.jpg')
})

it('DELETE removes both fields', async () => {
  ;(getUser as any).mockResolvedValue({ id: 'owner' })
  ;(db.display.findUnique as any).mockResolvedValue(display({
    sections: [{ id: 's1', layout: 'single', columns: [{ id: 'c1', elements: [
      { id: 'e1', type: 'text', content: 'hello', stampedAt: '2026-01-01T00:00:00.000Z', stampedTz: 'UTC' },
    ] }] }],
  }))
  const res = await DELETE(req(), ctx)
  expect(res.status).toBe(200)
  const el = (db.display.update as any).mock.calls[0][0].data.sections[0].columns[0].elements[0]
  expect(el.stampedAt).toBeUndefined()
  expect(el.stampedTz).toBeUndefined()
  expect(el.content).toBe('hello')
})

it('DELETE 404 for a stranger', async () => {
  ;(getUser as any).mockResolvedValue({ id: 'stranger' })
  ;(db.display.findUnique as any).mockResolvedValue(display())
  expect((await DELETE(req(), ctx)).status).toBe(404)
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run "src/app/api/displays/[id]/elements/[elementId]/stamp/route.test.ts"`
Expected: FAIL — cannot resolve `./route`.

- [ ] **Step 3: Write the implementation**

Create `src/app/api/displays/[id]/elements/[elementId]/stamp/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'
import { canEdit } from '@/lib/collab'
import type { Section } from '@/lib/types/canvas'
import { isValidTimeZone, setStamp, clearStamp } from '@/lib/element-stamp'

type Ctx = { params: Promise<{ id: string; elementId: string }> }

const NOT_FOUND = NextResponse.json({ error: 'Display not found' }, { status: 404 })

/**
 * Loads the display and checks edit rights.
 *
 * A failed canEdit answers 404, not 403 — the same answer PATCH
 * /api/displays/[id] gives — so this endpoint cannot be used to confirm that
 * some other user's display exists.
 */
async function load(request: NextRequest, id: string) {
  const user = await getUser(request)
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }

  const display = await db.display.findUnique({
    where: { id },
    include: { collaborators: { select: { userId: true } } },
  })
  if (!display) return { error: NOT_FOUND }

  const collaboratorIds = display.collaborators.map((c) => c.userId)
  if (!canEdit(user.id, display.userId, collaboratorIds)) return { error: NOT_FOUND }

  const sections: Section[] =
    typeof display.sections === 'string'
      ? JSON.parse(display.sections)
      : ((display.sections as unknown as Section[]) ?? [])

  return { sections }
}

export async function POST(request: NextRequest, { params }: Ctx) {
  const { id, elementId } = await params
  const ctx = await load(request, id)
  if ('error' in ctx) return ctx.error

  const body = await request.json().catch(() => ({}))
  // The instant is ALWAYS the server clock. Anything time-like in the body is
  // ignored on purpose — honouring it would turn this into a date picker and
  // let any caller forge a stamp.
  const stampedAt = new Date().toISOString()
  const stampedTz = isValidTimeZone(body?.tz) ? body.tz : undefined

  const next = setStamp(ctx.sections, elementId, stampedAt, stampedTz)
  if (!next) return NOT_FOUND

  await db.display.update({ where: { id }, data: { sections: next as never } })
  return NextResponse.json({ stampedAt, stampedTz })
}

export async function DELETE(request: NextRequest, { params }: Ctx) {
  const { id, elementId } = await params
  const ctx = await load(request, id)
  if ('error' in ctx) return ctx.error

  const next = clearStamp(ctx.sections, elementId)
  if (!next) return NOT_FOUND

  await db.display.update({ where: { id }, data: { sections: next as never } })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm exec vitest run "src/app/api/displays/[id]/elements/[elementId]/stamp/route.test.ts"`
Expected: PASS — 10 tests.

- [ ] **Step 5: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add "src/app/api/displays/[id]/elements"
git commit -m "feat(stamp): server-clock stamp and unstamp endpoints"
```

---

### Task 3: `ElementStamp` component

**Files:**
- Create: `src/components/elements/ElementStamp.tsx`
- Test: `src/components/elements/ElementStamp.test.tsx`

**Interfaces:**
- Consumes: nothing
- Produces: `<ElementStamp stampedAt={string} stampedTz?={string} />`

- [ ] **Step 1: Write the failing test**

Create `src/components/elements/ElementStamp.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ElementStamp } from './ElementStamp'

const INSTANT = '2026-07-23T23:30:00.000Z' // 7:30 PM in New York, 12:30 AM next day in London

describe('ElementStamp', () => {
  it('renders a machine-readable <time> carrying the exact instant', () => {
    render(<ElementStamp stampedAt={INSTANT} stampedTz="UTC" />)
    expect(screen.getByRole('time')).toHaveAttribute('datetime', INSTANT)
  })

  it('renders the same instant differently for different zones', () => {
    const { unmount } = render(<ElementStamp stampedAt={INSTANT} stampedTz="America/New_York" />)
    const ny = screen.getByRole('time').textContent!
    unmount()
    render(<ElementStamp stampedAt={INSTANT} stampedTz="Europe/London" />)
    const london = screen.getByRole('time').textContent!
    expect(ny).not.toBe(london)
    expect(ny).toMatch(/July 23, 2026/)
    expect(london).toMatch(/July 24, 2026/)
  })

  it('falls back to UTC when the zone is unknown instead of throwing', () => {
    render(<ElementStamp stampedAt={INSTANT} stampedTz="Mars/Olympus_Mons" />)
    expect(screen.getByRole('time').textContent).toMatch(/July 23, 2026/)
  })

  it('falls back to UTC when no zone is given', () => {
    render(<ElementStamp stampedAt={INSTANT} />)
    expect(screen.getByRole('time').textContent).toMatch(/July 23, 2026/)
  })

  it('renders nothing for an unparseable instant', () => {
    const { container } = render(<ElementStamp stampedAt="not-a-date" stampedTz="UTC" />)
    expect(container).toBeEmptyDOMElement()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run src/components/elements/ElementStamp.test.tsx`
Expected: FAIL — cannot resolve `./ElementStamp`.

- [ ] **Step 3: Write the implementation**

Create `src/components/elements/ElementStamp.tsx`:

```tsx
import { isValidTimeZone } from '@/lib/element-stamp'

/**
 * One muted line beneath a stamped element.
 *
 * Formatting is pinned to the AUTHOR's zone, not the viewer's, so the stamp
 * reads identically for everyone — otherwise a 7:30 PM New York stamp would
 * show as the next day's date in London.
 *
 * No hooks and no locale inference: this renders inside server-rendered public
 * pages, so server and client output must match exactly or React reports a
 * hydration mismatch.
 */
export function ElementStamp({
  stampedAt,
  stampedTz,
}: {
  stampedAt: string
  stampedTz?: string
}) {
  const date = new Date(stampedAt)
  if (Number.isNaN(date.getTime())) return null

  const timeZone = isValidTimeZone(stampedTz) ? stampedTz : 'UTC'
  const formatted = new Intl.DateTimeFormat('en-US', {
    timeZone,
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)

  return (
    <time
      dateTime={stampedAt}
      className="mt-1.5 block text-xs text-muted-foreground"
    >
      {formatted.replace(' at ', ' · ')}
    </time>
  )
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm exec vitest run src/components/elements/ElementStamp.test.tsx`
Expected: PASS — 5 tests.

If the "different zones" test fails because both strings match, check that `timeZone` is actually reaching `Intl.DateTimeFormat` — a dropped `timeZone` option silently formats in the runner's local zone and makes the two identical.

- [ ] **Step 5: Commit**

```bash
git add src/components/elements/ElementStamp.tsx src/components/elements/ElementStamp.test.tsx
git commit -m "feat(stamp): ElementStamp display component"
```

---

### Task 4: Render the stamp for every element type

**Files:**
- Modify: `src/lib/render-elements.tsx` (rename the existing `renderElement` to `renderElementBody`; add a new wrapper `renderElement`)
- Test: `src/lib/render-elements.stamp.test.tsx`

**Interfaces:**
- Consumes: `ElementStamp` from Task 3; `stampedAt`/`stampedTz` from Task 1
- Produces: `renderElement(element, displayId?)` keeps its existing signature and all existing behaviour, and now appends the stamp when present

- [ ] **Step 1: Write the failing test**

Create `src/lib/render-elements.stamp.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { CanvasElement } from '@/lib/types/canvas'
import { renderElement } from './render-elements'

const STAMP = { stampedAt: '2026-07-23T23:30:00.000Z', stampedTz: 'UTC' }

describe('renderElement stamp wrapper', () => {
  it('renders no stamp when the element is unstamped', () => {
    render(<div>{renderElement({ id: 'e1', type: 'text', content: 'hello' })}</div>)
    expect(screen.queryByRole('time')).not.toBeInTheDocument()
  })

  it('renders the stamp when present', () => {
    render(<div>{renderElement({ id: 'e1', type: 'text', content: 'hello', ...STAMP })}</div>)
    expect(screen.getByRole('time')).toHaveAttribute('datetime', STAMP.stampedAt)
  })

  it('still renders the element body alongside the stamp', () => {
    render(<div>{renderElement({ id: 'e1', type: 'heading', content: 'My Heading', ...STAMP })}</div>)
    expect(screen.getByText('My Heading')).toBeInTheDocument()
    expect(screen.getByRole('time')).toBeInTheDocument()
  })

  // The point of the wrapper: it is type-independent. If someone ever moves the
  // stamp into the switch, this is the test that catches it.
  it.each(['text', 'heading', 'image', 'quote', 'code'] as const)(
    'renders the stamp for a %s element',
    (type) => {
      const el = { id: 'e1', type, content: 'x', url: 'https://x/a.jpg', quoteText: 'q', ...STAMP } as CanvasElement
      render(<div>{renderElement(el)}</div>)
      expect(screen.getByRole('time')).toBeInTheDocument()
    },
  )
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run src/lib/render-elements.stamp.test.tsx`
Expected: FAIL — the stamped cases find no `time` role.

- [ ] **Step 3: Refactor `renderElement` into a wrapper**

In `src/lib/render-elements.tsx`:

1. Add the import near the other component imports at the top:

```tsx
import { ElementStamp } from '@/components/elements/ElementStamp'
```

2. Rename the existing exported function (currently at line 108) from
   `export function renderElement(element: CanvasElement, displayId?: string) {`
   to:

```tsx
function renderElementBody(element: CanvasElement, displayId?: string) {
```

Change nothing inside it — the entire `switch` stays exactly as it is.

3. Immediately BEFORE `renderElementBody`, add the new public wrapper:

```tsx
/**
 * Public entry point for rendering one element.
 *
 * The type-specific work lives in renderElementBody; this wrapper adds
 * behaviour that applies to EVERY element type. Keeping the stamp here rather
 * than in the switch is what lets all ~40 types support stamping without any
 * per-type code.
 */
export function renderElement(element: CanvasElement, displayId?: string) {
  const body = renderElementBody(element, displayId)
  if (!element.stampedAt) return body
  return (
    <>
      {body}
      <ElementStamp stampedAt={element.stampedAt} stampedTz={element.stampedTz} />
    </>
  )
}
```

- [ ] **Step 4: Run the new test to verify it passes**

Run: `pnpm exec vitest run src/lib/render-elements.stamp.test.tsx`
Expected: PASS — 8 tests (3 plus the 5 parameterised cases).

- [ ] **Step 5: Verify no existing render behaviour regressed**

Run: `pnpm exec vitest run src/lib`
Expected: all pass, including the pre-existing `src/lib/render-elements.lead-gen.test.tsx`.

- [ ] **Step 6: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: exit 0. An error here usually means a caller imported `renderElementBody` — it is intentionally private; only `renderElement` is exported.

- [ ] **Step 7: Render the stamp on the editor canvas too**

**The editor canvas is a SECOND, independent render path.** `src/components/canvas/ColumnCanvas.tsx`
declares its own local `const renderElement = (element, sectionId, columnId) => { … }` at line 403
with its own `switch` — it does NOT import `src/lib/render-elements.tsx`. Changing the shared
renderer alone leaves the author seeing no stamp while editing.

Apply the same wrapper trick to the local function. Rename it and add a wrapper immediately after:

```tsx
  // Render element (type-specific)
  const renderElementBody = (
    element: CanvasElement,
    sectionId: string,
    columnId: string
  ) => {
```

Leave that function's body completely unchanged. Then directly after it closes, add:

```tsx
  // Same wrapper idea as the public renderer in src/lib/render-elements.tsx:
  // the stamp applies to every element type, so it sits outside the switch.
  const renderElement = (
    element: CanvasElement,
    sectionId: string,
    columnId: string
  ) => {
    const body = renderElementBody(element, sectionId, columnId)
    if (!element.stampedAt) return body
    return (
      <>
        {body}
        <ElementStamp stampedAt={element.stampedAt} stampedTz={element.stampedTz} />
      </>
    )
  }
```

Add the import at the top of `ColumnCanvas.tsx`:

```tsx
import { ElementStamp } from '@/components/elements/ElementStamp'
```

Both existing call sites (around lines 1719 and 1797) keep calling `renderElement` unchanged.

- [ ] **Step 8: Verify the canvas renders it**

Add to `src/lib/render-elements.stamp.test.tsx`:

```tsx
import { ColumnCanvas } from '@/components/canvas/ColumnCanvas'

describe('editor canvas stamp', () => {
  it('renders the stamp on the canvas so the author sees what a visitor sees', () => {
    const sections = [{ id: 's1', layout: 'single' as const, columns: [
      { id: 'c1', elements: [{ id: 'e1', type: 'text' as const, content: 'hi', ...STAMP }] },
    ] }]
    render(
      <ColumnCanvas
        sections={sections}
        onSectionsChange={() => {}}
        onAddSection={() => {}}
        onDeleteSection={() => {}}
        onOpenSlashMenu={() => {}}
        onUpdateElement={() => {}}
        onDeleteElement={() => {}}
        displayId="d1"
      />,
    )
    expect(screen.getByRole('time')).toBeInTheDocument()
  })
})
```

Run: `pnpm exec vitest run src/lib/render-elements.stamp.test.tsx`
Expected: PASS — 9 tests.

If `ColumnCanvas` requires props beyond those listed, supply no-op values for them; do not change the component's prop contract to satisfy the test.

- [ ] **Step 9: Commit**

```bash
git add src/lib/render-elements.tsx src/lib/render-elements.stamp.test.tsx src/components/canvas/ColumnCanvas.tsx
git commit -m "feat(stamp): render stamps in both the public and editor render paths"
```

---

### Task 5: The Stamp control in `ElementRow`

**Files:**
- Modify: `src/components/editor/panel/ElementRow.tsx`
- Test: `src/components/editor/panel/ElementRow.test.tsx` (append; keep the 3 existing tests)

**Interfaces:**
- Consumes: the Task 2 endpoints; `ElementStamp` from Task 3
- Produces: `ElementRow` gains a required `displayId: string` prop

- [ ] **Step 1: Write the failing tests**

Append to `src/components/editor/panel/ElementRow.test.tsx`:

```tsx
describe('ElementRow stamp control', () => {
  const base = { sectionId: 's1', columnId: 'c1' }
  const unstamped = { ...base, element: { id: 'e1', type: 'text' as const, content: 'hi' } }
  const stamped = {
    ...base,
    element: {
      id: 'e1', type: 'text' as const, content: 'hi',
      stampedAt: '2026-07-23T23:30:00.000Z', stampedTz: 'UTC',
    },
  }

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ stampedAt: '2026-07-23T23:30:00.000Z', stampedTz: 'UTC' }),
    })) as any)
  })

  it('shows Stamp when the element is unstamped', () => {
    render(<ElementRow row={unstamped} expanded displayId="d1" onToggle={() => {}} onChange={() => {}} onDelete={() => {}} isPro={false} />)
    expect(screen.getByRole('button', { name: /^stamp$/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /remove stamp/i })).not.toBeInTheDocument()
  })

  it('shows the value, Re-stamp and Remove when stamped', () => {
    render(<ElementRow row={stamped} expanded displayId="d1" onToggle={() => {}} onChange={() => {}} onDelete={() => {}} isPro={false} />)
    expect(screen.getByRole('time')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /re-stamp/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /remove stamp/i })).toBeInTheDocument()
  })

  it('applies the SERVER response via onChange rather than a locally-made time', async () => {
    const onChange = vi.fn()
    render(<ElementRow row={unstamped} expanded displayId="d1" onToggle={() => {}} onChange={onChange} onDelete={() => {}} isPro={false} />)
    fireEvent.click(screen.getByRole('button', { name: /^stamp$/i }))
    await waitFor(() => expect(onChange).toHaveBeenCalledWith({
      stampedAt: '2026-07-23T23:30:00.000Z', stampedTz: 'UTC',
    }))
  })

  it('applies nothing when the request fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, json: async () => ({}) })) as any)
    const onChange = vi.fn()
    render(<ElementRow row={unstamped} expanded displayId="d1" onToggle={() => {}} onChange={onChange} onDelete={() => {}} isPro={false} />)
    fireEvent.click(screen.getByRole('button', { name: /^stamp$/i }))
    await waitFor(() => expect(screen.getByRole('button', { name: /^stamp$/i })).toBeEnabled())
    expect(onChange).not.toHaveBeenCalled()
  })

  it('applies nothing when the request rejects outright', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('network') }) as any)
    const onChange = vi.fn()
    render(<ElementRow row={unstamped} expanded displayId="d1" onToggle={() => {}} onChange={onChange} onDelete={() => {}} isPro={false} />)
    fireEvent.click(screen.getByRole('button', { name: /^stamp$/i }))
    await waitFor(() => expect(screen.getByRole('button', { name: /^stamp$/i })).toBeEnabled())
    expect(onChange).not.toHaveBeenCalled()
  })

  it('clears both fields on Remove', async () => {
    const onChange = vi.fn()
    render(<ElementRow row={stamped} expanded displayId="d1" onToggle={() => {}} onChange={onChange} onDelete={() => {}} isPro={false} />)
    fireEvent.click(screen.getByRole('button', { name: /remove stamp/i }))
    await waitFor(() => expect(onChange).toHaveBeenCalledWith({
      stampedAt: undefined, stampedTz: undefined,
    }))
  })

  // The control must not depend on the inspector registry. 'text' falls back to
  // DefaultInspector; 'image' has a custom ImageInspector.
  it('renders for a type WITHOUT a custom inspector', () => {
    render(<ElementRow row={unstamped} expanded displayId="d1" onToggle={() => {}} onChange={() => {}} onDelete={() => {}} isPro={false} />)
    expect(screen.getByRole('button', { name: /^stamp$/i })).toBeInTheDocument()
  })

  it('renders for a type WITH a custom inspector', () => {
    const imageRow = { ...base, element: { id: 'e9', type: 'image' as const, url: 'https://x/a.jpg' } }
    render(<ElementRow row={imageRow} expanded displayId="d1" onToggle={() => {}} onChange={() => {}} onDelete={() => {}} isPro={false} />)
    expect(screen.getByRole('button', { name: /^stamp$/i })).toBeInTheDocument()
  })
})
```

Update the imports at the top of that file to:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
```

The 3 pre-existing tests each need `displayId="d1"` added to their `<ElementRow ... />`, since the prop is required. Change nothing else about them.

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run src/components/editor/panel/ElementRow.test.tsx`
Expected: FAIL — no Stamp button.

- [ ] **Step 3: Implement the control**

In `src/components/editor/panel/ElementRow.tsx`:

1. Replace the imports at the top with:

```tsx
'use client'

import { useRef, useEffect, useState } from 'react'
import { ChevronDown, Trash2, Clock } from 'lucide-react'
import type { CanvasElement } from '@/lib/types/canvas'
import type { ElementListRow } from '@/lib/editor/element-list'
import { elementRowLabel } from '@/lib/editor/element-list'
import { getInspector } from './inspectors/registry'
import { ElementStamp } from '@/components/elements/ElementStamp'
```

2. Add `displayId` to the props interface and the destructuring:

```tsx
interface ElementRowProps {
  row: ElementListRow
  expanded: boolean
  displayId: string
  onToggle: () => void
  onChange: (updates: Partial<CanvasElement>) => void
  onDelete: () => void
  isPro: boolean
}

export function ElementRow({ row, expanded, displayId, onToggle, onChange, onDelete, isPro }: ElementRowProps) {
```

3. Inside the component, after `const Inspector = getInspector(row.element.type)`:

```tsx
  const [busy, setBusy] = useState(false)
  const el = row.element
  const stampUrl = `/api/displays/${displayId}/elements/${el.id}/stamp`

  // The instant is never invented here — we send only the viewer's zone as a
  // display hint and apply whatever the server wrote back.
  async function stamp() {
    setBusy(true)
    try {
      const res = await fetch(stampUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tz: Intl.DateTimeFormat().resolvedOptions().timeZone }),
      })
      if (res.ok) onChange(await res.json())
    } catch {
      // Leave the element unstamped; the button re-enables for a retry.
    } finally {
      setBusy(false)
    }
  }

  async function removeStamp() {
    setBusy(true)
    try {
      const res = await fetch(stampUrl, { method: 'DELETE' })
      if (res.ok) onChange({ stampedAt: undefined, stampedTz: undefined })
    } catch {
      // Leave the stamp in place; the button re-enables for a retry.
    } finally {
      setBusy(false)
    }
  }
```

4. Replace the expanded block (currently `{expanded && (<div className="pb-2"><Inspector … /></div>)}`) with:

```tsx
      {expanded && (
        <div className="pb-2">
          <Inspector element={row.element} onChange={onChange} isPro={isPro} />

          {/* Applies to every element type, so it lives here rather than in any
              inspector — most types fall back to DefaultInspector and would
              otherwise never get it. */}
          <div className="mt-2 border-t border-border px-3 pt-3">
            {el.stampedAt ? (
              <div className="flex items-center justify-between gap-2">
                <ElementStamp stampedAt={el.stampedAt} stampedTz={el.stampedTz} />
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={stamp}
                    disabled={busy}
                    className="text-xs font-medium text-primary hover:underline disabled:opacity-50"
                  >
                    Re-stamp
                  </button>
                  <button
                    type="button"
                    onClick={removeStamp}
                    disabled={busy}
                    aria-label="Remove stamp"
                    className="text-xs text-muted-foreground hover:text-destructive disabled:opacity-50"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={stamp}
                disabled={busy}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-50"
              >
                <Clock className="h-3.5 w-3.5" /> Stamp
              </button>
            )}
          </div>
        </div>
      )}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm exec vitest run src/components/editor/panel/ElementRow.test.tsx`
Expected: PASS — 11 tests (3 pre-existing plus 8 new).

Note: the Remove button's accessible name is `Remove stamp` via `aria-label` even though it reads "Remove", so it cannot collide with the row's Delete button.

- [ ] **Step 5: Pass `displayId` from every caller**

Run: `pnpm exec tsc --noEmit`

This will fail where `ElementRow` is used without the new required prop. Find each call site:

```bash
grep -rn "<ElementRow" src --include=*.tsx
```

Add `displayId={displayId}` to each. If a parent does not already have `displayId` in scope, thread it down from its own props rather than reaching for context — `ColumnCanvas` already receives a `displayId` prop, so the value exists nearby.

Re-run `pnpm exec tsc --noEmit` until it exits 0.

- [ ] **Step 6: Run the whole panel suite**

Run: `pnpm exec vitest run src/components/editor`
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add src/components/editor/panel/ElementRow.tsx src/components/editor/panel/ElementRow.test.tsx
git commit -m "feat(stamp): Stamp / Re-stamp / Remove control in ElementRow"
```

---

### Task 6: Full verification and browser smoke test

**Files:** none changed unless a defect is found.

- [ ] **Step 1: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: exit 0.

- [ ] **Step 2: Full suite**

Run: `export $(grep -E '^JWT_SECRET=' .env | tr -d '"'); pnpm exec vitest run`
Expected: exactly ONE failure — the pre-existing `src/app/api/messages/upload/route.test.ts > 400 when the file is not audio`. Report exact counts. Any other failure is a regression from this branch.

- [ ] **Step 3: Smoke-test in a real browser**

Start the dev server from this worktree on a free port, log in, and open a page in the editor.

Verify, in order:
1. Expand an element row in the panel — a **Stamp** button appears beneath the inspector.
2. Click it. The row now shows a formatted date and time, plus **Re-stamp** and **Remove**.
3. Confirm the value was persisted server-side, not just in local state — reload the editor and check the stamp is still there.
4. View the page publicly. The stamp renders beneath the element, muted.
5. Click **Re-stamp**. The value changes to a later time.
6. Click **Remove**. The stamp disappears from the panel and from the public page.
7. Repeat steps 1–2 on an element of a DIFFERENT type — one with a custom inspector (`image`) and one without (`text`) — to confirm the control is type-independent in the real app, not just in tests.

Do not skip this in favour of the unit tests. The tests mock `fetch`, so they cannot catch a wrong URL, a serialisation problem in the `sections` JSON round-trip, or a hydration mismatch in `ElementStamp` — and a hydration mismatch will only ever appear in a real server-rendered page.

- [ ] **Step 4: Confirm no stray fixtures**

If any test page or element was created for the smoke test, remove it. The dev database is shared with other agent sessions — see `COORDINATION.md`.

## Done when

- Stamping an element writes the server's time; nothing the browser sends can change the recorded instant.
- A collaborator, not only the owner, can stamp; an unrelated user gets `404`.
- The stamp shows beneath the element on the public page for any element type.
- The displayed date is the author's local time and does not shift by viewer.
- Re-stamp overwrites; Remove clears both fields.
- `pnpm exec tsc --noEmit` exits 0 and the suite shows only the known pre-existing failure.
