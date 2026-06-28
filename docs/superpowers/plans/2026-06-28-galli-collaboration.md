# Galli Collaborative Creation Implementation Plan (Sub-project 4b)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`).

**Goal:** Let a page owner invite followers/friends to co-edit a page's content (async + presence), with a version conflict guard, while owner-only actions (publish/delete/settings/collaborators) stay locked.

**Architecture:** A `DisplayCollaborator` join model grants edit access. A tested `src/lib/collab.ts` centralizes the access decision and the owner-only/collaborator field split. The `displays/[id]` GET/PATCH endpoints adopt it and add an optimistic-concurrency `version` check. Presence is an ephemeral in-memory heartbeat. The editor loads for collaborators, tracks `version`, surfaces 409 conflicts, shows presence avatars, and hides owner-only controls for non-owners.

**Tech Stack:** Next.js 14 App Router, TypeScript, Prisma + PostgreSQL, Vitest, lucide-react, Tailwind.

## Global Constraints

- **Eligibility:** owner may invite only a user they **follow or are friends with** (reuse `Follow`).
- **Collaborator can edit content fields:** `sections`, `background`, `headerCard`, `tabs`. **Owner-only fields:** `title`, `description`, `published`, `coverImage`, slug, and all collaborator management + delete. Owner-only fields sent by a non-owner are **rejected (403)**.
- **Conflict guard:** `Display.version` increments on every content PATCH; a PATCH carrying a stale `version` returns **409** with the latest version; the editor shows a reload banner rather than clobbering.
- **Presence** is ephemeral (in-memory per process; lost on restart — acceptable, documented).
- **DB safety + migrations (per repo memory):** machine `DATABASE_URL` points at another DB — set inline every command: `$env:DATABASE_URL='postgresql://pages:pages@localhost:5434/pages?schema=public'; <cmd>`. `prisma migrate dev` is non-interactive-incompatible here; create migrations via `prisma migrate diff --from-url $DATABASE_URL --to-schema-datamodel prisma/schema.prisma --script` → write `prisma/migrations/<ts>_<name>/migration.sql` → `prisma migrate deploy`. Confirm datasource reads `pages`/`5434`.
- Verify: `pnpm build` (stop dev server first), `pnpm test`, `pnpm exec tsc --noEmit`. Auth: `getUser(request)`. Async params.

---

### Task 1: Schema — DisplayCollaborator + version + migration

**Files:** Modify `prisma/schema.prisma`; create `prisma/migrations/20260628010000_add_collaboration/migration.sql`.

- [ ] **Step 1: Edit schema**

Add to `model Display`: a `version Int @default(0)` field and `collaborators DisplayCollaborator[]`. Add to `model User`: `collaborations DisplayCollaborator[]`. Add the model:

```prisma
model DisplayCollaborator {
  id        String   @id @default(cuid())
  displayId String
  display   Display  @relation(fields: [displayId], references: [id], onDelete: Cascade)
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  role      String   @default("editor")
  invitedBy String
  createdAt DateTime @default(now())

  @@unique([displayId, userId])
  @@index([userId])
  @@index([displayId])
}
```

- [ ] **Step 2: Generate migration SQL and confirm datasource**

Run: `$env:DATABASE_URL='postgresql://pages:pages@localhost:5434/pages?schema=public'; npx prisma migrate diff --from-url $env:DATABASE_URL --to-schema-datamodel prisma\schema.prisma --script`
Expected: additive SQL — `ALTER TABLE "Display" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;`, `CREATE TABLE "DisplayCollaborator" …`, indexes, FKs. NO DROP. Confirm the command earlier printed datasource `pages`/`5434` (migrate diff connects to it). Write that exact SQL into `prisma/migrations/20260628010000_add_collaboration/migration.sql`.

- [ ] **Step 3: Apply + regenerate**

Run: `$env:DATABASE_URL='…'; npx prisma migrate deploy` then `npx prisma generate`
Expected: applies `add_collaboration`; client regenerated.

- [ ] **Step 4: Verify table + column, build, commit**

