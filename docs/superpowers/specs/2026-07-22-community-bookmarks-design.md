# Community Hub Bookmarks — Design

**Date:** 2026-07-22
**Status:** Approved for planning

## Goal

Restore the file hub's staple reading feature to community hubs: the owner highlights key passages inside a PDF, and every reader sees those highlights and can jump between them — all without leaving the Files tab's viewer.

## Why this is needed

The community Files tab currently stores and serves files, and (since `181b9e5`) opens them in the shared `HubFileViewer`. But highlights and bookmarks — the thing that made the original data-room worth reading in rather than downloading from — are absent.

There is a second, less obvious gap. A community hub's **Edit** button routes to `HubBuilder`, which has no file surface at all. `HubEditor` — the only place bookmarks have ever been authored — is the *non-community* owner view. So a community hub owner has no authoring path whatsoever today. Shipping read-only bookmark display would therefore render nothing, forever, because no bookmark could ever be created. **Authoring must ship with display.**

## Decisions

| # | Decision | Rationale |
|---|---|---|
| D1 | **Owner-only authoring.** Members read; they do not highlight. | The notes and bookmarks APIs are already `ownHub`-gated (`hub.userId !== me.id` → 404). Owner-only matches `canManage = isOwner` exactly, so **no API auth changes are required**. Member authoring would mean widening endpoints that the existing data-room also uses, plus moderation questions (who deletes whose highlight) that this feature does not need to answer. |
| D2 | **Bookmarks surface in the viewer only.** No panel on the Files tab. | The community page already has a Notes card in the utility strip backed by the *same* `HubNote` model. A second notes panel on the Files tab would show notes in two places. Reading happens in the viewer, so that is where marks belong. |
| D3 | **The jump strip goes in shared `PdfView`**, so the data-room gains it too. | It is additive and guarded by `bookmarks.length > 0`, so a file with no highlights renders exactly as today. Forking viewer behaviour per surface is worse than one viewer that behaves one way — and the data-room, where bookmarks are actually authored today, benefits most. |

## What already exists (do not rebuild)

Most of this feature is wiring. Before writing any component, know that:

- **`PdfView` already renders highlight overlays.** It maps `bookmarks` for the current page through `pdfRectsToStyle` and paints them at `noteColors[b.noteId]`, 0.35 opacity.
- **`PdfView` already has the complete authoring flow.** On mouse-up with a text selection and `editable` true, it opens `SelectionPopover`, which offers the existing `notes` plus a `__new__` option; on save it calls `onCreateNote()` (if new) then `onCreateBookmark({ noteId, itemId, page, rects, text, title })`.
- **`HubFileViewer` already accepts and forwards** `initialPage`, `editable`, `notes`, `bookmarks`, `onCreateBookmark`, `onCreateNote`.
- **Both visibility helpers exist and are unit-tested:** `visibleNotes(notes, isOwner)` in `src/lib/hub-notes.ts` and `visibleBookmarks(bookmarks, noteVisibility, isOwner)` in `src/lib/hub-highlight.ts`.
- **`StripNote` is `{ id, title, content, color }`** — a superset of the `{ id, title, color }` the viewer needs. The community branch of `page.tsx` already builds `notes` as `visibleNotes(noteRows, viewer === 'owner').map(toStripNote)`, so **the visibility-filtered notes the viewer needs are already computed and passed to `CommunityHubView`.** Only bookmarks need new fetching.

## Architecture

### Data flow

```
page.tsx (community branch, server)
  noteRows ──visibleNotes──► notes: StripNote[]        [ALREADY EXISTS, already passed]
  bookmarkRows ──visibleBookmarks──► fileBookmarks     [NEW]
        │
        ▼
  CommunityHubView  (new prop: fileBookmarks; reuses existing `notes`)
        │
        ▼
  HubFilesTab  (state: notes, bookmarks; handlers: createNote, createBookmark)
        │
        ▼
  HubFileViewer  editable={canManage} notes bookmarks onCreateNote onCreateBookmark
        │
        ▼
  PdfView  overlays + SelectionPopover  [EXISTS]  +  jump strip  [NEW]
```

### Security: the visibility hinge

`HubFileViewer` filters bookmarks by `itemId` only — it does **not** consider note visibility. If the server passed unfiltered bookmarks, a member would receive the owner's private-note highlights, including each bookmark's `title` and highlighted `text`, in the SSR payload.

The server must therefore filter with `visibleBookmarks(bookmarkRows, noteVisibility, viewer === 'owner')`, exactly as the non-community branch already does at `page.tsx`. Build `noteVisibility` from the **unfiltered** `noteRows` (`Object.fromEntries(noteRows.map(n => [n.id, n.visibility]))`), not from the filtered list — otherwise every bookmark whose note was filtered out would look up `undefined` and the intent becomes accidental rather than explicit.

This is the single most important assertion in the test plan.

## Components

### 1. `page.tsx` — community branch

Add `db.hubNoteBookmark.findMany({ where: { hubId: hub.id }, orderBy: { order: 'asc' } })` to the existing `Promise.all`. After it, build `noteVisibility` from `noteRows` and derive:

```ts
const fileBookmarks = visibleBookmarks(bookmarkRows, noteVisibility, viewer === 'owner')
  .map((b) => ({
    id: b.id, noteId: b.noteId, itemId: b.itemId, page: b.page,
    rects: b.rects as unknown as { x: number; y: number; w: number; h: number }[],
    title: b.title,
  }))
```

