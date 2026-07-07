# Hub Access Control — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a Hub owner mark folders/items private (owner + collaborators + passcode access), enforced server-side; Pro-gated to set, free to view.

**Architecture:** A pure `resolveHubVisibility` decides `visible|locked|hidden` per node from the tree + viewer role + unlocked-set. The public viewer's RSC loader resolves the viewer, reads a signed unlock cookie, runs the resolver, and filters the payload so private content never leaves the server. Passcodes are bcrypt-hashed; unlock state is a signed JWT cookie.

**Tech Stack:** Next.js 15 App Router (RSC + route handlers), React 19, TypeScript, Prisma+Postgres, bcryptjs, jsonwebtoken, Vitest.

## Global Constraints

- Private-node visibility rule (verbatim): a node is **restricted** if its own `visibility==='private'` OR any ancestor folder is private. Owner + hub collaborators always see all. A restricted node is **visible** if it (or an ancestor) is unlocked; **locked** if it is the outermost not-unlocked private node in its chain AND has a passcode; **hidden** otherwise. Descendants of a locked gate are `hidden`.
- Passcodes stored **bcrypt-hashed** (`hash(pc, 12)` / `compare` from `bcryptjs`), never sent to the client. `passcodeHash` is never selected into any client payload.
- Unlock cookie = a JWT `{ hubId, unlocked: string[] }` signed with `getJwtSecret()` (from `@/lib/auth`), httpOnly, name `hub_unlock_{hubId}`, 12h expiry. A token whose `hubId` doesn't match → treated as no unlocks.
- **Pro-gated** (owner must be `isPro`): setting `visibility='private'`, setting a passcode, all collaborator writes. Viewing / unlocking / being a collaborator is free.
- Unlock route is **rate-limited** via `rateLimit(request, { limit: 10, windowMs: 60_000, prefix: 'hubunlock' })`.
- Additive migration only (ADD COLUMN with defaults + one new table). **Use a timestamp LATER than the latest existing `prisma/migrations/` folder at build time** (concurrent sessions keep adding migrations — `ls prisma/migrations | sort | tail -1` and pick a later one).
- **Gate each task:** `npx tsc --noEmit` (exit 0) AND `npx vitest run` (full suite green — it's large; if the full run is killed by the environment, run the task's own test files + tsc and note it). Windows + Git Bash; FOREGROUND; do NOT run `pnpm build`. `git add` only the task's files; never `-A`; never stage `Documents/`, `Images/`, `g1t.json`, `nul`, `test-output.txt`, `.claude/settings.local.json`.

---

## Task 1: Models + migration

**Files:** Modify `prisma/schema.prisma`; create `prisma/migrations/<LATER_TS>_add_hub_access/migration.sql`.

**Interfaces:** Produces `HubFolder.visibility`/`passcodeHash`, `HubItem.visibility`/`passcodeHash`, and `db.hubCollaborator`.

- [ ] **Step 1: Schema** — in `prisma/schema.prisma`:
  - On `model HubFolder`, add: `visibility String @default("public")` and `passcodeHash String?`.
  - On `model HubItem`, add: `visibility String @default("public")` and `passcodeHash String?`.
  - On `model Hub`, add: `collaborators HubCollaborator[]`.
  - On `model User`, add: `hubCollaborations HubCollaborator[] @relation("UserHubCollaborations")`.
  - Add:
```prisma
model HubCollaborator {
  id        String   @id @default(cuid())
  hubId     String
  hub       Hub      @relation(fields: [hubId], references: [id], onDelete: Cascade)
  userId    String
  user      User     @relation("UserHubCollaborations", fields: [userId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())
  @@unique([hubId, userId])
  @@index([hubId])
  @@index([userId])
}
```

