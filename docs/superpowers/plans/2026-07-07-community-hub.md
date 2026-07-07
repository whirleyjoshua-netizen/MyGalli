# Community Hub Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn any Hub into a "Community Hub" — a public audience can *join* it (a membership separate from following the owner), and the owner + collaborators *broadcast* text/image posts that members read and like.

**Architecture:** A `community` boolean toggles the layer on a Hub (free, reversible, non-destructive). Two new people-relations: `HubMember` (public joiners) and `HubPost` (broadcast posts) + `HubPostLike`. The public hub viewer gains a Community section (Join button + post feed); the owner console at `/hubs/[id]` gains Posts + Members management; the existing `hub` embed tile gains a Join affordance; the Gallery page gains a "My Communities" tab. Reuses the existing owner-gate route pattern, `getUser`, `rateLimit`, `createNotification`, and `BulletinPostCard` (via a new `basePath` prop). Interactive poll/rating blocks are deferred to Phase 2 (schema columns added now).

**Tech Stack:** Next.js 15 App Router (RSC + route handlers), React 19, TypeScript, Prisma + Postgres, Vitest.

## Global Constraints

- **Sequencing:** this feature shares the `Hub` model, `/api/hubs/**` routes, and the public hub viewer with the in-flight Hub Access Control work. **Implement only after that work has merged.** Rebase onto the latest `main` before starting.
- **Additive migration only** (one `ADD COLUMN` with default + three new tables). **Use a migration timestamp LATER than the newest `prisma/migrations/` folder at build time.** As of writing the newest is `20260708000000_add_hub_access`; run `ls prisma/migrations | sort | tail -1` and pick a later one (e.g. `20260709000000_add_community_hub` — bump if a later one exists).
- **Free feature:** enabling community, joining, reading, liking are all free. Never add an `isPro` check to community enable/join/like/post. (The only Pro gates on Hub remain the pre-existing collaborator + privacy ones — untouched.)
- **Never select `passcodeHash`** into any client payload (existing hub rule; the member/post work doesn't touch it but the viewer loader already redacts it).
- **Member payloads** expose only `{ userId, username, name, avatar }` — never email or internal fields.
- **Prisma migrations are non-interactive here:** never `prisma migrate dev`. Generate SQL by hand (this plan gives it), place it in `prisma/migrations/<ts>_add_community_hub/migration.sql`, then `npx prisma generate`.
- **Gate each task:** `npx tsc --noEmit` (exit 0) AND `npx vitest run` (green; if the full suite is killed by the environment, run the task's own test files + tsc and note it). Windows + Git Bash; FOREGROUND; do NOT run `pnpm build`. Set `export DATABASE_URL="postgresql://pages:pages@127.0.0.1:5434/pages"` before any Prisma/db command.
- **git add only the task's files;** never `-A`; never stage `Documents/`, `Images/`, `g1t.json`, `nul`, `test-output.txt`, `.claude/settings.local.json`, `scratchpad-*`.
- **Re-id hazard (from `live-feed`):** `HubMember`/`HubPost` are keyed to `hubId`. Never seed a community hub into a template/kit without regenerating hub ids on copy.

## File Structure

- `prisma/schema.prisma` — add `community` + relations to `Hub`/`User`; add `HubMember`, `HubPost`, `HubPostLike` models. (Task 1)
- `prisma/migrations/<ts>_add_community_hub/migration.sql` — additive SQL. (Task 1)
- `src/lib/community.ts` + `src/lib/community.test.ts` — pure helpers: `canPostToHub`, membership/DTO shaping. (Task 2)
- `src/app/api/hubs/[id]/route.ts` — extend PATCH to accept `community`; extend GET/create to expose it. (Task 3)
- `src/app/api/hubs/route.ts` — accept `community` on create. (Task 3)
- `src/app/api/hubs/[id]/join/route.ts` — POST join / DELETE leave (rate-limited). (Task 4)
- `src/app/api/hubs/[id]/members/route.ts` — GET list (owner) / DELETE remove (owner). (Task 5)
- `src/app/api/hubs/[id]/posts/route.ts` — GET feed / POST create (owner+collaborator). (Task 6)
- `src/app/api/hubs/[id]/posts/[postId]/route.ts` — DELETE (author/owner). (Task 6)
- `src/app/api/hubs/[id]/posts/[postId]/like/route.ts` — POST/DELETE like. (Task 7)
- `src/components/bulletin/BulletinPostCard.tsx` — add optional `basePath` prop (default `/api/bulletin`). (Task 7)
- `src/components/hub/HubPostComposer.tsx` — text+image composer. (Task 8)
- `src/components/hub/HubCommunitySection.tsx` — public Join button + post feed. (Task 8)
- `src/app/[username]/hub/[slug]/page.tsx` + `src/components/hub/HubViewer.tsx` — render the community section. (Task 8)
- `src/components/hub/HubCommunityConsole.tsx` + wiring into `/hubs/[id]` — owner Posts + Members tabs. (Task 9)
- `src/components/elements/PublicHubElement.tsx` — Join affordance + member count on the embed tile. (Task 10)
- `src/components/dashboard/PagesTree.tsx` — `UsersRound` icon when `community`. (Task 10)
- `src/app/(dashboard)/my-pages/page.tsx` — "Communities" tab. (Task 11)

---

## Task 1: Schema + migration

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<LATER_TS>_add_community_hub/migration.sql`

**Interfaces:**
- Produces: `Hub.community`, `db.hubMember`, `db.hubPost`, `db.hubPostLike`.

- [ ] **Step 1: Add fields to `model Hub`** — inside the existing `model Hub` block, add `community` after `coverImage` and the two relations after `collaborators`:

```prisma
  coverImage  String?
  community   Boolean     @default(false)
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt
  folders     HubFolder[]
  items       HubItem[]
  collaborators HubCollaborator[]
  members     HubMember[]
  posts       HubPost[]
```

- [ ] **Step 2: Add relations to `model User`** — after the existing `hubCollaborations` line:

```prisma
  hubs Hub[] @relation("UserHubs")
  hubCollaborations HubCollaborator[] @relation("UserHubCollaborations")
  hubMemberships HubMember[] @relation("UserHubMemberships")
  hubPosts HubPost[] @relation("HubPostAuthor")
  hubPostLikes HubPostLike[]
```

- [ ] **Step 3: Add the three models** — append after `model HubCollaborator`:

```prisma
model HubMember {
  id        String   @id @default(cuid())
  hubId     String
  hub       Hub      @relation(fields: [hubId], references: [id], onDelete: Cascade)
  userId    String
  user      User     @relation("UserHubMemberships", fields: [userId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())
  @@unique([hubId, userId])
  @@index([hubId])
  @@index([userId])
}

model HubPost {
  id        String        @id @default(cuid())
  hubId     String
  hub       Hub           @relation(fields: [hubId], references: [id], onDelete: Cascade)
  authorId  String
  author    User          @relation("HubPostAuthor", fields: [authorId], references: [id], onDelete: Cascade)
  text      String?
  imageUrl  String?
  blocks    Json          @default("[]")
  settings  Json          @default("{}")
  createdAt DateTime      @default(now())
  likes     HubPostLike[]
  @@index([hubId, createdAt])
}

model HubPostLike {
  id        String   @id @default(cuid())
  postId    String
  post      HubPost  @relation(fields: [postId], references: [id], onDelete: Cascade)
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())
  @@unique([postId, userId])
  @@index([postId])
}
```

- [ ] **Step 4: Create the migration** — run `ls prisma/migrations | sort | tail -1`; pick a later timestamp; create `prisma/migrations/<ts>_add_community_hub/migration.sql`:

```sql
-- AlterTable
ALTER TABLE "Hub" ADD COLUMN "community" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "HubMember" (
    "id" TEXT NOT NULL,
    "hubId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HubMember_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "HubMember_hubId_userId_key" ON "HubMember"("hubId", "userId");
CREATE INDEX "HubMember_hubId_idx" ON "HubMember"("hubId");
CREATE INDEX "HubMember_userId_idx" ON "HubMember"("userId");
ALTER TABLE "HubMember" ADD CONSTRAINT "HubMember_hubId_fkey" FOREIGN KEY ("hubId") REFERENCES "Hub"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HubMember" ADD CONSTRAINT "HubMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "HubPost" (
    "id" TEXT NOT NULL,
    "hubId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "text" TEXT,
    "imageUrl" TEXT,
    "blocks" JSONB NOT NULL DEFAULT '[]',
    "settings" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HubPost_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "HubPost_hubId_createdAt_idx" ON "HubPost"("hubId", "createdAt");
ALTER TABLE "HubPost" ADD CONSTRAINT "HubPost_hubId_fkey" FOREIGN KEY ("hubId") REFERENCES "Hub"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HubPost" ADD CONSTRAINT "HubPost_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "HubPostLike" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HubPostLike_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "HubPostLike_postId_userId_key" ON "HubPostLike"("postId", "userId");
CREATE INDEX "HubPostLike_postId_idx" ON "HubPostLike"("postId");
ALTER TABLE "HubPostLike" ADD CONSTRAINT "HubPostLike_postId_fkey" FOREIGN KEY ("postId") REFERENCES "HubPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HubPostLike" ADD CONSTRAINT "HubPostLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

- [ ] **Step 5: Generate + validate** — `export DATABASE_URL="postgresql://pages:pages@127.0.0.1:5434/pages"; npx prisma generate` (retry once on Windows EPERM); `npx prisma validate` → "The schema is valid". Apply locally: `npx prisma migrate deploy`.

- [ ] **Step 6: Gate + commit** — `npx tsc --noEmit`; `npx vitest run`.

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(community): schema — Hub.community + HubMember/HubPost/HubPostLike"
```

---

## Task 2: Pure helpers

**Files:**
- Create: `src/lib/community.ts`
- Test: `src/lib/community.test.ts`

**Interfaces:**
- Produces:
  - `canPostToHub(userId: string, hub: { userId: string }, collaboratorIds: string[]): boolean`
  - `type MemberDTO = { userId: string; username: string; name: string | null; avatar: string | null }`
  - `toMemberDTO(row: { userId: string; user: { username: string; name: string | null; avatar: string | null } }): MemberDTO`

- [ ] **Step 1: Write the failing test** — `src/lib/community.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { canPostToHub, toMemberDTO } from './community'

describe('canPostToHub', () => {
  const hub = { userId: 'owner1' }
  it('owner can post', () => {
    expect(canPostToHub('owner1', hub, [])).toBe(true)
  })
  it('collaborator can post', () => {
    expect(canPostToHub('col1', hub, ['col1', 'col2'])).toBe(true)
  })
  it('a random member cannot post', () => {
    expect(canPostToHub('rando', hub, ['col1'])).toBe(false)
  })
})

describe('toMemberDTO', () => {
  it('exposes only public fields', () => {
    const row = { userId: 'u1', user: { username: 'ann', name: 'Ann', avatar: null } }
    expect(toMemberDTO(row)).toEqual({ userId: 'u1', username: 'ann', name: 'Ann', avatar: null })
  })
})
```

- [ ] **Step 2: Run — FAIL.** `npx vitest run src/lib/community.test.ts` → "Cannot find module './community'".

- [ ] **Step 3: Implement `src/lib/community.ts`:**

```ts
export type MemberDTO = {
  userId: string
  username: string
  name: string | null
  avatar: string | null
}

export function canPostToHub(
  userId: string,
  hub: { userId: string },
  collaboratorIds: string[],
): boolean {
  return userId === hub.userId || collaboratorIds.includes(userId)
}

export function toMemberDTO(row: {
  userId: string
  user: { username: string; name: string | null; avatar: string | null }
}): MemberDTO {
  return {
    userId: row.userId,
    username: row.user.username,
    name: row.user.name,
    avatar: row.user.avatar,
  }
}
```

- [ ] **Step 4: Run — PASS.** `npx vitest run src/lib/community.test.ts`.

- [ ] **Step 5: Gate + commit** — `npx tsc --noEmit`; `npx vitest run`.

```bash
git add src/lib/community.ts src/lib/community.test.ts
git commit -m "feat(community): pure helpers — canPostToHub + toMemberDTO"
```

---

## Task 3: Enable/disable community on a hub (PATCH + GET + create)

**Files:**
- Modify: `src/app/api/hubs/[id]/route.ts` (PATCH accepts `community`; GET already returns `r.hub` which now includes it)
- Modify: `src/app/api/hubs/route.ts` (create accepts `community`)

**Interfaces:**
- Consumes: `ownHub` (existing in the route file), `db.hub`.
- Produces: `PATCH /api/hubs/[id]` accepting `{ community?: boolean }`; `POST /api/hubs` accepting `{ community?: boolean }`.

- [ ] **Step 1: Extend the PATCH handler** in `src/app/api/hubs/[id]/route.ts` — inside `PATCH`, after the existing `coverImage` line and before `const hub = await db.hub.update(...)`:

```ts
  if (typeof body.coverImage === 'string') data.coverImage = body.coverImage
  if (typeof body.community === 'boolean') data.community = body.community
  const hub = await db.hub.update({ where: { id }, data })
```

(No `isPro` check — community is free. Toggling `community:false` is non-destructive: `HubMember`/`HubPost` rows are untouched by this update.)

- [ ] **Step 2: Accept `community` on create** in `src/app/api/hubs/route.ts` — in the POST handler where the hub is created from `{ displayId, title }`, add `community` to the create data:

```ts
  const hub = await db.hub.create({
    data: {
      userId: me.id,
      displayId: typeof body.displayId === 'string' ? body.displayId : null,
      title,
      slug,
      community: body.community === true,
    },
  })
```

(Match the surrounding style; keep the existing slug/title logic. `community` defaults false when omitted.)

- [ ] **Step 3: Manual verify (no unit test — thin CRUD).** With the dev server + a logged-in cookie:

```bash
# toggle on (replace HUB_ID and the JWT cookie)
curl -s -X PATCH "http://127.0.0.1:3000/api/hubs/HUB_ID" \
  -H "Content-Type: application/json" -H "Cookie: galli-auth=JWT" \
  -d '{"community":true}' | grep -o '"community":true'
```

Expected: `"community":true`.

- [ ] **Step 4: Gate + commit** — `npx tsc --noEmit`; `npx vitest run`.

```bash
git add "src/app/api/hubs/[id]/route.ts" "src/app/api/hubs/route.ts"
git commit -m "feat(community): PATCH/create accept community toggle (free)"
```

---

## Task 4: Join / leave API

**Files:**
- Create: `src/app/api/hubs/[id]/join/route.ts`

**Interfaces:**
- Consumes: `getUser`, `db.hub`, `db.hubMember`, `rateLimit`, `createNotification`.
- Produces: `POST /api/hubs/[id]/join` → `{ joined: true, memberCount: number }`; `DELETE` → `{ joined: false, memberCount: number }`.

- [ ] **Step 1: Implement `src/app/api/hubs/[id]/join/route.ts`:**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'
import { rateLimit } from '@/lib/rate-limit'
import { createNotification } from '@/lib/notifications'

async function loadCommunityHub(id: string) {
  const hub = await db.hub.findUnique({ where: { id }, select: { id: true, userId: true, title: true, community: true } })
  if (!hub || !hub.community) return null
  return hub
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const limited = await rateLimit(request, { limit: 20, windowMs: 60_000, prefix: 'hubjoin' })
  if (limited) return limited
  const { id } = await params
  const me = await getUser(request)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const hub = await loadCommunityHub(id)
  if (!hub) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (hub.userId === me.id) return NextResponse.json({ error: 'You own this hub' }, { status: 400 })

  const existing = await db.hubMember.findUnique({ where: { hubId_userId: { hubId: id, userId: me.id } }, select: { id: true } })
  if (!existing) {
    await db.hubMember.create({ data: { hubId: id, userId: me.id } })
    await createNotification({
      userId: hub.userId,
      type: 'hub_member',
      actor: { id: me.id, name: me.name || me.username, avatar: me.avatar },
      entityUrl: `/hubs/${id}`,
      contextText: hub.title,
    })
  }
  const memberCount = await db.hubMember.count({ where: { hubId: id } })
  return NextResponse.json({ joined: true, memberCount })
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const limited = await rateLimit(request, { limit: 20, windowMs: 60_000, prefix: 'hubjoin' })
  if (limited) return limited
  const { id } = await params
  const me = await getUser(request)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  await db.hubMember.deleteMany({ where: { hubId: id, userId: me.id } })
  const memberCount = await db.hubMember.count({ where: { hubId: id } })
  return NextResponse.json({ joined: false, memberCount })
}
```

(`'hub_member'` is a free-form `type` string; `createNotification` stores it and the client bell renders it via `formatNotification`'s default branch. Optionally add a one-line case to `notifications-format.ts` reading "X joined your community" — see Task 12.)

- [ ] **Step 2: Manual verify** — POST join returns `{"joined":true,...}`; POST again is idempotent (still count 1); DELETE returns `{"joined":false,...}`. Joining a non-community hub → 404; owner joining own hub → 400.

- [ ] **Step 3: Gate + commit** — `npx tsc --noEmit`; `npx vitest run`.

```bash
git add "src/app/api/hubs/[id]/join"
git commit -m "feat(community): join/leave API (rate-limited, notifies owner)"
```

---

## Task 5: Members list + remove (owner)

**Files:**
- Create: `src/app/api/hubs/[id]/members/route.ts`

**Interfaces:**
- Consumes: `getUser`, `db.hub`, `db.hubMember`, `toMemberDTO` (Task 2).
- Produces: `GET /api/hubs/[id]/members` (owner) → `{ members: MemberDTO[], count: number }`; `DELETE` (owner, body `{ userId }`) → `{ ok: true }`.

- [ ] **Step 1: Implement `src/app/api/hubs/[id]/members/route.ts`:**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'
import { toMemberDTO } from '@/lib/community'

async function ownHub(request: NextRequest, id: string) {
  const me = await getUser(request)
  if (!me) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const hub = await db.hub.findUnique({ where: { id } })
  if (!hub || hub.userId !== me.id) return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) }
  return { me, hub }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const r = await ownHub(request, id)
  if ('error' in r) return r.error
  const rows = await db.hubMember.findMany({
    where: { hubId: id },
    orderBy: { createdAt: 'desc' },
    select: { userId: true, user: { select: { username: true, name: true, avatar: true } } },
  })
  return NextResponse.json({ members: rows.map(toMemberDTO), count: rows.length })
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const r = await ownHub(request, id)
  if ('error' in r) return r.error
  const body = await request.json().catch(() => ({}))
  if (typeof body.userId !== 'string') return NextResponse.json({ error: 'userId required' }, { status: 400 })
  await db.hubMember.deleteMany({ where: { hubId: id, userId: body.userId } })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2: Manual verify** — GET as owner returns `{ members: [...], count }` with only `{userId,username,name,avatar}`; GET as non-owner → 404; DELETE `{userId}` removes a member.

- [ ] **Step 3: Gate + commit** — `npx tsc --noEmit`; `npx vitest run`.

```bash
git add "src/app/api/hubs/[id]/members"
git commit -m "feat(community): owner members list + remove"
```

---

## Task 6: Posts feed + create + delete

**Files:**
- Create: `src/app/api/hubs/[id]/posts/route.ts` (GET feed, POST create)
- Create: `src/app/api/hubs/[id]/posts/[postId]/route.ts` (DELETE)

**Interfaces:**
- Consumes: `getUser`, `db.hub`, `db.hubCollaborator`, `db.hubPost`, `db.hubPostLike`, `canPostToHub` (Task 2).
- Produces:
  - `type FeedHubPost = { id: string; author: { id: string; name: string | null; username: string; avatar: string | null }; text: string | null; imageUrl: string | null; block: null; settings: { revealAfterAnswer: boolean; liveTally: boolean }; createdAt: string; likeCount: number; likedByMe: boolean; myResponse: null; results: null }`
  - `GET /api/hubs/[id]/posts` → `{ posts: FeedHubPost[] }`; `POST` → `{ id }` (201); `DELETE .../[postId]` → `{ ok: true }`.

(The `FeedHubPost` shape deliberately matches `FeedPost` from `BulletinPostCard.tsx` so the card renders it directly — `block`/`myResponse`/`results` are null in v1.)

- [ ] **Step 1: Implement `src/app/api/hubs/[id]/posts/route.ts`:**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'
import { canPostToHub } from '@/lib/community'

async function collaboratorIds(hubId: string): Promise<string[]> {
  const rows = await db.hubCollaborator.findMany({ where: { hubId }, select: { userId: true } })
  return rows.map((r) => r.userId)
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const hub = await db.hub.findUnique({ where: { id }, select: { id: true, community: true } })
  if (!hub || !hub.community) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const me = await getUser(request)
  const posts = await db.hubPost.findMany({
    where: { hubId: id },
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: {
      author: { select: { id: true, name: true, username: true, avatar: true } },
      likes: { select: { userId: true } },
    },
  })
  const feed = posts.map((p) => ({
    id: p.id,
    author: p.author,
    text: p.text,
    imageUrl: p.imageUrl,
    block: null,
    settings: { revealAfterAnswer: false, liveTally: false },
    createdAt: p.createdAt.toISOString(),
    likeCount: p.likes.length,
    likedByMe: me ? p.likes.some((l) => l.userId === me.id) : false,
    myResponse: null,
    results: null,
  }))
  return NextResponse.json({ posts: feed })
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const me = await getUser(request)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const hub = await db.hub.findUnique({ where: { id }, select: { id: true, userId: true, community: true } })
  if (!hub || !hub.community) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!canPostToHub(me.id, hub, await collaboratorIds(id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const body = await request.json().catch(() => ({}))
  const text = typeof body.text === 'string' ? body.text.trim().slice(0, 5000) : ''
  const imageUrl = typeof body.imageUrl === 'string' && body.imageUrl ? body.imageUrl : null
  if (!text && !imageUrl) return NextResponse.json({ error: 'Empty post' }, { status: 400 })
  const post = await db.hubPost.create({ data: { hubId: id, authorId: me.id, text: text || null, imageUrl } })
  return NextResponse.json({ id: post.id }, { status: 201 })
}
```

- [ ] **Step 2: Implement `src/app/api/hubs/[id]/posts/[postId]/route.ts`:**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string; postId: string }> }) {
  const { id, postId } = await params
  const me = await getUser(request)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const post = await db.hubPost.findFirst({ where: { id: postId, hubId: id }, select: { authorId: true, hub: { select: { userId: true } } } })
  if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (post.authorId !== me.id && post.hub.userId !== me.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  await db.hubPost.delete({ where: { id: postId } })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 3: Manual verify** — POST as owner → 201 `{id}`; GET → the post in `posts[0]` with `likeCount:0, likedByMe:false, block:null`; POST as a non-owner/non-collaborator → 403; DELETE as author → ok, as a stranger → 403.

- [ ] **Step 4: Gate + commit** — `npx tsc --noEmit`; `npx vitest run`.

```bash
git add "src/app/api/hubs/[id]/posts"
git commit -m "feat(community): broadcast posts feed + create + delete"
```

---

## Task 7: Like API + reusable post card

**Files:**
- Create: `src/app/api/hubs/[id]/posts/[postId]/like/route.ts`
- Modify: `src/components/bulletin/BulletinPostCard.tsx` (add optional `basePath` prop)

**Interfaces:**
- Consumes: `getUser`, `db.hubPost`, `db.hubPostLike`.
- Produces: `POST /api/hubs/[id]/posts/[postId]/like` and `DELETE` → `{ likeCount: number, likedByMe: boolean }` (matches the bulletin like response shape). `BulletinPostCard` gains `basePath?: string` (default `'/api/bulletin'`).

- [ ] **Step 1: Implement `src/app/api/hubs/[id]/posts/[postId]/like/route.ts`:**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'

async function likeState(postId: string, userId: string) {
  const [likeCount, mine] = await Promise.all([
    db.hubPostLike.count({ where: { postId } }),
    db.hubPostLike.findUnique({ where: { postId_userId: { postId, userId } }, select: { id: true } }),
  ])
  return { likeCount, likedByMe: !!mine }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string; postId: string }> }) {
  const { id, postId } = await params
  const me = await getUser(request)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const post = await db.hubPost.findFirst({ where: { id: postId, hubId: id }, select: { id: true } })
  if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  await db.hubPostLike.upsert({
    where: { postId_userId: { postId, userId: me.id } },
    create: { postId, userId: me.id },
    update: {},
  })
  return NextResponse.json(await likeState(postId, me.id))
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string; postId: string }> }) {
  const { id, postId } = await params
  const me = await getUser(request)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  await db.hubPostLike.deleteMany({ where: { postId, userId: me.id } })
  return NextResponse.json(await likeState(postId, me.id))
}
```

- [ ] **Step 2: Add `basePath` to `BulletinPostCard.tsx`** — widen the props and default it, then use it for the like + delete fetch URLs. Change the props destructure (around line 24) from `{ post, currentUserId, onDeleted }` to include `basePath`:

```tsx
export function BulletinPostCard({
  post,
  currentUserId,
  onDeleted,
  basePath = '/api/bulletin',
}: {
  post: FeedPost
  currentUserId?: string
  onDeleted: (id: string) => void
  basePath?: string
}) {
```

Then replace the hardcoded like/delete endpoints in this file: change `fetch(\`/api/bulletin/${post.id}/like\`, ...)` → `fetch(\`${basePath}/${post.id}/like\`, ...)` and `fetch(\`/api/bulletin/${post.id}\`, { method: 'DELETE' })` → `fetch(\`${basePath}/${post.id}\`, { method: 'DELETE' })`. (Grep this file for `/api/bulletin` and swap each to `${basePath}`. Do NOT touch `BulletinBlock` — v1 posts have `block: null`, so its `/api/bulletin/.../respond` path is never hit.)

- [ ] **Step 3: Manual verify** — POST like → `{likeCount:1,likedByMe:true}`; DELETE → `{likeCount:0,likedByMe:false}`. Existing bulletin cards still like/delete (default `basePath` unchanged).

- [ ] **Step 4: Gate + commit** — `npx tsc --noEmit`; `npx vitest run` (bulletin card tests must stay green).

```bash
git add "src/app/api/hubs/[id]/posts/[postId]/like" src/components/bulletin/BulletinPostCard.tsx
git commit -m "feat(community): post like API + basePath prop on BulletinPostCard"
```

---

## Task 8: Public viewer — Join button + post feed

**Files:**
- Create: `src/components/hub/HubCommunitySection.tsx`
- Create: `src/components/hub/HubPostComposer.tsx`
- Modify: `src/app/[username]/hub/[slug]/page.tsx` (pass community data)
- Modify: `src/components/hub/HubViewer.tsx` (render the section)

**Interfaces:**
- Consumes: `BulletinPostCard` + its `FeedPost` type, `FeedHubPost` shape (Task 6), the join/posts/like APIs.
- Produces: `<HubCommunitySection hubId username slug isCommunity initialJoined memberCount viewer currentUserId />`.

- [ ] **Step 1: `HubPostComposer.tsx`** (owner/collaborator author box; used here and in the console):

```tsx
'use client'
import { useState } from 'react'

export function HubPostComposer({ hubId, onPosted }: { hubId: string; onPosted: () => void }) {
  const [text, setText] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit() {
    if (!text.trim() && !imageUrl) return
    setBusy(true)
    try {
      const res = await fetch(`/api/hubs/${hubId}/posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, imageUrl }),
      })
      if (res.ok) { setText(''); setImageUrl(''); onPosted() }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Post an update to your community…"
        className="w-full resize-none bg-transparent text-sm outline-none"
        rows={3}
      />
      <div className="mt-2 flex items-center justify-end">
        <button
          onClick={submit}
          disabled={busy || (!text.trim() && !imageUrl)}
          className="rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background disabled:opacity-50"
        >
          Post
        </button>
      </div>
    </div>
  )
}
```

(Image upload can reuse the existing `/api/upload` flow later; v1 keeps the text box as the primary path. Keep `imageUrl` wired so a future uploader drops in.)

- [ ] **Step 2: `HubCommunitySection.tsx`** — client component: Join/Joined button, member count, composer (if owner/collaborator), and the feed via `BulletinPostCard` with `basePath`:

```tsx
'use client'
import { useEffect, useState } from 'react'
import { UsersRound } from 'lucide-react'
import { BulletinPostCard, type FeedPost } from '@/components/bulletin/BulletinPostCard'
import { HubPostComposer } from './HubPostComposer'