Pass `fileBookmarks` to `CommunityHubView`. The existing `notes` prop is reused — no second notes computation.

### 2. `CommunityHubView`

New optional prop `fileBookmarks?: BookmarkLite[]` defaulting to `[]`. Forward it, plus the existing `notes`, into `HubFilesTab`.

### 3. `HubFilesTab`

- New props: `notes?: StripNote[]`, `initialBookmarks?: BookmarkLite[]`, both defaulting to `[]`.
- Local state for both, so a newly created note or bookmark appears without a reload.
- Two handlers, each surfacing failures through the existing `error` alert rather than failing silently:
  - `createNote(): Promise<string | null>` — `POST /api/hubs/{hubId}/notes`; on success append to local notes and return the new id; on failure set the error and return `null` (which makes `SelectionPopover` abort cleanly rather than saving a bookmark against a nonexistent note). Both `POST /notes` and `POST /bookmarks` return the created row with `201`, so the local append uses the server's row rather than a guess.

    **Send an explicit title and `visibility: 'public'`.** Two reasons, each of which would otherwise cause a silent failure:

    - The route computes `visibility = body.visibility === 'private' ? 'private' : 'public'`, so omitting it yields `public` — correct here, but relying on that default is fragile given the whole feature depends on readers seeing the note. Send it explicitly.
    - The route stores `title: ''` when none is sent. An empty title is not cosmetic: **a note created from the viewer also appears in the Home tab's Notes card**, because both surfaces read the same `HubNote` model. A blank entry would appear there with no explanation. Title the note after the file it was created from (e.g. `Notes on Q3 Deck.pdf`, truncated to 200 chars) so it reads sensibly in the card.
  - `createBookmark(input: NewBookmark): Promise<void>` — `POST /api/hubs/{hubId}/notes/{input.noteId}/bookmarks`; on success append the returned row to local bookmarks.
- Pass to `HubFileViewer`: `editable={canManage}`, `notes`, `bookmarks`, `onCreateNote`, `onCreateBookmark`.

`editable` is `canManage`, which is `isOwner`. A member never gets `SelectionPopover`, and even if one were forced client-side the API returns 404.

### 4. `PdfView` — the jump strip

New UI, the only genuinely new component in this design. Below the page controls:

- Renders `null` when the current file has no bookmarks, so existing data-rooms are visually unchanged.
- Lists this file's bookmarks sorted by `page`, then `order`. Each entry shows its page number and is tinted with its note's colour from `noteColors`.
- Clicking an entry sets the viewer to that page. It does not scroll to the rect — page-level precision matches how `initialPage` deep-links already behave from `HubNotesPanel`.
- Entries are `<button>` with an accessible name including the page, e.g. `Jump to page 3`.

## Error handling

| Failure | Behaviour |
|---|---|
| `POST /notes` fails | Error alert shown; `createNote` returns `null`; `SelectionPopover` aborts without creating a bookmark. No orphaned state. |
| `POST /bookmarks` fails | Error alert shown; local bookmark list unchanged. If the note was just created it remains — an empty note is harmless and visible to the owner. |
| Member somehow POSTs | Server returns 404 (`ownHubNote`). No client change needed. |
| File has no bookmarks | Jump strip renders nothing. |
| Non-PDF file | Unchanged: images render inline, everything else gets the download fallback. Bookmarks are PDF-only. |

## Testing

**Unit**
- `HubFilesTab` passes `editable` true only when `canManage`.
- `createNote` posts to `/api/hubs/h1/notes` and returns the new id; on failure returns `null` and shows the error.
- `createBookmark` posts to `/api/hubs/h1/notes/{noteId}/bookmarks` and appends on success.
- `PdfView` jump strip: renders nothing with zero bookmarks; renders one entry per bookmark sorted by page; clicking changes the page.

**Runtime smoke** (forged `galli-auth` per role)
- Owner `POST` bookmark → 201; member → 404; collaborator → 404.
- **A member's SSR payload for `?tab=files` contains no bookmark belonging to a private note** — seed a private note with a bookmark whose `title` and `text` are distinctive and assert their absence, and their presence for the owner.

**Browser smoke** (production build — `next dev` cannot load pdf.js through the worktree's symlinked `node_modules`)
- Owner selects text in a PDF → popover appears → save → highlight paints → reload → highlight persists.
- Member opens the same file → sees the highlight → text selection produces no popover.
- Jump strip navigates to the bookmarked page.

## Known cross-surface consequence

Highlighting in the Files tab creates a `HubNote`, and the Home tab's Notes card lists `HubNote`s. So **the owner will see notes appear on Home that they created while reading a PDF on Files.** This is inherent to D2 — the two surfaces share one model, and the alternative (a separate model for reading marks) is far more invasive than this feature warrants.

It is acceptable because the note is genuinely a note, and titling it after its source file makes its origin legible. Flagged here so it is a known consequence rather than a surprise. If it proves noisy in practice, the fix is a filter on the Notes card, not a schema change.

## Out of scope

- Member-authored or per-member private bookmarks (D1).
- A notes panel on the Files tab (D2).
- Any change to the Notes card on the Home tab.
- Bookmarks on non-PDF files.
- Scroll-to-rect precision in the jump strip.
- Editing or deleting bookmarks from the community surface — `PATCH`/`DELETE` endpoints exist and remain owner-only, but no UI is added here.
