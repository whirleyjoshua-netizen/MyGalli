# Community Hub M3a — Hub Events — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hub-only, display-only events: owners create events (members get notified), and the public community page shows an Upcoming sidebar widget + the real Events stat count.

**Architecture:** New queryable `HubEvent` model + owner CRUD API (`canModerate`-gated) with a new-event member notification. Events plug into M2's config-driven page as a new `'events'` sidebar widget key; the server page fetches upcoming events + count and passes them down. Owner management is a "Manage events" modal off the builder's Layout & Sections.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Prisma/PostgreSQL, Tailwind, Vitest.

## Global Constraints
- **Spec:** `docs/superpowers/specs/2026-07-18-community-hub-m3a-events-design.md`. M3a only (Events); the utility strip (Notes/Kollab-AI/Tools) is M3b.
- **Base:** branch `feat/community-m3a` off `main` @ `7f02118` (M1+M2 live). Work in worktree `C:\Users\whirl\pages-mvp\.claude\worktrees\community-m3a`.
- **Sidebar widget keys (exact):** `'video' | 'members' | 'events' | 'resources'` (this order = the new default). whoCanPost `'members' | 'owner-only'` (unchanged).
- **Events are display-only** (no RSVP), **hub-only**. Writes gated by `canModerate` (owner||collaborator). New event → notify members (type `hub_event`).
- **Empty Upcoming widget hides** (consistent with Resources hiding when empty).
- **Migrations non-interactive:** hand-author `migration.sql`, `prisma migrate deploy` with `DATABASE_URL`+`DATABASE_URL_UNPOOLED` set inline (fresh DB `pages_m3a`; the shared `pages` DB is drifted). Windows: stop dev before `prisma generate`; `127.0.0.1` not `localhost`.
- **Run `tsc --noEmit` on every code task** (vitest/esbuild does not enforce strict-null; run tsc explicitly). Lint gates prod build; the pre-existing `.eslintrc.json` plugin-conflict warning makes `next lint` exit 1 with zero real findings — distinguish it. Escape apostrophes (`&apos;`).
- Never commit `Documents/`, `Images/`, `g1t.json`, `nul`, `.env`, `.claude/settings.local.json`.

## File structure
- **New:** `src/lib/hub-events.ts` (+ test); `src/app/api/hubs/[id]/events/route.ts` (+ test); `src/app/api/hubs/[id]/events/[eventId]/route.ts` (+ test); `src/components/hub/builder/HubEventsModal.tsx`.
- **Changed:** `prisma/schema.prisma` (`HubEvent` + `Hub.hubEvents`); `src/lib/notifications-format.ts` (`hub_event`); `src/lib/types/hub-config.ts` + `src/lib/hub-config.test.ts` (`'events'` key); `src/components/hub/community/CommunitySidebar.tsx` (+ `CommunityHubView.tsx`) (events widget + prop); `src/app/[username]/hub/[slug]/page.tsx` (fetch events + count); `src/components/hub/builder/LayoutSectionsSection.tsx` (`'events'` LABEL + "Manage" action) + `src/components/hub/builder/HubBuilder.tsx` (pass `hubId` to LayoutSectionsSection).

---

### Task 1: `HubEvent` schema + migration

**Files:** Modify `prisma/schema.prisma`; Create `prisma/migrations/20260718000000_hub_event/migration.sql`.

**Interfaces:** Produces `HubEvent { id, hubId, title, startsAt, endsAt?, allDay, isOnline, location?, description?, createdAt }`; `Hub.hubEvents`.

- [ ] **Step 1: Add the model** to `prisma/schema.prisma` (after the `HubPostReaction` model or near the other Hub-child models):

```prisma
model HubEvent {
  id          String   @id @default(cuid())
  hubId       String
  hub         Hub      @relation(fields: [hubId], references: [id], onDelete: Cascade)
  title       String
  startsAt    DateTime
  endsAt      DateTime?
  allDay      Boolean  @default(false)
  isOnline    Boolean  @default(false)
  location    String?
  description String?
  createdAt   DateTime @default(now())
  @@index([hubId, startsAt])
}
```

- [ ] **Step 2: Add the back-relation** on `model Hub` (after `posts HubPost[]`):

```prisma
  posts       HubPost[]
  hubEvents   HubEvent[]
```

- [ ] **Step 3: Hand-author migration** `prisma/migrations/20260718000000_hub_event/migration.sql`:

```sql
CREATE TABLE "HubEvent" (
    "id" TEXT NOT NULL,
    "hubId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "allDay" BOOLEAN NOT NULL DEFAULT false,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "location" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HubEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "HubEvent_hubId_startsAt_idx" ON "HubEvent"("hubId", "startsAt");
ALTER TABLE "HubEvent" ADD CONSTRAINT "HubEvent_hubId_fkey" FOREIGN KEY ("hubId") REFERENCES "Hub"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

- [ ] **Step 4: Apply to a fresh DB + regenerate**

```bash
docker exec pages-mvp-postgres-1 psql -U pages -d pages -c "DROP DATABASE IF EXISTS pages_m3a WITH (FORCE);" -c "CREATE DATABASE pages_m3a;"
export DATABASE_URL="postgresql://pages:pages@127.0.0.1:5434/pages_m3a" DATABASE_URL_UNPOOLED="postgresql://pages:pages@127.0.0.1:5434/pages_m3a"
pnpm exec prisma migrate deploy && pnpm exec prisma generate
```
Expected: "All migrations have been successfully applied." + client generated.

- [ ] **Step 5: Typecheck** — `pnpm exec tsc --noEmit` → exit 0.

- [ ] **Step 6: Commit**
```bash
git add prisma/schema.prisma prisma/migrations/20260718000000_hub_event
git commit -m "feat(events): HubEvent model + migration"
```

---

### Task 2: `hub-events` lib (validate + DTO)

**Files:** Create `src/lib/hub-events.ts`, `src/lib/hub-events.test.ts`.

**Interfaces:** Produces `validateEventInput(raw): { ok: true; value: NormalizedEvent } | { ok: false; error: string }`, `toEventDTO(row): EventDTO`, and types `NormalizedEvent`/`EventDTO`.

- [ ] **Step 1: Write the failing test** `src/lib/hub-events.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { validateEventInput, toEventDTO } from './hub-events'

describe('validateEventInput', () => {
  it('requires a title', () => {
    expect(validateEventInput({ startsAt: '2026-08-01T19:00:00Z' })).toEqual({ ok: false, error: 'Title is required' })
  })
  it('rejects an invalid start date', () => {
    expect(validateEventInput({ title: 'X', startsAt: 'nope' })).toMatchObject({ ok: false })
  })
  it('rejects end before start', () => {
    const r = validateEventInput({ title: 'X', startsAt: '2026-08-01T19:00:00Z', endsAt: '2026-08-01T18:00:00Z' })
    expect(r).toMatchObject({ ok: false })
  })
  it('accepts a valid event and normalizes fields', () => {
    const r = validateEventInput({ title: '  Kickoff  ', startsAt: '2026-08-01T19:00:00Z', isOnline: true, location: ' https://meet.example ', description: 'hi' })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.value.title).toBe('Kickoff')
      expect(r.value.startsAt.toISOString()).toBe('2026-08-01T19:00:00.000Z')
      expect(r.value.isOnline).toBe(true)
      expect(r.value.location).toBe('https://meet.example')
      expect(r.value.endsAt).toBeNull()
    }
  })
})

describe('toEventDTO', () => {
  it('serializes dates to ISO strings', () => {
    const dto = toEventDTO({ id: 'e1', title: 'X', startsAt: new Date('2026-08-01T19:00:00Z'), endsAt: null, allDay: false, isOnline: false, location: null, description: null })
    expect(dto.startsAt).toBe('2026-08-01T19:00:00.000Z')
    expect(dto.endsAt).toBeNull()
  })
})
```

- [ ] **Step 2: Run test → fails** — `pnpm exec vitest run src/lib/hub-events.test.ts` (module not found).

- [ ] **Step 3: Implement** `src/lib/hub-events.ts`:

```ts
export type NormalizedEvent = {
  title: string
  startsAt: Date
  endsAt: Date | null
  allDay: boolean
  isOnline: boolean
  location: string | null
  description: string | null
}

export function validateEventInput(raw: unknown): { ok: true; value: NormalizedEvent } | { ok: false; error: string } {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, any>
  const title = (typeof r.title === 'string' ? r.title : '').trim()
  if (!title) return { ok: false, error: 'Title is required' }
  if (title.length > 200) return { ok: false, error: 'Title too long' }
  const startsAt = new Date(r.startsAt)
  if (isNaN(startsAt.getTime())) return { ok: false, error: 'Invalid start date' }
  let endsAt: Date | null = null
  if (r.endsAt != null && r.endsAt !== '') {
    const e = new Date(r.endsAt)
    if (isNaN(e.getTime())) return { ok: false, error: 'Invalid end date' }
    if (e.getTime() < startsAt.getTime()) return { ok: false, error: 'End must be after start' }
    endsAt = e
  }
  const location = typeof r.location === 'string' && r.location.trim() ? r.location.trim().slice(0, 500) : null
  const description = typeof r.description === 'string' && r.description ? r.description.slice(0, 2000) : null
  return { ok: true, value: { title, startsAt, endsAt, allDay: r.allDay === true, isOnline: r.isOnline === true, location, description } }
}

