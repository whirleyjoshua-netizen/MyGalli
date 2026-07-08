# Community Hub Phase 2 (Member Participation) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let joined members **post** (text + image) to a community hub's feed and **comment** (text) on posts, with owner/collaborator/author **delete** moderation.

**Architecture:** Member posting reuses the existing `HubPostComposer` + posts API — only the permission gate and a viewer prop change. Comments are net-new: a `HubPostComment` model, GET/POST/DELETE routes, and a `HubPostComments` UI wrapper rendered under each post card.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Prisma/PostgreSQL, Tailwind, Vitest.

## Global Constraints

- **Verify with `pnpm exec tsc --noEmit` AND `pnpm exec next lint`** (prod `next build` gate): no static internal `<a href="/x">` (use `<Link>`; dynamic `/${x}` hrefs are fine), escape `'`/`"` in JSX text. `next lint` noise from the nested-worktree parent eslintrc ("plugin conflict") is not an error — only `Error:` lines matter.
- **Migrations non-interactive:** never `prisma migrate dev`. Hand-author `migration.sql` (or `migrate diff`), timestamp AFTER the latest existing folder; apply with inline `DATABASE_URL` + `DATABASE_URL_UNPOOLED` (both, for `directUrl`), then `prisma generate`. Ignore any pre-existing `PdfView.tsx` tsc errors (worktree lacks `react-pdf`; CI installs fresh).
- **Do NOT modify `BulletinPostCard`/`FeedPost`** for comments (shared with Bulletin) — wrap around it.
- Do NOT run `pnpm build`/`pnpm install`. `node_modules` present.
- Community read-gate (published + community, owner/collab bypass for drafts) must stay identical between the posts GET and the new comments GET — keep them in sync (add a "keep in sync" comment).
- Commit after each task; messages end with the two repo trailer lines.

---

## Current state (facts to build on)

- `src/app/api/hubs/[id]/posts/route.ts`: has `collaboratorIds(hubId)` helper; **GET** already gates on `community` + parent-Display `published` (owner/collab bypass); **POST** gate is `canPostToHub(me.id, hub, await collaboratorIds(id))`.
- `src/app/api/hubs/[id]/posts/[postId]/route.ts`: **DELETE** allows `author || hub.userId` (owner) — NOT collaborators.
- `src/components/hub/HubCommunitySection.tsx`: props `{ hubId, initialJoined, memberCount, canPost, currentUserId }`; renders `<HubPostComposer hubId onPosted={load}>` when `canPost`, a Join button when `!canPost`, and a `<BulletinPostCard>` per post.
- `src/components/hub/HubPostComposer.tsx`: text + `imageUrl`, POSTs `{text,imageUrl}` to `/api/hubs/${hubId}/posts`.
- Viewer `src/app/[username]/hub/[slug]/page.tsx`: computes `viewer: 'owner'|'collaborator'|'public'`; passes `canPost: viewer==='owner'||viewer==='collaborator'`; already loads memberCount + whether the viewer is a member.
- `src/lib/community.ts`: `canPostToHub`, `toMemberDTO`.

---

## Task 1: Permission helpers — `canParticipate`, `canModerate`

**Files:**
- Modify: `src/lib/community.ts`
- Test: `src/lib/community.test.ts` (create if absent; else append)

**Interfaces:**
- Produces: `canParticipate(userId, hub: { userId: string }, collaboratorIds: string[], isMember: boolean): boolean`; `canModerate(userId, hub: { userId: string }, collaboratorIds: string[]): boolean`.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/community.test.ts
import { describe, it, expect } from 'vitest'
import { canParticipate, canModerate } from './community'