- [ ] **Step 2: Migration** — run `ls prisma/migrations | sort | tail -1` to find the latest; create `prisma/migrations/<pick-a-later-timestamp>_add_hub_access/migration.sql`:
```sql
-- AlterTable
ALTER TABLE "HubFolder" ADD COLUMN "visibility" TEXT NOT NULL DEFAULT 'public';
ALTER TABLE "HubFolder" ADD COLUMN "passcodeHash" TEXT;
ALTER TABLE "HubItem" ADD COLUMN "visibility" TEXT NOT NULL DEFAULT 'public';
ALTER TABLE "HubItem" ADD COLUMN "passcodeHash" TEXT;
-- CreateTable
CREATE TABLE "HubCollaborator" (
    "id" TEXT NOT NULL,
    "hubId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HubCollaborator_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "HubCollaborator_hubId_userId_key" ON "HubCollaborator"("hubId", "userId");
CREATE INDEX "HubCollaborator_hubId_idx" ON "HubCollaborator"("hubId");
CREATE INDEX "HubCollaborator_userId_idx" ON "HubCollaborator"("userId");
ALTER TABLE "HubCollaborator" ADD CONSTRAINT "HubCollaborator_hubId_fkey" FOREIGN KEY ("hubId") REFERENCES "Hub"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HubCollaborator" ADD CONSTRAINT "HubCollaborator_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

- [ ] **Step 3:** `npx prisma generate` (retry on EPERM); `npx prisma validate` → valid.
- [ ] **Step 4: Gate + commit** — `npx tsc --noEmit`; `npx vitest run`.
```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(hub): access-control schema (visibility/passcode + HubCollaborator)"
```

---

## Task 2: Pure resolver + unlock-cookie helpers

**Files:** Create `src/lib/hub-access.ts` + `src/lib/hub-access.test.ts`.

**Interfaces (Produces):**
- `type Viewer = 'owner' | 'collaborator' | 'public'`; `type NodeStatus = 'visible' | 'locked' | 'hidden'`
- `resolveHubVisibility({ folders, items, viewer, unlockedIds }): Map<string, NodeStatus>`
- `signUnlockToken(hubId: string, unlocked: string[]): string`; `readUnlockToken(token: string | undefined, hubId: string): string[]`

- [ ] **Step 1: Write the failing test**
```ts
// src/lib/hub-access.test.ts
import { describe, it, expect } from 'vitest'
import { resolveHubVisibility, signUnlockToken, readUnlockToken } from './hub-access'

// tree:  root: [F_pub, F_priv(pass), F_col(no pass)]; F_priv > [I1]; F_col > [I2]; root items [I0 public, I3 private+pass]
const folders = [
  { id: 'Fpub', parentId: null, visibility: 'public', hasPasscode: false },
  { id: 'Fpriv', parentId: null, visibility: 'private', hasPasscode: true },
  { id: 'Fcol', parentId: null, visibility: 'private', hasPasscode: false },
]
const items = [
  { id: 'I0', folderId: null, visibility: 'public', hasPasscode: false },
  { id: 'I1', folderId: 'Fpriv', visibility: 'public', hasPasscode: false },
  { id: 'I2', folderId: 'Fcol', visibility: 'public', hasPasscode: false },
  { id: 'I3', folderId: null, visibility: 'private', hasPasscode: true },
]

