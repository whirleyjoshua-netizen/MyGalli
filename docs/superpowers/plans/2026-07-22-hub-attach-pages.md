# Attach Pages to a Community Hub — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a community Hub member attach their own published Page; it queues as `pending` until an owner or mod approves it, then renders in a new **Pages** tab.

**Architecture:** A new `HubPage` join model with real FKs to `Hub`, `Display`, and `User`. Visibility is decided by one pure `where`-clause builder shared by the server page and the `GET` route, so the rule cannot drift between them. UI is a new tab plus two components, following the existing `HubFilesTab` / announcements patterns exactly.

**Tech Stack:** Next.js 15 App Router, Prisma + Postgres, Vitest + @testing-library/react, Tailwind.

## Global Constraints

- Work in worktree `/Users/jenniferjordan/joshwhirley/mg-hub-attach-pages` on branch `feat/hub-attach-pages`. **Never `git checkout` in `/Users/jenniferjordan/joshwhirley/MyGalli`** — other agent sessions are live there. See `COORDINATION.md`.
- Another session is editing `prisma/schema.prisma` on `feat/lead-gen-element`. Append the new model at the end of the file; do not reformat or reorder existing models.
- Postgres on `127.0.0.1:5434` is **shared** with other agents. Do not truncate tables, do not run `migrate reset`. Use uniquely-named fixtures.
- Status values are exactly `'pending' | 'approved' | 'rejected'` — matching the existing `HubDrop` convention.
- Route handler params are `Promise<{ ... }>` and must be awaited (Next 15).
- Run a single test file with `pnpm exec vitest run <path>`. Plain `pnpm test` ignores path arguments and runs everything.
- Baseline: `src/app/api/messages/upload/route.test.ts` has one known failure on this machine, unrelated to this work. "All green" means that one failure and nothing else.

## File Structure

| File | Responsibility |
|---|---|
| `prisma/schema.prisma` | `HubPage` model + three back-relations |
| `prisma/migrations/20260723000000_hub_page/migration.sql` | Table, indexes, FKs |
| `src/lib/hub-pages.ts` | DTO type, `toHubPageDTO`, `visibleHubPageWhere`. Pure — no Prisma calls, no auth |
| `src/app/api/hubs/[id]/pages/route.ts` | `GET` list, `POST` attach |
| `src/app/api/hubs/[id]/pages/[pageId]/route.ts` | `PATCH` review, `DELETE` detach |
| `src/components/hub/community/CommunityTabs.tsx` | Add `pages` tab |
| `src/components/hub/community/HubPagesTab.tsx` | Card grid + mod review queue |
| `src/components/hub/community/HubPageAttachModal.tsx` | Picker over the caller's own Pages |
| `src/components/hub/community/CommunityHubView.tsx` | Render the tab |
| `src/app/[username]/hub/[slug]/page.tsx` | Server fetch + pass down |

---

### Task 1: Schema and migration

**Files:**
- Modify: `prisma/schema.prisma` (append model; add back-relations to `Hub`, `Display`, `User`)
- Create: `prisma/migrations/20260723000000_hub_page/migration.sql`

**Interfaces:**
- Consumes: nothing
- Produces: Prisma client model `db.hubPage` with fields `id, hubId, displayId, addedById, status, reviewedAt, reviewedById, order, createdAt`

- [ ] **Step 1: Append the model to `prisma/schema.prisma`**

```prisma
model HubPage {
  id           String    @id @default(cuid())
  hubId        String
  hub          Hub       @relation(fields: [hubId], references: [id], onDelete: Cascade)
  displayId    String
  display      Display   @relation("HubPageDisplay", fields: [displayId], references: [id], onDelete: Cascade)
  addedById    String
  addedBy      User      @relation("HubPageAddedBy", fields: [addedById], references: [id], onDelete: Cascade)
  status       String    @default("pending")
  reviewedAt   DateTime?
  reviewedById String?
  order        Int       @default(0)
  createdAt    DateTime  @default(now())

  @@unique([hubId, displayId])
  @@index([hubId, status])
}
```

- [ ] **Step 2: Add the three back-relation fields**

In `model Hub`, beside the existing `announcements HubAnnouncement[]`:

```prisma
  hubPages    HubPage[]
```

In `model Display`, beside `collectionMembers`:

```prisma
  hubPages    HubPage[] @relation("HubPageDisplay")
```

In `model User`, beside the other hub relations:

```prisma
  hubPagesAdded HubPage[] @relation("HubPageAddedBy")
```

- [ ] **Step 3: Write the migration SQL**

Create `prisma/migrations/20260723000000_hub_page/migration.sql`:

```sql
-- Member-attached Pages on a community hub, moderated like HubDrop.
CREATE TABLE "HubPage" (
    "id" TEXT NOT NULL,
    "hubId" TEXT NOT NULL,
    "displayId" TEXT NOT NULL,
    "addedById" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HubPage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "HubPage_hubId_displayId_key" ON "HubPage"("hubId", "displayId");
CREATE INDEX "HubPage_hubId_status_idx" ON "HubPage"("hubId", "status");

ALTER TABLE "HubPage" ADD CONSTRAINT "HubPage_hubId_fkey"
    FOREIGN KEY ("hubId") REFERENCES "Hub"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "HubPage" ADD CONSTRAINT "HubPage_displayId_fkey"
    FOREIGN KEY ("displayId") REFERENCES "Display"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "HubPage" ADD CONSTRAINT "HubPage_addedById_fkey"
    FOREIGN KEY ("addedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

- [ ] **Step 4: Generate the client and verify the schema is valid**

Run: `pnpm exec prisma generate`
Expected: `Generated Prisma Client` with no validation errors. A relation error here means a back-relation in Step 2 was missed.

- [ ] **Step 5: Apply the migration to the shared dev database**

Run: `pnpm exec prisma migrate deploy`
Expected: `1 migration found` / `Applying migration 20260723000000_hub_page`. Do **not** use `migrate dev` or `migrate reset` — the database is shared.

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260723000000_hub_page
git commit -m "feat(hub): HubPage model for member-attached Pages"
```