export function HubCommunitySection({
  hubId,
  initialJoined,
  memberCount: initialCount,
  canPost,
  currentUserId,
}: {
  hubId: string
  initialJoined: boolean
  memberCount: number
  canPost: boolean
  currentUserId?: string
}) {
  const [joined, setJoined] = useState(initialJoined)
  const [count, setCount] = useState(initialCount)
  const [posts, setPosts] = useState<FeedPost[]>([])

  async function load() {
    const res = await fetch(`/api/hubs/${hubId}/posts`)
    if (res.ok) setPosts((await res.json()).posts)
  }
  useEffect(() => { load() }, [hubId])

  async function toggleJoin() {
    const res = await fetch(`/api/hubs/${hubId}/join`, { method: joined ? 'DELETE' : 'POST' })
    if (res.status === 401) { window.location.href = '/login'; return }
    if (res.ok) { const d = await res.json(); setJoined(d.joined); setCount(d.memberCount) }
  }

  return (
    <section className="mt-8">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <UsersRound className="h-5 w-5 text-primary" /> Community
          <span className="text-sm font-normal text-muted-foreground">({count} member{count === 1 ? '' : 's'})</span>
        </h2>
        {!canPost && (
          <button
            onClick={toggleJoin}
            className={`rounded-full px-4 py-2 text-sm font-semibold ${joined ? 'border border-border text-foreground' : 'bg-foreground text-background'}`}
          >
            {joined ? 'Joined' : 'Join'}
          </button>
        )}
      </div>
      {canPost && <div className="mb-4"><HubPostComposer hubId={hubId} onPosted={load} /></div>}
      <div className="space-y-4">
        {posts.length === 0 ? (
          <p className="text-sm text-muted-foreground">No posts yet.</p>
        ) : (
          posts.map((p) => (
            <BulletinPostCard key={p.id} post={p} currentUserId={currentUserId} basePath={`/api/hubs/${hubId}/posts`} onDeleted={(delId) => setPosts((cur) => cur.filter((x) => x.id !== delId))} />
          ))
        )}
      </div>
    </section>
  )
}
```

- [ ] **Step 3: Load community state in the viewer loader** — in `src/app/[username]/hub/[slug]/page.tsx`, after `viewer` is resolved (the existing block computing `viewer`), add:

```ts
let communityProps: { isCommunity: boolean; joined: boolean; memberCount: number; canPost: boolean } = {
  isCommunity: hub.community, joined: false, memberCount: 0, canPost: viewer === 'owner' || viewer === 'collaborator',
}
if (hub.community) {
  const [memberCount, mine] = await Promise.all([
    db.hubMember.count({ where: { hubId: hub.id } }),
    viewerUser ? db.hubMember.findUnique({ where: { hubId_userId: { hubId: hub.id, userId: viewerUser.id } }, select: { id: true } }) : Promise.resolve(null),
  ])
  communityProps = { ...communityProps, joined: !!mine, memberCount }
}
```

Then pass `community={communityProps}` and `currentUserId={viewerUser?.id}` into `<HubViewer .../>` (extend its props).

- [ ] **Step 4: Render in `HubViewer.tsx`** — add the props and, when `community.isCommunity`, render the section after the files/folders content:

```tsx
import { HubCommunitySection } from './HubCommunitySection'
// ...add to props: community?: { isCommunity: boolean; joined: boolean; memberCount: number; canPost: boolean }; currentUserId?: string
// ...at the end of the rendered output:
{community?.isCommunity && (
  <HubCommunitySection
    hubId={hubId}
    initialJoined={community.joined}
    memberCount={community.memberCount}
    canPost={community.canPost}
    currentUserId={currentUserId}
  />
)}
```

- [ ] **Step 5: Component test** — `src/components/hub/HubCommunitySection.test.tsx`: render with `initialJoined={false}`, mock `fetch` to return `{posts:[]}` for the feed load; assert the "Join" button appears and clicking it POSTs to `/api/hubs/<id>/join`. Mirror the mocking style in `src/components/bulletin/BulletinComposer.test.tsx`.

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { HubCommunitySection } from './HubCommunitySection'

beforeEach(() => {
  global.fetch = vi.fn(async (url: string, init?: RequestInit) => {
    if (String(url).endsWith('/posts')) return { ok: true, json: async () => ({ posts: [] }) } as Response
    return { ok: true, json: async () => ({ joined: true, memberCount: 1 }) } as Response
  }) as unknown as typeof fetch
})

describe('HubCommunitySection', () => {
  it('shows Join and posts to the join endpoint', async () => {
    render(<HubCommunitySection hubId="h1" initialJoined={false} memberCount={0} canPost={false} />)
    const btn = await screen.findByText('Join')
    fireEvent.click(btn)
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/hubs/h1/join', { method: 'POST' }))
  })
})
```

