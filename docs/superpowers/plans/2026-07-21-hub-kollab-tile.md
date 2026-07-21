# Hub Kollab Tile + Approval Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Kollab inline thumbnail grid with a branded tile whose two buttons — Drop content and See content — open upload and a tabbed viewer window, and make owner approval mandatory for every member drop.

**Architecture:** `HubDrop.hidden` (a boolean doing three jobs) is replaced by an explicit `status` of `'pending' | 'approved' | 'rejected'` plus review audit columns. The oversized `CommunityKollab.tsx` is split into a container plus four focused presentational components. Rejecting a drop destroys its Blob asset but keeps the row for audit.

**Tech Stack:** Next.js 15.5.19 App Router, React 19, TypeScript, Prisma/PostgreSQL, Vitest + Testing Library, Tailwind, `@vercel/blob`.

## Global Constraints

- **Worktree:** all work happens in `C:\Users\whirl\pages-mvp\.claude\worktrees\hub-kollab` on branch `feat/hub-kollab-tile` (based on `origin/main` `ef49519`). `cd` there first. Do NOT work in the main checkout — other sessions hold it.
- **Spec:** `docs/superpowers/specs/2026-07-21-hub-kollab-tile-design.md`.
- **Free, ungated.** Never import or call `isPro()` in this work.
- **Database commands** need the env override — the machine-level `DATABASE_URL` points at the wrong DB:
  `export DATABASE_URL="postgresql://pages:pages@127.0.0.1:5434/pages"` (use `127.0.0.1`, never `localhost`). Prisma CLI commands also need `DATABASE_URL_UNPOOLED` set alongside it.
- **Never run `prisma migrate dev`** — it is interactive and will hang. Hand-author `migration.sql` and run `prisma migrate deploy`. Do NOT use `migrate diff --from-url` — it is contaminated on this shared dev DB and emits spurious `DROP TABLE` statements for other branches' tables.
- **Verification before any completion claim:** `pnpm exec tsc --noEmit`, `pnpm exec next lint`, `pnpm test`. `tsc` does NOT run ESLint, and a lint error fails the production build — run both.
- **Never commit** `Documents/`, `Images/`, `g1t.json`, `nul`, `.claude/settings.local.json`.
- **Kollab brand colors are literal hex** — `#FF6B3D` → `#FF8A5B`. Do not add them to the Tailwind config; they are a one-off sub-brand accent, not a Galli token.
- **`hidden` stays written in sync with `status` for this release** (`hidden = status !== 'approved'`). It is no longer *read* anywhere after Task 4, but keeping the write makes a rollback to the previous deploy safe. A follow-up migration drops the column.
- Commit at the end of every task with the message given in that task's final step.

---

### Task 1: Schema + migration for drop status

**Files:**
- Modify: `prisma/schema.prisma:675-692` (the `HubDrop` model)
- Create: `prisma/migrations/20260721000000_hub_drop_status/migration.sql`

**Interfaces:**
- Consumes: nothing.
- Produces: `HubDrop.status String @default("pending")`, `HubDrop.reviewedAt DateTime?`, `HubDrop.reviewedById String?`, `HubDrop.assetDeleted Boolean @default(false)`, and index `@@index([hubId, status, createdAt])`.

- [ ] **Step 1: Add the columns to the Prisma model**

In `prisma/schema.prisma`, inside `model HubDrop`, add these four fields immediately after the existing `hidden Boolean @default(false)` line, and add the second `@@index` after the existing one:

```prisma
  hidden       Boolean  @default(false)   // DEPRECATED — kept in sync with `status` for rollback safety; dropped in a follow-up migration
  status       String   @default("pending")  // 'pending' | 'approved' | 'rejected'
  reviewedAt   DateTime?
  reviewedById String?                    // audit stamp, deliberately not a relation
  assetDeleted Boolean  @default(false)
```

and after `@@index([hubId, createdAt])`:

```prisma
  @@index([hubId, status, createdAt])
```

- [ ] **Step 2: Hand-author the migration**

Create `prisma/migrations/20260721000000_hub_drop_status/migration.sql` with exactly this content and nothing else:

```sql
-- Replace the overloaded `hidden` boolean with an explicit review status.
ALTER TABLE "HubDrop" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE "HubDrop" ADD COLUMN "reviewedAt" TIMESTAMP(3);
ALTER TABLE "HubDrop" ADD COLUMN "reviewedById" TEXT;
ALTER TABLE "HubDrop" ADD COLUMN "assetDeleted" BOOLEAN NOT NULL DEFAULT false;

-- Backfill: a hidden row was awaiting review; a visible row was effectively approved.
UPDATE "HubDrop" SET "status" = CASE WHEN "hidden" THEN 'pending' ELSE 'approved' END;

CREATE INDEX "HubDrop_hubId_status_createdAt_idx" ON "HubDrop"("hubId", "status", "createdAt");
```

Do NOT drop the `hidden` column here.

- [ ] **Step 3: Apply the migration to the dev DB**

Run:
```bash
export DATABASE_URL="postgresql://pages:pages@127.0.0.1:5434/pages"
export DATABASE_URL_UNPOOLED="$DATABASE_URL"
pnpm exec prisma migrate deploy
```
Expected: output includes `Applying migration '20260721000000_hub_drop_status'` and ends `All migrations have been successfully applied.`

If it fails with **P3009** naming a *different, pre-existing* failed migration (e.g. `add_booking`), that is a known local-only drift issue — resolve it with `pnpm exec prisma migrate resolve --rolled-back <name>` for that unrelated migration and re-run. Do NOT edit another branch's migration files.

- [ ] **Step 4: Regenerate the Prisma client**

Run: `pnpm exec prisma generate`
Expected: `Generated Prisma Client`. If it fails with `EPERM`, a running `next dev` is holding the engine DLL — stop the dev server and retry.

- [ ] **Step 5: Verify the backfill against the real DB**

Run:
```bash
pnpm exec prisma db execute --stdin <<'SQL'
SELECT "hidden", "status", count(*) FROM "HubDrop" GROUP BY 1,2 ORDER BY 1,2;
SQL
```
Expected: every row pairs `hidden=false` with `status='approved'` and `hidden=true` with `status='pending'`. There must be **no** row where `hidden=true` and `status='approved'`, or vice versa. If the table is empty, that is a pass — record it as such.

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260721000000_hub_drop_status/migration.sql
git commit -m "feat(hub): HubDrop review status + audit columns"
```

---

### Task 2: Pure status helpers in `hub-drops.ts`

**Files:**
- Modify: `src/lib/hub-drops.ts:53-87`
- Test: `src/lib/hub-drops.test.ts` (append to the existing file)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces:
  - `export type DropStatus = 'pending' | 'approved' | 'rejected'`
  - `export function nextStatusFor(isPrivileged: boolean): DropStatus`
  - `export function canReviewDrop(input: { isPrivileged: boolean }): boolean`
  - `DropDTO` gains `status: DropStatus` and **loses** `hidden`.
  - `toDropDTO(row)` now requires `status: string` on its row argument instead of `hidden: boolean`, and returns `url: ''` / `thumbnailUrl: null` when `status === 'rejected'`.

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/hub-drops.test.ts`:

```ts
import { nextStatusFor, canReviewDrop, toDropDTO } from './hub-drops'

const row = (over: Record<string, any> = {}) => ({
  id: 'd1', type: 'image', url: 'https://x.public.blob.vercel-storage.com/hub-drops/h1/a.jpg',
  thumbnailUrl: null, caption: null, mimeType: null, width: null, height: null,
  status: 'approved', createdAt: new Date('2026-07-21T00:00:00Z'),
  author: { id: 'u1', username: 'sam', name: null, avatar: null },
  ...over,
})

describe('nextStatusFor', () => {
  it('auto-approves a privileged uploader', () => {
    expect(nextStatusFor(true)).toBe('approved')
  })
  it('holds a member upload for review', () => {
    expect(nextStatusFor(false)).toBe('pending')
  })
})

describe('canReviewDrop', () => {
  it('allows a moderator', () => {
    expect(canReviewDrop({ isPrivileged: true })).toBe(true)
  })
  it('refuses a plain member', () => {
    expect(canReviewDrop({ isPrivileged: false })).toBe(false)
  })
})

describe('toDropDTO status', () => {
  it('carries the status through', () => {
    expect(toDropDTO(row({ status: 'pending' })).status).toBe('pending')
  })
  it('never emits the asset URL of a rejected drop', () => {
    const dto = toDropDTO(row({ status: 'rejected', thumbnailUrl: 'https://x.public.blob.vercel-storage.com/hub-drops/h1/t.jpg' }))
    expect(dto.url).toBe('')
    expect(dto.thumbnailUrl).toBeNull()
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm exec vitest run src/lib/hub-drops.test.ts`
Expected: FAIL — `nextStatusFor is not a function` (and the `toDropDTO` status tests fail on `undefined`).

- [ ] **Step 3: Implement**

In `src/lib/hub-drops.ts`, replace lines 53-87 (from `export type DropAuthor` to end of file) with:

