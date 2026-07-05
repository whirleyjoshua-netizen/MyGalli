# In-app Notifications — v1 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire in-app notifications — a `Notification` model, four server-side event hooks, three API routes, and a working bell (badge + dropdown) — for follow / bulletin / page-published / comment events.

**Architecture:** Notifications are rows in a new additive `Notification` table, created (fanned out to followers where relevant) from four existing API handlers via a small server helper. A pure formatter turns a row into display text. The dashboard bell polls an unread-count endpoint (like `PresenceBar`) and loads the list on open.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Prisma + Postgres (Neon prod), Tailwind, lucide-react, Vitest + Testing Library, pnpm.

## Global Constraints

- Message text is NOT stored; it is derived by `formatNotification()` at render.
- `formatNotification` + `NotificationType` live in a **db-free** module (`src/lib/notifications-format.ts`) so the client bell never bundles Prisma. The server helper (`src/lib/notifications.ts`) imports db and re-uses that type.
- Notification creation must NEVER break the primary action: the helper wraps its db calls in try/catch and logs on failure.
- Audience for fan-out events (`bulletin`, `page_published`) = the actor's **followers** (`db.follow.findMany({ where: { followingId: actorId } })`).
- API routes mirror the `getUser(request)` → 401 → JSON pattern (`src/lib/auth.ts:46`).
- `getUser` returns `{ id, email, username, name, avatar, bio, emailVerified, plan, tokenVersion }` — use `username`/`name`/`avatar` for the actor.
- Migrations: never `prisma migrate dev`. Add the model to `schema.prisma`, hand-write the migration SQL (provided verbatim below), run `npx prisma generate`. Vercel build runs `prisma migrate deploy`.
- **Gate each task before commit:** `npx tsc --noEmit` (exit 0) AND `npx vitest run` (full suite green). Windows + Git Bash; run test commands in FOREGROUND; do NOT run `pnpm build`. `npx prisma generate` may EPERM if a dev server holds the engine dll — retry when quiet.
- Do not stage the always-untracked files (`Documents/`, `Images/`, `g1t.json`, `nul`, `test-output.txt`, `.claude/settings.local.json`); `git add` specific paths.
- Brand violet badge color token: `bg-galli-violet`.

---

## Task 1: `Notification` model + migration

**Files:**
- Modify: `prisma/schema.prisma` (add model + User back-relation)
- Create: `prisma/migrations/20260705000000_add_notifications/migration.sql`

**Interfaces:**
- Produces: Prisma model `Notification` with fields `id, userId, type, actorId?, actorName, actorAvatar?, entityUrl?, contextText?, read, createdAt`; `db.notification` client delegate available to later tasks.

- [ ] **Step 1: Add the model to `prisma/schema.prisma`**

Append this model (near the other models, e.g. after `BulletinPost`):

```prisma
model Notification {
  id          String   @id @default(cuid())
  userId      String
  user        User     @relation("UserNotifications", fields: [userId], references: [id], onDelete: Cascade)
  type        String
  actorId     String?
  actorName   String
  actorAvatar String?
  entityUrl   String?
  contextText String?
  read        Boolean  @default(false)
  createdAt   DateTime @default(now())

  @@index([userId, createdAt])
  @@index([userId, read])
}
```

- [ ] **Step 2: Add the back-relation to the `User` model**

In `model User { ... }`, alongside the other relation arrays (e.g. near `following Follow[] @relation("Following")`), add:

```prisma
  notifications Notification[] @relation("UserNotifications")
```

- [ ] **Step 3: Create the migration SQL**

Create `prisma/migrations/20260705000000_add_notifications/migration.sql` with exactly:

