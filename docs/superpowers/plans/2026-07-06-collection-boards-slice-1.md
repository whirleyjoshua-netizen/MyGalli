# Collection Boards — Slice 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship "boards" — a Pro-gated `Display` that groups the owner's pages and publishes them as a gallery of linked page-cards.

**Architecture:** A board is a `Display` with `kind:'collection'`. Membership lives in one new `CollectionMember` join table. The gallery is a new `collection-view` canvas element auto-seeded on board creation; it reuses the whole editor, publishing, public route, analytics, and sharing. Only `published` members show publicly, in manual `position` order.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Prisma + PostgreSQL, Zustand, Tailwind, Vitest.

## Global Constraints

- Prisma migrations are **non-interactive** here: never `prisma migrate dev`. Generate SQL via `prisma migrate diff --from-url $DATABASE_URL --to-schema-datamodel prisma/schema.prisma --script` → write to `prisma/migrations/<ts>_<name>/migration.sql` → `prisma migrate deploy`.
- The machine `DATABASE_URL` overrides `.env` and points at the wrong DB. **Prefix every DB command** with `DATABASE_URL="postgresql://pages:pages@127.0.0.1:5434/pages"` (use `127.0.0.1`, NOT `localhost`).
- Adding an element type follows the documented checklist: `ElementType` union + fields (`canvas.ts`) → `createElement()` default → editor + `Public*` component pair → `ColumnCanvas` switch → `elements/index.ts` → `render-elements.tsx` case. **The slash menu is intentionally skipped** — `collection-view` is board-scoped and auto-seeded, not user-insertable.
- Pro gate = `isPro(user)` from `src/lib/plan.ts`. Free user hitting a Pro write → HTTP 403 `{ error: 'Pro required' }`.
- Ownership pattern (IDOR-safe): load the board with `db.display.findUnique({ where:{id}, select:{userId,kind} })`, then require `board.kind === 'collection'` and `board.userId === me.id` before any write.
- Test runner is Vitest. Run a single file with `pnpm exec vitest run <path>`.
- Never commit: `Documents/`, `Images/`, `g1t.json`, `nul`, `.claude/settings.local.json`.

---

### Task 1: Data model — `CollectionMember` table + `Display` relations

**Files:**
- Modify: `prisma/schema.prisma` (Display model ~line 71-136; add new model after `DisplayCollaborator`)
- Create: `prisma/migrations/<timestamp>_add_collection_member/migration.sql`

**Interfaces:**
- Produces: Prisma model `CollectionMember { id, collectionId, memberId, position, createdAt }` with `@@unique([collectionId, memberId])`; `Display.collectionMembers` and `Display.memberOf` back-relations.

- [ ] **Step 1: Add the two back-relations to `Display`**

In `prisma/schema.prisma`, inside `model Display { ... }`, immediately after the `collaborators DisplayCollaborator[]` line (currently line 127), add:

```prisma
  collectionMembers CollectionMember[] @relation("CollectionMembers")
  memberOf          CollectionMember[] @relation("MemberOfCollections")
```

- [ ] **Step 2: Add the `CollectionMember` model**

In `prisma/schema.prisma`, after the closing `}` of `model DisplayCollaborator` (line 151), add:

```prisma
model CollectionMember {
  id           String   @id @default(cuid())
  collectionId String   // the board Display (kind:'collection')
  memberId     String   // a member Display (kind:'page')
  position     Int      @default(0)
  createdAt    DateTime @default(now())
  collection   Display  @relation("CollectionMembers", fields: [collectionId], references: [id], onDelete: Cascade)
  member       Display  @relation("MemberOfCollections", fields: [memberId], references: [id], onDelete: Cascade)

  @@unique([collectionId, memberId])
  @@index([collectionId])
  @@index([memberId])
}
```

- [ ] **Step 3: Generate the migration SQL**

Run:
```bash
mkdir -p "prisma/migrations/$(node -e "process.stdout.write(new Date().toISOString().replace(/\D/g,'').slice(0,14))")_add_collection_member"
DATABASE_URL="postgresql://pages:pages@127.0.0.1:5434/pages" npx prisma migrate diff \
  --from-url "postgresql://pages:pages@127.0.0.1:5434/pages" \
  --to-schema-datamodel prisma/schema.prisma --script
```
Copy the printed SQL into the new folder's `migration.sql`. Expected SQL: a `CREATE TABLE "CollectionMember"` with the unique index and two FKs (`ON DELETE CASCADE`), plus the two indexes.

- [ ] **Step 4: Apply the migration + regenerate client**

Run:
```bash
DATABASE_URL="postgresql://pages:pages@127.0.0.1:5434/pages" npx prisma migrate deploy
DATABASE_URL="postgresql://pages:pages@127.0.0.1:5434/pages" npx prisma generate
```
Expected: "All migrations have been successfully applied." (If `prisma generate` EPERMs on Windows because dev holds the engine, stop dev and retry — non-blocking.)

- [ ] **Step 5: Verify the schema is in sync**

Run:
```bash
DATABASE_URL="postgresql://pages:pages@127.0.0.1:5434/pages" npx prisma migrate diff \
  --from-url "postgresql://pages:pages@127.0.0.1:5434/pages" \
  --to-schema-datamodel prisma/schema.prisma --script
```
Expected: `-- This is an empty migration.` (no diff).

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(collections): add CollectionMember join table"
```

---

### Task 2: Pure membership helpers + tests

**Files:**
- Create: `src/lib/collections.ts`
- Test: `src/lib/collections.test.ts`

**Interfaces:**
- Consumes: `CollectionMemberCard` type (defined here, re-exported into `canvas.ts` in Task 3).
- Produces:
  - `interface CollectionMemberCard { id: string; username: string; slug: string; title: string; description: string | null; coverImage: string | null; category: string | null }`
  - `interface MemberRow { memberId: string; position: number; member: { published: boolean; slug: string; title: string; description: string | null; coverImage: string | null; category: string | null; user: { username: string } } }`
  - `selectVisibleMembers(rows: MemberRow[]): CollectionMemberCard[]` — keeps only `published`, sorts by `position` asc, maps to cards.
  - `computePositions(order: string[]): { memberId: string; position: number }[]` — index → position.

- [ ] **Step 1: Write the failing test**

Create `src/lib/collections.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { selectVisibleMembers, computePositions, type MemberRow } from './collections'

