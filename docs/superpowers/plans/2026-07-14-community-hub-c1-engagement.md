# Community Hub C1 (Engagement Core) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Members get notified about activity in communities they joined, and hub posts support interactive poll/rating/short-answer blocks — by reusing the Bulletin block system rather than rebuilding it.

**Architecture:** Mirror Bulletin. Add one model (`HubPostResponse`) mirroring `BulletinResponse`, one route (`…/posts/[postId]/respond`) mirroring `/api/bulletin/[id]/respond` but gated by `canParticipate` instead of `isInScope`, and populate the currently-hardcoded `block`/`settings`/`myResponse`/`results` nulls in the hub posts GET. The three block components, `aggregateBlock`/`toRecords`, and `resultsVisible` are reused untouched — the only component change is threading an existing `basePath` prop one level deeper, which also fixes a latent bug. Notifications add a `HubMember` fan-out analogous to the existing `notifyFollowers`.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Prisma/PostgreSQL, vitest, Tailwind.

**Spec:** `docs/superpowers/specs/2026-07-14-community-hub-c1-engagement-design.md` (commit `c2cb711`)

## Global Constraints

- Work in worktree `C:\Users\whirl\pages-mvp\.claude\worktrees\hub-community` on branch `worktree-hub-community` (based on main `dd0a5c2`). **Never touch, commit from, or switch the branch of the main checkout** `C:\Users\whirl\pages-mvp` — a concurrent agent is working there.
- Every command needs the local DB env: `export DATABASE_URL="postgresql://pages:pages@127.0.0.1:5434/pages"` — **`127.0.0.1`, NOT `localhost`** (Node resolves localhost to IPv6 where PG 5434 doesn't answer). A machine-level `DATABASE_URL` points at the wrong DB and overrides `.env`, so set it inline for every command.
- The test suite needs `JWT_SECRET` exported or `src/lib/hub-access.test.ts` fails 2 tests. Load it with `set -a && . ./.env && set +a`. (`.env` is gitignored; it has already been copied into this worktree.)
- **Baseline is 505/505 passing (128 files).** The full suite must be green at every commit.
- **Never run `prisma migrate dev`** (non-interactive here). Hand-author `migration.sql`, then `prisma migrate deploy`. Do **not** trust `migrate diff --from-url` — the shared dev DB is contaminated by concurrent branches and emits spurious `DROP TABLE`s.
- Prisma commands need `DATABASE_URL_UNPOOLED` set alongside `DATABASE_URL` (schema `directUrl`).
- **Never import `src/lib/notifications.ts` into a client component** (it pulls in `db`). Client-safe formatting lives in `src/lib/notifications-format.ts`.
- Existing behaviour of Bulletin must not change. `basePath` defaults to `/api/bulletin` everywhere.
- Stop `pnpm dev` before `pnpm build` on Windows (they race on `.next`).
- Follow the existing two-space, no-semicolon-free style of neighbouring files; match their comment density.

---

### Task 1: Pure helpers — `postNotifyTargets` + `firstBlock`

Two pure functions with no DB access, so they are unit-testable and reviewable on their own.

`firstBlock` exists because the "read the post's single block out of the `blocks` JSON column" line is otherwise repeated in three places (the existing bulletin respond route, plus Tasks 7 and 8). One pure helper, three call sites.

**Files:**
- Modify: `src/lib/community.ts` (append; file is 44 lines)
- Modify: `src/lib/bulletin.ts` (append; file is 59 lines)
- Test: `src/lib/community.test.ts` (append), `src/lib/bulletin.test.ts` (append)

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `postNotifyTargets(input: { authorId: string; ownerId: string; collabIds: string[]; memberIds: string[] }): string[]` — used by Task 4.
  - `firstBlock(blocks: unknown): CanvasElement | null` — used by Tasks 7 and 8.

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/community.test.ts`:

```ts
import { postNotifyTargets } from './community'

describe('postNotifyTargets', () => {
  const base = { ownerId: 'owner', collabIds: ['collab'], memberIds: ['m1', 'm2'] }

  it('owner posting notifies all members, never the author', () => {
    expect(postNotifyTargets({ ...base, authorId: 'owner' }).sort()).toEqual(['m1', 'm2'])
  })

  it('collaborator posting notifies all members', () => {
    expect(postNotifyTargets({ ...base, authorId: 'collab' }).sort()).toEqual(['m1', 'm2'])
  })

  it('member posting notifies owner + collaborators only', () => {
    expect(postNotifyTargets({ ...base, authorId: 'm1' }).sort()).toEqual(['collab', 'owner'])
  })

  it('excludes the author when the author is also a member', () => {
    const out = postNotifyTargets({ ...base, authorId: 'owner', memberIds: ['owner', 'm1'] })
    expect(out).toEqual(['m1'])
  })

  it('de-duplicates repeated ids', () => {
    const out = postNotifyTargets({ ...base, authorId: 'm1', collabIds: ['collab', 'collab'], memberIds: ['m1'] })
    expect(out.sort()).toEqual(['collab', 'owner'])
  })

  it('returns empty when there is nobody else to notify', () => {
    expect(postNotifyTargets({ authorId: 'owner', ownerId: 'owner', collabIds: [], memberIds: [] })).toEqual([])
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd "C:/Users/whirl/pages-mvp/.claude/worktrees/hub-community" && set -a && . ./.env && set +a && export DATABASE_URL="postgresql://pages:pages@127.0.0.1:5434/pages" && pnpm vitest run src/lib/community.test.ts
```
Expected: FAIL — `postNotifyTargets is not a function` (or an import error).

- [ ] **Step 3: Write the implementation**

Append to `src/lib/community.ts`:

```ts
/**
 * Who hears about a new community post.
 * Owner/collaborator posts are the broadcast members joined for -> notify every member.
 * Member posts are chatter -> notify owner + collaborators only (moderation awareness).
 * The author never notifies themselves.
 */
export function postNotifyTargets(input: {
  authorId: string
  ownerId: string
  collabIds: string[]
  memberIds: string[]
}): string[] {
  const { authorId, ownerId, collabIds, memberIds } = input
  const isPrivileged = authorId === ownerId || collabIds.includes(authorId)
  const targets = isPrivileged ? memberIds : [ownerId, ...collabIds]
  return [...new Set(targets)].filter((id) => id !== authorId)
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
cd "C:/Users/whirl/pages-mvp/.claude/worktrees/hub-community" && set -a && . ./.env && set +a && export DATABASE_URL="postgresql://pages:pages@127.0.0.1:5434/pages" && pnpm vitest run src/lib/community.test.ts
```
Expected: PASS — all 6 new tests green, existing `canParticipate`/`canModerate` tests still green.

- [ ] **Step 5: Write the failing test for `firstBlock`**

Append to `src/lib/bulletin.test.ts`:

```ts
import { firstBlock } from './bulletin'

describe('firstBlock', () => {
  it('returns the single block from a blocks array', () => {
    const b = { id: 'b1', type: 'poll' }
    expect(firstBlock([b])).toEqual(b)
  })
  it('returns null for an empty array', () => {
    expect(firstBlock([])).toBeNull()
  })
  it('returns null for a non-array (null, undefined, object, string)', () => {
    expect(firstBlock(null)).toBeNull()
    expect(firstBlock(undefined)).toBeNull()
    expect(firstBlock({})).toBeNull()
    expect(firstBlock('nope')).toBeNull()
  })
  it('ignores extra blocks — v1 allows at most one', () => {
    expect(firstBlock([{ id: 'a' }, { id: 'b' }])).toEqual({ id: 'a' })
  })
})
```

- [ ] **Step 6: Run it to verify it fails**

```bash
cd "C:/Users/whirl/pages-mvp/.claude/worktrees/hub-community" && set -a && . ./.env && set +a && export DATABASE_URL="postgresql://pages:pages@127.0.0.1:5434/pages" && pnpm vitest run src/lib/bulletin.test.ts
```
Expected: FAIL — `firstBlock is not a function`.

- [ ] **Step 7: Implement `firstBlock`**

Append to `src/lib/bulletin.ts` (it already imports nothing; add the type import at the top):

```ts
import type { CanvasElement } from '@/lib/types/canvas'
```

```ts
/** The post's single block, read out of the `blocks` JSON column. v1 stores at most one. */
export function firstBlock(blocks: unknown): CanvasElement | null {
  if (!Array.isArray(blocks) || blocks.length === 0) return null
  return (blocks[0] as CanvasElement) || null
}
```

- [ ] **Step 8: Run both test files to verify they pass**

```bash
cd "C:/Users/whirl/pages-mvp/.claude/worktrees/hub-community" && set -a && . ./.env && set +a && export DATABASE_URL="postgresql://pages:pages@127.0.0.1:5434/pages" && pnpm vitest run src/lib/community.test.ts src/lib/bulletin.test.ts
```
Expected: PASS — all new tests green, existing tests in both files still green.

- [ ] **Step 9: Commit**

```bash
git add src/lib/community.ts src/lib/community.test.ts src/lib/bulletin.ts src/lib/bulletin.test.ts
git commit -m "feat(community): pure postNotifyTargets + firstBlock helpers"
```

---

### Task 2: Register the two new notification types

Client-safe formatting only. No DB, no fan-out yet.

**Files:**
- Modify: `src/lib/notifications-format.ts:1` (the `NotificationType` union) and its `formatNotification` switch
- Test: `src/lib/notifications-format.test.ts` (exists — append to it)

**Interfaces:**
- Consumes: nothing.
- Produces: `NotificationType` now includes `'hub_post' | 'hub_comment'` — used by Tasks 3 and 4.

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/notifications-format.test.ts` (it already imports `formatNotification`):

```ts
describe('formatNotification — hub community types', () => {
  it('formats hub_post with the hub title', () => {
    expect(formatNotification({ type: 'hub_post', actorName: 'Ada', contextText: 'Smoke Hub' }))
      .toBe('Ada posted in “Smoke Hub”')
  })

  it('formats hub_comment with the hub title', () => {
    expect(formatNotification({ type: 'hub_comment', actorName: 'Ada', contextText: 'Smoke Hub' }))
      .toBe('Ada commented on your post in “Smoke Hub”')
  })

  it('falls back gracefully when contextText is missing', () => {
    expect(formatNotification({ type: 'hub_post', actorName: 'Ada' })).toBe('Ada posted in a community')
    expect(formatNotification({ type: 'hub_comment', actorName: 'Ada' })).toBe('Ada commented on your post')
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd "C:/Users/whirl/pages-mvp/.claude/worktrees/hub-community" && set -a && . ./.env && set +a && export DATABASE_URL="postgresql://pages:pages@127.0.0.1:5434/pages" && pnpm vitest run src/lib/notifications-format.test.ts
```
Expected: FAIL — returns `'Ada'` (the `default:` branch) instead of the expected strings.

- [ ] **Step 3: Write the implementation**

In `src/lib/notifications-format.ts`, extend the union on line 1:

```ts
export type NotificationType = 'follow' | 'bulletin' | 'page_published' | 'comment' | 'hub_collaborator' | 'message' | 'hub_member' | 'hub_post' | 'hub_comment'
```

And add two cases to the `formatNotification` switch, immediately after the `case 'hub_member':` block:

```ts
    case 'hub_post':
      return `${n.actorName} posted in ${n.contextText ? `“${n.contextText}”` : 'a community'}`
    case 'hub_comment':
      return `${n.actorName} commented on your post${n.contextText ? ` in “${n.contextText}”` : ''}`
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
cd "C:/Users/whirl/pages-mvp/.claude/worktrees/hub-community" && set -a && . ./.env && set +a && export DATABASE_URL="postgresql://pages:pages@127.0.0.1:5434/pages" && pnpm vitest run src/lib/notifications-format.test.ts
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/notifications-format.ts src/lib/notifications-format.test.ts
git commit -m "feat(notifications): add hub_post + hub_comment types"
```

---

### Task 3: `notifyHubMembers` fan-out helper

The `HubMember` analogue of the existing `notifyFollowers` (`src/lib/notifications.ts:37-50`). Same `createMany` pattern, same swallow-and-log contract — a notification failure must never fail the write that triggered it.

**Files:**
- Modify: `src/lib/notifications.ts` (append)

**Interfaces:**
- Consumes: `NotificationType` (Task 2).
- Produces: `notifyHubMembers(userIds: string[], input: BaseInput): Promise<void>` — used by Task 4.

Note: this helper takes explicit `userIds` (computed by `postNotifyTargets`) rather than a `hubId`, so target selection stays pure and DB-free. The route does the lookups.

- [ ] **Step 1: Write the implementation**

Append to `src/lib/notifications.ts`:

```ts
/** Fan out one notification to an explicit recipient list (see postNotifyTargets). */
export async function notifyHubMembers(userIds: string[], input: BaseInput): Promise<void> {
  try {
    if (userIds.length === 0) return
    await db.notification.createMany({
      data: userIds.map((userId) => toRow(userId, input)),
    })
  } catch (e) {
    console.error('notifyHubMembers failed', e)
  }
}
```

There is no unit test here: it is a thin `createMany` wrapper with no branching beyond the empty guard, exactly like `notifyFollowers`, which likewise has none. Its behaviour is covered by the route tests in Task 4 and the browser smoke in Task 10.

- [ ] **Step 2: Verify it typechecks**

```bash
cd "C:/Users/whirl/pages-mvp/.claude/worktrees/hub-community" && pnpm exec tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/notifications.ts
git commit -m "feat(notifications): notifyHubMembers fan-out helper"
```

---

### Task 4: Wire notifications into hub posts + comments

**This task ships the first half of C1** — no schema change needed. After it, members hear about broadcasts.

**Files:**
- Modify: `src/app/api/hubs/[id]/posts/route.ts` (the `POST` handler, lines 51-69)
- Modify: `src/app/api/hubs/[id]/posts/[postId]/comments/route.ts` (the `POST` handler)
- Create: `src/app/api/hubs/[id]/posts/route.test.ts`
- Create: `src/app/api/hubs/[id]/posts/[postId]/comments/route.test.ts`

**Interfaces:**
- Consumes: `postNotifyTargets` (Task 1), `notifyHubMembers` (Task 3), `createNotification` (existing), `'hub_post' | 'hub_comment'` (Task 2).
- Produces: a hub route-test harness that Tasks 7 and 8 extend.

> **There are currently NO API route tests under `src/app/api/hubs/`** — the hub API is covered only by pure-helper tests in `src/lib/community.test.ts`. This task establishes the pattern. Model it on `src/app/api/collections/[id]/members/route.test.ts` (one of 18 existing route tests): mock `@/lib/auth` and `@/lib/db` at the top, import the handler, build a plain `Request`, and pass `ctx = { params: Promise.resolve({...}) }`.

- [ ] **Step 1: Write the failing tests**

Create `src/app/api/hubs/[id]/posts/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({ getUser: vi.fn() }))
vi.mock('@/lib/rate-limit', () => ({ rateLimit: vi.fn().mockResolvedValue(null) }))
vi.mock('@/lib/notifications', () => ({ notifyHubMembers: vi.fn(), createNotification: vi.fn() }))
vi.mock('@/lib/db', () => ({
  db: {
    hub: { findUnique: vi.fn() },
    hubMember: { findUnique: vi.fn(), findMany: vi.fn() },
    hubCollaborator: { findMany: vi.fn() },
    hubPost: { create: vi.fn(), findMany: vi.fn() },
    hubPostResponse: { findMany: vi.fn() },
    display: { findUnique: vi.fn() },
  },
}))

import { getUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { notifyHubMembers } from '@/lib/notifications'
import { POST } from './route'

const HUB = { id: 'h1', userId: 'owner', community: true, title: 'Smoke Hub', slug: 'smoke-hub', user: { username: 'hubowner' } }
const ctx = { params: Promise.resolve({ id: 'h1' }) }
const req = (body: unknown) =>
  new Request('http://localhost/api/hubs/h1/posts', { method: 'POST', body: JSON.stringify(body) }) as any

beforeEach(() => {
  vi.clearAllMocks()
  ;(db.hub.findUnique as any).mockResolvedValue(HUB)
  ;(db.hubCollaborator.findMany as any).mockResolvedValue([])
  ;(db.hubMember.findUnique as any).mockResolvedValue({ id: 'mem' }) // caller is a member
  ;(db.hubMember.findMany as any).mockResolvedValue([{ userId: 'm1' }, { userId: 'm2' }])
  ;(db.hubPost.create as any).mockResolvedValue({ id: 'p1' })
})

describe('POST /api/hubs/[id]/posts — notifications', () => {
  it('owner posting notifies every member except the author', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'owner', name: 'Owner', username: 'hubowner', avatar: null })
    const res = await POST(req({ text: 'hello' }), ctx)
    expect(res.status).toBe(201)
    const [targets, input] = (notifyHubMembers as any).mock.calls[0]
    expect([...targets].sort()).toEqual(['m1', 'm2'])
    expect(input.type).toBe('hub_post')
    expect(input.entityUrl).toBe('/hubowner/hub/smoke-hub')
    expect(input.contextText).toBe('Smoke Hub')
  })

  it('member posting notifies the owner, not other members', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'm1', name: 'M1', username: 'm1', avatar: null })
    await POST(req({ text: 'hi' }), ctx)
    const [targets] = (notifyHubMembers as any).mock.calls[0]
    expect([...targets].sort()).toEqual(['owner'])
  })

  it('creates the post before notifying (notification is not a precondition)', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'owner', name: 'Owner', username: 'hubowner', avatar: null })
    await POST(req({ text: 'hello' }), ctx)
    expect(db.hubPost.create).toHaveBeenCalled()
    expect(notifyHubMembers).toHaveBeenCalled()
  })
})
```

Create `src/app/api/hubs/[id]/posts/[postId]/comments/route.test.ts` using the same header, but mocking `hubPost: { findFirst: vi.fn() }` and `hubPostComment: { create: vi.fn() }`, and importing `createNotification`. Match whatever lookups the real handler performs — read it first:

```ts
describe('POST comments — notifications', () => {
  it('notifies the post author', async () => {
    // post authored by 'm1'; comment POST as 'm2'
    ;(getUser as any).mockResolvedValue({ id: 'm2', name: 'M2', username: 'm2', avatar: null })
    await POST(req({ text: 'nice' }), ctx)
    expect((createNotification as any).mock.calls[0][0]).toMatchObject({ userId: 'm1', type: 'hub_comment' })
  })

  it('commenting on your own post notifies nobody', async () => {
    // post authored by 'm1'; comment POST as 'm1'
    ;(getUser as any).mockResolvedValue({ id: 'm1', name: 'M1', username: 'm1', avatar: null })
    await POST(req({ text: 'self' }), ctx)
    expect(createNotification).not.toHaveBeenCalled()
  })
})
```

Note: do **not** write a "notification failure does not fail the post" test by mocking a rejection. `notifyHubMembers` / `createNotification` swallow their own errors internally (`src/lib/notifications.ts:29-50`) and can never reject in production — such a test would only exercise the mock and would push you to add a `try/catch` the real path does not need. The swallow-and-log contract belongs to the helper, not the route.

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd "C:/Users/whirl/pages-mvp/.claude/worktrees/hub-community" && set -a && . ./.env && set +a && export DATABASE_URL="postgresql://pages:pages@127.0.0.1:5434/pages" && pnpm vitest run "src/app/api/hubs"
```
Expected: FAIL — no notifications are created today.

- [ ] **Step 3: Implement in the posts POST handler**

In `src/app/api/hubs/[id]/posts/route.ts`, extend the hub lookup on line 57 to fetch what the notification needs:

```ts
  const hub = await db.hub.findUnique({
    where: { id },
    select: { id: true, userId: true, community: true, title: true, slug: true, user: { select: { username: true } } },
  })
```

Then, after the `db.hubPost.create(...)` on line 67 and before the response, add:

```ts
  const collabIds = await collaboratorIds(id)
  const memberIds = (await db.hubMember.findMany({ where: { hubId: id }, select: { userId: true } })).map((m) => m.userId)
  const targets = postNotifyTargets({ authorId: me.id, ownerId: hub.userId, collabIds, memberIds })
  await notifyHubMembers(targets, {
    type: 'hub_post',
    actor: { id: me.id, name: me.name || me.username, avatar: me.avatar },
    entityUrl: `/${hub.user.username}/hub/${hub.slug}`,
    contextText: hub.title,
  })
```

Add to the imports at the top of the file:

```ts
import { canParticipate, postNotifyTargets } from '@/lib/community'
import { notifyHubMembers } from '@/lib/notifications'
```

Note `collaboratorIds(id)` is already called on line 60 for the gate — hoist that call into a `const collabIds` above the `canParticipate` check and reuse it rather than querying twice.

- [ ] **Step 4: Implement in the comments POST handler**

In `src/app/api/hubs/[id]/posts/[postId]/comments/route.ts`, after the comment is created, notify the post author (skip self). The post's `authorId` and the hub's `title`/`slug`/`user.username` must be in the existing lookups' `select` — extend them if not:

```ts
  if (post.authorId !== me.id) {
    await createNotification({
      userId: post.authorId,
      type: 'hub_comment',
      actor: { id: me.id, name: me.name || me.username, avatar: me.avatar },
      entityUrl: `/${hub.user.username}/hub/${hub.slug}`,
      contextText: hub.title,
    })
  }
```

Add to the imports:

```ts
import { createNotification } from '@/lib/notifications'
```

- [ ] **Step 5: Run the tests to verify they pass**

```bash
cd "C:/Users/whirl/pages-mvp/.claude/worktrees/hub-community" && set -a && . ./.env && set +a && export DATABASE_URL="postgresql://pages:pages@127.0.0.1:5434/pages" && pnpm vitest run "src/app/api/hubs"
```
Expected: PASS.

- [ ] **Step 6: Run the full suite**

```bash
cd "C:/Users/whirl/pages-mvp/.claude/worktrees/hub-community" && set -a && . ./.env && set +a && export DATABASE_URL="postgresql://pages:pages@127.0.0.1:5434/pages" && pnpm test
```
Expected: PASS — 505 baseline + the new tests, 0 failures.

- [ ] **Step 7: Commit**

```bash
git add src/app/api/hubs
git commit -m "feat(community): notify members on hub post, author on comment"
```

---

### Task 5: `HubPostResponse` model + hand-authored migration

**Files:**
- Modify: `prisma/schema.prisma` (add model; add back-relations to `HubPost` and `User`)
- Create: `prisma/migrations/20260715000000_add_hub_post_response/migration.sql`

**Interfaces:**
- Consumes: nothing.
- Produces: `db.hubPostResponse` with `@@unique([postId, userId])` → `where: { postId_userId: { postId, userId } }` — used by Tasks 7 and 8.

- [ ] **Step 1: Add the model to `prisma/schema.prisma`**

Add next to the other Hub models:

```prisma
model HubPostResponse {
  id        String   @id @default(cuid())
  postId    String
  post      HubPost  @relation(fields: [postId], references: [id], onDelete: Cascade)
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  // Same shape as BulletinResponse.responses: { [elementId]: { type, question, answer } }
  responses Json

  createdAt DateTime @default(now())

  @@unique([postId, userId])
  @@index([postId])
}
```

Add the back-relation to `model HubPost` (alongside its existing `likes` / `comments`):

```prisma
  responses HubPostResponse[]
```

Add the back-relation to `model User` (alongside its other relations):

```prisma
  hubPostResponses HubPostResponse[]
```

- [ ] **Step 2: Hand-author the migration**

Create `prisma/migrations/20260715000000_add_hub_post_response/migration.sql` with **only** these statements (do NOT generate via `migrate diff` — the shared dev DB is contaminated and will emit `DROP TABLE`s for other branches' tables):

```sql
-- CreateTable
CREATE TABLE "HubPostResponse" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "responses" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HubPostResponse_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HubPostResponse_postId_idx" ON "HubPostResponse"("postId");

-- CreateIndex
CREATE UNIQUE INDEX "HubPostResponse_postId_userId_key" ON "HubPostResponse"("postId", "userId");

-- AddForeignKey
ALTER TABLE "HubPostResponse" ADD CONSTRAINT "HubPostResponse_postId_fkey" FOREIGN KEY ("postId") REFERENCES "HubPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HubPostResponse" ADD CONSTRAINT "HubPostResponse_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

- [ ] **Step 3: Apply the migration and regenerate the client**

```bash
cd "C:/Users/whirl/pages-mvp/.claude/worktrees/hub-community" && set -a && . ./.env && set +a && export DATABASE_URL="postgresql://pages:pages@127.0.0.1:5434/pages" && export DATABASE_URL_UNPOOLED="$DATABASE_URL" && pnpm prisma migrate deploy && pnpm prisma generate
```
Expected: `1 migration found` / applied, then `✔ Generated Prisma Client`.

If `prisma generate` fails with EPERM, stop the dev server (it holds the engine dll) and retry.

- [ ] **Step 4: Verify the table exists and cascades**

```bash
docker exec pages-mvp-postgres-1 psql -U pages -d pages -c '\d "HubPostResponse"'
```
Expected: the table, the unique index on `(postId, userId)`, and two FK constraints with `ON DELETE CASCADE`.

- [ ] **Step 5: Restart the dev server**

The running `next dev` caches a stale Prisma client and will 500 on the new model until restarted. Kill it and restart:

```bash
cd "C:/Users/whirl/pages-mvp/.claude/worktrees/hub-community" && set -a && . ./.env && set +a && export DATABASE_URL="postgresql://pages:pages@127.0.0.1:5434/pages" && pnpm dev -p 3100
```

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260715000000_add_hub_post_response
git commit -m "feat(community): HubPostResponse model + migration"
```

---

### Task 6: Thread `basePath` into block components (fixes latent bug)

`BulletinPostCard` accepts `basePath` (default `/api/bulletin`, line 28) and uses it for like (line 47) and delete (line 62) — that is how `HubCommunitySection:61` reuses it with `/api/hubs/${hubId}/posts`. But `basePath` is **not** passed to `BulletinBlock`, and all three block components hardcode `` `/api/bulletin/${postId}/respond` `` (BulletinPoll.tsx:40, BulletinRating.tsx:22, BulletinShortAnswer.tsx:21).

This is unreachable today only because the hub composer cannot attach a block. **Task 9 makes it reachable — so this fix must land first**, or hub poll responses would POST against the bulletin table.

**Files:**
- Modify: `src/components/bulletin/BulletinBlock.tsx` (add `basePath` to `BulletinBlockProps`)
- Modify: `src/components/bulletin/BulletinPostCard.tsx:96-97` (pass `basePath` down)
- Modify: `src/components/bulletin/blocks/BulletinPoll.tsx:8,40`
- Modify: `src/components/bulletin/blocks/BulletinRating.tsx:8,22`
- Modify: `src/components/bulletin/blocks/BulletinShortAnswer.tsx:8,21`
- Test: `src/components/bulletin/blocks/BulletinPoll.test.tsx` (exists — extend it)

**Interfaces:**
- Consumes: nothing.
- Produces: `BulletinBlockProps` now has `basePath: string` — used by Task 9.

- [ ] **Step 1: Write the failing tests**

Extend `src/components/bulletin/blocks/BulletinPoll.test.tsx`, matching its existing render/mock style:

```tsx
it('posts the vote to the default bulletin path', async () => {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ results: null }) })
  vi.stubGlobal('fetch', fetchMock)
  // render BulletinPoll with basePath="/api/bulletin", postId="p1", select an option, click Vote
  expect(fetchMock).toHaveBeenCalledWith('/api/bulletin/p1/respond', expect.anything())
})

it('posts the vote to the hub path when given a hub basePath', async () => {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ results: null }) })
  vi.stubGlobal('fetch', fetchMock)
  // render BulletinPoll with basePath="/api/hubs/h1/posts", postId="p1", select an option, click Vote
  expect(fetchMock).toHaveBeenCalledWith('/api/hubs/h1/posts/p1/respond', expect.anything())
})
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd "C:/Users/whirl/pages-mvp/.claude/worktrees/hub-community" && set -a && . ./.env && set +a && export DATABASE_URL="postgresql://pages:pages@127.0.0.1:5434/pages" && pnpm vitest run src/components/bulletin/blocks/BulletinPoll.test.tsx
```
Expected: FAIL — the second test gets `/api/bulletin/p1/respond` (hardcoded) instead of the hub path. The first test may pass already; that is the regression guard.

- [ ] **Step 3: Add `basePath` to the props interface**

In `src/components/bulletin/BulletinBlock.tsx`, add one field to `BulletinBlockProps`:

```ts
export interface BulletinBlockProps {
  postId: string
  basePath: string
  block: CanvasElement
  results: ElementAggregate | null
  myResponse: Record<string, { type: string; answer: unknown }> | null
  onResults: (results: ElementAggregate) => void
}
```

`BulletinBlock`'s body needs no change — it already spreads `{...props}` into each block component.

- [ ] **Step 4: Pass `basePath` down from the card**

In `src/components/bulletin/BulletinPostCard.tsx` at the `<BulletinBlock` usage (line 96-97), add the prop:

```tsx
      {post.block && (
        <BulletinBlock
          postId={post.id}
          basePath={basePath}
          block={post.block}
          results={results}
          myResponse={myResponse}
          onResults={setResults}
        />
      )}