```sql
-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "actorId" TEXT,
    "actorName" TEXT NOT NULL,
    "actorAvatar" TEXT,
    "entityUrl" TEXT,
    "contextText" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_userId_read_idx" ON "Notification"("userId", "read");

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

- [ ] **Step 4: Regenerate the Prisma client**

Run: `npx prisma generate`
Expected: "Generated Prisma Client". (If EPERM on Windows, stop any dev server and retry.)

- [ ] **Step 5: Verify the schema/migration agree (best-effort)**

Run: `npx prisma validate`
Expected: "The schema at prisma\schema.prisma is valid".
(Optional, needs a shadow DB — skip if it errors: `npx prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --script` should print no statements.)

- [ ] **Step 6: Gate + commit**

Run: `npx tsc --noEmit` (exit 0) — proves the regenerated client is consistent.
Run: `npx vitest run` (green).

```bash
git add prisma/schema.prisma prisma/migrations/20260705000000_add_notifications/migration.sql
git commit -m "feat(db): Notification model + migration"
```

---

## Task 2: notification helper + formatter

**Files:**
- Create: `src/lib/notifications-format.ts` (db-free: type + formatter)
- Create: `src/lib/notifications.ts` (server: create + fan-out)
- Test: `src/lib/notifications-format.test.ts`, `src/lib/notifications.test.ts`

**Interfaces:**
- Produces (`notifications-format.ts`):
  - `type NotificationType = 'follow' | 'bulletin' | 'page_published' | 'comment'`
  - `formatNotification(n: { type: string; actorName: string; contextText?: string | null }): string`
- Produces (`notifications.ts`):
  - `interface NotifyActor { id: string | null; name: string; avatar?: string | null }`
  - `createNotification(input: { userId: string; type: NotificationType; actor: NotifyActor; entityUrl?: string; contextText?: string }): Promise<void>`
  - `notifyFollowers(actorId: string, input: { type: NotificationType; actor: NotifyActor; entityUrl?: string; contextText?: string }): Promise<void>`

- [ ] **Step 1: Write the failing formatter test**

```ts
// src/lib/notifications-format.test.ts
import { describe, it, expect } from 'vitest'
import { formatNotification } from './notifications-format'

describe('formatNotification', () => {
  it('follow', () => {
    expect(formatNotification({ type: 'follow', actorName: 'Sofia' })).toBe('Sofia started following you')
  })
  it('bulletin', () => {
    expect(formatNotification({ type: 'bulletin', actorName: 'Marcus' })).toBe('Marcus posted a bulletin')
  })
  it('page_published with and without a title', () => {
    expect(formatNotification({ type: 'page_published', actorName: 'Ava', contextText: 'My Trip' })).toBe('Ava published “My Trip”')
    expect(formatNotification({ type: 'page_published', actorName: 'Ava' })).toBe('Ava published a new page')
  })
  it('comment with and without a title', () => {
    expect(formatNotification({ type: 'comment', actorName: 'Guest', contextText: 'My Trip' })).toBe('Guest commented on “My Trip”')
    expect(formatNotification({ type: 'comment', actorName: 'Guest' })).toBe('Guest commented on your page')
  })
})
```

- [ ] **Step 2: Run — expect FAIL.** `npx vitest run src/lib/notifications-format.test.ts`

- [ ] **Step 3: Implement `notifications-format.ts`**

```ts
// src/lib/notifications-format.ts
export type NotificationType = 'follow' | 'bulletin' | 'page_published' | 'comment'

export function formatNotification(n: { type: string; actorName: string; contextText?: string | null }): string {
  switch (n.type) {
    case 'follow':
      return `${n.actorName} started following you`
    case 'bulletin':
      return `${n.actorName} posted a bulletin`
    case 'page_published':
      return `${n.actorName} published ${n.contextText ? `“${n.contextText}”` : 'a new page'}`
    case 'comment':
      return `${n.actorName} commented on ${n.contextText ? `“${n.contextText}”` : 'your page'}`
    default:
      return n.actorName
  }
}
```

- [ ] **Step 4: Run — expect PASS.** `npx vitest run src/lib/notifications-format.test.ts`

- [ ] **Step 5: Write the failing helper test**

```ts
// src/lib/notifications.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  db: {
    follow: { findMany: vi.fn() },
    notification: { create: vi.fn(), createMany: vi.fn() },
  },
}))

import { db } from '@/lib/db'
import { notifyFollowers, createNotification } from './notifications'