describe('resolveHubVisibility', () => {
  it('owner sees everything', () => {
    const m = resolveHubVisibility({ folders, items, viewer: 'owner', unlockedIds: new Set() })
    for (const id of ['Fpub','Fpriv','Fcol','I0','I1','I2','I3']) expect(m.get(id)).toBe('visible')
  })
  it('public: public visible, passcode-folder locked, collaborator-folder hidden', () => {
    const m = resolveHubVisibility({ folders, items, viewer: 'public', unlockedIds: new Set() })
    expect(m.get('Fpub')).toBe('visible')
    expect(m.get('I0')).toBe('visible')
    expect(m.get('Fpriv')).toBe('locked')   // outermost private w/ passcode
    expect(m.get('I1')).toBe('hidden')       // behind the locked gate
    expect(m.get('Fcol')).toBe('hidden')     // private, no passcode → collaborator-only
    expect(m.get('I2')).toBe('hidden')
    expect(m.get('I3')).toBe('locked')       // private item with its own passcode
  })
  it('public with Fpriv unlocked: its subtree becomes visible', () => {
    const m = resolveHubVisibility({ folders, items, viewer: 'public', unlockedIds: new Set(['Fpriv']) })
    expect(m.get('Fpriv')).toBe('visible')
    expect(m.get('I1')).toBe('visible')
    expect(m.get('Fcol')).toBe('hidden')     // unrelated
  })
  it('collaborator sees everything', () => {
    const m = resolveHubVisibility({ folders, items, viewer: 'collaborator', unlockedIds: new Set() })
    expect(m.get('Fcol')).toBe('visible')
    expect(m.get('I2')).toBe('visible')
  })
})

describe('unlock cookie', () => {
  it('sign → read round-trips scoped to hubId', () => {
    const t = signUnlockToken('hub1', ['a', 'b'])
    expect(readUnlockToken(t, 'hub1')).toEqual(['a', 'b'])
  })
  it('rejects a token for a different hub or a garbage token', () => {
    const t = signUnlockToken('hub1', ['a'])
    expect(readUnlockToken(t, 'hub2')).toEqual([])
    expect(readUnlockToken('garbage', 'hub1')).toEqual([])
    expect(readUnlockToken(undefined, 'hub1')).toEqual([])
  })
})
```

- [ ] **Step 2: Run — FAIL.** `npx vitest run src/lib/hub-access.test.ts`

- [ ] **Step 3: Implement `src/lib/hub-access.ts`**
```ts
import { sign, verify } from 'jsonwebtoken'
import { getJwtSecret } from '@/lib/auth'

export type Viewer = 'owner' | 'collaborator' | 'public'
export type NodeStatus = 'visible' | 'locked' | 'hidden'

interface Node { id: string; visibility?: string | null; hasPasscode?: boolean }
export interface AccessFolder extends Node { parentId: string | null }
export interface AccessItem extends Node { folderId: string | null }

export function resolveHubVisibility(input: {
  folders: AccessFolder[]
  items: AccessItem[]
  viewer: Viewer
  unlockedIds: Set<string>
}): Map<string, NodeStatus> {
  const { folders, items, viewer, unlockedIds } = input
  const out = new Map<string, NodeStatus>()
  if (viewer === 'owner' || viewer === 'collaborator') {
    folders.forEach((f) => out.set(f.id, 'visible'))
    items.forEach((i) => out.set(i.id, 'visible'))
    return out
  }
  const byId = new Map(folders.map((f) => [f.id, f]))
  // chain root→self (ancestors first, then self)
  const chainRootToSelf = (self: Node, parentId: string | null): Node[] => {
    const anc: Node[] = []
    const seen = new Set<string>()
    let cur = parentId ? byId.get(parentId) : undefined
    while (cur && !seen.has(cur.id)) { seen.add(cur.id); anc.push(cur); cur = cur.parentId ? byId.get(cur.parentId) : undefined }
    anc.reverse() // root-first
    return [...anc, self]
  }
  const statusFor = (chain: Node[]): NodeStatus => {
    // outermost private node that isn't unlocked blocks
    let blocker: Node | null = null
    for (const n of chain) {
      if (n.visibility === 'private' && !unlockedIds.has(n.id)) { blocker = n; break }
    }
    if (!blocker) return 'visible'
    const self = chain[chain.length - 1]
    if (blocker.id === self.id) return self.hasPasscode ? 'locked' : 'hidden'
    return 'hidden'
  }
  folders.forEach((f) => out.set(f.id, statusFor(chainRootToSelf(f, f.parentId))))
  items.forEach((i) => out.set(i.id, statusFor(chainRootToSelf(i, i.folderId))))
  return out
}