```
docker exec pages-mvp-postgres-1 psql -U pages -d pages -tAc 'SELECT to_regclass('"'"'public."DisplayCollaborator"'"'"');'
docker exec pages-mvp-postgres-1 psql -U pages -d pages -tAc "SELECT column_name FROM information_schema.columns WHERE table_name='Display' AND column_name='version';"
```
Then build. Commit:
```bash
git add prisma/schema.prisma prisma/migrations/20260628010000_add_collaboration
git commit -m "feat(collab): DisplayCollaborator model + Display.version migration"
```

---

### Task 2: Access-control helpers (TDD)

**Files:** Create `src/lib/collab.ts`, `src/__tests__/collab.test.ts`.

**Interfaces:**
- Produces: `COLLAB_FIELDS: string[]` (= `['sections','background','headerCard','tabs']`); `canEdit(userId: string | null, ownerId: string, collaboratorIds: string[]): boolean`; `splitUpdate(updates: Record<string, unknown>, isOwner: boolean): { data: Record<string, unknown>; rejected: string[] }`.

- [ ] **Step 1: Write failing tests**

```ts
// src/__tests__/collab.test.ts
import { describe, it, expect } from 'vitest'
import { canEdit, splitUpdate, COLLAB_FIELDS } from '@/lib/collab'

describe('canEdit', () => {
  it('allows the owner', () => expect(canEdit('u1', 'u1', [])).toBe(true))
  it('allows a collaborator', () => expect(canEdit('u2', 'u1', ['u2'])).toBe(true))
  it('denies a stranger', () => expect(canEdit('u3', 'u1', ['u2'])).toBe(false))
  it('denies when not logged in', () => expect(canEdit(null, 'u1', [])).toBe(false))
})

describe('splitUpdate', () => {
  it('owner keeps all fields', () => {
    const r = splitUpdate({ title: 'x', sections: [], published: true }, true)
    expect(r.data).toEqual({ title: 'x', sections: [], published: true })
    expect(r.rejected).toEqual([])
  })
  it('collaborator keeps only content fields and reports rejected', () => {
    const r = splitUpdate({ title: 'x', sections: [1], published: true, background: {} }, false)
    expect(r.data).toEqual({ sections: [1], background: {} })
    expect(r.rejected.sort()).toEqual(['published', 'title'])
  })
  it('exposes the content field list', () => {
    expect(COLLAB_FIELDS).toContain('sections')
  })
})
```

- [ ] **Step 2: Run — expect fail.** `pnpm vitest run src/__tests__/collab.test.ts` → FAIL (module missing).

- [ ] **Step 3: Implement**

```ts
// src/lib/collab.ts
export const COLLAB_FIELDS = ['sections', 'background', 'headerCard', 'tabs'] as const

export function canEdit(userId: string | null, ownerId: string, collaboratorIds: string[]): boolean {
  if (!userId) return false
  return userId === ownerId || collaboratorIds.includes(userId)
}

export function splitUpdate(
  updates: Record<string, unknown>,
  isOwner: boolean,
): { data: Record<string, unknown>; rejected: string[] } {
  if (isOwner) return { data: { ...updates }, rejected: [] }
  const data: Record<string, unknown> = {}
  const rejected: string[] = []
  for (const [k, v] of Object.entries(updates)) {
    if ((COLLAB_FIELDS as readonly string[]).includes(k)) data[k] = v
    else rejected.push(k)
  }
  return { data, rejected }
}
```

- [ ] **Step 4: Run — expect pass. Commit.**
```bash
git add src/lib/collab.ts src/__tests__/collab.test.ts
git commit -m "feat(collab): tested access-control helpers (canEdit, splitUpdate)"
```

---

### Task 3: Display GET/PATCH access control + version guard

**Files:** Modify `src/app/api/displays/[id]/route.ts`.

**Interfaces:** Consumes `canEdit`, `splitUpdate`. PATCH accepts optional `version` (number); responds `409 { error, currentVersion }` on mismatch; increments `version` when any content field changes.

- [ ] **Step 1: Rewrite GET to allow collaborators to load unpublished**