const mockDb = db as unknown as {
  follow: { findMany: ReturnType<typeof vi.fn> }
  notification: { create: ReturnType<typeof vi.fn>; createMany: ReturnType<typeof vi.fn> }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('notifyFollowers', () => {
  it('creates one row per follower with denormalized actor + context', async () => {
    mockDb.follow.findMany.mockResolvedValue([{ followerId: 'a' }, { followerId: 'b' }])
    mockDb.notification.createMany.mockResolvedValue({ count: 2 })
    await notifyFollowers('actor1', {
      type: 'bulletin',
      actor: { id: 'actor1', name: 'Marcus', avatar: 'x.png' },
      entityUrl: '/bulletin',
    })
    expect(mockDb.notification.createMany).toHaveBeenCalledTimes(1)
    const arg = mockDb.notification.createMany.mock.calls[0][0]
    expect(arg.data).toHaveLength(2)
    expect(arg.data[0]).toMatchObject({ userId: 'a', type: 'bulletin', actorId: 'actor1', actorName: 'Marcus', actorAvatar: 'x.png', entityUrl: '/bulletin' })
    expect(arg.data[1].userId).toBe('b')
  })
  it('is a no-op when the actor has no followers', async () => {
    mockDb.follow.findMany.mockResolvedValue([])
    await notifyFollowers('actor1', { type: 'bulletin', actor: { id: 'actor1', name: 'Marcus' } })
    expect(mockDb.notification.createMany).not.toHaveBeenCalled()
  })
  it('never throws even if the db call fails', async () => {
    mockDb.follow.findMany.mockRejectedValue(new Error('db down'))
    await expect(notifyFollowers('actor1', { type: 'bulletin', actor: { id: 'actor1', name: 'M' } })).resolves.toBeUndefined()
  })
})

describe('createNotification', () => {
  it('creates a single row with a null actorId for anonymous actors', async () => {
    mockDb.notification.create.mockResolvedValue({})
    await createNotification({
      userId: 'owner1',
      type: 'comment',
      actor: { id: null, name: 'Guest' },
      entityUrl: '/josh/trip',
      contextText: 'Trip',
    })
    expect(mockDb.notification.create).toHaveBeenCalledTimes(1)
    expect(mockDb.notification.create.mock.calls[0][0].data).toMatchObject({ userId: 'owner1', type: 'comment', actorId: null, actorName: 'Guest', entityUrl: '/josh/trip', contextText: 'Trip' })
  })
})
```

- [ ] **Step 6: Run — expect FAIL.** `npx vitest run src/lib/notifications.test.ts`

- [ ] **Step 7: Implement `notifications.ts`**

```ts
// src/lib/notifications.ts
import { db } from '@/lib/db'
import type { NotificationType } from '@/lib/notifications-format'

export interface NotifyActor {
  id: string | null
  name: string
  avatar?: string | null
}

interface BaseInput {
  type: NotificationType
  actor: NotifyActor
  entityUrl?: string
  contextText?: string
}

function toRow(userId: string, input: BaseInput) {
  return {
    userId,
    type: input.type,
    actorId: input.actor.id,
    actorName: input.actor.name,
    actorAvatar: input.actor.avatar ?? null,
    entityUrl: input.entityUrl ?? null,
    contextText: input.contextText ?? null,
  }
}

export async function createNotification(input: BaseInput & { userId: string }): Promise<void> {
  try {
    await db.notification.create({ data: toRow(input.userId, input) })
  } catch (e) {
    console.error('createNotification failed', e)
  }
}

export async function notifyFollowers(actorId: string, input: BaseInput): Promise<void> {
  try {
    const followers = await db.follow.findMany({
      where: { followingId: actorId },
      select: { followerId: true },
    })
    if (followers.length === 0) return
    await db.notification.createMany({
      data: followers.map((f) => toRow(f.followerId, input)),
    })
  } catch (e) {
    console.error('notifyFollowers failed', e)
  }
}
```

- [ ] **Step 8: Run — expect PASS.** `npx vitest run src/lib/notifications.test.ts src/lib/notifications-format.test.ts`

- [ ] **Step 9: Gate + commit**

Run: `npx tsc --noEmit`; `npx vitest run`.

```bash
git add src/lib/notifications-format.ts src/lib/notifications-format.test.ts src/lib/notifications.ts src/lib/notifications.test.ts
git commit -m "feat(notifications): create/fan-out helper + formatter"
```

---

## Task 3: API routes

**Files:**
- Create: `src/app/api/notifications/route.ts` (GET list)
- Create: `src/app/api/notifications/unread-count/route.ts` (GET count)
- Create: `src/app/api/notifications/read/route.ts` (POST mark-all-read)

**Interfaces:**
- Produces: `GET /api/notifications` → `{ notifications: Row[] }`; `GET /api/notifications/unread-count` → `{ count: number }`; `POST /api/notifications/read` → `{ ok: true }`.

- [ ] **Step 1: Create the unread-count route**

```ts
// src/app/api/notifications/unread-count/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const me = await getUser(request)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const count = await db.notification.count({ where: { userId: me.id, read: false } })
  return NextResponse.json({ count })
}
```

- [ ] **Step 2: Create the list route**

```ts
// src/app/api/notifications/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const me = await getUser(request)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const notifications = await db.notification.findMany({
    where: { userId: me.id },
    orderBy: { createdAt: 'desc' },
    take: 30,
  })
  return NextResponse.json({ notifications })
}
```

- [ ] **Step 3: Create the mark-all-read route**

```ts
// src/app/api/notifications/read/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'