const hub = { userId: 'owner1' }
describe('canParticipate', () => {
  it('owner can', () => expect(canParticipate('owner1', hub, [], false)).toBe(true))
  it('collaborator can', () => expect(canParticipate('c1', hub, ['c1'], false)).toBe(true))
  it('member can', () => expect(canParticipate('m1', hub, [], true)).toBe(true))
  it('stranger cannot', () => expect(canParticipate('x1', hub, [], false)).toBe(false))
})
describe('canModerate', () => {
  it('owner/collab moderate', () => {
    expect(canModerate('owner1', hub, [])).toBe(true)
    expect(canModerate('c1', hub, ['c1'])).toBe(true)
  })
  it('member does not moderate', () => expect(canModerate('m1', hub, [])).toBe(false))
})
```

- [ ] **Step 2: Run → RED**

Run: `pnpm test src/lib/community.test.ts` — FAIL (canParticipate/canModerate not exported).

- [ ] **Step 3: Implement (append to `src/lib/community.ts`)**

```ts
export function canParticipate(
  userId: string,
  hub: { userId: string },
  collaboratorIds: string[],
  isMember: boolean,
): boolean {
  return userId === hub.userId || collaboratorIds.includes(userId) || isMember
}

export function canModerate(
  userId: string,
  hub: { userId: string },
  collaboratorIds: string[],
): boolean {
  return userId === hub.userId || collaboratorIds.includes(userId)
}
```

- [ ] **Step 4: Run → GREEN**

Run: `pnpm test src/lib/community.test.ts` — PASS. Then `pnpm exec tsc --noEmit`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/community.ts src/lib/community.test.ts
git commit -m "feat(community): canParticipate + canModerate helpers"
```

---

## Task 2: Enable member posting (gate + moderation + composer visibility)

**Files:**
- Modify: `src/app/api/hubs/[id]/posts/route.ts` (POST gate)
- Modify: `src/app/api/hubs/[id]/posts/[postId]/route.ts` (DELETE auth)
- Modify: `src/components/hub/HubCommunitySection.tsx` (canPost = privileged || joined)
- Modify: `src/app/[username]/hub/[slug]/page.tsx` (pass privileged flag)

- [ ] **Step 1: POST route — allow members**

In `src/app/api/hubs/[id]/posts/route.ts`, POST handler:
1. Import the helper: add `canParticipate` to the existing `import { canPostToHub } from '@/lib/community'` → `import { canPostToHub, canParticipate } from '@/lib/community'` (keep `canPostToHub` import even if unused elsewhere, or drop it if now unused — let tsc/lint decide).
2. Before the gate, look up membership, then gate with `canParticipate`. Replace:
```ts
  if (!canPostToHub(me.id, hub, await collaboratorIds(id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
```
with:
```ts
  const isMember = !!(await db.hubMember.findUnique({ where: { hubId_userId: { hubId: id, userId: me.id } }, select: { id: true } }))
  if (!canParticipate(me.id, hub, await collaboratorIds(id), isMember)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
```
(Confirm the `HubMember` unique is named `hubId_userId` — it is, from `@@unique([hubId, userId])`.)

- [ ] **Step 2: DELETE route — collaborators can moderate**

In `src/app/api/hubs/[id]/posts/[postId]/route.ts`, the post select already includes `authorId` + `hub.userId`. Add collaborator moderation. Replace the auth check:
```ts
  if (post.authorId !== me.id && post.hub.userId !== me.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
```
with (load collaborators + use `canModerate`):
```ts
  const collabs = await db.hubCollaborator.findMany({ where: { hubId: id }, select: { userId: true } })
  const canMod = canModerate(me.id, { userId: post.hub.userId }, collabs.map((c) => c.userId))
  if (post.authorId !== me.id && !canMod) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
```
Add `import { canModerate } from '@/lib/community'` and confirm `db` is imported (it is).

- [ ] **Step 3: Section — members see the composer once joined**

In `src/components/hub/HubCommunitySection.tsx`:
1. Rename the `canPost` prop to `isPrivileged` (owner/collab) in the props type and destructure.
2. Derive: `const canPost = isPrivileged || joined`.
3. Composer shows when `canPost` (unchanged JSX, now driven by derived value). Join button shows when `!isPrivileged` (so non-privileged users can join/leave; after joining, `joined` flips → composer appears).

