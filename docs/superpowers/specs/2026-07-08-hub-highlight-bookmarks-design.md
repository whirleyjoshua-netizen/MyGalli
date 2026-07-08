# Hub Highlight → Bookmark Tool — Design (File Viewer Phase 2)

**Date:** 2026-07-08
**Status:** Approved (pending spec review)
**Builds on:** In-Hub File Viewer Phase 1 (shipped `d03b7c8`) — the PDF **text layer** and `HubFileViewer` **`initialPage`** prop are the groundwork this uses. **Hub Notes** (shipped `89cc076`) — bookmarks attach to `HubNote`s.

## Summary

In the Hub PDF viewer, an owner **selects text → an auto popover offers "Add bookmark"**. The
bookmark becomes a **named link inside a Note card** (the highlighted text itself does NOT go
into the note — just an editable-title link). The selected passage gets a **persistent
highlight** on the page, tinted with the note's color. Clicking the bookmark link reopens the
viewer at that page. Highlights are **always visible** while a file is open; on the public
viewer only **public** notes' highlights render.

The viewer stays a **floating full-screen modal** (no inline embedding needed) — the highlighter
lives inside it.

## Goals

- Owner selects text in the viewer → auto popover → choose a note (existing or **New note**) →
  title pre-filled with the selection (editable) → save a **bookmark**.
- The passage renders a **persistent, color-per-note highlight** on the page (always visible
  while the file is open).
- Note cards (editor panel + public rail) render each bookmark as a **named, editable link**
  showing its page; clicking opens the viewer at that file+page.
- Public viewer renders highlights + bookmark navigation for **public** notes only; private
  bookmarks/highlights never reach visitors.
- Notes gain a **color** (color-coded highlights).

## Non-Goals (v1)

- No image bookmarks (images are view-only; bookmarks are text-based).
- No multi-page selection per bookmark (viewer shows one page at a time → a selection is always
  within the current page).
- No highlight editing by dragging on the page; no free-form drawing/annotation.
- No comment threads on highlights; no export.
- Not Pro-gated (free, like Notes).

## Decisions (from brainstorm)

- **Trigger:** auto popover on text selection (no separate highlighter mode).
- **Attach:** popover note dropdown (existing notes) + "New note"; title defaults to the
  selected text.
- **Color:** per note. `HubNote.color`; a bookmark's highlight uses its note's color.
- **Highlight style:** semi-transparent fill (text stays readable).
- **Palette:** fixed ~6 colors, auto-assigned on note creation (round-robin), changeable via a
  color dot on the note card.

## Data Model (`prisma/schema.prisma`)

```prisma
model HubNoteBookmark {
  id        String   @id @default(cuid())
  noteId    String
  note      HubNote  @relation(fields: [noteId], references: [id], onDelete: Cascade)
  hubId     String
  itemId    String            // the file HubItem this anchors to
  page      Int               // 1-based PDF page
  rects     Json              // [{x,y,w,h}] in unscaled PDF page coords (top-left origin)
  text      String            // selected text (title default + preview)
  title     String
  order     Int      @default(0)
  createdAt DateTime @default(now())
  @@index([hubId, itemId])
  @@index([noteId])
}
```

- `HubNote` gains: `color String @default("#FDE047")` and `bookmarks HubNoteBookmark[]`.
- `itemId` is a **soft ref** to a `HubItem` (validated app-side to belong to the hub). If the
  file item is deleted, `onDelete: Cascade` on `note` still cleans up when the note is deleted;
  a bookmark whose `itemId` no longer exists simply renders as a dead link (defensive: the note
  card shows it, clicking is a no-op / shows "file removed").
- Migration authored non-interactively (see Global Constraints in the plan).

## Anchor: selection → PDF coordinates (pure, tested)

New `src/lib/hub-highlight.ts`:

- `selectionRectsToPdf(clientRects, pageRect, scale): Rect[]` — convert DOM client rects (from
  `Selection.getClientRects()`) into unscaled PDF page coords: for each rect, subtract the page
  element's top-left (`pageRect`) and divide by `scale`. Returns `[{x,y,w,h}]`.
- `pdfRectsToStyle(rects, scale): {left,top,width,height}[]` — inverse, for rendering overlays
  (`rect × scale`), used to position highlight divs over the page.
- `visibleBookmarks(bookmarks, notesById, isOwner)` — a bookmark is visible if owner, or its
  note is `visibility === 'public'`. (Defense-in-depth; public data is already filtered
  server-side.)
- `bookmarkColor(bookmark, notesById, fallback)` — resolve the note's `color`.

