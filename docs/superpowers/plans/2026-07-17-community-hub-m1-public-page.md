# Community Hub M1 — Public Page + Social Feed — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn a community-enabled Hub into a themed, independently-publishable public community page with a social feed (emoji reactions, composer), Members/Resources/Video sidebar, and Follow/Join/Share.

**Architecture:** A community hub renders a new `CommunityHubView` from the public page (`/[username]/hub/[slug]`) instead of the file-data-room `HubViewer`. Communities publish via a new `Hub.published` flag (independent of any linked Display). Post reactions move from a single `HubPostLike` to a multi-emoji `HubPostReaction` model; the shared `BulletinPostCard` renders a reaction bar only when the feed supplies reaction data, so the separate Bulletin feature is untouched.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Prisma/PostgreSQL, Tailwind, Vitest. Auth via `getUser` (API) / `getUserFromCookies` (server components). Existing community helpers in `src/lib/community.ts`; feed helpers in `src/lib/bulletin.ts` + `src/lib/element-aggregate.ts`.

## Global Constraints

- **Spec:** `docs/superpowers/specs/2026-07-17-community-hub-builder-design.md`. This plan implements **M1 only**.
- **Reaction emoji set (exact):** `❤️ 👍 😂 🎉 😮 😢`. A user may hold at most one of each per post.
- **Follow = membership** — one concept; reuse `HubMember` + `POST/DELETE /api/hubs/[id]/join`. No separate follow model.
- **Migrations are non-interactive here.** Never `prisma migrate dev`. Hand-author `prisma/migrations/<timestamp>_<name>/migration.sql`, then run with both vars set: `DATABASE_URL` and `DATABASE_URL_UNPOOLED` (schema `directUrl`). Do not run `migrate diff --from-url` on the shared dev DB (contaminated). For local testing use a **fresh isolated DB** (see Task 12).
- **Windows gotchas:** stop `pnpm dev` before `pnpm build`/`prisma generate` (EPERM/`.next` races). Use `127.0.0.1` not `localhost` for the DB.
- **Lint gates the prod build** — run `pnpm exec next lint` before claiming done (tsc does not run ESLint). Escape apostrophes in JSX (`react/no-unescaped-entities`); use `<Link>` for internal static routes.
- **Never commit:** `Documents/`, `Images/`, `g1t.json`, `nul`, `.claude/settings.local.json`.
- Work on branch `feat/community-entity` (continues the Community-as-entity foundation).

## File structure

- **New libs:** `src/lib/hub-reactions.ts` (emoji set + `summarizeReactions`), `src/lib/hub-video-embed.ts` (URL → embed).
- **New API:** `src/app/api/hubs/[id]/posts/[postId]/reactions/route.ts`.
- **New components:** `src/components/hub/community/CommunityHubView.tsx`, `CommunityHeader.tsx`, `CommunityFeed.tsx`, `CommunitySidebar.tsx`, `ReactionBar.tsx` (all under `src/components/hub/community/`).
- **Changed:** `prisma/schema.prisma`, `src/app/api/hubs/route.ts` (POST sets `published`), `src/app/api/hubs/[id]/route.ts` (PATCH allowlist), `src/app/api/hubs/[id]/posts/route.ts` (reaction summary + publish read-gate), `src/app/api/hubs/[id]/posts/[postId]/comments/route.ts` (publish read-gate), `src/app/[username]/hub/[slug]/page.tsx` (community branch), `src/components/bulletin/BulletinPostCard.tsx` (ReactionBar), `src/lib/community.ts` (`canViewCommunityHub`), `src/components/hub/HubEditor.tsx` (owner controls).
- **Removed (Task 11):** `src/app/api/hubs/[id]/posts/[postId]/like/route.ts` + `HubPostLike` model.

---

### Task 1: Schema + migration — `HubPostReaction`, `Hub` fields, backfill

**Files:**
- Modify: `prisma/schema.prisma` (Hub model ~550, HubPost ~661, User relations ~49)
- Create: `prisma/migrations/20260717000000_community_m1/migration.sql`

**Interfaces:**
- Produces: `HubPostReaction { id, postId, userId, emoji, createdAt }` (unique `[postId,userId,emoji]`); `Hub.published Boolean`, `Hub.tagline String?`, `Hub.heroVideoUrl String?`; relations `HubPost.reactions`, `User.hubPostReactions`.

- [ ] **Step 1: Add fields to `Hub` in `prisma/schema.prisma`** (inside `model Hub`, after `community` line):

```prisma
  community   Boolean     @default(false)
  published   Boolean     @default(false)
  tagline     String?
  heroVideoUrl String?
```

- [ ] **Step 2: Add `reactions` relation to `HubPost`** (inside `model HubPost`, after `likes` line):

```prisma
  likes     HubPostLike[]
  reactions HubPostReaction[]
```

- [ ] **Step 3: Add the `HubPostReaction` model** (after `model HubPostLike { ... }`):

```prisma
model HubPostReaction {
  id        String   @id @default(cuid())
  postId    String
  post      HubPost  @relation(fields: [postId], references: [id], onDelete: Cascade)
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  emoji     String
  createdAt DateTime @default(now())
  @@unique([postId, userId, emoji])
  @@index([postId])
}
```

- [ ] **Step 4: Add the User back-relation** (in `model User`, after `hubPostLikes HubPostLike[]`):

```prisma
  hubPostLikes HubPostLike[]
  hubPostReactions HubPostReaction[]
```

- [ ] **Step 5: Hand-author the migration** `prisma/migrations/20260717000000_community_m1/migration.sql`:

```sql
-- HubPostReaction
CREATE TABLE "HubPostReaction" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HubPostReaction_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "HubPostReaction_postId_userId_emoji_key" ON "HubPostReaction"("postId", "userId", "emoji");
CREATE INDEX "HubPostReaction_postId_idx" ON "HubPostReaction"("postId");
ALTER TABLE "HubPostReaction" ADD CONSTRAINT "HubPostReaction_postId_fkey" FOREIGN KEY ("postId") REFERENCES "HubPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HubPostReaction" ADD CONSTRAINT "HubPostReaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Hub new columns
ALTER TABLE "Hub" ADD COLUMN "published" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Hub" ADD COLUMN "tagline" TEXT;
ALTER TABLE "Hub" ADD COLUMN "heroVideoUrl" TEXT;

-- Existing communities stay publicly live
UPDATE "Hub" SET "published" = true WHERE "community" = true;

-- Backfill existing likes as heart reactions (reuse the like id -> stays unique)
INSERT INTO "HubPostReaction" ("id", "postId", "userId", "emoji", "createdAt")
SELECT "id", "postId", "userId", '❤️', "createdAt" FROM "HubPostLike";
```

- [ ] **Step 6: Apply to a fresh local DB and regenerate client**

Run (Git Bash):
```bash
docker exec pages-mvp-postgres-1 psql -U pages -d pages -c "DROP DATABASE IF EXISTS pages_m1 WITH (FORCE);" -c "CREATE DATABASE pages_m1;"
export DATABASE_URL="postgresql://pages:pages@127.0.0.1:5434/pages_m1" DATABASE_URL_UNPOOLED="postgresql://pages:pages@127.0.0.1:5434/pages_m1"
pnpm exec prisma migrate deploy && pnpm exec prisma generate
```
Expected: "All migrations have been successfully applied." and client generated (retry `prisma generate` if EPERM while dev runs).