export function signUnlockToken(hubId: string, unlocked: string[]): string {
  return sign({ hubId, unlocked }, getJwtSecret(), { expiresIn: '12h' })
}
export function readUnlockToken(token: string | undefined, hubId: string): string[] {
  if (!token) return []
  try {
    const d = verify(token, getJwtSecret()) as { hubId?: string; unlocked?: string[] }
    if (d.hubId !== hubId || !Array.isArray(d.unlocked)) return []
    return d.unlocked.filter((x) => typeof x === 'string')
  } catch { return [] }
}
```

- [ ] **Step 4: Run — PASS.** `npx vitest run src/lib/hub-access.test.ts`
- [ ] **Step 5: Gate + commit** — `npx tsc --noEmit`; `npx vitest run`.
```bash
git add src/lib/hub-access.ts src/lib/hub-access.test.ts
git commit -m "feat(hub): pure visibility resolver + signed unlock-cookie helpers"
```

---

## Task 3: APIs — privacy PATCH (Pro), collaborators, unlock

**Files:** Modify `src/app/api/hubs/[id]/items/[itemId]/route.ts`, `.../folders/[folderId]/route.ts`; create `.../collaborators/route.ts`, `.../unlock/route.ts`.

**Interfaces:** Consumes `resolveHubVisibility` is NOT needed here; consumes `signUnlockToken`, `readUnlockToken` (unlock route); bcryptjs `hash`/`compare`; `isPro` from `@/lib/plan`; `rateLimit` from `@/lib/rate-limit`; `createNotification` from `@/lib/notifications`.

- [ ] **Step 1: Extend item + folder PATCH** — in each PATCH handler (after the existing owner/ownership check), accept `visibility` and `passcode`:
```ts
import { hash } from 'bcryptjs'
import { isPro } from '@/lib/plan'
// ...inside PATCH, after ownership is confirmed and `me` (the owner user) is available:
if (body.visibility === 'private' || (typeof body.passcode === 'string' && body.passcode)) {
  if (!isPro(me)) return NextResponse.json({ error: 'Pro required to make items private' }, { status: 403 })
}
if (body.visibility === 'public' || body.visibility === 'private') data.visibility = body.visibility
if (body.passcode === null || body.passcode === '') data.passcodeHash = null
else if (typeof body.passcode === 'string') data.passcodeHash = await hash(body.passcode, 12)
```
(`me` = the authed owner from the existing `ownHub`/getUser check — ensure it's in scope; the existing routes fetch the hub for ownership, so load/keep the user object. Setting `visibility:'public'` also clears the passcode is optional; only clear `passcodeHash` when `passcode` is explicitly null/''. Never return `passcodeHash` in the response — the routes already `select` or you must exclude it.)

- [ ] **Step 2: Collaborators route** `src/app/api/hubs/[id]/collaborators/route.ts` (owner + Pro):
```ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'
import { isPro } from '@/lib/plan'
import { createNotification } from '@/lib/notifications'