```

(Keep whatever props the existing call already passes; the only addition is `basePath={basePath}`.)

- [ ] **Step 5: Use `basePath` in all three block components**

`src/components/bulletin/blocks/BulletinPoll.tsx` — line 8 signature and line 40 fetch:

```tsx
export function BulletinPoll({ postId, basePath, block, results, myResponse, onResults }: BulletinBlockProps) {
```
```tsx
      const res = await fetch(`${basePath}/${postId}/respond`, {
```

`src/components/bulletin/blocks/BulletinRating.tsx` — line 8 signature and line 22 fetch:

```tsx
export function BulletinRating({ postId, basePath, block, results, myResponse, onResults }: BulletinBlockProps) {
```
```tsx
      const res = await fetch(`${basePath}/${postId}/respond`, {
```

`src/components/bulletin/blocks/BulletinShortAnswer.tsx` — line 8 signature and line 21 fetch:

```tsx
export function BulletinShortAnswer({ postId, basePath, block, results, myResponse, onResults }: BulletinBlockProps) {
```
```tsx
      const res = await fetch(`${basePath}/${postId}/respond`, {
```

- [ ] **Step 6: Run the tests to verify they pass**

```bash
cd "C:/Users/whirl/pages-mvp/.claude/worktrees/hub-community" && set -a && . ./.env && set +a && export DATABASE_URL="postgresql://pages:pages@127.0.0.1:5434/pages" && pnpm vitest run src/components/bulletin && pnpm exec tsc --noEmit
```
Expected: PASS, and tsc clean (tsc will catch any `BulletinBlock` caller that now misses the required `basePath`).

- [ ] **Step 7: Commit**

```bash
git add src/components/bulletin
git commit -m "fix(bulletin): thread basePath into block respond calls

BulletinPostCard threaded basePath into like/delete but not into
BulletinBlock; the three block components hardcoded /api/bulletin.
Unreachable today (no hub composer block picker) but would send hub
poll responses to the bulletin table once hub blocks are enabled."
```

---

### Task 7: Hub respond route

**Files:**
- Create: `src/app/api/hubs/[id]/posts/[postId]/respond/route.ts`
- Test: `src/app/api/hubs/[id]/posts/[postId]/respond/route.test.ts`

**Interfaces:**
- Consumes: `db.hubPostResponse` (Task 5), `canParticipate` (existing), `aggregateBlock`/`toRecords` (existing).
- Produces: `POST /api/hubs/[id]/posts/[postId]/respond` → `{ results, myResponse }`.

**Reference:** mirror `src/app/api/bulletin/[id]/respond/route.ts` (57 lines) for the handler; reuse the Task 4 test harness for the tests. The one substantive difference from Bulletin is the scope gate: `canParticipate` instead of `isInScope`. The post lookup must be **scoped to `hubId` AND `postId`** so a valid post id from another hub 404s (the comment DELETE route already does this).

- [ ] **Step 1: Write the failing tests**

Create `src/app/api/hubs/[id]/posts/[postId]/respond/route.test.ts`, reusing the exact mock header established in Task 4 (add `hubPostResponse: { upsert: vi.fn(), findMany: vi.fn() }` to the `db` mock, and `ctx = { params: Promise.resolve({ id: 'h1', postId: 'p1' }) }`):

```ts
it('401s when unauthenticated', async () => { /* expect 401 */ })
it('400s when responses is missing or not an object', async () => { /* expect 400 */ })
it('404s for a post id belonging to a different hub (IDOR)', async () => { /* expect 404 */ })
it('403s for a non-participant (not owner, collaborator, or member)', async () => { /* expect 403 */ })
it('upserts: answering twice leaves one row, updated', async () => {
  // POST twice as the same user; expect hubPostResponse.upsert called with
  // where: { postId_userId: { postId: 'p1', userId: 'm1' } }
})
it('returns the recomputed aggregate for the block', async () => { /* expect results non-null */ })
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd "C:/Users/whirl/pages-mvp/.claude/worktrees/hub-community" && set -a && . ./.env && set +a && export DATABASE_URL="postgresql://pages:pages@127.0.0.1:5434/pages" && pnpm vitest run "src/app/api/hubs/[id]/posts/[postId]/respond"
```
Expected: FAIL — module not found.

- [ ] **Step 3: Write the route**

Create `src/app/api/hubs/[id]/posts/[postId]/respond/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'
import { canParticipate } from '@/lib/community'
import { firstBlock } from '@/lib/bulletin'
import { rateLimit } from '@/lib/rate-limit'
import { aggregateBlock, toRecords } from '@/lib/element-aggregate'

interface Props {
  params: Promise<{ id: string; postId: string }>
}

export async function POST(request: NextRequest, { params }: Props) {
  try {
    const { id, postId } = await params
    const limited = await rateLimit(request, { limit: 20, windowMs: 60_000, prefix: 'hub-post-respond' })
    if (limited) return limited

    const me = await getUser(request)
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json().catch(() => ({}))
    const responses = body.responses
    if (!responses || typeof responses !== 'object') {
      return NextResponse.json({ error: 'Missing responses' }, { status: 400 })
    }

    const hub = await db.hub.findUnique({ where: { id }, select: { id: true, userId: true, community: true } })
    if (!hub || !hub.community) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Scope the post to this hub so a valid id from another hub cannot be answered.
    const post = await db.hubPost.findFirst({ where: { id: postId, hubId: id }, select: { id: true, blocks: true } })
    if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const collabIds = (await db.hubCollaborator.findMany({ where: { hubId: id }, select: { userId: true } })).map((r) => r.userId)
    const isMember = !!(await db.hubMember.findUnique({ where: { hubId_userId: { hubId: id, userId: me.id } }, select: { id: true } }))
    if (!canParticipate(me.id, hub, collabIds, isMember)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await db.hubPostResponse.upsert({
      where: { postId_userId: { postId, userId: me.id } },
      create: { postId, userId: me.id, responses },
      update: { responses },
    })

    // Recompute results (the responder has now answered, so they may see them).
    const block = firstBlock(post.blocks)
    let results = null
    if (block) {
      const rows = await db.hubPostResponse.findMany({
        where: { postId },
        select: { userId: true, responses: true, createdAt: true, user: { select: { name: true, username: true, avatar: true } } },
      })
      results = aggregateBlock(block, toRecords(rows, false))
    }

    return NextResponse.json({ results, myResponse: responses })
  } catch (error) {
    console.error('Hub post respond error:', error)
    return NextResponse.json({ error: 'Failed to respond' }, { status: 500 })
  }
}
```

Note `toRecords(rows, false)` — identity is **not** included, matching Bulletin. Community responses stay anonymous in aggregates.

- [ ] **Step 3b: Swap the existing bulletin route onto the shared helper**

Now that `firstBlock` exists, remove the duplicated extraction from `src/app/api/bulletin/[id]/respond/route.ts:41-42`. Replace:

```ts
    const blocks = Array.isArray(post.blocks) ? (post.blocks as any[]) : []
    const block = blocks[0] || null
```
with:
```ts
    const block = firstBlock(post.blocks)
```
and add `firstBlock` to its existing `@/lib/bulletin` import (which already imports `isInScope`).

This is a behaviour-neutral refactor; the bulletin route's existing tests are the proof.

- [ ] **Step 4: Run the tests to verify they pass**

```bash
cd "C:/Users/whirl/pages-mvp/.claude/worktrees/hub-community" && set -a && . ./.env && set +a && export DATABASE_URL="postgresql://pages:pages@127.0.0.1:5434/pages" && pnpm vitest run "src/app/api/hubs/[id]/posts/[postId]/respond"
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add "src/app/api/hubs/[id]/posts/[postId]/respond"
git commit -m "feat(community): hub post respond route (canParticipate-gated, IDOR-scoped)"
```

---

### Task 8: Populate `block` / `settings` / `myResponse` / `results` in the hub posts GET

Today `src/app/api/hubs/[id]/posts/route.ts:39-45` hardcodes `block: null`, `settings: { revealAfterAnswer: false, liveTally: false }`, `myResponse: null`, `results: null` — the post's own `blocks` and `settings` columns are never read.

**Files:**
- Modify: `src/app/api/hubs/[id]/posts/route.ts` (the `GET` handler, lines 24-48)
- Test: `src/app/api/hubs/[id]/posts/route.test.ts`

**Interfaces:**
- Consumes: `db.hubPostResponse` (Task 5), `normalizeSettings`/`resultsVisible` (existing), `aggregateBlock`/`toRecords` (existing).
- Produces: feed items with real `block` / `settings` / `myResponse` / `results`.

- [ ] **Step 1: Write the failing tests**

```ts
it('returns the post block and normalized settings', async () => {
  // post with blocks:[{id:'b1',type:'poll',...}], settings:{revealAfterAnswer:true,liveTally:false}
  // expect feed[0].block.id === 'b1' and feed[0].settings.revealAfterAnswer === true
})
it('returns myResponse for the requesting user only', async () => { /* m1 answered; GET as m1 -> myResponse set; GET as m2 -> null */ })
it('hides results from a non-responder when revealAfterAnswer is true', async () => { /* expect results === null */ })
it('shows results to a responder when revealAfterAnswer is true', async () => { /* expect results !== null */ })
it('shows results to the post author regardless', async () => { /* expect results !== null */ })
it('returns block null for a post with no block', async () => { /* expect feed[0].block === null, results === null */ })
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd "C:/Users/whirl/pages-mvp/.claude/worktrees/hub-community" && set -a && . ./.env && set +a && export DATABASE_URL="postgresql://pages:pages@127.0.0.1:5434/pages" && pnpm vitest run "src/app/api/hubs/[id]/posts/route"
```
Expected: FAIL — everything comes back null.

- [ ] **Step 3: Implement**

In `src/app/api/hubs/[id]/posts/route.ts`, add imports:

```ts
import { normalizeSettings, resultsVisible, firstBlock } from '@/lib/bulletin'
import { aggregateBlock, toRecords } from '@/lib/element-aggregate'
```

Replace the `posts` query + `feed` map (lines 24-47) with:

```ts
  const posts = await db.hubPost.findMany({
    where: { hubId: id },
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: {
      author: { select: { id: true, name: true, username: true, avatar: true } },
      likes: { select: { userId: true } },
      _count: { select: { comments: true } },
    },
  })

  // One query for every response on this page of posts, grouped in memory (avoids N+1).
  const postIds = posts.map((p) => p.id)
  const responseRows = postIds.length
    ? await db.hubPostResponse.findMany({
        where: { postId: { in: postIds } },
        select: { postId: true, userId: true, responses: true, createdAt: true, user: { select: { name: true, username: true, avatar: true } } },
      })
    : []
  const byPost = new Map<string, typeof responseRows>()
  for (const r of responseRows) {
    const list = byPost.get(r.postId)
    if (list) list.push(r)
    else byPost.set(r.postId, [r])
  }

  const feed = posts.map((p) => {
    const block = firstBlock(p.blocks)
    const settings = normalizeSettings(p.settings)
    const rows = byPost.get(p.id) || []
    const mine = me ? rows.find((r) => r.userId === me.id) : undefined
    const canSee = resultsVisible({
      isAuthor: !!me && me.id === p.authorId,
      revealAfterAnswer: settings.revealAfterAnswer,
      hasResponded: !!mine,
    })
    return {
      id: p.id,
      author: p.author,
      text: p.text,
      imageUrl: p.imageUrl,
      block,
      settings,
      createdAt: p.createdAt.toISOString(),
      likeCount: p.likes.length,
      likedByMe: me ? p.likes.some((l) => l.userId === me.id) : false,
      myResponse: (mine?.responses as Record<string, { type: string; answer: unknown }> | undefined) ?? null,
      results: block && canSee ? aggregateBlock(block, toRecords(rows, false)) : null,
      commentCount: p._count.comments,
    }
  })
  return NextResponse.json({ posts: feed })
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
cd "C:/Users/whirl/pages-mvp/.claude/worktrees/hub-community" && set -a && . ./.env && set +a && export DATABASE_URL="postgresql://pages:pages@127.0.0.1:5434/pages" && pnpm vitest run "src/app/api/hubs/[id]/posts/route" && pnpm exec tsc --noEmit
```
Expected: PASS, tsc clean.

- [ ] **Step 5: Commit**

```bash
git add "src/app/api/hubs/[id]/posts/route.ts" "src/app/api/hubs/[id]/posts/route.test.ts"
git commit -m "feat(community): hub posts GET returns real block, settings, myResponse, results"
```

---

### Task 9: Accept blocks on hub post create + composer block picker

**This task ships the second half of C1.** `makeBlock` and `BlockEditor` currently live inside `BulletinComposer.tsx` (lines 9 and 148) and are not exported, so they must be extracted before `HubPostComposer` can reuse them.

**Files:**
- Create: `src/components/bulletin/BlockEditor.tsx` (extract `makeBlock` + `BlockEditor` from `BulletinComposer.tsx`)
- Modify: `src/components/bulletin/BulletinComposer.tsx` (import the extracted pieces; delete the local copies)
- Modify: `src/components/hub/HubPostComposer.tsx` (add the picker + block state)
- Modify: `src/app/api/hubs/[id]/posts/route.ts` (the `POST` handler — accept/validate `block` + `settings`)
- Test: `src/app/api/hubs/[id]/posts/route.test.ts` (extend)

**Interfaces:**
- Consumes: `BulletinBlockProps.basePath` (Task 6), `isBulletinBlockType`/`normalizeSettings`/`isEmptyPost` (existing).
- Produces: nothing later depends on.

- [ ] **Step 1: Write the failing tests for the POST handler**

```ts
it('persists an attached block into blocks[] and normalizes settings', async () => {
  // POST { text:'', block:{id:'b1',type:'poll',pollQuestion:'Q',pollOptions:['a','b']}, settings:{revealAfterAnswer:true} }
  // expect hubPost.create called with blocks:[block], settings:{revealAfterAnswer:true,liveTally:false}
})
it('400s on an unsupported block type', async () => {
  // POST { block:{ id:'b1', type:'malicious' } } -> 400 'Unsupported block type'
})
it('allows a block-only post with no text', async () => {
  // POST { text:'', block:{...poll} } -> 201  (isEmptyPost must accept it)
})
it('still 400s on a truly empty post', async () => {
  // POST { text:'', imageUrl:null } -> 400
})
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd "C:/Users/whirl/pages-mvp/.claude/worktrees/hub-community" && set -a && . ./.env && set +a && export DATABASE_URL="postgresql://pages:pages@127.0.0.1:5434/pages" && pnpm vitest run "src/app/api/hubs/[id]/posts/route"
```
Expected: FAIL — blocks are ignored today, and a block-only post 400s.

- [ ] **Step 3: Accept blocks in the POST handler**

In `src/app/api/hubs/[id]/posts/route.ts`, add imports:

```ts
import { isBulletinBlockType, normalizeSettings, isEmptyPost } from '@/lib/bulletin'
import type { Prisma } from '@prisma/client'
```

Replace lines 63-67 (body parse → create) with — mirroring `src/app/api/bulletin/route.ts:16-40`:

```ts
  const body = await request.json().catch(() => ({}))
  const text = typeof body.text === 'string' ? body.text.trim().slice(0, 5000) : ''
  const imageUrl = typeof body.imageUrl === 'string' && body.imageUrl ? body.imageUrl : null
  const block = body.block && typeof body.block === 'object' ? body.block : null
  if (block) {
    if (!isBulletinBlockType(block.type)) {
      return NextResponse.json({ error: 'Unsupported block type' }, { status: 400 })
    }
    if (typeof block.id !== 'string' || !block.id) {
      block.id = `blk-${me.id.slice(-4)}-${text ? text.length : 0}-${Math.round(1000 * block.type.length)}`
    }
  }
  if (isEmptyPost({ text, imageUrl, block })) {
    return NextResponse.json({ error: 'Empty post' }, { status: 400 })
  }
  const post = await db.hubPost.create({
    data: {
      hubId: id,
      authorId: me.id,
      text: text || null,
      imageUrl,
      blocks: block ? [block] : [],
      settings: normalizeSettings(body.settings) as unknown as Prisma.InputJsonValue,
    },
  })
```

(The notification block added in Task 4 stays where it is, after the create.)

- [ ] **Step 4: Extract the block editor**

Create `src/components/bulletin/BlockEditor.tsx`. Move `makeBlock` (currently `BulletinComposer.tsx:9-11`) and the whole `BlockEditor` component (currently `BulletinComposer.tsx:148+`) into it **verbatim** — same bodies, same Tailwind classes — exporting both:

```tsx
'use client'

import type { CanvasElement } from '@/lib/types/canvas'
import type { BulletinBlockType } from '@/lib/bulletin'

export function makeBlock(type: BulletinBlockType): CanvasElement { /* moved verbatim from BulletinComposer.tsx:9-11 */ }

export function BlockEditor({ block, onChange, onRemove }: { block: CanvasElement; onChange: (b: CanvasElement) => void; onRemove: () => void }) {
  /* moved verbatim from BulletinComposer.tsx:148+ */
}
```

Note `BulletinComposer.tsx:7` declares a **local duplicate** `type BlockType = 'poll' | 'rating' | 'shortanswer'`, which is exactly `BulletinBlockType` from `@/lib/bulletin` (bulletin.ts:4-5). Use the canonical `BulletinBlockType` in the extracted module and **delete the local alias** — one source of truth for the block-type union.

In `BulletinComposer.tsx`, delete `makeBlock`, `BlockEditor`, and the `BlockType` alias, then import:

```ts
import { makeBlock, BlockEditor } from './BlockEditor'
```

Its three `makeBlock('poll'|'rating'|'shortanswer')` call sites (lines 105-107) are unchanged — the string literals still satisfy `BulletinBlockType`.

**This is a pure move — no behaviour change.** Bulletin's own tests (`BulletinComposer.test.tsx`) must stay green and are the proof.

- [ ] **Step 5: Add the picker to the hub composer**

In `src/components/hub/HubPostComposer.tsx`, add block state and the three picker buttons, mirroring `BulletinComposer.tsx:99-110`:

```tsx
import type { CanvasElement } from '@/lib/types/canvas'
import { makeBlock, BlockEditor } from '@/components/bulletin/BlockEditor'
import { BarChart3, Star, MessageSquareText } from 'lucide-react'

  const [block, setBlock] = useState<CanvasElement | null>(null)
  const [revealAfterAnswer, setReveal] = useState(false)
  const [liveTally, setLive] = useState(true)
```

Send them in the POST body (currently `body: JSON.stringify({ text, imageUrl })` at line 16):

```tsx
        body: JSON.stringify({ text, imageUrl, block, settings: { revealAfterAnswer, liveTally } }),
```

Gate the submit on a block being enough on its own (currently `if (!text.trim() && !imageUrl) return` at line 10, and the `disabled` at line 36):

```tsx
    if (!text.trim() && !imageUrl && !block) return
```
```tsx
          disabled={busy || (!text.trim() && !imageUrl && !block)}
```

Render the editor and the picker, and clear `block` on success alongside the existing resets:

```tsx
      {block && <BlockEditor block={block} onChange={setBlock} onRemove={() => setBlock(null)} />}
      {!block && (
        <div className="flex items-center gap-1">
          <button type="button" title="Poll" onClick={() => setBlock(makeBlock('poll'))}><BarChart3 className="h-4 w-4" /></button>
          <button type="button" title="Rating" onClick={() => setBlock(makeBlock('rating'))}><Star className="h-4 w-4" /></button>
          <button type="button" title="Question" onClick={() => setBlock(makeBlock('shortanswer'))}><MessageSquareText className="h-4 w-4" /></button>
        </div>
      )}
```

One block max, matching the existing "v1 UI allows at most one" rule.

- [ ] **Step 6: Run the tests to verify they pass**

```bash
cd "C:/Users/whirl/pages-mvp/.claude/worktrees/hub-community" && set -a && . ./.env && set +a && export DATABASE_URL="postgresql://pages:pages@127.0.0.1:5434/pages" && pnpm test && pnpm exec tsc --noEmit
```
Expected: PASS — full suite green (including the untouched `BulletinComposer.test.tsx`, which proves the extraction was behaviour-neutral), tsc clean.

- [ ] **Step 7: Commit**

```bash
git add src/components/bulletin src/components/hub "src/app/api/hubs/[id]/posts/route.ts" "src/app/api/hubs/[id]/posts/route.test.ts"
git commit -m "feat(community): hub composer block picker + accept blocks on post create

Extracts makeBlock/BlockEditor from BulletinComposer into a shared
module so both composers use one implementation."
```

---

### Task 10: Full verification + browser smoke

**Files:** none (verification only).

- [ ] **Step 1: Gate on the three checks**

```bash
cd "C:/Users/whirl/pages-mvp/.claude/worktrees/hub-community" && set -a && . ./.env && set +a && export DATABASE_URL="postgresql://pages:pages@127.0.0.1:5434/pages" && pnpm exec tsc --noEmit && pnpm test && pnpm exec next lint
```
Expected: tsc clean, suite green (505 baseline + new tests, 0 failures), lint clean.

**`next lint` is not optional** — `tsc` does not run ESLint, and a lint error has broken a prod deploy before. Watch for `react/no-unescaped-entities` (escape `'` in JSX) and `@next/next/no-html-link-for-pages`.

- [ ] **Step 2: Browser smoke**

Drive real Chrome per `[[browser-smoke-tooling]]`. **Use your own Chrome instance** — a concurrent agent shares the default one and tab indices reorder underneath you:

```bash
"C:/Program Files/Google/Chrome/Application/chrome.exe" --remote-debugging-port=9444 --user-data-dir="<scratchpad>/hub-chrome" --no-first-run about:blank &
export CHROME_WS_PORT=9444
```

**Never use `chrome-ws fill`** — it does not fire React's events, so forms submit blank silently. Set values via `eval` with the native setter, wrapped in an IIFE (`eval` reuses one JS context, so `const` redeclaration throws), and always confirm the value persisted before clicking — that doubles as the hydration probe:

```js
(()=>{const s=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;const e=document.querySelector('input[type=email]');s.call(e,'x@y.z');e.dispatchEvent(new Event('input',{bubbles:true}));return e.value;})()
```

Flow to verify (two accounts — owner + member):
1. Owner attaches a poll to a post → member sees it.
2. Member votes → vote persists, results render.
3. `revealAfterAnswer` respected: a non-responder sees no results; the responder does; the author always does.
4. Member's notification bell shows the owner's broadcast (`hub_post`).
5. Owner is notified of a member's post; a third member is not.
6. Commenting notifies the post author (`hub_comment`); self-comment notifies nobody.
7. Owner deletes the post → responses cascade away.

**Verify persistence via the API or a direct DB query, never by UI timing** — dev first-compile runs 20-110s and makes correct behaviour look broken. The dev log line (`POST /api/... <status> in <ms>`) is the decisive source of truth.

- [ ] **Step 3: Update the SDD ledger and memory**

Record the outcome in `.superpowers/sdd/progress.md` (gitignored) and update `[[community-hub]]` memory: C1 status, anything learned.

---

## Ship

C1 is two independently shippable milestones:
- **After Task 4** — notifications work, no migration required.
- **After Task 9** — polls/ratings/short-answers work in communities.

Open a PR against `main` per the project's usual rhythm. Note: a failed **Vercel preview** check is expected noise if the Neon branch quota is full — it does not affect prod (prod deploys from the PRIMARY branch on merge). A failed **CI** check is real.
