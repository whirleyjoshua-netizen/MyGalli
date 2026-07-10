# In-Hub File Viewer — Design (Phase 1)

**Date:** 2026-07-07
**Status:** Approved (pending spec review)
**Scope:** Phase 1 of a two-phase feature. Phase 2 (highlight → bookmark in notes) is outlined at the end and gets its **own** spec after Phase 1 ships.

## Summary

Let Hub visitors and owners **view files inline** — PDFs and images open in a full-screen
**viewer modal** inside the Hub instead of downloading or opening a new tab. This is the
foundation for Phase 2 (text highlighting → named bookmarks in Notes), which needs a PDF
**text layer** to select from — so Phase 1 renders PDFs with `react-pdf` (pdf.js) including
selectable text, even though Phase 1 itself adds no bookmarking.

## Goals (Phase 1)

- Click a **PDF** item in a Hub → it opens in an inline, paginated viewer with zoom and a
  real selectable text layer. No download required.
- Click an **image** item → it opens in the **same** viewer (folding in the existing
  lightbox, so there is one consistent viewer for both).
- Works in **both** surfaces: the owner editor (`HubItemList` rows) and the **public**
  viewer (`HubViewer` `ItemCard`).
- A **Download** affordance remains available for any file.
- Respect the app's strict CSP with a self-hosted pdf.js worker (no external CDN).

## Non-Goals (Phase 1)

- Text highlighting, bookmarks, notes integration — that is **Phase 2** (separate spec).
- Office formats (`.docx/.xlsx/.pptx`) — not uploadable today and not viewable in-browser
  without an external iframe viewer; deferred.
- Annotations, form filling, printing UI, search-in-document.
- No schema or API changes in Phase 1 (pure client rendering of existing file items).

## Architecture

### New component: `src/components/hub/HubFileViewer.tsx`

A self-contained modal viewer.

**Props:**
```ts
interface HubFileViewerFile {
  id: string
  type: string          // 'pdf' | 'file' | 'image' | … (see kind detection)
  title: string
  url: string | null
}
interface HubFileViewerProps {
  file: HubFileViewerFile | null   // null → closed
  onClose: () => void
  initialPage?: number             // reserved for Phase 2 (bookmark deep-link); default 1
}
```

**Behavior:**
- Renders nothing when `file` is null.
- Fixed full-screen overlay (`fixed inset-0 z-50 bg-black/80`), centered content panel,
  a top bar with the title, a **Download** link (`<a href download>`), and a **Close** (X).
- Escape key and backdrop click close it.
- **Kind detection** (pure helper, see below): from `file.type` + URL extension, decide
  `pdf` vs `image` vs `other`.
  - `pdf` → `<PdfView url title />` (react-pdf).
  - `image` → `<img>` fit-to-viewport (the folded-in lightbox).
  - `other` (non-viewable, e.g. a link or unknown file) → a small "This file can't be
    previewed" panel with the Download/Open button (fallback; should be rare since only
    pdf/image reach the viewer).

### PDF rendering: `react-pdf` (wraps pdf.js)

- Add dependencies: `react-pdf` and its peer `pdfjs-dist` (pinned).
- Configure the worker to a **bundled** asset, not a CDN:
  `pdfjs.GlobalWorkerOptions.workerSrc` set to a self-hosted worker. Copy
  `pdfjs-dist/build/pdf.worker.min.mjs` into `public/pdf.worker.min.mjs` (a `postinstall`
  or committed copy) and point `workerSrc` at `/pdf.worker.min.mjs`.
- `<PdfView>` internal: `<Document file={url}>` with `<Page pageNumber={n} renderTextLayer
  renderAnnotationLayer={false} />`; a page control (Prev / `n of N` / Next) and a zoom
  control (`scale` state, − / reset / +). Import react-pdf's `TextLayer` + `AnnotationLayer`
  CSS.
- Loading and error states: spinner while the document loads; a friendly error with a
  Download fallback if pdf.js fails (e.g. corrupt file / fetch blocked).
- **SSR safety (required):** pdf.js touches browser-only globals (`DOMMatrix`, `canvas`),
  so the react-pdf part must never render on the server. `HubFileViewer` is a client
  component (`'use client'`), and `<PdfView>` is loaded via `next/dynamic` with
  `{ ssr: false }` so it's client-only. The modal itself may render immediately; only the
  PDF subtree is dynamically imported.

### Kind detection helper: `src/lib/hub-file-kind.ts` (pure, tested)

