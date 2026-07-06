# Hub — Phase 1 (MVP spine) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the Hub spine — first-class `Hub`/`HubFolder`/`HubItem` models, CRUD APIs, a page `hub` element (create-on-add + cover-art doorway), a Hub editor, a public viewer, and a sidebar page/hub tree.

**Architecture:** A Hub is relational data (not page JSON). A `hub` element on a page stores a `hubId` and cover art and links to the public viewer `/{username}/hub/{slug}`; owners manage contents in `/hubs/{id}`; the sidebar "My Pages" becomes an expandable tree with Hub branches.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Prisma + Postgres (Neon), Tailwind, lucide-react, Vitest + Testing Library.

## Global Constraints

- New element `hub`, slash category `'Media'` (must be in `CATEGORY_ORDER`). Element defaults live ONCE in `createElement()`; the `hub` create-on-add is a small explicit hook in `PageEditor.handleCommandSelect` (like the `card` case), NOT a defaults duplication.
- API routes mirror `getUser(request)` → 401 → JSON, and every hub/folder/item mutation verifies the hub's `userId === me.id` (ownership) before acting.
- Public viewer exposes a hub only when its owning page (`Hub.displayId` → `Display.published === true`) is published; otherwise 404.
- Outbound links via `safeHref` (`@/lib/editor/safe-href`); `rel="noopener noreferrer"` + `target="_blank"`. Embeds via the existing embed parsing (no arbitrary iframe src).
- Migrations: never `prisma migrate dev` — hand-write the SQL (provided), `npx prisma generate`; Vercel build runs `prisma migrate deploy`.
- Editor component props `{ element, onChange, onDelete, isSelected, onSelect }`; Public props `{ element }`.
- **Gate each task:** `npx tsc --noEmit` (exit 0) AND `npx vitest run` (full suite green). Windows + Git Bash; FOREGROUND; do NOT run `pnpm build`. Suite can be slow with transient timeouts on UNRELATED files — re-run a timed-out file; env flakiness ≠ failure.
- `git add` only the task's specific files; never `-A`. Never stage `Documents/`, `Images/`, `g1t.json`, `nul`, `test-output.txt`, `.claude/settings.local.json`.

---

## Task 1: Models + migration + PDF upload

**Files:** Modify `prisma/schema.prisma`; create `prisma/migrations/20260707000000_add_hub/migration.sql`; modify `src/lib/upload-validate.ts`; modify `src/lib/upload-validate.test.ts`.

**Interfaces:** Produces `db.hub`, `db.hubFolder`, `db.hubItem`; `validateUpload` accepts `application/pdf` (≤25MB).

- [ ] **Step 1: Add models to `prisma/schema.prisma`** (append near the other models):

```prisma
model Hub {
  id          String      @id @default(cuid())
  userId      String
  user        User        @relation("UserHubs", fields: [userId], references: [id], onDelete: Cascade)
  displayId   String?
  slug        String
  title       String      @default("Untitled Hub")
  description String?
  coverImage  String?
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt
  folders     HubFolder[]
  items       HubItem[]
  @@unique([userId, slug])
  @@index([userId])
  @@index([displayId])
}

model HubFolder {
  id        String   @id @default(cuid())
  hubId     String
  hub       Hub      @relation(fields: [hubId], references: [id], onDelete: Cascade)
  parentId  String?
  name      String
  order     Int      @default(0)
  createdAt DateTime @default(now())
  @@index([hubId])
  @@index([parentId])
}

model HubItem {
  id        String   @id @default(cuid())
  hubId     String
  hub       Hub      @relation(fields: [hubId], references: [id], onDelete: Cascade)
  folderId  String?
  type      String
  title     String
  url       String?
  content   String?
  order     Int      @default(0)
  createdAt DateTime @default(now())
  @@index([hubId])
  @@index([folderId])
}
```
Add to `model User { ... }`: `hubs Hub[] @relation("UserHubs")`.

- [ ] **Step 2: Create `prisma/migrations/20260707000000_add_hub/migration.sql`**