Replace the GET ownership check. After fetching `display` with collaborators:
```ts
const display = await db.display.findUnique({
  where: { id },
  include: { user: { select: { username: true, name: true, avatar: true } }, collaborators: { select: { userId: true } } },
})
if (!display) return NextResponse.json({ error: 'Display not found' }, { status: 404 })
const collaboratorIds = display.collaborators.map((c) => c.userId)
const viewerCanEdit = canEdit(user?.id ?? null, display.userId, collaboratorIds)
// Only owner OR collaborator can see unpublished
if (!display.published && !viewerCanEdit) {
  return NextResponse.json({ error: 'Display not found' }, { status: 404 })
}
// Views: increment only for published, viewed by someone who is not owner/collaborator
if (display.published && !viewerCanEdit) {
  await db.display.update({ where: { id }, data: { views: { increment: 1 } } })
}
// expose flags the editor needs
return NextResponse.json({ ...display, isOwner: display.userId === (user?.id ?? null), canEdit: viewerCanEdit })
```
Add `import { canEdit, splitUpdate } from '@/lib/collab'` at top.

- [ ] **Step 2: Rewrite PATCH for collaborator edits + version guard**

```ts
const user = await getUser(request)
if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
const display = await db.display.findUnique({ where: { id }, include: { collaborators: { select: { userId: true } } } })
if (!display) return NextResponse.json({ error: 'Display not found' }, { status: 404 })
const collaboratorIds = display.collaborators.map((c) => c.userId)
const isOwner = display.userId === user.id
if (!canEdit(user.id, display.userId, collaboratorIds)) {
  return NextResponse.json({ error: 'Display not found' }, { status: 404 })
}

const body = await request.json()
const { version: clientVersion, ...updates } = body
const { data, rejected } = splitUpdate(updates, isOwner)
if (rejected.length > 0) {
  return NextResponse.json({ error: `Not allowed to edit: ${rejected.join(', ')}` }, { status: 403 })
}

// Optimistic concurrency on content edits
const touchesContent = Object.keys(data).length > 0
if (touchesContent && typeof clientVersion === 'number' && clientVersion !== display.version) {
  return NextResponse.json({ error: 'Version conflict', currentVersion: display.version }, { status: 409 })
}

const updated = await db.display.update({
  where: { id },
  data: { ...data, ...(touchesContent ? { version: { increment: 1 } } : {}) },
})
return NextResponse.json(updated)
```
(DELETE stays owner-only, unchanged.)

- [ ] **Step 3: Build; curl smoke**

Smoke with owner jarO and collaborator jarC (collaborator added via Task 4, or temporarily insert a DisplayCollaborator row by SQL for this smoke):
- collaborator PATCH `{sections:[],version:<v>}` → 200, version increments.
- collaborator PATCH `{published:true}` → 403.
- stale version PATCH → 409 with currentVersion.
- stranger PATCH → 404.

- [ ] **Step 4: Commit**
```bash
git add "src/app/api/displays/[id]/route.ts"
git commit -m "feat(collab): collaborator edit access + version conflict guard"
```

---

### Task 4: Collaborator management APIs

**Files:** Create `src/app/api/displays/[id]/collaborators/route.ts` (GET list, POST invite) and `src/app/api/displays/[id]/collaborators/[userId]/route.ts` (DELETE).

**Interfaces:** POST body `{ username }`; owner-only; 400 unless invitee follows-or-is-followed-by owner (connection); 409 if already a collaborator. GET returns `{ collaborators: Array<{ userId, username, name, avatar, role }>, isOwner }`.

- [ ] **Step 1: Implement list + invite**