- [ ] **Step 6: Run the test — PASS.** `npx vitest run src/components/hub/HubCommunitySection.test.tsx`.

- [ ] **Step 7: Gate + commit** — `npx tsc --noEmit`; `npx vitest run`.

```bash
git add src/components/hub/HubCommunitySection.tsx src/components/hub/HubCommunitySection.test.tsx src/components/hub/HubPostComposer.tsx "src/app/[username]/hub/[slug]/page.tsx" src/components/hub/HubViewer.tsx
git commit -m "feat(community): public viewer Join button + broadcast feed"
```

---

## Task 9: Owner console — enable toggle + Posts + Members

**Files:**
- Create: `src/components/hub/HubCommunityConsole.tsx`
- Modify: the owner hub editor at `src/app/(dashboard)/hubs/[id]/page.tsx` (or the `HubEditor` component it renders) to mount the console + an enable toggle.

**Interfaces:**
- Consumes: `PATCH /api/hubs/[id]` (community toggle), `GET /api/hubs/[id]/members`, `DELETE .../members`, `HubPostComposer`, `GET /api/hubs/[id]/posts`, `DELETE .../posts/[postId]`.

- [ ] **Step 1: Read the existing owner hub editor** — open `src/app/(dashboard)/hubs/[id]/page.tsx` and `src/components/hub/HubEditor.tsx` to find where hub-level settings render (title/cover). Note whether `hub.community` is already fetched by the loader; if not, ensure the hub GET/`HubEditor` receives `community`.