Unit tests cover: rect conversion round-trips at scale ≠ 1, multi-rect (multi-line) selections,
owner-vs-visitor visibility, and color resolution with a missing note → fallback.

## API (owner-gated `ownHub`)

- `POST /api/hubs/[id]/notes/[noteId]/bookmarks` — body `{ itemId, page, rects, text, title }`.
  Validates: note belongs to hub; `itemId` is a hub item; `page` ≥ 1; `rects` is a non-empty
  array of finite `{x,y,w,h}`. Returns 201 bookmark.
- `PATCH /api/hubs/[id]/notes/[noteId]/bookmarks/[bookmarkId]` — `{ title? }` (rename).
- `DELETE /api/hubs/[id]/notes/[noteId]/bookmarks/[bookmarkId]`.
- `PATCH /api/hubs/[id]/notes/[noteId]` — also accept `color` (`"#RRGGBB"`, validated).
- Editor `GET /api/hubs/[id]` payload gains `bookmarks` (all) + each note's `color`.
- Public hub page data gains **public notes' bookmarks only** (filtered server-side, alongside
  the existing public-notes filter).
- "New note" is a client sequence: `POST /notes` (existing) then `POST …/bookmarks` — the
  bookmark API always targets an existing note.

## UI

### Viewer popover + highlights — `HubFileViewer` / `PdfView`

`HubFileViewer` gains (editor only): `editable`, `notes`, `bookmarks` (for the open item),
`onCreateNote`, `onCreateBookmark`. Public viewer passes `editable={false}` + public
`bookmarks` (render-only).

- **Selection popover (`editable`):** on `mouseup` inside the page with a non-empty selection,
  show a popover anchored near the selection: note `<select>` (existing notes, labeled with
  their color dot) + a "New note" option, a title input pre-filled with the selection, Save /
  Cancel. Save computes `rects` via `selectionRectsToPdf` (page = current page), then calls
  `onCreateBookmark` (creating the note first if "New note").
- **Highlight overlay:** for the current page, render an absolutely-positioned div per bookmark
  rect (`pdfRectsToStyle`), semi-transparent in the note's color, layered under the text layer
  (so text stays selectable) and above the canvas. Updates on page/zoom change.
- Public viewer: highlights render; no popover (not `editable`).

### Note cards — `HubNotesPanel` (editor) + `NotesRail` (public)

- Each note shows a **color dot**; in the editor it opens a small fixed palette to change
  `color` (→ `PATCH /notes`).
- Each note lists its **bookmarks**: an editable-title link (`↳ "title" · p.N`). Clicking calls
  an `onOpenBookmark(itemId, page)` that opens the viewer at that file+page. Editor rows have a
  rename (inline) + delete. Public rail: read-only links that open the viewer.

### Editor wiring refactor (necessary)

Phase 1 mounted the editor `HubFileViewer` inside **`HubItemList`**. Bookmark creation needs the
**notes list + create handlers**, which live in **`HubEditor`**. Move the viewer state
(`viewerFile`, `initialPage`) up to `HubEditor`, which already owns `notes` and `items`;
`HubItemList` calls an `onView` prop, and `HubNotesPanel` calls `onOpenBookmark`. `HubEditor`
renders the single `HubFileViewer` with notes + bookmark handlers. Public `HubViewer` already
owns `viewerFile` + the notes/rail — it gains `onOpenBookmark` on the rail and passes public
bookmarks to the viewer.

## Data Flow

1. Owner opens a PDF (viewer, editor). 2. Selects text → popover → pick/create note + title →
`onCreateBookmark`. 3. Bookmark saved; highlight (note color) drawn on the page; note card link
appears. 4. Editor `GET` returns notes (+color) + bookmarks; public page returns public notes +
their bookmarks. 5. Visitor opens the file → sees public highlights; clicking a public note's
bookmark opens the viewer at that page.

## Testing

- **Unit (TDD):** `hub-highlight.ts` — rect conversion (scale round-trip, multi-rect), visibility
  filter, color resolution.
- **Component:** popover appears on selection (editable) and not on public; a bookmark link
  renders on the note card and calls `onOpenBookmark`; highlight overlay count matches bookmarks
  for the page. pdf.js canvas rendering verified in-browser.
- **Privacy:** private notes' bookmarks absent from public payload (server-side), re-checked by
  `visibleBookmarks`.
- Browser + CSP smoke.

## Rollout

- Free. No new deps (reuses Phase 1 react-pdf/pdf.js). Follows conventions: `ownHub` gating,
  semantic tokens, lucide icons, non-interactive migration.
