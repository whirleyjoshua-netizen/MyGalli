# Hub — Phase 1 (MVP spine) — design

Date: 2026-07-06
Status: draft (awaiting user review)
Part of: [[hub-feature-vision]] — Phase 1 of 5. Later phases (Asset registry, per-client
access, identified analytics, SandboxDemoDisplay + templates) are OUT of scope here.

## Goal

Ship the end-to-end spine of the Hub: a first-class **Hub** collection (nestable
folders + typed items) created inline via a page **element**, reachable as a branch
under its page in the sidebar tree, edited in its own **Hub editor**, and viewable
publicly through a branded **cover tile** on the page.

## Core model

A **Hub** is a first-class object (its own DB rows, not page JSON), created when a
page owner adds a **Hub element** to a page. The element on the page is the branded
doorway (cover art + title + counts); the Hub's *contents* live in a dedicated
editor and render in a public viewer.

New Prisma models (additive migration):

```prisma
model Hub {
  id          String     @id @default(cuid())
  userId      String
  user        User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  displayId   String?    // the page it was created on (for the sidebar tree); nullable if page deleted
  slug        String     // unique per user → public URL /{username}/hub/{slug}
  title       String     @default("Untitled Hub")
  description String?
  coverImage  String?     // hub-level cover (the element carries its own too)
  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt
  folders     HubFolder[]
  items       HubItem[]
  @@unique([userId, slug])
  @@index([userId])
  @@index([displayId])
}

model HubFolder {
  id        String      @id @default(cuid())
  hubId     String
  hub       Hub         @relation(fields: [hubId], references: [id], onDelete: Cascade)
  parentId  String?     // self-referential → arbitrary nesting
  name      String
  order     Int         @default(0)
  createdAt DateTime    @default(now())
  @@index([hubId])
  @@index([parentId])
}

model HubItem {
  id        String   @id @default(cuid())
  hubId     String
  hub       Hub      @relation(fields: [hubId], references: [id], onDelete: Cascade)
  folderId  String?  // null = hub root
  type      String   // 'file' | 'link' | 'embed' | 'note'
  title     String
  url       String?  // file url, link url, or embed url
  content   String?  // note markdown, or file mime/meta hint
  order     Int      @default(0)
  createdAt DateTime @default(now())
  @@index([hubId])
  @@index([folderId])
}
```

(`User` gains `hubs Hub[]`. Folders nest via `parentId`; deleting a folder cascades
its children in app logic — see APIs.)

## Item types (MVP)

`file | link | embed | note`.
- **file** — uploaded via `/api/upload` (Phase 1 extends its allowlist to include
  `application/pdf`; images/audio already allowed). Image → inline thumbnail/lightbox;
  PDF/other → "Open" (new tab); audio/video → reuse existing players. Full PDF.js
  in-viewer + a real Asset model are Phase 2.
- **link** — external URL + title (+ optional description), a clickable card.
- **embed** — an embed URL rendered via the existing embed pipeline (YouTube/Vimeo/…).
- **note** — a short rich-text/markdown block for context between files.

## Surfaces

### 1. Hub element (on a page) — `ElementType 'hub'`

Fields on `CanvasElement`: `hubId?`, `hubCoverImage?` (the page-level cover art the
user explicitly wanted), `hubTitleOverride?`.
- **Add flow:** adding the Hub element `POST /api/hubs` (creates a Hub tied to the
  current `displayId`), stores the returned `hubId` on the element.
- **Inspector** (right control panel, like other elements): upload **cover art**
  (`hubCoverImage` via `/api/upload`), an optional title override, and an
  **"Open Hub →"** button that navigates to the Hub editor.
- **Public render:** a cover tile — `hubCoverImage` (fallback gradient), the hub
  title, and live counts ("N files · M folders") — linking to the public viewer
  `/{username}/hub/{slug}`.

### 2. Sidebar "My Pages" → expandable tree

`My Pages` in `SidebarContent` becomes expandable: a chevron reveals the user's
pages, and any page that has ≥1 Hub shows each Hub as a **child branch**.
- Click a page → the page editor (`/editor?id={displayId}`).
- Click a Hub branch → the Hub editor (`/hubs/{hubId}`) — straight in, no page detour.
- Data via `GET /api/hubs` (list the user's hubs with `displayId`, grouped under
  pages client-side). `My Pages` label still links to `/my-pages`.

### 3. Hub editor (owner) — `/hubs/[id]` (dashboard-shelled, auth + ownership gated)

The builder where the collection lives:
- **Hub settings:** title, description, cover image.
- **Folder tree:** create / rename / delete / reorder / nest folders (breadcrumb +
  current-folder view).
- **Items:** add a file (upload), link, embed, or note into the current folder;
  edit title, reorder, delete.
- Autosaves via the item/folder APIs.

### 4. Public Hub viewer — `/[username]/hub/[slug]` (published pages only)