```ts
export type DropAuthor = { userId: string; username: string; name: string | null; avatar: string | null }

export type DropStatus = 'pending' | 'approved' | 'rejected'

/** A drop from a moderator lands live; anyone else's waits for review. */
export function nextStatusFor(isPrivileged: boolean): DropStatus {
  return isPrivileged ? 'approved' : 'pending'
}

export function canReviewDrop(input: { isPrivileged: boolean }): boolean {
  return input.isPrivileged
}

export type DropDTO = {
  id: string
  type: DropType
  url: string
  thumbnailUrl: string | null
  caption: string | null
  mimeType: string | null
  width: number | null
  height: number | null
  status: DropStatus
  createdAt: string
  author: DropAuthor
}

export function toDropDTO(row: {
  id: string; type: string; url: string; thumbnailUrl: string | null; caption: string | null
  mimeType: string | null; width: number | null; height: number | null; status: string; createdAt: Date
  author: { id: string; username: string; name: string | null; avatar: string | null }
}): DropDTO {
  const status = row.status as DropStatus
  // A rejected drop's asset is deleted from Blob storage; emitting the dead URL
  // would leak what was uploaded via the pathname and 404 in every renderer.
  const rejected = status === 'rejected'
  return {
    id: row.id,
    type: row.type as DropType,
    url: rejected ? '' : row.url,
    thumbnailUrl: rejected ? null : row.thumbnailUrl,
    caption: row.caption,
    mimeType: row.mimeType,
    width: row.width,
    height: row.height,
    status,
    createdAt: row.createdAt.toISOString(),
    author: { userId: row.author.id, username: row.author.username, name: row.author.name, avatar: row.author.avatar },
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm exec vitest run src/lib/hub-drops.test.ts`
Expected: PASS, all tests in the file including the pre-existing `validateDropInput` / `isOwnDropAsset` ones.

- [ ] **Step 5: Commit**

```bash
git add src/lib/hub-drops.ts src/lib/hub-drops.test.ts
git commit -m "feat(hub): drop status helpers + status-aware DTO"
```

---

### Task 3: Notification copy for the three new events

**Files:**
- Modify: `src/lib/notifications-format.ts:1` (the `NotificationType` union) and `:25-26` (the `hub_drop` case)
- Test: `src/lib/notifications-format.test.ts` (create if absent; if present, append)

**Interfaces:**
- Consumes: nothing.
- Produces: `NotificationType` gains `'hub_drop_pending' | 'hub_drop_approved' | 'hub_drop_rejected'`. `formatNotification` renders all three.

**Note:** this file must stay database-free — it is imported by client components. Do not import `notifications.ts` here.

- [ ] **Step 1: Write the failing test**

Create or append to `src/lib/notifications-format.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { formatNotification } from './notifications-format'

describe('kollab drop notifications', () => {
  it('tells the owner a drop needs review', () => {
    expect(formatNotification({ type: 'hub_drop_pending', actorName: 'Sam', contextText: 'Frog Club' }))
      .toBe('Sam dropped content in “Frog Club” — review it')
  })
  it('tells the author their drop is live', () => {
    expect(formatNotification({ type: 'hub_drop_approved', actorName: 'Jo', contextText: 'Frog Club' }))
      .toBe('Your drop is live in “Frog Club”')
  })
  it('tells the author their drop was not approved', () => {
    expect(formatNotification({ type: 'hub_drop_rejected', actorName: 'Jo', contextText: 'Frog Club' }))
      .toBe('Your drop in “Frog Club” wasn’t approved')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run src/lib/notifications-format.test.ts`
Expected: FAIL — each case returns the actor name (`'Sam'`) from the `default:` branch instead of the sentence.

- [ ] **Step 3: Implement**

In `src/lib/notifications-format.ts`, replace line 1 with:

```ts
export type NotificationType = 'follow' | 'bulletin' | 'page_published' | 'comment' | 'hub_collaborator' | 'message' | 'hub_member' | 'hub_post' | 'hub_comment' | 'hub_event' | 'hub_drop' | 'hub_drop_pending' | 'hub_drop_approved' | 'hub_drop_rejected' | 'hub_report'
```

and insert these three cases immediately after the existing `case 'hub_drop':` block (after line 26):

```ts
    case 'hub_drop_pending':
      return `${n.actorName} dropped content in ${n.contextText ? `“${n.contextText}”` : 'your community'} — review it`
    case 'hub_drop_approved':
      return `Your drop is live in ${n.contextText ? `“${n.contextText}”` : 'the community'}`
    case 'hub_drop_rejected':
      return `Your drop in ${n.contextText ? `“${n.contextText}”` : 'the community'} wasn’t approved`
```

Note the apostrophe in `wasn’t` is U+2019 (a right single quotation mark), not `'` — a straight apostrophe inside JSX would trip `react/no-unescaped-entities` if this string is ever inlined.

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm exec vitest run src/lib/notifications-format.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/notifications-format.ts src/lib/notifications-format.test.ts
git commit -m "feat(hub): notification copy for drop review events"
```

---

### Task 4: `GET /drops` status filter + `POST /drops` mandatory gate

**Files:**
- Modify: `src/app/api/hubs/[id]/drops/route.ts` (whole file)
- Test: `src/app/api/hubs/[id]/drops/route.test.ts` (append; update the two existing approval tests)

**Interfaces:**
- Consumes: `nextStatusFor` from Task 2; `'hub_drop_pending'` from Task 3.
- Produces: `GET /api/hubs/[id]/drops?status=approved|pending&cursor=<id>` → `{ drops: DropDTO[], nextCursor: string | null }`. `POST /api/hubs/[id]/drops` → `201 { id, status }`.

- [ ] **Step 1: Write the failing tests**

In `src/app/api/hubs/[id]/drops/route.test.ts`, **delete** the two existing tests named `sets hidden and snapshots consentText for a member drop when approval is required` and `does not gate a privileged user by their own approval requirement` (they assert the retired config toggle). Append:

```ts
it('POST holds a member drop for review regardless of config', async () => {
  ;(getUser as any).mockResolvedValue({ id: 'member', username: 'm', name: 'M', avatar: null })
  ;(db.hub.findUnique as any).mockResolvedValue({
    id: 'hub1', userId: 'owner', community: true, title: 'Frog Club', slug: 'frog',
    config: { kollab: { enabled: true, whoCanDrop: 'members', requireApproval: false } },
    user: { username: 'owner' },
  })
  ;(db.hubMember.findUnique as any).mockResolvedValue({ id: 'm1' })
  ;(db.hubDrop.create as any).mockResolvedValue({ id: 'drop1' })
  const res = await POST(req({ type: 'image', url: OWN_URL }), params)
  expect(res.status).toBe(201)
  expect((db.hubDrop.create as any).mock.calls[0][0].data.status).toBe('pending')
  expect((db.hubDrop.create as any).mock.calls[0][0].data.hidden).toBe(true)
})

it('POST auto-approves a privileged uploader', async () => {
  ;(getUser as any).mockResolvedValue({ id: 'owner', username: 'o', name: 'O', avatar: null })
  ;(db.hub.findUnique as any).mockResolvedValue({
    id: 'hub1', userId: 'owner', community: true, title: 'Frog Club', slug: 'frog',
    config: { kollab: { enabled: true, whoCanDrop: 'members' } }, user: { username: 'owner' },
  })
  ;(db.hubMember.findUnique as any).mockResolvedValue(null)
  ;(db.hubDrop.create as any).mockResolvedValue({ id: 'drop2' })
  const res = await POST(req({ type: 'image', url: OWN_URL }), params)
  expect(res.status).toBe(201)
  expect((db.hubDrop.create as any).mock.calls[0][0].data.status).toBe('approved')
})

it('POST does not notify the hub about a drop nobody can see', async () => {
  ;(getUser as any).mockResolvedValue({ id: 'member', username: 'm', name: 'M', avatar: null })
  ;(db.hub.findUnique as any).mockResolvedValue({
    id: 'hub1', userId: 'owner', community: true, title: 'Frog Club', slug: 'frog',
    config: { kollab: { enabled: true, whoCanDrop: 'members' } }, user: { username: 'owner' },
  })
  ;(db.hubMember.findUnique as any).mockResolvedValue({ id: 'm1' })
  ;(db.hubDrop.create as any).mockResolvedValue({ id: 'drop3' })
  await POST(req({ type: 'image', url: OWN_URL }), params)
  const types = (notifyHubMembers as any).mock.calls.map((c: any[]) => c[1].type)
  expect(types).toContain('hub_drop_pending')
  expect(types).not.toContain('hub_drop')
})

it('GET 403s a pending request from a non-privileged viewer', async () => {
  ;(getUser as any).mockResolvedValue({ id: 'stranger' })
  ;(db.hub.findUnique as any).mockResolvedValue({ id: 'hub1', userId: 'owner', community: true, published: true })
  const res = await GET(getReq('?status=pending'), params)
  expect(res.status).toBe(403)
})

it('GET defaults to approved only, even for the owner', async () => {
  ;(getUser as any).mockResolvedValue({ id: 'owner' })
  ;(db.hub.findUnique as any).mockResolvedValue({ id: 'hub1', userId: 'owner', community: true, published: true })
  ;(db.hubDrop.findMany as any).mockResolvedValue([])
  await GET(getReq(''), params)
  expect((db.hubDrop.findMany as any).mock.calls[0][0].where).toEqual({ hubId: 'hub1', status: 'approved' })
})
```

Add these helpers near the top of the file if they are not already present (match the existing file's naming — if `OWN_URL` or a request helper already exists, reuse it rather than redeclaring):

```ts
const OWN_URL = 'https://x.public.blob.vercel-storage.com/hub-drops/hub1/a.jpg'
const getReq = (qs: string) => ({ url: `http://localhost/api/hubs/hub1/drops${qs}` } as any)
```

Ensure the module mock at the top of the file includes `notifyHubMembers` and `createNotification`:

```ts
vi.mock('@/lib/notifications', () => ({ notifyHubMembers: vi.fn(), createNotification: vi.fn() }))
```
and that `notifyHubMembers` is imported alongside the other test imports.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm exec vitest run "src/app/api/hubs/[id]/drops/route.test.ts"`
Expected: FAIL — the status assertions read `undefined`, and `GET ?status=pending` returns 200 instead of 403.