Concretely:
```tsx
export function HubCommunitySection({
  hubId, initialJoined, memberCount: initialCount, isPrivileged, currentUserId,
}: {
  hubId: string
  initialJoined: boolean
  memberCount: number
  isPrivileged: boolean
  currentUserId?: string
}) {
  const [joined, setJoined] = useState(initialJoined)
  const [count, setCount] = useState(initialCount)
  const [posts, setPosts] = useState<FeedPost[]>([])
  const canPost = isPrivileged || joined
  // ...load()/toggleJoin() unchanged...
```
Then in JSX: `{!isPrivileged && (<button onClick={toggleJoin} ...>{joined ? 'Joined' : 'Join'}</button>)}` and `{canPost && <div className="mb-4"><HubPostComposer hubId={hubId} onPosted={load} /></div>}`.

- [ ] **Step 4: Viewer page — pass `isPrivileged`**

In `src/app/[username]/hub/[slug]/page.tsx`, the `communityProps` object uses `canPost: viewer==='owner'||viewer==='collaborator'`. Rename that field to `isPrivileged` and update the `<HubCommunitySection ... />` render to pass `isPrivileged={...}` instead of `canPost={...}`. (Everything else — joined, memberCount, currentUserId — unchanged.)

- [ ] **Step 5: Verify + commit**

Run: `pnpm exec tsc --noEmit && pnpm exec next lint --file "src/components/hub/HubCommunitySection.tsx" --file "src/app/api/hubs/[id]/posts/route.ts" --file "src/app/api/hubs/[id]/posts/[postId]/route.ts"`
Expected: clean (no `Error:` lines in changed files).
```bash
git add "src/app/api/hubs/[id]/posts/route.ts" "src/app/api/hubs/[id]/posts/[postId]/route.ts" src/components/hub/HubCommunitySection.tsx "src/app/[username]/hub/[slug]/page.tsx"
git commit -m "feat(community): members can post; collaborators can moderate deletes"
```

---

## Task 3: `HubPostComment` model + migration

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<ts>_add_hub_post_comment/migration.sql`

- [ ] **Step 1: Add the model + back-relations**

In `prisma/schema.prisma`:
```prisma
model HubPostComment {
  id        String   @id @default(cuid())
  postId    String
  post      HubPost  @relation(fields: [postId], references: [id], onDelete: Cascade)
  authorId  String
  author    User     @relation("HubPostCommentAuthor", fields: [authorId], references: [id], onDelete: Cascade)
  text      String
  createdAt DateTime @default(now())
  @@index([postId, createdAt])
}
```
Add to `HubPost`: `comments HubPostComment[]`. Add to `User`: `hubPostComments HubPostComment[] @relation("HubPostCommentAuthor")` (place beside the other `User` back-relations).

- [ ] **Step 2: Hand-author the migration**

Find the latest folder in `prisma/migrations/`; use a timestamp after it (e.g. `20260710000000_add_hub_post_comment`). Create `migration.sql`:
```sql
CREATE TABLE "HubPostComment" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HubPostComment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "HubPostComment_postId_createdAt_idx" ON "HubPostComment"("postId", "createdAt");
ALTER TABLE "HubPostComment" ADD CONSTRAINT "HubPostComment_postId_fkey" FOREIGN KEY ("postId") REFERENCES "HubPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HubPostComment" ADD CONSTRAINT "HubPostComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```
(Optionally verify the exact SQL by running `prisma migrate diff --from-migrations ./prisma/migrations --to-schema-datamodel prisma/schema.prisma --script` if a shadow DB is available; otherwise the hand-authored SQL above is standard Prisma output.)

- [ ] **Step 3: Apply + generate**

```bash
DATABASE_URL="postgresql://pages:pages@127.0.0.1:5434/pages" DATABASE_URL_UNPOOLED="postgresql://pages:pages@127.0.0.1:5434/pages" pnpm exec prisma migrate deploy
DATABASE_URL="postgresql://pages:pages@127.0.0.1:5434/pages" DATABASE_URL_UNPOOLED="postgresql://pages:pages@127.0.0.1:5434/pages" pnpm exec prisma generate
```
If deploy errors on cross-branch drift, non-blocking — report; do not reset.

- [ ] **Step 4: Verify + commit**

Run: `pnpm exec tsc --noEmit` (db.hubPostComment now typed).
```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(community): HubPostComment model + migration"
```

---

## Task 4: Comment APIs + commentCount