function row(memberId: string, position: number, published: boolean): MemberRow {
  return {
    memberId,
    position,
    member: {
      published,
      slug: `${memberId}-slug`,
      title: `${memberId} title`,
      description: null,
      coverImage: null,
      category: null,
      user: { username: 'coach' },
    },
  }
}

describe('selectVisibleMembers', () => {
  it('drops unpublished members and sorts by position', () => {
    const rows = [row('b', 1, true), row('a', 0, true), row('c', 2, false)]
    const cards = selectVisibleMembers(rows)
    expect(cards.map((c) => c.id)).toEqual(['a', 'b'])
    expect(cards[0]).toMatchObject({ username: 'coach', slug: 'a-slug', title: 'a title' })
  })

  it('returns [] for empty input', () => {
    expect(selectVisibleMembers([])).toEqual([])
  })
})

describe('computePositions', () => {
  it('assigns 0-based positions in order', () => {
    expect(computePositions(['x', 'y', 'z'])).toEqual([
      { memberId: 'x', position: 0 },
      { memberId: 'y', position: 1 },
      { memberId: 'z', position: 2 },
    ])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/lib/collections.test.ts`
Expected: FAIL — cannot resolve `./collections`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/collections.ts`:
```ts
// Pure helpers for Collection Boards. No IO — unit-testable. The Prisma fetch
// that produces MemberRow lives in the public page loader and the members API.

export interface CollectionMemberCard {
  id: string
  username: string
  slug: string
  title: string
  description: string | null
  coverImage: string | null
  category: string | null
}

export interface MemberRow {
  memberId: string
  position: number
  member: {
    published: boolean
    slug: string
    title: string
    description: string | null
    coverImage: string | null
    category: string | null
    user: { username: string }
  }
}

// Public-page view: only published members, in manual (position) order.
export function selectVisibleMembers(rows: MemberRow[]): CollectionMemberCard[] {
  return rows
    .filter((r) => r.member.published)
    .sort((a, b) => a.position - b.position)
    .map((r) => ({
      id: r.memberId,
      username: r.member.user.username,
      slug: r.member.slug,
      title: r.member.title,
      description: r.member.description,
      coverImage: r.member.coverImage,
      category: r.member.category,
    }))
}

// Map an ordered list of memberIds to 0-based position updates.
export function computePositions(order: string[]): { memberId: string; position: number }[] {
  return order.map((memberId, position) => ({ memberId, position }))
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/lib/collections.test.ts`
Expected: PASS (4 assertions).

- [ ] **Step 5: Commit**

```bash
git add src/lib/collections.ts src/lib/collections.test.ts
git commit -m "feat(collections): pure member-selection + ordering helpers"
```

---

### Task 3: Element type plumbing — `canvas.ts`

**Files:**
- Modify: `src/lib/types/canvas.ts` (ElementType union ~line 113; CanvasElement fields ~line 528-535; createElement ~line 1118-1128)
- Test: `src/lib/types/canvas.collection.test.ts`

**Interfaces:**
- Consumes: `CollectionMemberCard` from `src/lib/collections.ts`.
- Produces: `'collection-view'` in `ElementType`; `CanvasElement` fields `collectionViewType?`, `collectionColumns?`, `collectionShowCategory?`, `collectionShowDescription?`, and transient `collectionMembers?: CollectionMemberCard[]`; `createElement('collection-view')` default.

- [ ] **Step 1: Write the failing test**

Create `src/lib/types/canvas.collection.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { createElement } from './canvas'

describe("createElement('collection-view')", () => {
  it('returns gallery defaults', () => {
    const el = createElement('collection-view')
    expect(el.type).toBe('collection-view')
    expect(el.collectionViewType).toBe('gallery')
    expect(el.collectionColumns).toBe(3)
    expect(el.collectionShowCategory).toBe(true)
    expect(el.collectionShowDescription).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/lib/types/canvas.collection.test.ts`
Expected: FAIL — `collectionViewType` is `undefined` (and TS error on the string literal until the union is updated).

- [ ] **Step 3: Add the union member**

In `src/lib/types/canvas.ts`, in the `ElementType` union after the `'map'` entry (line 113), add:
```ts
  // Collection Boards
  | 'collection-view'       // Gallery of a board's member pages
```

- [ ] **Step 4: Add the import + CanvasElement fields**

At the top of `src/lib/types/canvas.ts`, after the existing `import type { CSSProperties } from 'react'` (line 2), add:
```ts
import type { CollectionMemberCard } from '@/lib/collections'
```
Then inside `interface CanvasElement`, immediately after the Map element block (after `mapFitView?: boolean`, line 535), add:
```ts
  // Collection View (board gallery)
  collectionViewType?: 'gallery'          // slice-1 only; seam for later views
  collectionColumns?: 2 | 3 | 4
  collectionShowCategory?: boolean
  collectionShowDescription?: boolean
  collectionMembers?: CollectionMemberCard[]  // transient: hydrated at render, never persisted
```

- [ ] **Step 5: Add the `createElement` case**

In `src/lib/types/canvas.ts`, in the `createElement` switch, after the `case 'map':` block (ends line 1128) and before `default:`, add:
```ts
    case 'collection-view':
      return {
        ...base,
        collectionViewType: 'gallery',
        collectionColumns: 3,
        collectionShowCategory: true,
        collectionShowDescription: false,
      }
```

- [ ] **Step 6: Run test to verify it passes**

Run: `pnpm exec vitest run src/lib/types/canvas.collection.test.ts`
Expected: PASS.

- [ ] **Step 7: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add src/lib/types/canvas.ts src/lib/types/canvas.collection.test.ts
git commit -m "feat(collections): add collection-view element type + defaults"
```

---

### Task 4: Public gallery component + renderer wiring + tests

**Files:**
- Create: `src/components/elements/PublicCollectionView.tsx`
- Test: `src/components/elements/PublicCollectionView.test.tsx`
- Modify: `src/components/elements/index.ts` (append after the Batch 1 exports, line 84)
- Modify: `src/lib/render-elements.tsx` (import ~line 41; switch case ~line 501)

**Interfaces:**
- Consumes: `CanvasElement.collectionMembers` (Task 3), `CollectionMemberCard` (Task 2).
- Produces: `PublicCollectionView({ element }: { element: CanvasElement })`.

- [ ] **Step 1: Write the failing test**

Create `src/components/elements/PublicCollectionView.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PublicCollectionView } from './PublicCollectionView'
import type { CanvasElement } from '@/lib/types/canvas'

const base: CanvasElement = { id: 'e1', type: 'collection-view', collectionColumns: 3 }

describe('PublicCollectionView', () => {
  it('renders a card per member linking to its page', () => {
    const element: CanvasElement = {
      ...base,
      collectionMembers: [
        { id: 'm1', username: 'coach', slug: 'josh', title: 'Josh Smith', description: 'CB', coverImage: null, category: 'sports' },
        { id: 'm2', username: 'coach', slug: 'ava', title: 'Ava Lee', description: null, coverImage: null, category: null },
      ],
    }
    render(<PublicCollectionView element={element} />)
    expect(screen.getByText('Josh Smith')).toBeInTheDocument()
    expect(screen.getByText('Ava Lee')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Josh Smith/ })).toHaveAttribute('href', '/coach/josh')
  })

  it('renders an empty state when there are no members', () => {
    render(<PublicCollectionView element={{ ...base, collectionMembers: [] }} />)
    expect(screen.getByText(/no pages yet/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/components/elements/PublicCollectionView.test.tsx`
Expected: FAIL — cannot resolve `./PublicCollectionView`.

- [ ] **Step 3: Write the component**

Create `src/components/elements/PublicCollectionView.tsx`:
```tsx
import Link from 'next/link'
import type { CanvasElement } from '@/lib/types/canvas'

const COLS: Record<number, string> = {
  2: 'grid-cols-1 sm:grid-cols-2',
  3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
  4: 'grid-cols-2 lg:grid-cols-4',
}

export function PublicCollectionView({ element }: { element: CanvasElement }) {
  const members = element.collectionMembers || []
  const cols = COLS[element.collectionColumns || 3] || COLS[3]

  if (members.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
        No pages yet
      </div>
    )
  }

  return (
    <div className={`grid ${cols} gap-4`}>
      {members.map((m) => (
        <Link
          key={m.id}
          href={`/${m.username}/${m.slug}`}
          className="group block h-56 rounded-xl border border-border/50 overflow-hidden shadow-sm hover:shadow-md hover:border-galli/30 transition-all"
        >
          <div className="relative h-full w-full bg-gradient-to-br from-galli/15 via-galli-aqua/8 to-transparent">
            {m.coverImage && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={m.coverImage} alt="" className="absolute inset-0 h-full w-full object-cover group-hover:scale-105 transition-transform duration-300" />
            )}
            <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
            {element.collectionShowCategory && m.category && (
              <span className="absolute top-2 left-2 rounded-full bg-black/50 px-2 py-0.5 text-xs text-white backdrop-blur-sm capitalize">
                {m.category}
              </span>
            )}
            <div className="absolute inset-x-0 bottom-0 p-3">
              <h3 className="truncate text-base font-semibold text-white drop-shadow">{m.title}</h3>
              {element.collectionShowDescription && m.description && (
                <p className="mt-1 line-clamp-2 text-sm text-white/80 drop-shadow">{m.description}</p>
              )}
            </div>
          </div>
        </Link>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/components/elements/PublicCollectionView.test.tsx`
Expected: PASS.

- [ ] **Step 5: Wire the barrel export**

In `src/components/elements/index.ts`, at the end of the file (after line 84), add:
```ts
// Collection Boards
export { PublicCollectionView } from './PublicCollectionView'
export { CollectionViewElement } from './CollectionViewElement'
```
(The `CollectionViewElement` file is created in Task 5; the export compiles once Task 5 lands. If running tasks strictly in order, add only the `PublicCollectionView` line here and add the `CollectionViewElement` line in Task 5 Step 6.)

- [ ] **Step 6: Wire the public renderer**

In `src/lib/render-elements.tsx`, after the `import { PublicTipJarElement } ...` line (line 41), add:
```ts
import { PublicCollectionView } from '@/components/elements/PublicCollectionView'
```
Then in the `renderElement` switch, after the `case 'tip-jar':` block (line 500-501), add:
```tsx
    case 'collection-view':
      return <PublicCollectionView element={element} />
```

- [ ] **Step 7: Typecheck + commit**

Run: `pnpm exec tsc --noEmit`  → no errors.
```bash
git add src/components/elements/PublicCollectionView.tsx src/components/elements/PublicCollectionView.test.tsx src/components/elements/index.ts src/lib/render-elements.tsx
git commit -m "feat(collections): public collection-view gallery renderer"
```

---

### Task 5: Members API route

**Files:**
- Create: `src/app/api/collections/[id]/members/route.ts`
- Test: `src/app/api/collections/[id]/members/route.test.ts`

**Interfaces:**
- Consumes: `getUser` (`@/lib/auth`), `db` (`@/lib/db`), `isPro` (`@/lib/plan`), `computePositions` (`@/lib/collections`).
- Produces HTTP:
  - `GET  /api/collections/[id]/members` → `{ isOwner: boolean, members: { memberId, position, published, slug, title, coverImage, username }[] }` (ordered by position).
  - `POST` body `{ memberId }` → adds member at end; 400 if member not owned / not a `page`; 409 if duplicate.
  - `DELETE` body `{ memberId }` → removes.
  - `PATCH` body `{ order: string[] }` → rewrites positions.
  - All writes: 401 no auth, 403 not Pro, 404 board missing, 403 not owner / not a collection.

- [ ] **Step 1: Write the failing test (authorization helper is inline; test the pure ordering it relies on is already covered — here we test route guards via a thin mock)**

Create `src/app/api/collections/[id]/members/route.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({ getUser: vi.fn() }))
vi.mock('@/lib/db', () => ({
  db: {
    display: { findUnique: vi.fn() },
    collectionMember: { findMany: vi.fn(), create: vi.fn(), deleteMany: vi.fn(), update: vi.fn() },
  },
}))

import { getUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { POST } from './route'

function req(body: unknown) {
  return new Request('http://localhost/api/collections/b1/members', {
    method: 'POST',
    body: JSON.stringify(body),
  }) as any
}
const ctx = { params: Promise.resolve({ id: 'b1' }) }

beforeEach(() => vi.clearAllMocks())

describe('POST members guards', () => {
  it('401 when unauthenticated', async () => {
    ;(getUser as any).mockResolvedValue(null)
    const res = await POST(req({ memberId: 'm1' }), ctx)
    expect(res.status).toBe(401)
  })

  it('403 when authenticated but not Pro', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'u1', plan: 'free' })
    const res = await POST(req({ memberId: 'm1' }), ctx)
    expect(res.status).toBe(403)
  })

  it('404 when the board does not exist', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'u1', plan: 'pro' })
    ;(db.display.findUnique as any).mockResolvedValueOnce(null)
    const res = await POST(req({ memberId: 'm1' }), ctx)
    expect(res.status).toBe(404)
  })

  it('403 when the board is owned by someone else', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'u1', plan: 'pro' })
    ;(db.display.findUnique as any).mockResolvedValueOnce({ userId: 'other', kind: 'collection' })
    const res = await POST(req({ memberId: 'm1' }), ctx)
    expect(res.status).toBe(403)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run "src/app/api/collections/[id]/members/route.test.ts"`
Expected: FAIL — cannot resolve `./route`.

- [ ] **Step 3: Write the route**

Create `src/app/api/collections/[id]/members/route.ts`:
```ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'
import { isPro } from '@/lib/plan'
import { computePositions } from '@/lib/collections'

type Ctx = { params: Promise<{ id: string }> }

// Load the board and enforce: exists, is a collection, owned by `me`, `me` is Pro.
// Returns a NextResponse to short-circuit, or null when authorized.
async function guard(request: NextRequest, id: string) {
  const me = await getUser(request)
  if (!me) return { res: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }), me: null }
  if (!isPro(me)) return { res: NextResponse.json({ error: 'Pro required' }, { status: 403 }), me: null }
  const board = await db.display.findUnique({ where: { id }, select: { userId: true, kind: true } })
  if (!board || board.kind !== 'collection') return { res: NextResponse.json({ error: 'Not found' }, { status: 404 }), me: null }
  if (board.userId !== me.id) return { res: NextResponse.json({ error: 'Not your board' }, { status: 403 }), me: null }
  return { res: null, me }
}

export async function GET(request: NextRequest, { params }: Ctx) {
  const { id } = await params
  const { res } = await guard(request, id)
  if (res) return res
  const rows = await db.collectionMember.findMany({
    where: { collectionId: id },
    orderBy: { position: 'asc' },
    select: {
      memberId: true,
      position: true,
      member: { select: { published: true, slug: true, title: true, coverImage: true, user: { select: { username: true } } } },
    },
  })
  return NextResponse.json({
    isOwner: true,
    members: rows.map((r) => ({
      memberId: r.memberId,
      position: r.position,
      published: r.member.published,
      slug: r.member.slug,
      title: r.member.title,
      coverImage: r.member.coverImage,
      username: r.member.user.username,
    })),
  })
}

export async function POST(request: NextRequest, { params }: Ctx) {
  const { id } = await params
  const { res, me } = await guard(request, id)
  if (res) return res
  const { memberId } = await request.json()
  if (!memberId) return NextResponse.json({ error: 'memberId required' }, { status: 400 })

  // The member must be one of the owner's own regular pages.
  const member = await db.display.findUnique({ where: { id: memberId }, select: { userId: true, kind: true } })
  if (!member || member.userId !== me!.id || member.kind !== 'page') {
    return NextResponse.json({ error: 'You can only add your own pages' }, { status: 400 })
  }

  const count = await db.collectionMember.count({ where: { collectionId: id } })
  try {
    await db.collectionMember.create({ data: { collectionId: id, memberId, position: count } })
  } catch {
    return NextResponse.json({ error: 'Already added' }, { status: 409 })
  }
  return NextResponse.json({ ok: true })
}

export async function DELETE(request: NextRequest, { params }: Ctx) {
  const { id } = await params
  const { res } = await guard(request, id)
  if (res) return res
  const { memberId } = await request.json()
  if (!memberId) return NextResponse.json({ error: 'memberId required' }, { status: 400 })
  await db.collectionMember.deleteMany({ where: { collectionId: id, memberId } })
  return NextResponse.json({ ok: true })
}

export async function PATCH(request: NextRequest, { params }: Ctx) {
  const { id } = await params
  const { res } = await guard(request, id)
  if (res) return res
  const { order } = await request.json()
  if (!Array.isArray(order)) return NextResponse.json({ error: 'order must be an array' }, { status: 400 })
  const updates = computePositions(order as string[])
  await db.$transaction(
    updates.map((u) =>
      db.collectionMember.updateMany({
        where: { collectionId: id, memberId: u.memberId },
        data: { position: u.position },
      })
    )
  )
  return NextResponse.json({ ok: true })
}
```

Note: `db.$transaction` and `collectionMember.updateMany` are used here; the test in Step 1 only mocks `findUnique` for the guard branches (it never reaches the DB writes), so no extra mock wiring is required.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run "src/app/api/collections/[id]/members/route.test.ts"`
Expected: PASS (4 guard cases).

- [ ] **Step 5: Typecheck + commit**

Run: `pnpm exec tsc --noEmit` → no errors.
```bash
git add "src/app/api/collections"
git commit -m "feat(collections): members API (list/add/remove/reorder) with Pro+owner guards"
```

---

### Task 6: Editor component + Manage Members modal

**Files:**
- Create: `src/components/elements/CollectionViewElement.tsx`
- Create: `src/components/elements/CollectionMembersModal.tsx`
- Modify: `src/components/canvas/ColumnCanvas.tsx` (import block ~line 79; `renderElement` switch inside — add a `case 'collection-view'`)
- Modify: `src/components/elements/index.ts` (add `CollectionViewElement` export if not already added in Task 4 Step 5)

**Interfaces:**
- Consumes: `displayId` (the board id, already a `ColumnCanvas` prop, line 207), `CanvasElement`, members API (Task 5).
- Produces:
  - `CollectionViewElement({ element, displayId, isSelected, onSelect, onDelete, onChange })` where `onChange(updates: Partial<CanvasElement>)`.
  - `CollectionMembersModal({ boardId, isOpen, onClose, onChanged })`.

- [ ] **Step 1: Write the Manage Members modal**

Create `src/components/elements/CollectionMembersModal.tsx`:
```tsx
'use client'
import { useEffect, useState, useCallback } from 'react'
import { X, Plus, Check, GripVertical, Trash2 } from 'lucide-react'

interface MemberItem { memberId: string; position: number; published: boolean; slug: string; title: string; username: string }
interface OwnedPage { id: string; title: string; kind?: string }

export function CollectionMembersModal({
  boardId, isOpen, onClose, onChanged,
}: { boardId: string; isOpen: boolean; onClose: () => void; onChanged: () => void }) {
  const [members, setMembers] = useState<MemberItem[]>([])
  const [pages, setPages] = useState<OwnedPage[]>([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const [mRes, pRes] = await Promise.all([
      fetch(`/api/collections/${boardId}/members`),
      fetch('/api/displays'),
    ])
    if (mRes.ok) setMembers((await mRes.json()).members)
    if (pRes.ok) {
      const all: OwnedPage[] = await pRes.json()
      setPages(all.filter((d) => d.kind !== 'collection' && d.id !== boardId))
    }
    setLoading(false)
  }, [boardId])

  useEffect(() => { if (isOpen) load() }, [isOpen, load])

  if (!isOpen) return null
  const memberIds = new Set(members.map((m) => m.memberId))

  const add = async (memberId: string) => {
    await fetch(`/api/collections/${boardId}/members`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ memberId }),
    })
    await load(); onChanged()
  }
  const remove = async (memberId: string) => {
    await fetch(`/api/collections/${boardId}/members`, {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ memberId }),
    })
    await load(); onChanged()
  }
  const move = async (from: number, to: number) => {
    if (to < 0 || to >= members.length) return
    const order = members.map((m) => m.memberId)
    const [x] = order.splice(from, 1); order.splice(to, 0, x)
    setMembers((cur) => { const c = [...cur]; const [y] = c.splice(from, 1); c.splice(to, 0, y); return c })
    await fetch(`/api/collections/${boardId}/members`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ order }),
    })
    onChanged()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h2 className="text-base font-semibold">Manage board pages</h2>
          <button aria-label="Close" onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto p-5 space-y-6">
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">In this board ({members.length})</h3>
            {members.length === 0 && <p className="text-sm text-muted-foreground">No pages yet. Add some below.</p>}
            <ul className="space-y-1">
              {members.map((m, i) => (
                <li key={m.memberId} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2">
                  <div className="flex flex-col">
                    <button aria-label="Move up" onClick={() => move(i, i - 1)} className="text-muted-foreground hover:text-foreground disabled:opacity-30" disabled={i === 0}>▲</button>
                    <button aria-label="Move down" onClick={() => move(i, i + 1)} className="text-muted-foreground hover:text-foreground disabled:opacity-30" disabled={i === members.length - 1}>▼</button>
                  </div>
                  <GripVertical className="h-4 w-4 text-muted-foreground" />
                  <span className="flex-1 truncate text-sm">{m.title}</span>
                  {!m.published && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">draft — hidden</span>}
                  <button aria-label="Remove" onClick={() => remove(m.memberId)} className="text-muted-foreground hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                </li>
              ))}
            </ul>
          </section>
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Your pages</h3>
            {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
            <ul className="space-y-1">
              {pages.map((p) => {
                const added = memberIds.has(p.id)
                return (
                  <li key={p.id} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2">
                    <span className="flex-1 truncate text-sm">{p.title}</span>
                    <button
                      onClick={() => (added ? remove(p.id) : add(p.id))}
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${added ? 'bg-galli/15 text-green-700' : 'bg-primary/10 text-primary hover:bg-primary/20'}`}
                    >
                      {added ? <><Check className="h-3 w-3" /> Added</> : <><Plus className="h-3 w-3" /> Add</>}
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>
        </div>
        <div className="flex justify-end border-t border-border px-5 py-3">
          <button onClick={onClose} className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-white hover:brightness-110">Done</button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Write the editor element**

Create `src/components/elements/CollectionViewElement.tsx`:
```tsx
'use client'
import { useEffect, useState, useCallback } from 'react'
import { LayoutGrid, Settings2, Trash2 } from 'lucide-react'
import type { CanvasElement, CollectionMemberCard } from '@/lib/types/canvas'
import { PublicCollectionView } from './PublicCollectionView'
import { CollectionMembersModal } from './CollectionMembersModal'

interface Props {
  element: CanvasElement
  displayId: string
  isSelected: boolean
  onSelect: () => void
  onDelete: () => void
  onChange: (updates: Partial<CanvasElement>) => void
}

export function CollectionViewElement({ element, displayId, isSelected, onSelect, onDelete, onChange }: Props) {
  const [modalOpen, setModalOpen] = useState(false)
  const [members, setMembers] = useState<CollectionMemberCard[]>([])

  const loadPreview = useCallback(async () => {
    if (!displayId) return
    const res = await fetch(`/api/collections/${displayId}/members`)
    if (!res.ok) return
    const data = await res.json()
    // Editor preview mirrors the public view: published members, in order.
    setMembers(
      (data.members as { memberId: string; published: boolean; slug: string; title: string; coverImage: string | null; username: string }[])
        .filter((m) => m.published)
        .map((m) => ({ id: m.memberId, username: m.username, slug: m.slug, title: m.title, description: null, coverImage: m.coverImage, category: null }))
    )
  }, [displayId])

  useEffect(() => { loadPreview() }, [loadPreview])

  const cols = element.collectionColumns || 3

  return (
    <div
      onClick={onSelect}
      className={`relative rounded-xl border-2 p-3 transition-colors ${isSelected ? 'border-primary' : 'border-transparent hover:border-border'}`}
    >
      <div className="mb-3 flex items-center gap-2">
        <LayoutGrid className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">Board gallery</span>
        <button onClick={(e) => { e.stopPropagation(); setModalOpen(true) }} className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/20">
          <Settings2 className="h-3 w-3" /> Manage pages
        </button>
        <div className="ml-auto flex items-center gap-1">
          {[2, 3, 4].map((c) => (
            <button key={c} onClick={(e) => { e.stopPropagation(); onChange({ collectionColumns: c as 2 | 3 | 4 }) }}
              className={`h-6 w-6 rounded text-xs ${cols === c ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'}`}>{c}</button>
          ))}
          <button aria-label="Delete" onClick={(e) => { e.stopPropagation(); onDelete() }} className="ml-1 text-muted-foreground hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
        </div>
      </div>

      <PublicCollectionView element={{ ...element, collectionMembers: members }} />

      <CollectionMembersModal boardId={displayId} isOpen={modalOpen} onClose={() => setModalOpen(false)} onChanged={loadPreview} />
    </div>
  )
}
```

- [ ] **Step 3: Wire the barrel export**

In `src/components/elements/index.ts`, ensure this line exists (add if not already added in Task 4 Step 5):
```ts
export { CollectionViewElement } from './CollectionViewElement'
```

- [ ] **Step 4: Wire the editor switch in `ColumnCanvas`**

In `src/components/canvas/ColumnCanvas.tsx`, add to the element imports near the Batch-1 imports (after `PublicGalleryElement,` on line 80), within the same import statement:
```ts
  CollectionViewElement,
