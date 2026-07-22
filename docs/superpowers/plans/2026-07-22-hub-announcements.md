# Hub Announcements Implementation Plan (Plan 1 of 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Owner/collaborators post short announcements that members see as a rotating banner in the community hub's header the moment they arrive.

**Architecture:** A new `HubAnnouncement` model, three REST routes gated by `canModerate`, a pure validation lib, and a presentational banner + inline composer mounted in `CommunityHeader`'s blank band. The public hub page SSRs the latest announcements so there is no client flash.

**Tech Stack:** Next.js 15.5 App Router, React 19, TypeScript, Prisma/PostgreSQL, Vitest + Testing Library, Tailwind.

## Global Constraints

- **Worktree:** all work happens in `C:\Users\whirl\pages-mvp\.claude\worktrees\hub-unified` on branch `feat/hub-unified` (based on `origin/main` `496ba35`). `cd` there first. Do NOT work in the main checkout — other sessions hold it.
- **Spec:** `docs/superpowers/specs/2026-07-22-hub-unified-design.md`.
- **Free, ungated.** Never import or call `isPro()` in this work.
- **Database commands** need the env override — the machine-level `DATABASE_URL` points at the wrong DB. Set BOTH inline for every command: `export DATABASE_URL="postgresql://pages:pages@127.0.0.1:5434/pages"` and `export DATABASE_URL_UNPOOLED="$DATABASE_URL"` (use `127.0.0.1`, never `localhost`).
- **Never run `prisma migrate dev`** (interactive, hangs) and **never `migrate diff --from-url`** (contaminated on the shared dev DB). Hand-author `migration.sql`, then `prisma migrate deploy`.
- **Verification before any completion claim:** `pnpm exec tsc --noEmit`, `pnpm exec next lint`, and the task's test file. `tsc` does NOT run ESLint; a lint error fails the production build.
- **Tests:** Vitest. Run the full suite in chunks with `--maxWorkers=2` and `JWT_SECRET` set — unconstrained `pnpm test` is unreliable on this machine (worker starvation reports phantom failures). Per-task, run only the named file.
- **`@testing-library/user-event` is NOT a dependency.** Use `fireEvent` from `@testing-library/react`.
- **Announcement body cap is 280 characters**, trimmed, non-empty — enforced server-side, not just client.
- **Never commit** `Documents/`, `Images/`, `g1t.json`, `nul`, `.claude/settings.local.json`, or any `.log` file.
- Commit at the end of every task with the message given in that task's final step.

---

### Task 1: `HubAnnouncement` schema + migration

**Files:**
- Modify: `prisma/schema.prisma` (the `Hub` model, the `User` model, and a new model)
- Create: `prisma/migrations/20260722000000_hub_announcement/migration.sql`

**Interfaces:**
- Consumes: nothing.
- Produces: model `HubAnnouncement` with `id`, `hubId`, `authorId`, `body`, `createdAt`, index `[hubId, createdAt]`; `Hub.announcements HubAnnouncement[]`; `User.hubAnnouncements HubAnnouncement[] @relation("HubAnnouncementAuthor")`.

- [ ] **Step 1: Add the model and relations**

In `prisma/schema.prisma`, add the new model (place it near the other `Hub*` models, e.g. right after `model HubDrop { ... }`):

```prisma
model HubAnnouncement {
  id        String   @id @default(cuid())
  hubId     String
  hub       Hub      @relation(fields: [hubId], references: [id], onDelete: Cascade)
  authorId  String
  author    User     @relation("HubAnnouncementAuthor", fields: [authorId], references: [id])
  body      String
  createdAt DateTime @default(now())
  @@index([hubId, createdAt])
}
```

Add the back-relation to `model Hub` (next to `drops HubDrop[]`):

```prisma
  announcements HubAnnouncement[]
```

Add the back-relation to `model User` (next to `hubDrops HubDrop[]` at line ~43):

```prisma
  hubAnnouncements HubAnnouncement[] @relation("HubAnnouncementAuthor")
```

- [ ] **Step 2: Hand-author the migration**

Create `prisma/migrations/20260722000000_hub_announcement/migration.sql` with exactly:

```sql
-- Owner/collaborator announcements shown as a banner in the community hub header.
CREATE TABLE "HubAnnouncement" (
    "id" TEXT NOT NULL,
    "hubId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HubAnnouncement_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "HubAnnouncement_hubId_createdAt_idx" ON "HubAnnouncement"("hubId", "createdAt");

ALTER TABLE "HubAnnouncement" ADD CONSTRAINT "HubAnnouncement_hubId_fkey"
    FOREIGN KEY ("hubId") REFERENCES "Hub"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "HubAnnouncement" ADD CONSTRAINT "HubAnnouncement_authorId_fkey"
    FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
```

