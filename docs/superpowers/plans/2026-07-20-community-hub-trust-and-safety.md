# Community Hub Trust & Safety Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give community hubs a real trust layer — report content, remove and ban members, optionally gate member uploads behind owner approval, and record consent when members contribute clips.

**Architecture:** Two new models (`HubReport`, `HubBan`) and one new column (`HubDrop.consentText`) in a single additive migration. Ban enforcement rides on `canParticipate`, whose signature gains a **required** parameter so the compiler finds every call site. The approval gate reuses the existing `HubDrop.hidden` flag and the builder's existing unhide control.

**Tech Stack:** Next.js 15.5.19 App Router, React 19, TypeScript, Tailwind, Prisma/PostgreSQL, Vitest.

## Global Constraints

- Worktree `C:\Users\whirl\pages-mvp\.claude\worktrees\community-safety`, branch `feat/community-safety`. **Run `git branch --show-current` before every commit** — concurrent sessions share checkouts in this repo.
- **Migrations are non-interactive here. NEVER run `prisma migrate dev`.** `migrate diff --from-url` is contaminated on the shared dev DB by other branches' tables and will emit spurious `DROP TABLE`s. **Hand-author `migration.sql` containing only this milestone's statements**, then `prisma migrate deploy`. Prisma commands need `DATABASE_URL_UNPOOLED` set alongside `DATABASE_URL`.
- Local DB: `postgresql://pages:pages@127.0.0.1:5434/pages` — **use `127.0.0.1`, never `localhost`** (Node resolves localhost to IPv6 where Postgres isn't listening). `docker start pages-mvp-postgres-1` if it isn't running.
- Server-side authorization only. Never rely on hidden UI as a gate.
- Tests: `npx vitest run <path>`; set `JWT_SECRET=test-secret-for-local-run-only-1234567890` if needed.
- Component tests use **`fireEvent` from `@testing-library/react`**. `@testing-library/user-event` is NOT a dependency.
- Lint in a worktree: temporarily write `{ "root": true, "extends": "next/core-web-vitals" }` to `.eslintrc.json`, run `npx eslint . --ext .ts,.tsx`, then `git checkout -- .eslintrc.json`. `next lint` fails in a worktree.
- Do NOT add an `eslint-disable` for a rule this ESLint config doesn't define — that is itself a lint error.
- If `tsc` reports unknown Prisma models, run `npx prisma generate` in the worktree.

---

### Task 1: Schema — `HubReport`, `HubBan`, `HubDrop.consentText`

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260720000000_hub_trust_safety/migration.sql`

**Interfaces:**
- Produces: Prisma models `HubReport`, `HubBan`; `HubDrop.consentText String?`. Every later task depends on these.

- [ ] **Step 1: Add the models to `prisma/schema.prisma`**

```prisma
model HubReport {
  id           String    @id @default(cuid())
  hubId        String
  hub          Hub       @relation(fields: [hubId], references: [id], onDelete: Cascade)
  reporterId   String
  reporter     User      @relation("HubReportReporter", fields: [reporterId], references: [id], onDelete: Cascade)
  targetType   String
  targetId     String
  reason       String
  note         String?
  status       String    @default("open")
  createdAt    DateTime  @default(now())
  resolvedAt   DateTime?
  resolvedById String?
  @@unique([hubId, reporterId, targetType, targetId])
  @@index([hubId, status])
}

model HubBan {
  id         String   @id @default(cuid())
  hubId      String
  hub        Hub      @relation(fields: [hubId], references: [id], onDelete: Cascade)
  userId     String
  user       User     @relation("HubBanUser", fields: [userId], references: [id], onDelete: Cascade)
  bannedById String
  reason     String?
  createdAt  DateTime @default(now())
  @@unique([hubId, userId])
  @@index([hubId])
}
```

Add `consentText String?` to `model HubDrop`.

Add the back-relations Prisma requires: on `model Hub` add `hubReports HubReport[]` and `hubBans HubBan[]`; on `model User` add `hubReports HubReport[] @relation("HubReportReporter")` and `hubBans HubBan[] @relation("HubBanUser")`.

- [ ] **Step 2: Hand-author the migration**

Create `prisma/migrations/20260720000000_hub_trust_safety/migration.sql` with ONLY these statements:

```sql
-- CreateTable
CREATE TABLE "HubReport" (
    "id" TEXT NOT NULL,
    "hubId" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "note" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" TEXT,
    CONSTRAINT "HubReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HubBan" (
    "id" TEXT NOT NULL,
    "hubId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bannedById" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HubBan_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "HubDrop" ADD COLUMN "consentText" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "HubReport_hubId_reporterId_targetType_targetId_key" ON "HubReport"("hubId", "reporterId", "targetType", "targetId");
CREATE INDEX "HubReport_hubId_status_idx" ON "HubReport"("hubId", "status");
CREATE UNIQUE INDEX "HubBan_hubId_userId_key" ON "HubBan"("hubId", "userId");
CREATE INDEX "HubBan_hubId_idx" ON "HubBan"("hubId");

-- AddForeignKey
ALTER TABLE "HubReport" ADD CONSTRAINT "HubReport_hubId_fkey" FOREIGN KEY ("hubId") REFERENCES "Hub"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HubReport" ADD CONSTRAINT "HubReport_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HubBan" ADD CONSTRAINT "HubBan_hubId_fkey" FOREIGN KEY ("hubId") REFERENCES "Hub"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HubBan" ADD CONSTRAINT "HubBan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

- [ ] **Step 3: Apply and regenerate**

```bash
export DATABASE_URL="postgresql://pages:pages@127.0.0.1:5434/pages"
export DATABASE_URL_UNPOOLED="$DATABASE_URL"
npx prisma migrate deploy
npx prisma generate
```
Expected: migration applied, client regenerated.

- [ ] **Step 4: Prove there is no schema drift**

```bash
npx prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --shadow-database-url "postgresql://pages:pages@127.0.0.1:5434/pages_shadow_ts" --script
```
Create `pages_shadow_ts` first if needed. Expected output: **`-- This is an empty migration.`** Anything else means the hand-authored SQL disagrees with the schema — fix it now; a mismatch becomes a P2022 500 on a fresh production database.

- [ ] **Step 5: Verify tsc + commit**

Run `npx tsc --noEmit` → 0 errors.

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(safety): HubReport + HubBan models and drop consent column"
```

---

### Task 2: Ban enforcement in `canParticipate`

**Files:**
- Modify: `src/lib/community.ts`
- Modify (all 6 call sites): `src/app/api/hubs/[id]/drops/route.ts`, `.../drops/upload/route.ts`, `.../posts/route.ts`, `.../posts/[postId]/comments/route.ts`, `.../posts/[postId]/reactions/route.ts`, `.../posts/[postId]/respond/route.ts`
- Modify: `src/app/api/hubs/[id]/join/route.ts`
- Test: `src/lib/community.test.ts` (existing — append)

**Interfaces:**
- Consumes: `HubBan` (Task 1).
- Produces: `canParticipate(userId, hub, collaboratorIds, isMember, isBanned)` — **`isBanned` is a REQUIRED 5th parameter**; `isUserBanned(hubId, userId): Promise<boolean>` in `src/lib/community.ts`.

**Why a required parameter:** a ban that only guards the join route is worthless — a banned member is already a member and keeps posting. Making the parameter required means **TypeScript fails the build at every call site that hasn't been updated**, so none can be silently missed. Do not make it optional.

- [ ] **Step 1: Write the failing test**

Append to `src/lib/community.test.ts`:

```ts
describe('canParticipate — banned users', () => {
  const hub = { userId: 'owner' }

  it('refuses a banned member even though a membership row exists', () => {
    expect(canParticipate('member', hub, [], true, true)).toBe(false)
  })

  it('still allows an unbanned member', () => {
    expect(canParticipate('member', hub, [], true, false)).toBe(true)
  })

  // A ban must never lock the owner out of their own hub.
  it('never locks out the owner', () => {
    expect(canParticipate('owner', hub, [], false, true)).toBe(true)
  })

  it('refuses a banned collaborator', () => {
    expect(canParticipate('collab', hub, ['collab'], false, true)).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/community.test.ts`
Expected: FAIL — `canParticipate` takes 4 arguments.

- [ ] **Step 3: Change the helper**

In `src/lib/community.ts` replace `canParticipate` with:

```ts
export function canParticipate(
  userId: string,
  hub: { userId: string },
  collaboratorIds: string[],
  isMember: boolean,
  isBanned: boolean,
): boolean {
  // The owner can never be banned out of their own hub.
  if (userId === hub.userId) return true
  if (isBanned) return false
  return collaboratorIds.includes(userId) || isMember
}
```

Add below it:

```ts
import { db } from '@/lib/db'

export async function isUserBanned(hubId: string, userId: string): Promise<boolean> {
  const row = await db.hubBan.findUnique({
    where: { hubId_userId: { hubId, userId } },
    select: { id: true },
  })
  return !!row
}
```

If `src/lib/community.ts` is currently db-free and imported by client code, do NOT add the db import there — put `isUserBanned` in a new `src/lib/hub-bans.ts` instead and keep `community.ts` pure. **Check before choosing**, the same way `notifications-format.ts` is kept separate from `notifications.ts` in this repo.

- [ ] **Step 4: Update every call site**

Run `npx tsc --noEmit` and fix **each** reported call site by computing `isBanned` next to the existing `isMember` lookup and passing it. Pattern:

```ts
const isBanned = await isUserBanned(id, me.id)
// ...
canParticipate(me.id, hub, collabIds, isMember, isBanned)
```

The six call sites are listed under **Files** above. `tsc` returning 0 errors is your proof none was missed.

- [ ] **Step 5: Block the join route**

In `src/app/api/hubs/[id]/join/route.ts` POST, after the owner check and before the membership create:

```ts
  if (await isUserBanned(id, me.id)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
```

- [ ] **Step 6: Run tests + commit**

Run: `npx vitest run src/lib/community.test.ts && npx tsc --noEmit` → PASS / 0 errors.

```bash
git add src/lib src/app/api/hubs
git commit -m "feat(safety): bans block participation everywhere, not just join"
```

---

### Task 3: Report validation helper

**Files:**
- Create: `src/lib/hub-reports.ts`
- Test: `src/lib/hub-reports.test.ts`

**Interfaces:**
- Produces: `REPORT_REASONS`, `ReportTargetType`, `validateReportInput(raw)` → `{ ok: true; value: { targetType, targetId, reason, note } } | { ok: false; error: string }`. Task 4 consumes it.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { validateReportInput, REPORT_REASONS } from './hub-reports'

const valid = { targetType: 'post', targetId: 'p1', reason: 'spam' }

describe('validateReportInput', () => {
  it('accepts a valid report', () => {
    const r = validateReportInput(valid)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value).toEqual({ targetType: 'post', targetId: 'p1', reason: 'spam', note: null })
  })

  it('accepts every documented reason', () => {
    for (const reason of REPORT_REASONS) {
      expect(validateReportInput({ ...valid, reason }).ok).toBe(true)
    }
  })

  it('rejects a reason outside the vocabulary', () => {
    expect(validateReportInput({ ...valid, reason: 'because' })).toEqual({ ok: false, error: 'Invalid reason' })
  })

  it('rejects an unknown target type', () => {
    expect(validateReportInput({ ...valid, targetType: 'hub' })).toEqual({ ok: false, error: 'Invalid target' })
  })

  it('rejects a missing or non-string target id', () => {
    expect(validateReportInput({ ...valid, targetId: '' }).ok).toBe(false)
    expect(validateReportInput({ ...valid, targetId: 42 }).ok).toBe(false)
  })

  it('truncates an overlong note to 500 chars', () => {
    const r = validateReportInput({ ...valid, note: 'x'.repeat(900) })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value.note?.length).toBe(500)
  })

  it('does not throw on hostile input', () => {
    for (const bad of [null, undefined, 'string', 42, []]) {
      expect(validateReportInput(bad).ok).toBe(false)
    }
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/hub-reports.test.ts` → FAIL, module not found.

- [ ] **Step 3: Implement**

```ts
export const REPORT_REASONS = ['spam', 'harassment', 'explicit', 'violence', 'other'] as const
export type ReportReason = (typeof REPORT_REASONS)[number]

export const REPORT_TARGET_TYPES = ['post', 'comment', 'drop', 'member'] as const
export type ReportTargetType = (typeof REPORT_TARGET_TYPES)[number]

export type NormalizedReport = {
  targetType: ReportTargetType
  targetId: string
  reason: ReportReason
  note: string | null
}

export function validateReportInput(
  raw: unknown,
): { ok: true; value: NormalizedReport } | { ok: false; error: string } {
  const r = (raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}) as Record<string, any>
  const targetType = r.targetType
  if (!(REPORT_TARGET_TYPES as readonly string[]).includes(targetType)) return { ok: false, error: 'Invalid target' }
  const targetId = typeof r.targetId === 'string' ? r.targetId.trim() : ''
  if (!targetId) return { ok: false, error: 'Invalid target' }
  const reason = r.reason
  if (!(REPORT_REASONS as readonly string[]).includes(reason)) return { ok: false, error: 'Invalid reason' }
  const note = typeof r.note === 'string' && r.note.trim() ? r.note.trim().slice(0, 500) : null
  return { ok: true, value: { targetType, targetId, reason, note } }
}
```

- [ ] **Step 4: Run test + commit**

Run: `npx vitest run src/lib/hub-reports.test.ts` → PASS (7 tests).

```bash
git add src/lib/hub-reports.ts src/lib/hub-reports.test.ts
git commit -m "feat(safety): report input validation"
```

---

### Task 4: Reports API

**Files:**
- Create: `src/app/api/hubs/[id]/reports/route.ts` (POST, GET)
- Create: `src/app/api/hubs/[id]/reports/[reportId]/route.ts` (PATCH)
- Test: `src/app/api/hubs/[id]/reports/route.test.ts`

**Interfaces:**
- Consumes: `validateReportInput` (Task 3), `canParticipate`/`canModerate`/`isUserBanned` (Task 2), `HubReport` (Task 1).
- Produces: the three routes. Task 6/7 UI consumes them.

**Security rules that must hold:**
- The target must exist **and belong to this hub**; otherwise **404, never 403** — this route must not become an enumeration oracle for hidden or deleted content.
- A duplicate report (same reporter, same target) is a **200 no-op**, never an error that reveals prior state.
- `GET` is `canModerate`-only. Reporter identity is never exposed to non-moderators.
- `PATCH` is IDOR-scoped: `findFirst({ id: reportId, hubId })` → 404.

- [ ] **Step 1: Write the failing test**

Mirror the mocking style of `src/app/api/hubs/[id]/drops/route.test.ts` (`vi.mock` for `@/lib/auth`, `@/lib/rate-limit`, `@/lib/notifications`, `@/lib/db`). Cover:

```ts
// POST
it('401 when logged out')
it('403 for a non-member')                       // canParticipate false
it('403 for a banned member')                    // isUserBanned true
it('404 when the target belongs to another hub') // NOT 403 — no enumeration oracle
it('404 when the target does not exist')
it('400 on an invalid reason')
it('201 for a valid report + notifies moderators')
it('200 no-op on a duplicate report')            // unique-constraint path, no error leak

// GET
it('403 for a member (moderators only)')
it('returns open reports for a moderator')

// PATCH
it('403 for a non-moderator')
it('404 for a report belonging to another hub')  // IDOR
it('sets status and stamps resolvedAt/resolvedById')
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run "src/app/api/hubs/[id]/reports/route.test.ts"` → FAIL, module not found.

- [ ] **Step 3: Write the routes**

Follow the existing shape of `src/app/api/hubs/[id]/drops/route.ts` — read it first and mirror its `collaboratorIds` helper, rate-limit call, and error style.

POST outline:
```ts
const limited = await rateLimit(request, { limit: 10, windowMs: 60_000, prefix: 'hub-report-create' })
// auth -> 401
// hub must exist and be community -> 404
// canParticipate(..., isBanned) -> 403
// validateReportInput -> 400
// resolve the target for the declared type, scoped to this hub; missing -> 404
//   post    -> db.hubPost.findFirst({ where: { id, hubId } })
//   comment -> db.hubPostComment.findFirst({ where: { id, post: { hubId } } })
//   drop    -> db.hubDrop.findFirst({ where: { id, hubId } })
//   member  -> db.hubMember.findFirst({ where: { userId: targetId, hubId } })
// create with catch on unique violation -> return 200 { ok: true } (idempotent)
// notifyHubMembers(moderators, { type: 'hub_report', ... })
// 201 { id }
```

Add `hub_report` to the `NotificationType` union and a case in `src/lib/notifications-format.ts` (e.g. "reported content in {hub}"). Route the notification to owner + collaborators only.

- [ ] **Step 4: Run tests + tsc**

Run the report tests → PASS; `npx tsc --noEmit` → 0.

- [ ] **Step 5: Commit**

```bash
git add "src/app/api/hubs/[id]/reports" src/lib/notifications-format.ts
git commit -m "feat(safety): report create/list/resolve API"
```

---

### Task 5: Bans API

**Files:**
- Create: `src/app/api/hubs/[id]/bans/route.ts` (POST)
- Create: `src/app/api/hubs/[id]/bans/[userId]/route.ts` (DELETE)
- Test: `src/app/api/hubs/[id]/bans/route.test.ts`

**Interfaces:**
- Consumes: `canModerate`, `HubBan` (Task 1).
- Produces: both routes. Task 7's queue consumes them.

**Rules that must hold:**
- `canModerate` required.
- **Refuse to ban the hub owner (403)** — a collaborator must not be able to ban the owner.
- **Refuse to ban a collaborator (403)** — removing a collaborator is the existing collaborator surface.
- Refuse self-ban (400).
- Ban creation and `HubMember` deletion happen in **one transaction** (`db.$transaction`) — a ban without the membership removal leaves them a member.

- [ ] **Step 1: Write the failing test**

```ts
it('401 when logged out')
it('403 for a plain member')                  // not canModerate
it('403 when a collaborator tries to ban the owner')
it('403 when banning another collaborator')
it('400 on self-ban')
it('201 bans a member and removes their membership in one transaction')
it('DELETE lifts the ban and does not restore membership')
it('DELETE 404 for a ban in another hub')     // IDOR
```

- [ ] **Step 2: Run test to verify it fails** → module not found.

- [ ] **Step 3: Write the routes**

```ts
// POST body: { userId, reason? }
// guards in order: auth -> hub/community 404 -> canModerate 403
//   -> userId === hub.userId -> 403 'Cannot ban the owner'
//   -> collabIds.includes(userId) -> 403 'Cannot ban a collaborator'
//   -> userId === me.id -> 400
// db.$transaction([
//   db.hubBan.create({ data: { hubId: id, userId, bannedById: me.id, reason } }),
//   db.hubMember.deleteMany({ where: { hubId: id, userId } }),
// ])
// unique violation (already banned) -> 200 { ok: true }
```

`deleteMany` (not `delete`) so a non-member target doesn't throw.

- [ ] **Step 4: Run tests + tsc + commit**

```bash
git add "src/app/api/hubs/[id]/bans"
git commit -m "feat(safety): ban and unban API with owner/collaborator guards"
```

---

### Task 6: Drop approval gate + consent snapshot

**Files:**
- Create: `src/lib/hub-consent.ts` + `src/lib/hub-consent.test.ts`
- Modify: `src/lib/types/hub-config.ts`, `src/lib/hub-config.ts`
- Modify: `src/app/api/hubs/[id]/drops/route.ts`
- Modify: `src/components/hub/community/CommunityKollab.tsx`
- Test: `src/lib/hub-config.kollab.test.ts` (existing — extend)

**Interfaces:**
- Produces: `consentTextFor(hubTitle): string`; `config.kollab.requireApproval: boolean` (default **false**).

- [ ] **Step 1: Write the failing tests**

`src/lib/hub-consent.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { consentTextFor } from './hub-consent'

describe('consentTextFor', () => {
  it('names the hub in the sentence', () => {
    expect(consentTextFor('Bella’s Kitchen')).toContain('Bella’s Kitchen')
  })
  it('is a non-empty single sentence', () => {
    const t = consentTextFor('X')
    expect(t.length).toBeGreaterThan(20)
    expect(t.trim()).toBe(t)
  })
})
```

Extend `hub-config.kollab.test.ts`:
```ts
it('defaults requireApproval to false so existing hubs are unchanged', () => {
  expect(sanitizeHubConfig(null).kollab.requireApproval).toBe(false)
})
it('coerces a non-boolean requireApproval', () => {
  expect(sanitizeHubConfig({ kollab: { requireApproval: 'yes' } }).kollab.requireApproval).toBe(false)
})
```

- [ ] **Step 2: Run tests to verify they fail.**

- [ ] **Step 3: Implement**

`src/lib/hub-consent.ts`:
```ts
// One source of truth for the consent sentence. The RENDERED text is snapshotted
// onto each HubDrop at creation, so changing this template can never retroactively
// alter what a member already agreed to. Mirrors the sibling Kollab app's lib/consent.ts.
const TEMPLATE = 'By dropping content you allow {hub} to feature and remix it in this community.'

export function consentTextFor(hubTitle: string): string {
  return TEMPLATE.replace('{hub}', hubTitle)
}
```

Config: add `requireApproval: boolean` to the `kollab` block in the `HubConfig` type and `DEFAULT_HUB_CONFIG` (`false`), and coerce it in `sanitizeHubConfig` with the existing `bool()` helper alongside `enabled`.

Drops POST: after `sanitizeHubConfig`, when creating the row set
`hidden: config.kollab.requireApproval && !isPrivileged` and
`consentText: consentTextFor(hub.title)`. Privileged users' own drops are not gated by their own approval queue. Select `title` on the hub query if it isn't already.

`CommunityKollab.tsx`: render `consentTextFor(hubTitle)` as visible copy above the drop button (needs a `hubTitle` prop threaded from `CommunityHubView`), and after a successful upload, when approval is on, tell the member the drop is **pending review** instead of optimistically prepending it to the grid.

- [ ] **Step 4: Run tests + tsc + commit**

```bash
git add src/lib src/app/api/hubs/"[id]"/drops src/components/hub/community
git commit -m "feat(safety): drop approval gate and consent snapshot"
```

---

### Task 7: Report controls + moderation queue UI

**Files:**
- Create: `src/components/hub/ReportButton.tsx` + test
- Create: `src/components/hub/builder/ModerationQueue.tsx` + test
- Modify: `src/components/hub/builder/HubBuilderNav.tsx`, `HubBuilder.tsx`
- Modify: `src/components/hub/community/CommunityKollab.tsx` (Approve control)

**Interfaces:**
- Consumes: the reports and bans APIs (Tasks 4, 5).
- Produces: `ReportButton({ hubId, targetType, targetId })`, `ModerationQueue({ hubId })`; `BuilderSection` gains `'moderation'`.

- [ ] **Step 1: Write the failing tests**

`ReportButton`: opens a reason picker; POSTs the chosen reason to `/api/hubs/<id>/reports` with the right body; shows a confirmation and does not re-post after success.

`ModerationQueue`: lists open reports; Dismiss PATCHes `status: 'dismissed'`; "Remove & ban" POSTs to `/api/hubs/<id>/bans`; an empty queue renders a plain empty state.

- [ ] **Step 2: Run tests to verify they fail.**

- [ ] **Step 3: Implement**

- `ReportButton` — small trigger + modal, following the modal conventions in `src/components/hub/builder/HubEventsModal.tsx` (fixed overlay, click-outside close, `stopPropagation` inner, X button). Hide it from the content's own author (caller passes `authorId`; compare with `currentUserId`).
- Wire it into the drop tile hover controls in `CommunityKollab.tsx` and the post/comment overflow menus.
- `ModerationQueue` — a new builder section. Move a **Moderation** entry into `HubBuilderNav`'s enabled `ITEMS` (mirroring how "Widgets & Tools" was enabled) and render it from `HubBuilder.tsx` using the same prop shape as the sibling sections.
- Kollab owner controls gain **Approve** (PATCH the drop `hidden: false`) when the drop is hidden.

- [ ] **Step 4: Run tests + tsc + lint + commit**

---

### Task 8: Verification + browser smoke

**Files:** none.

**Browser smoke happens BEFORE merge** — the standing rule since a CSP bug shipped that every server-side test passed through.

- [ ] **Step 1: Static gate**

```bash
npx tsc --noEmit        # 0
npx vitest run          # all pass
npx next build          # exit 0
```
Lint via the worktree workaround → 0 errors.

If the suite reports "errors" where passed-files + errors equals the total test files on disk, that's the known vitest worker-spawn flake under machine load — extract the skipped files from the log and re-run them separately rather than declaring a failure.

- [ ] **Step 2: Throwaway DB + seed**

```bash
docker exec pages-mvp-postgres-1 psql -U pages -d postgres -c "DROP DATABASE IF EXISTS pages_safety;" -c "CREATE DATABASE pages_safety OWNER pages;"
```
`prisma migrate deploy` against it, then seed: an owner, a collaborator, two members, a published community with a few posts, comments and drops.

- [ ] **Step 3: E2E against server truth**

1. Member reports a drop → 201; a second identical report → 200 no-op, still one row.
2. Reporting a target from **another hub** → 404 (not 403).
3. Member `GET /reports` → 403; owner → 200 with the report.
4. Owner bans the member → membership row gone, ban row present.
5. Banned user: `POST /join` → 403; posting, commenting, reacting and dropping all → 403.
6. **The banned user's existing post and drop are still present** (ban preserves content).
7. Collaborator tries to ban the owner → 403. Anyone tries to ban a collaborator → 403.
8. Owner PATCHes a report to `dismissed` → status and `resolvedAt` set.
9. With `requireApproval` on: a member drop is created `hidden: true`, absent from the public list, present for the owner; approving it makes it public.
10. A drop created after this milestone has non-null `consentText`.

- [ ] **Step 4: Browser smoke (real Chrome, `next start`)**

Report a post as a member; moderate it as owner; ban and confirm the banned user's UI can't post; approve a pending drop; confirm the consent line is visible above the drop button. **Console must be clean.**

- [ ] **Step 5: Clean up + merge**

Drop `pages_safety`, remove scratch scripts, `git status` clean, merge `origin/main`, re-run the static gate, merge only after the browser smoke passes.

---

## Self-review notes (author)

- **Spec coverage:** R1 models → Task 1; R2 report API → Tasks 3, 4; R3 bans + enforcement → Tasks 2, 5; R4 approval gate → Task 6; R5 consent → Task 6; R6 UI → Task 7; verification → Task 8.
- **The riskiest change is Task 2**, not the new models: it alters a shared helper used by six routes. The required 5th parameter is deliberate — it converts "did we remember every call site?" into a compiler error.
- **Type consistency:** `canParticipate`'s new signature is used identically in Tasks 2, 4. `validateReportInput`/`REPORT_REASONS` (Task 3) are consumed in Task 4. `consentTextFor` (Task 6) is used in both the drops route and the uploader. `requireApproval` is read in Task 6's route and written by Task 7's builder.
- **Known implementer checkpoint:** Task 2 Step 3 asks the implementer to check whether `src/lib/community.ts` is imported by client code before adding a `db` import; if so, `isUserBanned` goes in a separate module. This repo already keeps `notifications-format.ts` client-safe and `notifications.ts` server-only for exactly this reason.
- **Deferred per spec, no task exists:** platform admin surface, rules-acceptance gate, mute, content deletion on ban, appeals.