```
Then in the `renderElement` switch (starts line 390), add a case alongside the other elements (e.g., after the `case 'tip-jar'` handling; place before `default`):
```tsx
      case 'collection-view':
        return (
          <CollectionViewElement
            {...commonProps}
            element={element}
            displayId={displayId || ''}
            onChange={(updates) => onUpdateElement(sectionId, columnId, element.id, updates)}
          />
        )
```
(`commonProps` supplies `isSelected`, `onSelect`, `onDelete`; `displayId` is the `ColumnCanvas` prop on line 207.)

- [ ] **Step 5: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/elements/CollectionViewElement.tsx src/components/elements/CollectionMembersModal.tsx src/components/elements/index.ts src/components/canvas/ColumnCanvas.tsx
git commit -m "feat(collections): editor gallery element + manage-members modal"
```

---

### Task 7: Extend `POST /api/displays` for `kind:'collection'`

**Files:**
- Modify: `src/app/api/displays/route.ts` (POST handler, lines 62-147)
- Test: `src/app/api/displays/collection-create.test.ts`

**Interfaces:**
- Consumes: `isPro`, `createElement` (add import), `getUser`, `db`.
- Produces: `POST /api/displays` accepts optional `kind`; when `kind==='collection'` requires Pro (403 for free), sets `kind:'collection'`, and seeds `sections` with one `collection-view` element.

