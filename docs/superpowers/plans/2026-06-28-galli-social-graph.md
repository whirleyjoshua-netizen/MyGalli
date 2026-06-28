# Galli Social Graph Implementation Plan (Sub-project 4a)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Add an asymmetric follow graph (mutual = friends), public profiles, follower/following counts, and a real "people you follow" feed.

**Architecture:** A `Follow` join model drives everything; friendship is derived (both follow-rows exist), never stored. Pure logic lives in a tested `src/lib/social.ts`; API routes compose it with Prisma and are verified by curl smokes (the codebase has no DB test harness — existing API routes are untested by unit tests too). UI adds a `FollowButton`, a `/[username]` profile page, and rewires the dashboard feed.

**Tech Stack:** Next.js 14 App Router, TypeScript, Prisma + PostgreSQL, Vitest, lucide-react, Tailwind.

## Global Constraints

- **Social model:** asymmetric follow; **friends = mutual follow**, derived at query time.
- **Self-follow is rejected** (400). Follow is **idempotent** (re-follow is a no-op success).
- **Profile route** is `/[username]`, alongside existing `/[username]/[slug]`.
- **Feed** = published displays by followed users; **falls back to `/api/explore`** when the user follows no one (row never empty).
- **DB safety (critical):** a machine-level `DATABASE_URL` points at another project's `vli_db`. EVERY command must set it inline first:
  `$env:DATABASE_URL='postgresql://pages:pages@localhost:5434/pages?schema=public'; <cmd>` (PowerShell).
  Before any `prisma migrate`/`db push`, CONFIRM the printed datasource reads `"pages" … localhost:5434`. Never run `--accept-data-loss`.
- Verification: `pnpm build`, `pnpm test` (vitest). Dev server runs separately; stop it before `pnpm build` to avoid `.next` lock contention on Windows.
- Auth in API routes: `import { getUser } from '@/lib/auth'`; `const user = await getUser(request)` → user or null. Route params are async: `{ params }: { params: Promise<{ username: string }> }`, then `const { username } = await params`.

---

### Task 1: Follow schema + migration

**Files:**
- Modify: `prisma/schema.prisma` (User model relations + new Follow model)

**Interfaces:**
- Produces: Prisma `Follow` model with `followerId`, `followingId`; `db.follow` client.

- [ ] **Step 1: Add the Follow model and User relations**

In `prisma/schema.prisma`, add inside `model User { … }` (after the existing relation fields like `displays`):

```prisma
  following   Follow[]  @relation("Following")
  followers   Follow[]  @relation("Followers")
```

Add a new model at the end of the file:

```prisma
model Follow {
  id          String   @id @default(cuid())
  followerId  String
  followingId String
  follower    User     @relation("Following", fields: [followerId], references: [id], onDelete: Cascade)
  following   User     @relation("Followers", fields: [followingId], references: [id], onDelete: Cascade)
  createdAt   DateTime @default(now())

  @@unique([followerId, followingId])
  @@index([followerId])
  @@index([followingId])
}
```

- [ ] **Step 2: Confirm datasource, then migrate**

Run: `$env:DATABASE_URL='postgresql://pages:pages@localhost:5434/pages?schema=public'; npx prisma migrate dev --name add_follow`
Expected: output shows `Datasource "db": PostgreSQL database "pages" … at "localhost:5434"`, creates migration `prisma/migrations/*_add_follow`, applies it, regenerates client. If the datasource is NOT `pages`/`5434`, STOP.

- [ ] **Step 3: Verify build**

Run: `$env:DATABASE_URL='postgresql://pages:pages@localhost:5434/pages?schema=public'; pnpm build`
Expected: succeeds.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(social): add Follow model and migration"
```

---

### Task 2: Social helper logic (TDD)

**Files:**
- Create: `src/lib/social.ts`
- Create: `src/__tests__/social.test.ts`

**Interfaces:**
- Produces: `isSelfFollow(a: string, b: string): boolean`; `deriveFriend(isFollowing: boolean, isFollowedBy: boolean): boolean`.

- [ ] **Step 1: Write the failing tests**

```ts
// src/__tests__/social.test.ts
import { describe, it, expect } from 'vitest'
import { isSelfFollow, deriveFriend } from '@/lib/social'

describe('isSelfFollow', () => {
  it('is true when ids are equal', () => {
    expect(isSelfFollow('u1', 'u1')).toBe(true)
  })
  it('is false for different ids', () => {
    expect(isSelfFollow('u1', 'u2')).toBe(false)
  })
})