Read-only browser built for volume:
- Cover + title + description header.
- Folder tree / breadcrumb; main pane grid or list of the current folder's
  subfolders + items.
- Inline preview: image lightbox (reuse), embed render, audio/video player (reuse),
  note render; file/PDF → Open. Basic client-side search over item titles.
- Responsive (stacked on mobile).
- View is public; visibility is `published`-style for MVP (a hub is viewable once
  its owning page is published OR the hub itself is marked published — MVP: gate on
  the hub having `displayId` of a published page, else 404). Per-client/private
  access is Phase 3.

## APIs (mirror `getUser` → 401 → JSON; ownership-checked)

- `GET /api/hubs` → the user's hubs (id, title, slug, displayId, counts).
- `POST /api/hubs` `{ displayId }` → create a hub (default title/slug), returns it.
- `GET /api/hubs/[id]` → hub + folders + items (owner). Public viewer uses a separate
  read path keyed by username+slug.
- `PATCH /api/hubs/[id]` → title/description/cover.
- `DELETE /api/hubs/[id]`.
- `POST /api/hubs/[id]/folders` / `PATCH` / `DELETE` (folder CRUD; delete cascades
  descendants + their items in a transaction).
- `POST /api/hubs/[id]/items` / `PATCH` / `DELETE` (item CRUD).
- Public read: `GET /api/hubs/public/[username]/[slug]` (or resolved in the RSC page
  loader) → hub + folders + items, only if the owning page is published.

## Wiring (standard add-an-element seams)

`ElementType 'hub'` + fields + `createElement` (canvas.ts) → `HubElement` (editor,
with the create-on-mount/create-on-add + inspector) + `PublicHubElement` (cover tile)
→ `elements/index.ts` → `SlashCommandMenu` (`{ id: 'hub', label: 'Hub', icon: FolderTree/Boxes, description: 'A deep-linked collection of files, links & demos', category: 'Media' }`)
→ `ColumnCanvas` case → `render-elements.tsx` case. No `PageEditor` defaults edit
(the `default:` fallback handles it), though the Hub element's create-on-add needs a
small hook where elements are inserted.

## Security / safety

- All hub/folder/item APIs verify `getUser` + hub ownership (userId) before any
  read/write; the public read path exposes only hubs whose owning page is published.
- Uploaded file URLs render in appropriate contexts (image→`<img>`, media→players,
  else an `Open` link with `rel="noopener noreferrer"`); link/embed URLs pass through
  `safeHref` / the existing embed parser (no arbitrary iframe src).
- PDF added to `/api/upload` allowlist keeps the existing size/type validation shape.

## Testing

- `validateUpload` accepts `application/pdf` (≤ image cap or a pdf cap — pick 25MB).
- Hub tree/nesting pure helper: build a folder tree from flat `HubFolder[]` and
  compute a breadcrumb path (pure function, unit-tested).
- Hub element: `PublicHubElement` renders the cover tile linking to the viewer URL
  with the title/counts; empty/no-hub → neutral state.
- Folder-delete cascade logic (pure or a focused API test) removes descendants.
- Public viewer render: given a hub payload, renders folders + items of the root and
  navigates into a folder (component test with mocked data).

## Non-goals (Phase 1)

Real `Asset` model + PDF.js in-viewer + file metadata management (Phase 2);
private/unlisted/per-recipient access + password/expiry (Phase 3); identified
"who-viewed-what" analytics (Phase 4); SandboxDemoDisplay (Display-in-Display) +
domain templates (Phase 5); Hub reuse across multiple pages, drag-drop reordering
polish, bulk upload.

## Build order (the plan will sequence these; ships value progressively)

1. Models + migration + `validateUpload` PDF.
2. Hub CRUD APIs (hub/folder/item) + ownership + folder-cascade.
3. Hub element (create-on-add, inspector cover art, public cover tile) + wiring.
4. Sidebar "My Pages" expandable tree with Hub branches.
5. Hub editor `/hubs/[id]` (folders + items management).
6. Public viewer `/[username]/hub/[slug]`.

## Files touched (high level)

New: `prisma/migrations/<ts>_add_hub/*`, hub API routes under `src/app/api/hubs/**`,
`src/lib/hub-tree.ts` (+ test), `src/components/elements/HubElement.tsx` +
`PublicHubElement.tsx` (+ test), `src/app/(dashboard)/hubs/[id]/page.tsx` (+ pieces),
`src/app/[username]/hub/[slug]/page.tsx` + `HubViewer` component (+ test).
Modified: `prisma/schema.prisma`, `src/lib/types/canvas.ts`, `src/lib/upload-validate.ts`,
`SlashCommandMenu.tsx`, `ColumnCanvas.tsx`, `render-elements.tsx`,
`src/components/elements/index.ts`, `src/components/dashboard/SidebarContent.tsx`,
`src/components/editor/PageEditor.tsx` (create-hub-on-add hook).