- [ ] **Step 1: Write the failing test**

Create `src/app/api/displays/collection-create.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({ getUser: vi.fn() }))
vi.mock('@/lib/db', () => ({ db: { display: { findUnique: vi.fn(), create: vi.fn() } } }))

import { getUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { POST } from './route'

function req(body: unknown) {
  return new Request('http://localhost/api/displays', { method: 'POST', body: JSON.stringify(body) }) as any
}
beforeEach(() => { vi.clearAllMocks(); (db.display.findUnique as any).mockResolvedValue(null) })

describe('POST /api/displays kind=collection', () => {
  it('403 for a free user', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'u1', username: 'coach', plan: 'free' })
    const res = await POST(req({ title: 'Roster', kind: 'collection' }))
    expect(res.status).toBe(403)
  })

  it('creates a collection seeded with a collection-view element for a Pro user', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'u1', username: 'coach', name: 'Coach', plan: 'pro' })
    ;(db.display.create as any).mockImplementation(({ data }: any) => Promise.resolve({ id: 'b1', ...data }))
    const res = await POST(req({ title: 'Roster', kind: 'collection' }))
    expect(res.status).toBe(201)
    const created = (db.display.create as any).mock.calls[0][0].data
    expect(created.kind).toBe('collection')
    expect(created.sections[0].columns[0].elements[0].type).toBe('collection-view')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/app/api/displays/collection-create.test.ts`