- [ ] **Step 3: Implement the GET changes**

In `src/app/api/hubs/[id]/drops/route.ts`, replace lines 27-28:

```ts
  const where: any = { hubId: id }
  if (!isPrivileged) where.hidden = false
```

with:

```ts
  // `pending` is a moderation view: 403 rather than an empty list, so the
  // endpoint can't be probed to learn whether a hub has a review backlog.
  // Anything not explicitly `pending` reads as the public approved pool —
  // rejected rows are never listed on any path.
  const requested = new URL(request.url).searchParams.get('status')
  if (requested === 'pending' && !isPrivileged) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const where: any = { hubId: id, status: requested === 'pending' ? 'pending' : 'approved' }
```

- [ ] **Step 4: Implement the POST changes**

Make these edits by anchor text, not line number — each one shifts the lines below it.

First, insert this immediately **before** the `const drop = await db.hubDrop.create({` line:

```ts
  const status = nextStatusFor(isPrivileged)
```

Then replace the line `      hidden: config.kollab.requireApproval && !isPrivileged,` inside the `create` payload with:

```ts
      status,
      // Written only so a rollback to the previous deploy still filters correctly.
      hidden: status !== 'approved',
```

Then replace the whole notification block — the four statements from `const memberIds = ...` through the end of the `await notifyHubMembers({...})` call — with:

```ts
  if (status === 'approved') {
    const memberIds = (await db.hubMember.findMany({ where: { hubId: id }, select: { userId: true } })).map((m) => m.userId)
    const targets = postNotifyTargets({ authorId: me.id, ownerId: hub.userId, collabIds, memberIds })
    await notifyHubMembers(targets, {
      type: 'hub_drop',
      actor: { id: me.id, name: me.name || me.username, avatar: me.avatar },
      entityUrl: `/${hub.user.username}/hub/${hub.slug}`,
      contextText: hub.title,
    })
  } else {
    // Pending content is invisible to members — only the people who can act on
    // it are told, and only they receive a link to it.
    await notifyHubMembers([hub.userId, ...collabIds], {
      type: 'hub_drop_pending',
      actor: { id: me.id, name: me.name || me.username, avatar: me.avatar },
      entityUrl: `/${hub.user.username}/hub/${hub.slug}#hub-kollab`,
      contextText: hub.title,
    })
  }
```

Finally change the `201` response line to:

```ts
  return NextResponse.json({ id: drop.id, status }, { status: 201 })
```

and update the import on line 8:

```ts
import { validateDropInput, toDropDTO, nextStatusFor } from '@/lib/hub-drops'
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm exec vitest run "src/app/api/hubs/[id]/drops/route.test.ts"`
Expected: PASS, including the pre-existing 401/403/ordering/pagination tests.

- [ ] **Step 6: Commit**

```bash
git add "src/app/api/hubs/[id]/drops/route.ts" "src/app/api/hubs/[id]/drops/route.test.ts"
git commit -m "feat(hub): mandatory drop review gate + status-filtered list"
```

---

### Task 5: `PATCH /drops/[dropId]` approve / reject

**Files:**
- Modify: `src/app/api/hubs/[id]/drops/[dropId]/route.ts:42-53` (PATCH) and `:15` (the `load` select)
- Test: `src/app/api/hubs/[id]/drops/[dropId]/route.test.ts` (replace the two PATCH tests, append four)

**Interfaces:**
- Consumes: `canReviewDrop`, `isOwnDropAsset` from `hub-drops.ts`; `'hub_drop_approved'` / `'hub_drop_rejected'` from Task 3.
- Produces: `PATCH` accepts `{ action: 'approve' | 'reject' }` → `200 { ok: true, status }`; `400` on any other body.

- [ ] **Step 1: Write the failing tests**

In `src/app/api/hubs/[id]/drops/[dropId]/route.test.ts`, **replace** the two existing tests `PATCH 403 hide by a plain author (not moderator)` and `PATCH 200 hide by owner` with the following, and append the rest. Add the blob and notification mocks at the top of the file alongside the existing mocks:

```ts
// vi.mock is hoisted above every top-level const, so the shared spy must be
// created with vi.hoisted or the factory closes over a TDZ binding.
const { del } = vi.hoisted(() => ({ del: vi.fn(async () => {}) }))
vi.mock('@vercel/blob', () => ({ del }))
vi.mock('@/lib/storage-env', () => ({ blobReadWriteToken: () => 'tok' }))
vi.mock('@/lib/notifications', () => ({ createNotification: vi.fn(), notifyHubMembers: vi.fn() }))
```

Because `del` is a module-scoped spy shared across tests, reset it in the existing `beforeEach` — confirm that block calls `vi.clearAllMocks()` (it does) and add `del.mockResolvedValue(undefined)` after it so a `mockRejectedValueOnce` from one test cannot leak into the next.

and import `createNotification` / `notifyHubMembers` from `@/lib/notifications`.

The approve path also fans out to hub members, so extend the existing `@/lib/db` mock at the top of the file — it currently declares only `hub`, `hubCollaborator` and `hubDrop` — by adding:

```ts
    hubMember: { findMany: vi.fn(async () => []) },
```

Without it, `db.hubMember.findMany` is `undefined` and the approve tests throw instead of asserting.

```ts
const OWN = 'https://x.public.blob.vercel-storage.com/hub-drops/hub1/a.jpg'
const hub = { id: 'hub1', userId: 'owner', community: true, title: 'Frog Club', slug: 'frog', user: { username: 'owner' } }

it('PATCH 403 review by a plain author (not moderator)', async () => {
  ;(getUser as any).mockResolvedValue({ id: 'author', username: 'a', name: 'A', avatar: null })
  ;(db.hub.findUnique as any).mockResolvedValue(hub)
  ;(db.hubDrop.findFirst as any).mockResolvedValue({ id: 'drop1', authorId: 'author', hubId: 'hub1', url: OWN, thumbnailUrl: null, status: 'pending' })
  const res = await PATCH(req({ action: 'approve' }), params)
  expect(res.status).toBe(403)
})

it('PATCH 400 on an unknown action', async () => {
  ;(getUser as any).mockResolvedValue({ id: 'owner', username: 'o', name: 'O', avatar: null })
  ;(db.hub.findUnique as any).mockResolvedValue(hub)
  ;(db.hubDrop.findFirst as any).mockResolvedValue({ id: 'drop1', authorId: 'author', hubId: 'hub1', url: OWN, thumbnailUrl: null, status: 'pending' })
  const res = await PATCH(req({ hidden: true }), params)
  expect(res.status).toBe(400)
})

it('PATCH approve stamps the reviewer and notifies the author', async () => {
  ;(getUser as any).mockResolvedValue({ id: 'owner', username: 'o', name: 'O', avatar: null })
  ;(db.hub.findUnique as any).mockResolvedValue(hub)
  ;(db.hubDrop.findFirst as any).mockResolvedValue({ id: 'drop1', authorId: 'author', hubId: 'hub1', url: OWN, thumbnailUrl: null, status: 'pending' })
  const res = await PATCH(req({ action: 'approve' }), params)
  expect(res.status).toBe(200)
  const data = (db.hubDrop.update as any).mock.calls[0][0].data
  expect(data.status).toBe('approved')
  expect(data.hidden).toBe(false)
  expect(data.reviewedById).toBe('owner')
  expect(data.reviewedAt).toBeInstanceOf(Date)
  expect(del).not.toHaveBeenCalled()
  expect((createNotification as any).mock.calls[0][0].type).toBe('hub_drop_approved')
})

it('PATCH reject purges only this hub-s own assets', async () => {
  ;(getUser as any).mockResolvedValue({ id: 'owner', username: 'o', name: 'O', avatar: null })
  ;(db.hub.findUnique as any).mockResolvedValue(hub)
  ;(db.hubDrop.findFirst as any).mockResolvedValue({
    id: 'drop1', authorId: 'author', hubId: 'hub1', status: 'pending',
    url: OWN, thumbnailUrl: 'https://x.public.blob.vercel-storage.com/hub-drops/OTHERHUB/t.jpg',
  })
  const res = await PATCH(req({ action: 'reject' }), params)
  expect(res.status).toBe(200)
  expect(del).toHaveBeenCalledWith([OWN], { token: 'tok' })
  const data = (db.hubDrop.update as any).mock.calls[0][0].data
  expect(data.status).toBe('rejected')
  expect(data.assetDeleted).toBe(true)
  expect((createNotification as any).mock.calls[0][0].type).toBe('hub_drop_rejected')
})