**Files:**
- Create: `src/app/api/hubs/[id]/posts/[postId]/comments/route.ts` (GET + POST)
- Create: `src/app/api/hubs/[id]/posts/[postId]/comments/[commentId]/route.ts` (DELETE)
- Modify: `src/app/api/hubs/[id]/posts/route.ts` (add `commentCount` to GET payload)

**Interfaces:**
- Consumes: `canParticipate`, `canModerate` (Task 1); `db.hubPostComment` (Task 3); `rateLimit`, `getUser`.

- [ ] **Step 1: Comments GET + POST**

```ts
// src/app/api/hubs/[id]/posts/[postId]/comments/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'
import { rateLimit } from '@/lib/rate-limit'
import { canParticipate } from '@/lib/community'

type Params = { params: Promise<{ id: string; postId: string }> }

async function collaboratorIds(hubId: string): Promise<string[]> {
  const rows = await db.hubCollaborator.findMany({ where: { hubId }, select: { userId: true } })
  return rows.map((r) => r.userId)
}

// Mirror of the posts-GET read gate — KEEP IN SYNC with src/app/api/hubs/[id]/posts/route.ts GET.
async function readableCommunityHub(id: string, meId: string | null) {
  const hub = await db.hub.findUnique({ where: { id }, select: { id: true, community: true, displayId: true, userId: true } })
  if (!hub || !hub.community) return null
  const display = hub.displayId ? await db.display.findUnique({ where: { id: hub.displayId }, select: { published: true } }) : null
  if (!display?.published) {
    const canView = !!meId && (meId === hub.userId || (await collaboratorIds(id)).includes(meId))
    if (!canView) return null
  }
  return hub
}

export async function GET(request: NextRequest, { params }: Params) {
  const { id, postId } = await params
  const limited = await rateLimit(request, { limit: 120, windowMs: 60_000, prefix: `hub-comments-read:${postId}` })
  if (limited) return limited
  const me = await getUser(request)
  const hub = await readableCommunityHub(id, me?.id ?? null)
  if (!hub) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const post = await db.hubPost.findFirst({ where: { id: postId, hubId: id }, select: { id: true } })
  if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const comments = await db.hubPostComment.findMany({
    where: { postId },
    orderBy: { createdAt: 'asc' },
    take: 200,
    include: { author: { select: { id: true, name: true, username: true, avatar: true } } },
  })
  return NextResponse.json({
    comments: comments.map((c) => ({
      id: c.id,
      author: { id: c.author.id, name: c.author.name, username: c.author.username, avatar: c.author.avatar },
      text: c.text,
      createdAt: c.createdAt.toISOString(),
    })),
  }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(request: NextRequest, { params }: Params) {
  const { id, postId } = await params
  const limited = await rateLimit(request, { limit: 30, windowMs: 60_000, prefix: 'hub-comment-create' })
  if (limited) return limited
  const me = await getUser(request)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const hub = await db.hub.findUnique({ where: { id }, select: { id: true, community: true, userId: true } })
  if (!hub || !hub.community) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const post = await db.hubPost.findFirst({ where: { id: postId, hubId: id }, select: { id: true } })
  if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const isMember = !!(await db.hubMember.findUnique({ where: { hubId_userId: { hubId: id, userId: me.id } }, select: { id: true } }))
  if (!canParticipate(me.id, hub, await collaboratorIds(id), isMember)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const body = await request.json().catch(() => ({}))
  const text = typeof body.text === 'string' ? body.text.trim().slice(0, 2000) : ''
  if (!text) return NextResponse.json({ error: 'Empty comment' }, { status: 400 })
  const c = await db.hubPostComment.create({
    data: { postId, authorId: me.id, text },
    include: { author: { select: { id: true, name: true, username: true, avatar: true } } },
  })
  return NextResponse.json({
    comment: { id: c.id, author: { id: c.author.id, name: c.author.name, username: c.author.username, avatar: c.author.avatar }, text: c.text, createdAt: c.createdAt.toISOString() },
  }, { status: 201 })
}
```

- [ ] **Step 2: Comment DELETE**