Expected: FAIL — free user currently gets 201 (no gate); Pro path has no seeded element.

- [ ] **Step 3: Add imports**

In `src/app/api/displays/route.ts`, after `import { isPro } from '@/lib/plan'` (line 9), add:
```ts
import { createElement, createSection } from '@/lib/types/canvas'
```

- [ ] **Step 4: Read `kind` and gate/seed**

In the POST handler, change the destructure (line 70) from:
```ts
    const { title, description, kitId, templateId } = await request.json()
```
to:
```ts
    const { title, description, kitId, templateId, kind } = await request.json()
```
Then immediately after the `if (!title) { ... }` block (after line 77), add:
```ts
    // Boards are a Pro-only Display kind, seeded with a single gallery element.
    if (kind === 'collection' && !isPro(user)) {
      return NextResponse.json({ error: 'Pro required' }, { status: 403 })
    }
```
In the `db.display.create` call (line 126-137), add `kind` and seed sections for collections. Replace the `data` object with:
```ts
      data: {
        title,
        slug,
        description,
        userId: user.id,
        ...(kind === 'collection' ? { kind: 'collection' } : {}),
        sections:
          kind === 'collection'
            ? [(() => { const s = createSection('full-width'); s.columns[0].elements = [createElement('collection-view')]; return s })()]
            : kitData.sections || [],
        ...(kitData.tabs && { tabs: kitData.tabs }),
        ...(kitData.headerCard && { headerCard: kitData.headerCard }),
        ...(kitData.kitConfig && { kitConfig: kitData.kitConfig }),
      },
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm exec vitest run src/app/api/displays/collection-create.test.ts`
Expected: PASS (both cases).

