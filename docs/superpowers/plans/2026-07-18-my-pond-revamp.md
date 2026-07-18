# My Pond Page Revamp Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the `/shared` "My Pond" page to match the approved mockup — pond-themed hero, dismissible welcome banner, working search/filter/sort/view toolbar, richer community/collab cards, and a static guidance rail.

**Architecture:** The page stays a client orchestrator (`MyPondContent`) that fetches communities + collabs and holds toolbar/view/tab state. Presentational pieces live in `src/components/pond/`. One additive backend change enriches `GET /api/communities/joined`. All filtering/sorting is in-memory via a pure helper in `src/lib/pond.ts`.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Tailwind, Prisma, Vitest, lucide-react icons.

## Global Constraints

- Package manager: `pnpm`. Tests: `pnpm test`. Types: `pnpm exec tsc --noEmit`. Lint: `pnpm exec next lint` (must pass — lint failures break prod deploy).
- Prisma commands need `DATABASE_URL="postgresql://pages:pages@127.0.0.1:5434/pages"` (127.0.0.1, not localhost). **No migration in this plan** (no schema change).
- Brand: Plus Jakarta Sans; tokens `--primary`, `--surface`, `--border`, `--muted-foreground`, `galli.*`; `rounded-2xl`, `shadow-soft`. Escape apostrophes in JSX (`&apos;`) — `react/no-unescaped-entities` breaks the build.
- Assets already in `public/pond/`: `hero-sign.png` (transparent), `welcome-banner.png`.
- Left sidebar/taskbar is OUT OF SCOPE — do not touch `src/components/dashboard/*`.
- Relative time uses the existing `timeAgo(dateStr: string): string` from `src/lib/time-ago.ts` (returns `now`/`12m`/`3h`/`5d`).
- The ⋮ card menu is non-destructive this pass (Open, Copy link). No "← Back" link. No "Learn more" link (text-free — just the four guidance items).

---

### Task 1: Enrich the joined-communities API

**Files:**
- Modify: `src/app/api/communities/joined/route.ts`
- Test (create): `src/app/api/communities/joined/route.test.ts`

**Interfaces:**
- Produces: `GET /api/communities/joined` → `{ communities: PondCommunity[] }` where
  ```ts
  type PondCommunity = {
    id: string; title: string; username: string; slug: string
    coverImage: string | null; role: 'owner' | 'member'; memberCount: number
    latestPost: { text: string | null; createdAt: string } | null
    updatedAt: string
  }
  ```

- [ ] **Step 1: Write the failing test**

Create `src/app/api/communities/joined/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({ getUser: vi.fn() }))
vi.mock('@/lib/db', () => ({
  db: {
    hub: { findMany: vi.fn() },
    hubMember: { findMany: vi.fn() },
  },
}))

import { getUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { GET } from './route'

const req = () => new Request('http://localhost/api/communities/joined') as any

beforeEach(() => {
  vi.clearAllMocks()
  ;(getUser as any).mockResolvedValue({ id: 'me' })
})

it('returns 401 when unauthenticated', async () => {
  ;(getUser as any).mockResolvedValue(null)
  const res = await GET(req())
  expect(res.status).toBe(401)
})

it('merges owned + joined community hubs, dedupes, derives role and memberCount', async () => {
  ;(db.hub.findMany as any).mockResolvedValue([
    { id: 'h1', title: 'Owned One', slug: 'owned-one', coverImage: null,
      updatedAt: new Date('2026-07-10T00:00:00Z'), user: { username: 'me' },
      _count: { members: 3 },
      posts: [{ text: 'hi', createdAt: new Date('2026-07-11T00:00:00Z') }] },
  ])
  ;(db.hubMember.findMany as any).mockResolvedValue([
    { hub: { id: 'h2', title: 'Joined Two', slug: 'joined-two', coverImage: 'c.png',
      updatedAt: new Date('2026-07-09T00:00:00Z'), user: { username: 'alice' },
      _count: { members: 8 }, posts: [] } },
    // duplicate of an owned hub — owner must win, no dupe
    { hub: { id: 'h1', title: 'Owned One', slug: 'owned-one', coverImage: null,
      updatedAt: new Date('2026-07-10T00:00:00Z'), user: { username: 'me' },
      _count: { members: 3 }, posts: [] } },
  ])

  const res = await GET(req())
  const body = await res.json()
  expect(res.status).toBe(200)
  const byId = Object.fromEntries(body.communities.map((c: any) => [c.id, c]))
  expect(Object.keys(byId)).toHaveLength(2)
  expect(byId.h1.role).toBe('owner')
  expect(byId.h1.memberCount).toBe(3)
  expect(byId.h1.latestPost).toEqual({ text: 'hi', createdAt: '2026-07-11T00:00:00.000Z' })
  expect(byId.h2.role).toBe('member')
  expect(byId.h2.memberCount).toBe(8)
  expect(byId.h2.latestPost).toBeNull()
  expect(byId.h2.updatedAt).toBe('2026-07-09T00:00:00.000Z')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/app/api/communities/joined/route.test.ts`
Expected: FAIL (route still returns the old shape — no `role`/`memberCount`).

- [ ] **Step 3: Implement the enriched route**

Replace the body of `src/app/api/communities/joined/route.ts` with:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'

const hubSelect = {
  id: true, title: true, slug: true, coverImage: true, updatedAt: true,
  user: { select: { username: true } },
  _count: { select: { members: true } },
  posts: { orderBy: { createdAt: 'desc' as const }, take: 1, select: { text: true, createdAt: true } },
}