async function ownedHub(request: NextRequest, id: string) {
  const me = await getUser(request)
  if (!me) return { err: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const hub = await db.hub.findUnique({ where: { id } })
  if (!hub || hub.userId !== me.id) return { err: NextResponse.json({ error: 'Not found' }, { status: 404 }) }
  return { me, hub }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const r = await ownedHub(request, id); if ('err' in r) return r.err
  const rows = await db.hubCollaborator.findMany({
    where: { hubId: id },
    select: { userId: true, user: { select: { username: true, name: true, avatar: true } } },
  })
  return NextResponse.json({ collaborators: rows })
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const r = await ownedHub(request, id); if ('err' in r) return r.err
  if (!isPro(r.me)) return NextResponse.json({ error: 'Pro required' }, { status: 403 })
  const body = await request.json().catch(() => ({}))
  const username = typeof body.username === 'string' ? body.username.trim() : ''
  if (!username) return NextResponse.json({ error: 'username required' }, { status: 400 })
  const target = await db.user.findUnique({ where: { username }, select: { id: true } })
  if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 })
  if (target.id === r.me.id) return NextResponse.json({ error: 'You already own this hub' }, { status: 400 })
  await db.hubCollaborator.upsert({
    where: { hubId_userId: { hubId: id, userId: target.id } },
    create: { hubId: id, userId: target.id },
    update: {},
  })
  await createNotification({
    userId: target.id, type: 'hub_collaborator',
    actor: { id: r.me.id, name: r.me.name || r.me.username, avatar: r.me.avatar },
    entityUrl: `/hubs/${id}`, contextText: r.hub.title,
  })
  return NextResponse.json({ ok: true })
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const r = await ownedHub(request, id); if ('err' in r) return r.err
  if (!isPro(r.me)) return NextResponse.json({ error: 'Pro required' }, { status: 403 })
  const body = await request.json().catch(() => ({}))
  if (typeof body.userId !== 'string') return NextResponse.json({ error: 'userId required' }, { status: 400 })
  await db.hubCollaborator.deleteMany({ where: { hubId: id, userId: body.userId } })
  return NextResponse.json({ ok: true })
}
```
(`createNotification` accepts any `type` string — `'hub_collaborator'` renders via the formatter's default branch; optionally add a case to `formatNotification` in `notifications-format.ts` reading "X invited you to a hub". If adding, keep it a one-line case.)

- [ ] **Step 3: Unlock route** `src/app/api/hubs/[id]/unlock/route.ts` (public, rate-limited):
```ts
import { NextRequest, NextResponse } from 'next/server'
import { compare } from 'bcryptjs'
import { db } from '@/lib/db'
import { rateLimit } from '@/lib/rate-limit'
import { readUnlockToken, signUnlockToken } from '@/lib/hub-access'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const limited = await rateLimit(request, { limit: 10, windowMs: 60_000, prefix: 'hubunlock' })
  if (limited) return limited
  const { id } = await params
  const body = await request.json().catch(() => ({}))
  const nodeId = typeof body.nodeId === 'string' ? body.nodeId : ''
  const passcode = typeof body.passcode === 'string' ? body.passcode : ''
  if (!nodeId || !passcode) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  // node may be a folder or an item in this hub
  const folder = await db.hubFolder.findFirst({ where: { id: nodeId, hubId: id }, select: { passcodeHash: true } })
  const item = folder ? null : await db.hubItem.findFirst({ where: { id: nodeId, hubId: id }, select: { passcodeHash: true } })
  const passcodeHash = folder?.passcodeHash ?? item?.passcodeHash ?? null
  if (!passcodeHash || !(await compare(passcode, passcodeHash))) {
    return NextResponse.json({ error: 'Incorrect passcode' }, { status: 401 })
  }
  const cookieName = `hub_unlock_${id}`
  const existing = readUnlockToken(request.cookies.get(cookieName)?.value, id)
  const unlocked = Array.from(new Set([...existing, nodeId]))
  const res = NextResponse.json({ ok: true })
  res.cookies.set(cookieName, signUnlockToken(id, unlocked), {
    httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 12,
  })
  return res
}
```

- [ ] **Step 4: Gate + commit** — `npx tsc --noEmit`; `npx vitest run`.
```bash
git add "src/app/api/hubs/[id]/items/[itemId]/route.ts" "src/app/api/hubs/[id]/folders/[folderId]/route.ts" "src/app/api/hubs/[id]/collaborators" "src/app/api/hubs/[id]/unlock" src/lib/notifications-format.ts
git commit -m "feat(hub): privacy PATCH (Pro), collaborators CRUD, rate-limited unlock"
```

---

## Task 4: Viewer enforcement (server-side filtering + locked UI)

**Files:** Create `src/lib/get-user-from-cookies.ts`; modify `src/app/[username]/hub/[slug]/page.tsx` and `src/components/hub/HubViewer.tsx`.

**Interfaces:** Consumes `resolveHubVisibility`, `readUnlockToken`. Produces a `getUserFromCookies(): Promise<{ id: string } | null>` RSC helper.

- [ ] **Step 1: `getUserFromCookies` helper**
```ts
// src/lib/get-user-from-cookies.ts
import { cookies } from 'next/headers'
import { verify } from 'jsonwebtoken'
import { getJwtSecret } from '@/lib/auth'
import { AUTH_COOKIE } from '@/lib/constants'