describe('deriveFriend', () => {
  it('is true only when both directions follow', () => {
    expect(deriveFriend(true, true)).toBe(true)
    expect(deriveFriend(true, false)).toBe(false)
    expect(deriveFriend(false, true)).toBe(false)
    expect(deriveFriend(false, false)).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests — expect fail (module missing)**

Run: `$env:DATABASE_URL='postgresql://pages:pages@localhost:5434/pages?schema=public'; pnpm vitest run src/__tests__/social.test.ts`
Expected: FAIL — cannot resolve `@/lib/social`.

- [ ] **Step 3: Implement**

```ts
// src/lib/social.ts
export function isSelfFollow(followerId: string, followingId: string): boolean {
  return followerId === followingId
}

export function deriveFriend(isFollowing: boolean, isFollowedBy: boolean): boolean {
  return isFollowing && isFollowedBy
}
```

- [ ] **Step 4: Run tests — expect pass**

Run: `$env:DATABASE_URL='postgresql://pages:pages@localhost:5434/pages?schema=public'; pnpm vitest run src/__tests__/social.test.ts`
Expected: PASS (6 assertions).

- [ ] **Step 5: Commit**

```bash
git add src/lib/social.ts src/__tests__/social.test.ts
git commit -m "feat(social): add tested social helpers (self-follow, friend)"
```

---

### Task 3: Follow / unfollow API

**Files:**
- Create: `src/app/api/users/[username]/follow/route.ts`

**Interfaces:**
- Consumes: `getUser`, `isSelfFollow`, `db.follow`, `db.user`.
- Produces: `POST`/`DELETE /api/users/[username]/follow` → `{ following: boolean }`.

- [ ] **Step 1: Implement the route**

```ts
// src/app/api/users/[username]/follow/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'
import { isSelfFollow } from '@/lib/social'

async function resolveTarget(username: string) {
  return db.user.findUnique({ where: { username }, select: { id: true } })
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ username: string }> }) {
  try {
    const me = await getUser(request)
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { username } = await params
    const target = await resolveTarget(username)
    if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 })
    if (isSelfFollow(me.id, target.id)) return NextResponse.json({ error: 'Cannot follow yourself' }, { status: 400 })

    await db.follow.upsert({
      where: { followerId_followingId: { followerId: me.id, followingId: target.id } },
      create: { followerId: me.id, followingId: target.id },
      update: {},
    })
    return NextResponse.json({ following: true })
  } catch (error) {
    console.error('Follow error:', error)
    return NextResponse.json({ error: 'Failed to follow' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ username: string }> }) {
  try {
    const me = await getUser(request)
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { username } = await params
    const target = await resolveTarget(username)
    if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    await db.follow.deleteMany({ where: { followerId: me.id, followingId: target.id } })
    return NextResponse.json({ following: false })
  } catch (error) {
    console.error('Unfollow error:', error)
    return NextResponse.json({ error: 'Failed to unfollow' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Build**

Run: `$env:DATABASE_URL='postgresql://pages:pages@localhost:5434/pages?schema=public'; pnpm build`
Expected: succeeds.

- [ ] **Step 3: Curl smoke (two seeded/created users)**

With dev server running and logged-in cookie jar `jarA` for user A, target user B's username `userb`:
```
curl -s -X POST -b jarA http://localhost:3000/api/users/userb/follow      # {"following":true}
curl -s -X POST -b jarA http://localhost:3000/api/users/userb/follow      # {"following":true} (idempotent)
curl -s -X POST -b jarA http://localhost:3000/api/users/<A's own name>/follow  # 400 self-follow
curl -s -X DELETE -b jarA http://localhost:3000/api/users/userb/follow    # {"following":false}
```
Expected: as annotated.

- [ ] **Step 4: Commit**

```bash
git add "src/app/api/users/[username]/follow/route.ts"
git commit -m "feat(social): follow/unfollow API"
```

---

### Task 4: Profile API (counts + flags + displays)

**Files:**
- Create: `src/app/api/users/[username]/route.ts`

**Interfaces:**
- Consumes: `getUser`, `deriveFriend`, `db.user`, `db.follow`, `db.display`.
- Produces: `GET /api/users/[username]` → `{ id, username, name, avatar, bio, followerCount, followingCount, friendCount, isFollowing, isFollowedBy, isFriend, displays: Array<{ id, slug, title, coverImage, views, user:{username,name,avatar} }> }`.

- [ ] **Step 1: Implement**

```ts
// src/app/api/users/[username]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'
import { deriveFriend } from '@/lib/social'

export async function GET(request: NextRequest, { params }: { params: Promise<{ username: string }> }) {
  try {
    const { username } = await params
    const me = await getUser(request)

    const user = await db.user.findUnique({
      where: { username },
      select: { id: true, username: true, name: true, avatar: true, bio: true },
    })
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    const [followerCount, followingCount, displays, iFollow, followsMe] = await Promise.all([
      db.follow.count({ where: { followingId: user.id } }),
      db.follow.count({ where: { followerId: user.id } }),
      db.display.findMany({
        where: { userId: user.id, published: true },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, slug: true, title: true, coverImage: true, views: true,
          user: { select: { username: true, name: true, avatar: true } },
        },
      }),
      me ? db.follow.findUnique({ where: { followerId_followingId: { followerId: me.id, followingId: user.id } }, select: { id: true } }) : Promise.resolve(null),
      me ? db.follow.findUnique({ where: { followerId_followingId: { followerId: user.id, followingId: me.id } }, select: { id: true } }) : Promise.resolve(null),
    ])

    // friendCount: users who both follow and are followed by this user
    const theirFollowingIds = (await db.follow.findMany({ where: { followerId: user.id }, select: { followingId: true } })).map((f) => f.followingId)
    const friendCount = theirFollowingIds.length
      ? await db.follow.count({ where: { followerId: { in: theirFollowingIds }, followingId: user.id } })
      : 0

    const isFollowing = !!iFollow
    const isFollowedBy = !!followsMe

    return NextResponse.json({
      ...user,
      followerCount,
      followingCount,
      friendCount,
      isFollowing,
      isFollowedBy,
      isFriend: deriveFriend(isFollowing, isFollowedBy),
      displays,
    })
  } catch (error) {
    console.error('Profile fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Build, then curl smoke**

Run build. Then: `curl -s http://localhost:3000/api/users/josh` → JSON with the counts/flags/displays shape above.

- [ ] **Step 3: Commit**

```bash
git add "src/app/api/users/[username]/route.ts"
git commit -m "feat(social): profile API with counts, flags, published pages"
```

---

### Task 5: Followers / Following list APIs

**Files:**
- Create: `src/app/api/users/[username]/followers/route.ts`
- Create: `src/app/api/users/[username]/following/route.ts`

**Interfaces:**
- Produces: `GET …/followers` and `GET …/following` → `{ users: Array<{ username, name, avatar, isFollowing }> }`.

- [ ] **Step 1: Implement followers route**

```ts
// src/app/api/users/[username]/followers/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'

export async function GET(request: NextRequest, { params }: { params: Promise<{ username: string }> }) {
  try {
    const { username } = await params
    const me = await getUser(request)
    const user = await db.user.findUnique({ where: { username }, select: { id: true } })
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    const rows = await db.follow.findMany({
      where: { followingId: user.id },
      orderBy: { createdAt: 'desc' },
      select: { follower: { select: { id: true, username: true, name: true, avatar: true } } },
    })
    const users = rows.map((r) => r.follower)
    const myFollowing = me
      ? new Set((await db.follow.findMany({ where: { followerId: me.id, followingId: { in: users.map((u) => u.id) } }, select: { followingId: true } })).map((f) => f.followingId))
      : new Set<string>()

    return NextResponse.json({ users: users.map((u) => ({ username: u.username, name: u.name, avatar: u.avatar, isFollowing: myFollowing.has(u.id) })) })
  } catch (error) {
    console.error('Followers fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch followers' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Implement following route** — identical but the query is `where: { followerId: user.id }` selecting `following`:

```ts
// src/app/api/users/[username]/following/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'

export async function GET(request: NextRequest, { params }: { params: Promise<{ username: string }> }) {
  try {
    const { username } = await params
    const me = await getUser(request)
    const user = await db.user.findUnique({ where: { username }, select: { id: true } })
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    const rows = await db.follow.findMany({
      where: { followerId: user.id },
      orderBy: { createdAt: 'desc' },
      select: { following: { select: { id: true, username: true, name: true, avatar: true } } },
    })
    const users = rows.map((r) => r.following)
    const myFollowing = me
      ? new Set((await db.follow.findMany({ where: { followerId: me.id, followingId: { in: users.map((u) => u.id) } }, select: { followingId: true } })).map((f) => f.followingId))
      : new Set<string>()

    return NextResponse.json({ users: users.map((u) => ({ username: u.username, name: u.name, avatar: u.avatar, isFollowing: myFollowing.has(u.id) })) })
  } catch (error) {
    console.error('Following fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch following' }, { status: 500 })
  }
}
```

- [ ] **Step 3: Build, commit**

```bash
git add "src/app/api/users/[username]/followers/route.ts" "src/app/api/users/[username]/following/route.ts"
git commit -m "feat(social): followers and following list APIs"
```

---

### Task 6: Feed API

**Files:**
- Create: `src/app/api/feed/route.ts`

**Interfaces:**
- Produces: `GET /api/feed?page=&limit=` → `{ displays: Array<{ id, slug, title, coverImage, views, user:{username,name,avatar} }>, hasMore, page, pageSize, empty: boolean }`. `empty:true` when the user follows no one (caller falls back to explore).

- [ ] **Step 1: Implement**

```ts
// src/app/api/feed/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'

const PAGE_SIZE = 12

export async function GET(request: NextRequest) {
  try {
    const me = await getUser(request)
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = request.nextUrl
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const limit = Math.min(PAGE_SIZE, Math.max(1, parseInt(searchParams.get('limit') || String(PAGE_SIZE), 10)))

    const followingIds = (await db.follow.findMany({ where: { followerId: me.id }, select: { followingId: true } })).map((f) => f.followingId)
    if (followingIds.length === 0) {
      return NextResponse.json({ displays: [], hasMore: false, page, pageSize: limit, empty: true })
    }

    const where = { published: true, userId: { in: followingIds } }
    const [total, displays] = await Promise.all([
      db.display.count({ where }),
      db.display.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true, slug: true, title: true, coverImage: true, views: true,
          user: { select: { username: true, name: true, avatar: true } },
        },
      }),
    ])

    return NextResponse.json({ displays, hasMore: page * limit < total, page, pageSize: limit, empty: false })
  } catch (error) {
    console.error('Feed error:', error)
    return NextResponse.json({ error: 'Failed to fetch feed' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Build, curl smoke, commit**

Smoke: with cookie jar following user B who has a published page → `curl -s -b jarA http://localhost:3000/api/feed` returns that page. With a fresh user following no one → `{ "empty": true, "displays": [] }`.

```bash
git add src/app/api/feed/route.ts
git commit -m "feat(social): feed API for followed users' pages"
```

---

### Task 7: FollowButton component

**Files:**
- Create: `src/components/social/FollowButton.tsx`

**Interfaces:**
- Consumes: follow API.
- Produces: `<FollowButton username: string; initialIsFollowing: boolean; initialIsFriend?: boolean; size?: 'sm' | 'md' />`.

- [ ] **Step 1: Implement**

```tsx
// src/components/social/FollowButton.tsx
'use client'

import { useState } from 'react'
import { UserPlus, UserCheck, Users } from 'lucide-react'

export function FollowButton({
  username,
  initialIsFollowing,
  initialIsFriend = false,
  size = 'md',
}: {
  username: string
  initialIsFollowing: boolean
  initialIsFriend?: boolean
  size?: 'sm' | 'md'
}) {
  const [following, setFollowing] = useState(initialIsFollowing)
  const [busy, setBusy] = useState(false)
  const [hover, setHover] = useState(false)

  const toggle = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (busy) return
    setBusy(true)
    const next = !following
    setFollowing(next)
    try {
      const res = await fetch(`/api/users/${username}/follow`, { method: next ? 'POST' : 'DELETE' })
      if (!res.ok) setFollowing(!next)
    } catch {
      setFollowing(!next)
    } finally {
      setBusy(false)
    }
  }

  const pad = size === 'sm' ? 'px-3 py-1 text-xs' : 'px-4 py-2 text-sm'
  const isFriend = following && initialIsFriend

  if (!following) {
    return (
      <button onClick={toggle} disabled={busy}
        className={`inline-flex items-center gap-1.5 rounded-full font-semibold ${pad} bg-primary text-primary-foreground shadow-soft hover:brightness-105 transition-all disabled:opacity-50 cursor-pointer`}>
        <UserPlus className="w-4 h-4" /> Follow
      </button>
    )
  }
  return (
    <button onClick={toggle} disabled={busy} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold ${pad} border border-border bg-surface text-foreground hover:bg-muted transition-all disabled:opacity-50 cursor-pointer`}>
      {hover ? (
        <>Unfollow</>
      ) : isFriend ? (
        <><Users className="w-4 h-4 text-primary" /> Friends</>
      ) : (
        <><UserCheck className="w-4 h-4 text-primary" /> Following</>
      )}
    </button>
  )
}
```

- [ ] **Step 2: Build, commit**

```bash
git add src/components/social/FollowButton.tsx
git commit -m "feat(social): FollowButton component"
```

---

### Task 8: Profile page `/[username]`

**Files:**
- Create: `src/app/[username]/page.tsx`

**Interfaces:**
- Consumes: `GET /api/users/[username]` (via direct DB call in the server component for SSR), `FollowButton`, `getUser`.

- [ ] **Step 1: Implement (server component)**

```tsx
// src/app/[username]/page.tsx
import { notFound } from 'next/navigation'
import { db } from '@/lib/db'
import { cookies } from 'next/headers'
import { verify } from 'jsonwebtoken'
import { getJwtSecret } from '@/lib/auth'
import { deriveFriend } from '@/lib/social'
import { FollowButton } from '@/components/social/FollowButton'
import { AUTH_COOKIE } from '@/lib/constants'

async function getMeId(): Promise<string | null> {
  const token = cookies().get(AUTH_COOKIE)?.value
  if (!token) return null
  try { return (verify(token, getJwtSecret()) as { userId: string }).userId } catch { return null }
}

export default async function ProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params
  const user = await db.user.findUnique({
    where: { username },
    select: { id: true, username: true, name: true, avatar: true, bio: true },
  })
  if (!user) notFound()

  const meId = await getMeId()
  const [followerCount, followingCount, displays, iFollow, followsMe] = await Promise.all([
    db.follow.count({ where: { followingId: user.id } }),
    db.follow.count({ where: { followerId: user.id } }),
    db.display.findMany({ where: { userId: user.id, published: true }, orderBy: { createdAt: 'desc' }, select: { id: true, slug: true, title: true, coverImage: true, views: true } }),
    meId ? db.follow.findUnique({ where: { followerId_followingId: { followerId: meId, followingId: user.id } }, select: { id: true } }) : null,
    meId ? db.follow.findUnique({ where: { followerId_followingId: { followerId: user.id, followingId: meId } }, select: { id: true } }) : null,
  ])
  const isFollowing = !!iFollow
  const isFriend = deriveFriend(isFollowing, !!followsMe)
  const isMe = meId === user.id
  const initial = (user.name || user.username).charAt(0).toUpperCase()

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-6 py-10">
        <div className="flex items-start gap-5">
          {user.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.avatar} alt="" className="w-20 h-20 rounded-2xl object-cover" />
          ) : (
            <span className="w-20 h-20 rounded-2xl bg-primary/15 text-primary font-bold text-2xl flex items-center justify-center">{initial}</span>
          )}
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-extrabold">{user.name || user.username}</h1>
            <p className="text-muted-foreground">@{user.username}</p>
            {user.bio && <p className="mt-2 text-sm text-foreground/80">{user.bio}</p>}
            <div className="mt-3 flex items-center gap-5 text-sm">
              <span><b className="text-foreground">{followerCount}</b> <span className="text-muted-foreground">followers</span></span>
              <span><b className="text-foreground">{followingCount}</b> <span className="text-muted-foreground">following</span></span>
            </div>
          </div>
          {!isMe && meId && (
            <FollowButton username={user.username} initialIsFollowing={isFollowing} initialIsFriend={isFriend} />
          )}
        </div>

        <h2 className="mt-10 mb-4 text-lg font-bold">Pages</h2>
        {displays.length === 0 ? (
          <p className="text-muted-foreground text-sm">No published pages yet.</p>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {displays.map((d) => (
              <a key={d.id} href={`/${user.username}/${d.slug}`} className="group rounded-2xl border border-border bg-surface overflow-hidden shadow-soft hover:shadow-soft-lg transition-all">
                <div className={`h-32 ${d.coverImage ? '' : 'bg-gradient-to-br from-galli/20 to-galli-violet/20'}`}>
                  {d.coverImage && /* eslint-disable-next-line @next/next/no-img-element */ <img src={d.coverImage} alt="" className="w-full h-full object-cover" />}
                </div>
                <div className="p-3">
                  <h3 className="font-semibold text-sm truncate group-hover:text-primary transition-colors">{d.title}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">{d.views} views</p>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Build; verify route resolution**

Run build. With dev server: `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/josh` → 200; `…/this-user-does-not-exist` → 404; confirm an existing display URL `…/josh/<slug>` still renders (no shadowing).

- [ ] **Step 3: Commit**

```bash
git add "src/app/[username]/page.tsx"
git commit -m "feat(social): public profile page at /[username]"
```

---

### Task 9: Wire-ins — dashboard feed, public-page & explore follow buttons

**Files:**
- Modify: `src/app/(dashboard)/dashboard/page.tsx` (feed fetch → `/api/feed` with explore fallback)
- Modify: `src/components/explore/ExploreCard.tsx` (add `FollowButton` for the author)
- Modify: `src/app/[username]/[slug]/page.tsx` (add `FollowButton` near the author/owner area)

**Interfaces:**
- Consumes: `GET /api/feed`, `FollowButton`.

- [ ] **Step 1: Rewire dashboard feed to `/api/feed` with explore fallback**

In `src/app/(dashboard)/dashboard/page.tsx`, replace the explore fetch in the mount effect:

```tsx
    fetch('/api/feed?page=1&limit=12')
      .then((r) => (r.ok ? r.json() : { empty: true, displays: [] }))
      .then((d) => {
        if (d.empty || !Array.isArray(d.displays) || d.displays.length === 0) {
          return fetch('/api/explore?sort=popular&page=1&limit=12')
            .then((r) => (r.ok ? r.json() : { displays: [] }))
            .then((e) => { setFeed(Array.isArray(e?.displays) ? e.displays : []); setFeedLabel('Discover') })
        }
        setFeed(d.displays)
        setFeedLabel('Public feed')
      })
      .catch(() => {})
```

Add `const [feedLabel, setFeedLabel] = useState('Public feed')` to state, and change the Public-feed `ScrollRow` `title={feedLabel}` and subtitle to switch ("Pages from people you follow." vs "Explore what the world is building.") based on `feedLabel`.

- [ ] **Step 2: Add FollowButton to ExploreCard**

In `src/components/explore/ExploreCard.tsx`, import `FollowButton` and render `<FollowButton username={display.user.username} initialIsFollowing={false} size="sm" />` in the card footer near the author name. (Cards are public/unauthenticated-safe — the button's optimistic POST will 401 for logged-out users and revert; acceptable. If the card already receives an `isFollowing` flag, pass it; otherwise default false.)

- [ ] **Step 3: Add FollowButton to the public display page**

In `src/app/[username]/[slug]/page.tsx`, in the author/owner area, render `<FollowButton username={ownerUsername} initialIsFollowing={false} size="sm" />` (read current follow state if the page already loads the viewer; otherwise default false and let the button self-correct on click). Keep it out of the way of the page content — near the byline.

- [ ] **Step 4: Build, manual check, commit**

Build. Manual: dashboard with follows shows "Public feed" of their pages; with no follows shows "Discover" fallback; explore & public pages show a Follow button.

```bash
git add "src/app/(dashboard)/dashboard/page.tsx" src/components/explore/ExploreCard.tsx "src/app/[username]/[slug]/page.tsx"
git commit -m "feat(social): wire feed to follows + follow buttons on explore/public"
```

---

## Self-Review

**Spec coverage (4a section):**
- Follow schema + relations → Task 1. ✅
- Friends = mutual (derived) → Task 2 (`deriveFriend`), used in Tasks 4 & 8. ✅
- Follow/unfollow API, self-follow 400, idempotent → Task 3. ✅
- Profile API (counts, flags, displays) → Task 4. ✅
- Followers/following lists → Task 5. ✅
- Feed API (followed users; empty signal) → Task 6. ✅
- FollowButton (Follow/Following/Friends) → Task 7. ✅
- Profile page `/[username]` → Task 8. ✅
- Dashboard feed rewire + explore/public follow buttons → Task 9. ✅
- `FollowListModal` (followers/following modal): APIs exist (Task 5); the modal UI is deferred — counts on the profile are display-only for now. NOTE: this is a conscious trim; flag if the modal is wanted in 4a rather than later.

**Placeholder scan:** none — every code step has full code; smokes have exact commands.

**Type consistency:** `deriveFriend(isFollowing, isFollowedBy)` signature consistent across Tasks 2/4/8. Profile/feed display shape (`{id,slug,title,coverImage,views,user{...}}`) matches `FeedCard`'s `FeedItem` (Task 9 reuses it). Follow API return `{following:boolean}` consumed by `FollowButton` (Task 7).