type HubRow = {
  id: string; title: string; slug: string; coverImage: string | null; updatedAt: Date
  user: { username: string }; _count: { members: number }
  posts: { text: string | null; createdAt: Date }[]
}

function shape(hub: HubRow, role: 'owner' | 'member') {
  return {
    id: hub.id,
    title: hub.title,
    username: hub.user.username,
    slug: hub.slug,
    coverImage: hub.coverImage,
    role,
    memberCount: hub._count.members,
    latestPost: hub.posts[0]
      ? { text: hub.posts[0].text, createdAt: hub.posts[0].createdAt.toISOString() }
      : null,
    updatedAt: hub.updatedAt.toISOString(),
  }
}

export async function GET(request: NextRequest) {
  const me = await getUser(request)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [owned, memberships] = await Promise.all([
    db.hub.findMany({
      where: { userId: me.id, community: true },
      orderBy: { updatedAt: 'desc' },
      select: hubSelect,
    }),
    db.hubMember.findMany({
      where: { userId: me.id, hub: { community: true } },
      orderBy: { createdAt: 'desc' },
      select: { hub: { select: hubSelect } },
    }),
  ])

  const byId = new Map<string, ReturnType<typeof shape>>()
  for (const hub of owned as HubRow[]) byId.set(hub.id, shape(hub, 'owner'))
  for (const { hub } of memberships as { hub: HubRow }[]) {
    if (!byId.has(hub.id)) byId.set(hub.id, shape(hub, 'member'))
  }

  const communities = Array.from(byId.values()).sort((a, b) => {
    const at = new Date(a.latestPost?.createdAt ?? a.updatedAt).getTime()
    const bt = new Date(b.latestPost?.createdAt ?? b.updatedAt).getTime()
    return bt - at
  })

  return NextResponse.json({ communities })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/app/api/communities/joined/route.test.ts`
Expected: PASS (both tests).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/communities/joined/route.ts src/app/api/communities/joined/route.test.ts
git commit -m "feat(pond): enrich joined-communities API with role, memberCount, activity"
```

---

### Task 2: Pond filter/sort helper + shared types

**Files:**
- Create: `src/lib/pond.ts`
- Test (create): `src/lib/pond.test.ts`

**Interfaces:**
- Consumes: `PondCommunity` shape from Task 1.
- Produces:
  ```ts
  export type PondCommunity = { id: string; title: string; username: string; slug: string; coverImage: string | null; role: 'owner' | 'member'; memberCount: number; latestPost: { text: string | null; createdAt: string } | null; updatedAt: string }
  export type PondCollab = { id: string; slug: string; title: string; coverImage: string | null; published: boolean; updatedAt: string; owner: { username: string; name: string | null; avatar: string | null } }
  export type PondFilter = 'all' | 'owned' | 'joined'
  export type PondSort = 'active' | 'newest' | 'alpha' | 'members'
  export function communityActivityTs(c: PondCommunity): number
  export function filterSortCommunities(list: PondCommunity[], opts: { query: string; filter: PondFilter; sort: PondSort }): PondCommunity[]
  export function filterSortCollabs(list: PondCollab[], opts: { query: string; sort: PondSort }): PondCollab[]
  ```

- [ ] **Step 1: Write the failing test**

Create `src/lib/pond.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { filterSortCommunities, filterSortCollabs, type PondCommunity, type PondCollab } from './pond'

const c = (over: Partial<PondCommunity>): PondCommunity => ({
  id: 'x', title: 'X', username: 'u', slug: 's', coverImage: null,
  role: 'member', memberCount: 0, latestPost: null, updatedAt: '2026-07-01T00:00:00Z', ...over,
})

it('searches by title (case-insensitive)', () => {
  const list = [c({ id: 'a', title: 'Alpha' }), c({ id: 'b', title: 'Beta' })]
  const out = filterSortCommunities(list, { query: 'alp', filter: 'all', sort: 'alpha' })
  expect(out.map((x) => x.id)).toEqual(['a'])
})

it('filters by role', () => {
  const list = [c({ id: 'a', role: 'owner' }), c({ id: 'b', role: 'member' })]
  expect(filterSortCommunities(list, { query: '', filter: 'owned', sort: 'alpha' }).map((x) => x.id)).toEqual(['a'])
  expect(filterSortCommunities(list, { query: '', filter: 'joined', sort: 'alpha' }).map((x) => x.id)).toEqual(['b'])
})

it('sorts by members desc and alpha', () => {
  const list = [c({ id: 'a', title: 'Bravo', memberCount: 1 }), c({ id: 'b', title: 'Alpha', memberCount: 9 })]
  expect(filterSortCommunities(list, { query: '', filter: 'all', sort: 'members' }).map((x) => x.id)).toEqual(['b', 'a'])
  expect(filterSortCommunities(list, { query: '', filter: 'all', sort: 'alpha' }).map((x) => x.id)).toEqual(['b', 'a'])
})

it('sorts by activity using latestPost then updatedAt', () => {
  const list = [
    c({ id: 'old', updatedAt: '2026-01-01T00:00:00Z' }),
    c({ id: 'new', updatedAt: '2026-01-01T00:00:00Z', latestPost: { text: 'hi', createdAt: '2026-07-15T00:00:00Z' } }),
  ]
  expect(filterSortCommunities(list, { query: '', filter: 'all', sort: 'active' }).map((x) => x.id)).toEqual(['new', 'old'])
})

it('filterSortCollabs searches title and sorts by updated', () => {
  const d = (over: Partial<PondCollab>): PondCollab => ({ id: 'x', slug: 's', title: 'X', coverImage: null, published: true, updatedAt: '2026-07-01T00:00:00Z', owner: { username: 'u', name: null, avatar: null }, ...over })
  const list = [d({ id: 'a', title: 'Alpha', updatedAt: '2026-07-01T00:00:00Z' }), d({ id: 'b', title: 'Beta', updatedAt: '2026-07-10T00:00:00Z' })]
  expect(filterSortCollabs(list, { query: 'bet', sort: 'active' }).map((x) => x.id)).toEqual(['b'])
  expect(filterSortCollabs(list, { query: '', sort: 'active' }).map((x) => x.id)).toEqual(['b', 'a'])
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/lib/pond.test.ts`
Expected: FAIL ("Cannot find module './pond'").

- [ ] **Step 3: Implement the helper**

Create `src/lib/pond.ts`:

```ts
export type PondCommunity = {
  id: string; title: string; username: string; slug: string
  coverImage: string | null; role: 'owner' | 'member'; memberCount: number
  latestPost: { text: string | null; createdAt: string } | null
  updatedAt: string
}

export type PondCollab = {
  id: string; slug: string; title: string; coverImage: string | null
  published: boolean; updatedAt: string
  owner: { username: string; name: string | null; avatar: string | null }
}

export type PondFilter = 'all' | 'owned' | 'joined'
export type PondSort = 'active' | 'newest' | 'alpha' | 'members'

export function communityActivityTs(c: PondCommunity): number {
  return new Date(c.latestPost?.createdAt ?? c.updatedAt).getTime()
}

export function filterSortCommunities(
  list: PondCommunity[],
  opts: { query: string; filter: PondFilter; sort: PondSort },
): PondCommunity[] {
  const q = opts.query.trim().toLowerCase()
  let out = list.filter((c) => {
    if (opts.filter === 'owned' && c.role !== 'owner') return false
    if (opts.filter === 'joined' && c.role !== 'member') return false
    if (q && !c.title.toLowerCase().includes(q)) return false
    return true
  })
  out = [...out].sort((a, b) => {
    switch (opts.sort) {
      case 'alpha': return a.title.localeCompare(b.title)
      case 'members': return b.memberCount - a.memberCount
      case 'newest': return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      case 'active':
      default: return communityActivityTs(b) - communityActivityTs(a)
    }
  })
  return out
}

export function filterSortCollabs(
  list: PondCollab[],
  opts: { query: string; sort: PondSort },
): PondCollab[] {
  const q = opts.query.trim().toLowerCase()
  let out = list.filter((d) => !q || d.title.toLowerCase().includes(q))
  out = [...out].sort((a, b) => {
    if (opts.sort === 'alpha') return a.title.localeCompare(b.title)
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  })
  return out
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/lib/pond.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/pond.ts src/lib/pond.test.ts
git commit -m "feat(pond): add filter/sort helper and shared types"
```

---

### Task 3: CommunityCard + CollabCard

**Files:**
- Create: `src/components/pond/CommunityCard.tsx`
- Create: `src/components/pond/CollabCard.tsx`
- Test (create): `src/components/pond/CommunityCard.test.tsx`

**Interfaces:**
- Consumes: `PondCommunity`, `PondCollab` from `@/lib/pond`; `timeAgo` from `@/lib/time-ago`.
- Produces:
  ```ts
  function CommunityCard(props: { community: PondCommunity; view: 'grid' | 'list' }): JSX.Element
  function CollabCard(props: { collab: PondCollab; view: 'grid' | 'list' }): JSX.Element
  ```

- [ ] **Step 1: Write the failing test**

Create `src/components/pond/CommunityCard.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CommunityCard } from './CommunityCard'
import type { PondCommunity } from '@/lib/pond'

const base: PondCommunity = {
  id: 'h1', title: 'Test Hub 1', username: 'me', slug: 'test-hub-1',
  coverImage: null, role: 'owner', memberCount: 2,
  latestPost: { text: 'Hello hello oooo', createdAt: new Date(Date.now() - 2 * 3600_000).toISOString() },
  updatedAt: new Date().toISOString(),
}

it('renders title, role, member count, description and activity', () => {
  render(<CommunityCard community={base} view="grid" />)
  expect(screen.getByText('Test Hub 1')).toBeInTheDocument()
  expect(screen.getByText('Owner')).toBeInTheDocument()
  expect(screen.getByText(/2 members/)).toBeInTheDocument()
  expect(screen.getByText('Hello hello oooo')).toBeInTheDocument()
  expect(screen.getByText(/Active .* ago/)).toBeInTheDocument()
})

it('links to the community public page', () => {
  render(<CommunityCard community={base} view="grid" />)
  expect(screen.getByRole('link')).toHaveAttribute('href', '/me/hub/test-hub-1')
})

it('shows "No posts yet" when there is no latest post', () => {
  render(<CommunityCard community={{ ...base, latestPost: null }} view="grid" />)
  expect(screen.getByText('No posts yet')).toBeInTheDocument()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/components/pond/CommunityCard.test.tsx`
Expected: FAIL ("Cannot find module './CommunityCard'").

- [ ] **Step 3: Implement CommunityCard**

Create `src/components/pond/CommunityCard.tsx`:

```tsx
'use client'

import Link from 'next/link'
import { Users, Crown } from 'lucide-react'
import type { PondCommunity } from '@/lib/pond'
import { timeAgo } from '@/lib/time-ago'

function RoleBadge({ role }: { role: 'owner' | 'member' }) {
  return role === 'owner' ? (
    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
      <Crown className="w-3 h-3" /> Owner
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
      Member
    </span>
  )
}

export function CommunityCard({ community, view }: { community: PondCommunity; view: 'grid' | 'list' }) {
  const href = `/${community.username}/hub/${community.slug}`
  const activity = community.latestPost?.createdAt ?? community.updatedAt
  const desc = community.latestPost?.text || 'No posts yet'

  if (view === 'list') {
    return (
      <Link href={href} className="flex items-center gap-4 rounded-2xl border border-border bg-surface p-3 shadow-soft hover:shadow-soft-lg hover:border-primary/30 transition-all">
        <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0 bg-gradient-to-br from-galli/20 to-galli-violet/20">
          {community.coverImage && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={community.coverImage} alt="" className="w-full h-full object-cover" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold truncate">{community.title}</h3>
            <RoleBadge role={community.role} />
          </div>
          <p className="text-xs text-muted-foreground truncate mt-0.5">{desc}</p>
          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
            <span className="inline-flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {community.memberCount} members</span>
            <span className="inline-flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-primary" /> Active {timeAgo(activity)} ago</span>
          </div>
        </div>
      </Link>
    )
  }

  return (
    <Link href={href} className="group flex flex-col rounded-2xl border border-border bg-surface overflow-hidden shadow-soft hover:shadow-soft-lg hover:border-primary/30 transition-all">
      <div className="relative h-32 bg-gradient-to-br from-galli/20 to-galli-violet/20">
        {community.coverImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={community.coverImage} alt="" className="w-full h-full object-cover" />
        )}
        <span className="absolute top-2 right-2"><RoleBadge role={community.role} /></span>
      </div>
      <div className="p-4">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold truncate group-hover:text-primary transition-colors">{community.title}</h3>
          <span className="ml-auto"><RoleBadge role={community.role} /></span>
        </div>
        <p className="text-sm text-muted-foreground mt-1 truncate">{desc}</p>
        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-3">
          <span className="inline-flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {community.memberCount} members</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-2 pt-2 border-t border-border">
          <span className="w-1.5 h-1.5 rounded-full bg-primary" /> Active {timeAgo(activity)} ago
        </div>
      </div>
    </Link>
  )
}
```

- [ ] **Step 4: Implement CollabCard**

Create `src/components/pond/CollabCard.tsx`:

```tsx
'use client'

import { useRouter } from 'next/navigation'
import { Globe, Lock } from 'lucide-react'
import type { PondCollab } from '@/lib/pond'
import { timeAgo } from '@/lib/time-ago'

export function CollabCard({ collab, view }: { collab: PondCollab; view: 'grid' | 'list' }) {
  const router = useRouter()
  const open = () => router.push(`/editor?id=${collab.id}`)
  const Icon = collab.published ? Globe : Lock

  if (view === 'list') {
    return (
      <button onClick={open} className="w-full text-left flex items-center gap-4 rounded-2xl border border-border bg-surface p-3 shadow-soft hover:shadow-soft-lg hover:border-primary/30 transition-all">
        <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0 bg-gradient-to-br from-galli/20 to-galli-violet/20">
          {collab.coverImage && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={collab.coverImage} alt="" className="w-full h-full object-cover" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold truncate">{collab.title}</h3>
            <Icon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          </div>
          <p className="text-xs text-muted-foreground truncate mt-0.5">shared by @{collab.owner.username}</p>
          <p className="text-xs text-muted-foreground mt-1">Updated {timeAgo(collab.updatedAt)} ago</p>
        </div>
      </button>
    )
  }

  return (
    <button onClick={open} className="group text-left flex flex-col rounded-2xl border border-border bg-surface overflow-hidden shadow-soft hover:shadow-soft-lg hover:border-primary/30 transition-all">
      <div className="h-32 bg-gradient-to-br from-galli/20 to-galli-violet/20">
        {collab.coverImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={collab.coverImage} alt="" className="w-full h-full object-cover" />
        )}
      </div>
      <div className="p-4">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold truncate group-hover:text-primary transition-colors">{collab.title}</h3>
          <Icon className="ml-auto w-3.5 h-3.5 text-muted-foreground shrink-0" />
        </div>
        <p className="text-sm text-muted-foreground mt-1 truncate">shared by @{collab.owner.username}</p>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-3 pt-2 border-t border-border">
          Updated {timeAgo(collab.updatedAt)} ago
        </div>
      </div>
    </button>
  )
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm test src/components/pond/CommunityCard.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add src/components/pond/CommunityCard.tsx src/components/pond/CollabCard.tsx src/components/pond/CommunityCard.test.tsx
git commit -m "feat(pond): add CommunityCard and CollabCard"
```

---

### Task 4: PondToolbar (search / filter / sort / view)

**Files:**
- Create: `src/components/pond/PondToolbar.tsx`
- Test (create): `src/components/pond/PondToolbar.test.tsx`

**Interfaces:**
- Consumes: `PondFilter`, `PondSort` from `@/lib/pond`.
- Produces:
  ```ts
  function PondToolbar(props: {
    query: string; onQuery: (v: string) => void
    filter: PondFilter; onFilter: (v: PondFilter) => void
    sort: PondSort; onSort: (v: PondSort) => void
    showFilter: boolean            // false on Collabs tab (no owned/joined)
  }): JSX.Element
  ```

- [ ] **Step 1: Write the failing test**

Create `src/components/pond/PondToolbar.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PondToolbar } from './PondToolbar'

it('emits query changes and sort changes', () => {
  const onQuery = vi.fn(); const onSort = vi.fn(); const onFilter = vi.fn()
  render(<PondToolbar query="" onQuery={onQuery} filter="all" onFilter={onFilter} sort="active" onSort={onSort} showFilter />)
  fireEvent.change(screen.getByPlaceholderText(/search communities/i), { target: { value: 'game' } })
  expect(onQuery).toHaveBeenCalledWith('game')
  fireEvent.change(screen.getByLabelText('Sort communities'), { target: { value: 'alpha' } })
  expect(onSort).toHaveBeenCalledWith('alpha')
})

it('hides the owned/joined filter when showFilter is false', () => {
  render(<PondToolbar query="" onQuery={() => {}} filter="all" onFilter={() => {}} sort="active" onSort={() => {}} showFilter={false} />)
  expect(screen.queryByLabelText('Filter communities')).toBeNull()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/components/pond/PondToolbar.test.tsx`
Expected: FAIL ("Cannot find module './PondToolbar'").

- [ ] **Step 3: Implement PondToolbar**

Create `src/components/pond/PondToolbar.tsx`:

```tsx
'use client'

import { Search } from 'lucide-react'
import type { PondFilter, PondSort } from '@/lib/pond'

export function PondToolbar({
  query, onQuery, filter, onFilter, sort, onSort, showFilter,
}: {
  query: string; onQuery: (v: string) => void
  filter: PondFilter; onFilter: (v: PondFilter) => void
  sort: PondSort; onSort: (v: PondSort) => void
  showFilter: boolean
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-5">
      <div className="relative flex-1">
        <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          placeholder="Search communities..."
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          className="w-full pl-9 pr-3 py-2.5 bg-surface border border-border rounded-xl outline-none focus:ring-2 focus:ring-ring text-sm"
        />
      </div>
      <div className="flex items-center gap-2">
        {showFilter && (
          <select
            aria-label="Filter communities"
            value={filter}
            onChange={(e) => onFilter(e.target.value as PondFilter)}
            className="px-3 py-2.5 bg-surface border border-border rounded-xl text-sm outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="all">All communities</option>
            <option value="owned">Owned by me</option>
            <option value="joined">Joined</option>
          </select>
        )}
        <select
          aria-label="Sort communities"
          value={sort}
          onChange={(e) => onSort(e.target.value as PondSort)}
          className="px-3 py-2.5 bg-surface border border-border rounded-xl text-sm outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="active">Recently active</option>
          <option value="newest">Newest</option>
          <option value="alpha">Alphabetical</option>
          <option value="members">Most members</option>
        </select>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test src/components/pond/PondToolbar.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/pond/PondToolbar.tsx src/components/pond/PondToolbar.test.tsx
git commit -m "feat(pond): add PondToolbar (search/filter/sort)"
```

---

### Task 5: NewCommunityModal

**Files:**
- Create: `src/components/pond/NewCommunityModal.tsx`
- Test (create): `src/components/pond/NewCommunityModal.test.tsx`

**Interfaces:**
- Produces:
  ```ts
  function NewCommunityModal(props: { open: boolean; onClose: () => void }): JSX.Element | null
  ```
  On submit: `POST /api/hubs { title, community: true }` → on 201, `router.push('/hubs/' + hub.id)`.

- [ ] **Step 1: Write the failing test**

Create `src/components/pond/NewCommunityModal.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const push = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))

import { NewCommunityModal } from './NewCommunityModal'

beforeEach(() => {
  vi.clearAllMocks()
  global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 201, json: async () => ({ id: 'newhub' }) }) as any
})

it('creates a community and navigates to its builder', async () => {
  render(<NewCommunityModal open onClose={() => {}} />)
  fireEvent.change(screen.getByPlaceholderText(/community name/i), { target: { value: 'My Club' } })
  fireEvent.click(screen.getByRole('button', { name: /create/i }))
  await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/hubs', expect.objectContaining({ method: 'POST' })))
  const body = JSON.parse((global.fetch as any).mock.calls[0][1].body)
  expect(body).toMatchObject({ title: 'My Club', community: true })
  await waitFor(() => expect(push).toHaveBeenCalledWith('/hubs/newhub'))
})

it('renders nothing when closed', () => {
  const { container } = render(<NewCommunityModal open={false} onClose={() => {}} />)
  expect(container).toBeEmptyDOMElement()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/components/pond/NewCommunityModal.test.tsx`
Expected: FAIL ("Cannot find module './NewCommunityModal'").

- [ ] **Step 3: Implement NewCommunityModal**

Create `src/components/pond/NewCommunityModal.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function NewCommunityModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  if (!open) return null

  const submit = async () => {
    if (busy) return
    setBusy(true); setError('')
    try {
      const res = await fetch('/api/hubs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: name.trim() || 'Untitled Community', community: true }),
      })
      if (!res.ok) { setError('Could not create community. Try again.'); return }
      const hub = await res.json()
      router.push(`/hubs/${hub.id}`)
    } catch {
      setError('Could not create community. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
        <div className="w-full max-w-md bg-surface border border-border rounded-2xl shadow-soft-lg p-6" onClick={(e) => e.stopPropagation()}>
          <h2 className="text-lg font-bold text-foreground">New community</h2>
          <p className="text-sm text-muted-foreground mt-1">Give your community a name. You can change it later.</p>
          <input
            autoFocus
            type="text"
            placeholder="Community name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') submit() }}
            className="mt-4 w-full px-3 py-2.5 bg-muted border border-border rounded-xl outline-none focus:ring-2 focus:ring-ring text-sm"
          />
          {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
          <div className="flex justify-end gap-2 mt-5">
            <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground">Cancel</button>
            <button onClick={submit} disabled={busy} className="px-4 py-2 text-sm font-semibold text-white bg-primary rounded-xl hover:bg-primary/90 disabled:opacity-60">
              {busy ? 'Creating…' : 'Create community'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test src/components/pond/NewCommunityModal.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/pond/NewCommunityModal.tsx src/components/pond/NewCommunityModal.test.tsx
git commit -m "feat(pond): add NewCommunityModal"
```

---

### Task 6: Presentational chrome — PondHero, PondWelcomeBanner, GetMoreCard

**Files:**
- Create: `src/components/pond/PondHero.tsx`
- Create: `src/components/pond/PondWelcomeBanner.tsx`
- Create: `src/components/pond/GetMoreCard.tsx`
- Test (create): `src/components/pond/PondWelcomeBanner.test.tsx`

**Interfaces:**
- Produces:
  ```ts
  function PondHero(props: { view: 'grid' | 'list'; onView: (v: 'grid' | 'list') => void; onNewCommunity: () => void }): JSX.Element
  function PondWelcomeBanner(props: { onDismiss: () => void }): JSX.Element
  function GetMoreCard(props: { onCreate: () => void }): JSX.Element
  ```

- [ ] **Step 1: Write the failing test**

Create `src/components/pond/PondWelcomeBanner.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PondWelcomeBanner } from './PondWelcomeBanner'

it('shows welcome copy and fires onDismiss', () => {
  const onDismiss = vi.fn()
  render(<PondWelcomeBanner onDismiss={onDismiss} />)
  expect(screen.getByText(/welcome to your pond/i)).toBeInTheDocument()
  fireEvent.click(screen.getByLabelText(/dismiss/i))
  expect(onDismiss).toHaveBeenCalled()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/components/pond/PondWelcomeBanner.test.tsx`
Expected: FAIL ("Cannot find module './PondWelcomeBanner'").

- [ ] **Step 3: Implement PondWelcomeBanner**

Create `src/components/pond/PondWelcomeBanner.tsx`:

```tsx
'use client'

import { X } from 'lucide-react'

export function PondWelcomeBanner({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-border mb-6 min-h-[140px] flex items-center"
      style={{ backgroundImage: 'url(/pond/welcome-banner.png)', backgroundSize: 'cover', backgroundPosition: 'center' }}
    >
      {/* left light scrim for legibility */}
      <div className="absolute inset-0 bg-gradient-to-r from-white/90 via-white/70 to-transparent" />
      <div className="relative p-6 max-w-lg">
        <h2 className="text-xl font-bold text-galli-dark flex items-center gap-2">Welcome to your pond! 🌱</h2>
        <p className="text-sm text-galli-dark/80 mt-1">
          This is where your communities live.<br />
          Start or join one to connect, share, and build together.
        </p>
      </div>
      <button
        onClick={onDismiss}
        aria-label="Dismiss welcome banner"
        className="absolute top-3 right-3 p-1.5 rounded-full bg-white/70 hover:bg-white text-galli-dark/70 hover:text-galli-dark transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}
```

Note: brand dark green is `galli.dark` (#0F3D2E) → `text-galli-dark`. Confirmed present in `tailwind.config.ts`.

- [ ] **Step 4: Implement PondHero**

Create `src/components/pond/PondHero.tsx`:

```tsx
'use client'

import { LayoutGrid, List, Plus } from 'lucide-react'

export function PondHero({
  view, onView, onNewCommunity,
}: {
  view: 'grid' | 'list'; onView: (v: 'grid' | 'list') => void; onNewCommunity: () => void
}) {
  return (
    <div className="flex items-start justify-between gap-6 mb-6">
      <div className="min-w-0">
        <h1 className="flex items-center gap-2 text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/gallio-frog.svg" alt="" className="w-7 h-7" /> My Pond
        </h1>
        <p className="text-muted-foreground mt-1">Communities you&apos;ve joined and pages you collaborate on.</p>
      </div>

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/pond/hero-sign.png" alt="Your pond is where ideas flow and connections grow." className="hidden lg:block w-[300px] h-auto -mt-2 shrink-0" />

      <div className="flex items-center gap-2 shrink-0">
        <div className="flex items-center rounded-xl border border-border overflow-hidden">
          <button aria-label="Grid view" onClick={() => onView('grid')} className={`p-2 ${view === 'grid' ? 'bg-muted text-foreground' : 'text-muted-foreground'}`}><LayoutGrid className="w-4 h-4" /></button>
          <button aria-label="List view" onClick={() => onView('list')} className={`p-2 ${view === 'list' ? 'bg-muted text-foreground' : 'text-muted-foreground'}`}><List className="w-4 h-4" /></button>
        </div>
        <button onClick={onNewCommunity} className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold text-white bg-primary rounded-xl hover:bg-primary/90">
          <Plus className="w-4 h-4" /> New community
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Implement GetMoreCard**

Create `src/components/pond/GetMoreCard.tsx`:

```tsx
'use client'

import { Sprout, UserPlus, MessageCircle, FolderKanban, Users } from 'lucide-react'

const ITEMS = [
  { icon: Users, title: 'Create a community', body: 'Start a space for your ideas, team, or audience.' },
  { icon: UserPlus, title: 'Invite collaborators', body: 'Bring people in to co-create and grow together.' },
  { icon: MessageCircle, title: 'Share and engage', body: 'Post updates, ask questions, and build real connections.' },
  { icon: FolderKanban, title: 'Organize your spaces', body: 'Keep your communities focused and thriving.' },
]

export function GetMoreCard({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-5 shadow-soft">
      <h3 className="flex items-center gap-2 font-semibold text-foreground">
        <Sprout className="w-4 h-4 text-primary" /> Get more from your pond
      </h3>
      <ul className="mt-4 space-y-4">
        {ITEMS.map((it) => (
          <li key={it.title}>
            <button onClick={it.title === 'Create a community' ? onCreate : undefined} className="flex items-start gap-3 text-left w-full">
              <span className="p-2 rounded-xl bg-muted text-primary shrink-0"><it.icon className="w-4 h-4" /></span>
              <span>
                <span className="block text-sm font-semibold text-foreground">{it.title}</span>
                <span className="block text-xs text-muted-foreground mt-0.5">{it.body}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
```

- [ ] **Step 6: Run tests, typecheck the new components**

Run: `pnpm test src/components/pond/PondWelcomeBanner.test.tsx`
Expected: PASS (1 test).
Run: `pnpm exec tsc --noEmit`
Expected: no errors in `src/components/pond/*`.

- [ ] **Step 7: Commit**

```bash
git add src/components/pond/PondHero.tsx src/components/pond/PondWelcomeBanner.tsx src/components/pond/GetMoreCard.tsx src/components/pond/PondWelcomeBanner.test.tsx
git commit -m "feat(pond): add PondHero, PondWelcomeBanner, GetMoreCard"
```

---

### Task 7: Assemble the page (MyPondContent)

**Files:**
- Modify (rewrite): `src/app/(dashboard)/shared/page.tsx`

**Interfaces:**
- Consumes: everything from Tasks 1–6 (`PondCommunity`, `PondCollab`, `filterSortCommunities`, `filterSortCollabs`, all `src/components/pond/*`).

- [ ] **Step 1: Rewrite the page**

Replace the entire contents of `src/app/(dashboard)/shared/page.tsx`:

```tsx
'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Users } from 'lucide-react'
import {
  filterSortCommunities, filterSortCollabs,
  type PondCommunity, type PondCollab, type PondFilter, type PondSort,
} from '@/lib/pond'
import { PondHero } from '@/components/pond/PondHero'
import { PondWelcomeBanner } from '@/components/pond/PondWelcomeBanner'
import { PondToolbar } from '@/components/pond/PondToolbar'
import { CommunityCard } from '@/components/pond/CommunityCard'
import { CollabCard } from '@/components/pond/CollabCard'
import { GetMoreCard } from '@/components/pond/GetMoreCard'
import { NewCommunityModal } from '@/components/pond/NewCommunityModal'

export default function MyPondPage() {
  return (
    <Suspense fallback={<div className="px-6 lg:px-8 py-7"><p className="text-sm text-muted-foreground">Loading…</p></div>}>
      <MyPondContent />
    </Suspense>
  )
}

function MyPondContent() {
  const searchParams = useSearchParams()
  const [activeTab, setActiveTab] = useState<'collabs' | 'communities'>(
    searchParams.get('tab') === 'collabs' ? 'collabs' : 'communities'
  )
  const [communities, setCommunities] = useState<PondCommunity[]>([])
  const [collabs, setCollabs] = useState<PondCollab[]>([])
  const [loading, setLoading] = useState(true)

  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<PondFilter>('all')
  const [sort, setSort] = useState<PondSort>('active')
  const [welcomeDismissed, setWelcomeDismissed] = useState(true)
  const [newOpen, setNewOpen] = useState(false)

  // hydrate persisted UI prefs
  useEffect(() => {
    setWelcomeDismissed(localStorage.getItem('pond-welcome-dismissed') === '1')
    const v = localStorage.getItem('pond-view')
    if (v === 'grid' || v === 'list') setView(v)
  }, [])

  useEffect(() => {
    Promise.all([
      fetch('/api/communities/joined').then((r) => (r.ok ? r.json() : { communities: [] })).then((d) => setCommunities(Array.isArray(d?.communities) ? d.communities : [])).catch(() => {}),
      fetch('/api/collaborations').then((r) => (r.ok ? r.json() : { displays: [] })).then((d) => setCollabs(Array.isArray(d?.displays) ? d.displays : [])).catch(() => {}),
    ]).finally(() => setLoading(false))
  }, [])

  const setViewPersist = (v: 'grid' | 'list') => { setView(v); localStorage.setItem('pond-view', v) }
  const dismissWelcome = () => { setWelcomeDismissed(true); localStorage.setItem('pond-welcome-dismissed', '1') }

  const visibleCommunities = useMemo(
    () => filterSortCommunities(communities, { query, filter, sort }),
    [communities, query, filter, sort]
  )
  const visibleCollabs = useMemo(
    () => filterSortCollabs(collabs, { query, sort }),
    [collabs, query, sort]
  )

  const isCommunities = activeTab === 'communities'

  return (
    <div className="px-6 lg:px-8 py-7">
      <PondHero view={view} onView={setViewPersist} onNewCommunity={() => setNewOpen(true)} />

      {/* Tabs */}
      <div className="flex gap-0 border-b border-border mb-6">
        {([['communities', 'Communities', communities.length], ['collabs', 'Collabs', collabs.length]] as const).map(([key, label, count]) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`px-5 py-3 text-sm font-medium transition-colors border-b-2 ${
              activeTab === key ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {label} <span className="font-normal text-muted-foreground">({count})</span>
          </button>
        ))}
      </div>

      {!welcomeDismissed && <PondWelcomeBanner onDismiss={dismissWelcome} />}

      <PondToolbar
        query={query} onQuery={setQuery}
        filter={filter} onFilter={setFilter}
        sort={sort} onSort={setSort}
        showFilter={isCommunities}
      />

      <div className="flex gap-6">
        <main className="flex-1 min-w-0">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : isCommunities ? (
            communities.length === 0 ? (
              <EmptyState title="No communities in your pond yet." hint="Create one to start connecting." action={() => setNewOpen(true)} />
            ) : visibleCommunities.length === 0 ? (
              <EmptyState title={`No communities match “${query}”.`} />
            ) : (
              <CardGrid view={view}>
                {visibleCommunities.map((c) => <CommunityCard key={c.id} community={c} view={view} />)}
              </CardGrid>
            )
          ) : collabs.length === 0 ? (
            <EmptyState title="No pages shared with you yet." hint="When someone invites you to collaborate, it shows up here." />
          ) : visibleCollabs.length === 0 ? (
            <EmptyState title={`No pages match “${query}”.`} />
          ) : (
            <CardGrid view={view}>
              {visibleCollabs.map((d) => <CollabCard key={d.id} collab={d} view={view} />)}
            </CardGrid>
          )}
        </main>

        <aside className="w-72 shrink-0 hidden xl:block">
          <GetMoreCard onCreate={() => setNewOpen(true)} />
        </aside>
      </div>

      <NewCommunityModal open={newOpen} onClose={() => setNewOpen(false)} />
    </div>
  )
}

function CardGrid({ view, children }: { view: 'grid' | 'list'; children: React.ReactNode }) {
  if (view === 'list') return <div className="flex flex-col gap-3">{children}</div>
  return <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">{children}</div>
}

function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: () => void }) {
  return (
    <div className="text-center py-20 border border-dashed border-border rounded-2xl">
      <Users className="w-8 h-8 text-muted-foreground/40 mx-auto mb-3" />
      <p className="text-muted-foreground">{title}</p>
      {hint && <p className="text-sm text-muted-foreground/70 mt-1">{hint}</p>}
      {action && (
        <button onClick={action} className="mt-4 inline-flex items-center px-4 py-2 text-sm font-semibold text-white bg-primary rounded-xl hover:bg-primary/90">
          Create a community
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Typecheck + full test run**

Run: `pnpm exec tsc --noEmit`
Expected: no errors.
Run: `pnpm test src/lib/pond.test.ts src/components/pond src/app/api/communities/joined`
Expected: all PASS.

- [ ] **Step 3: Lint (guards the prod build)**

Run: `pnpm exec next lint`
Expected: no errors in `src/components/pond/*` or `src/app/(dashboard)/shared/page.tsx`.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(dashboard)/shared/page.tsx"
git commit -m "feat(pond): assemble revamped My Pond page"
```

---

### Task 8: Browser smoke + assets commit + final gates

**Files:**
- Add: `public/pond/hero-sign.png`, `public/pond/welcome-banner.png` (already copied into the tree).

- [ ] **Step 1: Commit the pond assets**

```bash
git add public/pond/hero-sign.png public/pond/welcome-banner.png docs/superpowers/specs/2026-07-18-my-pond-revamp-design.md docs/superpowers/plans/2026-07-18-my-pond-revamp.md
git commit -m "feat(pond): add pond hero + banner assets and design docs"
```

- [ ] **Step 2: Run the dev server (correct DB env)**

Run (background):
```bash
DATABASE_URL="postgresql://pages:pages@127.0.0.1:5434/pages" pnpm dev
```
Wait for "Ready". Note: restart if Prisma client is stale after any schema touch (none here).

- [ ] **Step 3: Browser smoke via the browsing skill**

Using the superpowers-chrome browsing skill, log in (seed user), navigate to `/shared`, and verify:
- Hero sign + welcome banner render; frog + "My Pond" title present.
- Community cards show role badge, "N members", description, "Active … ago".
- Search filters cards; the filter (All/Owned/Joined) and sort (Recently active/Newest/Alphabetical/Most members) change the list.
- Grid/List toggle switches layout; reload keeps the chosen view (localStorage).
- Dismiss the welcome banner; reload → stays dismissed.
- Right rail "Get more from your pond" visible at ≥ `xl` width.
- Switch to Collabs tab → owned/joined filter hidden; cards render.
- Capture a screenshot for the PR.

- [ ] **Step 4: Full suite + lint + typecheck**

Run: `pnpm test`
Run: `pnpm exec tsc --noEmit`
Run: `pnpm exec next lint`
Expected: all green.

- [ ] **Step 5: Commit any smoke-fix changes and open PR**

Push the branch, open a PR to `main` with the screenshot. Merge → prod auto-deploys (additive; no migration).

---

## Self-Review Notes

- **Spec coverage:** API enrichment (T1), filter/sort helper (T2), CommunityCard/CollabCard (T3), toolbar (T4), New community modal (T5), hero/banner/rail (T6), assembly + localStorage persistence + empty states (T7), browser smoke + assets + gates (T8). All spec sections mapped.
- **Type consistency:** `PondCommunity`/`PondCollab`/`PondFilter`/`PondSort` defined once in `src/lib/pond.ts` (T2) and imported everywhere; API (T1) returns the `PondCommunity` shape verbatim.
- **Deferred/decided:** no "← Back", no "Learn more" link (per Global Constraints). "Create a community" in `GetMoreCard` and empty state both open `NewCommunityModal`.
- **Verified pre-write:** `galli.dark`/`galli.violet` tokens, `shadow-soft`/`shadow-soft-lg`, and `public/gallio-frog.svg` all exist. Banner uses `text-galli-dark`.
```