```sql
-- CreateTable
CREATE TABLE "Hub" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "displayId" TEXT,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'Untitled Hub',
    "description" TEXT,
    "coverImage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Hub_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "HubFolder" (
    "id" TEXT NOT NULL,
    "hubId" TEXT NOT NULL,
    "parentId" TEXT,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HubFolder_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "HubItem" (
    "id" TEXT NOT NULL,
    "hubId" TEXT NOT NULL,
    "folderId" TEXT,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT,
    "content" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HubItem_pkey" PRIMARY KEY ("id")
);
-- Indexes
CREATE UNIQUE INDEX "Hub_userId_slug_key" ON "Hub"("userId", "slug");
CREATE INDEX "Hub_userId_idx" ON "Hub"("userId");
CREATE INDEX "Hub_displayId_idx" ON "Hub"("displayId");
CREATE INDEX "HubFolder_hubId_idx" ON "HubFolder"("hubId");
CREATE INDEX "HubFolder_parentId_idx" ON "HubFolder"("parentId");
CREATE INDEX "HubItem_hubId_idx" ON "HubItem"("hubId");
CREATE INDEX "HubItem_folderId_idx" ON "HubItem"("folderId");
-- Foreign keys
ALTER TABLE "Hub" ADD CONSTRAINT "Hub_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HubFolder" ADD CONSTRAINT "HubFolder_hubId_fkey" FOREIGN KEY ("hubId") REFERENCES "Hub"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HubItem" ADD CONSTRAINT "HubItem_hubId_fkey" FOREIGN KEY ("hubId") REFERENCES "Hub"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

- [ ] **Step 3: Extend `validateUpload`** — add `application/pdf` to the allowed set at a 25MB cap. In `src/lib/upload-validate.ts`, add a `DOC_TYPES = ['application/pdf']` const and `MAX_DOC = 25 * 1024 * 1024`; in `validateUpload`, treat `isDoc` like audio (25MB). Add `'application/pdf': '.pdf'` to `EXT`. Update the error string to include "PDF". Add test cases to `src/lib/upload-validate.test.ts`:

```ts
  it('accepts a pdf up to 25MB', () => {
    expect(validateUpload('application/pdf', 20 * 1024 * 1024)).toEqual({ ok: true })
  })
  it('rejects a pdf over 25MB', () => {
    expect(validateUpload('application/pdf', 26 * 1024 * 1024).ok).toBe(false)
  })
```

- [ ] **Step 4: `npx prisma generate`** (retry if EPERM). Then `npx prisma validate` → "valid".

- [ ] **Step 5: Gate + commit** — `npx tsc --noEmit`; `npx vitest run`.
```bash
git add prisma/schema.prisma prisma/migrations/20260707000000_add_hub/migration.sql src/lib/upload-validate.ts src/lib/upload-validate.test.ts
git commit -m "feat(db): Hub/HubFolder/HubItem models + migration; upload accepts pdf"
```

---

## Task 2: hub-tree helper + Hub CRUD APIs

**Files:** create `src/lib/hub-tree.ts` (+ test); create `src/lib/slug.ts` if absent (or reuse existing slug util — search first); create route files under `src/app/api/hubs/`.

**Interfaces:**
- Produces `buildFolderTree(folders: FolderNode[]): TreeNode[]` and `folderPath(folders: FolderNode[], id: string): FolderNode[]` (breadcrumb, root→id).
- Produces `GET/POST /api/hubs`, `GET/PATCH/DELETE /api/hubs/[id]`.

- [ ] **Step 1: Write the failing hub-tree test**

```ts
// src/lib/hub-tree.test.ts
import { describe, it, expect } from 'vitest'
import { buildFolderTree, folderPath } from './hub-tree'

const folders = [
  { id: 'a', parentId: null, name: 'A', order: 0 },
  { id: 'b', parentId: 'a', name: 'B', order: 0 },
  { id: 'c', parentId: 'a', name: 'C', order: 1 },
  { id: 'd', parentId: 'b', name: 'D', order: 0 },
]

describe('buildFolderTree', () => {
  it('nests children under parents, ordered', () => {
    const tree = buildFolderTree(folders)
    expect(tree.map((n) => n.id)).toEqual(['a'])
    expect(tree[0].children.map((n) => n.id)).toEqual(['b', 'c'])
    expect(tree[0].children[0].children.map((n) => n.id)).toEqual(['d'])
  })
})

describe('folderPath', () => {
  it('returns root→id breadcrumb', () => {
    expect(folderPath(folders, 'd').map((f) => f.id)).toEqual(['a', 'b', 'd'])
  })
  it('returns [] for unknown id', () => {
    expect(folderPath(folders, 'zzz')).toEqual([])
  })
})
```

- [ ] **Step 2: Run — FAIL.** `npx vitest run src/lib/hub-tree.test.ts`

- [ ] **Step 3: Implement `src/lib/hub-tree.ts`**

```ts
// src/lib/hub-tree.ts
export interface FolderNode { id: string; parentId: string | null; name: string; order: number }
export interface TreeNode extends FolderNode { children: TreeNode[] }