```ts
// src/app/api/displays/[id]/collaborators/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const me = await getUser(request)
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const display = await db.display.findUnique({ where: { id }, select: { userId: true } })
    if (!display) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const rows = await db.displayCollaborator.findMany({
      where: { displayId: id },
      select: { role: true, user: { select: { id: true, username: true, name: true, avatar: true } } },
    })
    return NextResponse.json({
      isOwner: display.userId === me.id,
      collaborators: rows.map((r) => ({ userId: r.user.id, username: r.user.username, name: r.user.name, avatar: r.user.avatar, role: r.role })),
    })
  } catch (e) { console.error('Collab list error:', e); return NextResponse.json({ error: 'Failed' }, { status: 500 }) }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const me = await getUser(request)
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const display = await db.display.findUnique({ where: { id }, select: { userId: true } })
    if (!display) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (display.userId !== me.id) return NextResponse.json({ error: 'Only the owner can invite' }, { status: 403 })

    const { username } = await request.json()
    const invitee = await db.user.findUnique({ where: { username }, select: { id: true } })
    if (!invitee) return NextResponse.json({ error: 'User not found' }, { status: 404 })
    if (invitee.id === me.id) return NextResponse.json({ error: 'You already own this page' }, { status: 400 })

    // eligibility: owner follows invitee OR invitee follows owner (connection)
    const connection = await db.follow.findFirst({
      where: { OR: [ { followerId: me.id, followingId: invitee.id }, { followerId: invitee.id, followingId: me.id } ] },
      select: { id: true },
    })
    if (!connection) return NextResponse.json({ error: 'You can only invite people you follow or who follow you' }, { status: 400 })

    try {
      await db.displayCollaborator.create({ data: { displayId: id, userId: invitee.id, invitedBy: me.id } })
    } catch {
      return NextResponse.json({ error: 'Already a collaborator' }, { status: 409 })
    }
    return NextResponse.json({ ok: true })
  } catch (e) { console.error('Collab invite error:', e); return NextResponse.json({ error: 'Failed' }, { status: 500 }) }
}
```

- [ ] **Step 2: Implement remove**

```ts
// src/app/api/displays/[id]/collaborators/[userId]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string; userId: string }> }) {
  try {
    const { id, userId } = await params
    const me = await getUser(request)
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const display = await db.display.findUnique({ where: { id }, select: { userId: true } })
    if (!display) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    // owner can remove anyone; a collaborator may remove themselves
    if (display.userId !== me.id && me.id !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    await db.displayCollaborator.deleteMany({ where: { displayId: id, userId } })
    return NextResponse.json({ ok: true })
  } catch (e) { console.error('Collab remove error:', e); return NextResponse.json({ error: 'Failed' }, { status: 500 }) }
}
```

- [ ] **Step 3: Build, curl smoke (owner invites a follower; invite a non-connection → 400; duplicate → 409), commit**
```bash
git add "src/app/api/displays/[id]/collaborators"
git commit -m "feat(collab): collaborator invite/list/remove APIs"
```

---

### Task 5: Presence API (ephemeral)

**Files:** Create `src/lib/presence.ts` (in-memory store), `src/app/api/displays/[id]/presence/route.ts`.

**Interfaces:** `touch(displayId, user)`, `active(displayId): Array<{id,name,avatar}>` (last 15s). POST heartbeat (auth + canEdit not enforced here beyond auth; reading is cheap), GET returns active editors.

- [ ] **Step 1: Implement store**

```ts
// src/lib/presence.ts
type Entry = { id: string; name: string | null; avatar: string | null; lastSeen: number }
const rooms = new Map<string, Map<string, Entry>>()
const WINDOW = 15_000

export function touch(displayId: string, user: { id: string; name: string | null; avatar: string | null }) {
  let room = rooms.get(displayId)
  if (!room) { room = new Map(); rooms.set(displayId, room) }
  room.set(user.id, { id: user.id, name: user.name, avatar: user.avatar, lastSeen: Date.now() })
}

export function active(displayId: string): Array<{ id: string; name: string | null; avatar: string | null }> {
  const room = rooms.get(displayId)
  if (!room) return []
  const now = Date.now()
  const out: Array<{ id: string; name: string | null; avatar: string | null }> = []
  for (const [uid, e] of room) {
    if (now - e.lastSeen > WINDOW) room.delete(uid)
    else out.push({ id: e.id, name: e.name, avatar: e.avatar })
  }
  return out
}
```

- [ ] **Step 2: Implement route**

```ts
// src/app/api/displays/[id]/presence/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'
import { touch, active } from '@/lib/presence'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const me = await getUser(request)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  touch(id, { id: me.id, name: me.name, avatar: me.avatar })
  return NextResponse.json({ active: active(id) })
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const me = await getUser(request)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return NextResponse.json({ active: active(id) })
}
```