```ts
export type FileKind = 'pdf' | 'image' | 'other'
export function fileKind(input: { type?: string | null; url?: string | null }): FileKind
```
- Returns `pdf` when `type === 'pdf'` OR the URL path ends in `.pdf`.
- Returns `image` when `type === 'image'` OR the URL ends in a known image ext
  (`.jpg/.jpeg/.png/.gif/.webp`).
- Returns `other` otherwise.
- Query strings / fragments on the URL are ignored when checking the extension.

### Launch points

**Public viewer — `src/components/hub/HubViewer.tsx`:**
- Add local state `viewerFile: HubViewerItem | null` and render one `<HubFileViewer>` at the
  component root.
- `ItemCard` gains an `onView(item)` callback. Replace the image lightbox: an `image` card's
  click calls `onView(item)` (removing the old `lightboxOpen` state/markup). For a
  `pdf`/`file` card whose `fileKind` is viewable, the primary action becomes **View**
  (opens the viewer); keep a secondary **Download** (`<a href download>`). Non-viewable
  items (links, embeds, audio, locked) keep their current behavior unchanged.

**Editor — `src/components/hub/HubItemList.tsx`:**
- `ItemRow` for a viewable file gains a **View** action (eye icon) that opens the viewer;
  wire a `viewerFile` state + one `<HubFileViewer>` at the `HubItemList` root. The existing
  edit/delete/privacy affordances are unchanged.

### CSP additions — `next.config.js`

- Add `worker-src 'self' blob:` (pdf.js runs its parsing worker; may use a blob worker).
- Add the Blob host to `connect-src` so pdf.js can `fetch` the PDF bytes:
  `https://*.public.blob.vercel-storage.com` (and keep `blob:`/`data:` where relevant).
- `img-src` already allows the Blob host and `data:`/`blob:` (images unaffected).
- Verify `default-src`/`child-src` don't override the new `worker-src` (add `worker-src`
  explicitly so it doesn't fall through to a stricter default).

## Data Flow (Phase 1)

1. User clicks a viewable file item (editor or public viewer).
2. Host sets `viewerFile = item`; `<HubFileViewer file={item}>` opens.
3. `fileKind(item)` picks PDF vs image; react-pdf fetches the Blob URL and renders pages
   with a text layer (PDF) or the image fits to the viewport.
4. User pages/zooms/reads; **Download** still available. Close returns to the Hub.

## Testing (Phase 1)

- **Unit (TDD):** `src/lib/hub-file-kind.test.ts` — `fileKind` for: `type:'pdf'`,
  `.pdf` URL, `type:'image'`, each image extension, URL with query string, unknown/other,
  null/empty inputs.
- **Component/interaction:** viewer open/close (Escape + backdrop), PDF vs image branch
  selection, Download link present. pdf.js canvas rendering itself is verified **in-browser**
  (jsdom can't render pdf.js); component tests assert the branch/markup, not pixel output.
- **CSP smoke:** in-browser — open a real uploaded PDF in prod/preview and confirm no
  `Refused to…` CSP violations in the console (worker + fetch).

## Rollout

- Free feature. New deps: `react-pdf` + `pdfjs-dist` (self-hosted worker; audit-clean).
- Follows conventions: semantic Tailwind tokens, lucide icons, `safeHref` for any outbound
  link, modal pattern (`fixed inset-0 z-50 …`) matching the existing lightbox.

---

## Phase 2 — Highlight → bookmark in notes (DEFERRED; separate spec)

Outlined here for context only; **not** part of the Phase 1 build.

- **Model:** `HubNoteBookmark` (`id, noteId→HubNote, hubId, itemId→HubItem, page,
  rects Json, text, title, order, createdAt`); index `(hubId,itemId)` and `(noteId)`.
- **Anchor:** capture selection **page + rectangles in PDF-coordinate space + selected
  text**; rects (not text re-search) give exact, zoom-stable, multi-line highlights.
- **Flow:** owner selects text in the viewer → "Add bookmark" popover → choose note
  (existing/new) → title defaults to the highlighted text (editable) → save. Note card
  renders bookmark links; clicking opens the viewer at that file+page (`initialPage`) and
  scrolls to + shows the highlight. **Always-visible:** opening a file renders all its
  visible bookmarks' highlights.
- **Visibility:** bookmark highlights inherit the parent **note's** public/private setting;
  the public viewer renders only public notes' bookmarks (same guarantee as Phase 1 notes).
- **Who:** owners/collaborators create bookmarks; visitors view + click-navigate.
- The `HubFileViewer` `initialPage` prop and the text layer are provided in Phase 1 so
  Phase 2 can build the highlight overlay on top without reworking the viewer.