- [ ] **Step 7: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: exit 0 (new Prisma types compile).

- [ ] **Step 8: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260717000000_community_m1
git commit -m "feat(community): HubPostReaction + Hub.published/tagline/heroVideoUrl (M1 schema)"
```

---

### Task 2: Reaction helpers (`src/lib/hub-reactions.ts`)

**Files:**
- Create: `src/lib/hub-reactions.ts`
- Test: `src/lib/hub-reactions.test.ts`

**Interfaces:**
- Produces: `HUB_REACTION_EMOJI: readonly string[]`, `isHubReactionEmoji(v): boolean`, `type ReactionSummary = { counts: Record<string, number>; mine: string[] }`, `summarizeReactions(rows: {emoji:string;userId:string}[], meId?: string): ReactionSummary`.

- [ ] **Step 1: Write the failing test** `src/lib/hub-reactions.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { HUB_REACTION_EMOJI, isHubReactionEmoji, summarizeReactions } from './hub-reactions'

describe('hub-reactions', () => {
  it('exposes the curated emoji set', () => {
    expect(HUB_REACTION_EMOJI).toEqual(['❤️', '👍', '😂', '🎉', '😮', '😢'])
  })
  it('validates emoji membership', () => {
    expect(isHubReactionEmoji('❤️')).toBe(true)
    expect(isHubReactionEmoji('🐸')).toBe(false)
    expect(isHubReactionEmoji(42)).toBe(false)
  })
  it('summarizes counts and the viewer\'s own reactions', () => {
    const rows = [
      { emoji: '❤️', userId: 'a' },
      { emoji: '❤️', userId: 'b' },
      { emoji: '👍', userId: 'a' },
    ]
    expect(summarizeReactions(rows, 'a')).toEqual({ counts: { '❤️': 2, '👍': 1 }, mine: ['❤️', '👍'] })
    expect(summarizeReactions(rows).mine).toEqual([])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/lib/hub-reactions.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement** `src/lib/hub-reactions.ts`:

```ts
export const HUB_REACTION_EMOJI = ['❤️', '👍', '😂', '🎉', '😮', '😢'] as const
export type HubReactionEmoji = (typeof HUB_REACTION_EMOJI)[number]

export function isHubReactionEmoji(v: unknown): v is HubReactionEmoji {
  return typeof v === 'string' && (HUB_REACTION_EMOJI as readonly string[]).includes(v)
}

export type ReactionSummary = { counts: Record<string, number>; mine: string[] }

export function summarizeReactions(
  rows: { emoji: string; userId: string }[],
  meId?: string,
): ReactionSummary {
  const counts: Record<string, number> = {}
  const mine: string[] = []
  for (const r of rows) {
    counts[r.emoji] = (counts[r.emoji] || 0) + 1
    if (meId && r.userId === meId) mine.push(r.emoji)
  }
  return { counts, mine }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/lib/hub-reactions.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/hub-reactions.ts src/lib/hub-reactions.test.ts
git commit -m "feat(community): reaction emoji set + summarize helper"
```

---

### Task 3: Reactions API route

**Files:**
- Create: `src/app/api/hubs/[id]/posts/[postId]/reactions/route.ts`
- Test: `src/app/api/hubs/[id]/posts/[postId]/reactions/route.test.ts`

**Interfaces:**
- Consumes: `canParticipate` (`@/lib/community`), `isHubReactionEmoji` + `summarizeReactions` (`@/lib/hub-reactions`).
- Produces: `POST`/`DELETE` returning `{ counts: Record<string,number>, mine: string[] }`.

- [ ] **Step 1: Write the failing test** `src/app/api/hubs/[id]/posts/[postId]/reactions/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({ getUser: vi.fn() }))
vi.mock('@/lib/rate-limit', () => ({ rateLimit: vi.fn().mockResolvedValue(null) }))
vi.mock('@/lib/db', () => ({
  db: {
    hub: { findUnique: vi.fn() },
    hubPost: { findFirst: vi.fn() },
    hubMember: { findUnique: vi.fn() },
    hubCollaborator: { findMany: vi.fn() },
    hubPostReaction: { upsert: vi.fn(), deleteMany: vi.fn(), findMany: vi.fn() },
  },
}))

import { getUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { POST, DELETE } from './route'

const ctx = { params: Promise.resolve({ id: 'h1', postId: 'p1' }) }
const req = (body: unknown) => new Request('http://localhost/api/hubs/h1/posts/p1/reactions', { method: 'POST', body: JSON.stringify(body) }) as any

beforeEach(() => {
  vi.clearAllMocks()
  ;(db.hub.findUnique as any).mockResolvedValue({ id: 'h1', userId: 'owner', community: true })
  ;(db.hubPost.findFirst as any).mockResolvedValue({ id: 'p1' })
  ;(db.hubMember.findUnique as any).mockResolvedValue({ id: 'm' })
  ;(db.hubCollaborator.findMany as any).mockResolvedValue([])
  ;(db.hubPostReaction.upsert as any).mockResolvedValue({})
  ;(db.hubPostReaction.deleteMany as any).mockResolvedValue({})
  ;(db.hubPostReaction.findMany as any).mockResolvedValue([{ emoji: '❤️', userId: 'me' }])
})

describe('POST reactions', () => {
  it('401 when unauthenticated', async () => {
    ;(getUser as any).mockResolvedValue(null)
    expect((await POST(req({ emoji: '❤️' }), ctx)).status).toBe(401)
  })
  it('400 on invalid emoji', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'me' })
    expect((await POST(req({ emoji: '🐸' }), ctx)).status).toBe(400)
  })
  it('404 on non-community hub', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'me' })
    ;(db.hub.findUnique as any).mockResolvedValue({ id: 'h1', userId: 'owner', community: false })
    expect((await POST(req({ emoji: '❤️' }), ctx)).status).toBe(404)
  })
  it('403 when not a participant', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'stranger' })
    ;(db.hubMember.findUnique as any).mockResolvedValue(null)
    expect((await POST(req({ emoji: '❤️' }), ctx)).status).toBe(403)
  })
  it('adds a reaction and returns the summary', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'me' })
    const res = await POST(req({ emoji: '❤️' }), ctx)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ counts: { '❤️': 1 }, mine: ['❤️'] })
    expect(db.hubPostReaction.upsert).toHaveBeenCalled()
  })
})

describe('DELETE reactions', () => {
  it('removes the caller\'s reaction', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'me' })
    ;(db.hubPostReaction.findMany as any).mockResolvedValue([])
    const del = new Request('http://localhost/api/hubs/h1/posts/p1/reactions', { method: 'DELETE', body: JSON.stringify({ emoji: '❤️' }) }) as any
    const res = await DELETE(del, ctx)
    expect(res.status).toBe(200)
    expect(db.hubPostReaction.deleteMany).toHaveBeenCalledWith({ where: { postId: 'p1', userId: 'me', emoji: '❤️' } })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run "src/app/api/hubs/[id]/posts/[postId]/reactions/route.test.ts"`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement** `src/app/api/hubs/[id]/posts/[postId]/reactions/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'
import { canParticipate } from '@/lib/community'
import { rateLimit } from '@/lib/rate-limit'
import { isHubReactionEmoji, summarizeReactions } from '@/lib/hub-reactions'

async function reactionState(postId: string, userId: string) {
  const rows = await db.hubPostReaction.findMany({ where: { postId }, select: { emoji: true, userId: true } })
  return summarizeReactions(rows, userId)
}

async function collaboratorIds(hubId: string): Promise<string[]> {
  const rows = await db.hubCollaborator.findMany({ where: { hubId }, select: { userId: true } })
  return rows.map((r) => r.userId)
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string; postId: string }> }) {
  const { id, postId } = await params
  const limited = await rateLimit(request, { limit: 60, windowMs: 60_000, prefix: 'hub-reaction' })
  if (limited) return limited
  const me = await getUser(request)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await request.json().catch(() => ({}))
  if (!isHubReactionEmoji(body.emoji)) return NextResponse.json({ error: 'Invalid emoji' }, { status: 400 })
  const emoji = body.emoji as string
  const hub = await db.hub.findUnique({ where: { id }, select: { id: true, userId: true, community: true } })
  if (!hub || !hub.community) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const post = await db.hubPost.findFirst({ where: { id: postId, hubId: id }, select: { id: true } })
  if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const isMember = !!(await db.hubMember.findUnique({ where: { hubId_userId: { hubId: id, userId: me.id } }, select: { id: true } }))
  const collabIds = await collaboratorIds(id)
  if (!canParticipate(me.id, hub, collabIds, isMember)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  await db.hubPostReaction.upsert({
    where: { postId_userId_emoji: { postId, userId: me.id, emoji } },
    create: { postId, userId: me.id, emoji },
    update: {},
  })
  return NextResponse.json(await reactionState(postId, me.id))
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string; postId: string }> }) {
  const { postId } = await params
  const me = await getUser(request)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await request.json().catch(() => ({}))
  if (!isHubReactionEmoji(body.emoji)) return NextResponse.json({ error: 'Invalid emoji' }, { status: 400 })
  await db.hubPostReaction.deleteMany({ where: { postId, userId: me.id, emoji: body.emoji as string } })
  return NextResponse.json(await reactionState(postId, me.id))
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run "src/app/api/hubs/[id]/posts/[postId]/reactions/route.test.ts"`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add "src/app/api/hubs/[id]/posts/[postId]/reactions"
git commit -m "feat(community): emoji reactions API route"
```

---

### Task 4: Feed GET returns reaction summary

**Files:**
- Modify: `src/app/api/hubs/[id]/posts/route.ts` (GET, ~28-79)
- Test: `src/app/api/hubs/[id]/posts/route.test.ts` (add a GET test; file exists with POST tests)

**Interfaces:**
- Consumes: `summarizeReactions` (`@/lib/hub-reactions`).
- Produces: each feed post gains `reactions: { counts, mine }`.

- [ ] **Step 1: Write the failing test** — append to `src/app/api/hubs/[id]/posts/route.test.ts`. Add `hubPostReaction: { findMany: vi.fn() }` to the `db` mock object, and in `beforeEach` add `;(db.hubPostReaction.findMany as any).mockResolvedValue([])`. Then add:

```ts
describe('GET /api/hubs/[id]/posts — reactions', () => {
  it('includes a reaction summary per post', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'm1', name: 'M1', username: 'm1', avatar: null })
    ;(db.hubPost.findMany as any).mockResolvedValue([
      { id: 'p1', author: { id: 'a', name: 'A', username: 'a', avatar: null }, text: 'hi', imageUrl: null, blocks: [], settings: {}, createdAt: new Date(), authorId: 'a', likes: [], _count: { comments: 0 } },
    ])
    ;(db.hubPostReaction.findMany as any).mockResolvedValue([
      { postId: 'p1', emoji: '❤️', userId: 'm1' },
      { postId: 'p1', emoji: '❤️', userId: 'z' },
    ])
    const res = await GET(getReq(), ctx)
    const body = await res.json()
    expect(body.posts[0].reactions).toEqual({ counts: { '❤️': 2 }, mine: ['❤️'] })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run "src/app/api/hubs/[id]/posts/route.test.ts" -t reactions`
Expected: FAIL (`reactions` undefined).

- [ ] **Step 3: Implement** — in `src/app/api/hubs/[id]/posts/route.ts`:

Add import at top:
```ts
import { summarizeReactions } from '@/lib/hub-reactions'
```

After the `byPost` map block (right before `const feed = posts.map(...)`), add the reactions batch:
```ts
  const reactionRows = postIds.length
    ? await db.hubPostReaction.findMany({ where: { postId: { in: postIds } }, select: { postId: true, emoji: true, userId: true } })
    : []
  const reactionsByPost = new Map<string, { emoji: string; userId: string }[]>()
  for (const r of reactionRows) {
    const list = reactionsByPost.get(r.postId)
    if (list) list.push(r)
    else reactionsByPost.set(r.postId, [r])
  }
```

In the `feed` map return object, add:
```ts
      likedByMe: me ? p.likes.some((l) => l.userId === me.id) : false,
      reactions: summarizeReactions(reactionsByPost.get(p.id) || [], me?.id),
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run "src/app/api/hubs/[id]/posts/route.test.ts"`
Expected: PASS (existing POST tests + new GET reactions test).

- [ ] **Step 5: Commit**

```bash
git add "src/app/api/hubs/[id]/posts/route.ts" "src/app/api/hubs/[id]/posts/route.test.ts"
git commit -m "feat(community): feed GET returns emoji reaction summary"
```

---

### Task 5: `ReactionBar` component + `BulletinPostCard` integration

**Files:**
- Create: `src/components/hub/community/ReactionBar.tsx`
- Modify: `src/components/bulletin/BulletinPostCard.tsx` (FeedPost type ~10-22; like button ~110-114)

**Interfaces:**
- Consumes: `HUB_REACTION_EMOJI`, `type ReactionSummary` (`@/lib/hub-reactions`).
- Produces: `<ReactionBar postId basePath initial={ReactionSummary} disabled?/>`; `FeedPost.reactions?: ReactionSummary`.

- [ ] **Step 1: Implement `ReactionBar`** `src/components/hub/community/ReactionBar.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { HUB_REACTION_EMOJI, type ReactionSummary } from '@/lib/hub-reactions'

export function ReactionBar({
  postId,
  basePath,
  initial,
  disabled,
}: {
  postId: string
  basePath: string
  initial: ReactionSummary
  disabled?: boolean
}) {
  const [counts, setCounts] = useState<Record<string, number>>(initial.counts)
  const [mine, setMine] = useState<string[]>(initial.mine)
  const [open, setOpen] = useState(false)

  async function toggle(emoji: string) {
    if (disabled) return
    const has = mine.includes(emoji)
    const method = has ? 'DELETE' : 'POST'
    // optimistic
    setMine((m) => (has ? m.filter((e) => e !== emoji) : [...m, emoji]))
    setCounts((c) => ({ ...c, [emoji]: Math.max(0, (c[emoji] || 0) + (has ? -1 : 1)) }))
    try {
      const res = await fetch(`${basePath}/${postId}/reactions`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emoji }),
      })
      if (res.status === 401) { window.location.href = '/login'; return }
      if (res.ok) { const d = await res.json(); setCounts(d.counts); setMine(d.mine) }
    } catch {
      /* leave optimistic state */
    }
    setOpen(false)
  }

  const active = HUB_REACTION_EMOJI.filter((e) => (counts[e] || 0) > 0)

  return (
    <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
      {active.map((e) => (
        <button
          key={e}
          onClick={() => toggle(e)}
          className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${
            mine.includes(e) ? 'border-primary/40 bg-primary/10 text-foreground' : 'border-border text-muted-foreground hover:text-foreground'
          }`}
        >
          <span>{e}</span> <span>{counts[e]}</span>
        </button>
      ))}
      {!disabled && (
        <div className="relative">
          <button onClick={() => setOpen((o) => !o)} className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground" aria-label="Add reaction">
            + 😊
          </button>
          {open && (
            <div className="absolute z-10 mt-1 flex gap-1 rounded-xl border border-border bg-surface p-1.5 shadow-soft">
              {HUB_REACTION_EMOJI.map((e) => (
                <button key={e} onClick={() => toggle(e)} className="rounded-lg px-1 text-lg hover:bg-muted">{e}</button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Wire into `BulletinPostCard`** — in `src/components/bulletin/BulletinPostCard.tsx`:

Add to imports:
```tsx
import { ReactionBar } from '@/components/hub/community/ReactionBar'
import type { ReactionSummary } from '@/lib/hub-reactions'
```

Add to the `FeedPost` interface (after `results`):
```ts
  results: ElementAggregate | null
  reactions?: ReactionSummary
  commentCount?: number
```

Replace the like-button block (the `<div className="flex items-center gap-1 pt-0.5">...toggleLike...</div>`) with a conditional: reactions when the feed supplied them (hub community), else the legacy like button (bulletin):
```tsx
      {post.reactions ? (
        <ReactionBar postId={post.id} basePath={basePath} initial={post.reactions} disabled={!currentUserId} />
      ) : (
        <div className="flex items-center gap-1 pt-0.5">
          <button onClick={toggleLike} className={`flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium ${liked ? 'text-red-500' : 'text-muted-foreground hover:text-foreground'}`}>
            <Heart className={`h-4 w-4 ${liked ? 'fill-red-500' : ''}`} /> {likeCount > 0 ? likeCount : ''}
          </button>
        </div>
      )}
```

- [ ] **Step 3: Typecheck + lint**

Run: `pnpm exec tsc --noEmit && pnpm exec next lint --file src/components/hub/community/ReactionBar.tsx --file src/components/bulletin/BulletinPostCard.tsx`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add src/components/hub/community/ReactionBar.tsx src/components/bulletin/BulletinPostCard.tsx
git commit -m "feat(community): emoji reaction bar in post card"
```

---

### Task 6: Publish gate helper + read-gate wiring

**Files:**
- Modify: `src/lib/community.ts` (add `canViewCommunityHub`)
- Test: `src/lib/community.test.ts` (create if absent, else append)
- Modify: `src/app/api/hubs/[id]/posts/route.ts` (GET read-gate ~18-27)
- Modify: `src/app/api/hubs/[id]/posts/[postId]/comments/route.ts` (GET read-gate — mirror)

**Interfaces:**
- Produces: `canViewCommunityHub({ published: boolean; isPrivileged: boolean }): boolean`.

- [ ] **Step 1: Write the failing test** — `src/lib/community.test.ts` (append or create):

```ts
import { describe, it, expect } from 'vitest'
import { canViewCommunityHub } from './community'

describe('canViewCommunityHub', () => {
  it('published communities are public', () => {
    expect(canViewCommunityHub({ published: true, isPrivileged: false })).toBe(true)
  })
  it('unpublished communities are visible only to privileged viewers', () => {
    expect(canViewCommunityHub({ published: false, isPrivileged: false })).toBe(false)
    expect(canViewCommunityHub({ published: false, isPrivileged: true })).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/lib/community.test.ts`
Expected: FAIL (not exported).

- [ ] **Step 3: Implement** — add to `src/lib/community.ts`:

```ts
// A published community hub is public; an unpublished (draft) one is visible
// only to the owner/collaborators. Replaces the old Display-published read gate
// for community feeds, since standalone communities have no linked Display.
export function canViewCommunityHub(input: { published: boolean; isPrivileged: boolean }): boolean {
  return input.published || input.isPrivileged
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/lib/community.test.ts`
Expected: PASS.

- [ ] **Step 5: Rewire the feed read-gate** — in `src/app/api/hubs/[id]/posts/route.ts` GET, change the hub select to include `published`, and replace the Display-based gate:

Change line ~18 select to:
```ts
  const hub = await db.hub.findUnique({ where: { id }, select: { id: true, community: true, userId: true, published: true } })
```
Replace the block (lines ~21-27, the `display` lookup + `if (!display?.published) {...}`) with:
```ts
  // Draft (unpublished) community posts stay private — only owner + collaborators can read.
  // KEEP IN SYNC with the comments route GET.
  const isPrivileged = !!me && (me.id === hub.userId || (await collaboratorIds(id)).includes(me.id))
  if (!canViewCommunityHub({ published: hub.published, isPrivileged })) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
```
Add `canViewCommunityHub` to the existing `@/lib/community` import.

- [ ] **Step 6: Mirror the gate in comments GET** — open `src/app/api/hubs/[id]/posts/[postId]/comments/route.ts`, find its `readableCommunityHub`/Display-published check in `GET`, and switch it to the same `canViewCommunityHub({ published: hub.published, isPrivileged })` pattern (select `published` on the hub, compute `isPrivileged` from owner/collaborators). Keep behavior identical to the posts GET.

- [ ] **Step 7: Run the affected route tests + typecheck**

Run: `pnpm exec vitest run "src/app/api/hubs/[id]/posts" && pnpm exec tsc --noEmit`
Expected: PASS + exit 0. (If a posts GET test relied on `display.findUnique`, update its mock to set `hub.published: true`.)

- [ ] **Step 8: Commit**

```bash
git add src/lib/community.ts src/lib/community.test.ts "src/app/api/hubs/[id]/posts/route.ts" "src/app/api/hubs/[id]/posts/[postId]/comments/route.ts"
git commit -m "feat(community): publish-based read gate for community feeds"
```

---

### Task 7: PATCH allowlist + community-create sets published

**Files:**
- Modify: `src/app/api/hubs/[id]/route.ts` (PATCH ~32-38)
- Modify: `src/app/api/hubs/route.ts` (POST ~29)

**Interfaces:**
- Produces: PATCH accepts `published` (bool), `tagline` (string), `heroVideoUrl` (string); new community hubs are created `published: true`.

- [ ] **Step 1: Extend the PATCH allowlist** — in `src/app/api/hubs/[id]/route.ts` PATCH, after the `community` line:

```ts
  if (typeof body.community === 'boolean') data.community = body.community
  if (typeof body.published === 'boolean') data.published = body.published
  if (typeof body.tagline === 'string') data.tagline = body.tagline.trim().slice(0, 160)
  if (typeof body.heroVideoUrl === 'string') data.heroVideoUrl = body.heroVideoUrl.trim().slice(0, 500)
```

- [ ] **Step 2: New communities publish immediately** — in `src/app/api/hubs/route.ts` POST, change the create call:

```ts
  const isCommunity = body.community === true
  const hub = await db.hub.create({ data: { userId: me.id, displayId, title, slug, community: isCommunity, published: isCommunity } })
```

- [ ] **Step 3: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add "src/app/api/hubs/[id]/route.ts" src/app/api/hubs/route.ts
git commit -m "feat(community): PATCH allowlist (published/tagline/heroVideoUrl) + publish on create"
```

---

### Task 8: Video embed helper

**Files:**
- Create: `src/lib/hub-video-embed.ts`
- Test: `src/lib/hub-video-embed.test.ts`

**Interfaces:**
- Produces: `type HubVideoEmbed = { kind: 'youtube' | 'vimeo' | 'file'; src: string } | null`; `hubVideoEmbed(url?: string | null): HubVideoEmbed`.

- [ ] **Step 1: Write the failing test** `src/lib/hub-video-embed.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { hubVideoEmbed } from './hub-video-embed'

describe('hubVideoEmbed', () => {
  it('handles youtube watch + short links', () => {
    expect(hubVideoEmbed('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toEqual({ kind: 'youtube', src: 'https://www.youtube.com/embed/dQw4w9WgXcQ' })
    expect(hubVideoEmbed('https://youtu.be/dQw4w9WgXcQ')?.kind).toBe('youtube')
  })
  it('handles vimeo', () => {
    expect(hubVideoEmbed('https://vimeo.com/123456789')).toEqual({ kind: 'vimeo', src: 'https://player.vimeo.com/video/123456789' })
  })
  it('handles direct video files', () => {
    expect(hubVideoEmbed('https://cdn.example.com/clip.mp4')).toEqual({ kind: 'file', src: 'https://cdn.example.com/clip.mp4' })
  })
  it('returns null for empty/unsupported', () => {
    expect(hubVideoEmbed('')).toBeNull()
    expect(hubVideoEmbed(null)).toBeNull()
    expect(hubVideoEmbed('https://example.com/page')).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/lib/hub-video-embed.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement** `src/lib/hub-video-embed.ts`:

```ts
export type HubVideoEmbed = { kind: 'youtube' | 'vimeo' | 'file'; src: string } | null

export function hubVideoEmbed(url?: string | null): HubVideoEmbed {
  if (!url || typeof url !== 'string') return null
  const u = url.trim()
  if (!u) return null
  const yt = u.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]{11})/)
  if (yt) return { kind: 'youtube', src: `https://www.youtube.com/embed/${yt[1]}` }
  const vim = u.match(/vimeo\.com\/(?:video\/)?(\d+)/)
  if (vim) return { kind: 'vimeo', src: `https://player.vimeo.com/video/${vim[1]}` }
  if (/\.(mp4|webm|ogg)(\?.*)?$/i.test(u)) return { kind: 'file', src: u }
  return null
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/lib/hub-video-embed.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: CSP check for iframe embeds** — YouTube/Vimeo iframes need `frame-src`. Grep the CSP: `grep -rn "frame-src\|Content-Security-Policy" next.config.* src/middleware.ts src/lib`. If a `frame-src` directive exists and lacks `https://www.youtube.com` / `https://player.vimeo.com`, add both. If no CSP sets `frame-src`, no change needed. Commit any CSP edit with this task.

- [ ] **Step 6: Commit**

```bash
git add src/lib/hub-video-embed.ts src/lib/hub-video-embed.test.ts
git commit -m "feat(community): video embed helper (youtube/vimeo/file)"
```

---

### Task 9: `CommunityHubView` + subcomponents; render from public page

**Files:**
- Create: `src/components/hub/community/CommunityHubView.tsx`, `CommunityHeader.tsx`, `CommunityFeed.tsx`, `CommunitySidebar.tsx`
- Modify: `src/app/[username]/hub/[slug]/page.tsx` (community branch + gate), `generateMetadata`

**Interfaces:**
- Consumes: `ReactionBar` via `BulletinPostCard`; `hubVideoEmbed`; join route `POST/DELETE /api/hubs/[id]/join`; feed `GET /api/hubs/[id]/posts`; `HubPostComposer`, `HubPostComments`, `BulletinPostCard`, `FeedPost`.
- `CommunityHubView` props:
```ts
type CommunityMember = { userId: string; username: string; name: string | null; avatar: string | null }
type CommunityResource = { id: string; type: string; title: string; url: string | null }
type CommunityHubViewProps = {
  hub: { id: string; title: string; tagline: string | null; description: string | null; coverImage: string | null; heroVideoUrl: string | null }
  ownerUsername: string
  currentUserId?: string
  isPrivileged: boolean
  joined: boolean
  memberCount: number
  members: CommunityMember[]
  resources: CommunityResource[]
  counts: { posts: number; members: number; resources: number; events: number }
  sharePath: string
}
```

- [ ] **Step 1: Implement `CommunityHeader`** `src/components/hub/community/CommunityHeader.tsx`:

```tsx
'use client'

import { UserPlus, Check, Share2 } from 'lucide-react'

export function CommunityHeader({
  title, tagline, ownerUsername, coverImage, memberAvatars, counts, joined, isPrivileged, onToggleJoin, sharePath,
}: {
  title: string
  tagline: string | null
  ownerUsername: string
  coverImage: string | null
  memberAvatars: { avatar: string | null }[]
  counts: { posts: number; members: number; resources: number; events: number }
  joined: boolean
  isPrivileged: boolean
  onToggleJoin: () => void
  sharePath: string
}) {
  async function share() {
    const url = `${window.location.origin}${sharePath}`
    try {
      if (navigator.share) await navigator.share({ title, url })
      else { await navigator.clipboard.writeText(url); alert('Link copied') }
    } catch { /* cancelled */ }
  }
  const tiles: [string, number][] = [['Posts', counts.posts], ['Members', counts.members], ['Resources', counts.resources], ['Events', counts.events]]
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
      <div className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-gradient-to-br from-galli/30 to-galli-violet/30">
        {coverImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={coverImage} alt="" className="h-full w-full object-cover" />
        )}
      </div>
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
      </div>
      <div className="flex flex-col items-end gap-3">
        <div className="flex gap-2">
          {!isPrivileged && (
            <button onClick={onToggleJoin} className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold ${joined ? 'border border-border text-foreground' : 'bg-galli text-white'}`}>
              {joined ? <><Check className="h-4 w-4" /> Joined</> : <><UserPlus className="h-4 w-4" /> Follow</>}
            </button>
          )}
          <button onClick={share} className="inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-sm font-medium"><Share2 className="h-4 w-4" /> Share</button>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {tiles.map(([label, n]) => (
            <div key={label} className="rounded-xl border border-border px-3 py-2 text-center">
              <div className="text-base font-bold">{n}</div>
              <div className="text-[11px] text-muted-foreground">{label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Implement `CommunityFeed`** `src/components/hub/community/CommunityFeed.tsx` (composer + posts; header/join live in `CommunityHeader`):

```tsx
'use client'

import { useEffect, useState } from 'react'
import { BulletinPostCard, type FeedPost } from '@/components/bulletin/BulletinPostCard'
import { HubPostComposer } from '@/components/hub/HubPostComposer'
import { HubPostComments } from '@/components/hub/HubPostComments'

export function CommunityFeed({
  hubId, canPost, isPrivileged, currentUserId,
}: {
  hubId: string
  canPost: boolean
  isPrivileged: boolean
  currentUserId?: string
}) {
  const [posts, setPosts] = useState<FeedPost[]>([])
  const [loaded, setLoaded] = useState(false)

  async function load() {
    const res = await fetch(`/api/hubs/${hubId}/posts`)
    if (res.ok) setPosts((await res.json()).posts)
    setLoaded(true)
  }
  useEffect(() => { load() }, [hubId])

  return (
    <div className="space-y-4">
      {canPost && <HubPostComposer hubId={hubId} onPosted={load} />}
      {loaded && posts.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">No posts yet. Be the first to share something.</p>
      ) : (
        posts.map((p) => (
          <div key={p.id}>
            <BulletinPostCard
              post={p}
              currentUserId={currentUserId}
              basePath={`/api/hubs/${hubId}/posts`}
              canModerate={isPrivileged}
              onDeleted={(delId) => setPosts((cur) => cur.filter((x) => x.id !== delId))}
            />
            <HubPostComments
              hubId={hubId}
              postId={p.id}
              initialCount={(p as { commentCount?: number }).commentCount ?? 0}
              canComment={canPost}
              canModerate={isPrivileged}
              currentUserId={currentUserId}
            />
          </div>
        ))
      )}
    </div>
  )
}
```

- [ ] **Step 3: Implement `CommunitySidebar`** `src/components/hub/community/CommunitySidebar.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { UsersRound, FolderOpen, FileText, LinkIcon } from 'lucide-react'
import { hubVideoEmbed } from '@/lib/hub-video-embed'

type Member = { userId: string; username: string; name: string | null; avatar: string | null }
type Resource = { id: string; type: string; title: string; url: string | null }

export function CommunitySidebar({
  heroVideoUrl, members, resources,
}: {
  heroVideoUrl: string | null
  members: Member[]
  resources: Resource[]
}) {
  const [showMembers, setShowMembers] = useState(false)
  const [showResources, setShowResources] = useState(false)
  const embed = hubVideoEmbed(heroVideoUrl)

  return (
    <div className="space-y-4">
      {embed && (
        <div className="overflow-hidden rounded-2xl border border-border bg-black">
          {embed.kind === 'file' ? (
            <video src={embed.src} controls className="aspect-video w-full" />
          ) : (
            <iframe src={embed.src} title="Community video" allow="fullscreen; picture-in-picture" className="aspect-video w-full" />
          )}
        </div>
      )}

      <section className="rounded-2xl border border-border bg-surface p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-semibold"><UsersRound className="h-4 w-4 text-primary" /> Members ({members.length})</h3>
          {members.length > 6 && <button onClick={() => setShowMembers(true)} className="text-xs text-primary hover:underline">View all →</button>}
        </div>
        <div className="flex flex-wrap gap-2">
          {members.slice(0, 12).map((m) => (
            <span key={m.userId} title={m.name || m.username} className="h-9 w-9 overflow-hidden rounded-full bg-gradient-to-br from-galli/30 to-galli-violet/30">
              {m.avatar && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.avatar} alt="" className="h-full w-full object-cover" />
              )}
            </span>
          ))}
        </div>
      </section>

      {resources.length > 0 && (
        <section className="rounded-2xl border border-border bg-surface p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-semibold"><FolderOpen className="h-4 w-4 text-primary" /> Resources</h3>
            {resources.length > 5 && <button onClick={() => setShowResources(true)} className="text-xs text-primary hover:underline">View all →</button>}
          </div>
          <ul className="space-y-2">
            {resources.slice(0, 5).map((r) => (
              <li key={r.id}>
                <a href={r.url || '#'} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm hover:text-primary">
                  {r.type === 'link' ? <LinkIcon className="h-4 w-4 text-muted-foreground" /> : <FileText className="h-4 w-4 text-muted-foreground" />}
                  <span className="truncate">{r.title}</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {showMembers && (
        <Modal title={`Members (${members.length})`} onClose={() => setShowMembers(false)}>
          {members.map((m) => (
            <div key={m.userId} className="flex items-center gap-2 py-1.5">
              <span className="h-8 w-8 overflow-hidden rounded-full bg-gradient-to-br from-galli/30 to-galli-violet/30">
                {m.avatar && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.avatar} alt="" className="h-full w-full object-cover" />
                )}
              </span>
              <span className="text-sm">{m.name || m.username} <span className="text-muted-foreground">@{m.username}</span></span>
            </div>
          ))}
        </Modal>
      )}
      {showResources && (
        <Modal title="Resources" onClose={() => setShowResources(false)}>
          {resources.map((r) => (
            <a key={r.id} href={r.url || '#'} target="_blank" rel="noreferrer" className="flex items-center gap-2 py-1.5 text-sm hover:text-primary">
              {r.type === 'link' ? <LinkIcon className="h-4 w-4 text-muted-foreground" /> : <FileText className="h-4 w-4 text-muted-foreground" />}
              <span className="truncate">{r.title}</span>
            </a>
          ))}
        </Modal>
      )}
    </div>
  )
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="max-h-[80vh] w-full max-w-md overflow-y-auto rounded-2xl bg-surface p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-3 text-lg font-bold">{title}</h2>
        {children}
        <button onClick={onClose} className="mt-4 w-full rounded-lg border border-border py-2 text-sm">Close</button>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Implement `CommunityHubView`** `src/components/hub/community/CommunityHubView.tsx` (holds join state; composes header/feed/sidebar + themed frame):

```tsx
'use client'

import { useState } from 'react'
import { Leaf, Search } from 'lucide-react'
import { CommunityHeader } from './CommunityHeader'
import { CommunityFeed } from './CommunityFeed'
import { CommunitySidebar } from './CommunitySidebar'

type CommunityMember = { userId: string; username: string; name: string | null; avatar: string | null }
type CommunityResource = { id: string; type: string; title: string; url: string | null }

export function CommunityHubView({
  hub, ownerUsername, currentUserId, isPrivileged, joined: initialJoined, memberCount: initialCount, members, resources, counts, sharePath,
}: {
  hub: { id: string; title: string; tagline: string | null; description: string | null; coverImage: string | null; heroVideoUrl: string | null }
  ownerUsername: string
  currentUserId?: string
  isPrivileged: boolean
  joined: boolean
  memberCount: number
  members: CommunityMember[]
  resources: CommunityResource[]
  counts: { posts: number; members: number; resources: number; events: number }
  sharePath: string
}) {
  const [joined, setJoined] = useState(initialJoined)
  const [count, setCount] = useState(initialCount)
  const canPost = isPrivileged || joined

  async function toggleJoin() {
    const res = await fetch(`/api/hubs/${hub.id}/join`, { method: joined ? 'DELETE' : 'POST' })
    if (res.status === 401) { window.location.href = '/login'; return }
    if (res.ok) { const d = await res.json(); setJoined(d.joined); setCount(d.memberCount) }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-galli/5 to-transparent">
      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="rounded-3xl border border-border bg-surface p-6 shadow-soft">
          <CommunityHeader
            title={hub.title}
            tagline={hub.tagline}
            ownerUsername={ownerUsername}
            coverImage={hub.coverImage}
            memberAvatars={members}
            counts={{ ...counts, members: count }}
            joined={joined}
            isPrivileged={isPrivileged}
            onToggleJoin={toggleJoin}
            sharePath={sharePath}
          />
          <div className="mt-5 flex items-center gap-3 border-t border-border pt-4">
            <span className="inline-flex items-center gap-1.5 border-b-2 border-primary pb-1 text-sm font-medium"><Leaf className="h-4 w-4 text-primary" /> Home</span>
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input placeholder="Search this hub…" className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm" disabled />
            </div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
          <CommunityFeed hubId={hub.id} canPost={canPost} isPrivileged={isPrivileged} currentUserId={currentUserId} />
          <CommunitySidebar heroVideoUrl={hub.heroVideoUrl} members={members} resources={resources} />
        </div>

        <div className="mt-10 rounded-2xl border border-border bg-galli/5 py-6 text-center text-sm text-muted-foreground">
          Good ideas grow in great communities.
        </div>
      </div>
    </div>
  )
}
```

Note: the search box is `disabled` in M1 (client-side filtering is a fast-follow); leaving it visible keeps the layout faithful. If you prefer, wire a trivial client filter over `posts` — optional, not required for M1.

- [ ] **Step 5: Render from the public page** — in `src/app/[username]/hub/[slug]/page.tsx`, compute `viewer` BEFORE the visibility gate, then branch on `hub.community`. Replace the body from the `const hub = ...` lookup through the final `return <HubViewer .../>` with:

```tsx
  const hub = await db.hub.findUnique({ where: { userId_slug: { userId: user.id, slug } } })
  if (!hub) notFound()

  const viewerUser = await getUserFromCookies()
  let viewer: 'owner' | 'collaborator' | 'public' = 'public'
  if (viewerUser?.id === hub.userId) viewer = 'owner'
  else if (viewerUser) {
    const collab = await db.hubCollaborator.findUnique({ where: { hubId_userId: { hubId: hub.id, userId: viewerUser.id } }, select: { id: true } })
    if (collab) viewer = 'collaborator'
  }
  const isPrivileged = viewer === 'owner' || viewer === 'collaborator'

  // Community hubs render the community page and gate on their own published flag.
  if (hub.community) {
    if (!canViewCommunityHub({ published: hub.published, isPrivileged })) notFound()
    const [memberRows, items, postsCount, mine] = await Promise.all([
      db.hubMember.findMany({ where: { hubId: hub.id }, select: { userId: true, user: { select: { username: true, name: true, avatar: true } } } }),
      db.hubItem.findMany({ where: { hubId: hub.id, visibility: 'public', type: { in: ['file', 'link'] } }, orderBy: { createdAt: 'desc' } }),
      db.hubPost.count({ where: { hubId: hub.id } }),
      viewerUser ? db.hubMember.findUnique({ where: { hubId_userId: { hubId: hub.id, userId: viewerUser.id } }, select: { id: true } }) : Promise.resolve(null),
    ])
    const members = memberRows.map((m) => ({ userId: m.userId, username: m.user.username, name: m.user.name, avatar: m.user.avatar }))
    const resources = items.map((i) => ({ id: i.id, type: i.type, title: i.title, url: i.url }))
    return (
      <CommunityHubView
        hub={{ id: hub.id, title: hub.title, tagline: hub.tagline, description: hub.description, coverImage: hub.coverImage, heroVideoUrl: hub.heroVideoUrl }}
        ownerUsername={user.username}
        currentUserId={viewerUser?.id}
        isPrivileged={isPrivileged}
        joined={!!mine}
        memberCount={members.length}
        members={members}
        resources={resources}
        counts={{ posts: postsCount, members: members.length, resources: resources.length, events: 0 }}
        sharePath={`/${user.username}/hub/${slug}`}
      />
    )
  }

  // Non-community hubs keep the data-room viewer (requires a published Display).
  if (!hub.displayId) notFound()
  const display = await db.display.findUnique({ where: { id: hub.displayId }, select: { published: true } })
  if (!display || !display.published) notFound()
```

Keep the rest of the non-community path (the `Promise.all` for folders/items/notes/bookmarks, visibility resolution, and `return <HubViewer .../>`) exactly as it is today — but delete the now-duplicated `viewerUser`/`viewer`/`communityProps` computation that used to live there (it moved above). Update imports at the top:
```tsx
import { CommunityHubView } from '@/components/hub/community/CommunityHubView'
import { canViewCommunityHub } from '@/lib/community'
```
Also update `generateMetadata`: after loading the hub, if `hub.community`, return `{ title: hub.title, description: hub.tagline || hub.description || undefined }` when `hub.published` (else `{}`), before the existing Display-based logic.

- [ ] **Step 6: Typecheck + lint the touched files**

Run:
```bash
pnpm exec tsc --noEmit
pnpm exec next lint --file src/components/hub/community/CommunityHubView.tsx --file src/components/hub/community/CommunityHeader.tsx --file src/components/hub/community/CommunityFeed.tsx --file src/components/hub/community/CommunitySidebar.tsx --file "src/app/[username]/hub/[slug]/page.tsx"
```
Expected: exit 0 (fix any unescaped apostrophes / unused imports).

- [ ] **Step 7: Commit**

```bash
git add src/components/hub/community "src/app/[username]/hub/[slug]/page.tsx"
git commit -m "feat(community): themed public community page (header + feed + sidebar)"
```

---

### Task 10: Owner controls in `HubEditor` (tagline, hero video, publish)

**Files:**
- Modify: `src/components/hub/HubEditor.tsx` (header/settings area; uses existing `patchHub`)

**Interfaces:**
- Consumes: existing `patchHub(data)` → `PATCH /api/hubs/[id]` (now accepts `tagline`, `heroVideoUrl`, `published`).

- [ ] **Step 1: Add a community-settings block** — in `HubEditor.tsx`, where the header title/description inputs live, add (visible when `hub.community`) inputs bound to hub state and saved on blur via `patchHub`:

```tsx
{hub.community && (
  <div className="mt-3 space-y-2 rounded-xl border border-border p-3">
    <input
      defaultValue={hub.tagline ?? ''}
      onBlur={(e) => patchHub({ tagline: e.target.value })}
      placeholder="Tagline (short line under the title)"
      className="w-full rounded-lg border border-border bg-transparent px-3 py-2 text-sm"
    />
    <input
      defaultValue={hub.heroVideoUrl ?? ''}
      onBlur={(e) => patchHub({ heroVideoUrl: e.target.value })}
      placeholder="Hero video URL (YouTube, Vimeo, or .mp4)"
      className="w-full rounded-lg border border-border bg-transparent px-3 py-2 text-sm"
    />
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" checked={!!hub.published} onChange={(e) => patchHub({ published: e.target.checked })} className="accent-galli" />
      Published — visible to everyone
    </label>
  </div>
)}
```
Match the exact state variable name `HubEditor` uses for the loaded hub (it stores the `GET /api/hubs/[id]` `hub` object in state; `patchHub` already updates it). If the local type doesn't include `tagline`/`heroVideoUrl`/`published`, widen it (the API now returns them).

- [ ] **Step 2: Typecheck + lint**

Run: `pnpm exec tsc --noEmit && pnpm exec next lint --file src/components/hub/HubEditor.tsx`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/components/hub/HubEditor.tsx
git commit -m "feat(community): owner controls for tagline/hero video/publish"
```

---

### Task 11: Remove `HubPostLike` (single source of truth)

**Files:**
- Delete: `src/app/api/hubs/[id]/posts/[postId]/like/route.ts`
- Modify: `src/app/api/hubs/[id]/posts/route.ts` (drop `likes` include + `likeCount`/`likedByMe`), `src/components/bulletin/BulletinPostCard.tsx` (drop legacy like branch — hub feed now always sends `reactions`; Bulletin uses `BulletinLike`, a separate model, unaffected... **verify**), `prisma/schema.prisma`
- Create: `prisma/migrations/20260717000100_drop_hub_post_like/migration.sql`

**Interfaces:**
- Produces: `HubPostLike` removed; hub feed posts no longer carry `likeCount`/`likedByMe`.

- [ ] **Step 1: Verify BulletinPostCard's non-reaction users** — `grep -rn "BulletinPostCard" src`. Confirm the Bulletin feed path (`basePath` `/api/bulletin`) does **not** pass `reactions` and therefore still needs the legacy like button. If so, **keep** the legacy branch in `BulletinPostCard` (do NOT delete it) — only the hub `HubPostLike` model/route is removed. If Bulletin has its own like model/route (`BulletinLike`), the legacy branch stays functional. (This step decides whether Step 4 edits the card at all.)

- [ ] **Step 2: Remove the hub like route**

```bash
git rm "src/app/api/hubs/[id]/posts/[postId]/like/route.ts"
```

- [ ] **Step 3: Drop `likes` from the hub feed GET** — in `src/app/api/hubs/[id]/posts/route.ts`, remove `likes: { select: { userId: true } }` from the `include`, and remove the `likeCount`/`likedByMe` lines from the feed map object (posts now rely on `reactions`).

- [ ] **Step 4: Schema + migration** — remove `HubPostLike` model, its `HubPost.likes` field, and `User.hubPostLikes` from `prisma/schema.prisma`. Create `prisma/migrations/20260717000100_drop_hub_post_like/migration.sql`:

```sql
DROP TABLE "HubPostLike";
```

- [ ] **Step 5: Apply + regenerate + typecheck**

```bash
export DATABASE_URL="postgresql://pages:pages@127.0.0.1:5434/pages_m1" DATABASE_URL_UNPOOLED="postgresql://pages:pages@127.0.0.1:5434/pages_m1"
pnpm exec prisma migrate deploy && pnpm exec prisma generate
pnpm exec tsc --noEmit
```
Expected: migration applied, client regenerated, tsc exit 0. Fix any remaining `hubPostLike` references surfaced by tsc.

- [ ] **Step 6: Run the full test suite**

Run: `pnpm test`
Expected: all pass (update any test still referencing `hubPostLike`).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor(community): remove HubPostLike, reactions are the source of truth"
```

---

### Task 12: End-to-end verification

**Files:** none (verification only). Uses a fresh isolated DB, mirroring the repo smoke pattern.

- [ ] **Step 1: Static gates**

```bash
pnpm exec tsc --noEmit
pnpm exec next lint
pnpm test
```
Expected: all green. `next lint` may show pre-existing unrelated warnings only.

- [ ] **Step 2: Boot dev against the fresh M1 DB** (inline env so it overrides the machine `vli_db`):

```bash
docker exec pages-mvp-postgres-1 psql -U pages -d pages -c "DROP DATABASE IF EXISTS pages_m1 WITH (FORCE);" -c "CREATE DATABASE pages_m1;"
export DATABASE_URL="postgresql://pages:pages@127.0.0.1:5434/pages_m1" DATABASE_URL_UNPOOLED="postgresql://pages:pages@127.0.0.1:5434/pages_m1"
pnpm exec prisma migrate deploy
# start dev in background with the SAME inline env, wait for "Ready in"
nohup pnpm dev > /tmp/m1-dev.log 2>&1 &
until grep -qE "Ready in|Error:" /tmp/m1-dev.log; do sleep 1; done; tail -3 /tmp/m1-dev.log
```

- [ ] **Step 3: Scripted E2E** — write a temporary `_m1-e2e.mjs` in the project root that: seeds two users with bcrypt passwords (`owner@smoke.local`/`joiner@smoke.local`, `smoke1234`); logs both in via `POST /api/auth/login` to get `galli-auth` cookies (parse the `JWT_SECRET` from `.env`, stripping surrounding quotes — the value is quoted); then asserts:
  1. `POST /api/hubs { title, community:true }` → 201, `community:true`, and the hub is publicly reachable.
  2. Visit `GET /<owner>/hub/<slug>` (the public page) → 200 (published community renders).
  3. `POST /api/hubs/<id>/join` as joiner → `{ joined:true, memberCount:1 }`.
  4. `POST /api/hubs/<id>/posts { text }` and `{ block: poll }` → 201.
  5. `POST /api/hubs/<id>/posts/<postId>/reactions { emoji:'❤️' }` then `{ emoji:'👍' }` → summary shows both; `DELETE { emoji:'❤️' }` removes it.
  6. `GET /api/hubs/<id>/posts` → posts carry `reactions.counts`.
  7. Add a `file`/`link` `HubItem`, confirm the public page HTML (or a resources fetch) reflects it.

Run: `node _m1-e2e.mjs` — all assertions pass. (Reuse the login-cookie approach from the Community-entity smoke; do NOT hand-mint JWTs.)

- [ ] **Step 4: Cleanup**

```bash
rm -f _m1-e2e.mjs
taskkill //F //IM node.exe 2>/dev/null | tail -1 || pkill -f "next dev"
docker exec pages-mvp-postgres-1 psql -U pages -d pages -c "DROP DATABASE IF EXISTS pages_m1 WITH (FORCE);"
git status --short   # confirm only intended files changed
```

- [ ] **Step 5: Final commit (if any verification fixes were made)**

```bash
git add -A && git commit -m "test(community): M1 end-to-end verification fixes" || echo "nothing to commit"
```

---

## Deployment note (post-merge, not part of task execution)
Both migrations (`20260717000000_community_m1`, `20260717000100_drop_hub_post_like`) are additive + backfill + one drop; prod Neon is clean, so `prisma migrate deploy` runs on merge via the Vercel build (`prisma migrate deploy && next build`). The backfill preserves existing hearts; existing community hubs are set `published=true` so none go dark.

## Self-review notes
- **Spec coverage:** R1 publishing → Tasks 1,6,7,9; R2 reactions → Tasks 1–5,11; R3 public page → Tasks 8,9; R4 owner controls → Task 10; R5 fields → Tasks 1,7. Verification → Task 12.
- **Bulletin safety:** `BulletinPostCard` keeps the legacy like branch for the Bulletin feature (separate `BulletinLike` model); only `HubPostLike` is removed (Task 11 Step 1 verifies before touching the card).
- **Type consistency:** `ReactionSummary` (Task 2) is the return shape everywhere; `FeedPost.reactions?: ReactionSummary` (Task 5); `hubVideoEmbed`/`HubVideoEmbed` (Task 8) consumed in Task 9; `canViewCommunityHub` (Task 6) consumed in Tasks 6 & 9.