- [ ] **Step 3: Build, commit**
```bash
git add src/lib/presence.ts "src/app/api/displays/[id]/presence"
git commit -m "feat(collab): ephemeral presence heartbeat API"
```

---

### Task 6: Collaborations list API (Shared with me)

**Files:** Create `src/app/api/collaborations/route.ts`.

**Interfaces:** `GET /api/collaborations` → `{ displays: Array<{ id, slug, title, coverImage, published, updatedAt, owner:{username,name,avatar} }> }` — pages where I am a collaborator.

- [ ] **Step 1: Implement**
```ts
// src/app/api/collaborations/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const me = await getUser(request)
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const rows = await db.displayCollaborator.findMany({
      where: { userId: me.id },
      orderBy: { createdAt: 'desc' },
      select: {
        display: {
          select: { id: true, slug: true, title: true, coverImage: true, published: true, updatedAt: true,
            user: { select: { username: true, name: true, avatar: true } } },
        },
      },
    })
    return NextResponse.json({ displays: rows.map((r) => ({ ...r.display, owner: r.display.user })) })
  } catch (e) { console.error('Collaborations error:', e); return NextResponse.json({ error: 'Failed' }, { status: 500 }) }
}
```

- [ ] **Step 2: Build, commit**
```bash
git add src/app/api/collaborations/route.ts
git commit -m "feat(collab): collaborations list API for shared-with-me"
```

---

### Task 7: CollaborateModal component

**Files:** Create `src/components/editor/CollaborateModal.tsx`.

**Interfaces:** `<CollaborateModal isOpen, onClose, displayId, isOwner />`. Lists collaborators (GET), invite-by-username input (POST; on 400 shows the eligibility error), remove (DELETE). Follows the project modal pattern (fixed overlay, X close, Done footer).

- [ ] **Step 1: Implement** — a client modal:
  - On open, `GET /api/displays/{displayId}/collaborators` → render avatars + names + (owner-only) remove buttons.
  - Owner sees an input "Invite by username" + Add button → `POST {username}`; on non-2xx show `err.error`; on success refetch.
  - Collaborator (non-owner) sees the roster + a "Leave page" button → `DELETE …/{myUserId}` then `onClose()`.
  - Use tokens: `bg-surface`, `border-border`, `rounded-2xl`, `shadow-soft-lg`; primary button for Add.

(Full JSX written during implementation following `ShareDialog.tsx` as the modal reference; the data contract is fixed by Tasks 4. Verify visually.)

- [ ] **Step 2: Build, commit**
```bash
git add src/components/editor/CollaborateModal.tsx
git commit -m "feat(collab): CollaborateModal (invite/list/remove) for editor"
```

---

### Task 8: Editor integration — load, version guard, presence, collaborate button

**Files:** Modify `src/components/editor/PageEditor.tsx`.

**Interfaces:** Consumes GET `{ …display, isOwner, canEdit, version }`, PATCH `409 { currentVersion }`, presence API, `CollaborateModal`, `PresenceBar`. Create `src/components/editor/PresenceBar.tsx`.

- [ ] **Step 1: Track version + owner on load**

In `loadPage` (around line 184-200), after `const data = await res.json()`, add state setters: `setVersion(typeof data.version === 'number' ? data.version : 0)` and `setIsOwner(!!data.isOwner)`. Declare `const [version, setVersion] = useState(0)` and `const [isOwner, setIsOwner] = useState(true)` near other state (line ~43). If `res.status === 404`, the viewer lacks access — redirect to `/dashboard`.

- [ ] **Step 2: Send version on save + handle 409**

In `savePage` (line 281-308), include `version` in the PATCH body, and after the `await fetch`, check status:
```ts
const res = await fetch(`/api/displays/${id}`, { method: 'PATCH', headers: {'Content-Type':'application/json'},
  body: JSON.stringify({ sections: sectionsToSave, background, headerCard, tabs: tabsConfig, version }) })
if (res.status === 409) { setConflict(true); return }   // stop autosave, show banner
if (res.ok) { const u = await res.json(); if (typeof u.version === 'number') setVersion(u.version) }
```
Add `const [conflict, setConflict] = useState(false)`. Render a fixed banner when `conflict`: "This page was updated by someone else. Reload to get the latest (unsaved changes will be lost)." with a Reload button (`location.reload()`).