export type EventDTO = {
  id: string
  title: string
  startsAt: string
  endsAt: string | null
  allDay: boolean
  isOnline: boolean
  location: string | null
  description: string | null
}

export function toEventDTO(row: {
  id: string; title: string; startsAt: Date; endsAt: Date | null
  allDay: boolean; isOnline: boolean; location: string | null; description: string | null
}): EventDTO {
  return {
    id: row.id, title: row.title,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt ? row.endsAt.toISOString() : null,
    allDay: row.allDay, isOnline: row.isOnline, location: row.location, description: row.description,
  }
}
```

- [ ] **Step 4: Run test → passes.** **Step 5: Commit** `git add src/lib/hub-events.* && git commit -m "feat(events): event validate + DTO helpers"`.

---

### Task 3: Notification type `hub_event`

**Files:** Modify `src/lib/notifications-format.ts`.

**Interfaces:** Produces the `hub_event` notification type + format string.

- [ ] **Step 1:** Add `'hub_event'` to the `NotificationType` union (append to the existing union in `notifications-format.ts:1`).
- [ ] **Step 2:** Add a case in `formatNotification`:
```ts
    case 'hub_event':
      return `${n.actorName} added an event in ${n.contextText ? `“${n.contextText}”` : 'a community'}`
```
- [ ] **Step 3:** `pnpm exec tsc --noEmit` → exit 0. **Commit** `git commit -am "feat(events): hub_event notification type"`.

Note: `notifications.ts` writes the `type` string through generically; no enum there to change (verify with a grep — if `notifications.ts` narrows the type, widen it). `notifyHubMembers` accepts a `type` string.

---

### Task 4: Events API (`GET`/`POST` + `[eventId]` `PATCH`/`DELETE`)

**Files:** Create `src/app/api/hubs/[id]/events/route.ts` (+ `route.test.ts`), `src/app/api/hubs/[id]/events/[eventId]/route.ts` (+ `route.test.ts`).

**Interfaces:**
- Consumes `validateEventInput`/`toEventDTO` (`@/lib/hub-events`), `canModerate` (`@/lib/community`), `canViewCommunityHub` (`@/lib/community`), `notifyHubMembers` + `postNotifyTargets`.
- `GET` → `{ events: EventDTO[] }` (default upcoming; `?scope=all` = all). `POST` → `{ id }` 201. `PATCH`/`DELETE` → `{ ok: true }`.

- [ ] **Step 1: Write the failing test** `src/app/api/hubs/[id]/events/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({ getUser: vi.fn() }))
vi.mock('@/lib/rate-limit', () => ({ rateLimit: vi.fn().mockResolvedValue(null) }))
vi.mock('@/lib/notifications', () => ({ notifyHubMembers: vi.fn() }))
vi.mock('@/lib/db', () => ({
  db: {
    hub: { findUnique: vi.fn() },
    hubCollaborator: { findMany: vi.fn() },
    hubMember: { findMany: vi.fn() },
    hubEvent: { findMany: vi.fn(), create: vi.fn() },
  },
}))

import { getUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { notifyHubMembers } from '@/lib/notifications'
import { GET, POST } from './route'

const ctx = { params: Promise.resolve({ id: 'h1' }) }
const post = (b: unknown) => new Request('http://localhost/api/hubs/h1/events', { method: 'POST', body: JSON.stringify(b) }) as any
const get = (url = 'http://localhost/api/hubs/h1/events') => new Request(url, { method: 'GET' }) as any

beforeEach(() => {
  vi.clearAllMocks()
  ;(db.hub.findUnique as any).mockResolvedValue({ id: 'h1', userId: 'owner', community: true, published: true, title: 'Club', slug: 'club', user: { username: 'o' } })
  ;(db.hubCollaborator.findMany as any).mockResolvedValue([])
  ;(db.hubMember.findMany as any).mockResolvedValue([{ userId: 'm1' }])
  ;(db.hubEvent.findMany as any).mockResolvedValue([])
  ;(db.hubEvent.create as any).mockResolvedValue({ id: 'e1' })
})

describe('POST /events', () => {
  it('403 for a non-privileged member', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'm1', name: 'M', username: 'm1', avatar: null })
    const res = await POST(post({ title: 'X', startsAt: '2026-08-01T19:00:00Z' }), ctx)
    expect(res.status).toBe(403)
  })
  it('400 on invalid input', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'owner', name: 'O', username: 'o', avatar: null })
    expect((await POST(post({ startsAt: 'x' }), ctx)).status).toBe(400)
  })
  it('owner creates + notifies members', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'owner', name: 'O', username: 'o', avatar: null })
    const res = await POST(post({ title: 'Kickoff', startsAt: '2026-08-01T19:00:00Z' }), ctx)
    expect(res.status).toBe(201)
    expect(db.hubEvent.create).toHaveBeenCalled()
    const [targets, input] = (notifyHubMembers as any).mock.calls[0]
    expect([...targets]).toEqual(['m1'])
    expect(input.type).toBe('hub_event')
  })
})