- [ ] **Step 2: `HubCommunityConsole.tsx`** — an enable toggle + (when enabled) a composer, a Members list with remove, and a delete-post affordance:

```tsx
'use client'
import { useEffect, useState } from 'react'
import { HubPostComposer } from './HubPostComposer'

type Member = { userId: string; username: string; name: string | null; avatar: string | null }

export function HubCommunityConsole({ hubId, initialEnabled }: { hubId: string; initialEnabled: boolean }) {
  const [enabled, setEnabled] = useState(initialEnabled)
  const [members, setMembers] = useState<Member[]>([])
  const [posts, setPosts] = useState<{ id: string; text: string | null; createdAt: string }[]>([])

  async function refresh() {
    if (!enabled) return
    const [m, p] = await Promise.all([
      fetch(`/api/hubs/${hubId}/members`).then((r) => (r.ok ? r.json() : { members: [] })),
      fetch(`/api/hubs/${hubId}/posts`).then((r) => (r.ok ? r.json() : { posts: [] })),
    ])
    setMembers(m.members)
    setPosts(p.posts)
  }
  useEffect(() => { refresh() }, [enabled, hubId])

  async function toggle() {
    const next = !enabled
    const res = await fetch(`/api/hubs/${hubId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ community: next }),
    })
    if (res.ok) setEnabled(next)
  }
  async function removeMember(userId: string) {
    await fetch(`/api/hubs/${hubId}/members`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId }) })
    setMembers((cur) => cur.filter((x) => x.userId !== userId))
  }
  async function deletePost(id: string) {
    await fetch(`/api/hubs/${hubId}/posts/${id}`, { method: 'DELETE' })
    setPosts((cur) => cur.filter((x) => x.id !== id))
  }

  return (
    <div className="space-y-4">
      <label className="flex items-center gap-2 text-sm font-medium">
        <input type="checkbox" checked={enabled} onChange={toggle} />
        Community Hub — let people join and follow your posts
      </label>
      {enabled && (
        <>
          <HubPostComposer hubId={hubId} onPosted={refresh} />
          <div>
            <h4 className="mb-2 text-sm font-semibold">Posts ({posts.length})</h4>
            {posts.map((p) => (
              <div key={p.id} className="flex items-center justify-between border-b border-border py-2 text-sm">
                <span className="truncate">{p.text || '(image)'}</span>
                <button onClick={() => deletePost(p.id)} className="text-xs text-muted-foreground hover:text-red-500">Delete</button>
              </div>
            ))}
          </div>
          <div>
            <h4 className="mb-2 text-sm font-semibold">Members ({members.length})</h4>
            {members.map((m) => (
              <div key={m.userId} className="flex items-center justify-between py-1.5 text-sm">
                <span>@{m.username}</span>
                <button onClick={() => removeMember(m.userId)} className="text-xs text-muted-foreground hover:text-red-500">Remove</button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Mount it** — in the owner hub editor (`HubEditor.tsx` or the `/hubs/[id]` page), add a "Community" tab/section that renders `<HubCommunityConsole hubId={hub.id} initialEnabled={hub.community} />`. Follow the existing tab/section pattern in that file (do not restructure it).

- [ ] **Step 4: Manual verify** — toggle on → composer + members/posts appear; post an update → shows in Posts; toggle off → hidden; toggle back on → the same members/posts return (non-destructive).

- [ ] **Step 5: Gate + commit** — `npx tsc --noEmit`; `npx vitest run`.

```bash
git add src/components/hub/HubCommunityConsole.tsx src/components/hub/HubEditor.tsx "src/app/(dashboard)/hubs/[id]/page.tsx"
git commit -m "feat(community): owner console — enable toggle + posts + members"
```

---

## Task 10: Embed tile Join affordance + sidebar icon

**Files:**
- Modify: `src/components/elements/PublicHubElement.tsx`
- Modify: `src/components/dashboard/PagesTree.tsx`
- Modify: `src/app/api/hubs/route.ts` GET (the list feeding the sidebar) to include `community`

- [ ] **Step 1: Sidebar icon** — in `PagesTree.tsx`, import `UsersRound`, add `community` to the `HubRow` type, and pick the icon by it:

```tsx
import { FileText, Boxes, UsersRound } from 'lucide-react'
// HubRow: { id: string; title: string; displayId: string | null; community?: boolean }
// in the hub branch, replace <Boxes .../> with:
{hub.community
  ? <UsersRound className="w-3.5 h-3.5 shrink-0 text-primary" />
  : <Boxes className="w-3.5 h-3.5 shrink-0 text-primary" />}
```

Ensure the hubs list API (`GET /api/hubs`, `src/app/api/hubs/route.ts`) selects `community` so `hub.community` is populated.

- [ ] **Step 2: Embed tile** — in `PublicHubElement.tsx`, the tile denormalizes fields from the element. Since the element JSON doesn't carry live member counts, add a lightweight client fetch: when rendered, if the target hub is a community hub, show a small "Community" chip + Join button that POSTs to `/api/hubs/${hubId}/join`. Minimal version — fetch `/api/hubs/${element.hubId}/posts` HEAD is overkill; instead add a tiny `community` flag to the element at create/denormalize time is out of scope. Simplest correct approach: render a "View community →" label when `element.hubCommunity` is set. To populate it, extend the create-on-add in `PageEditor.tsx` (Task 10b) to store `hubCommunity: hub.community`. For an existing embed of a hub later toggled to community, the label updates next time the element is re-saved. Document this limitation inline.

```tsx
// PublicHubElement: after existing tile, if (element.hubCommunity) show a chip:
{element.hubCommunity && (
  <span className="mt-1 inline-flex items-center gap-1 text-xs text-primary">
    <UsersRound className="h-3 w-3" /> Community
  </span>
)}
```

(Add `hubCommunity?: boolean` to the `CanvasElement` type in `src/lib/types/canvas.ts`. The Join action itself lives on the community's own page — the embed tile links there via the existing `Link` to `/${hubUsername}/hub/${hubSlug}`, where `HubCommunitySection` provides the real Join button. This keeps the embed a preview + entry point, per spec.)

- [ ] **Step 3: Gate + commit** — `npx tsc --noEmit`; `npx vitest run`.

```bash
git add src/components/dashboard/PagesTree.tsx src/components/elements/PublicHubElement.tsx src/lib/types/canvas.ts "src/app/api/hubs/route.ts"
git commit -m "feat(community): sidebar UsersRound icon + embed community chip"
```

---

## Task 11: "My Communities" tab on the Gallery page

**Files:**
- Create: `src/app/api/communities/joined/route.ts` (GET communities the viewer has joined)
- Modify: `src/app/(dashboard)/my-pages/page.tsx` (add the tab)

**Interfaces:**
- Produces: `GET /api/communities/joined` → `{ communities: { id: string; title: string; username: string; slug: string; coverImage: string | null; latestPost: { text: string | null; createdAt: string } | null }[] }`.

- [ ] **Step 1: Implement `src/app/api/communities/joined/route.ts`:**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const me = await getUser(request)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const memberships = await db.hubMember.findMany({
    where: { userId: me.id, hub: { community: true } },
    orderBy: { createdAt: 'desc' },
    select: {
      hub: {
        select: {
          id: true, title: true, slug: true, coverImage: true,
          user: { select: { username: true } },
          posts: { orderBy: { createdAt: 'desc' }, take: 1, select: { text: true, createdAt: true } },
        },
      },
    },
  })
  const communities = memberships.map(({ hub }) => ({
    id: hub.id,
    title: hub.title,
    username: hub.user.username,
    slug: hub.slug,
    coverImage: hub.coverImage,
    latestPost: hub.posts[0] ? { text: hub.posts[0].text, createdAt: hub.posts[0].createdAt.toISOString() } : null,
  }))
  return NextResponse.json({ communities })
}
```

- [ ] **Step 2: Add the tab to `my-pages/page.tsx`** — widen the tab union, fetch joined communities, add the tab tuple, and render a list when active. Changes:

  a. State (line ~25): `const [activeTab, setActiveTab] = useState<'pages' | 'boards' | 'communities'>('pages')` and `const [communities, setCommunities] = useState<Community[]>([])`.

  b. In the initial `useEffect`, also `fetch('/api/communities/joined').then(r => r.ok ? r.json() : { communities: [] }).then(d => setCommunities(d.communities))`.

  c. Tab tuple (line ~169): add `['communities', 'Communities', communities.length]` to the array.

  d. Content: when `activeTab === 'communities'`, render a grid of cards linking to `/${c.username}/hub/${c.slug}`:

```tsx
{activeTab === 'communities' && (
  communities.length === 0 ? (
    <p className="text-sm text-muted-foreground">You haven't joined any communities yet.</p>
  ) : (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
      {communities.map((c) => (
        <a key={c.id} href={`/${c.username}/hub/${c.slug}`} className="rounded-xl border border-border bg-surface p-4 hover:shadow-soft transition">
          <div className="font-semibold">{c.title}</div>
          <div className="mt-1 text-xs text-muted-foreground truncate">{c.latestPost?.text || 'No posts yet'}</div>
        </a>
      ))}
    </div>
  )
)}
```

  Define the `Community` type near the top of the file: `type Community = { id: string; title: string; username: string; slug: string; coverImage: string | null; latestPost: { text: string | null; createdAt: string } | null }`. Guard the existing new-item button and `activeList` branches so they only apply to `'pages'`/`'boards'` (the communities tab has no "new" button).

- [ ] **Step 3: Manual verify** — join a community hub as user B; on B's Gallery page a "Communities (1)" tab lists it and links to the hub.

- [ ] **Step 4: Gate + commit** — `npx tsc --noEmit`; `npx vitest run`.

```bash
git add src/app/api/communities "src/app/(dashboard)/my-pages/page.tsx"
git commit -m "feat(community): My Communities tab on Gallery page"
```

---

## Task 12: Notification label (optional polish)

**Files:**
- Modify: `src/lib/notifications-format.ts`

- [ ] **Step 1: Add a `hub_member` case** — in `formatNotification`, add a branch so the bell reads naturally:

```ts
case 'hub_member':
  return { text: `${actorName} joined your community`, href: n.entityUrl || '/hubs' }
```

Match the exact return shape/other cases in that file (read them first). If `NotificationType` is a closed union, add `'hub_member'` to it.

- [ ] **Step 2: Gate + commit** — `npx tsc --noEmit`; `npx vitest run`.

```bash
git add src/lib/notifications-format.ts
git commit -m "feat(community): 'joined your community' notification label"
```

---

## Verification (after all tasks)

1. `npx tsc --noEmit` clean; `npx vitest run` green.
2. Manual (dev, two accounts A owner + B visitor):
   - As A: open a hub's owner console, toggle **Community** on, post an update.
   - Publish the hub's page. As B (logged in): visit `/{A}/hub/{slug}` → see the **Community** section, member count, and A's post; click **Join** → count increments, button shows **Joined**; **like** the post → count updates.
   - As B: Gallery page shows a **Communities** tab listing the hub; the sidebar hub icon for A shows `UsersRound`.
   - As A: owner console shows B in **Members**; **Remove** B → B disappears; A gets a "joined your community" bell notification when B joined.
   - Toggle Community **off** then **on** as A → B's membership + posts persist (non-destructive).
3. Prod: the additive `add_community_hub` migration applies via `prisma migrate deploy`.

## Self-review notes (checked against spec)

- **Coverage:** toggle+free (T3), members join/leave (T4), members list/remove (T5), broadcast posts (T6), likes + reusable card (T7), public viewer section (T8), owner console (T9), embed chip + sidebar icon (T10), My Communities tab (T11), notification label (T12). ✔
- **Reuse:** `BulletinPostCard` via `basePath`; existing `ownHub` route pattern; `getUser`/`rateLimit`/`createNotification`. ✔
- **Free:** no `isPro` anywhere in the community paths. ✔
- **Deferred correctly:** interactive poll/rating blocks (schema columns present, no wiring); notifications limited to the owner-on-join label + fan-out seam. ✔
- **Type consistency:** `FeedHubPost` matches `FeedPost` (block/myResponse/results null); `MemberDTO` used by T5/T11; `canPostToHub` signature stable T2→T6. ✔
- **Sequencing/hazards:** stated (land after access-control; re-id-on-instantiate; later migration timestamp). ✔