- [ ] **Step 3: Apply the migration to the dev DB**

Run:
```bash
export DATABASE_URL="postgresql://pages:pages@127.0.0.1:5434/pages"
export DATABASE_URL_UNPOOLED="$DATABASE_URL"
pnpm exec prisma migrate deploy
```
Expected: output includes `Applying migration '20260722000000_hub_announcement'` and ends `All migrations have been successfully applied.`

If it fails with **P3009** naming a *different, pre-existing* failed migration, that is known local drift — resolve only that unrelated migration with `pnpm exec prisma migrate resolve --applied <name>` (or `--rolled-back` if it truly never applied) and re-run. Never edit another branch's migration files.

- [ ] **Step 4: Regenerate the Prisma client**

Run: `pnpm exec prisma generate`
Expected: `Generated Prisma Client`. On Windows `EPERM`, a running `next dev` holds the engine DLL — stop it and retry.

- [ ] **Step 5: Verify the table exists**

Run:
```bash
pnpm exec prisma db execute --stdin <<'SQL'
SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'HubAnnouncement' ORDER BY ordinal_position;
SQL
```
Expected: 5 rows — `id text`, `hubId text`, `authorId text`, `body text`, `createdAt timestamp without time zone`.

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260722000000_hub_announcement/
git commit -m "feat(hub): HubAnnouncement model + migration"
```

---

### Task 2: Pure lib `hub-announcements.ts`

**Files:**
- Create: `src/lib/hub-announcements.ts`
- Test: `src/lib/hub-announcements.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `export const ANNOUNCEMENT_MAX = 280`
  - `export function validateAnnouncementBody(raw: unknown): { ok: true; value: string } | { ok: false; error: string }`
  - `export type AnnouncementAuthor = { username: string; name: string | null; avatar: string | null }`
  - `export type AnnouncementDTO = { id: string; body: string; createdAt: string; author: AnnouncementAuthor }`
  - `export function toAnnouncementDTO(row): AnnouncementDTO`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/hub-announcements.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { validateAnnouncementBody, toAnnouncementDTO, ANNOUNCEMENT_MAX } from './hub-announcements'

describe('validateAnnouncementBody', () => {
  it('accepts and trims a normal body', () => {
    const r = validateAnnouncementBody('  Meeting Thursday 6pm  ')
    expect(r).toEqual({ ok: true, value: 'Meeting Thursday 6pm' })
  })
  it('rejects an empty or whitespace-only body', () => {
    expect(validateAnnouncementBody('   ').ok).toBe(false)
    expect(validateAnnouncementBody('').ok).toBe(false)
    expect(validateAnnouncementBody(null).ok).toBe(false)
    expect(validateAnnouncementBody(123).ok).toBe(false)
  })
  it('rejects a body longer than the cap', () => {
    expect(validateAnnouncementBody('a'.repeat(ANNOUNCEMENT_MAX + 1)).ok).toBe(false)
  })
  it('accepts a body exactly at the cap', () => {
    const r = validateAnnouncementBody('a'.repeat(ANNOUNCEMENT_MAX))
    expect(r.ok).toBe(true)
  })
})