- [ ] **Step 6: Typecheck + commit**

Run: `pnpm exec tsc --noEmit` → no errors.
```bash
git add src/app/api/displays/route.ts src/app/api/displays/collection-create.test.ts
git commit -m "feat(collections): create Pro board (kind=collection) seeded with gallery"
```

---

### Task 8: Public page hydration for boards

**Files:**
- Create: `src/lib/collections-hydrate.ts`
- Test: `src/lib/collections-hydrate.test.ts`
- Modify: `src/app/[username]/[slug]/page.tsx` (after sections parse, ~line 135)

**Interfaces:**
- Consumes: `selectVisibleMembers`, `MemberRow`, `CollectionMemberCard` (`@/lib/collections`), `Section` (`@/lib/types/canvas`).
- Produces: `hydrateCollectionElements(sections: Section[], members: CollectionMemberCard[]): void` — mutates every `collection-view` element in-place, setting `collectionMembers`.

- [ ] **Step 1: Write the failing test**

Create `src/lib/collections-hydrate.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { hydrateCollectionElements } from './collections-hydrate'
import type { Section } from '@/lib/types/canvas'
import type { CollectionMemberCard } from '@/lib/collections'

const cards: CollectionMemberCard[] = [
  { id: 'm1', username: 'coach', slug: 'a', title: 'A', description: null, coverImage: null, category: null },
]

function sectionsWith(type: string): Section[] {
  return [{ id: 's1', layout: 'full-width', columns: [{ id: 'c1', elements: [{ id: 'e1', type: type as any }] }] }]
}

describe('hydrateCollectionElements', () => {
  it('injects members into collection-view elements', () => {
    const sections = sectionsWith('collection-view')
    hydrateCollectionElements(sections, cards)
    expect(sections[0].columns[0].elements[0].collectionMembers).toEqual(cards)
  })

  it('leaves non-collection elements untouched', () => {
    const sections = sectionsWith('text')
    hydrateCollectionElements(sections, cards)
    expect(sections[0].columns[0].elements[0].collectionMembers).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/lib/collections-hydrate.test.ts`