---

### Task 2: `src/lib/hub-pages.ts`

**Files:**
- Create: `src/lib/hub-pages.ts`
- Test: `src/lib/hub-pages.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `type HubPageStatus = 'pending' | 'approved' | 'rejected'`
  - `type HubPageDTO = { id, displayId, title, slug, coverImage, ownerUsername, status, addedById, createdAt }`
  - `toHubPageDTO(row): HubPageDTO`
  - `visibleHubPageWhere({ hubId, viewerId, isPrivileged }): object`

- [ ] **Step 1: Write the failing test**

Create `src/lib/hub-pages.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { toHubPageDTO, visibleHubPageWhere } from './hub-pages'

const row = {
  id: 'hp1',
  displayId: 'd1',
  status: 'approved',
  addedById: 'u1',
  createdAt: new Date('2026-07-22T00:00:00Z'),
  display: { title: 'My Page', slug: 'my-page', coverImage: null, user: { username: 'jo' } },
}

describe('toHubPageDTO', () => {
  it('flattens the joined display and owner', () => {
    expect(toHubPageDTO(row)).toEqual({
      id: 'hp1',
      displayId: 'd1',
      title: 'My Page',
      slug: 'my-page',
      coverImage: null,
      ownerUsername: 'jo',
      status: 'approved',
      addedById: 'u1',
      createdAt: '2026-07-22T00:00:00.000Z',
    })
  })
})