export async function getUserFromCookies(): Promise<{ id: string } | null> {
  try {
    const token = (await cookies()).get(AUTH_COOKIE)?.value
    if (!token) return null
    const d = verify(token, getJwtSecret()) as { userId?: string }
    return d.userId ? { id: d.userId } : null
  } catch { return null }
}
```
(Confirm `AUTH_COOKIE` is exported from `@/lib/constants` — the middleware uses it. If the app enforces `tokenVersion`, this light check is acceptable for a *read-only visibility* decision; the API routes still do the full `getUser` check for writes.)

- [ ] **Step 2: Enforce in the loader** — in `src/app/[username]/hub/[slug]/page.tsx`, after loading `hub`, `folders`, `items` (and the existing publish-gate), compute the viewer + filter:
```ts
import { resolveHubVisibility, readUnlockToken } from '@/lib/hub-access'
import { getUserFromCookies } from '@/lib/get-user-from-cookies'
// ...
const viewerUser = await getUserFromCookies()
let viewer: 'owner' | 'collaborator' | 'public' = 'public'
if (viewerUser?.id === hub.userId) viewer = 'owner'
else if (viewerUser) {
  const collab = await db.hubCollaborator.findUnique({
    where: { hubId_userId: { hubId: hub.id, userId: viewerUser.id } }, select: { id: true },
  })
  if (collab) viewer = 'collaborator'
}
const unlockedIds = new Set(readUnlockToken((await cookies()).get(`hub_unlock_${hub.id}`)?.value, hub.id))
const status = resolveHubVisibility({
  folders: folders.map((f) => ({ id: f.id, parentId: f.parentId, visibility: f.visibility, hasPasscode: !!f.passcodeHash })),
  items: items.map((i) => ({ id: i.id, folderId: i.folderId, visibility: i.visibility, hasPasscode: !!i.passcodeHash })),
  viewer, unlockedIds,
})
// Build filtered payloads (NEVER include passcodeHash; strip content of non-visible)
const safeFolders = folders.filter((f) => status.get(f.id) !== 'hidden').map((f) => ({
  id: f.id, parentId: f.parentId, name: f.name, order: f.order,
  locked: status.get(f.id) === 'locked',
}))
const safeItems = items.filter((i) => status.get(i.id) !== 'hidden').map((i) => {
  const locked = status.get(i.id) === 'locked'
  return { id: i.id, folderId: i.folderId, type: i.type, title: i.title, order: i.order,
    url: locked ? null : i.url, content: locked ? null : i.content, locked }
})
// pass safeFolders/safeItems (+ hubId) to <HubViewer>
```

- [ ] **Step 3: `HubViewer` locked UI** — extend the folder/item types with `locked?: boolean`. A locked folder renders as a 🔒 tile; a locked item renders a 🔒 row. Clicking a locked node opens a small passcode prompt (an `<input type="password">` + Unlock) that `POST`s to `/api/hubs/${hubId}/unlock` with `{ nodeId, passcode }`; on `{ ok }` it calls `location.reload()` (the cookie is now set → the RSC returns the unlocked subtree); on 401 shows "Incorrect passcode". Pass `hubId` into `HubViewer`.

- [ ] **Step 4: Test** — extend `HubViewer.test.tsx`: a `locked` folder renders a lock affordance and an unlock input; entering a passcode `POST`s to the unlock URL (mock fetch, assert the call). Keep existing viewer tests passing.
- [ ] **Step 5: Gate + commit**
```bash
git add src/lib/get-user-from-cookies.ts "src/app/[username]/hub/[slug]/page.tsx" src/components/hub/HubViewer.tsx src/components/hub/HubViewer.test.tsx
git commit -m "feat(hub): server-side private-content filtering + locked/unlock in viewer"
```

---

## Task 5: Editor privacy controls + Collaborators tool

**Files:** Modify `src/components/hub/HubFolderTree.tsx`, `HubItemList.tsx`, `HubEditor.tsx`; create `src/components/hub/HubCollaboratorsModal.tsx`.

- **Privacy control:** each folder/item gets a ⋮ (or inline) **Privacy** control — a Public/Private toggle and, when Private, a "Set passcode" input — that `PATCH`es the existing folder/item route with `{ visibility, passcode }`. Private nodes show a 🔒 badge. If the owner is not Pro, the control shows the existing `UpgradePrompt` instead of applying. (The editor already loads folders/items with these fields via `GET /api/hubs/[id]`; ensure that GET's select includes `visibility` and whether a passcode is set — add a derived `hasPasscode` (from `passcodeHash != null`) to the GET response and DROP `passcodeHash` itself, so the hash never reaches the client.)
- **Collaborators tool:** add a **Tools ▾** button in `HubEditor` opening `HubCollaboratorsModal` — lists collaborators (`GET /api/hubs/[id]/collaborators`), invite by username (`POST`), remove (`DELETE`). Pro-gated (non-Pro → `UpgradePrompt`).
- Acceptance: setting a folder Private + passcode as a Pro owner persists and shows the 🔒 badge; a non-Pro owner sees the upgrade prompt; inviting/removing collaborators works. A light component test is welcome but optional (the resolver + APIs carry the tested logic).

- [ ] Build the controls + modal, gate (`npx tsc --noEmit`; `npx vitest run`), commit:
```bash
git add src/components/hub
git commit -m "feat(hub): per-node privacy controls + Collaborators tool (Pro-gated)"
```

---

## Verification (after all tasks)

1. `npx tsc --noEmit` clean; `npx vitest run` green.
2. Manual (dev, Pro owner): in `/hubs/[id]`, make a folder Private + set a passcode; add a collaborator by username. Publish the page. Visit `/{username}/hub/{slug}` **logged out** → the private folder shows as 🔒 (contents absent from the page source); enter the passcode → it unlocks and reloads showing contents. Visit as the **collaborator** (logged in) → private content visible without a passcode. Confirm a collaborator-only private folder (no passcode) is entirely absent for the public viewer (check page source, not just UI).
3. Prod: additive `add_hub_access` migration applies via `prisma migrate deploy`.

## Self-review notes (checked against spec)

- **Coverage:** models+migration (T1), resolver+cookie (T2), privacy PATCH + collaborators + unlock APIs (T3), viewer enforcement/filtering + locked UI (T4), editor controls + collaborators tool (T5). ✔
- **Server-side enforcement:** the loader filters using the resolver and strips `url`/`content` of `locked` nodes and omits `hidden` nodes; `passcodeHash` never selected into any client payload (GET returns derived `hasPasscode`). ✔
- **Pro-gating:** visibility='private'/passcode/collaborator writes require `isPro`; viewing/unlock free. ✔
- **Security:** passcodes bcrypt-hashed; unlock cookie signed+hub-scoped; unlock rate-limited; wrong passcode → 401. Resolver is pure + exhaustively tested (the security core). ✔
- **Type consistency:** `visibility`/`passcodeHash`/`hasPasscode`, `resolveHubVisibility`/`sign|readUnlockToken`, `Viewer`/`NodeStatus` consistent across tasks. ✔