Expected: FAIL — cannot resolve `./collections-hydrate`.

- [ ] **Step 3: Write the helper**

Create `src/lib/collections-hydrate.ts`:
```ts
import type { Section } from '@/lib/types/canvas'
import type { CollectionMemberCard } from '@/lib/collections'

// Mutates parsed sections in place, attaching the resolved member cards to every
// collection-view element so the shared renderElement() can draw the gallery.
export function hydrateCollectionElements(sections: Section[], members: CollectionMemberCard[]): void {
  for (const section of sections) {
    for (const column of section.columns) {
      for (const element of column.elements) {
        if (element.type === 'collection-view') {
          element.collectionMembers = members
        }
      }
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/lib/collections-hydrate.test.ts`
Expected: PASS.

- [ ] **Step 5: Wire the public page**

In `src/app/[username]/[slug]/page.tsx`, add imports after line 13 (`import { renderElement, ... }`):
```ts
import { selectVisibleMembers } from '@/lib/collections'
import { hydrateCollectionElements } from '@/lib/collections-hydrate'
```
Then, immediately after the `sections` are parsed (after line 135, the block ending `... as unknown as Section[]) || []`), add:
```ts
  // Boards: resolve member cards and inject into their gallery element(s).
  if (display.kind === 'collection') {
    const rows = await db.collectionMember.findMany({
      where: { collectionId: display.id },
      select: {
        memberId: true,
        position: true,
        member: {
          select: {
            published: true, slug: true, title: true, description: true, coverImage: true, category: true,
            user: { select: { username: true } },
          },
        },
      },
    })
    hydrateCollectionElements(sections, selectVisibleMembers(rows))
  }
```

- [ ] **Step 6: Typecheck + commit**

Run: `pnpm exec tsc --noEmit` → no errors.
```bash
git add src/lib/collections-hydrate.ts src/lib/collections-hydrate.test.ts "src/app/[username]/[slug]/page.tsx"
git commit -m "feat(collections): hydrate board gallery on the public page"
```

---

### Task 9: Dashboard "New Board" tile (Pro)

**Files:**
- Modify: `src/app/(dashboard)/dashboard/page.tsx` (create-tile area, lines 224-234; needs the create handler + router already in scope)