```ts
// src/app/api/hubs/[id]/posts/[postId]/comments/[commentId]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'
import { canModerate } from '@/lib/community'

type Params = { params: Promise<{ id: string; postId: string; commentId: string }> }

export async function DELETE(request: NextRequest, { params }: Params) {
  const { id, postId, commentId } = await params
  const me = await getUser(request)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const comment = await db.hubPostComment.findFirst({
    where: { id: commentId, postId, post: { hubId: id } },
    select: { authorId: true, post: { select: { hub: { select: { userId: true } } } } },
  })
  if (!comment) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const collabs = await db.hubCollaborator.findMany({ where: { hubId: id }, select: { userId: true } })
  const canMod = canModerate(me.id, { userId: comment.post.hub.userId }, collabs.map((c) => c.userId))
  if (comment.authorId !== me.id && !canMod) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  await db.hubPostComment.delete({ where: { id: commentId } })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 3: Add `commentCount` to posts GET**

In `src/app/api/hubs/[id]/posts/route.ts` GET, the `db.hubPost.findMany` `include` currently has `author` + `likes`. Add `_count`:
```ts
    include: {
      author: { select: { id: true, name: true, username: true, avatar: true } },
      likes: { select: { userId: true } },
      _count: { select: { comments: true } },
    },
```
And in the `posts.map(...)` feed object, add `commentCount: p._count.comments` (additive field; `BulletinPostCard` ignores it, our wrapper reads it).

- [ ] **Step 4: Verify + commit**

Run: `pnpm exec tsc --noEmit && pnpm exec next lint --file "src/app/api/hubs/[id]/posts/[postId]/comments/route.ts" --file "src/app/api/hubs/[id]/posts/[postId]/comments/[commentId]/route.ts" --file "src/app/api/hubs/[id]/posts/route.ts"`
Expected: clean.
```bash
git add "src/app/api/hubs/[id]/posts/[postId]/comments/" "src/app/api/hubs/[id]/posts/route.ts"
git commit -m "feat(community): comment GET/POST/DELETE APIs + commentCount"
```

---

## Task 5: Comments UI + wire into the feed

**Files:**
- Create: `src/components/hub/HubPostComments.tsx`
- Modify: `src/components/hub/HubCommunitySection.tsx`

**Interfaces:**
- Consumes: comment APIs (Task 4); `commentCount` on the feed post; `currentUserId` + `canParticipate`/`canModerate` flags.

- [ ] **Step 1: Build `HubPostComments`**

```tsx
// src/components/hub/HubPostComments.tsx
'use client'
import { useState } from 'react'
import { MessageCircle, Trash2 } from 'lucide-react'

interface Comment {
  id: string
  author: { id: string; name: string | null; username: string; avatar: string | null }
  text: string
  createdAt: string
}