- [ ] **Step 3: PresenceBar + heartbeat**

Create `src/components/editor/PresenceBar.tsx` (`{ displayId }`): every 8s `POST /api/displays/{displayId}/presence`, render returned `active` users (excluding self is optional) as stacked avatars with a title "{names} editing". In PageEditor, render `<PresenceBar displayId={id} />` in the toolbar when `id` is set.

- [ ] **Step 4: Collaborate button + owner-only gating**

Add a "Collaborate" toolbar button opening `CollaborateModal` (`isOwner={isOwner}`). Hide/disable owner-only controls (Publish toggle, settings, delete) when `!isOwner` (wrap their JSX in `{isOwner && (…)}`). The publish PATCH at line ~870 is owner-only already by the API (403), but hide the control too.

- [ ] **Step 5: Build, manual check, commit**

Manual: owner opens page → Collaborate → invite a follower; collaborator opens `/editor?id=…` from Shared-with-me → can edit + save; presence shows both; concurrent save shows the conflict banner; collaborator sees no Publish/Delete.
```bash
git add src/components/editor/PageEditor.tsx src/components/editor/PresenceBar.tsx
git commit -m "feat(collab): editor version guard, presence, collaborate button, owner gating"
```

---

### Task 9: Shared-with-me view + sidebar wire

**Files:** Create `src/app/(dashboard)/shared/page.tsx`; modify `src/components/dashboard/Sidebar.tsx` (un-stub "Shared with me" → `/shared`).

**Interfaces:** Consumes `GET /api/collaborations`.

- [ ] **Step 1: Shared page** — client page fetching `/api/collaborations`, rendering a grid of cards (reuse the profile/feed card style) linking to `/editor?id={d.id}`, each showing the owner ("shared by @owner") and a small Users icon. Empty state: "No pages shared with you yet."

- [ ] **Step 2: Un-stub the sidebar item** — in `src/components/dashboard/Sidebar.tsx` NAV array, change `{ label: 'Shared with me', icon: Users, soon: true }` to `{ label: 'Shared with me', icon: Users, href: '/shared', match: (p) => p.startsWith('/shared') }`.

- [ ] **Step 3: Build, commit**
```bash
git add "src/app/(dashboard)/shared/page.tsx" src/components/dashboard/Sidebar.tsx
git commit -m "feat(collab): shared-with-me view + sidebar nav"
```

---

## Self-Review

**Spec coverage (4b):**
- DisplayCollaborator + version schema → Task 1. ✅
- `canEditDisplay` (owner OR collaborator) → Task 2 (`canEdit`), used Task 3. ✅
- Owner-only field split, 403 → Task 2 (`splitUpdate`) + Task 3. ✅
- GET load for collaborators → Task 3. ✅
- Version conflict 409 → Task 3 + editor Task 8. ✅
- Invite eligibility (follower/friend), 409 dup → Task 4. ✅
- Presence heartbeat → Task 5 + Task 8 PresenceBar. ✅
- Collaborations list (shared-with-me) → Task 6 + Task 9. ✅
- CollaborateModal (invite/list/remove) → Task 7. ✅
- Owner-only controls hidden for collaborators → Task 8. ✅
- Shared-with-me sidebar lights up → Task 9. ✅

**Placeholder scan:** Tasks 7 & 8 describe UI assembly against fixed data contracts rather than full JSX (the modal mirrors `ShareDialog.tsx`; the editor edits are anchored to specific functions/lines). All API/helpers/schema steps have complete code. This is a conscious altitude choice for the two UI-integration tasks; everything they depend on is fully specified.

**Type consistency:** `canEdit(userId, ownerId, collaboratorIds)` and `splitUpdate(updates, isOwner)` signatures consistent Tasks 2/3. GET returns `{isOwner, canEdit, version}` consumed by editor Task 8. Presence `active()` shape consumed by PresenceBar.
