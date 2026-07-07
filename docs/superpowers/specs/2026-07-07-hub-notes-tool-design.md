# Hub Notes tool + horizontal toolbar — Design

**Date:** 2026-07-07
**Status:** Approved (pending spec review)

## Summary

Add a **Note** tool to Hub pages and convert the top-right `Tools ▾` dropdown into a
**horizontal toolbar** across the top of the hub editor. A Note is a hub-wide card that
lives in a pinned **Notes panel**, can be **minimized** (collapsed to its title strip),
can be **linked to a hub item** (file / link / embed), and has a per-note **public/private**
toggle. Public notes render on the published hub viewer in a right-side Notes rail.

This is distinct from the existing folder-scoped `note` **item** type (StickyNote rows in
the item list), which stays as-is.

## Goals

- Replace the `Tools ▾` dropdown with an always-visible horizontal toolbar (room to grow).
- Add a **Note** tool that spawns a card in a pinned Notes panel.
- Notes minimize to a title strip; collapsed state persists across reloads.
- Each note can link to one hub item (file/link/embed); clicking `Open ↗` opens that
  item's URL/file in a new tab.
- Per-note public/private visibility. Public notes show on the viewer; private never do.

## Non-Goals (deferred / YAGNI)

- Drag-to-reorder notes (order by creation for v1).
- Passcode-protected notes (items have passcodes; notes only get public/private).
- Rich-text / markdown content, note attachments.
- Linking notes to folders or to external Galli pages (link target is a hub item only).

## Data Model

New `HubNote` model in `prisma/schema.prisma`. Hub-wide (no `folderId`).

```prisma
model HubNote {
  id           String   @id @default(cuid())
  hubId        String
  hub          Hub      @relation(fields: [hubId], references: [id], onDelete: Cascade)
  title        String   @default("")
  content      String   @default("")
  linkedItemId String?          // soft ref to a HubItem (file/link/embed); nullable
  visibility   String   @default("public")   // "public" | "private"
  minimized    Boolean  @default(false)      // persists collapsed state
  order        Int      @default(0)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  @@index([hubId])
}
```

- Add `notes HubNote[]` to the `Hub` model relation list.
- `linkedItemId` is a **soft reference** — validated app-side to belong to the same hub
  and to be a linkable type. If the referenced item is later deleted, the note simply
  renders un-linked (no cascade wiring needed; resolver returns null href).
- Migration authored via `prisma migrate diff … --script` (non-interactive), then
  `prisma migrate deploy`. Follows repo migration gotcha in project memory.

## Pure Helpers (TDD, tested first)

New `src/lib/hub-notes.ts` — no DB, no React:

- `LINKABLE_ITEM_TYPES = new Set(['file', 'link', 'embed'])`
- `linkableItems(items)` → items whose `type` is linkable (for the link picker).
- `visibleNotes(notes, isOwner)` → owner/collaborator sees all; visitor sees only
  `visibility === 'public'`.
- `resolveNoteLink(note, items)` → the linked item's safe href via `safeHref`, or `null`
  if unlinked / item missing / href unsafe.

Unit tests in `src/lib/hub-notes.test.ts` cover: filtering by type, owner-vs-visitor
visibility, unlinked note, missing-item, and unsafe-href cases.

## API

New routes, gated by the existing `ownHub(request, id)` pattern (owner-only for v1,
consistent with items/folders).

- `POST /api/hubs/[id]/notes`
  - Body: `{ title?, content?, linkedItemId?, visibility? }`. All optional; defaults
    applied. `visibility` must be `public` | `private` (else 400).
  - Validates `linkedItemId` (if present) belongs to the hub and is a linkable type.
  - `order = (max order for hub) + 1`. Returns 201 with the note.
- `PATCH /api/hubs/[id]/notes/[noteId]`
  - Accepts any of `title`, `content`, `linkedItemId` (nullable to unlink), `visibility`,
    `minimized`. Same validation for `linkedItemId` / `visibility`. 404 if note not in hub.
- `DELETE /api/hubs/[id]/notes/[noteId]` → 204/ok. 404 if not in hub.
- `GET /api/hubs/[id]` (editor payload) gains `notes` (all notes for the hub).
- Public hub page data (viewer) gains `notes` **filtered to `visibility: 'public'`** so
  private notes never reach the client.

## UI

### Horizontal toolbar (`HubEditor.tsx`)

Replace the `Tools ▾` dropdown (currently only "Collaborators") with a horizontal bar:

```
[ 📝 Note ]  [ 👥 Collaborators ]
```

- Bordered strip near the top (where the dropdown was). Buttons are inline labeled
  icon-buttons (`StickyNote`, `Users` from lucide).
- **Note** → `POST /notes` then focus the new card in the Notes panel.
- **Collaborators** → existing behavior (Pro-gated; free → `UpgradePrompt`).
- Structured so more tools can be appended without another dropdown.

### Notes panel (editor)

Editor grid changes from `[240px folders][1fr items]` to
`[240px folders][1fr items][260px notes]` on `lg`; stacks on mobile.

New `HubNotesPanel.tsx` (+ `NoteCard`):

- Header: "Notes (n)".
- New notes spawn at the **top** of the column in edit mode.
- **NoteCard**: title (inline editable), content (multiline textarea), **link picker**
  (`<select>` of `linkableItems`), **public/private** toggle, **minimize chevron**,
  delete. When linked, shows `Open ↗` → opens `resolveNoteLink` href in a new tab
  (`target="_blank" rel="noopener noreferrer"`).
- **Minimize** collapses the card to its title strip and PATCHes `minimized: true`
  (persists). Chevron restores.
- Edits save on blur (title/content) or on change (link/visibility/minimized), mirroring
  the item/folder save pattern already in `HubEditor`.

### Public viewer (`HubViewer.tsx`)

Restructure the centered column into a **two-column layout with a right-side Notes rail**
(mirrors the editor). Left = existing hub content (header/nav/search/folders/items);
right rail = public notes.

- Rail renders `visibleNotes(notes, /* isOwner */ false)` — already pre-filtered to public
  server-side; helper is a defense-in-depth second filter.
- Each public note: title + content, collapsible (respects `minimized` as the default
  collapsed state), and `Open ↗` when linked.
- On mobile the rail stacks below the content.
- Notes data threaded from the public hub page (`src/app/[username]/hub/[slug]/page.tsx`
  or wherever `HubViewer` is fed) into `HubViewer` props.

## Data Flow

1. Owner clicks **Note** in the toolbar → `POST /notes` → note appended to editor state →
   card opens in edit mode in the Notes panel.
2. Owner edits/links/toggles visibility/minimizes → `PATCH /notes/[noteId]` → local state
   updated from the response.
3. Editor `GET /api/hubs/[id]` returns `notes`; viewer page returns only public notes.
4. Visitor sees public notes in the right rail; clicking `Open ↗` opens the linked item.

## Testing

- **Unit (TDD):** `src/lib/hub-notes.test.ts` for the pure helpers (see above).
- **Component:** extend hub viewer/editor tests to cover: public notes render on viewer,
  private notes do NOT, `Open ↗` uses the resolved href, minimize toggles collapsed state.
- **Type/build:** `tsc --noEmit` + `pnpm test`. Migration diff verified empty against
  schema before deploy.

## Rollout Notes

- Free feature (like the existing note item). Collaborators tool stays Pro-gated.
- Follows repo conventions: `getUser` API auth, `ownHub` gating, `safeHref` for links,
  semantic Tailwind tokens (`surface`/`border`/`muted`/`primary`), lucide icons.