export function buildFolderTree(folders: FolderNode[]): TreeNode[] {
  const byId = new Map<string, TreeNode>()
  folders.forEach((f) => byId.set(f.id, { ...f, children: [] }))
  const roots: TreeNode[] = []
  byId.forEach((node) => {
    if (node.parentId && byId.has(node.parentId)) byId.get(node.parentId)!.children.push(node)
    else roots.push(node)
  })
  const sort = (ns: TreeNode[]) => { ns.sort((a, b) => a.order - b.order); ns.forEach((n) => sort(n.children)) }
  sort(roots)
  return roots
}

export function folderPath(folders: FolderNode[], id: string): FolderNode[] {
  const byId = new Map(folders.map((f) => [f.id, f]))
  const path: FolderNode[] = []
  let cur = byId.get(id)
  const seen = new Set<string>()
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id)
    path.unshift(cur)
    cur = cur.parentId ? byId.get(cur.parentId) : undefined
  }
  return byId.has(id) ? path : []
}
```

- [ ] **Step 4: Run — PASS.** `npx vitest run src/lib/hub-tree.test.ts`

- [ ] **Step 5: Slug helper** — search for an existing slugify (`grep -rn "slugify\|function slug" src/lib`). If one exists, reuse it. Else create `src/lib/slug.ts`:
```ts
// src/lib/slug.ts
export function slugify(input: string): string {
  return input.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'hub'
}
```

- [ ] **Step 6: `src/app/api/hubs/route.ts`** (list + create)

```ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'
import { slugify } from '@/lib/slug'

export async function GET(request: NextRequest) {
  const me = await getUser(request)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const hubs = await db.hub.findMany({
    where: { userId: me.id },
    orderBy: { updatedAt: 'desc' },
    select: { id: true, title: true, slug: true, displayId: true, coverImage: true,
      _count: { select: { items: true, folders: true } } },
  })
  return NextResponse.json({ hubs })
}

export async function POST(request: NextRequest) {
  const me = await getUser(request)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await request.json().catch(() => ({}))
  const displayId = typeof body.displayId === 'string' ? body.displayId : null
  const title = typeof body.title === 'string' && body.title.trim() ? body.title.trim().slice(0, 120) : 'Untitled Hub'
  const slug = `${slugify(title)}-${Math.random().toString(36).slice(2, 7)}`
  const hub = await db.hub.create({ data: { userId: me.id, displayId, title, slug } })
  return NextResponse.json(hub, { status: 201 })
}
```

- [ ] **Step 7: `src/app/api/hubs/[id]/route.ts`** (get/patch/delete, ownership)

```ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'

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
  const [folders, items] = await Promise.all([
    db.hubFolder.findMany({ where: { hubId: id }, orderBy: { order: 'asc' } }),
    db.hubItem.findMany({ where: { hubId: id }, orderBy: { order: 'asc' } }),
  ])
  return NextResponse.json({ hub: r.hub, folders, items })
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const r = await ownHub(request, id)
  if ('error' in r) return r.error
  const body = await request.json().catch(() => ({}))
  const data: Record<string, unknown> = {}
  if (typeof body.title === 'string') data.title = body.title.trim().slice(0, 120)
  if (typeof body.description === 'string') data.description = body.description.slice(0, 1000)
  if (typeof body.coverImage === 'string') data.coverImage = body.coverImage
  const hub = await db.hub.update({ where: { id }, data })
  return NextResponse.json(hub)
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const r = await ownHub(request, id)
  if ('error' in r) return r.error
  await db.hub.delete({ where: { id } }) // cascade removes folders + items
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 8: Gate + commit**
```bash
git add src/lib/hub-tree.ts src/lib/hub-tree.test.ts src/lib/slug.ts src/app/api/hubs/route.ts "src/app/api/hubs/[id]/route.ts"
git commit -m "feat(hub): folder-tree helper + hub CRUD APIs (ownership-gated)"
```
(Omit `src/lib/slug.ts` from the add if you reused an existing slugify.)

---

## Task 3: Folder + Item CRUD APIs

**Files:** create `src/app/api/hubs/[id]/folders/route.ts`, `.../folders/[folderId]/route.ts`, `.../items/route.ts`, `.../items/[itemId]/route.ts`.