describe('toAnnouncementDTO', () => {
  it('shapes the row and stringifies the date', () => {
    const dto = toAnnouncementDTO({
      id: 'a1', body: 'hi', createdAt: new Date('2026-07-22T00:00:00Z'),
      author: { username: 'sam', name: 'Sam', avatar: null },
    })
    expect(dto).toEqual({
      id: 'a1', body: 'hi', createdAt: '2026-07-22T00:00:00.000Z',
      author: { username: 'sam', name: 'Sam', avatar: null },
    })
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm exec vitest run src/lib/hub-announcements.test.ts`
Expected: FAIL — `Failed to resolve import "./hub-announcements"`.

- [ ] **Step 3: Implement**

Create `src/lib/hub-announcements.ts`:

```ts
export const ANNOUNCEMENT_MAX = 280

export function validateAnnouncementBody(raw: unknown): { ok: true; value: string } | { ok: false; error: string } {
  if (typeof raw !== 'string') return { ok: false, error: 'Announcement is required' }
  const value = raw.trim()
  if (!value) return { ok: false, error: 'Announcement is required' }
  if (value.length > ANNOUNCEMENT_MAX) return { ok: false, error: `Keep it under ${ANNOUNCEMENT_MAX} characters` }
  return { ok: true, value }
}

export type AnnouncementAuthor = { username: string; name: string | null; avatar: string | null }

export type AnnouncementDTO = {
  id: string
  body: string
  createdAt: string
  author: AnnouncementAuthor
}

export function toAnnouncementDTO(row: {
  id: string; body: string; createdAt: Date
  author: { username: string; name: string | null; avatar: string | null }
}): AnnouncementDTO {
  return {
    id: row.id,
    body: row.body,
    createdAt: row.createdAt.toISOString(),
    author: { username: row.author.username, name: row.author.name, avatar: row.author.avatar },
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm exec vitest run src/lib/hub-announcements.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/hub-announcements.ts src/lib/hub-announcements.test.ts
git commit -m "feat(hub): announcement validation + DTO"
```

---

### Task 3: `GET` / `POST /api/hubs/[id]/announcements`

**Files:**
- Create: `src/app/api/hubs/[id]/announcements/route.ts`
- Test: `src/app/api/hubs/[id]/announcements/route.test.ts`

**Interfaces:**
- Consumes: `validateAnnouncementBody`, `toAnnouncementDTO` (Task 2); `canModerate`, `canViewCommunityHub` from `@/lib/community`; `rateLimit` from `@/lib/rate-limit`; `getUser` from `@/lib/auth`.
- Produces: `GET` → `{ announcements: AnnouncementDTO[] }` (latest 10). `POST` → `201 { id }`.

- [ ] **Step 1: Write the failing tests**

Create `src/app/api/hubs/[id]/announcements/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({ getUser: vi.fn() }))
vi.mock('@/lib/rate-limit', () => ({ rateLimit: vi.fn().mockResolvedValue(null) }))
vi.mock('@/lib/db', () => ({
  db: {
    hub: { findUnique: vi.fn() },
    hubCollaborator: { findMany: vi.fn(async () => []) },
    hubAnnouncement: { findMany: vi.fn(async () => []), create: vi.fn(async () => ({ id: 'new1' })) },
  },
}))

import { getUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { GET, POST } from './route'

const params = { params: Promise.resolve({ id: 'hub1' }) }
const req = (body?: any) => ({ json: async () => body, url: 'http://localhost/api/hubs/hub1/announcements' } as any)
beforeEach(() => vi.clearAllMocks())

const publishedHub = { id: 'hub1', userId: 'owner', community: true, published: true }

it('GET 404 when the hub is not a community hub', async () => {
  ;(getUser as any).mockResolvedValue(null)
  ;(db.hub.findUnique as any).mockResolvedValue({ id: 'hub1', userId: 'owner', community: false, published: true })
  const res = await GET(req(), params)
  expect(res.status).toBe(404)
})

it('GET returns announcements for a public viewer', async () => {
  ;(getUser as any).mockResolvedValue(null)
  ;(db.hub.findUnique as any).mockResolvedValue(publishedHub)
  ;(db.hubAnnouncement.findMany as any).mockResolvedValue([
    { id: 'a1', body: 'hello', createdAt: new Date('2026-07-22T00:00:00Z'), author: { username: 'o', name: 'O', avatar: null } },
  ])
  const res = await GET(req(), params)
  expect(res.status).toBe(200)
  const data = await res.json()
  expect(data.announcements).toHaveLength(1)
  expect(data.announcements[0].body).toBe('hello')
})

it('POST 401 when logged out', async () => {
  ;(getUser as any).mockResolvedValue(null)
  ;(db.hub.findUnique as any).mockResolvedValue(publishedHub)
  const res = await POST(req({ body: 'hi' }), params)
  expect(res.status).toBe(401)
})

it('POST 403 for a plain member (not a moderator)', async () => {
  ;(getUser as any).mockResolvedValue({ id: 'member' })
  ;(db.hub.findUnique as any).mockResolvedValue(publishedHub)
  const res = await POST(req({ body: 'hi' }), params)
  expect(res.status).toBe(403)
})

it('POST 400 on an empty body', async () => {
  ;(getUser as any).mockResolvedValue({ id: 'owner' })
  ;(db.hub.findUnique as any).mockResolvedValue(publishedHub)
  const res = await POST(req({ body: '   ' }), params)
  expect(res.status).toBe(400)
})

it('POST 201 for the owner and writes the trimmed body', async () => {
  ;(getUser as any).mockResolvedValue({ id: 'owner' })
  ;(db.hub.findUnique as any).mockResolvedValue(publishedHub)
  const res = await POST(req({ body: '  hi there  ' }), params)
  expect(res.status).toBe(201)
  expect((db.hubAnnouncement.create as any).mock.calls[0][0].data.body).toBe('hi there')
  expect((db.hubAnnouncement.create as any).mock.calls[0][0].data.authorId).toBe('owner')
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm exec vitest run "src/app/api/hubs/[id]/announcements/route.test.ts"`
Expected: FAIL — `Failed to resolve import "./route"`.

- [ ] **Step 3: Implement**

Create `src/app/api/hubs/[id]/announcements/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'
import { canModerate, canViewCommunityHub } from '@/lib/community'
import { rateLimit } from '@/lib/rate-limit'
import { validateAnnouncementBody, toAnnouncementDTO } from '@/lib/hub-announcements'

const PAGE = 10

async function collaboratorIds(hubId: string): Promise<string[]> {
  const rows = await db.hubCollaborator.findMany({ where: { hubId }, select: { userId: true } })
  return rows.map((r) => r.userId)
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const hub = await db.hub.findUnique({ where: { id }, select: { id: true, userId: true, community: true, published: true } })
  if (!hub || !hub.community) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const me = await getUser(request)
  const collabIds = await collaboratorIds(id)
  const isPrivileged = !!me && (me.id === hub.userId || collabIds.includes(me.id))
  if (!canViewCommunityHub({ published: hub.published, isPrivileged })) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const rows = await db.hubAnnouncement.findMany({
    where: { hubId: id },
    orderBy: { createdAt: 'desc' },
    take: PAGE,
    include: { author: { select: { username: true, name: true, avatar: true } } },
  })
  return NextResponse.json({ announcements: rows.map(toAnnouncementDTO) })
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const limited = await rateLimit(request, { limit: 20, windowMs: 60_000, prefix: 'hub-announcement' })
  if (limited) return limited
  const me = await getUser(request)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const hub = await db.hub.findUnique({ where: { id }, select: { id: true, userId: true, community: true, published: true } })
  if (!hub || !hub.community) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const collabIds = await collaboratorIds(id)
  if (!canModerate(me.id, hub, collabIds)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json().catch(() => ({}))
  const parsed = validateAnnouncementBody(body?.body)
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })

  const created = await db.hubAnnouncement.create({ data: { hubId: id, authorId: me.id, body: parsed.value } })
  return NextResponse.json({ id: created.id }, { status: 201 })
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm exec vitest run "src/app/api/hubs/[id]/announcements/route.test.ts"`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add "src/app/api/hubs/[id]/announcements/route.ts" "src/app/api/hubs/[id]/announcements/route.test.ts"
git commit -m "feat(hub): announcements list + create endpoint"
```

---

### Task 4: `DELETE /api/hubs/[id]/announcements/[announcementId]`

**Files:**
- Create: `src/app/api/hubs/[id]/announcements/[announcementId]/route.ts`
- Test: `src/app/api/hubs/[id]/announcements/[announcementId]/route.test.ts`

**Interfaces:**
- Consumes: `canModerate`, `getUser`, `db`.
- Produces: `DELETE` → `200 { ok: true }`; hub-scoped (IDOR-safe) 404; moderator-only 403.

- [ ] **Step 1: Write the failing tests**

Create `src/app/api/hubs/[id]/announcements/[announcementId]/route.test.ts`:

```ts
import { it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({ getUser: vi.fn() }))
vi.mock('@/lib/db', () => ({
  db: {
    hub: { findUnique: vi.fn() },
    hubCollaborator: { findMany: vi.fn(async () => []) },
    hubAnnouncement: { findFirst: vi.fn(), delete: vi.fn(async () => ({})) },
  },
}))

import { DELETE } from './route'
import { getUser } from '@/lib/auth'
import { db } from '@/lib/db'

const params = { params: Promise.resolve({ id: 'hub1', announcementId: 'a1' }) }
const req = () => ({} as any)
beforeEach(() => vi.clearAllMocks())

it('401 when logged out', async () => {
  ;(getUser as any).mockResolvedValue(null)
  const res = await DELETE(req(), params)
  expect(res.status).toBe(401)
})

it('404 when the announcement is not in this hub (IDOR scope)', async () => {
  ;(getUser as any).mockResolvedValue({ id: 'owner' })
  ;(db.hub.findUnique as any).mockResolvedValue({ id: 'hub1', userId: 'owner', community: true })
  ;(db.hubAnnouncement.findFirst as any).mockResolvedValue(null)
  const res = await DELETE(req(), params)
  expect(res.status).toBe(404)
})

it('403 for a plain member', async () => {
  ;(getUser as any).mockResolvedValue({ id: 'member' })
  ;(db.hub.findUnique as any).mockResolvedValue({ id: 'hub1', userId: 'owner', community: true })
  ;(db.hubAnnouncement.findFirst as any).mockResolvedValue({ id: 'a1', hubId: 'hub1' })
  const res = await DELETE(req(), params)
  expect(res.status).toBe(403)
})

it('200 for the owner and deletes by id', async () => {
  ;(getUser as any).mockResolvedValue({ id: 'owner' })
  ;(db.hub.findUnique as any).mockResolvedValue({ id: 'hub1', userId: 'owner', community: true })
  ;(db.hubAnnouncement.findFirst as any).mockResolvedValue({ id: 'a1', hubId: 'hub1' })
  const res = await DELETE(req(), params)
  expect(res.status).toBe(200)
  expect(db.hubAnnouncement.delete).toHaveBeenCalledWith({ where: { id: 'a1' } })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm exec vitest run "src/app/api/hubs/[id]/announcements/[announcementId]/route.test.ts"`
Expected: FAIL — `Failed to resolve import "./route"`.

- [ ] **Step 3: Implement**

Create `src/app/api/hubs/[id]/announcements/[announcementId]/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'
import { canModerate } from '@/lib/community'

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string; announcementId: string }> }): Promise<NextResponse> {
  const { id, announcementId } = await params
  const me = await getUser(request)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const hub = await db.hub.findUnique({ where: { id }, select: { id: true, userId: true, community: true } })
  if (!hub || !hub.community) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  // Hub-scoped lookup: an announcement id from another hub 404s rather than deletes.
  const row = await db.hubAnnouncement.findFirst({ where: { id: announcementId, hubId: id }, select: { id: true } })
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const collabIds = (await db.hubCollaborator.findMany({ where: { hubId: id }, select: { userId: true } })).map((r) => r.userId)
  if (!canModerate(me.id, hub, collabIds)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  await db.hubAnnouncement.delete({ where: { id: announcementId } })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm exec vitest run "src/app/api/hubs/[id]/announcements/[announcementId]/route.test.ts"`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add "src/app/api/hubs/[id]/announcements/[announcementId]/route.ts" "src/app/api/hubs/[id]/announcements/[announcementId]/route.test.ts"
git commit -m "feat(hub): announcement delete endpoint (hub-scoped, moderator-only)"
```

---

### Task 5: `HubAnnouncementBanner` + `HubAnnouncementComposer`

**Files:**
- Create: `src/components/hub/community/HubAnnouncementBanner.tsx`
- Create: `src/components/hub/community/HubAnnouncementComposer.tsx`
- Test: `src/components/hub/community/HubAnnouncementBanner.test.tsx`

**Interfaces:**
- Consumes: `AnnouncementDTO` (Task 2); the endpoints from Tasks 3-4.
- Produces:

```ts
export function HubAnnouncementBanner(props: {
  hubId: string
  isPrivileged: boolean
  initial: AnnouncementDTO[]
}): JSX.Element | null

export function HubAnnouncementComposer(props: {
  hubId: string
  onCreated: (a: AnnouncementDTO) => void
  onClose: () => void
  currentUser: { username: string; name: string | null; avatar: string | null }
}): JSX.Element
```

- [ ] **Step 1: Write the failing test**

Create `src/components/hub/community/HubAnnouncementBanner.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { HubAnnouncementBanner } from './HubAnnouncementBanner'
import type { AnnouncementDTO } from '@/lib/hub-announcements'

const ann = (over: Partial<AnnouncementDTO> = {}): AnnouncementDTO => ({
  id: 'a1', body: 'Meeting Thursday 6pm', createdAt: new Date().toISOString(),
  author: { username: 'o', name: 'Owner', avatar: null }, ...over,
})

beforeEach(() => {
  global.fetch = vi.fn(async () => ({ ok: true, json: async () => ({ ok: true }) })) as any
})

describe('HubAnnouncementBanner', () => {
  it('renders the most recent announcement', () => {
    render(<HubAnnouncementBanner hubId="h1" isPrivileged={false} initial={[ann({ id: 'newest', body: 'Newest' }), ann({ id: 'older', body: 'Older' })]} />)
    expect(screen.getByText('Newest')).toBeInTheDocument()
    expect(screen.queryByText('Older')).not.toBeInTheDocument()
  })

  it('pages to the next announcement', () => {
    render(<HubAnnouncementBanner hubId="h1" isPrivileged={false} initial={[ann({ id: 'newest', body: 'Newest' }), ann({ id: 'older', body: 'Older' })]} />)
    fireEvent.click(screen.getByRole('button', { name: /older|next/i }))
    expect(screen.getByText('Older')).toBeInTheDocument()
  })

  it('renders nothing for a member when there are no announcements', () => {
    const { container } = render(<HubAnnouncementBanner hubId="h1" isPrivileged={false} initial={[]} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('shows a post prompt to a privileged viewer when empty', () => {
    render(<HubAnnouncementBanner hubId="h1" isPrivileged initial={[]} />)
    expect(screen.getByText(/post your first announcement|post an announcement/i)).toBeInTheDocument()
  })

  it('does not show a delete control to a member', () => {
    render(<HubAnnouncementBanner hubId="h1" isPrivileged={false} initial={[ann()]} />)
    expect(screen.queryByRole('button', { name: /delete|remove/i })).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run src/components/hub/community/HubAnnouncementBanner.test.tsx`
Expected: FAIL — `Failed to resolve import "./HubAnnouncementBanner"`.

- [ ] **Step 3: Implement the composer**

Create `src/components/hub/community/HubAnnouncementComposer.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { ANNOUNCEMENT_MAX, type AnnouncementDTO } from '@/lib/hub-announcements'

export function HubAnnouncementComposer({
  hubId, onCreated, onClose, currentUser,
}: {
  hubId: string
  onCreated: (a: AnnouncementDTO) => void
  onClose: () => void
  currentUser: { username: string; name: string | null; avatar: string | null }
}) {
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    const trimmed = body.trim()
    if (!trimmed) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/hubs/${hubId}/announcements`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body: trimmed }),
      })
      if (!res.ok) { setError((await res.json().catch(() => ({}))).error || 'Could not post'); return }
      const { id } = await res.json()
      onCreated({ id, body: trimmed, createdAt: new Date().toISOString(), author: currentUser })
      setBody('')
      onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value.slice(0, ANNOUNCEMENT_MAX))}
        placeholder="Share an announcement with your members…"
        rows={2}
        className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm"
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex items-center justify-end gap-2">
        <span className="mr-auto text-[11px] text-muted-foreground">{body.length}/{ANNOUNCEMENT_MAX}</span>
        <button onClick={onClose} className="rounded-lg px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted">Cancel</button>
        <button onClick={submit} disabled={busy || !body.trim()} className="inline-flex items-center gap-1.5 rounded-lg bg-galli px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60">
          {busy && <Loader2 className="h-4 w-4 animate-spin" />} Post
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Implement the banner**

Create `src/components/hub/community/HubAnnouncementBanner.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { Megaphone, ChevronLeft, ChevronRight, X, Plus } from 'lucide-react'
import type { AnnouncementDTO } from '@/lib/hub-announcements'
import { HubAnnouncementComposer } from './HubAnnouncementComposer'

function timeAgo(iso: string): string {
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000))
  if (s < 60) return 'just now'
  const m = Math.floor(s / 60); if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export function HubAnnouncementBanner({
  hubId, isPrivileged, initial,
}: {
  hubId: string
  isPrivileged: boolean
  initial: AnnouncementDTO[]
}) {
  const [items, setItems] = useState<AnnouncementDTO[]>(initial)
  const [idx, setIdx] = useState(0)
  const [composing, setComposing] = useState(false)

  const current = items[idx]

  async function remove(id: string) {
    if (!confirm('Delete this announcement?')) return
    const res = await fetch(`/api/hubs/${hubId}/announcements/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setItems((cur) => {
        const next = cur.filter((a) => a.id !== id)
        setIdx((i) => Math.min(i, Math.max(0, next.length - 1)))
        return next
      })
    }
  }

  // Empty: members see nothing; privileged see a discoverable prompt.
  if (items.length === 0 && !composing) {
    if (!isPrivileged) return null
    return (
      <button onClick={() => setComposing(true)} className="flex w-full items-center gap-2 rounded-xl border border-dashed border-border px-4 py-3 text-sm text-muted-foreground hover:bg-muted/50">
        <Megaphone className="h-4 w-4 text-primary" /> Post your first announcement
      </button>
    )
  }

  return (
    <div className="rounded-xl border border-galli/30 bg-galli/5 px-4 py-3">
      {composing ? (
        <HubAnnouncementComposer
          hubId={hubId}
          currentUser={{ username: 'you', name: null, avatar: null }}
          onClose={() => setComposing(false)}
          onCreated={(a) => { setItems((cur) => [a, ...cur]); setIdx(0) }}
        />
      ) : current ? (
        <div className="flex items-start gap-3">
          <Megaphone className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <p className="text-sm text-foreground">{current.body}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">posted {timeAgo(current.createdAt)}</p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {items.length > 1 && (
              <>
                <button aria-label="Previous announcement" disabled={idx === 0} onClick={() => setIdx((i) => Math.max(0, i - 1))} className="rounded p-1 text-muted-foreground hover:bg-muted disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button>
                <span className="text-[11px] text-muted-foreground">{idx + 1}/{items.length}</span>
                <button aria-label="Next announcement" disabled={idx >= items.length - 1} onClick={() => setIdx((i) => Math.min(items.length - 1, i + 1))} className="rounded p-1 text-muted-foreground hover:bg-muted disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button>
              </>
            )}
            {isPrivileged && (
              <>
                <button aria-label="Post announcement" onClick={() => setComposing(true)} className="rounded p-1 text-muted-foreground hover:bg-muted"><Plus className="h-4 w-4" /></button>
                <button aria-label="Delete announcement" onClick={() => remove(current.id)} className="rounded p-1 text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></button>
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm exec vitest run src/components/hub/community/HubAnnouncementBanner.test.tsx`
Expected: PASS, 5 tests.

- [ ] **Step 6: Commit**

```bash
git add src/components/hub/community/HubAnnouncementBanner.tsx src/components/hub/community/HubAnnouncementComposer.tsx src/components/hub/community/HubAnnouncementBanner.test.tsx
git commit -m "feat(hub): announcement banner + composer"
```

---

### Task 6: Wire the banner into the header + SSR the data

**Files:**
- Modify: `src/components/hub/community/CommunityHeader.tsx`
- Modify: `src/components/hub/community/CommunityHubView.tsx`
- Modify: `src/app/[username]/hub/[slug]/page.tsx`
- Test: `src/components/hub/community/CommunityHeader.test.tsx` (create if absent)

**Interfaces:**
- Consumes: `HubAnnouncementBanner` (Task 5); `AnnouncementDTO` + `toAnnouncementDTO` (Task 2).
- Produces: the banner rendered in the header band, fed SSR data through `CommunityHubView` → `CommunityHeader`.

- [ ] **Step 1: Write the failing test**

Create `src/components/hub/community/CommunityHeader.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CommunityHeader } from './CommunityHeader'
import type { AnnouncementDTO } from '@/lib/hub-announcements'

const baseProps = {
  title: 'Info Hub', tagline: null, ownerUsername: 'o', coverImage: null,
  memberAvatars: [], counts: { posts: 0, members: 0, resources: 0, events: 0, kollab: 0 },
  joined: false, isPrivileged: false, onToggleJoin: () => {}, sharePath: '/o/hub/info',
  hubId: 'h1', announcements: [] as AnnouncementDTO[],
}

describe('CommunityHeader announcements', () => {
  it('renders an announcement banner in the header when present', () => {
    render(<CommunityHeader {...baseProps} announcements={[{ id: 'a1', body: 'Welcome all', createdAt: new Date().toISOString(), author: { username: 'o', name: 'O', avatar: null } }]} />)
    expect(screen.getByText('Welcome all')).toBeInTheDocument()
  })

  it('renders no banner and no prompt for a member when empty', () => {
    render(<CommunityHeader {...baseProps} announcements={[]} isPrivileged={false} />)
    expect(screen.queryByText(/announcement/i)).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run src/components/hub/community/CommunityHeader.test.tsx`
Expected: FAIL — `CommunityHeader` does not accept `hubId`/`announcements`, and the banner text is absent.

- [ ] **Step 3: Add the banner to `CommunityHeader`**

In `src/components/hub/community/CommunityHeader.tsx`:

Add the import at the top:
```tsx
import { HubAnnouncementBanner } from './HubAnnouncementBanner'
import type { AnnouncementDTO } from '@/lib/hub-announcements'
```

Add two props to the destructuring (line 7) and the type block (after `editHref?: string` at line 19):
```tsx
  title, tagline, ownerUsername, coverImage, memberAvatars, counts, joined, isPrivileged, onToggleJoin, sharePath, editHref, hubId, announcements,
```
```tsx
  editHref?: string
  hubId: string
  announcements: AnnouncementDTO[]
```

Then insert the banner into the blank band — the middle flex column. Replace the middle `<div className="min-w-0 flex-1">…</div>` (lines 37-54) so the banner sits below the member row, filling the horizontal space:

```tsx
      <div className="min-w-0 flex-1">
        <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
        {tagline && <p className="mt-0.5 text-muted-foreground">{tagline}</p>}
        <p className="mt-0.5 text-sm text-primary">by @{ownerUsername}</p>
        <div className="mt-2 flex items-center gap-2">
          <div className="flex -space-x-2">
            {memberAvatars.slice(0, 4).map((m, i) => (
              <span key={i} className="h-6 w-6 overflow-hidden rounded-full border-2 border-surface bg-gradient-to-br from-galli/30 to-galli-violet/30">
                {m.avatar && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.avatar} alt="" className="h-full w-full object-cover" />
                )}
              </span>
            ))}
          </div>
          <span className="text-xs text-muted-foreground">{counts.members} member{counts.members === 1 ? '' : 's'}</span>
        </div>
        <div className="mt-3">
          <HubAnnouncementBanner hubId={hubId} isPrivileged={isPrivileged} initial={announcements} />
        </div>
      </div>
```

- [ ] **Step 4: Pass the data through `CommunityHubView`**

In `src/components/hub/community/CommunityHubView.tsx`:

Add the import:
```tsx
import type { AnnouncementDTO } from '@/lib/hub-announcements'
```

Add `announcements` to the props destructuring (line 22) and the type block (after `preview?: boolean` — line 42):
```tsx
  hub, ownerUsername, currentUserId, isPrivileged, isOwner, joined: initialJoined, memberCount: initialCount, members, resources, events, drops, pendingCount = 0, notes, counts, activity, sharePath, config, preview, announcements = [],
```
```tsx
  preview?: boolean
  announcements?: AnnouncementDTO[]
```

Pass them to `CommunityHeader` (after `editHref` at line 90):
```tsx
            editHref={preview ? undefined : `/hubs/${hub.id}`}
            hubId={hub.id}
            announcements={announcements}
```

- [ ] **Step 5: SSR the announcements on the public page**

In `src/app/[username]/hub/[slug]/page.tsx`, inside the community render block (the `if (hub.community)` branch, in the big `Promise.all([...])` around line 70+):

Add this query as a new entry at the END of the `Promise.all` array, and add a matching name at the END of the destructuring array (mirror the exact positional pattern already there — a mismatch silently misassigns every later variable):

```ts
      db.hubAnnouncement.findMany({
        where: { hubId: hub.id },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: { author: { select: { username: true, name: true, avatar: true } } },
      }),
```
Destructuring name: `announcementRows`.

Then map and pass it to the view. After the existing `const drops = dropRows.map(toDropDTO)` line, add:
```ts
    const announcements = announcementRows.map(toAnnouncementDTO)
```
Add the import near the other `@/lib` imports at the top of the file:
```ts
import { toAnnouncementDTO } from '@/lib/hub-announcements'
```
And add the prop to the `<CommunityHubView … />` element (next to `config={config}`):
```tsx
        announcements={announcements}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `pnpm exec vitest run src/components/hub/community/CommunityHeader.test.tsx src/components/hub/community/`
Expected: PASS — the new header test plus the existing community component suites (`CommunityHubView.test.tsx`, `CommunityUtilityStrip.test.tsx`, the Kollab suites).

- [ ] **Step 7: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: clean. A red here most likely means the `Promise.all` destructuring count does not match the query count — recount both arrays.

- [ ] **Step 8: Commit**

```bash
git add src/components/hub/community/CommunityHeader.tsx src/components/hub/community/CommunityHeader.test.tsx src/components/hub/community/CommunityHubView.tsx "src/app/[username]/hub/[slug]/page.tsx"
git commit -m "feat(hub): render the announcement banner in the header, SSR its data"
```

---

### Task 7: Verification gate

**Files:** none created; fixes whatever the gates surface.

- [ ] **Step 1: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: clean, exit 0.

- [ ] **Step 2: Lint**

Run: `pnpm exec next lint 2>&1 | grep -cE "Error:"`
Expected: `0`. If a nested-worktree ESLint plugin conflict appears, add `"root": true` to `.eslintrc.json` and re-run.

- [ ] **Step 3: Run the announcements-related suites**

Run:
```bash
JWT_SECRET="test-secret-value-strong-enough-for-tests" pnpm exec vitest run --maxWorkers=2 \
  src/lib/hub-announcements.test.ts \
  "src/app/api/hubs/[id]/announcements" \
  src/components/hub/community
```
Expected: all pass.

- [ ] **Step 4: Runtime smoke against a real dev server**

Start `pnpm dev` with the `DATABASE_URL` override and a real `JWT_SECRET` from `C:\Users\whirl\pages-mvp\.env`. Against a real community hub, with a forged `galli-auth` cookie:
1. `POST /api/hubs/<id>/announcements` as a plain member (not owner/collab) → **403**.
2. Same as the owner with `{"body":"Meeting Thursday"}` → **201**; confirm the row in the DB.
3. `POST` as owner with `{"body":"   "}` → **400**.
4. `GET /api/hubs/<id>/announcements` as an anonymous visitor of the published hub → **200** with the announcement.
5. `DELETE /api/hubs/<id>/announcements/<id>` as a member → **403**; as the owner → **200**.
6. Load the published hub page as an anonymous visitor and confirm the announcement text is in the server-rendered HTML (no client flash).

Record the real result of each step. If Chrome is available, also confirm via the `superpowers-chrome:browsing` skill that the banner renders in the header with the pager, and the owner sees the ＋/✕ controls a member does not. If Chrome is unavailable, state plainly that the browser smoke was NOT run.

- [ ] **Step 5: Commit any fixes**

```bash
git add -A ':!Documents' ':!Images' ':!g1t.json' ':!nul' ':!.claude/settings.local.json'
git commit -m "fix(hub): announcements verification gate fixes"
```
If no fixes were needed, skip and say so.

---

## Notes for Plan 2 (Files tab)

Plan 2 adds the Home|Files tab bar and the file data-room to the same branch. It does not touch anything in this plan except `CommunityHubView.tsx` (the tab bar wraps the body this plan leaves alone). Keep the announcement banner on the **Home** tab only.