**Interfaces:**
- Consumes: `router` (already present, used at line 226), `user` (already fetched for the dashboard).
- Produces: a "New board" tile that POSTs `{ title:'Untitled Board', kind:'collection' }`; on success routes to `/editor?id=<id>`; on 403 routes to the upgrade CTA.

- [ ] **Step 1: Add the create handler**

In `src/app/(dashboard)/dashboard/page.tsx`, near the other `useCallback` handlers (e.g., beside `handleOpen`, line 81), add:
```tsx
  const createBoard = useCallback(async () => {
    const res = await fetch('/api/displays', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Untitled Board', kind: 'collection' }),
    })
    if (res.status === 403) { router.push('/enterprise'); return }
    if (!res.ok) return
    const board = await res.json()
    router.push(`/editor?id=${board.id}`)
  }, [router])
```
(`/enterprise` is the existing upgrade CTA stub used elsewhere for Pro gating.)

- [ ] **Step 2: Add the tile next to "Create new page"**

In the same file, immediately after the "Create new page" `<button>...</button>` (ends line 234), add:
```tsx
          {/* Create new board tile (Pro) */}
          <button
            onClick={createBoard}
            className="group shrink-0 w-60 snap-start rounded-2xl border-2 border-dashed border-border flex flex-col items-center justify-center gap-3 text-muted-foreground hover:border-galli-violet/40 hover:text-foreground hover:bg-galli-violet/[0.03] transition-all cursor-pointer"
            style={{ minHeight: 188 }}
          >
            <span className="w-11 h-11 rounded-full bg-galli-violet/10 flex items-center justify-center group-hover:bg-galli-violet/20 transition-colors">
              <LayoutGrid className="w-5 h-5 text-galli-violet" />
            </span>
            <span className="text-sm font-medium">New board</span>
            <span className="text-[10px] font-semibold uppercase tracking-wide text-galli-violet">Pro</span>
          </button>
```

- [ ] **Step 3: Add the icon import**

In `src/app/(dashboard)/dashboard/page.tsx`, add `LayoutGrid` to the existing `lucide-react` import (the one that imports `Plus`, `FileText`, etc.).

- [ ] **Step 4: Verify it builds/typechecks**

Run: `pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(dashboard)/dashboard/page.tsx"
git commit -m "feat(collections): New board tile on the dashboard (Pro)"
```

---

### Task 10: Explore/feed "Board" badge

**Files:**
- Modify: `src/components/explore/ExploreCard.tsx` (props ~line 17-31; badge logic ~line 49-71)
- Modify: `src/lib/explore.ts` (baseWhere select — ensure `kind` is returned)
- Test: none (cosmetic; covered by typecheck)

**Interfaces:**
- Consumes: `display.kind` on the ExploreCard `display` prop.
- Produces: a "Board" badge (icon `LayoutGrid`) shown when `display.kind === 'collection'`, overriding the kit badge.

- [ ] **Step 1: Confirm `kind` reaches the card**

Inspect `src/lib/explore.ts` and `src/app/api/explore/route.ts`: the `baseWhere` already filters `kind: { not: 'profile' }`. Ensure the `select`/returned display objects include `kind` (Prisma returns all scalar fields by default unless a `select` narrows them). If a `select` is present and omits `kind`, add `kind: true`.

- [ ] **Step 2: Add `kind` to the card props**

In `src/components/explore/ExploreCard.tsx`, add to the `display` prop type (after `createdAt: string`, line 23):
```ts
    kind?: string
```

- [ ] **Step 3: Show the Board badge**

In `ExploreCard`, replace the badge derivation (line 81) `const badge = getKitBadge(display.kitConfig)` with:
```ts
  const badge =
    display.kind === 'collection'
      ? { label: 'Board', icon: LayoutGrid, className: 'bg-galli-violet/15 text-violet-700 dark:text-violet-300 border border-galli-violet/20' }
      : getKitBadge(display.kitConfig)
```
And add `LayoutGrid` to the `lucide-react` import at the top (line 5).

- [ ] **Step 4: Typecheck + commit**

Run: `pnpm exec tsc --noEmit` → no errors.
```bash
git add src/components/explore/ExploreCard.tsx src/lib/explore.ts
git commit -m "feat(collections): Board badge on explore/feed cards"
```

---

### Task 11: Full verification + manual smoke

**Files:** none (verification only)

- [ ] **Step 1: Run the whole test suite**

Run: `pnpm test` (or `pnpm exec vitest run`)
Expected: all tests pass, including the new `collections`, `PublicCollectionView`, members-route, `collection-create`, and `collections-hydrate` tests.

- [ ] **Step 2: Typecheck the whole project**

Run: `pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Manual smoke (with a Pro user)**

Start dev (`DATABASE_URL="postgresql://pages:pages@127.0.0.1:5434/pages" pnpm dev`), set your user `plan='pro'` in the DB, then:
1. Dashboard → "New board" → lands in the editor on a `kind:'collection'` page with a Board gallery element.
2. "Manage pages" → add 3 of your own pages; unpublish one; reorder the other two.
3. Publish the board (PublishDialog requires a category).
4. Visit the public board URL → confirm exactly 2 published members show, in your chosen order, each card linking to its page.
5. Explore → confirm the board appears with a "Board" badge.
6. As a **free** user: "New board" → routes to the upgrade CTA (403), and the members API returns 403.

- [ ] **Step 4: Final commit (if any smoke fixes were needed)**

```bash
git add -A
git commit -m "fix(collections): smoke-test adjustments"
```

---

## Deferred to later slices (NOT in this plan)

- Slice 2 — custom property schema (`PropertyDef`) per member + property display on cards.
- Slice 3 — Leaderboard view type + rollups across members (generalize `element-aggregate.ts`).
- Slice 4 — Display↔Display relations.
- Later — data import/ingestion, live-capture-as-property, additional view types, drag-and-drop (vs. up/down reorder) in the members modal.