**Interfaces:** Consumes the `ownHub` ownership pattern (repeat it per file — it's short). Produces folder + item create/update/delete. Folder delete cascades descendant folders + their items in a transaction.

Each route re-implements the ownership check (getUser → hub.userId === me.id → 404 otherwise). Full handlers:

- **`folders/route.ts` POST** `{ name, parentId? }` → create `HubFolder` with `order = (max order in that parent)+1`. Validate `name` non-empty (≤120). If `parentId` given, verify it belongs to this hub.
- **`folders/[folderId]/route.ts` PATCH** `{ name?, parentId?, order? }`; **DELETE** → gather all descendant folder ids (walk `parentId` tree from the flat folder list), then in `db.$transaction`: delete `HubItem where folderId in ids`, delete `HubFolder where id in ids`.
- **`items/route.ts` POST** `{ folderId?, type, title, url?, content? }` → validate `type ∈ {file,link,embed,note}` and `title` non-empty; if `folderId`, verify it's in this hub; `order = max+1`.
- **`items/[itemId]/route.ts` PATCH** `{ title?, url?, content?, folderId?, order? }`; **DELETE**.

Write focused tests for the folder-delete cascade as a pure helper — extract `descendantFolderIds(folders, rootId): string[]` into `src/lib/hub-tree.ts` and unit-test it:
```ts
// add to hub-tree.ts
export function descendantFolderIds(folders: FolderNode[], rootId: string): string[] {
  const out = [rootId]
  const kids = folders.filter((f) => f.parentId === rootId)
  for (const k of kids) out.push(...descendantFolderIds(folders, k.id))
  return out
}
```
Test (add to hub-tree.test.ts): `descendantFolderIds(folders, 'a')` → `['a','b','d','c']` (order not asserted; assert as a set). The DELETE handler uses this to collect ids.

- [ ] Steps: write the `descendantFolderIds` test (RED) → implement → the four route files → gate → commit:
```bash
git add src/lib/hub-tree.ts src/lib/hub-tree.test.ts "src/app/api/hubs/[id]/folders" "src/app/api/hubs/[id]/items"
git commit -m "feat(hub): folder + item CRUD APIs with cascading folder delete"
```

*(Reviewer note for the controller: this task's routes are thin CRUD; the tested surface is `descendantFolderIds` + tsc. Acceptance = ownership enforced on every route, cascade correct, type/title validated.)*

---

## Task 4: Hub element + wiring + create-on-add

**Files:** modify `src/lib/types/canvas.ts`; create `src/components/elements/HubElement.tsx`, `PublicHubElement.tsx` (+ test); modify `index.ts`, `SlashCommandMenu.tsx`, `ColumnCanvas.tsx`, `render-elements.tsx`, `PageEditor.tsx`.

**Data model (canvas.ts):** `ElementType += 'hub'`; fields `hubId?: string`, `hubCoverImage?: string`, `hubTitleOverride?: string`; `createElement('hub')` → `{ hubId: '', hubCoverImage: '', hubTitleOverride: '' }`.

**Public component** (tested): renders a cover tile. Props `{ element }`. Because counts need a DB read, the Public element accepts optional denormalized props via the element or is passed live data by the renderer; for MVP the tile links to `/{username}/hub/{slug}` — the render pipeline must supply `username`+hub info. SIMPLEST MVP: `render-elements.tsx renderElement(element, displayId?)` already exists; extend the hub public render to read `element.hubId` and render a tile linking to an owner-resolved URL. To avoid a DB read in the pure renderer, store denormalized `hubSlug` + `hubUsername` on the element at save time (the editor writes them when the hub is created/renamed). Add fields `hubSlug?`, `hubUsername?` to the element and data model. The tile links to `/${hubUsername}/hub/${hubSlug}`.

- [ ] **Step 1: Public test**
```tsx
// src/components/elements/PublicHubElement.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PublicHubElement } from './PublicHubElement'
import type { CanvasElement } from '@/lib/types/canvas'
const el = (o: Partial<CanvasElement>): CanvasElement => ({ id: '1', type: 'hub', ...o })
describe('PublicHubElement', () => {
  it('renders a cover tile linking to the hub viewer', () => {
    render(<PublicHubElement element={el({ hubId: 'h1', hubUsername: 'josh', hubSlug: 'listing-123', hubTitleOverride: 'Listing 123' })} />)
    const link = screen.getByRole('link', { name: /listing 123/i })
    expect(link).toHaveAttribute('href', '/josh/hub/listing-123')
  })
  it('shows a "not set up" state when no hub is linked', () => {
    render(<PublicHubElement element={el({ hubId: '' })} />)
    expect(screen.getByText(/hub/i)).toBeInTheDocument()
  })
})
```
- [ ] **Step 2: Implement `PublicHubElement.tsx`** — a tile: `hubCoverImage` (fallback gradient), title (`hubTitleOverride`), and a subtle "Open →". Wrap in a Next `<Link href={/${hubUsername}/hub/${hubSlug}}>` when `hubUsername && hubSlug`, else a static placeholder card. (Counts are optional in MVP; omit if not denormalized.)
- [ ] **Step 3: Editor `HubElement.tsx`** — mirror `ColorPaletteElement` shell. Body: a cover-art upload (`/api/upload` → `hubCoverImage`), a title-override input, and an **"Open Hub →"** button that `router.push('/hubs/' + element.hubId)` (guarded on hubId present). It does NOT create the hub (that happens on add — Step 5).
- [ ] **Step 4: Wire** canvas.ts (type+fields+createElement) · index.ts exports · SlashCommandMenu `{ id:'hub', label:'Hub', icon: Boxes, description:'A deep-linked collection of files, links & demos', category:'Media' }` · ColumnCanvas case (preview→Public else editor) · render-elements case.
- [ ] **Step 5: create-on-add in `PageEditor.handleCommandSelect`** — add a `case 'hub'` modeled on the `card` case (`PageEditor.tsx:503`). It must: `setShowSlashMenu(false)`, then `await fetch('/api/hubs', { method:'POST', body: JSON.stringify({ displayId: id }) })`, read the created hub, and insert a `hub` element carrying `hubId`, `hubSlug: hub.slug`, `hubUsername: user.username` into the current section/column (reuse the same `setActiveSections` append the switch uses at the end), then `return`. Because this is async, extract the "append newElement to currentSection/currentColumn" tail (lines ~803-815) into a local `appendElement(el)` helper and call it from both the normal path and the hub case.
- [ ] **Step 6: Gate + commit**
```bash
git add src/lib/types/canvas.ts src/components/elements/HubElement.tsx src/components/elements/PublicHubElement.tsx src/components/elements/PublicHubElement.test.tsx src/components/elements/index.ts src/components/canvas/SlashCommandMenu.tsx src/components/canvas/ColumnCanvas.tsx src/lib/render-elements.tsx src/components/editor/PageEditor.tsx
git commit -m "feat(hub): hub element (create-on-add, cover tile) + wiring"
```

---

## Task 5: Hub editor `/hubs/[id]`

**Files:** create `src/app/(dashboard)/hubs/[id]/page.tsx` and supporting components under `src/components/hub/` (e.g. `HubEditor.tsx`, `HubFolderTree.tsx`, `HubItemList.tsx`).

Client page (dashboard-shelled). On mount, `GET /api/hubs/[id]` → `{ hub, folders, items }`; 404/redirect if not owner. UI:
- **Header:** editable title + description + cover upload (PATCH `/api/hubs/[id]`).
- **Folder tree** (left): render `buildFolderTree(folders)`; select a folder (or Root); "+ New folder" (POST folders with current as parent); rename/delete (delete confirms — cascades). Breadcrumb via `folderPath`.
- **Item list** (main): items of the selected folder (`folderId === selected || null for root`). "+ Add" menu → file (upload → POST item type=file), link, embed, note (small inline forms). Each item row: title, type icon, edit/delete.
- Mutations call the Task-3 APIs and update local state.

Acceptance: create/rename/delete folders (nesting works), add each of the 4 item types, delete items; all scoped to this hub; owner-only (non-owner GET 404 → redirect to /dashboard). No dedicated unit test required for this page (APIs + hub-tree are tested); a light smoke test that it renders the hub title from mocked fetch is welcome but optional.

- [ ] Steps: build the page + components, gate, commit:
```bash
git add "src/app/(dashboard)/hubs" src/components/hub
git commit -m "feat(hub): owner Hub editor (/hubs/[id]) — folders + items management"
```

---

## Task 6: Public Hub viewer `/[username]/hub/[slug]`

**Files:** create `src/app/[username]/hub/[slug]/page.tsx` and `src/components/hub/HubViewer.tsx` (+ test for HubViewer).

RSC page loader (mirror `src/app/[username]/[slug]/page.tsx`): resolve `user = db.user.findUnique({ where:{ username } })`; `hub = db.hub.findUnique({ where:{ userId_slug:{ userId:user.id, slug } } })`; `notFound()` unless hub exists AND its owning page is published — i.e. load `Display` by `hub.displayId` and require `published === true` (if `displayId` null, 404 for MVP). Load folders+items, pass to `<HubViewer hub folders items username />` (client).

`HubViewer` (client, tested): cover+title+description header; folder tree/breadcrumb (reuse `buildFolderTree`/`folderPath`); main pane lists current folder's subfolders + items as cards; clicking a subfolder navigates (local state); item render by type — image→lightbox (reuse pattern), embed→iframe via existing parser, audio/video→players, note→text, file/pdf/link→`<a target=_blank rel=noopener>` "Open". Basic `<input>` title search filtering the current view.

- [ ] **HubViewer test** (mocked data): renders root items; clicking a folder shows its children; renders an item link with correct href. Then build the loader. Gate + commit:
```bash
git add "src/app/[username]/hub" src/components/hub/HubViewer.tsx src/components/hub/HubViewer.test.tsx
git commit -m "feat(hub): public Hub viewer (/[username]/hub/[slug])"
```

---

## Task 7: Sidebar "My Pages" expandable tree

**Files:** modify `src/components/dashboard/SidebarContent.tsx`; likely add `src/components/dashboard/PagesTree.tsx` (+ test).

Turn the `My Pages` nav row into an expandable node: a chevron toggles a tree that lists the user's pages, and under each page any Hubs (`Hub.displayId === page.id`) as child branches.
- Data: `GET /api/displays` (existing, user's pages) + `GET /api/hubs` (Task 2) — group hubs by `displayId` client-side.
- Click a page → `/editor?id={pageId}`; click a hub branch → `/hubs/{hubId}`. The `My Pages` label still links to `/my-pages`.
- Collapsed rail: the tree is hidden (only the icon), same as other nav.
- Keep it scoped: a `PagesTree` client component fetching both lists; the tree is only rendered in the expanded, non-mobile rail (avoid bloating the mobile drawer — show the plain `My Pages` link there).

**Test** (`PagesTree.test.tsx`, mocked fetch): renders pages; a page with a hub shows the hub branch linking to `/hubs/{id}`; expanding/collapsing toggles visibility.

- [ ] Steps: build `PagesTree`, wire into `SidebarContent` (replace the `My Pages` `NAV` entry rendering with the expandable node while keeping other nav items intact), gate, commit:
```bash
git add src/components/dashboard/PagesTree.tsx src/components/dashboard/PagesTree.test.tsx src/components/dashboard/SidebarContent.tsx
git commit -m "feat(dashboard): My Pages expandable tree with Hub branches"
```

---

## Verification (after all tasks)

1. `npx tsc --noEmit` clean; `npx vitest run` fully green.
2. Manual smoke (dev, logged in): in the editor, add a **Hub** element → it creates a hub and shows a cover tile; upload cover art in the inspector; click "Open Hub →" → `/hubs/[id]`; create nested folders, add a file/link/embed/note; publish the page; visit `/{username}/hub/{slug}` → viewer browses folders + items, previews work; the sidebar **My Pages** expands and the page shows a **Hub** branch that jumps to `/hubs/[id]`.
3. Prod: additive `add_hub` migration applies via build's `prisma migrate deploy`.

## Self-review notes (checked against spec)

- **Coverage:** models+migration+pdf (T1), tree helper + hub CRUD (T2), folder/item CRUD + cascade (T3), element + create-on-add + cover tile (T4), owner editor (T5), public viewer + published-gate (T6), sidebar tree (T7). All spec surfaces mapped. ✔
- **Ownership/security:** every hub/folder/item route checks `hub.userId === me.id`; public viewer gated on owning page `published`. ✔
- **Denormalization:** element stores `hubSlug`/`hubUsername` so the pure public renderer needs no DB read (added to the data model in T4). ✔
- **Type consistency:** `hubId/hubCoverImage/hubTitleOverride/hubSlug/hubUsername` used consistently in canvas.ts, element, and PageEditor create-on-add. `FolderNode`/`buildFolderTree`/`folderPath`/`descendantFolderIds` shared by editor, viewer, and the delete API. ✔
- **Scale flag:** T5/T6 are large UI surfaces specified as skeleton+acceptance (not full JSX) with analog references; the tested surfaces are the pure helpers, APIs, and the two Public components — consistent with prior element plans.