it('PATCH reject still succeeds when the blob purge throws', async () => {
  del.mockRejectedValueOnce(new Error('blob down'))
  ;(getUser as any).mockResolvedValue({ id: 'owner', username: 'o', name: 'O', avatar: null })
  ;(db.hub.findUnique as any).mockResolvedValue(hub)
  ;(db.hubDrop.findFirst as any).mockResolvedValue({ id: 'drop1', authorId: 'author', hubId: 'hub1', url: OWN, thumbnailUrl: null, status: 'pending' })
  const res = await PATCH(req({ action: 'reject' }), params)
  expect(res.status).toBe(200)
  expect((db.hubDrop.update as any).mock.calls[0][0].data.assetDeleted).toBe(false)
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm exec vitest run "src/app/api/hubs/[id]/drops/[dropId]/route.test.ts"`
Expected: FAIL — `PATCH 400 on an unknown action` gets 200, and the approve/reject assertions read `undefined` from the update payload.

- [ ] **Step 3: Widen the `load` select**

In `src/app/api/hubs/[id]/drops/[dropId]/route.ts`, change line 15's select and the `LoadResult` type so the hub and drop carry what the notification needs. Replace lines 8-19 with:

```ts
type LoadedHub = { id: string; userId: string; community: boolean; title: string; slug: string; user: { username: string } }
type LoadedDrop = { id: string; authorId: string; url: string; thumbnailUrl: string | null; status: string }
type LoadResult =
  | { error: NextResponse; hub?: undefined; drop?: undefined; collabIds?: undefined }
  | { error?: undefined; hub: LoadedHub; drop: LoadedDrop; collabIds: string[] }

async function load(hubId: string, dropId: string): Promise<LoadResult> {
  const hub = await db.hub.findUnique({
    where: { id: hubId },
    select: { id: true, userId: true, community: true, title: true, slug: true, user: { select: { username: true } } },
  })
  if (!hub || !hub.community) return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) }
  const drop = await db.hubDrop.findFirst({ where: { id: dropId, hubId }, select: { id: true, authorId: true, url: true, thumbnailUrl: true, status: true } })
  if (!drop) return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) }
  const collabIds = (await db.hubCollaborator.findMany({ where: { hubId }, select: { userId: true } })).map((r) => r.userId)
  return { hub, drop, collabIds }
}
```

- [ ] **Step 4: Rewrite PATCH**

Replace lines 42-53 (the whole `PATCH` function) with:

```ts
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string; dropId: string }> }): Promise<NextResponse> {
  const { id, dropId } = await params
  const me = await getUser(request)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const r = await load(id, dropId)
  if (r.error) return r.error
  const isPrivileged = canModerate(me.id, r.hub, r.collabIds)
  if (!canReviewDrop({ isPrivileged })) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json().catch(() => ({}))
  const action = body?.action
  if (action !== 'approve' && action !== 'reject') {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  }
  const status = action === 'approve' ? 'approved' : 'rejected'

  // Reject destroys the file. `del` runs with the app-wide RW token over a store
  // shared with avatars, page images and message media — hand it only URLs that
  // are provably this hub's own drop assets, whatever ended up on the row.
  let assetDeleted = false
  if (action === 'reject') {
    const token = blobReadWriteToken()
    const owned = [r.drop.url, r.drop.thumbnailUrl].filter((u): u is string => !!u && isOwnDropAsset(id, u))
    if (token && owned.length) {
      const { del } = await import('@vercel/blob')
      // A stale file is a billing problem, not a safety one — never fail the
      // rejection because storage was unreachable.
      assetDeleted = await del(owned, { token }).then(() => true).catch(() => false)
    }
  }

  await db.hubDrop.update({
    where: { id: dropId },
    data: {
      status,
      hidden: status !== 'approved',
      reviewedAt: new Date(),
      reviewedById: me.id,
      ...(action === 'reject' ? { assetDeleted } : {}),
    },
  })

  const actor = { id: me.id, name: me.name || me.username, avatar: me.avatar }
  const entityUrl = `/${r.hub.user.username}/hub/${r.hub.slug}`
  await createNotification({
    userId: r.drop.authorId,
    type: action === 'approve' ? 'hub_drop_approved' : 'hub_drop_rejected',
    actor,
    entityUrl,
    contextText: r.hub.title,
  })

  // The hub-wide "new clips" ping fires here, not on upload — members are never
  // told about content that was still invisible to them.
  if (action === 'approve') {
    const memberIds = (await db.hubMember.findMany({ where: { hubId: id }, select: { userId: true } })).map((m) => m.userId)
    const targets = postNotifyTargets({ authorId: r.drop.authorId, ownerId: r.hub.userId, collabIds: r.collabIds, memberIds })
    await notifyHubMembers(targets, { type: 'hub_drop', actor, entityUrl, contextText: r.hub.title })
  }

  return NextResponse.json({ ok: true, status })
}
```

Update the imports at the top of the file (lines 4-6) to:

```ts
import { canModerate, postNotifyTargets } from '@/lib/community'
import { blobReadWriteToken } from '@/lib/storage-env'
import { isOwnDropAsset, canReviewDrop } from '@/lib/hub-drops'
import { createNotification, notifyHubMembers } from '@/lib/notifications'
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm exec vitest run "src/app/api/hubs/[id]/drops/[dropId]/route.test.ts"`
Expected: PASS, including the three pre-existing DELETE tests.

- [ ] **Step 6: Commit**

```bash
git add "src/app/api/hubs/[id]/drops/[dropId]/route.ts" "src/app/api/hubs/[id]/drops/[dropId]/route.test.ts"
git commit -m "feat(hub): approve/reject drop review endpoint with asset purge"
```

---

### Task 6: `KollabWordmark` SVG component

**Files:**
- Create: `src/components/hub/community/KollabWordmark.tsx`
- Test: `src/components/hub/community/KollabWordmark.test.tsx`

**Interfaces:**
- Consumes: nothing.
- Produces: `export function KollabWordmark({ className }: { className?: string })` — an inline SVG, `viewBox="0 0 300 78"`, with `role="img"` and `aria-label="Kollab"`.

- [ ] **Step 1: Write the failing test**

Create `src/components/hub/community/KollabWordmark.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { KollabWordmark } from './KollabWordmark'