describe('GET /events', () => {
  it('returns upcoming DTOs by default', async () => {
    ;(getUser as any).mockResolvedValue(null)
    ;(db.hubEvent.findMany as any).mockResolvedValue([{ id: 'e1', title: 'K', startsAt: new Date('2026-08-01T19:00:00Z'), endsAt: null, allDay: false, isOnline: true, location: null, description: null }])
    const res = await GET(get(), ctx)
    const body = await res.json()
    expect(body.events[0]).toMatchObject({ id: 'e1', isOnline: true, startsAt: '2026-08-01T19:00:00.000Z' })
    // default upcoming filter: startsAt gte was passed
    const arg = (db.hubEvent.findMany as any).mock.calls[0][0]
    expect(arg.where.startsAt).toBeDefined()
  })
})
```

- [ ] **Step 2: Run test → fails.**

- [ ] **Step 3: Implement** `src/app/api/hubs/[id]/events/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'
import { canModerate, canViewCommunityHub, postNotifyTargets } from '@/lib/community'
import { rateLimit } from '@/lib/rate-limit'
import { notifyHubMembers } from '@/lib/notifications'
import { validateEventInput, toEventDTO } from '@/lib/hub-events'
import type { Prisma } from '@prisma/client'

async function collaboratorIds(hubId: string): Promise<string[]> {
  const rows = await db.hubCollaborator.findMany({ where: { hubId }, select: { userId: true } })
  return rows.map((r) => r.userId)
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const hub = await db.hub.findUnique({ where: { id }, select: { id: true, userId: true, community: true, published: true } })
  if (!hub || !hub.community) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const me = await getUser(request)
  const isPrivileged = !!me && (me.id === hub.userId || (await collaboratorIds(id)).includes(me.id))
  if (!canViewCommunityHub({ published: hub.published, isPrivileged })) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const scope = new URL(request.url).searchParams.get('scope')
  const where: Prisma.HubEventWhereInput = scope === 'all' ? { hubId: id } : { hubId: id, startsAt: { gte: new Date() } }
  const rows = await db.hubEvent.findMany({ where, orderBy: { startsAt: 'asc' }, take: scope === 'all' ? 200 : 50 })
  return NextResponse.json({ events: rows.map(toEventDTO) })
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const limited = await rateLimit(request, { limit: 20, windowMs: 60_000, prefix: 'hub-event-create' })
  if (limited) return limited
  const me = await getUser(request)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const hub = await db.hub.findUnique({ where: { id }, select: { id: true, userId: true, community: true, title: true, slug: true, user: { select: { username: true } } } })
  if (!hub || !hub.community) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const collabIds = await collaboratorIds(id)
  if (!canModerate(me.id, hub, collabIds)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const parsed = validateEventInput(await request.json().catch(() => ({})))
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
  const v = parsed.value
  const event = await db.hubEvent.create({
    data: { hubId: id, title: v.title, startsAt: v.startsAt, endsAt: v.endsAt, allDay: v.allDay, isOnline: v.isOnline, location: v.location, description: v.description },
  })
  const memberIds = (await db.hubMember.findMany({ where: { hubId: id }, select: { userId: true } })).map((m) => m.userId)
  const targets = postNotifyTargets({ authorId: me.id, ownerId: hub.userId, collabIds, memberIds })
  await notifyHubMembers(targets, {
    type: 'hub_event',
    actor: { id: me.id, name: me.name || me.username, avatar: me.avatar },
    entityUrl: `/${hub.user.username}/hub/${hub.slug}`,
    contextText: hub.title,
  })
  return NextResponse.json({ id: event.id }, { status: 201 })
}
```

- [ ] **Step 4:** Implement `src/app/api/hubs/[id]/events/[eventId]/route.ts` (PATCH + DELETE, `canModerate` + IDOR scope):

```ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'
import { canModerate } from '@/lib/community'
import { validateEventInput } from '@/lib/hub-events'

async function gate(request: NextRequest, id: string, eventId: string) {
  const me = await getUser(request)
  if (!me) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const hub = await db.hub.findUnique({ where: { id }, select: { id: true, userId: true, community: true } })
  if (!hub || !hub.community) return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) }
  const collabIds = (await db.hubCollaborator.findMany({ where: { hubId: id }, select: { userId: true } })).map((r) => r.userId)
  if (!canModerate(me.id, hub, collabIds)) return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  const event = await db.hubEvent.findFirst({ where: { id: eventId, hubId: id }, select: { id: true } })
  if (!event) return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) }
  return { ok: true as const }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string; eventId: string }> }) {
  const { id, eventId } = await params
  const g = await gate(request, id, eventId)
  if ('error' in g) return g.error
  const parsed = validateEventInput(await request.json().catch(() => ({})))
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
  const v = parsed.value
  await db.hubEvent.update({ where: { id: eventId }, data: { title: v.title, startsAt: v.startsAt, endsAt: v.endsAt, allDay: v.allDay, isOnline: v.isOnline, location: v.location, description: v.description } })
  return NextResponse.json({ ok: true })
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string; eventId: string }> }) {
  const { id, eventId } = await params
  const g = await gate(request, id, eventId)
  if ('error' in g) return g.error
  await db.hubEvent.delete({ where: { id: eventId } })
  return NextResponse.json({ ok: true })
}
```

Add a minimal `[eventId]/route.test.ts` (mirror the mock style): 403 for member PATCH, 404 for an event not in the hub (IDOR), 200 for owner delete.

- [ ] **Step 5:** Run both event route test files → pass. `pnpm exec tsc --noEmit` → 0. **Commit** `git commit -m "feat(events): events API (list/create+notify/patch/delete)"`.

---

### Task 5: Config `'events'` widget + sidebar render

**Files:** Modify `src/lib/types/hub-config.ts`, `src/lib/hub-config.test.ts`, `src/components/hub/community/CommunitySidebar.tsx`, `src/components/hub/community/CommunityHubView.tsx`, `src/components/hub/builder/LayoutSectionsSection.tsx`.

**Interfaces:** `HUB_SIDEBAR_KEYS` gains `'events'`; `CommunitySidebar` gains `events?: EventDTO[]`; `CommunityHubView` gains `events?: EventDTO[]`.

- [ ] **Step 1: Config types** — in `src/lib/types/hub-config.ts`:
```ts
export const HUB_SIDEBAR_KEYS = ['video', 'members', 'events', 'resources'] as const
```
and add `{ key: 'events', enabled: true }` to `DEFAULT_HUB_CONFIG.sidebar` between `members` and `resources`:
```ts
  sidebar: [
    { key: 'video', enabled: true },
    { key: 'members', enabled: true },
    { key: 'events', enabled: true },
    { key: 'resources', enabled: true },
  ],