describe('visibleHubPageWhere', () => {
  it('logged-out viewers see only approved rows whose Page is published', () => {
    expect(visibleHubPageWhere({ hubId: 'h1', viewerId: null, isPrivileged: false })).toEqual({
      hubId: 'h1',
      status: 'approved',
      display: { is: { published: true } },
    })
  })

  it('a plain member also sees their own rows in any status', () => {
    const w = visibleHubPageWhere({ hubId: 'h1', viewerId: 'u1', isPrivileged: false }) as any
    expect(w.hubId).toBe('h1')
    expect(w.OR).toEqual([
      { status: 'approved', display: { is: { published: true } } },
      { addedById: 'u1' },
    ])
  })

  it('a moderator also sees pending rows', () => {
    const w = visibleHubPageWhere({ hubId: 'h1', viewerId: 'mod', isPrivileged: true }) as any
    expect(w.OR).toContainEqual({ status: 'pending' })
  })

  it('never exposes another member rejected rows', () => {
    const w = visibleHubPageWhere({ hubId: 'h1', viewerId: 'mod', isPrivileged: true }) as any
    expect(w.OR).not.toContainEqual({ status: 'rejected' })
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run src/lib/hub-pages.test.ts`
Expected: FAIL — `Failed to resolve import "./hub-pages"`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/hub-pages.ts`:

```ts
export type HubPageStatus = 'pending' | 'approved' | 'rejected'

export type HubPageDTO = {
  id: string
  displayId: string
  title: string
  slug: string
  coverImage: string | null
  ownerUsername: string
  status: HubPageStatus
  addedById: string
  createdAt: string
}

export function toHubPageDTO(row: {
  id: string
  displayId: string
  status: string
  addedById: string
  createdAt: Date
  display: { title: string; slug: string; coverImage: string | null; user: { username: string } }
}): HubPageDTO {
  return {
    id: row.id,
    displayId: row.displayId,
    title: row.display.title,
    slug: row.display.slug,
    coverImage: row.display.coverImage,
    ownerUsername: row.display.user.username,
    status: row.status as HubPageStatus,
    addedById: row.addedById,
    createdAt: row.createdAt.toISOString(),
  }
}

/**
 * The single source of truth for who sees which attachment.
 *
 * Approved rows are public only while the underlying Page is still published —
 * unpublishing hides the card but keeps the row, so re-publishing restores it
 * without a second approval. A member always sees their own rows (so a pending
 * or rejected submission does not silently vanish); moderators additionally see
 * the pending queue. Rejected rows are never visible to anyone but their author.
 */
export function visibleHubPageWhere(input: {
  hubId: string
  viewerId: string | null
  isPrivileged: boolean
}) {
  const { hubId, viewerId, isPrivileged } = input
  const approved = { status: 'approved', display: { is: { published: true } } }
  if (!viewerId) return { hubId, ...approved }

  const or: Record<string, unknown>[] = [approved, { addedById: viewerId }]
  if (isPrivileged) or.push({ status: 'pending' })
  return { hubId, OR: or }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm exec vitest run src/lib/hub-pages.test.ts`
Expected: PASS — 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/hub-pages.ts src/lib/hub-pages.test.ts
git commit -m "feat(hub): hub-pages DTO and visibility where-builder"
```

---

### Task 3: `GET` and `POST /api/hubs/[id]/pages`

**Files:**
- Create: `src/app/api/hubs/[id]/pages/route.ts`
- Test: `src/app/api/hubs/[id]/pages/route.test.ts`

**Interfaces:**
- Consumes: `toHubPageDTO`, `visibleHubPageWhere` from Task 2; `db.hubPage` from Task 1
- Produces: `GET` → `{ pages: HubPageDTO[] }`; `POST` → `{ id, status }` with `201`

- [ ] **Step 1: Write the failing test**

Create `src/app/api/hubs/[id]/pages/route.test.ts`:

```ts
import { it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({ getUser: vi.fn() }))
vi.mock('@/lib/rate-limit', () => ({ rateLimit: vi.fn().mockResolvedValue(null) }))
vi.mock('@/lib/db', () => ({
  db: {
    hub: { findUnique: vi.fn() },
    hubCollaborator: { findMany: vi.fn(async () => []) },
    hubMember: { findUnique: vi.fn(async () => null) },
    display: { findUnique: vi.fn() },
    hubPage: { findMany: vi.fn(async () => []), create: vi.fn(async () => ({ id: 'hp1', status: 'pending' })) },
  },
}))

import { getUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { GET, POST } from './route'

const params = { params: Promise.resolve({ id: 'hub1' }) }
const req = (body?: any) => ({ json: async () => body, url: 'http://localhost/api/hubs/hub1/pages' } as any)
beforeEach(() => vi.clearAllMocks())

const hub = { id: 'hub1', userId: 'owner', community: true, published: true }
const ownedPage = { id: 'd1', userId: 'member', published: true, kind: 'page' }

it('GET 404 when the hub is not a community hub', async () => {
  ;(getUser as any).mockResolvedValue(null)
  ;(db.hub.findUnique as any).mockResolvedValue({ ...hub, community: false })
  expect((await GET(req(), params)).status).toBe(404)
})

it('GET returns approved pages for a public viewer', async () => {
  ;(getUser as any).mockResolvedValue(null)
  ;(db.hub.findUnique as any).mockResolvedValue(hub)
  ;(db.hubPage.findMany as any).mockResolvedValue([
    { id: 'hp1', displayId: 'd1', status: 'approved', addedById: 'member', createdAt: new Date('2026-07-22T00:00:00Z'),
      display: { title: 'P', slug: 'p', coverImage: null, user: { username: 'jo' } } },
  ])
  const res = await GET(req(), params)
  expect(res.status).toBe(200)
  expect((await res.json()).pages[0].title).toBe('P')
})

it('POST 401 when logged out', async () => {
  ;(getUser as any).mockResolvedValue(null)
  ;(db.hub.findUnique as any).mockResolvedValue(hub)
  expect((await POST(req({ displayId: 'd1' }), params)).status).toBe(401)
})

it('POST 403 for a non-member', async () => {
  ;(getUser as any).mockResolvedValue({ id: 'stranger' })
  ;(db.hub.findUnique as any).mockResolvedValue(hub)
  ;(db.hubMember.findUnique as any).mockResolvedValue(null)
  expect((await POST(req({ displayId: 'd1' }), params)).status).toBe(403)
})

it('POST 404 when the Display is not the caller own', async () => {
  ;(getUser as any).mockResolvedValue({ id: 'member' })
  ;(db.hub.findUnique as any).mockResolvedValue(hub)
  ;(db.hubMember.findUnique as any).mockResolvedValue({ id: 'm1' })
  ;(db.display.findUnique as any).mockResolvedValue({ ...ownedPage, userId: 'someone-else' })
  expect((await POST(req({ displayId: 'd1' }), params)).status).toBe(404)
})

it('POST 422 for a Board', async () => {
  ;(getUser as any).mockResolvedValue({ id: 'member' })
  ;(db.hub.findUnique as any).mockResolvedValue(hub)
  ;(db.hubMember.findUnique as any).mockResolvedValue({ id: 'm1' })
  ;(db.display.findUnique as any).mockResolvedValue({ ...ownedPage, kind: 'collection' })
  expect((await POST(req({ displayId: 'd1' }), params)).status).toBe(422)
})

it('POST 422 for an unpublished Page', async () => {
  ;(getUser as any).mockResolvedValue({ id: 'member' })
  ;(db.hub.findUnique as any).mockResolvedValue(hub)
  ;(db.hubMember.findUnique as any).mockResolvedValue({ id: 'm1' })
  ;(db.display.findUnique as any).mockResolvedValue({ ...ownedPage, published: false })
  expect((await POST(req({ displayId: 'd1' }), params)).status).toBe(422)
})

it('POST 409 on a duplicate attach', async () => {
  ;(getUser as any).mockResolvedValue({ id: 'member' })
  ;(db.hub.findUnique as any).mockResolvedValue(hub)
  ;(db.hubMember.findUnique as any).mockResolvedValue({ id: 'm1' })
  ;(db.display.findUnique as any).mockResolvedValue(ownedPage)
  ;(db.hubPage.create as any).mockRejectedValue({ code: 'P2002' })
  expect((await POST(req({ displayId: 'd1' }), params)).status).toBe(409)
})

it('POST by a member lands pending', async () => {
  ;(getUser as any).mockResolvedValue({ id: 'member' })
  ;(db.hub.findUnique as any).mockResolvedValue(hub)
  ;(db.hubMember.findUnique as any).mockResolvedValue({ id: 'm1' })
  ;(db.display.findUnique as any).mockResolvedValue(ownedPage)
  const res = await POST(req({ displayId: 'd1' }), params)
  expect(res.status).toBe(201)
  expect((db.hubPage.create as any).mock.calls[0][0].data.status).toBe('pending')
})

it('POST by the owner lands approved', async () => {
  ;(getUser as any).mockResolvedValue({ id: 'owner' })
  ;(db.hub.findUnique as any).mockResolvedValue(hub)
  ;(db.display.findUnique as any).mockResolvedValue({ ...ownedPage, userId: 'owner' })
  const res = await POST(req({ displayId: 'd1' }), params)
  expect(res.status).toBe(201)
  expect((db.hubPage.create as any).mock.calls[0][0].data.status).toBe('approved')
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run src/app/api/hubs/\[id\]/pages/route.test.ts`
Expected: FAIL — cannot resolve `./route`.

- [ ] **Step 3: Write the implementation**

Create `src/app/api/hubs/[id]/pages/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'
import { canModerate, canViewCommunityHub } from '@/lib/community'
import { rateLimit } from '@/lib/rate-limit'
import { toHubPageDTO, visibleHubPageWhere } from '@/lib/hub-pages'

const DISPLAY_JOIN = {
  display: { select: { title: true, slug: true, coverImage: true, user: { select: { username: true } } } },
} as const

async function collaboratorIds(hubId: string): Promise<string[]> {
  const rows = await db.hubCollaborator.findMany({ where: { hubId }, select: { userId: true } })
  return rows.map((r) => r.userId)
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const hub = await db.hub.findUnique({ where: { id }, select: { id: true, userId: true, community: true, published: true } })
  if (!hub || !hub.community) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const me = await getUser(request)
  const collabIds = me ? await collaboratorIds(id) : []
  const isPrivileged = !!me && canModerate(me.id, hub, collabIds)
  if (!canViewCommunityHub({ published: hub.published, isPrivileged })) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const rows = await db.hubPage.findMany({
    where: visibleHubPageWhere({ hubId: id, viewerId: me?.id ?? null, isPrivileged }),
    orderBy: [{ order: 'asc' }, { createdAt: 'desc' }],
    include: DISPLAY_JOIN,
  })
  return NextResponse.json({ pages: rows.map(toHubPageDTO) })
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const limited = await rateLimit(request, { limit: 20, windowMs: 60_000, prefix: 'hub-page' })
  if (limited) return limited

  const me = await getUser(request)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const hub = await db.hub.findUnique({ where: { id }, select: { id: true, userId: true, community: true, published: true } })
  if (!hub || !hub.community) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const collabIds = await collaboratorIds(id)
  const isPrivileged = canModerate(me.id, hub, collabIds)
  if (!isPrivileged) {
    const member = await db.hubMember.findUnique({ where: { hubId_userId: { hubId: id, userId: me.id } }, select: { id: true } })
    if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json().catch(() => ({}))
  const displayId = typeof body?.displayId === 'string' ? body.displayId : ''
  if (!displayId) return NextResponse.json({ error: 'displayId is required' }, { status: 400 })

  // Existence and ownership are one check on purpose: a caller must not be able
  // to probe for the existence of Pages that are not theirs.
  const display = await db.display.findUnique({ where: { id: displayId }, select: { id: true, userId: true, published: true, kind: true } })
  if (!display || display.userId !== me.id) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (display.kind === 'collection') return NextResponse.json({ error: 'Boards cannot be attached' }, { status: 422 })
  if (!display.published) return NextResponse.json({ error: 'Publish this Page first' }, { status: 422 })

  try {
    const created = await db.hubPage.create({
      data: {
        hubId: id,
        displayId,
        addedById: me.id,
        status: isPrivileged ? 'approved' : 'pending',
        ...(isPrivileged ? { reviewedAt: new Date(), reviewedById: me.id } : {}),
      },
    })
    return NextResponse.json({ id: created.id, status: isPrivileged ? 'approved' : 'pending' }, { status: 201 })
  } catch (e: unknown) {
    // Let the unique constraint decide rather than check-then-insert, which races.
    if ((e as { code?: string })?.code === 'P2002') {
      return NextResponse.json({ error: 'Already attached' }, { status: 409 })
    }
    throw e
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm exec vitest run src/app/api/hubs/\[id\]/pages/route.test.ts`
Expected: PASS — 10 tests.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/hubs/\[id\]/pages/route.ts src/app/api/hubs/\[id\]/pages/route.test.ts
git commit -m "feat(hub): attach and list Pages API"
```

---

### Task 4: `PATCH` and `DELETE /api/hubs/[id]/pages/[pageId]`

**Files:**
- Create: `src/app/api/hubs/[id]/pages/[pageId]/route.ts`
- Test: `src/app/api/hubs/[id]/pages/[pageId]/route.test.ts`

**Interfaces:**
- Consumes: `db.hubPage` from Task 1; `canModerate` from `@/lib/community`
- Produces: `PATCH` → `{ id, status }`; `DELETE` → `{ ok: true }`

- [ ] **Step 1: Write the failing test**

Create `src/app/api/hubs/[id]/pages/[pageId]/route.test.ts`:

```ts
import { it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({ getUser: vi.fn() }))
vi.mock('@/lib/db', () => ({
  db: {
    hub: { findUnique: vi.fn() },
    hubCollaborator: { findMany: vi.fn(async () => []) },
    hubPage: { findUnique: vi.fn(), update: vi.fn(async () => ({ id: 'hp1', status: 'approved' })), delete: vi.fn(async () => ({})) },
  },
}))

import { getUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { PATCH, DELETE } from './route'

const params = { params: Promise.resolve({ id: 'hub1', pageId: 'hp1' }) }
const req = (body?: any) => ({ json: async () => body, url: 'http://localhost/api/hubs/hub1/pages/hp1' } as any)
beforeEach(() => vi.clearAllMocks())

const hub = { id: 'hub1', userId: 'owner', community: true, published: true }
const row = { id: 'hp1', hubId: 'hub1', addedById: 'member', status: 'pending' }

it('PATCH 403 for a plain member', async () => {
  ;(getUser as any).mockResolvedValue({ id: 'member' })
  ;(db.hub.findUnique as any).mockResolvedValue(hub)
  ;(db.hubPage.findUnique as any).mockResolvedValue(row)
  expect((await PATCH(req({ status: 'approved' }), params)).status).toBe(403)
})

it('PATCH 400 on an invalid status', async () => {
  ;(getUser as any).mockResolvedValue({ id: 'owner' })
  ;(db.hub.findUnique as any).mockResolvedValue(hub)
  ;(db.hubPage.findUnique as any).mockResolvedValue(row)
  expect((await PATCH(req({ status: 'banana' }), params)).status).toBe(400)
})

it('PATCH approves and stamps the reviewer', async () => {
  ;(getUser as any).mockResolvedValue({ id: 'owner' })
  ;(db.hub.findUnique as any).mockResolvedValue(hub)
  ;(db.hubPage.findUnique as any).mockResolvedValue(row)
  const res = await PATCH(req({ status: 'approved' }), params)
  expect(res.status).toBe(200)
  const data = (db.hubPage.update as any).mock.calls[0][0].data
  expect(data.status).toBe('approved')
  expect(data.reviewedById).toBe('owner')
})

it('PATCH 404 when the row belongs to another hub', async () => {
  ;(getUser as any).mockResolvedValue({ id: 'owner' })
  ;(db.hub.findUnique as any).mockResolvedValue(hub)
  ;(db.hubPage.findUnique as any).mockResolvedValue({ ...row, hubId: 'other' })
  expect((await PATCH(req({ status: 'approved' }), params)).status).toBe(404)
})

it('DELETE allows the attacher', async () => {
  ;(getUser as any).mockResolvedValue({ id: 'member' })
  ;(db.hub.findUnique as any).mockResolvedValue(hub)
  ;(db.hubPage.findUnique as any).mockResolvedValue(row)
  expect((await DELETE(req(), params)).status).toBe(200)
})

it('DELETE 403 for an unrelated member', async () => {
  ;(getUser as any).mockResolvedValue({ id: 'stranger' })
  ;(db.hub.findUnique as any).mockResolvedValue(hub)
  ;(db.hubPage.findUnique as any).mockResolvedValue(row)
  expect((await DELETE(req(), params)).status).toBe(403)
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run "src/app/api/hubs/[id]/pages/[pageId]/route.test.ts"`
Expected: FAIL — cannot resolve `./route`.

- [ ] **Step 3: Write the implementation**

Create `src/app/api/hubs/[id]/pages/[pageId]/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'
import { canModerate } from '@/lib/community'

type Ctx = { params: Promise<{ id: string; pageId: string }> }

async function load(request: NextRequest, id: string, pageId: string) {
  const me = await getUser(request)
  if (!me) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const hub = await db.hub.findUnique({ where: { id }, select: { id: true, userId: true, community: true, published: true } })
  if (!hub || !hub.community) return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) }
  const row = await db.hubPage.findUnique({ where: { id: pageId }, select: { id: true, hubId: true, addedById: true, status: true } })
  // Guard the hub match too: a row id from another hub must not be actionable here.
  if (!row || row.hubId !== id) return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) }
  const collabRows = await db.hubCollaborator.findMany({ where: { hubId: id }, select: { userId: true } })
  const isPrivileged = canModerate(me.id, hub, collabRows.map((r) => r.userId))
  return { me, row, isPrivileged }
}

export async function PATCH(request: NextRequest, { params }: Ctx) {
  const { id, pageId } = await params
  const ctx = await load(request, id, pageId)
  if ('error' in ctx) return ctx.error
  if (!ctx.isPrivileged) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json().catch(() => ({}))
  const status = body?.status
  if (status !== 'approved' && status !== 'rejected') {
    return NextResponse.json({ error: 'status must be approved or rejected' }, { status: 400 })
  }

  const updated = await db.hubPage.update({
    where: { id: pageId },
    data: { status, reviewedAt: new Date(), reviewedById: ctx.me.id },
  })
  return NextResponse.json({ id: updated.id, status: updated.status })
}

export async function DELETE(request: NextRequest, { params }: Ctx) {
  const { id, pageId } = await params
  const ctx = await load(request, id, pageId)
  if ('error' in ctx) return ctx.error
  if (!ctx.isPrivileged && ctx.row.addedById !== ctx.me.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  await db.hubPage.delete({ where: { id: pageId } })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm exec vitest run "src/app/api/hubs/[id]/pages/[pageId]/route.test.ts"`
Expected: PASS — 6 tests.

- [ ] **Step 5: Commit**

```bash
git add "src/app/api/hubs/[id]/pages/[pageId]"
git commit -m "feat(hub): review and detach attached Pages API"
```

---

### Task 5: Add the `pages` tab to `CommunityTabs`

**Files:**
- Modify: `src/components/hub/community/CommunityTabs.tsx`
- Test: `src/components/hub/community/CommunityTabs.test.tsx` (exists — add cases)

**Interfaces:**
- Consumes: nothing
- Produces: `CommunityTab` widened to `'home' | 'files' | 'pages'`; `tabFromParam('pages') === 'pages'`

- [ ] **Step 1: Add the failing tests**

Append to `src/components/hub/community/CommunityTabs.test.tsx`:

```tsx
it('maps the pages param to the pages tab', () => {
  expect(tabFromParam('pages')).toBe('pages')
})

it('renders a Pages tab', () => {
  render(<CommunityTabs active="home" onSelect={() => {}} />)
  expect(screen.getByRole('tab', { name: /pages/i })).toBeInTheDocument()
})
```

The file already imports `render`, `screen`, and both `CommunityTabs` and `tabFromParam` — no import changes needed.

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run src/components/hub/community/CommunityTabs.test.tsx`
Expected: FAIL — `tabFromParam('pages')` returns `'home'`.

- [ ] **Step 3: Implement**

In `src/components/hub/community/CommunityTabs.tsx`, replace the type, `tabFromParam`, and `TABS`:

```tsx
import { Leaf, FolderOpen, LayoutGrid } from 'lucide-react'

export type CommunityTab = 'home' | 'files' | 'pages'

/** Anything that isn't a known tab falls back to Home. */
export function tabFromParam(raw: string | null): CommunityTab {
  if (raw === 'files') return 'files'
  if (raw === 'pages') return 'pages'
  return 'home'
}

const TABS: { key: CommunityTab; label: string; icon: React.ReactNode }[] = [
  { key: 'home', label: 'Home', icon: <Leaf className="h-4 w-4" /> },
  { key: 'files', label: 'Files', icon: <FolderOpen className="h-4 w-4" /> },
  { key: 'pages', label: 'Pages', icon: <LayoutGrid className="h-4 w-4" /> },
]
```

Leave the component body unchanged.

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm exec vitest run src/components/hub/community/CommunityTabs.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/hub/community/CommunityTabs.tsx src/components/hub/community/CommunityTabs.test.tsx
git commit -m "feat(hub): add Pages tab to community tabs"
```

---

### Task 6: `HubPagesTab`

**Files:**
- Create: `src/components/hub/community/HubPagesTab.tsx`
- Test: `src/components/hub/community/HubPagesTab.test.tsx`

**Interfaces:**
- Consumes: `HubPageDTO` from Task 2; `PATCH`/`DELETE` routes from Task 4
- Produces: `<HubPagesTab hubId canManage currentUserId initialPages />`

- [ ] **Step 1: Write the failing test**

Create `src/components/hub/community/HubPagesTab.test.tsx`:

```tsx
import { it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { HubPagesTab } from './HubPagesTab'
import type { HubPageDTO } from '@/lib/hub-pages'

const approved: HubPageDTO = {
  id: 'hp1', displayId: 'd1', title: 'Approved Page', slug: 'approved-page',
  coverImage: null, ownerUsername: 'jo', status: 'approved', addedById: 'u1',
  createdAt: '2026-07-22T00:00:00.000Z',
}
const pending: HubPageDTO = { ...approved, id: 'hp2', displayId: 'd2', title: 'Pending Page', slug: 'pending-page', status: 'pending', addedById: 'u2' }

beforeEach(() => { vi.restoreAllMocks() })

it('renders an approved page with a link to it', () => {
  render(<HubPagesTab hubId="h1" canManage={false} currentUserId="u1" initialPages={[approved]} />)
  expect(screen.getByRole('link', { name: /approved page/i })).toHaveAttribute('href', '/jo/approved-page')
})

it('shows the review queue to a moderator', () => {
  render(<HubPagesTab hubId="h1" canManage currentUserId="mod" initialPages={[approved, pending]} />)
  expect(screen.getByText(/needs review/i)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /approve/i })).toBeInTheDocument()
})

it('hides the review queue from a plain member', () => {
  render(<HubPagesTab hubId="h1" canManage={false} currentUserId="u1" initialPages={[approved]} />)
  expect(screen.queryByText(/needs review/i)).not.toBeInTheDocument()
})

it('badges the attacher own pending row', () => {
  render(<HubPagesTab hubId="h1" canManage={false} currentUserId="u2" initialPages={[approved, pending]} />)
  expect(screen.getByText(/pending/i)).toBeInTheDocument()
})

it('shows an empty state when nothing is attached', () => {
  render(<HubPagesTab hubId="h1" canManage={false} currentUserId="u1" initialPages={[]} />)
  expect(screen.getByText(/no pages yet/i)).toBeInTheDocument()
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run src/components/hub/community/HubPagesTab.test.tsx`
Expected: FAIL — cannot resolve `./HubPagesTab`.

- [ ] **Step 3: Implement**

Create `src/components/hub/community/HubPagesTab.tsx`:

```tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { LayoutGrid, Check, X } from 'lucide-react'
import type { HubPageDTO } from '@/lib/hub-pages'

export function HubPagesTab({
  hubId, canManage, currentUserId, initialPages,
}: {
  hubId: string
  canManage: boolean
  currentUserId: string | null
  initialPages: HubPageDTO[]
}) {
  const [pages, setPages] = useState<HubPageDTO[]>(initialPages)

  const approved = pages.filter((p) => p.status === 'approved')
  const queue = canManage ? pages.filter((p) => p.status === 'pending') : []
  const mine = !canManage && currentUserId
    ? pages.filter((p) => p.status !== 'approved' && p.addedById === currentUserId)
    : []

  async function review(id: string, status: 'approved' | 'rejected') {
    const res = await fetch(`/api/hubs/${hubId}/pages/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (!res.ok) return
    setPages((cur) =>
      status === 'approved'
        ? cur.map((p) => (p.id === id ? { ...p, status: 'approved' } : p))
        : cur.filter((p) => p.id !== id),
    )
  }

  return (
    <div className="space-y-8">
      {queue.length > 0 && (
        <section>
          <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-muted-foreground">
            Needs review ({queue.length})
          </h3>
          <ul className="space-y-2">
            {queue.map((p) => (
              <li key={p.id} className="flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3">
                <Link href={`/${p.ownerUsername}/${p.slug}`} className="min-w-0 flex-1 truncate text-sm font-medium hover:underline">
                  {p.title}
                </Link>
                <span className="shrink-0 text-xs text-muted-foreground">by @{p.ownerUsername}</span>
                <button onClick={() => review(p.id, 'approved')} aria-label={`Approve ${p.title}`} className="rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
                  <Check className="mr-1 inline h-3 w-3" />Approve
                </button>
                <button onClick={() => review(p.id, 'rejected')} aria-label={`Reject ${p.title}`} className="rounded-full border border-border px-3 py-1 text-xs font-semibold text-muted-foreground">
                  <X className="mr-1 inline h-3 w-3" />Reject
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {mine.length > 0 && (
        <ul className="space-y-2">
          {mine.map((p) => (
            <li key={p.id} className="flex items-center gap-3 rounded-xl border border-dashed border-border px-4 py-3 text-sm">
              <span className="min-w-0 flex-1 truncate">{p.title}</span>
              <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] capitalize text-muted-foreground">{p.status}</span>
            </li>
          ))}
        </ul>
      )}

      {approved.length === 0 && queue.length === 0 && mine.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border py-16 text-center">
          <LayoutGrid className="mx-auto mb-3 h-6 w-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No pages yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {approved.map((p) => (
            <Link
              key={p.id}
              href={`/${p.ownerUsername}/${p.slug}`}
              className="group overflow-hidden rounded-2xl border border-border bg-surface shadow-soft transition hover:shadow-soft-lg"
            >
              <div className="aspect-[4/3] w-full bg-gradient-to-br from-galli/20 to-galli-aqua/10">
                {p.coverImage && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.coverImage} alt="" aria-hidden className="h-full w-full object-cover" />
                )}
              </div>
              <div className="p-3">
                <p className="truncate text-sm font-semibold">{p.title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">by @{p.ownerUsername}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm exec vitest run src/components/hub/community/HubPagesTab.test.tsx`
Expected: PASS — 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/hub/community/HubPagesTab.tsx src/components/hub/community/HubPagesTab.test.tsx
git commit -m "feat(hub): HubPagesTab grid and review queue"
```

---

### Task 7: `HubPageAttachModal`

**Files:**
- Create: `src/components/hub/community/HubPageAttachModal.tsx`
- Test: `src/components/hub/community/HubPageAttachModal.test.tsx`
- Modify: `src/components/hub/community/HubPagesTab.tsx` (add the "Attach a Page" trigger)

**Interfaces:**
- Consumes: `POST /api/hubs/[id]/pages` from Task 3; `GET /api/displays`
- **Verified:** `GET /api/displays` runs `findMany` with no `select`, so every Display column is present — `id`, `title`, `slug`, `published`, and `kind` are all available to the picker. It already excludes `kind: 'profile'` server-side, so the modal only has to exclude `'collection'`.
- Produces: `<HubPageAttachModal hubId attachedDisplayIds onClose onAttached />`

- [ ] **Step 1: Write the failing test**

Create `src/components/hub/community/HubPageAttachModal.test.tsx`:

```tsx
import { it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { HubPageAttachModal } from './HubPageAttachModal'

const displays = [
  { id: 'd1', title: 'Published One', slug: 'published-one', published: true, kind: 'page' },
  { id: 'd2', title: 'A Draft', slug: 'a-draft', published: false, kind: 'page' },
  { id: 'd3', title: 'A Board', slug: 'a-board', published: true, kind: 'collection' },
  { id: 'd4', title: 'Already There', slug: 'already-there', published: true, kind: 'page' },
]

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => displays })) as any)
})

it('lists published Pages as selectable', async () => {
  render(<HubPageAttachModal hubId="h1" attachedDisplayIds={['d4']} onClose={() => {}} onAttached={() => {}} />)
  await waitFor(() => expect(screen.getByRole('button', { name: /published one/i })).toBeEnabled())
})

it('disables drafts with a publish-first hint', async () => {
  render(<HubPageAttachModal hubId="h1" attachedDisplayIds={[]} onClose={() => {}} onAttached={() => {}} />)
  await waitFor(() => expect(screen.getByRole('button', { name: /a draft/i })).toBeDisabled())
  expect(screen.getByText(/publish first/i)).toBeInTheDocument()
})

it('omits Boards entirely', async () => {
  render(<HubPageAttachModal hubId="h1" attachedDisplayIds={[]} onClose={() => {}} onAttached={() => {}} />)
  await waitFor(() => expect(screen.getByRole('button', { name: /published one/i })).toBeInTheDocument())
  expect(screen.queryByText(/a board/i)).not.toBeInTheDocument()
})

it('disables an already-attached Page', async () => {
  render(<HubPageAttachModal hubId="h1" attachedDisplayIds={['d4']} onClose={() => {}} onAttached={() => {}} />)
  await waitFor(() => expect(screen.getByRole('button', { name: /already there/i })).toBeDisabled())
  expect(screen.getByText(/already added/i)).toBeInTheDocument()
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run src/components/hub/community/HubPageAttachModal.test.tsx`
Expected: FAIL — cannot resolve `./HubPageAttachModal`.

- [ ] **Step 3: Implement the modal**

Create `src/components/hub/community/HubPageAttachModal.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'

type Candidate = { id: string; title: string; slug: string; published: boolean; kind: string }

export function HubPageAttachModal({
  hubId, attachedDisplayIds, onClose, onAttached,
}: {
  hubId: string
  attachedDisplayIds: string[]
  onClose: () => void
  onAttached: () => void
}) {
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/displays')
      .then((r) => (r.ok ? r.json() : []))
      // Boards are not attachable, so they never enter the list at all.
      .then((rows: Candidate[]) => setCandidates(Array.isArray(rows) ? rows.filter((d) => d.kind !== 'collection') : []))
      .catch(() => setCandidates([]))
  }, [])

  async function attach(displayId: string) {
    setBusy(displayId)
    setError(null)
    const res = await fetch(`/api/hubs/${hubId}/pages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayId }),
    })
    setBusy(null)
    if (res.ok) { onAttached(); onClose(); return }
    const data = await res.json().catch(() => ({}))
    setError(data?.error || 'Could not attach that Page.')
  }

  return (
    <div role="dialog" aria-label="Attach a Page" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[80vh] w-full max-w-md overflow-y-auto rounded-2xl bg-surface p-5 shadow-soft-lg">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">Attach a Page</h2>
          <button onClick={onClose} aria-label="Close"><X className="h-5 w-5" /></button>
        </div>

        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

        <ul className="space-y-2">
          {candidates.map((d) => {
            const already = attachedDisplayIds.includes(d.id)
            const disabled = already || !d.published || busy === d.id
            return (
              <li key={d.id}>
                <button
                  onClick={() => attach(d.id)}
                  disabled={disabled}
                  className="flex w-full items-center justify-between rounded-xl border border-border px-4 py-3 text-left text-sm disabled:opacity-50"
                >
                  <span className="min-w-0 truncate">{d.title}</span>
                  {already ? (
                    <span className="shrink-0 text-xs text-muted-foreground">already added</span>
                  ) : !d.published ? (
                    <span className="shrink-0 text-xs text-muted-foreground">publish first</span>
                  ) : null}
                </button>
              </li>
            )
          })}
          {candidates.length === 0 && (
            <li className="py-8 text-center text-sm text-muted-foreground">You have no Pages yet.</li>
          )}
        </ul>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm exec vitest run src/components/hub/community/HubPageAttachModal.test.tsx`
Expected: PASS — 4 tests.

- [ ] **Step 5: Wire the trigger into `HubPagesTab`**

In `src/components/hub/community/HubPagesTab.tsx`, add to the imports:

```tsx
import { useRouter } from 'next/navigation'
import { HubPageAttachModal } from './HubPageAttachModal'
```

Add inside the component, above the `review` function:

```tsx
  const router = useRouter()
  const [attaching, setAttaching] = useState(false)
```

Add as the first child of the returned root `<div className="space-y-8">`:

```tsx
      {currentUserId && (
        <div className="flex justify-end">
          <button
            onClick={() => setAttaching(true)}
            className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-soft"
          >
            Attach a Page
          </button>
        </div>
      )}
      {attaching && (
        <HubPageAttachModal
          hubId={hubId}
          attachedDisplayIds={pages.map((p) => p.displayId)}
          onClose={() => setAttaching(false)}
          onAttached={() => router.refresh()}
        />
      )}
```

- [ ] **Step 6: Re-run both component test files**

Run: `pnpm exec vitest run src/components/hub/community/HubPagesTab.test.tsx src/components/hub/community/HubPageAttachModal.test.tsx`
Expected: PASS — 9 tests. If `HubPagesTab` tests now fail on a missing `next/navigation` mock, add at the top of `HubPagesTab.test.tsx`:

```tsx
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
```

- [ ] **Step 7: Commit**

```bash
git add src/components/hub/community/HubPageAttachModal.tsx src/components/hub/community/HubPageAttachModal.test.tsx src/components/hub/community/HubPagesTab.tsx src/components/hub/community/HubPagesTab.test.tsx
git commit -m "feat(hub): attach-a-Page picker"
```

---

### Task 8: Wire the tab into the server page

**Files:**
- Modify: `src/app/[username]/hub/[slug]/page.tsx` (the `Promise.all` around line 76, and the `CommunityHubView` props around line 139)
- Modify: `src/components/hub/community/CommunityHubView.tsx` (props, and the tab render block near line 129)

**Interfaces:**
- Consumes: `visibleHubPageWhere`, `toHubPageDTO` from Task 2; `HubPagesTab` from Task 6
- Produces: a working `?tab=pages` route end to end

- [ ] **Step 1: Add the query to the server page**

In `src/app/[username]/hub/[slug]/page.tsx`, add these imports:

```ts
import { toHubPageDTO, visibleHubPageWhere } from '@/lib/hub-pages'
```

Add as the final entry of the existing `Promise.all` array (after the `hubItem.findMany` call), and add `hubPageRows` as the matching final name in the destructuring on the left:

```ts
      db.hubPage.findMany({
        where: visibleHubPageWhere({ hubId: hub.id, viewerId: viewer?.id ?? null, isPrivileged }),
        orderBy: [{ order: 'asc' }, { createdAt: 'desc' }],
        include: { display: { select: { title: true, slug: true, coverImage: true, user: { select: { username: true } } } } },
      }),
```

Then, beside the existing `const announcements = announcementRows.map(toAnnouncementDTO)`:

```ts
    const hubPages = hubPageRows.map(toHubPageDTO)
```

**Note:** confirm the in-scope name for the signed-in viewer before writing this — the file already computes `isPrivileged`. If the viewer variable is not named `viewer`, use whatever the file already uses rather than introducing a new one.

- [ ] **Step 2: Pass it to `CommunityHubView`**

Beside the existing `announcements={announcements}` prop:

```tsx
          hubPages={hubPages}
          currentUserId={viewer?.id ?? null}
```

If `currentUserId` is already passed, do not duplicate it.

- [ ] **Step 3: Accept and render it in `CommunityHubView`**

In `src/components/hub/community/CommunityHubView.tsx`, add the import:

```tsx
import { HubPagesTab } from './HubPagesTab'
import type { HubPageDTO } from '@/lib/hub-pages'
```

Add to the props type, beside `announcements?: AnnouncementDTO[]`:

```tsx
  hubPages?: HubPageDTO[]
```

Add immediately after the existing `{tab === 'files' && (...)}` block:

```tsx
        {tab === 'pages' && (
          <div className="mt-6">
            <HubPagesTab
              hubId={hub.id}
              canManage={isPrivileged}
              currentUserId={currentUserId ?? null}
              initialPages={hubPages ?? []}
            />
          </div>
        )}
```

- [ ] **Step 4: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: no errors. An error about `hubPageRows` being unused or undefined means the destructuring in Step 1 and the array entry are out of order — they must be positionally aligned.

- [ ] **Step 5: Run the full suite**

Run: `pnpm exec vitest run`
Expected: only the known pre-existing failure in `src/app/api/messages/upload/route.test.ts`. Anything else is a regression from this task.

- [ ] **Step 6: Smoke-test in a browser**

Start the dev server on a free port from this worktree, then log in and open a community hub with `?tab=pages`. Verify: the Pages tab appears; attaching a published Page from the picker returns to the tab; the row shows as pending for a member and in "Needs review" for the owner; approving moves it into the grid.

Follow `[[browser-smoketest-toolchain]]` — do not skip this in favour of tests alone.

- [ ] **Step 7: Commit**

```bash
git add "src/app/[username]/hub/[slug]/page.tsx" src/components/hub/community/CommunityHubView.tsx
git commit -m "feat(hub): render the Pages tab in the community hub"
```

---

## Done when

- `?tab=pages` renders the tab for a community hub and deep-links correctly.
- A member can attach only their own published, non-Board Pages; the submission is `pending`.
- An owner or mod sees the review queue and can approve or reject.
- An approved Page appears in the grid for everyone who can view the hub.
- Unpublishing the Page hides the card without dropping the attachment.
- Deleting the Page removes the attachment via FK cascade.
- `pnpm exec vitest run` shows only the known pre-existing upload-route failure.
