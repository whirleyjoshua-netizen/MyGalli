# Bulletin Trending Feed + Gradient Panel — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an opt-in public "Trending" bulletin feed (Following | Trending tabs, engagement-ranked) and give the bulletin panel a green→aqua→violet gradient border matching Explore.

**Architecture:** New `BulletinPost.isPublic` column (additive migration) gates a new engagement-ranked `GET /api/bulletin/trending` route. The route's core logic (scoring, ranking, and per-post payload assembly) is extracted into pure, unit-tested helpers; the existing follower feed is refactored to share the same assembler so the two feeds cannot drift. UI adds a segmented Following|Trending toggle to `BulletinTab` and a composer opt-in toggle; the panel gains a gradient frame.

**Tech Stack:** Next.js 15.5.19 App Router · React 19 · TypeScript · Prisma + PostgreSQL · Tailwind · vitest + Testing Library.

## Global Constraints

- **Additive migration only.** `BulletinPost.isPublic Boolean @default(false)` + `@@index([isPublic, createdAt])`. Default false → existing posts stay follower-only (no retroactive exposure). Generate SQL non-interactively (DB-free): `npx prisma migrate diff --from-migrations ./prisma/migrations --to-schema-datamodel ./prisma/schema.prisma --script`. **Never `prisma migrate dev`** (non-interactive env). Run `npx prisma generate` after the schema edit so the TS client knows `isPublic` (needed for `tsc`; needs no DB). On Windows `prisma generate` can EPERM if a node process holds the engine DLL — the dev server is stopped, so it should be clean; retry if it hits EPERM.
- **"Public" = any authenticated user** via the Trending tab (auth-gated, inside the dashboard). NOT anonymous/logged-out.
- **Trending query:** `isPublic = true AND createdAt >= now − 7 days`, candidate cap **200**, score `likeCount + 2·responseCount`, `createdAt` desc tiebreak, `PAGE_SIZE = 15`.
- **Responses stay fully identified — do NOT change any respond/aggregate/analytics code.** Strangers simply become able to respond via Trending. The feed payload remains aggregate-only (no responder identities), exactly like the follower feed.
- **`isPublic` coerced to a strict boolean** on the create route.
- **Gradient palette:** `from-galli via-galli-aqua to-galli-violet` (matches `src/components/explore/ExploreClient.tsx`). Frame: `rounded-2xl bg-gradient-to-br from-galli via-galli-aqua to-galli-violet p-[1.5px]` with inner `rounded-[15px] bg-surface`. Active tab: same gradient fill, `text-white`.
- **Testing reality:** this repo has NO route-handler test harness (no test imports a route; DB is not mocked). Do NOT build one. Test the extracted **pure** helpers (`scoreTrending`, `rankTrending`, `assembleFeedPosts`) + the composer/tab **components**. Route wiring is verified by `tsc --noEmit` + code review + the final live pass (Task 7).
- **Gate every task** on `pnpm exec tsc --noEmit` + `pnpm test` (full vitest) green.
- **Commit only the task's files** (stage by explicit path). NEVER `git add -A`. NEVER stage `Documents/`, `Images/`, `g1t.json`, `nul`, `test-output.txt`, `.claude/settings.local.json`.
- **Windows:** stop any `pnpm dev` before a `pnpm build`. Tasks 1–6 need `prisma generate` but no live DB; the DB is exercised only in Task 7.

---

### Task 1: Schema + migration + client generate

**Files:**
- Modify: `prisma/schema.prisma` (BulletinPost model)
- Create: `prisma/migrations/<TIMESTAMP>_add_bulletin_is_public/migration.sql`

**Interfaces:**
- Produces: `BulletinPost.isPublic: boolean` on the generated Prisma client; a new index `BulletinPost_isPublic_createdAt_idx`.

- [ ] **Step 1: Add the column + index to the schema**

In `prisma/schema.prisma`, inside `model BulletinPost`, add the field after `imageUrl String?`:

```prisma
  isPublic Boolean  @default(false)
```

and add this index alongside the existing `@@index` lines:

```prisma
  @@index([isPublic, createdAt])
```

- [ ] **Step 2: Generate the migration SQL (DB-free)**

Create the migration directory with a UTC timestamp prefix (format `YYYYMMDDHHMMSS`), e.g. `prisma/migrations/20260705120000_add_bulletin_is_public/`, then generate its `migration.sql`:

Run:
```bash
mkdir -p prisma/migrations/<TIMESTAMP>_add_bulletin_is_public
npx prisma migrate diff --from-migrations ./prisma/migrations --to-schema-datamodel ./prisma/schema.prisma --script > prisma/migrations/<TIMESTAMP>_add_bulletin_is_public/migration.sql
```

Expected `migration.sql` content (verify it matches — the diff is authoritative):
```sql
-- AlterTable
ALTER TABLE "BulletinPost" ADD COLUMN "isPublic" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "BulletinPost_isPublic_createdAt_idx" ON "BulletinPost"("isPublic", "createdAt");
```

If the generated SQL includes unrelated statements, the migration history was already ahead — stop and report; do not hand-edit unrelated DDL.

- [ ] **Step 3: Regenerate the Prisma client**

Run: `npx prisma generate`
Expected: "Generated Prisma Client". (If it EPERMs on Windows, ensure no dev server is running and retry — it's a file-lock, not a logic error.)

- [ ] **Step 4: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: clean (no consumer yet; this just confirms the client regenerated with `isPublic`).

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(bulletin): add isPublic column + [isPublic,createdAt] index (additive migration)"
```

---

### Task 2: Pure trending helpers — `scoreTrending` + `rankTrending`

**Files:**
- Modify: `src/lib/bulletin.ts`
- Test: `src/lib/bulletin.test.ts`

**Interfaces:**
- Produces:
  - `scoreTrending(likeCount: number, responseCount: number): number`
  - `interface TrendingCandidate { id: string; likeCount: number; responseCount: number; createdAt: Date }`
  - `rankTrending<T extends TrendingCandidate>(items: T[], page: number, limit: number): { pageItems: T[]; total: number }`

- [ ] **Step 1: Write the failing test**

Append to `src/lib/bulletin.test.ts`:

```ts
import { scoreTrending, rankTrending } from './bulletin'

describe('scoreTrending', () => {
  it('weights responses 2x likes', () => {
    expect(scoreTrending(0, 0)).toBe(0)
    expect(scoreTrending(3, 0)).toBe(3)
    expect(scoreTrending(0, 2)).toBe(4)
    expect(scoreTrending(1, 5)).toBe(11)
  })
})

describe('rankTrending', () => {
  const d = (n: number) => new Date(2026, 0, n)
  const items = [
    { id: 'a', likeCount: 10, responseCount: 0, createdAt: d(1) }, // score 10
    { id: 'b', likeCount: 0, responseCount: 6, createdAt: d(2) },  // score 12
    { id: 'c', likeCount: 2, responseCount: 2, createdAt: d(3) },  // score 6
    { id: 'd', likeCount: 2, responseCount: 2, createdAt: d(4) },  // score 6, newer than c
  ]
  it('orders by score desc then createdAt desc, and reports total', () => {
    const { pageItems, total } = rankTrending(items, 1, 10)
    expect(pageItems.map((i) => i.id)).toEqual(['b', 'a', 'd', 'c'])
    expect(total).toBe(4)
  })
  it('paginates the ranked list', () => {
    expect(rankTrending(items, 1, 2).pageItems.map((i) => i.id)).toEqual(['b', 'a'])
    expect(rankTrending(items, 2, 2).pageItems.map((i) => i.id)).toEqual(['d', 'c'])
    expect(rankTrending(items, 3, 2).pageItems).toEqual([])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/lib/bulletin.test.ts`
Expected: FAIL — `scoreTrending`/`rankTrending` are not exported.

- [ ] **Step 3: Implement the helpers**

Append to `src/lib/bulletin.ts`:

```ts
export function scoreTrending(likeCount: number, responseCount: number): number {
  return likeCount + 2 * responseCount
}

export interface TrendingCandidate {
  id: string
  likeCount: number
  responseCount: number
  createdAt: Date
}

export function rankTrending<T extends TrendingCandidate>(
  items: T[],
  page: number,
  limit: number,
): { pageItems: T[]; total: number } {
  const sorted = [...items].sort((a, b) => {
    const s = scoreTrending(b.likeCount, b.responseCount) - scoreTrending(a.likeCount, a.responseCount)
    if (s !== 0) return s
    return b.createdAt.getTime() - a.createdAt.getTime()
  })
  const start = (page - 1) * limit
  return { pageItems: sorted.slice(start, start + limit), total: sorted.length }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/lib/bulletin.test.ts`
Expected: PASS (all suites).

- [ ] **Step 5: Typecheck + commit**

Run: `pnpm exec tsc --noEmit` → clean.
```bash
git add src/lib/bulletin.ts src/lib/bulletin.test.ts
git commit -m "feat(bulletin): scoreTrending + rankTrending pure helpers"
```

---

### Task 3: Extract `assembleFeedPosts`; refactor feed route to use it

Behavior-preserving extraction of the follower feed's per-post assembly into a pure, tested function that the trending route (Task 4) will reuse.

**Files:**
- Create: `src/lib/bulletin-feed.ts`
- Create: `src/lib/bulletin-feed.test.ts`
- Modify: `src/app/api/bulletin/feed/route.ts`

**Interfaces:**
- Consumes: `normalizeSettings, resultsVisible` from `@/lib/bulletin`; `aggregateBlock, toRecords` from `@/lib/element-aggregate` (existing: `aggregateBlock(config, records)`, `toRecords(rows, includeIdentity = true)`).
- Produces:
  ```ts
  interface FeedRowAuthor { id: string; name: string | null; username: string; avatar: string | null }
  interface FeedPostRow {
    id: string; text: string | null; imageUrl: string | null; blocks: unknown;
    settings: unknown; createdAt: Date; authorId: string; author: FeedRowAuthor
  }
  interface FeedResponseRow {
    postId: string; userId: string; responses: unknown; createdAt: Date;
    user: { name: string | null; username: string; avatar: string | null }
  }
  function assembleFeedPosts(
    posts: FeedPostRow[],
    likeGroups: { postId: string; _count: { postId: number } }[],
    myLikes: { postId: string }[],
    responseRows: FeedResponseRow[],
    meId: string,
  ): AssembledPost[]
  ```
  where `AssembledPost` is the exact object the feed route returns today (id, author, text, imageUrl, block, settings, createdAt: ISO string, likeCount, likedByMe, myResponse, results). Output order follows the input `posts` order.

- [ ] **Step 1: Write the failing test**

Create `src/lib/bulletin-feed.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { assembleFeedPosts } from './bulletin-feed'

const author = { id: 'u2', name: 'Bea', username: 'bea', avatar: null }
const row = (over: Record<string, unknown> = {}) => ({
  id: 'p1', text: 'hi', imageUrl: null, blocks: [], settings: {},
  createdAt: new Date('2026-07-01T00:00:00Z'), authorId: 'u2', author, ...over,
})

describe('assembleFeedPosts', () => {
  it('maps like counts, likedByMe, and ISO createdAt; preserves input order', () => {
    const posts = [row({ id: 'p1' }), row({ id: 'p2' })]
    const out = assembleFeedPosts(
      posts,
      [{ postId: 'p1', _count: { postId: 3 } }],
      [{ postId: 'p2' }],
      [],
      'me',
    )
    expect(out.map((p) => p.id)).toEqual(['p1', 'p2'])
    expect(out[0].likeCount).toBe(3)
    expect(out[0].likedByMe).toBe(false)
    expect(out[1].likeCount).toBe(0)
    expect(out[1].likedByMe).toBe(true)
    expect(out[0].createdAt).toBe('2026-07-01T00:00:00.000Z')
    expect(out[0].block).toBeNull()
  })

  it('hides results for a non-author until they answer when revealAfterAnswer is set', () => {
    const block = { id: 'b', type: 'poll', pollQuestion: 'Q', pollOptions: ['A', 'B'] }
    const posts = [row({ id: 'p1', blocks: [block], settings: { revealAfterAnswer: true }, authorId: 'u2' })]
    const noAnswer = assembleFeedPosts(posts, [], [], [], 'me')
    expect(noAnswer[0].results).toBeNull()
    expect(noAnswer[0].myResponse).toBeNull()

    const answered = assembleFeedPosts(
      posts, [], [],
      [{ postId: 'p1', userId: 'me', responses: { b: { type: 'poll', answer: 0 } }, createdAt: new Date(), user: { name: null, username: 'me', avatar: null } }],
      'me',
    )
    expect(answered[0].results).not.toBeNull()
    expect(answered[0].myResponse).toEqual({ b: { type: 'poll', answer: 0 } })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/lib/bulletin-feed.test.ts`
Expected: FAIL — module `./bulletin-feed` does not exist.

- [ ] **Step 3: Implement `assembleFeedPosts`**

Create `src/lib/bulletin-feed.ts`:

```ts
import { normalizeSettings, resultsVisible } from '@/lib/bulletin'
import { aggregateBlock, toRecords } from '@/lib/element-aggregate'

export interface FeedRowAuthor { id: string; name: string | null; username: string; avatar: string | null }
export interface FeedPostRow {
  id: string
  text: string | null
  imageUrl: string | null
  blocks: unknown
  settings: unknown
  createdAt: Date
  authorId: string
  author: FeedRowAuthor
}
export interface FeedResponseRow {
  postId: string
  userId: string
  responses: unknown
  createdAt: Date
  user: { name: string | null; username: string; avatar: string | null }
}

export function assembleFeedPosts(
  posts: FeedPostRow[],
  likeGroups: { postId: string; _count: { postId: number } }[],
  myLikes: { postId: string }[],
  responseRows: FeedResponseRow[],
  meId: string,
) {
  const likeCountByPost = new Map(likeGroups.map((g) => [g.postId, g._count.postId]))
  const likedSet = new Set(myLikes.map((l) => l.postId))
  const responsesByPost = new Map<string, FeedResponseRow[]>()
  for (const r of responseRows) {
    const arr = responsesByPost.get(r.postId) || []
    arr.push(r)
    responsesByPost.set(r.postId, arr)
  }

  return posts.map((p) => {
    const blocks = Array.isArray(p.blocks) ? (p.blocks as any[]) : []
    const block = blocks[0] || null
    const settings = normalizeSettings(p.settings)
    const rows = responsesByPost.get(p.id) || []
    const mine = rows.find((r) => r.userId === meId)
    const isAuthor = p.authorId === meId
    const hasResponded = !!mine

    let results = null
    if (block) {
      const canSee = resultsVisible({ isAuthor, revealAfterAnswer: settings.revealAfterAnswer, hasResponded })
      if (canSee) {
        results = aggregateBlock(block, toRecords(rows as any, false))
      }
    }

    return {
      id: p.id,
      author: { id: p.author.id, name: p.author.name, username: p.author.username, avatar: p.author.avatar },
      text: p.text,
      imageUrl: p.imageUrl,
      block,
      settings,
      createdAt: p.createdAt.toISOString(),
      likeCount: likeCountByPost.get(p.id) || 0,
      likedByMe: likedSet.has(p.id),
      myResponse: (mine?.responses as Record<string, { type: string; answer: unknown }>) || null,
      results,
    }
  })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/lib/bulletin-feed.test.ts`
Expected: PASS.

- [ ] **Step 5: Refactor the feed route to use the assembler**

In `src/app/api/bulletin/feed/route.ts`, replace the block from `const likeCountByPost = new Map(...)` through the end of the `const feed = posts.map((p) => { ... })` assignment (the map-building + assembly, currently ~lines 54–93) with a single call. The final route body from the response-data fetch onward becomes:

```ts
    const postIds = posts.map((p) => p.id)
    const [likeGroups, myLikes, allResponses] = await Promise.all([
      db.bulletinLike.groupBy({ by: ['postId'], where: { postId: { in: postIds } }, _count: { postId: true } }),
      db.bulletinLike.findMany({ where: { postId: { in: postIds }, userId: me.id }, select: { postId: true } }),
      db.bulletinResponse.findMany({
        where: { postId: { in: postIds } },
        select: { postId: true, userId: true, responses: true, createdAt: true, user: { select: { name: true, username: true, avatar: true } } },
      }),
    ])

    const feed = assembleFeedPosts(posts, likeGroups, myLikes, allResponses, me.id)

    return NextResponse.json({ posts: feed, hasMore: page * limit < total, page })
```

Add the import at the top and remove now-unused imports (`normalizeSettings`, `resultsVisible`, `aggregateBlock`, `toRecords`) **only if no longer referenced** in this file:

```ts
import { assembleFeedPosts } from '@/lib/bulletin-feed'
```

(The `posts` `findMany` select must keep `authorId` and `author {id,name,username,avatar}` — it already does.)

- [ ] **Step 6: Typecheck + full suite**

Run: `pnpm exec tsc --noEmit && pnpm test`
Expected: clean; full suite green (the feed route is behavior-preserving; the new assembler test passes).

- [ ] **Step 7: Commit**

```bash
git add src/lib/bulletin-feed.ts src/lib/bulletin-feed.test.ts src/app/api/bulletin/feed/route.ts
git commit -m "refactor(bulletin): extract assembleFeedPosts; feed route uses shared assembler"
```

---

### Task 4: Trending route — `GET /api/bulletin/trending`

**Files:**
- Create: `src/app/api/bulletin/trending/route.ts`

**Interfaces:**
- Consumes: `scoreTrending`/`rankTrending` (Task 2), `assembleFeedPosts` (Task 3), `getUser` (`@/lib/auth`), `db` (`@/lib/db`).
- Produces: `GET` returning `{ posts, hasMore, page }` — identical shape to the feed route.

**Verification note:** no route-handler test (repo has none). Gate on `tsc` + code review; behavior is exercised in Task 7's live pass. The route's non-trivial logic (scoring, ranking, assembly) already has unit tests via Tasks 2–3.

- [ ] **Step 1: Implement the route**

Create `src/app/api/bulletin/trending/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'
import { rankTrending } from '@/lib/bulletin'
import { assembleFeedPosts } from '@/lib/bulletin-feed'

const PAGE_SIZE = 15
const CANDIDATE_CAP = 200
const WINDOW_DAYS = 7

export async function GET(request: NextRequest) {
  try {
    const me = await getUser(request)
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = request.nextUrl
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const limit = Math.min(PAGE_SIZE, Math.max(1, parseInt(searchParams.get('limit') || String(PAGE_SIZE), 10)))

    const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000)

    // 1) Bounded candidate set: public posts within the window.
    const candidates = await db.bulletinPost.findMany({
      where: { isPublic: true, createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' },
      take: CANDIDATE_CAP,
      select: { id: true, createdAt: true },
    })

    if (candidates.length === 0) {
      return NextResponse.json({ posts: [], hasMore: false, page })
    }

    // 2) Engagement counts for candidates (batched — no N+1).
    const candidateIds = candidates.map((c) => c.id)
    const [likeGroupsAll, responseGroupsAll] = await Promise.all([
      db.bulletinLike.groupBy({ by: ['postId'], where: { postId: { in: candidateIds } }, _count: { postId: true } }),
      db.bulletinResponse.groupBy({ by: ['postId'], where: { postId: { in: candidateIds } }, _count: { postId: true } }),
    ])
    const likeCountMap = new Map(likeGroupsAll.map((g) => [g.postId, g._count.postId]))
    const responseCountMap = new Map(responseGroupsAll.map((g) => [g.postId, g._count.postId]))

    // 3) Rank + paginate (pure helper).
    const { pageItems, total } = rankTrending(
      candidates.map((c) => ({
        id: c.id,
        createdAt: c.createdAt,
        likeCount: likeCountMap.get(c.id) || 0,
        responseCount: responseCountMap.get(c.id) || 0,
      })),
      page,
      limit,
    )
    const pageIds = pageItems.map((i) => i.id)
    if (pageIds.length === 0) {
      return NextResponse.json({ posts: [], hasMore: false, page })
    }

    // 4) Fetch full data for the page, then assemble (same shape as the feed route).
    const [pagePosts, pageLikeGroups, myLikes, responseRows] = await Promise.all([
      db.bulletinPost.findMany({
        where: { id: { in: pageIds } },
        select: {
          id: true, text: true, imageUrl: true, blocks: true, settings: true, createdAt: true, authorId: true,
          author: { select: { id: true, name: true, username: true, avatar: true } },
        },
      }),
      db.bulletinLike.groupBy({ by: ['postId'], where: { postId: { in: pageIds } }, _count: { postId: true } }),
      db.bulletinLike.findMany({ where: { postId: { in: pageIds }, userId: me.id }, select: { postId: true } }),
      db.bulletinResponse.findMany({
        where: { postId: { in: pageIds } },
        select: { postId: true, userId: true, responses: true, createdAt: true, user: { select: { name: true, username: true, avatar: true } } },
      }),
    ])

    // Preserve ranked order (findMany does not guarantee it).
    const orderIndex = new Map(pageIds.map((id, i) => [id, i]))
    pagePosts.sort((a, b) => (orderIndex.get(a.id)! - orderIndex.get(b.id)!))

    const posts = assembleFeedPosts(pagePosts, pageLikeGroups, myLikes, responseRows, me.id)

    return NextResponse.json({ posts, hasMore: page * limit < total, page })
  } catch (error) {
    console.error('Bulletin trending error:', error)
    return NextResponse.json({ error: 'Failed to fetch trending' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Typecheck + full suite**

Run: `pnpm exec tsc --noEmit && pnpm test`
Expected: clean; full suite green (unchanged count — no new test file this task; the helpers it uses are already covered).

- [ ] **Step 3: Commit**

```bash
git add src/app/api/bulletin/trending/route.ts
git commit -m "feat(bulletin): trending route (public posts, engagement-ranked, 7d window)"
```

---

### Task 5: Composer opt-in + create-route write

**Files:**
- Modify: `src/components/bulletin/BulletinComposer.tsx`
- Modify: `src/app/api/bulletin/route.ts`
- Test: `src/components/bulletin/BulletinComposer.test.tsx` (create)

**Interfaces:**
- Consumes: nothing new.
- Produces: create POST body now includes `isPublic: boolean`; the create route persists it.

- [ ] **Step 1: Write the failing test**

Create `src/components/bulletin/BulletinComposer.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BulletinComposer } from './BulletinComposer'

describe('BulletinComposer', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ id: 'p1' }) })) as unknown as typeof fetch)
  })

  it('includes isPublic:true in the POST body when "Share to Trending" is toggled on', async () => {
    render(<BulletinComposer onPosted={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /share something/i }))
    fireEvent.change(screen.getByPlaceholderText(/what's on your mind/i), { target: { value: 'hello' } })
    fireEvent.click(screen.getByLabelText(/share to trending/i))
    fireEvent.click(screen.getByRole('button', { name: /^post$/i }))

    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/bulletin', expect.anything()))
    const call = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.find((c) => c[0] === '/api/bulletin')!
    expect(JSON.parse(call[1].body)).toMatchObject({ text: 'hello', isPublic: true })
  })

  it('defaults isPublic to false', async () => {
    render(<BulletinComposer onPosted={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /share something/i }))
    fireEvent.change(screen.getByPlaceholderText(/what's on your mind/i), { target: { value: 'hi' } })
    fireEvent.click(screen.getByRole('button', { name: /^post$/i }))
    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/bulletin', expect.anything()))
    const call = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.find((c) => c[0] === '/api/bulletin')!
    expect(JSON.parse(call[1].body).isPublic).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/components/bulletin/BulletinComposer.test.tsx`
Expected: FAIL — no "Share to Trending" control; `isPublic` not in body.

- [ ] **Step 3: Add the toggle to the composer**

In `src/components/bulletin/BulletinComposer.tsx`:

Add state near the other `useState` calls (after `const [liveTally, setLive] = useState(true)`):
```ts
  const [isPublic, setIsPublic] = useState(false)
```

Reset it in `reset()` (add `setIsPublic(false)` to the existing setters):
```ts
  const reset = () => {
    setText(''); setImageUrl(null); setBlock(null); setReveal(false); setLive(true); setIsPublic(false); setExpanded(false)
  }
```

Include it in the POST body:
```ts
        body: JSON.stringify({ text, imageUrl, block, settings: { revealAfterAnswer, liveTally }, isPublic }),
```

Add the toggle in the footer row so it is available for **every** post (not gated on a block). Replace the final actions row (`<div className="flex items-center justify-end gap-2">…</div>`) with:
```tsx
      <div className="flex items-center justify-between gap-2">
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} /> 🌍 Share to Trending
        </label>
        <div className="flex items-center gap-2">
          <button onClick={reset} className="rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground">Cancel</button>
          <button
            onClick={post}
            disabled={!canPost || posting}
            className="rounded-lg bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
          >
            {posting ? 'Posting…' : 'Post'}
          </button>
        </div>
      </div>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/components/bulletin/BulletinComposer.test.tsx`
Expected: PASS.

- [ ] **Step 5: Persist `isPublic` in the create route**

In `src/app/api/bulletin/route.ts`, after the `block` parsing line (`const block = ...`), add:
```ts
    const isPublic = body.isPublic === true
```
and add `isPublic` to the `create` `data` object:
```ts
      data: {
        authorId: me.id,
        text,
        imageUrl,
        isPublic,
        blocks: block ? [block] : [],
        settings: normalizeSettings(body.settings) as unknown as Prisma.InputJsonValue,
      },
```

- [ ] **Step 6: Typecheck + full suite**

Run: `pnpm exec tsc --noEmit && pnpm test`
Expected: clean; full suite green including the two new composer tests.

- [ ] **Step 7: Commit**

```bash
git add src/components/bulletin/BulletinComposer.tsx src/components/bulletin/BulletinComposer.test.tsx src/app/api/bulletin/route.ts
git commit -m "feat(bulletin): composer 'Share to Trending' toggle + create route persists isPublic"
```

---

### Task 6: `BulletinTab` — Following | Trending tabs + gradient panel

**Files:**
- Modify: `src/components/bulletin/BulletinTab.tsx`
- Test: `src/components/bulletin/BulletinTab.test.tsx` (create)

**Interfaces:**
- Consumes: `/api/bulletin/feed` (Following) and `/api/bulletin/trending` (Trending); `BulletinPostCard`, `BulletinComposer`.

- [ ] **Step 1: Write the failing test**

Create `src/components/bulletin/BulletinTab.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BulletinTab } from './BulletinTab'

vi.mock('@/lib/store', () => ({ useAuthStore: () => ({ user: { id: 'me' } }) }))
vi.mock('./BulletinComposer', () => ({ BulletinComposer: () => <div data-testid="composer" /> }))
vi.mock('./BulletinPostCard', () => ({ BulletinPostCard: () => <div data-testid="post" /> }))

describe('BulletinTab', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ posts: [] }) })) as unknown as typeof fetch)
  })

  it('loads the Following feed by default', async () => {
    render(<BulletinTab />)
    await waitFor(() => expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/api/bulletin/feed')))
  })

  it('fetches the trending endpoint when the Trending tab is selected', async () => {
    render(<BulletinTab />)
    fireEvent.click(screen.getByRole('button', { name: /trending/i }))
    await waitFor(() => expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/api/bulletin/trending')))
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/components/bulletin/BulletinTab.test.tsx`
Expected: FAIL — no Trending tab; only `/api/bulletin/feed` is ever called.

- [ ] **Step 3: Implement tabs + gradient frame**

Replace the entire body of `src/components/bulletin/BulletinTab.tsx` with:

```tsx
'use client'

import { useCallback, useEffect, useState } from 'react'
import { useAuthStore } from '@/lib/store'
import { BulletinComposer } from './BulletinComposer'
import { BulletinPostCard, type FeedPost } from './BulletinPostCard'

type Tab = 'following' | 'trending'
const ENDPOINT: Record<Tab, string> = {
  following: '/api/bulletin/feed',
  trending: '/api/bulletin/trending',
}

export function BulletinTab() {
  const { user } = useAuthStore()
  const [tab, setTab] = useState<Tab>('following')
  const [posts, setPosts] = useState<FeedPost[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback((which: Tab) => {
    setLoading(true)
    fetch(ENDPOINT[which])
      .then((r) => (r.ok ? r.json() : { posts: [] }))
      .then((d) => setPosts(Array.isArray(d.posts) ? d.posts : []))
      .catch(() => setPosts([]))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load(tab) }, [load, tab])

  const onDeleted = (id: string) => setPosts((prev) => prev.filter((p) => p.id !== id))

  const tabBtn = (id: Tab, label: string) => {
    const active = tab === id
    return (
      <button
        onClick={() => setTab(id)}
        className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
          active
            ? 'bg-gradient-to-r from-galli via-galli-aqua to-galli-violet text-white'
            : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        {label}
      </button>
    )
  }

  return (
    <div className="rounded-2xl bg-gradient-to-br from-galli via-galli-aqua to-galli-violet p-[1.5px]">
      <div className="rounded-[15px] bg-surface p-3 space-y-3">
        <div className="flex gap-1 rounded-xl bg-background p-1">
          {tabBtn('following', 'Following')}
          {tabBtn('trending', 'Trending')}
        </div>

        <BulletinComposer onPosted={() => load(tab)} />

        {loading && posts.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>
        ) : posts.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
            {tab === 'following'
              ? 'No bulletins yet. Post one, or follow people to see theirs.'
              : 'Nothing trending yet — share a post publicly to start.'}
          </p>
        ) : (
          posts.map((p) => <BulletinPostCard key={p.id} post={p} currentUserId={user?.id} onDeleted={onDeleted} />)
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/components/bulletin/BulletinTab.test.tsx`
Expected: PASS.

- [ ] **Step 5: Typecheck + full suite**

Run: `pnpm exec tsc --noEmit && pnpm test`
Expected: clean; full suite green.

- [ ] **Step 6: Commit**

```bash
git add src/components/bulletin/BulletinTab.tsx src/components/bulletin/BulletinTab.test.tsx
git commit -m "feat(bulletin): Following|Trending tabs + gradient panel frame"
```

---

### Task 7: Local migration apply + live verification

No code. Apply the migration to the local DB and drive the real flow (the parts unit tests can't cover: the trending query, opt-in persistence, tab switching, and the gradient render).

- [ ] **Step 1: Apply the migration locally**

The machine `DATABASE_URL` overrides `.env` and points at the wrong DB; set the local DB inline (per project gotcha) and deploy the migration:
```bash
DATABASE_URL="postgresql://pages:pages@127.0.0.1:5434/pages" npx prisma migrate deploy
```
Expected: the `add_bulletin_is_public` migration applies (or "already applied"). If the local Postgres (docker, port 5434) isn't running, start it first (`docker compose up -d`).

- [ ] **Step 2: Build sanity**

Stop any running `pnpm dev` first, then:
Run: `pnpm build`
Expected: build succeeds (routes compile, no type/CSP errors).

- [ ] **Step 3: Start dev and verify the flow**

Run `pnpm dev`. Log in. In the bulletin panel:
- Confirm the **gradient border** frames the panel and the **Following | Trending** toggle renders with the active tab gradient-filled.
- Post a bulletin with **🌍 Share to Trending** ON (add a poll). Post another with it OFF.
- Switch to **Trending** → the public one appears; the follower-only one does not.
- From a second account (or the demo seed accounts), respond to the public poll → confirm it still works and the author's analytics shows the responder (everyone-identified).
- Confirm **Following** still shows follower-scoped posts unchanged.

Expected: no console errors; trending shows only public posts, ranked with the most-engaged first.

- [ ] **Step 4: Commit any fixes**

If Steps 1–3 surface issues, fix + commit with a descriptive message. If all pass, no commit needed.

---

## Self-Review

**Spec coverage:**
- `isPublic` column + index + additive migration → Task 1. ✓
- `scoreTrending` + ranking → Task 2. ✓
- Shared `assembleFeedPosts` (no feed drift) + feed refactor → Task 3. ✓
- Trending route (public + 7d window + cap 200 + rank + same shape + auth) → Task 4. ✓
- Composer opt-in toggle + create-route write + strict boolean coercion → Task 5. ✓
- Following|Trending tabs + per-tab empty states + gradient frame + active-tab gradient → Task 6. ✓
- Responses fully identified / no analytics change → guaranteed (no analytics/respond file touched anywhere). ✓
- "Public" = auth-gated → Task 4 `getUser` 401. ✓
- Testing: pure helpers (Tasks 2, 3) + components (Tasks 5, 6); routes via tsc + review + Task 7 e2e. ✓
- Privacy: default false, aggregate-only feed payload → Tasks 1, 3, 4. ✓

**Placeholder scan:** No TBD/TODO; every code step has complete code. The migration timestamp is intentionally `<TIMESTAMP>` (the implementer stamps a real UTC value — Prisma requires a unique ordered prefix). ✓

**Type consistency:** `assembleFeedPosts(posts, likeGroups, myLikes, responseRows, meId)` signature is identical in Task 3 (definition), Task 4 (trending caller), and Task 3 Step 5 (feed caller). `rankTrending(items, page, limit) → { pageItems, total }` and `TrendingCandidate` fields (`id/likeCount/responseCount/createdAt`) match between Task 2 (definition) and Task 4 (caller: builds objects with exactly those fields). `scoreTrending(likeCount, responseCount)` consistent. ✓