export async function POST(request: NextRequest) {
  const me = await getUser(request)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  await db.notification.updateMany({
    where: { userId: me.id, read: false },
    data: { read: true },
  })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 4: Gate + commit**

Run: `npx tsc --noEmit` (exit 0 — proves the routes typecheck against the client). Run: `npx vitest run` (green).

```bash
git add src/app/api/notifications
git commit -m "feat(notifications): list / unread-count / mark-read API routes"
```

---

## Task 4: wire the four event hooks

**Files:**
- Modify: `src/app/api/users/[username]/follow/route.ts` (POST)
- Modify: `src/app/api/bulletin/route.ts` (POST)
- Modify: `src/app/api/displays/[id]/route.ts` (PATCH)
- Modify: `src/app/api/displays/[id]/comments/route.ts` (POST)

**Interfaces:**
- Consumes: `createNotification`, `notifyFollowers` from `@/lib/notifications`.

- [ ] **Step 1: Follow → notify the followed user (new follows only)**

In `follow/route.ts`, add the import `import { createNotification } from '@/lib/notifications'`. Replace the `upsert` block in `POST` (lines 22-27) with:

```ts
    const existing = await db.follow.findUnique({
      where: { followerId_followingId: { followerId: me.id, followingId: target.id } },
      select: { followerId: true },
    })
    await db.follow.upsert({
      where: { followerId_followingId: { followerId: me.id, followingId: target.id } },
      create: { followerId: me.id, followingId: target.id },
      update: {},
    })
    if (!existing) {
      await createNotification({
        userId: target.id,
        type: 'follow',
        actor: { id: me.id, name: me.name || me.username, avatar: me.avatar },
        entityUrl: `/${me.username}`,
      })
    }
    return NextResponse.json({ following: true })
```

- [ ] **Step 2: Bulletin → notify the author's followers**

In `bulletin/route.ts`, add `import { notifyFollowers } from '@/lib/notifications'`. After the `post` is created (after line 39, before the `return`), add:

```ts
    await notifyFollowers(me.id, {
      type: 'bulletin',
      actor: { id: me.id, name: me.name || me.username, avatar: me.avatar },
      entityUrl: '/bulletin',
    })
```

- [ ] **Step 3: Publish → notify the owner's followers (false→true only)**

In `displays/[id]/route.ts`, add `import { notifyFollowers } from '@/lib/notifications'`. In `PATCH`, after `const updated = await db.display.update(...)` (line 107) and before `return NextResponse.json(updated)`, add:

```ts
    if (data.published === true && display.published === false) {
      await notifyFollowers(user.id, {
        type: 'page_published',
        actor: { id: user.id, name: user.name || user.username, avatar: user.avatar },
        entityUrl: `/${user.username}/${display.slug}`,
        contextText: (data.title as string | undefined) ?? display.title,
      })
    }
```

(`display` is the pre-update row loaded at line 66, so `display.published` is the OLD value; `display.slug`/`display.title` are available because the `findUnique` selects all scalar fields.)

- [ ] **Step 4: Comment → notify the page owner**

In `comments/route.ts`, add `import { createNotification } from '@/lib/notifications'`. Change the display lookup in `POST` (line 51-53) to include the owner's username:

```ts
    const display = await db.display.findUnique({
      where: { id: id },
      include: { user: { select: { username: true } } },
    })
```

Then after `const comment = await db.comment.create(...)` (line 87), before the `return`, add:

```ts
    await createNotification({
      userId: display.userId,
      type: 'comment',
      actor: { id: null, name: comment.authorName },
      entityUrl: `/${display.user.username}/${display.slug}`,
      contextText: display.title,
    })
```

- [ ] **Step 5: Gate + commit**

Run: `npx tsc --noEmit` (exit 0). Run: `npx vitest run` (green — existing route behavior unchanged; helper already tested).

```bash
git add "src/app/api/users/[username]/follow/route.ts" src/app/api/bulletin/route.ts "src/app/api/displays/[id]/route.ts" "src/app/api/displays/[id]/comments/route.ts"
git commit -m "feat(notifications): emit on follow, bulletin, publish, comment"
```

---

## Task 5: NotificationBell UI

**Files:**
- Create: `src/lib/time-ago.ts` (extracted shared helper)
- Modify: `src/components/bulletin/BulletinPostCard.tsx` (use the shared helper)
- Create: `src/components/dashboard/NotificationBell.tsx`
- Modify: `src/app/(dashboard)/dashboard/page.tsx` (swap the Bell stub)
- Test: `src/components/dashboard/NotificationBell.test.tsx`

**Interfaces:**
- Consumes: `formatNotification` from `@/lib/notifications-format`; the three API routes from Task 3.
- Produces: `timeAgo(dateStr: string): string` in `@/lib/time-ago`; `<NotificationBell />` component.

- [ ] **Step 1: Extract `timeAgo` into a shared module**

Create `src/lib/time-ago.ts`:

```ts
// src/lib/time-ago.ts
export function timeAgo(dateStr: string): string {
  const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000)
  if (mins < 1) return 'now'
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  return `${Math.floor(hrs / 24)}d`
}
```

In `src/components/bulletin/BulletinPostCard.tsx`, delete the local `function timeAgo(...) {...}` (lines 23-30) and add `import { timeAgo } from '@/lib/time-ago'` with the other imports.

- [ ] **Step 2: Write the failing bell test**

```tsx
// src/components/dashboard/NotificationBell.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { NotificationBell } from './NotificationBell'

const rows = [
  { id: 'n1', type: 'follow', actorName: 'Sofia', actorAvatar: null, entityUrl: '/sofia', contextText: null, read: false, createdAt: new Date().toISOString() },
]

function jsonRes(body: unknown) {
  return Promise.resolve({ ok: true, json: () => Promise.resolve(body) } as Response)
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn((url: string, opts?: RequestInit) => {
    if (url === '/api/notifications/unread-count') return jsonRes({ count: 2 })
    if (url === '/api/notifications') return jsonRes({ notifications: rows })
    if (url === '/api/notifications/read') return jsonRes({ ok: true })
    return jsonRes({})
  }))
})
afterEach(() => vi.unstubAllGlobals())

describe('NotificationBell', () => {
  it('shows the unread badge from the poll', async () => {
    render(<NotificationBell />)
    expect(await screen.findByText('2')).toBeInTheDocument()
  })
  it('opens the dropdown, lists notifications, and marks them read', async () => {
    render(<NotificationBell />)
    await screen.findByText('2')
    fireEvent.click(screen.getByLabelText('Notifications'))
    expect(await screen.findByText('Sofia started following you')).toBeInTheDocument()
    await waitFor(() => {
      expect((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.some((c) => c[0] === '/api/notifications/read')).toBe(true)
    })
  })
})
```

- [ ] **Step 3: Run — expect FAIL.** `npx vitest run src/components/dashboard/NotificationBell.test.tsx`

- [ ] **Step 4: Implement `NotificationBell.tsx`**

```tsx
// src/components/dashboard/NotificationBell.tsx
'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Bell } from 'lucide-react'
import { formatNotification } from '@/lib/notifications-format'
import { timeAgo } from '@/lib/time-ago'

interface NotificationRow {
  id: string
  type: string
  actorName: string
  actorAvatar: string | null
  entityUrl: string | null
  contextText: string | null
  read: boolean
  createdAt: string
}

export function NotificationBell() {
  const [unread, setUnread] = useState(0)
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<NotificationRow[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let active = true
    const load = () => {
      fetch('/api/notifications/unread-count')
        .then((r) => (r.ok ? r.json() : { count: 0 }))
        .then((d) => { if (active) setUnread(d.count || 0) })
        .catch(() => {})
    }
    load()
    const t = setInterval(load, 45000)
    return () => { active = false; clearInterval(t) }
  }, [])

  const openMenu = async () => {
    setOpen(true)
    setLoading(true)
    try {
      const r = await fetch('/api/notifications')
      const d = r.ok ? await r.json() : { notifications: [] }
      setItems(d.notifications || [])
      if (unread > 0) {
        await fetch('/api/notifications/read', { method: 'POST' })
        setUnread(0)
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative">
      <button
        aria-label="Notifications"
        onClick={() => (open ? setOpen(false) : openMenu())}
        className="relative w-10 h-10 rounded-full border border-border bg-surface flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
      >
        <Bell className="w-4 h-4" />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-galli-violet text-white text-[10px] font-bold flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 z-50 w-80 max-w-[90vw] bg-surface border border-border rounded-xl shadow-soft-lg overflow-hidden">
            <div className="px-4 py-2.5 border-b border-border text-sm font-semibold">Notifications</div>
            <div className="max-h-96 overflow-y-auto">
              {loading ? (
                <p className="px-4 py-6 text-center text-sm text-muted-foreground">Loading…</p>
              ) : items.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-muted-foreground">You&apos;re all caught up 🎉</p>
              ) : (
                items.map((n) => {
                  const initial = (n.actorName || '?').charAt(0).toUpperCase()
                  const body = (
                    <div className="flex items-start gap-3 px-4 py-3 hover:bg-muted transition-colors">
                      {n.actorAvatar ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={n.actorAvatar} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
                      ) : (
                        <span className="w-8 h-8 rounded-full bg-primary/15 text-primary font-bold text-sm flex items-center justify-center shrink-0">{initial}</span>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-foreground leading-snug">{formatNotification(n)}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{timeAgo(n.createdAt)}</p>
                      </div>
                    </div>
                  )
                  return n.entityUrl ? (
                    <Link key={n.id} href={n.entityUrl} onClick={() => setOpen(false)}>{body}</Link>
                  ) : (
                    <div key={n.id}>{body}</div>
                  )
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 5: Run — expect PASS.** `npx vitest run src/components/dashboard/NotificationBell.test.tsx`

- [ ] **Step 6: Swap the stub in the dashboard header**

In `src/app/(dashboard)/dashboard/page.tsx`: add `import { NotificationBell } from '@/components/dashboard/NotificationBell'` with the other imports. Replace the static notifications button block (currently lines ~179-185, the `<button aria-label="Notifications">…</button>` with the `Bell` and the decorative dot span) with:

```tsx
            <NotificationBell />
```

If `Bell` is now unused in `page.tsx`, remove it from the lucide import to keep tsc/eslint clean.

- [ ] **Step 7: Gate + commit**

Run: `npx tsc --noEmit` (exit 0). Run: `npx vitest run` (green).

```bash
git add src/lib/time-ago.ts src/components/bulletin/BulletinPostCard.tsx src/components/dashboard/NotificationBell.tsx src/components/dashboard/NotificationBell.test.tsx "src/app/(dashboard)/dashboard/page.tsx"
git commit -m "feat(notifications): NotificationBell (badge + dropdown) wired into dashboard"
```

---

## Verification (end-to-end, after all tasks)

1. `npx tsc --noEmit` clean; `npx vitest run` fully green.
2. Manual smoke against a running dev server / prod preview (auth as a seeded demo user):
   - Follow a demo account from a second account → the followed account's `GET /api/notifications` returns a `follow` row; bell badge increments.
   - Post a bulletin → each follower gets a `bulletin` row.
   - Publish a page (flip published false→true) → followers get a `page_published` row linking to `/username/slug`.
   - Post a comment on a published page → the owner gets a `comment` row.
   - Open the bell → dropdown lists them, badge clears, `read` flips true.
3. Prod: the additive `add_notifications` migration applies via the Vercel build's `prisma migrate deploy` (no existing tables altered).

## Self-review notes (checked against spec)

- **Coverage:** model+migration (T1), helper+formatter+fan-out (T2), 3 API routes (T3), 4 event hooks with exact recipients/URLs (T4), bell UI + stub swap (T5). All spec sections mapped. ✔
- **db-in-client hazard avoided:** `formatNotification`/`NotificationType` isolated in `notifications-format.ts` (no db import); the client bell imports only from there + `time-ago.ts`. ✔
- **Never-break-primary-action:** helper wraps db calls in try/catch (tested). ✔
- **Type consistency:** `NotifyActor`, `NotificationType`, and the `toRow` shape match the `Notification` model fields and the routes' reads. ✔
- **Follow dedup / publish transition:** pre-check `findUnique` (follow) and `display.published === false` guard (publish) prevent duplicate/spurious notifications. ✔