```

- [ ] **Step 2: Update `hub-config.test.ts`** for the new key:
- The append test (`['video','bogus','video']`) now expects `['video', 'members', 'events', 'resources']`:
```ts
    expect(out.sidebar.map((s) => s.key)).toEqual(['video', 'members', 'events', 'resources'])
```
(the `null → DEFAULT_HUB_CONFIG` test needs no change — it compares against the default object directly). Run `pnpm exec vitest run src/lib/hub-config.test.ts` → pass.

- [ ] **Step 3: LayoutSectionsSection LABEL** — the `LABELS: Record<HubSidebarKey, string>` MUST include the new key (tsc requires exhaustiveness). Add:
```ts
const LABELS: Record<HubSidebarKey, string> = { members: 'Members', resources: 'Resources', video: 'Video hero', events: 'Upcoming events' }
```

- [ ] **Step 4: CommunitySidebar events widget** — add an `events?: EventDTO[]` prop (default `[]`) and an `'events'` case in `widget()`. Import `type { EventDTO } from '@/lib/hub-events'`. IMPORTANT: the current `widget()` falls through to the resources branch for any non-video/non-members key — you MUST add an explicit `if (key === 'events')` branch BEFORE the resources fallthrough, else events renders as resources.

Add to the destructure + type: `events = []` / `events?: EventDTO[]`. Add a `showAllEvents` state. Insert this branch after the `members` branch and before the resources fallthrough:
```tsx
    if (key === 'events') {
      const upcoming = events // already upcoming from the server; empty ⇒ hide
      if (upcoming.length === 0) return null
      return (
        <section key="events" className="rounded-2xl border border-border bg-surface p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-semibold"><CalendarDays className="h-4 w-4 text-primary" /> Upcoming</h3>
            {upcoming.length > 3 && <button onClick={() => setShowEvents(true)} className="text-xs text-primary hover:underline">View all →</button>}
          </div>
          <ul className="space-y-3">
            {upcoming.slice(0, 3).map((e) => (
              <li key={e.id} className="flex gap-3">
                <EventDateChip iso={e.startsAt} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{e.title}</p>
                  <p className="text-xs text-muted-foreground">{eventWhen(e)}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )
    }
```
Add helper components/functions at the bottom of the file:
```tsx
function EventDateChip({ iso }: { iso: string }) {
  const d = new Date(iso)
  const mon = d.toLocaleString('en-US', { month: 'short' }).toUpperCase()
  return (
    <span className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-lg bg-galli/10 text-primary">
      <span className="text-[10px] font-semibold leading-none">{mon}</span>
      <span className="text-base font-bold leading-none">{d.getDate()}</span>
    </span>
  )
}
function eventWhen(e: EventDTO): string {
  const d = new Date(e.startsAt)
  const day = d.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  const time = e.allDay ? 'All day' : d.toLocaleString('en-US', { hour: 'numeric', minute: '2-digit' })
  const where = e.isOnline ? ' · Online' : ''
  return `${day} · ${time}${where}`
}
```
Import `CalendarDays` from lucide. Add a `showEvents` state (`const [showEvents, setShowEvents] = useState(false)`) and a "View all" events `<Modal>` at the bottom (mirror the Members/Resources modals) listing all `events` with `eventWhen`.

- [ ] **Step 5: Thread the prop** — `CommunitySidebar` is called from `CommunityHubView`; add `events` to `CommunityHubView` props (`events?: EventDTO[]`, import the type) and pass `events={events}` to `<CommunitySidebar>`. (No change needed to `HubBuilderPreview` — `events` defaults to `[]`, so the preview shows no events widget, consistent with empty members/resources.)

- [ ] **Step 6:** `pnpm exec tsc --noEmit` → 0; `pnpm exec next lint --file src/components/hub/community/CommunitySidebar.tsx --file src/components/hub/community/CommunityHubView.tsx --file src/components/hub/builder/LayoutSectionsSection.tsx --file src/lib/types/hub-config.ts` → no real findings. **Commit** `git commit -m "feat(events): 'events' sidebar widget (Upcoming) + config key"`.

---

### Task 6: Public page fetches events + wires the stat

**Files:** Modify `src/app/[username]/hub/[slug]/page.tsx` (community branch).

- [ ] **Step 1:** In the community branch `Promise.all`, add two queries:
```ts
      db.hubEvent.findMany({ where: { hubId: hub.id, startsAt: { gte: new Date() } }, orderBy: { startsAt: 'asc' }, take: 6 }),
      db.hubEvent.count({ where: { hubId: hub.id, startsAt: { gte: new Date() } } }),
```
(destructure them, e.g. `[memberRows, items, postsCount, mine, eventRows, eventsCount]`). Map events with `toEventDTO` (import from `@/lib/hub-events`): `const events = eventRows.map(toEventDTO)`.

- [ ] **Step 2:** Pass to `<CommunityHubView>`: add `events={events}` and set `counts={{ posts: postsCount, members: members.length, resources: resources.length, events: eventsCount }}`.

- [ ] **Step 3:** `pnpm exec tsc --noEmit` → 0; lint the page. **Commit** `git commit -m "feat(events): public page shows upcoming events + real Events stat"`.

---

### Task 7: `HubEventsModal` + builder "Manage events"

**Files:** Create `src/components/hub/builder/HubEventsModal.tsx`; Modify `src/components/hub/builder/LayoutSectionsSection.tsx` (Manage action + `hubId` prop) and `src/components/hub/builder/HubBuilder.tsx` (pass `hubId` to LayoutSectionsSection).

- [ ] **Step 1:** `HubBuilder` renders `<LayoutSectionsSection config={config} onChange={setConfig} />` — add `hubId={merged.id}` (the loaded hub id is in `HubBuilder` state as `hub.id`/`merged.id`).

- [ ] **Step 2:** `LayoutSectionsSection` — add `hubId: string` to its props; add a `manageEvents` state; on the `events` sidebar row, render a small "Manage" button (only for the events row) that opens the modal:
```tsx
// in props: { config, onChange, hubId }
const [manageEvents, setManageEvents] = useState(false)
// inside the sidebar-row map, before the up/down buttons, add for the events row:
{w.key === 'events' && (
  <button onClick={() => setManageEvents(true)} className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:text-foreground">Manage</button>
)}
// after the outermost wrapper:
{manageEvents && <HubEventsModal hubId={hubId} onClose={() => setManageEvents(false)} />}
```
Import `useState` + `HubEventsModal`.

- [ ] **Step 3:** Implement `HubEventsModal.tsx` — a modal that loads `GET /api/hubs/{hubId}/events?scope=all`, lists events, and has an add/edit form (title, a `datetime-local` start, optional `datetime-local` end, all-day checkbox, Online checkbox, location/URL, description) + delete. On save: `POST` (create) or `PATCH` (edit) with `startsAt`/`endsAt` as ISO (`new Date(localValue).toISOString()`); on delete: `DELETE`. Re-fetch after each mutation. Full component:

```tsx
'use client'

import { useEffect, useState } from 'react'
import { X, Plus, Trash2, Loader2 } from 'lucide-react'
import type { EventDTO } from '@/lib/hub-events'

type Draft = { id?: string; title: string; start: string; end: string; allDay: boolean; isOnline: boolean; location: string; description: string }
const EMPTY: Draft = { title: '', start: '', end: '', allDay: false, isOnline: false, location: '', description: '' }

// ISO <-> <input type="datetime-local"> (local time, no seconds)
function toLocal(iso: string): string {
  const d = new Date(iso); const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

export function HubEventsModal({ hubId, onClose }: { hubId: string; onClose: () => void }) {
  const [events, setEvents] = useState<EventDTO[]>([])
  const [draft, setDraft] = useState<Draft | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = () => fetch(`/api/hubs/${hubId}/events?scope=all`).then((r) => (r.ok ? r.json() : { events: [] })).then((d) => setEvents(d.events ?? []))
  useEffect(() => { load() }, [hubId])

  async function save() {
    if (!draft) return
    setBusy(true); setError(null)
    const body = {
      title: draft.title.trim(),
      startsAt: draft.start ? new Date(draft.start).toISOString() : '',
      endsAt: draft.end ? new Date(draft.end).toISOString() : null,
      allDay: draft.allDay, isOnline: draft.isOnline,
      location: draft.location.trim(), description: draft.description.trim(),
    }
    const url = draft.id ? `/api/hubs/${hubId}/events/${draft.id}` : `/api/hubs/${hubId}/events`
    const res = await fetch(url, { method: draft.id ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    if (!res.ok) { setError((await res.json().catch(() => ({}))).error || 'Failed'); setBusy(false); return }
    setDraft(null); setBusy(false); await load()
  }
  async function del(id: string) {
    if (!window.confirm('Delete this event?')) return
    await fetch(`/api/hubs/${hubId}/events/${id}`, { method: 'DELETE' }); await load()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-surface p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">Events</h2>
          <button onClick={onClose} className="rounded-md p-1 text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>

        {draft ? (
          <div className="space-y-3">
            <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="Event title" className="w-full rounded-lg border border-border bg-transparent px-3 py-2 text-sm" />
            <label className="block text-xs font-medium text-muted-foreground">Starts
              <input type="datetime-local" value={draft.start} onChange={(e) => setDraft({ ...draft, start: e.target.value })} className="mt-1 w-full rounded-lg border border-border bg-transparent px-3 py-2 text-sm" />
            </label>
            <label className="block text-xs font-medium text-muted-foreground">Ends (optional)
              <input type="datetime-local" value={draft.end} onChange={(e) => setDraft({ ...draft, end: e.target.value })} className="mt-1 w-full rounded-lg border border-border bg-transparent px-3 py-2 text-sm" />
            </label>
            <div className="flex gap-4 text-sm">
              <label className="flex items-center gap-2"><input type="checkbox" checked={draft.allDay} onChange={(e) => setDraft({ ...draft, allDay: e.target.checked })} className="accent-galli" /> All day</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={draft.isOnline} onChange={(e) => setDraft({ ...draft, isOnline: e.target.checked })} className="accent-galli" /> Online</label>
            </div>
            <input value={draft.location} onChange={(e) => setDraft({ ...draft, location: e.target.value })} placeholder={draft.isOnline ? 'Join URL' : 'Location'} className="w-full rounded-lg border border-border bg-transparent px-3 py-2 text-sm" />
            <textarea value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} placeholder="Description (optional)" rows={2} className="w-full rounded-lg border border-border bg-transparent px-3 py-2 text-sm" />
            {error && <p className="text-sm text-red-500">{error}</p>}
            <div className="flex justify-end gap-2">
              <button onClick={() => setDraft(null)} className="rounded-lg px-4 py-2 text-sm text-muted-foreground">Cancel</button>
              <button onClick={save} disabled={busy || !draft.title.trim() || !draft.start} className="inline-flex items-center gap-1.5 rounded-lg bg-galli px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Save</button>
            </div>
          </div>
        ) : (
          <>
            <button onClick={() => setDraft(EMPTY)} className="mb-3 inline-flex items-center gap-1.5 rounded-lg bg-galli px-4 py-2 text-sm font-medium text-white"><Plus className="h-4 w-4" /> New event</button>
            {events.length === 0 ? (
              <p className="text-sm text-muted-foreground">No events yet.</p>
            ) : (
              <ul className="space-y-2">
                {events.map((e) => (
                  <li key={e.id} className="flex items-center justify-between rounded-xl border border-border p-3">
                    <button onClick={() => setDraft({ id: e.id, title: e.title, start: toLocal(e.startsAt), end: e.endsAt ? toLocal(e.endsAt) : '', allDay: e.allDay, isOnline: e.isOnline, location: e.location ?? '', description: e.description ?? '' })} className="min-w-0 flex-1 text-left">
                      <span className="block truncate text-sm font-medium">{e.title}</span>
                      <span className="block text-xs text-muted-foreground">{new Date(e.startsAt).toLocaleString()}</span>
                    </button>
                    <button onClick={() => del(e.id)} className="ml-2 text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4:** `pnpm exec tsc --noEmit` → 0; lint the 3 files. **Commit** `git commit -m "feat(events): builder Manage-events modal"`.

---

### Task 8: End-to-end verification

**Files:** none (verification only) — fresh isolated DB `pages_m3a` + real login (mirror the M1/M2 smoke pattern).

- [ ] **Step 1: Static gates** — `pnpm exec tsc --noEmit` (0); `pnpm test` (M3a suites green; the machine may be loaded — run patiently); `pnpm exec next lint` (distinguish the known warning). 
- [ ] **Step 2: Boot dev** against `pages_m3a` with inline env (and `JWT_SECRET` inline from `.env`, quotes stripped); wait for "Ready in".
- [ ] **Step 3: Scripted E2E** `_m3a-e2e.mjs` (login-cookie approach): seed owner + member (bcrypt `smoke1234`); owner creates a community; then assert:
  1. Owner `POST /api/hubs/{id}/events { title, startsAt: <future ISO> }` → 201; a `Notification` row exists for the member.
  2. Member `POST .../events` → 403.
  3. `GET .../events` (no scope) → returns the upcoming event; `?scope=all` includes it too.
  4. `GET /{owner}/hub/{slug}` public HTML → the event title appears (Upcoming widget) and the Events stat shows 1.
  5. `PATCH .../events/{eventId}` (owner) changes the title → 200; a member's PATCH → 403; PATCH with an eventId from a DIFFERENT hub → 404 (IDOR).
  6. `DELETE .../events/{eventId}` (owner) → 200; `GET` no longer returns it; public Events stat → 0.
  Print PASS/FAIL per assertion.
- [ ] **Step 4: Cleanup** — kill ONLY the dev PID you started (`taskkill //F //PID <pid> //T`, never a blanket node kill); `rm -f _m3a-e2e.mjs`; leave `pages_m3a`.
- [ ] **Step 5: Final commit** (only if a verification fix was needed).

---

## Deployment note (post-merge)
Single additive `CREATE TABLE "HubEvent"` migration — no backfill; prod Neon-safe via the build's `prisma migrate deploy`.

## Self-review notes
- **Spec coverage:** R1 model → T1; R2 API → T4 (+ helpers T2); R3 notify → T3+T4; R4 config key → T5; R5 widget+stat → T5+T6; R6 manage modal → T7. Verification → T8.
- **Type consistency:** `EventDTO`/`NormalizedEvent` (T2) consumed by T4/T5/T6/T7. `HUB_SIDEBAR_KEYS` gaining `'events'` forces `LABELS` exhaustiveness (T5 Step 3) and a `CommunitySidebar` `'events'` branch (T5 Step 4) — both called out to avoid the "events renders as resources" fallthrough bug. `hub-config.test.ts` updated for the new key (T5 Step 2).
- **No broken intermediate:** T5 makes `CommunitySidebar` render events from an optional `events` prop (default `[]` ⇒ widget hidden); T6 then feeds real events. So between T5 and T6 the page still renders cleanly (no events shown yet).