describe('KollabWordmark', () => {
  it('exposes the brand name to assistive tech', () => {
    render(<KollabWordmark />)
    expect(screen.getByRole('img', { name: 'Kollab' })).toBeInTheDocument()
  })

  it('accepts a className for sizing', () => {
    const { container } = render(<KollabWordmark className="h-8" />)
    expect(container.querySelector('svg')).toHaveClass('h-8')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run src/components/hub/community/KollabWordmark.test.tsx`
Expected: FAIL — `Failed to resolve import "./KollabWordmark"`.

- [ ] **Step 3: Implement**

Create `src/components/hub/community/KollabWordmark.tsx`. The wordmark is set in the app's own font (Plus Jakarta Sans) rather than hand-drawn paths, so it stays crisp at any size and needs no font file of its own:

```tsx
// The Kollab sub-brand carries its own orange; these are deliberately literal
// hex values, not Tailwind galli.* tokens. Each instance mints a unique gradient
// id so two wordmarks on one page can't collide in the SVG id namespace.
import { useId } from 'react'

export function KollabWordmark({ className }: { className?: string }) {
  const gradientId = useId()
  return (
    <svg
      viewBox="0 0 300 78"
      role="img"
      aria-label="Kollab"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#FF6B3D" />
          <stop offset="100%" stopColor="#FF8A5B" />
        </linearGradient>
      </defs>
      <text
        x="0"
        y="60"
        fill={`url(#${gradientId})`}
        fontFamily="var(--font-plus-jakarta), 'Plus Jakarta Sans', system-ui, sans-serif"
        fontSize="72"
        fontWeight="800"
        letterSpacing="-2"
      >
        Kollab
      </text>
    </svg>
  )
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm exec vitest run src/components/hub/community/KollabWordmark.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/hub/community/KollabWordmark.tsx src/components/hub/community/KollabWordmark.test.tsx
git commit -m "feat(hub): Kollab wordmark component"
```

---

### Task 7: `KollabTile` presentational component

**Files:**
- Create: `src/components/hub/community/KollabTile.tsx`
- Test: `src/components/hub/community/KollabTile.test.tsx`

**Interfaces:**
- Consumes: `KollabWordmark` from Task 6.
- Produces:

```ts
export function KollabTile(props: {
  count: number
  pendingCount: number
  canDrop: boolean
  isPrivileged: boolean
  uploading: boolean
  onDrop: () => void
  onSee: () => void
}): JSX.Element
```

- [ ] **Step 1: Write the failing test**

Create `src/components/hub/community/KollabTile.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { KollabTile } from './KollabTile'

const base = {
  count: 24, pendingCount: 0, canDrop: true, isPrivileged: false,
  uploading: false, onDrop: () => {}, onSee: () => {},
}

describe('KollabTile', () => {
  it('shows the approved count', () => {
    render(<KollabTile {...base} />)
    expect(screen.getByText('24 clips & photos')).toBeInTheDocument()
  })

  it('hides Drop content when the viewer cannot drop', () => {
    render(<KollabTile {...base} canDrop={false} />)
    expect(screen.queryByRole('button', { name: /drop content/i })).not.toBeInTheDocument()
  })

  it('disables See content when the pool is empty', () => {
    render(<KollabTile {...base} count={0} />)
    expect(screen.getByRole('button', { name: /see content/i })).toBeDisabled()
  })

  it('shows the awaiting-review badge only to moderators', () => {
    const { rerender } = render(<KollabTile {...base} pendingCount={3} isPrivileged={false} />)
    expect(screen.queryByText(/awaiting review/i)).not.toBeInTheDocument()
    rerender(<KollabTile {...base} pendingCount={3} isPrivileged />)
    expect(screen.getByText('3 awaiting review')).toBeInTheDocument()
  })

  it('calls onSee when See content is clicked', async () => {
    const onSee = vi.fn()
    render(<KollabTile {...base} onSee={onSee} />)
    await userEvent.click(screen.getByRole('button', { name: /see content/i }))
    expect(onSee).toHaveBeenCalledOnce()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run src/components/hub/community/KollabTile.test.tsx`
Expected: FAIL — `Failed to resolve import "./KollabTile"`.

- [ ] **Step 3: Implement**

Create `src/components/hub/community/KollabTile.tsx`:

```tsx
'use client'

import { ImagePlus, Loader2 } from 'lucide-react'
import { KollabWordmark } from './KollabWordmark'

export function KollabTile({
  count, pendingCount, canDrop, isPrivileged, uploading, onDrop, onSee,
}: {
  count: number
  pendingCount: number
  canDrop: boolean
  isPrivileged: boolean
  uploading: boolean
  onDrop: () => void
  onSee: () => void
}) {
  return (
    <section className="rounded-2xl border border-border bg-surface p-5 text-center">
      <KollabWordmark className="mx-auto h-10 w-auto" />
      <p className="mt-2 text-sm text-muted-foreground">
        {count > 0 ? `${count} clip${count === 1 ? '' : 's'} & photos` : 'Be the first to drop something.'}
      </p>

      <div className="mt-4 space-y-2">
        {canDrop && (
          <button
            onClick={onDrop}
            disabled={uploading}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#FF6B3D] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
            {uploading ? 'Uploading…' : 'Drop content'}
          </button>
        )}
        <button
          onClick={onSee}
          disabled={count === 0}
          className="inline-flex w-full items-center justify-center rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
        >
          See content
        </button>
      </div>

      {isPrivileged && pendingCount > 0 && (
        <p className="mt-3 text-xs font-medium text-amber-600">{pendingCount} awaiting review</p>
      )}
    </section>
  )
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm exec vitest run src/components/hub/community/KollabTile.test.tsx`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/hub/community/KollabTile.tsx src/components/hub/community/KollabTile.test.tsx
git commit -m "feat(hub): Kollab tile with drop/see actions"
```

---

### Task 8: `KollabGrid` — one grid, approved and pending modes

**Files:**
- Create: `src/components/hub/community/KollabGrid.tsx`
- Test: `src/components/hub/community/KollabGrid.test.tsx`

**Interfaces:**
- Consumes: `DropDTO` from Task 2; the existing `ReportButton` at `src/components/hub/ReportButton.tsx`.
- Produces:

```ts
export function KollabGrid(props: {
  drops: DropDTO[]
  mode: 'approved' | 'pending'
  hubId: string
  currentUserId?: string
  isPrivileged: boolean
  onOpen: (d: DropDTO) => void
  onApprove: (id: string) => void
  onReject: (id: string) => void
  onRemove: (id: string) => void
}): JSX.Element
```

- [ ] **Step 1: Write the failing test**

Create `src/components/hub/community/KollabGrid.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { KollabGrid } from './KollabGrid'
import type { DropDTO } from '@/lib/hub-drops'

const drop = (over: Partial<DropDTO> = {}): DropDTO => ({
  id: 'd1', type: 'image', url: 'https://x/a.jpg', thumbnailUrl: null, caption: null,
  mimeType: null, width: null, height: null, status: 'approved',
  createdAt: '2026-07-21T00:00:00.000Z',
  author: { userId: 'u1', username: 'sam', name: 'Sam', avatar: null },
  ...over,
})

const base = {
  hubId: 'hub1', currentUserId: 'owner', isPrivileged: true,
  onOpen: () => {}, onApprove: () => {}, onReject: () => {}, onRemove: () => {},
}

describe('KollabGrid', () => {
  it('renders approve and reject only in pending mode', () => {
    const { rerender } = render(<KollabGrid {...base} mode="approved" drops={[drop()]} />)
    expect(screen.queryByRole('button', { name: /approve/i })).not.toBeInTheDocument()
    rerender(<KollabGrid {...base} mode="pending" drops={[drop({ status: 'pending' })]} />)
    expect(screen.getByRole('button', { name: /approve/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /reject/i })).toBeInTheDocument()
  })

  it('names the author in pending mode so a moderator knows who dropped it', () => {
    render(<KollabGrid {...base} mode="pending" drops={[drop({ status: 'pending' })]} />)
    expect(screen.getByText('Sam')).toBeInTheDocument()
  })

  it('calls onApprove with the drop id', async () => {
    const onApprove = vi.fn()
    render(<KollabGrid {...base} mode="pending" onApprove={onApprove} drops={[drop({ id: 'x9', status: 'pending' })]} />)
    await userEvent.click(screen.getByRole('button', { name: /approve/i }))
    expect(onApprove).toHaveBeenCalledWith('x9')
  })

  it('shows an empty message when there is nothing in this tab', () => {
    render(<KollabGrid {...base} mode="pending" drops={[]} />)
    expect(screen.getByText('Nothing waiting for review.')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run src/components/hub/community/KollabGrid.test.tsx`
Expected: FAIL — `Failed to resolve import "./KollabGrid"`.

- [ ] **Step 3: Implement**

Create `src/components/hub/community/KollabGrid.tsx`:

```tsx
'use client'

import { Play, Trash2, Check, X } from 'lucide-react'
import type { DropDTO } from '@/lib/hub-drops'
import { ReportButton } from '@/components/hub/ReportButton'

function Thumb({ d }: { d: DropDTO }) {
  if (d.thumbnailUrl || d.type === 'image') {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={d.thumbnailUrl || d.url} alt={d.caption || ''} className="h-full w-full object-cover" />
  }
  return <div className="flex h-full w-full items-center justify-center bg-black/80 text-xs text-white/40">Video</div>
}

export function KollabGrid({
  drops, mode, hubId, currentUserId, isPrivileged, onOpen, onApprove, onReject, onRemove,
}: {
  drops: DropDTO[]
  mode: 'approved' | 'pending'
  hubId: string
  currentUserId?: string
  isPrivileged: boolean
  onOpen: (d: DropDTO) => void
  onApprove: (id: string) => void
  onReject: (id: string) => void
  onRemove: (id: string) => void
}) {
  if (drops.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
        {mode === 'pending' ? 'Nothing waiting for review.' : 'Nothing in the pool yet.'}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
      {drops.map((d) => (
        <div key={d.id}>
          <div className="group relative aspect-square overflow-hidden rounded-lg bg-muted">
            <button onClick={() => onOpen(d)} className="block h-full w-full">
              <Thumb d={d} />
              {d.type === 'video' && (
                <span className="absolute inset-0 flex items-center justify-center">
                  <Play className="h-8 w-8 text-white drop-shadow" fill="currentColor" />
                </span>
              )}
            </button>
            {mode === 'approved' && (
              <div className="absolute right-1 top-1 flex gap-1 opacity-0 transition group-hover:opacity-100">
                <ReportButton
                  hubId={hubId}
                  targetType="drop"
                  targetId={d.id}
                  authorId={d.author.userId}
                  currentUserId={currentUserId}
                  className="rounded-md bg-black/60 p-1 text-white hover:bg-black/80"
                />
                {(isPrivileged || d.author.userId === currentUserId) && (
                  <button onClick={() => onRemove(d.id)} title="Remove" className="rounded-md bg-black/60 p-1 text-white hover:bg-black/80">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            )}
          </div>

          {mode === 'pending' && (
            <div className="mt-1.5">
              <p className="truncate text-xs text-muted-foreground">
                {d.author.name || d.author.username}
              </p>
              <div className="mt-1 flex gap-1">
                <button
                  onClick={() => onApprove(d.id)}
                  className="inline-flex flex-1 items-center justify-center gap-1 rounded-md bg-[#FF6B3D] px-2 py-1 text-xs font-medium text-white hover:opacity-90"
                >
                  <Check className="h-3.5 w-3.5" /> Approve
                </button>
                <button
                  onClick={() => onReject(d.id)}
                  className="inline-flex flex-1 items-center justify-center gap-1 rounded-md border border-border px-2 py-1 text-xs font-medium hover:bg-muted"
                >
                  <X className="h-3.5 w-3.5" /> Reject
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm exec vitest run src/components/hub/community/KollabGrid.test.tsx`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/hub/community/KollabGrid.tsx src/components/hub/community/KollabGrid.test.tsx
git commit -m "feat(hub): Kollab grid with approved and pending modes"
```

---

### Task 9: `KollabViewer` — the modal window with tabs and lightbox

**Files:**
- Create: `src/components/hub/community/KollabViewer.tsx`
- Test: `src/components/hub/community/KollabViewer.test.tsx`

**Interfaces:**
- Consumes: `KollabGrid` (Task 8), `DropDTO` (Task 2), the endpoints from Tasks 4 and 5.
- Produces:

```ts
export function KollabViewer(props: {
  hubId: string
  isPrivileged: boolean
  currentUserId?: string
  initialDrops: DropDTO[]
  total: number
  onClose: () => void
  onApprovedCountChange: (delta: number) => void
  onPendingCountChange: (delta: number) => void
}): JSX.Element
```

- [ ] **Step 1: Write the failing test**

Create `src/components/hub/community/KollabViewer.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { KollabViewer } from './KollabViewer'
import type { DropDTO } from '@/lib/hub-drops'

const drop = (over: Partial<DropDTO> = {}): DropDTO => ({
  id: 'd1', type: 'image', url: 'https://x/a.jpg', thumbnailUrl: null, caption: null,
  mimeType: null, width: null, height: null, status: 'approved',
  createdAt: '2026-07-21T00:00:00.000Z',
  author: { userId: 'u1', username: 'sam', name: 'Sam', avatar: null },
  ...over,
})

const base = {
  hubId: 'hub1', currentUserId: 'owner', initialDrops: [drop()], total: 1,
  onClose: () => {}, onApprovedCountChange: () => {}, onPendingCountChange: () => {},
}

beforeEach(() => {
  global.fetch = vi.fn(async () => ({ ok: true, json: async () => ({ drops: [], nextCursor: null }) })) as any
})
afterEach(() => vi.restoreAllMocks())

describe('KollabViewer', () => {
  it('hides the Pending tab from a non-privileged viewer', () => {
    render(<KollabViewer {...base} isPrivileged={false} />)
    expect(screen.queryByRole('tab', { name: /pending/i })).not.toBeInTheDocument()
  })

  it('shows the Pending tab to a moderator', () => {
    render(<KollabViewer {...base} isPrivileged />)
    expect(screen.getByRole('tab', { name: /pending/i })).toBeInTheDocument()
  })

  it('fetches pending drops only when the tab is opened', async () => {
    render(<KollabViewer {...base} isPrivileged />)
    expect(global.fetch).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('tab', { name: /pending/i }))
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/hubs/hub1/drops?status=pending')
    })
  })

  it('closes on Escape', async () => {
    const onClose = vi.fn()
    render(<KollabViewer {...base} isPrivileged={false} onClose={onClose} />)
    await userEvent.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('moves an approved drop out of Pending and into Approved', async () => {
    ;(global.fetch as any) = vi.fn(async (url: string, init?: any) => {
      if (init?.method === 'PATCH') return { ok: true, json: async () => ({ ok: true, status: 'approved' }) }
      return { ok: true, json: async () => ({ drops: [drop({ id: 'p1', status: 'pending' })], nextCursor: null }) }
    })
    render(<KollabViewer {...base} isPrivileged />)
    await userEvent.click(screen.getByRole('tab', { name: /pending/i }))
    await screen.findByRole('button', { name: /approve/i })
    await userEvent.click(screen.getByRole('button', { name: /approve/i }))
    await waitFor(() => {
      expect(screen.getByText('Nothing waiting for review.')).toBeInTheDocument()
    })
    expect(screen.getByRole('tab', { name: /approved \(2\)/i })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run src/components/hub/community/KollabViewer.test.tsx`
Expected: FAIL — `Failed to resolve import "./KollabViewer"`.

- [ ] **Step 3: Implement**

Create `src/components/hub/community/KollabViewer.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'
import { X, Loader2 } from 'lucide-react'
import type { DropDTO } from '@/lib/hub-drops'
import { KollabGrid } from './KollabGrid'

type Tab = 'approved' | 'pending'

export function KollabViewer({
  hubId, isPrivileged, currentUserId, initialDrops, total, onClose, onApprovedCountChange, onPendingCountChange,
}: {
  hubId: string
  isPrivileged: boolean
  currentUserId?: string
  initialDrops: DropDTO[]
  total: number
  onClose: () => void
  onApprovedCountChange: (delta: number) => void
  onPendingCountChange: (delta: number) => void
}) {
  const [tab, setTab] = useState<Tab>('approved')
  const [approved, setApproved] = useState<DropDTO[]>(initialDrops)
  const [approvedTotal, setApprovedTotal] = useState(total)
  const [pending, setPending] = useState<DropDTO[]>([])
  const [pendingLoaded, setPendingLoaded] = useState(false)
  const [cursor, setCursor] = useState<string | null>(initialDrops.length < total ? initialDrops[initialDrops.length - 1]?.id ?? null : null)
  const [busy, setBusy] = useState(false)
  const [lightbox, setLightbox] = useState<DropDTO | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (lightbox) setLightbox(null)
      else onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lightbox, onClose])

  // Pending is fetched lazily: a plain visitor never triggers the privileged
  // request at all, and a moderator only pays for it if they open the tab.
  async function openPending() {
    setTab('pending')
    if (pendingLoaded) return
    setBusy(true)
    try {
      const res = await fetch(`/api/hubs/${hubId}/drops?status=pending`)
      if (res.ok) {
        const d = await res.json()
        setPending(d.drops ?? [])
      }
      setPendingLoaded(true)
    } finally {
      setBusy(false)
    }
  }

  async function loadMoreApproved() {
    if (!cursor || busy) return
    setBusy(true)
    try {
      const res = await fetch(`/api/hubs/${hubId}/drops?status=approved&cursor=${encodeURIComponent(cursor)}`)
      if (!res.ok) return
      const d = await res.json()
      const fresh: DropDTO[] = d.drops ?? []
      setApproved((cur) => {
        const seen = new Set(cur.map((x) => x.id))
        return [...cur, ...fresh.filter((x) => !seen.has(x.id))]
      })
      setCursor(d.nextCursor ?? null)
    } finally {
      setBusy(false)
    }
  }

  async function review(id: string, action: 'approve' | 'reject') {
    if (action === 'reject' && !confirm('Reject this? The file will be deleted permanently.')) return
    const item = pending.find((d) => d.id === id)
    if (!item) return
    // Optimistic: pull it out of Pending first, put it back if the call fails.
    setPending((cur) => cur.filter((d) => d.id !== id))
    onPendingCountChange(-1)
    if (action === 'approve') {
      setApproved((cur) => [{ ...item, status: 'approved' }, ...cur])
      setApprovedTotal((c) => c + 1)
      onApprovedCountChange(1)
    }
    const res = await fetch(`/api/hubs/${hubId}/drops/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }),
    })
    if (!res.ok) {
      setPending((cur) => [item, ...cur])
      onPendingCountChange(1)
      if (action === 'approve') {
        setApproved((cur) => cur.filter((d) => d.id !== id))
        setApprovedTotal((c) => Math.max(0, c - 1))
        onApprovedCountChange(-1)
      }
      setError('That didn’t go through. Try again.')
    }
  }

  async function remove(id: string) {
    if (!confirm('Remove this from the pool?')) return
    const res = await fetch(`/api/hubs/${hubId}/drops/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setApproved((cur) => cur.filter((d) => d.id !== id))
      setApprovedTotal((c) => Math.max(0, c - 1))
      onApprovedCountChange(-1)
    }
  }

  const tabClass = (active: boolean) =>
    `rounded-lg px-3 py-1.5 text-sm font-medium ${active ? 'bg-[#FF6B3D] text-white' : 'text-muted-foreground hover:bg-muted'}`

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Kollab"
        className="flex max-h-[85vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-surface shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-border p-4">
          <div role="tablist" className="flex gap-1">
            <button role="tab" aria-selected={tab === 'approved'} onClick={() => setTab('approved')} className={tabClass(tab === 'approved')}>
              Approved ({approvedTotal})
            </button>
            {isPrivileged && (
              <button role="tab" aria-selected={tab === 'pending'} onClick={openPending} className={tabClass(tab === 'pending')}>
                Pending ({pending.length})
              </button>
            )}
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-md p-1 text-muted-foreground hover:bg-muted">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {error && <p className="mb-3 text-xs text-destructive">{error}</p>}
          {busy && !pendingLoaded && tab === 'pending' ? (
            <div className="py-12 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : (
            <KollabGrid
              drops={tab === 'approved' ? approved : pending}
              mode={tab}
              hubId={hubId}
              currentUserId={currentUserId}
              isPrivileged={isPrivileged}
              onOpen={setLightbox}
              onApprove={(id) => review(id, 'approve')}
              onReject={(id) => review(id, 'reject')}
              onRemove={remove}
            />
          )}

          {tab === 'approved' && cursor && (
            <div className="mt-4 text-center">
              <button onClick={loadMoreApproved} disabled={busy} className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm hover:bg-muted disabled:opacity-60">
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                {busy ? 'Loading…' : 'Load more'}
              </button>
            </div>
          )}
        </div>
      </div>

      {lightbox && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4" onClick={() => setLightbox(null)}>
          <button className="absolute right-4 top-4 text-white" aria-label="Close preview" onClick={() => setLightbox(null)}><X className="h-6 w-6" /></button>
          <div className="max-h-[90vh] max-w-3xl" onClick={(e) => e.stopPropagation()}>
            {lightbox.type === 'video' ? (
              <video src={lightbox.url} controls autoPlay className="max-h-[80vh] w-full rounded-lg" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={lightbox.url} alt={lightbox.caption || ''} className="max-h-[80vh] w-full rounded-lg object-contain" />
            )}
            <p className="mt-2 text-center text-sm text-white/80">
              {lightbox.caption} <span className="text-white/50">· {lightbox.author.name || lightbox.author.username}</span>
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm exec vitest run src/components/hub/community/KollabViewer.test.tsx`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/hub/community/KollabViewer.tsx src/components/hub/community/KollabViewer.test.tsx
git commit -m "feat(hub): Kollab viewer modal with approved/pending tabs"
```

---

### Task 10: Rewire `CommunityKollab` as the container

**Files:**
- Modify: `src/components/hub/community/CommunityKollab.tsx` (replace everything from line 39 to the end; keep `captureVideoPoster` at lines 10-37 unchanged)
- Modify: `src/components/hub/community/CommunityKollab.test.tsx` (replace both existing tests)
- Modify: `src/components/hub/community/CommunityHubView.tsx:100-116`
- Modify: `src/app/[username]/hub/[slug]/page.tsx` (the `dropRows`, `dropsCount`, `newDropsCount` queries and the `CommunityHubView` props)

**Interfaces:**
- Consumes: `KollabTile` (Task 7), `KollabViewer` (Task 9), `nextStatusFor` semantics from Task 4's `201 { id, status }` response.
- Produces: `CommunityKollab` props become `{ hubId, hubTitle, canDrop, isPrivileged, currentUserId, enabled, initialDrops, total, pendingCount, preview, narrow }` — the `requireApproval` prop is **removed** and `narrow` is now unused by the tile but kept in the signature so `HubBuilderPreview` does not need changing.

- [ ] **Step 1: Write the failing test**

Replace the contents of `src/components/hub/community/CommunityKollab.test.tsx` with:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CommunityKollab } from './CommunityKollab'
import type { DropDTO } from '@/lib/hub-drops'

const drop = (over: Partial<DropDTO> = {}): DropDTO => ({
  id: 'd1', type: 'image', url: 'https://x/a.jpg', thumbnailUrl: null, caption: null,
  mimeType: null, width: null, height: null, status: 'approved',
  createdAt: '2026-07-21T00:00:00.000Z',
  author: { userId: 'u1', username: 'sam', name: 'Sam', avatar: null },
  ...over,
})

const base = {
  hubId: 'hub1', hubTitle: 'Frog Club', canDrop: true, isPrivileged: false,
  currentUserId: 'u1', enabled: true, initialDrops: [drop()], total: 1, pendingCount: 0,
}

beforeEach(() => {
  global.fetch = vi.fn(async () => ({ ok: true, json: async () => ({ drops: [], nextCursor: null }) })) as any
})

describe('CommunityKollab', () => {
  it('renders the tile, not a thumbnail grid', () => {
    const { container } = render(<CommunityKollab {...base} />)
    expect(screen.getByRole('img', { name: 'Kollab' })).toBeInTheDocument()
    expect(container.querySelectorAll('img[src="https://x/a.jpg"]')).toHaveLength(0)
  })

  it('renders nothing when the pool is disabled', () => {
    const { container } = render(<CommunityKollab {...base} enabled={false} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('opens the viewer from See content', async () => {
    render(<CommunityKollab {...base} />)
    await userEvent.click(screen.getByRole('button', { name: /see content/i }))
    expect(screen.getByRole('dialog', { name: 'Kollab' })).toBeInTheDocument()
  })

  it('surfaces the pending count to a moderator', () => {
    render(<CommunityKollab {...base} isPrivileged pendingCount={2} />)
    expect(screen.getByText('2 awaiting review')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run src/components/hub/community/CommunityKollab.test.tsx`
Expected: FAIL — no `img` with accessible name `Kollab`; the old heading-and-grid markup renders instead.

- [ ] **Step 3: Rewrite the container**

In `src/components/hub/community/CommunityKollab.tsx`, keep lines 1-37 but change the import block at lines 3-8 to:

```tsx
import { useRef, useState } from 'react'
import { upload } from '@vercel/blob/client'
import { dropPathPrefix, type DropDTO } from '@/lib/hub-drops'
import { consentTextFor } from '@/lib/hub-consent'
import { KollabTile } from './KollabTile'
import { KollabViewer } from './KollabViewer'
```

Then replace everything from line 39 (`export function CommunityKollab({`) to the end of the file with:

```tsx
export function CommunityKollab({
  hubId, hubTitle, canDrop, isPrivileged, currentUserId, enabled, initialDrops, total, pendingCount, preview,
}: {
  hubId: string
  hubTitle: string
  canDrop: boolean
  isPrivileged: boolean
  currentUserId?: string
  enabled: boolean
  initialDrops: DropDTO[]
  total: number
  pendingCount: number
  preview?: boolean
  /** Retained for call-site compatibility; the tile is the same at any width. */
  narrow?: boolean
}) {
  const [drops, setDrops] = useState<DropDTO[]>(initialDrops)
  const [count, setCount] = useState(total)
  const [pending, setPending] = useState(pendingCount)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [viewerOpen, setViewerOpen] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  if (!enabled) return null

  const uploadUrl = `/api/hubs/${hubId}/drops/upload`

  async function handleFiles(files: FileList | null) {
    if (!files || preview) return
    setError(null)
    setNotice(null)
    for (const file of Array.from(files)) {
      const isVideo = file.type.startsWith('video/')
      const isImage = file.type.startsWith('image/')
      if (!isVideo && !isImage) { setError('Only photos and video are allowed'); continue }
      setUploading(true)
      try {
        // Must sit under this hub's namespace — the token route refuses anything else.
        const prefix = dropPathPrefix(hubId)
        const blob = await upload(`${prefix}${file.name}`, file, { access: 'public', handleUploadUrl: uploadUrl })
        let thumbnailUrl: string | null = null
        if (isVideo) {
          const poster = await captureVideoPoster(file)
          if (poster) {
            const pb = await upload(`${prefix}${file.name}.poster.jpg`, poster, { access: 'public', handleUploadUrl: uploadUrl })
            thumbnailUrl = pb.url
          }
        }
        const res = await fetch(`/api/hubs/${hubId}/drops`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: isVideo ? 'video' : 'image', url: blob.url, thumbnailUrl, mimeType: file.type }),
        })
        if (!res.ok) { setError((await res.json()).error || 'Upload failed'); continue }
        // The server decides the status — never assume from the client's own
        // idea of who is privileged.
        const { id, status } = await res.json()
        if (status === 'approved') {
          const me = { userId: currentUserId || '', username: 'you', name: null, avatar: null }
          setDrops((cur) => [{ id, type: isVideo ? 'video' : 'image', url: blob.url, thumbnailUrl, caption: null, mimeType: file.type, width: null, height: null, status: 'approved', createdAt: new Date().toISOString(), author: me }, ...cur])
          setCount((c) => c + 1)
        } else {
          setNotice('Uploaded — the owner will review it before it appears.')
          if (isPrivileged) setPending((p) => p + 1)
        }
      } catch (e) {
        setError((e as Error).message || 'Upload failed')
      } finally {
        setUploading(false)
      }
    }
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <>
      <KollabTile
        count={count}
        pendingCount={pending}
        canDrop={canDrop}
        isPrivileged={isPrivileged}
        uploading={uploading}
        onDrop={() => fileRef.current?.click()}
        onSee={() => setViewerOpen(true)}
      />

      <input ref={fileRef} type="file" accept="image/*,video/*" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />
      {canDrop && <p className="mt-2 text-center text-[11px] text-muted-foreground">{consentTextFor(hubTitle)}</p>}
      {error && <p className="mt-2 text-center text-xs text-destructive">{error}</p>}
      {notice && <p className="mt-2 text-center text-xs text-[#FF6B3D]">{notice}</p>}

      {viewerOpen && !preview && (
        <KollabViewer
          hubId={hubId}
          isPrivileged={isPrivileged}
          currentUserId={currentUserId}
          initialDrops={drops}
          total={count}
          onClose={() => setViewerOpen(false)}
          onApprovedCountChange={(d) => setCount((c) => Math.max(0, c + d))}
          onPendingCountChange={(d) => setPending((p) => Math.max(0, p + d))}
        />
      )}
    </>
  )
}
```

- [ ] **Step 4: Update the two call sites**

In `src/components/hub/community/CommunityHubView.tsx`, replace line 109 (`requireApproval={config.kollab.requireApproval}`) with:

```tsx
                pendingCount={pendingCount}
```

Then widen the component's props. Replace line 22 (the destructuring) with:

```tsx
  hub, ownerUsername, currentUserId, isPrivileged, isOwner, joined: initialJoined, memberCount: initialCount, members, resources, events, drops, pendingCount = 0, notes, counts, activity, sharePath, config, preview,
```

and insert this line into the props type immediately after `drops: DropDTO[]` (line 34):

```tsx
  /** Pending drops awaiting review. Server sends 0 to anyone who can't moderate. */
  pendingCount?: number
```

In `src/components/hub/builder/HubBuilderPreview.tsx`, no change is needed — it passes `drops={[]}` and `counts.kollab: 0`, and `pendingCount` defaults to 0.

- [ ] **Step 5: Update the public page queries**

In `src/app/[username]/hub/[slug]/page.tsx`, replace the `dropRows` query with:

```ts
      db.hubDrop.findMany({
        // The tile and viewer are the approved pool for everyone, owner included —
        // pending items are fetched separately by the viewer's Pending tab.
        where: { hubId: hub.id, status: 'approved' },
        orderBy: { createdAt: 'desc' }, take: 24,
        include: { author: { select: { id: true, username: true, name: true, avatar: true } } },
      }),
```

replace the `dropsCount` query with:

```ts
      db.hubDrop.count({ where: { hubId: hub.id, status: 'approved' } }),
```

replace the `newDropsCount` query with:

```ts
      db.hubDrop.count({ where: { hubId: hub.id, status: 'approved', createdAt: { gte: activitySince } } }),
```

Then add a pending count to the same `Promise.all` array, immediately after `newMembersCount`:

```ts
      isPrivileged ? db.hubDrop.count({ where: { hubId: hub.id, status: 'pending' } }) : Promise.resolve(0),
```

and add `pendingDropsCount` as the matching last name in the destructuring array on the first line. Pass it through to the view:

```tsx
        pendingCount={pendingDropsCount}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `pnpm exec vitest run src/components/hub/community/`
Expected: PASS — `CommunityKollab.test.tsx` (4), `CommunityHubView.test.tsx`, `CommunityUtilityStrip.test.tsx`, plus the three new component suites.

- [ ] **Step 7: Commit**

```bash
git add src/components/hub/community/CommunityKollab.tsx src/components/hub/community/CommunityKollab.test.tsx src/components/hub/community/CommunityHubView.tsx "src/app/[username]/hub/[slug]/page.tsx"
git commit -m "feat(hub): Kollab column becomes the branded tile + viewer"
```

---

### Task 11: Retire `requireApproval` from config and the Builder

**Files:**
- Modify: `src/lib/types/hub-config.ts:15` and `:32`
- Modify: `src/lib/hub-config.ts:69-73`
- Modify: `src/components/hub/builder/LayoutSectionsSection.tsx:77-90`
- Modify: `src/components/hub/builder/HubDropsModal.tsx:33-36` and `:56` and `:65-67`
- Test: `src/lib/hub-config.kollab.test.ts`

**Interfaces:**
- Consumes: the `PATCH { action }` contract from Task 5.
- Produces: `HubConfig['kollab']` becomes `{ enabled: boolean; whoCanDrop: HubWhoCanDrop }`.

- [ ] **Step 1: Write the failing test**

In `src/lib/hub-config.kollab.test.ts`, **delete** any test asserting a `requireApproval` default, and append:

```ts
it('drops a legacy requireApproval key without throwing', () => {
  const c = sanitizeHubConfig({ kollab: { enabled: true, whoCanDrop: 'members', requireApproval: true } })
  expect(c.kollab).toEqual({ enabled: true, whoCanDrop: 'members' })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run src/lib/hub-config.kollab.test.ts`
Expected: FAIL — the returned object still carries `requireApproval: true`.

- [ ] **Step 3: Remove the field from the type and default**

In `src/lib/types/hub-config.ts`, change line 15 to:

```ts
  kollab: { enabled: boolean; whoCanDrop: HubWhoCanDrop }
```

and line 32 to:

```ts
  kollab: { enabled: true, whoCanDrop: 'members' },
```

- [ ] **Step 4: Remove it from the sanitizer**

In `src/lib/hub-config.ts`, replace lines 69-73 with:

```ts
    // A legacy `requireApproval` key on a stored config is ignored, not an
    // error — review is mandatory now, so there is nothing left to configure.
    kollab: {
      enabled: bool(kollabRaw.enabled, DEFAULT_HUB_CONFIG.kollab.enabled),
      whoCanDrop,
    },
```

- [ ] **Step 5: Remove the Builder toggle**

In `src/components/hub/builder/LayoutSectionsSection.tsx`, delete the entire block at lines 77-90 (the `{config.kollab.enabled && (` section containing "Require approval for member uploads"). Immediately after the "Who can drop" block that ends at line 76, add:

```tsx
        {config.kollab.enabled && (
          <p className="mt-2 text-xs text-muted-foreground">
            Member uploads always wait for your approval — review them from the Kollab tile on your community page.
          </p>
        )}
```

- [ ] **Step 6: Fix `HubDropsModal` for the new DTO**

`HubDropsModal` reads `d.hidden`, which no longer exists. It lists approved drops only (the API default) and its Hide toggle is now a Reject. Replace lines 33-36 with:

```tsx
  async function reject(d: DropDTO) {
    if (!window.confirm('Reject this drop? The file will be deleted permanently.')) return
    const res = await fetch(`/api/hubs/${hubId}/drops/${d.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'reject' }) })
    if (res.ok) setDrops((cur) => cur.filter((x) => x.id !== d.id))
  }
```

Replace line 56's className expression with:

```tsx
              <div key={d.id} className="relative aspect-square overflow-hidden rounded-lg border border-border bg-muted">
```

and replace the Hide/Unhide button at lines 65-67 with:

```tsx
                  <button onClick={() => reject(d)} title="Reject" className="rounded bg-black/60 p-1 text-white hover:bg-black/80">
                    <EyeOff className="h-3.5 w-3.5" />
                  </button>
```

Then remove `Eye` from the `lucide-react` import on line 4 (leaving `X, Trash2, EyeOff`).

- [ ] **Step 7: Run the tests to verify they pass**

Run: `pnpm exec vitest run src/lib/hub-config.kollab.test.ts src/components/hub/builder/`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/lib/types/hub-config.ts src/lib/hub-config.ts src/lib/hub-config.kollab.test.ts src/components/hub/builder/LayoutSectionsSection.tsx src/components/hub/builder/HubDropsModal.tsx
git commit -m "refactor(hub): retire the optional drop-approval setting"
```

---

### Task 12: Full verification + runtime smoke

**Files:** none created; this task fixes whatever the gates surface.

**Interfaces:**
- Consumes: everything from Tasks 1-11.
- Produces: a branch that passes `tsc`, `next lint`, and the full test suite, with a recorded runtime smoke result.

- [ ] **Step 1: Typecheck the whole project**

Run: `pnpm exec tsc --noEmit`
Expected: no output, exit 0. Any residual `.hidden` reference on a `DropDTO` or `config.kollab.requireApproval` access surfaces here — fix each at its call site.

- [ ] **Step 2: Lint**

Run: `pnpm exec next lint`
Expected: `✔ No ESLint warnings or errors`.

`tsc` does not run ESLint and a lint error fails the production build, so this gate is not optional. If the worktree's nested `.claude/worktrees` path causes an ESLint plugin conflict, add `root: true` to the local ESLint config and invoke `eslint` directly rather than skipping the gate.

- [ ] **Step 3: Run the full test suite**

Run: `pnpm test`
Expected: all files pass.

If the run reports "errors" or `1 failed` with no named failing test, check whether `passed + errors === total files` — that pattern is a worker-spawn timeout under machine load, not a real failure. Re-run only the skipped files to confirm.

- [ ] **Step 4: Verify no dead references remain**

Run:
```bash
grep -rn "requireApproval" src/ ; grep -rn "\.hidden" src/components/hub src/app/api/hubs
```
Expected: no matches in `src/`. The only permitted `hidden` writes are the two rollback-safety lines in `drops/route.ts` and `drops/[dropId]/route.ts` — confirm those are the only hits and that nothing *reads* the field.

- [ ] **Step 5: Runtime smoke against a real dev server**

Start the dev server (`pnpm dev`) with `DATABASE_URL` set to the override from Global Constraints. Using a forged `galli-auth` cookie signed with the `.env` `JWT_SECRET`, verify against a real community hub:

1. `GET /api/hubs/<id>/drops` as an anonymous visitor → 200, and every returned drop has `status: 'approved'`.
2. `GET /api/hubs/<id>/drops?status=pending` as an anonymous visitor → **403**.
3. `POST /api/hubs/<id>/drops` as a plain member with a valid `hub-drops/<hubId>/…` URL → 201 with `status: 'pending'`; confirm in the DB that the row is `status='pending'`, `hidden=true`.
4. `GET /api/hubs/<id>/drops` as that same member → the new drop is **absent**.
5. `PATCH /api/hubs/<id>/drops/<dropId>` as that member with `{"action":"approve"}` → **403**.
6. Same PATCH as the owner → 200; the row becomes `status='approved'`, `reviewedById` = owner id, `reviewedAt` set.
7. `PATCH {"action":"reject"}` as the owner on a second pending drop → 200; row is `status='rejected'`, and `GET` on the public list still omits it.
8. Load the published hub page as an anonymous visitor and confirm the HTML contains the Kollab tile and **no URL** of any pending or rejected asset.

Record the actual observed result for each of the 8 steps. Do not claim this task complete on the basis of the tests alone — step 8 is the one that proves the no-leak model in the real runtime.

- [ ] **Step 6: Browser smoke**

Using the `superpowers-chrome:browsing` skill, drive a real Chrome session against the dev server:
1. As the owner, open the hub page — the tile renders with the orange wordmark and the amber "N awaiting review" line.
2. Click **See content** — the modal opens with both tabs.
3. Open **Pending**, click **Approve** on an item — it moves to Approved and both counts update without a reload.
4. Reload as a logged-out visitor — the tile shows no badge, and the Pending tab is absent.

Capture a screenshot of the tile and of the viewer. If Chrome is unavailable in this session, state plainly that the browser smoke was NOT run rather than implying it passed.

- [ ] **Step 7: Commit any fixes**

```bash
git add -A ':!Documents' ':!Images' ':!g1t.json' ':!nul' ':!.claude/settings.local.json'
git commit -m "fix(hub): verification gate fixes for the Kollab tile"
```

If no fixes were needed, skip the commit and say so.

---

## Follow-ups (not in this plan)

- Drop the `hidden` column in a later migration once this deploy is stable.
- `ModerationQueue.tsx:49` PATCHes `status: 'actioned'`, but `reports/[reportId]/route.ts:6` only accepts `['open','resolved','dismissed']` — the call 400s silently and the report stays `open`. Pre-existing; not touched here.
- A reported drop still cannot be actioned from the moderation queue — the queue shows no thumbnail and no per-drop action.
- Kollab AI stitching engine — the future occupant of this column.