export function HubPostComments({
  hubId, postId, initialCount, canComment, canModerate, currentUserId,
}: {
  hubId: string
  postId: string
  initialCount: number
  canComment: boolean
  canModerate: boolean
  currentUserId?: string
}) {
  const [open, setOpen] = useState(false)
  const [comments, setComments] = useState<Comment[] | null>(null)
  const [count, setCount] = useState(initialCount)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)

  const base = `/api/hubs/${hubId}/posts/${postId}/comments`

  async function toggle() {
    const next = !open
    setOpen(next)
    if (next && comments === null) {
      const res = await fetch(base)
      if (res.ok) setComments((await res.json()).comments)
      else setComments([])
    }
  }
  async function submit() {
    if (!text.trim() || busy) return
    setBusy(true)
    try {
      const res = await fetch(base, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) })
      if (res.ok) {
        const { comment } = await res.json()
        setComments((c) => [...(c ?? []), comment])
        setCount((n) => n + 1)
        setText('')
      }
    } finally { setBusy(false) }
  }
  async function remove(cid: string) {
    setComments((c) => (c ?? []).filter((x) => x.id !== cid))
    setCount((n) => Math.max(0, n - 1))
    await fetch(`${base}/${cid}`, { method: 'DELETE' }).catch(() => {})
  }

  return (
    <div className="mt-2 border-t border-border pt-2">
      <button onClick={toggle} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
        <MessageCircle className="h-3.5 w-3.5" /> {count} comment{count === 1 ? '' : 's'}
      </button>
      {open && (
        <div className="mt-2 space-y-2">
          {(comments ?? []).map((c) => (
            <div key={c.id} className="flex items-start justify-between gap-2 text-sm">
              <div className="min-w-0">
                <span className="font-semibold">{c.author.name || c.author.username}</span>{' '}
                <span className="text-foreground break-words whitespace-pre-wrap">{c.text}</span>
              </div>
              {(canModerate || c.author.id === currentUserId) && (
                <button onClick={() => remove(c.id)} aria-label="delete comment" className="p-1 text-muted-foreground hover:text-destructive shrink-0">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
          {comments !== null && comments.length === 0 && <p className="text-xs text-muted-foreground">No comments yet.</p>}
          {canComment && (
            <div className="flex items-center gap-2">
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') submit() }}
                placeholder="Write a comment…"
                className="flex-1 text-sm border border-border rounded-lg px-3 py-1.5 bg-transparent"
              />
              <button onClick={submit} disabled={busy || !text.trim()} className="text-sm font-semibold text-primary disabled:opacity-40">Post</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Wire under each post in `HubCommunitySection`**

- Extend `FeedPost` usage: the posts payload now has `commentCount`. Add a local type note or read `(p as { commentCount?: number }).commentCount ?? 0`.
- Render `HubPostComments` right after each `BulletinPostCard`:
```tsx
posts.map((p) => (
  <div key={p.id}>
    <BulletinPostCard post={p} currentUserId={currentUserId} basePath={`/api/hubs/${hubId}/posts`} onDeleted={(delId) => setPosts((cur) => cur.filter((x) => x.id !== delId))} />
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
```
(`canComment = canPost` = privileged||joined; `canModerate = isPrivileged`. Import `HubPostComments`.)

- [ ] **Step 3: Verify + commit**

Run: `pnpm exec tsc --noEmit && pnpm exec next lint --file "src/components/hub/HubPostComments.tsx" --file "src/components/hub/HubCommunitySection.tsx"`
Expected: clean (escape any apostrophes; the "Write a comment…" uses an ellipsis char, fine).
```bash
git add src/components/hub/HubPostComments.tsx src/components/hub/HubCommunitySection.tsx
git commit -m "feat(community): comments UI under each post (view/add/delete)"
```

---

## Task 6: Full verification

- [ ] **Step 1: Type + lint + tests**

Run: `pnpm exec tsc --noEmit` (ignore pre-existing PdfView errors), then `pnpm exec next lint` (no `Error:` lines in the changed files), then
`JWT_SECRET="ci-test-secret-not-used-in-production-0123456789abcdef" DATABASE_URL="postgresql://pages:pages@127.0.0.1:5434/pages" DATABASE_URL_UNPOOLED="postgresql://pages:pages@127.0.0.1:5434/pages" pnpm test`
Expected: full suite green (incl. new community.test.ts). Note any pre-existing unrelated failures.

- [ ] **Step 2: Manual smoke (dev)**

`DATABASE_URL="postgresql://pages:pages@127.0.0.1:5434/pages" pnpm dev` — as a non-owner account on a published community hub:
1. Join → the post composer appears; post text + an image → shows in the feed.
2. Comment on a post → appears; count increments; reload persists.
3. Delete your own comment/post; confirm a stranger (not joined) gets 403 on post/comment.
4. As owner/collab: delete a member's post and comment (moderation).
5. On an UNPUBLISHED community hub, confirm comments GET 404s for the public (owner/collab still see).

- [ ] **Step 3: Commit** (if any fixups)

---

## Self-Review notes

- **Spec coverage:** helpers (T1); member posting + collab moderation (T2); comment model (T3); comment APIs + count (T4); comments UI (T5); verify (T6). ✓
- **Reuse honored:** `HubPostComposer`/posts API reused for member posts; `BulletinPostCard` untouched (comments wrap around it).
- **Lint gate:** every task runs `next lint`.
- **Read-gate sync:** comments GET replicates the posts-GET published gate with a "keep in sync" comment.
- **Deferred (spec):** notifications, threaded replies, comment images, Explore discovery, poll/rating blocks, report/ban/approval.
