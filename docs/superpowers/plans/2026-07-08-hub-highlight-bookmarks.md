# Hub Highlight → Bookmark Tool (Viewer Phase 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** In the Hub PDF viewer, an owner selects text → an auto popover creates a named **bookmark** in a Note (existing or new); the passage gets a persistent **note-colored highlight**; note cards render the bookmark as a link that reopens the viewer at that page. Public viewer renders highlights + navigation for **public** notes only.

**Architecture:** New `HubNoteBookmark` model + `HubNote.color`. Owner-gated bookmark CRUD under `/api/hubs/[id]/notes/[noteId]/bookmarks`. Pure `src/lib/hub-highlight.ts` for selection→PDF-coord conversion, overlay styling, and visibility/color resolution. `PdfView` gains a selection popover + highlight overlay; the editor's `HubFileViewer` is lifted from `HubItemList` up to `HubEditor` so it can reach the notes list + create handlers. Public `HubViewer` passes public bookmarks (read-only) and wires bookmark navigation.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Prisma + Postgres, Tailwind, lucide-react, react-pdf/pdf.js (already installed), Vitest + Testing Library.

## Global Constraints

- **Auth:** owner-gated via the existing `ownHub`/`ownHubNote` patterns (copy verbatim from the notes routes). Owner-only mutations.
- **Migrations non-interactive:** never `prisma migrate dev`. **Hand-author** the migration SQL (the shared dev DB carries other branches' tables, so `migrate diff --from-url` is contaminated — see [[migrate diff contamination]] in memory), then `prisma migrate deploy`.
- **DB env:** prefix every prisma/DB command with `DATABASE_URL="postgresql://pages:pages@127.0.0.1:5434/pages" DATABASE_URL_UNPOOLED="postgresql://pages:pages@127.0.0.1:5434/pages"` (127.0.0.1; both vars — schema uses `directUrl`).
- **Privacy invariant:** private notes' bookmarks/highlights MUST NOT reach non-owner clients — filter server-side in the public page loader, mirroring the existing `visibleNotes(notes, viewer==='owner')` filter.
- **Coordinate space:** bookmark `rects` are `[{x,y,w,h}]` in **unscaled rendered-page coords, top-left origin** (screen-rel ÷ scale). Render = `× scale`. Store/render use the SAME space (round-trips); this is not literal PDF-native (bottom-left) coords.
- **Selection is single-page:** the viewer shows one `<Page>` at a time, so a bookmark's `page` = the currently displayed page.
- **Highlights are non-blocking:** overlay divs use `pointer-events: none` so text stays selectable and the text layer stays on top.
- **Styling/links:** semantic Tailwind tokens, lucide icons, `safeHref` for any outbound URL.
- **Color:** `HubNote.color` is `"#RRGGBB"`; palette `['#FDE047','#FCA5A5','#93C5FD','#86EFAC','#C4B5FD','#FDBA74']`; default `'#FDE047'`.
- **Tests:** Vitest; run focused: `npx vitest run <path>` (avoid full `pnpm test` — unrelated suites flake on worker timeout).

---

## File Structure

- `prisma/schema.prisma` + `prisma/migrations/<ts>_add_hub_note_bookmark/migration.sql` (Task 1)
- `src/lib/hub-highlight.ts` + `.test.ts` (Task 2)
- `src/app/api/hubs/[id]/notes/[noteId]/bookmarks/route.ts` (POST) + `.../bookmarks/[bookmarkId]/route.ts` (PATCH/DELETE) (Task 3)
- `src/app/api/hubs/[id]/notes/[noteId]/route.ts` (accept `color`) + `src/app/api/hubs/[id]/route.ts` (payload) (Task 3)
- `src/app/[username]/hub/[slug]/page.tsx` (public bookmarks) (Task 3)
- `src/components/hub/PdfView.tsx` — popover + overlay (Task 4)
- `src/components/hub/HubFileViewer.tsx` — prop plumbing (Task 4)
- `src/components/hub/HubEditor.tsx` + `HubItemList.tsx` + `HubNotesPanel.tsx` — editor lift + bookmark/color UI (Task 5)
- `src/components/hub/HubViewer.tsx` — public wiring + rail bookmark links (Task 6)

---

## Task 1: Schema — `HubNoteBookmark` + `HubNote.color` + migration

**Files:**
- Modify: `prisma/schema.prisma` (`HubNote` model + new `HubNoteBookmark`)
- Create: `prisma/migrations/20260708000000_add_hub_note_bookmark/migration.sql`

- [ ] **Step 1: Edit schema**

In `model HubNote`, add these two lines (with the other fields/relations):
```prisma
  color       String            @default("#FDE047")
  bookmarks   HubNoteBookmark[]
```
After `model HubNote { … }`, add:
```prisma
model HubNoteBookmark {
  id        String   @id @default(cuid())
  noteId    String
  note      HubNote  @relation(fields: [noteId], references: [id], onDelete: Cascade)
  hubId     String
  itemId    String
  page      Int
  rects     Json
  text      String
  title     String
  order     Int      @default(0)
  createdAt DateTime @default(now())
  @@index([hubId, itemId])
  @@index([noteId])
}
```

- [ ] **Step 2: Validate + generate client**

```bash
DATABASE_URL="postgresql://pages:pages@127.0.0.1:5434/pages" DATABASE_URL_UNPOOLED="postgresql://pages:pages@127.0.0.1:5434/pages" npx prisma validate
DATABASE_URL="postgresql://pages:pages@127.0.0.1:5434/pages" DATABASE_URL_UNPOOLED="postgresql://pages:pages@127.0.0.1:5434/pages" npx prisma generate
```
Expected: "schema is valid" + "Generated Prisma Client".

- [ ] **Step 3: Hand-author the migration**

Create `prisma/migrations/20260708000000_add_hub_note_bookmark/migration.sql`:
```sql
-- CreateTable
CREATE TABLE "HubNoteBookmark" (
    "id" TEXT NOT NULL,
    "noteId" TEXT NOT NULL,
    "hubId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "page" INTEGER NOT NULL,
    "rects" JSONB NOT NULL,
    "text" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HubNoteBookmark_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HubNoteBookmark_hubId_itemId_idx" ON "HubNoteBookmark"("hubId", "itemId");
CREATE INDEX "HubNoteBookmark_noteId_idx" ON "HubNoteBookmark"("noteId");

-- AddForeignKey
ALTER TABLE "HubNoteBookmark" ADD CONSTRAINT "HubNoteBookmark_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "HubNote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "HubNote" ADD COLUMN "color" TEXT NOT NULL DEFAULT '#FDE047';
```

- [ ] **Step 4: Apply + verify**

```bash
DATABASE_URL="postgresql://pages:pages@127.0.0.1:5434/pages" DATABASE_URL_UNPOOLED="postgresql://pages:pages@127.0.0.1:5434/pages" npx prisma migrate deploy
echo 'SELECT 1 FROM "HubNoteBookmark" LIMIT 0; SELECT "color" FROM "HubNote" LIMIT 0;' | DATABASE_URL="postgresql://pages:pages@127.0.0.1:5434/pages" DATABASE_URL_UNPOOLED="postgresql://pages:pages@127.0.0.1:5434/pages" npx prisma db execute --stdin
```
Expected: migration applied; both selects succeed (table + column exist). Restart any running `next dev` (stale-client gotcha).

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260708000000_add_hub_note_bookmark
git commit -m "feat(hub): HubNoteBookmark model + HubNote.color + migration"
```

---

## Task 2: Pure helpers `src/lib/hub-highlight.ts` (TDD)

**Files:** Create `src/lib/hub-highlight.ts`; Test `src/lib/hub-highlight.test.ts`

**Interfaces:**
- Produces:
  - `interface Rect { x: number; y: number; w: number; h: number }`
  - `selectionRectsToPdf(clientRects: {left:number;top:number;width:number;height:number}[], pageRect: {left:number;top:number}, scale: number): Rect[]`
  - `pdfRectsToStyle(rects: Rect[], scale: number): {left:number;top:number;width:number;height:number}[]`
  - `visibleBookmarks<B extends {noteId:string}>(bookmarks: B[], noteVisibility: Record<string,string>, isOwner: boolean): B[]`
  - `bookmarkColor(noteId: string, noteColors: Record<string,string>, fallback?: string): string`

- [ ] **Step 1: Write the failing test**

Create `src/lib/hub-highlight.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { selectionRectsToPdf, pdfRectsToStyle, visibleBookmarks, bookmarkColor } from './hub-highlight'

describe('selectionRectsToPdf', () => {
  it('converts screen rects to unscaled page coords', () => {
    const page = { left: 100, top: 50 }
    const rects = [{ left: 110, top: 70, width: 40, height: 12 }]
    expect(selectionRectsToPdf(rects, page, 2)).toEqual([{ x: 5, y: 10, w: 20, h: 6 }])
  })
  it('handles multi-line (multi-rect) selections', () => {
    const page = { left: 0, top: 0 }
    const rects = [
      { left: 0, top: 0, width: 10, height: 10 },
      { left: 0, top: 10, width: 30, height: 10 },
    ]
    expect(selectionRectsToPdf(rects, page, 1)).toEqual([
      { x: 0, y: 0, w: 10, h: 10 },
      { x: 0, y: 10, w: 30, h: 10 },
    ])
  })
})

describe('pdfRectsToStyle round-trips selectionRectsToPdf', () => {
  it('× scale inverts ÷ scale', () => {
    const page = { left: 100, top: 50 }
    const screen = [{ left: 110, top: 70, width: 40, height: 12 }]
    const pdf = selectionRectsToPdf(screen, page, 2)
    expect(pdfRectsToStyle(pdf, 2)).toEqual([{ left: 20, top: 20, width: 40, height: 12 }])
  })
})

describe('visibleBookmarks', () => {
  const bms = [{ noteId: 'pub' }, { noteId: 'priv' }, { noteId: 'gone' }]
  const vis = { pub: 'public', priv: 'private' }
  it('owner sees all', () => {
    expect(visibleBookmarks(bms, vis, true)).toHaveLength(3)
  })
  it('visitor sees only bookmarks of public notes', () => {
    expect(visibleBookmarks(bms, vis, false).map((b) => b.noteId)).toEqual(['pub'])
  })
})

describe('bookmarkColor', () => {
  it('resolves the note color, else fallback', () => {
    expect(bookmarkColor('a', { a: '#123456' })).toBe('#123456')
    expect(bookmarkColor('missing', {}, '#FDE047')).toBe('#FDE047')
  })
})
```

- [ ] **Step 2: Run → fails**

Run: `npx vitest run src/lib/hub-highlight.test.ts` → FAIL (module missing).

- [ ] **Step 3: Implement**

Create `src/lib/hub-highlight.ts`:
```ts
export interface Rect { x: number; y: number; w: number; h: number }

export function selectionRectsToPdf(
  clientRects: { left: number; top: number; width: number; height: number }[],
  pageRect: { left: number; top: number },
  scale: number
): Rect[] {
  return clientRects.map((r) => ({
    x: (r.left - pageRect.left) / scale,
    y: (r.top - pageRect.top) / scale,
    w: r.width / scale,
    h: r.height / scale,
  }))
}

export function pdfRectsToStyle(rects: Rect[], scale: number) {
  return rects.map((r) => ({ left: r.x * scale, top: r.y * scale, width: r.w * scale, height: r.h * scale }))
}

export function visibleBookmarks<B extends { noteId: string }>(
  bookmarks: B[],
  noteVisibility: Record<string, string>,
  isOwner: boolean
): B[] {
  if (isOwner) return bookmarks
  return bookmarks.filter((b) => noteVisibility[b.noteId] === 'public')
}

export function bookmarkColor(noteId: string, noteColors: Record<string, string>, fallback = '#FDE047'): string {
  return noteColors[noteId] ?? fallback
}
```

- [ ] **Step 4: Run → passes**

Run: `npx vitest run src/lib/hub-highlight.test.ts` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/hub-highlight.ts src/lib/hub-highlight.test.ts
git commit -m "feat(hub): pure highlight helpers — rect conversion, visibility, color"
```

---

## Task 3: API — bookmark routes + color + payloads

**Files:**
- Create: `src/app/api/hubs/[id]/notes/[noteId]/bookmarks/route.ts`
- Create: `src/app/api/hubs/[id]/notes/[noteId]/bookmarks/[bookmarkId]/route.ts`
- Modify: `src/app/api/hubs/[id]/notes/[noteId]/route.ts` (accept `color`)
- Modify: `src/app/api/hubs/[id]/route.ts` (GET payload: bookmarks; note rows already carry `color`)

**Interfaces:**
- Produces: `POST /bookmarks` → 201 bookmark; `PATCH/DELETE /bookmarks/[id]`; notes PATCH accepts `color`; editor GET gains `bookmarks`. (Public-page bookmark loading is done in Task 6 alongside the `HubViewer` prop, to keep tsc green here.)

**Type note:** `BookmarkLite = { id, noteId, itemId, page, rects: {x,y,w,h}[], title }` is a structural shape reused across components (Tasks 4–6); each file may declare it locally (TS structural typing makes them interchangeable when passed) — keep the shape identical.

- [ ] **Step 1: Bookmark collection route (POST)**

Create `src/app/api/hubs/[id]/notes/[noteId]/bookmarks/route.ts`:
```ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'

async function ownHubNote(request: NextRequest, id: string, noteId: string) {
  const me = await getUser(request)
  if (!me) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const hub = await db.hub.findUnique({ where: { id } })
  if (!hub || hub.userId !== me.id) return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) }
  const note = await db.hubNote.findUnique({ where: { id: noteId } })
  if (!note || note.hubId !== id) return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) }
  return { me, hub, note }
}

function validRects(v: unknown): v is { x: number; y: number; w: number; h: number }[] {
  return Array.isArray(v) && v.length > 0 && v.every(
    (r) => r && typeof r === 'object' &&
      ['x', 'y', 'w', 'h'].every((k) => Number.isFinite((r as Record<string, unknown>)[k]))
  )
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string; noteId: string }> }) {
  const { id, noteId } = await params
  const r = await ownHubNote(request, id, noteId)
  if ('error' in r) return r.error

  const body = await request.json().catch(() => ({}))
  const itemId = typeof body.itemId === 'string' ? body.itemId : ''
  const item = itemId ? await db.hubItem.findUnique({ where: { id: itemId } }) : null
  if (!item || item.hubId !== id) return NextResponse.json({ error: 'Invalid itemId' }, { status: 400 })

  const page = Number(body.page)
  if (!Number.isInteger(page) || page < 1) return NextResponse.json({ error: 'Invalid page' }, { status: 400 })
  if (!validRects(body.rects)) return NextResponse.json({ error: 'Invalid rects' }, { status: 400 })

  const text = typeof body.text === 'string' ? body.text.slice(0, 2000) : ''
  const title = typeof body.title === 'string' && body.title.trim() ? body.title.slice(0, 200) : (text.slice(0, 80) || 'Bookmark')

  const max = await db.hubNoteBookmark.findFirst({ where: { noteId }, orderBy: { order: 'desc' } })
  const order = (max?.order ?? -1) + 1

  const bookmark = await db.hubNoteBookmark.create({
    data: { noteId, hubId: id, itemId, page, rects: body.rects, text, title, order },
  })
  return NextResponse.json(bookmark, { status: 201 })
}
```

- [ ] **Step 2: Bookmark item route (PATCH/DELETE)**

Create `src/app/api/hubs/[id]/notes/[noteId]/bookmarks/[bookmarkId]/route.ts`:
```ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'

async function ownBookmark(request: NextRequest, id: string, noteId: string, bookmarkId: string) {
  const me = await getUser(request)
  if (!me) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const hub = await db.hub.findUnique({ where: { id } })
  if (!hub || hub.userId !== me.id) return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) }
  const bm = await db.hubNoteBookmark.findUnique({ where: { id: bookmarkId } })
  if (!bm || bm.hubId !== id || bm.noteId !== noteId) return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) }
  return { me, bm }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string; noteId: string; bookmarkId: string }> }) {
  const { id, noteId, bookmarkId } = await params
  const r = await ownBookmark(request, id, noteId, bookmarkId)
  if ('error' in r) return r.error
  const body = await request.json().catch(() => ({}))
  const data: Record<string, unknown> = {}
  if (typeof body.title === 'string' && body.title.trim()) data.title = body.title.slice(0, 200)
  const bookmark = await db.hubNoteBookmark.update({ where: { id: bookmarkId }, data })
  return NextResponse.json(bookmark)
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string; noteId: string; bookmarkId: string }> }) {
  const { id, noteId, bookmarkId } = await params
  const r = await ownBookmark(request, id, noteId, bookmarkId)
  if ('error' in r) return r.error
  await db.hubNoteBookmark.delete({ where: { id: bookmarkId } })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 3: Accept `color` in notes PATCH**

In `src/app/api/hubs/[id]/notes/[noteId]/route.ts`, inside the PATCH `data` building (after the `minimized` line), add:
```ts
  if (typeof body.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(body.color)) data.color = body.color
```

- [ ] **Step 4: Add bookmarks to the editor GET payload**

In `src/app/api/hubs/[id]/route.ts` GET, extend the `Promise.all` and response. Change:
```ts
  const [folders, items, notes] = await Promise.all([
    db.hubFolder.findMany({ where: { hubId: id }, orderBy: { order: 'asc' } }),
    db.hubItem.findMany({ where: { hubId: id }, orderBy: { order: 'asc' } }),
    db.hubNote.findMany({ where: { hubId: id }, orderBy: { order: 'asc' } }),
  ])
```
to add bookmarks:
```ts
  const [folders, items, notes, bookmarks] = await Promise.all([
    db.hubFolder.findMany({ where: { hubId: id }, orderBy: { order: 'asc' } }),
    db.hubItem.findMany({ where: { hubId: id }, orderBy: { order: 'asc' } }),
    db.hubNote.findMany({ where: { hubId: id }, orderBy: { order: 'asc' } }),
    db.hubNoteBookmark.findMany({ where: { hubId: id }, orderBy: { order: 'asc' } }),
  ])
```
and change the return to include `bookmarks` (note rows already carry `color`):
```ts
  return NextResponse.json({ hub: r.hub, folders: safeFolders, items: safeItems, notes, bookmarks })
```

- [ ] **Step 5: Typecheck + commit**

```bash
npx tsc --noEmit
git add src/app/api/hubs
git commit -m "feat(hub): bookmark CRUD + note color + bookmarks in editor payload"
```
(Public-page bookmark loading + the `HubViewer bookmarks` prop are done together in Task 6, so tsc stays green here.)

---

## Task 4: `PdfView` selection popover + highlight overlay

**Files:**
- Modify: `src/components/hub/PdfView.tsx`
- Modify: `src/components/hub/HubFileViewer.tsx` (thread props)

**Interfaces:**
- `HubFileViewer` gains optional props: `itemId?: string`, `editable?: boolean`, `notes?: {id:string;title:string;color:string}[]`, `bookmarks?: BookmarkLite[]`, `onCreateBookmark?: (input: NewBookmark) => Promise<void>`, `onCreateNote?: () => Promise<string | null>` (returns new note id).
  - `type BookmarkLite = { id:string; noteId:string; itemId:string; page:number; rects:Rect[]; title:string }`
  - `type NewBookmark = { noteId:string; itemId:string; page:number; rects:Rect[]; text:string; title:string }`
- `PdfView` gains the same (minus file plumbing): `itemId`, `editable`, `notes`, `bookmarks` (for THIS item), `noteColors: Record<string,string>`, `onCreateBookmark`, `onCreateNote`.

- [ ] **Step 1: HubFileViewer — pass props through to PdfView**

In `HubFileViewer.tsx`, extend `HubFileViewerProps` with the optional props above, and pass them to `<PdfView>`. Compute `noteColors` from `notes` and the per-item bookmark subset:
```tsx
        ) : kind === 'pdf' ? (
          <PdfView
            url={href}
            initialPage={initialPage}
            itemId={file.id}
            editable={editable}
            notes={notes}
            noteColors={Object.fromEntries((notes ?? []).map((n) => [n.id, n.color]))}
            bookmarks={(bookmarks ?? []).filter((b) => b.itemId === file.id)}
            onCreateBookmark={onCreateBookmark}
            onCreateNote={onCreateNote}
          />
```
Non-editable/public callers simply omit `editable`/handlers (popover won't render). Keep the image/fallback branches unchanged.

- [ ] **Step 2: PdfView — wrap the page, add overlay + popover**

Rewrite `PdfView.tsx`'s render of `<Page>` to wrap it in a `position:relative` ref'd container, draw highlight overlays for the current page, and (when `editable`) show a selection popover. Full component:
```tsx
'use client'

import { useRef, useState } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/TextLayer.css'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import { Loader2, ChevronLeft, ChevronRight, Minus, Plus } from 'lucide-react'
import { selectionRectsToPdf, pdfRectsToStyle, type Rect } from '@/lib/hub-highlight'

pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'

type BookmarkLite = { id: string; noteId: string; itemId: string; page: number; rects: Rect[]; title: string }
type NoteLite = { id: string; title: string; color: string }

interface PdfViewProps {
  url: string
  initialPage?: number
  itemId?: string
  editable?: boolean
  notes?: NoteLite[]
  noteColors?: Record<string, string>
  bookmarks?: BookmarkLite[]
  onCreateBookmark?: (input: { noteId: string; itemId: string; page: number; rects: Rect[]; text: string; title: string }) => Promise<void>
  onCreateNote?: () => Promise<string | null>
}

export default function PdfView({ url, initialPage = 1, itemId, editable, notes = [], noteColors = {}, bookmarks = [], onCreateBookmark, onCreateNote }: PdfViewProps) {
  const [numPages, setNumPages] = useState(0)
  const [page, setPage] = useState(initialPage)
  const [scale, setScale] = useState(1.2)
  const [error, setError] = useState(false)
  const pageWrapRef = useRef<HTMLDivElement>(null)
  const [draft, setDraft] = useState<{ rects: Rect[]; text: string; left: number; top: number } | null>(null)

  const btn = 'p-1.5 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-40 text-white'
  const pageBookmarks = bookmarks.filter((b) => b.page === page)

  const handleMouseUp = () => {
    if (!editable || !onCreateBookmark) return
    const sel = window.getSelection()
    const wrap = pageWrapRef.current
    if (!sel || sel.isCollapsed || !wrap) { setDraft(null); return }
    const text = sel.toString().trim()
    if (!text) { setDraft(null); return }
    const range = sel.getRangeAt(0)
    if (!wrap.contains(range.commonAncestorContainer)) return
    const wrapRect = wrap.getBoundingClientRect()
    const clientRects = Array.from(range.getClientRects()).map((r) => ({ left: r.left, top: r.top, width: r.width, height: r.height }))
    if (!clientRects.length) return
    const rects = selectionRectsToPdf(clientRects, { left: wrapRect.left, top: wrapRect.top }, scale)
    const last = clientRects[clientRects.length - 1]
    setDraft({ rects, text, left: last.left - wrapRect.left, top: last.top - wrapRect.top + last.height + 4 })
  }

  return (
    <div className="flex flex-col items-center gap-3 w-full">
      <div className="flex items-center gap-2 text-sm text-white">
        <button type="button" className={btn} onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} aria-label="Previous page"><ChevronLeft className="w-4 h-4" /></button>
        <span className="tabular-nums">{page} / {numPages || '…'}</span>
        <button type="button" className={btn} onClick={() => setPage((p) => Math.min(numPages || p, p + 1))} disabled={!!numPages && page >= numPages} aria-label="Next page"><ChevronRight className="w-4 h-4" /></button>
        <span className="mx-1 w-px h-4 bg-white/20" />
        <button type="button" className={btn} onClick={() => setScale((s) => Math.max(0.5, +(s - 0.2).toFixed(2)))} aria-label="Zoom out"><Minus className="w-4 h-4" /></button>
        <button type="button" className="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs" onClick={() => setScale(1.2)}>Reset</button>
        <button type="button" className={btn} onClick={() => setScale((s) => Math.min(3, +(s + 0.2).toFixed(2)))} aria-label="Zoom in"><Plus className="w-4 h-4" /></button>
      </div>

      {error ? (
        <p className="text-sm text-white/80 mt-6">Couldn&apos;t render this PDF — use Download instead.</p>
      ) : (
        <div className="overflow-auto max-h-[80vh] rounded-lg bg-white">
          <Document file={url} onLoadSuccess={({ numPages }) => setNumPages(numPages)} onLoadError={() => setError(true)} loading={<div className="p-10"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>}>
            <div ref={pageWrapRef} className="relative inline-block" onMouseUp={handleMouseUp}>
              <Page pageNumber={page} scale={scale} renderTextLayer renderAnnotationLayer={false} />
              {/* highlight overlays */}
              {pageBookmarks.map((b) =>
                pdfRectsToStyle(b.rects, scale).map((s, i) => (
                  <div key={`${b.id}-${i}`} className="absolute pointer-events-none rounded-sm" style={{ left: s.left, top: s.top, width: s.width, height: s.height, backgroundColor: noteColors[b.noteId] ?? '#FDE047', opacity: 0.35 }} />
                ))
              )}
              {/* selection popover */}
              {draft && editable && (
                <SelectionPopover
                  left={draft.left}
                  top={draft.top}
                  notes={notes}
                  defaultTitle={draft.text}
                  onCancel={() => setDraft(null)}
                  onSave={async (noteChoice, title) => {
                    let noteId = noteChoice
                    if (noteChoice === '__new__') {
                      const created = onCreateNote ? await onCreateNote() : null
                      if (!created) { setDraft(null); return }
                      noteId = created
                    }
                    if (itemId && onCreateBookmark) {
                      await onCreateBookmark({ noteId, itemId, page, rects: draft.rects, text: draft.text, title })
                    }
                    setDraft(null)
                    window.getSelection()?.removeAllRanges()
                  }}
                />
              )}
            </div>
          </Document>
        </div>
      )}
    </div>
  )
}

function SelectionPopover({ left, top, notes, defaultTitle, onCancel, onSave }: {
  left: number; top: number; notes: NoteLite[]; defaultTitle: string
  onCancel: () => void; onSave: (noteId: string, title: string) => void | Promise<void>
}) {
  const [noteId, setNoteId] = useState(notes[0]?.id ?? '__new__')
  const [title, setTitle] = useState(defaultTitle.slice(0, 80))
  const [saving, setSaving] = useState(false)
  return (
    <div className="absolute z-10 w-64 rounded-xl border border-border bg-surface shadow-soft-lg p-2 space-y-2" style={{ left, top }} onMouseUp={(e) => e.stopPropagation()}>
      <p className="text-xs font-semibold text-muted-foreground px-1">Add bookmark</p>
      <select value={noteId} onChange={(e) => setNoteId(e.target.value)} className="w-full text-xs bg-background border border-border rounded-lg px-2 py-1.5">
        {notes.map((n) => <option key={n.id} value={n.id}>{n.title || 'Untitled note'}</option>)}
        <option value="__new__">+ New note</option>
      </select>
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Bookmark title" className="w-full text-sm bg-background border border-border rounded-lg px-2 py-1.5" autoFocus />
      <div className="flex gap-2">
        <button type="button" disabled={saving} onClick={async () => { setSaving(true); await onSave(noteId, title.trim() || defaultTitle.slice(0, 80) || 'Bookmark') }} className="px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-50">Save</button>
        <button type="button" onClick={onCancel} className="px-3 py-1.5 text-xs bg-muted rounded-lg hover:bg-muted/80">Cancel</button>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit` → clean. (No test for pdf.js render; the pure math is covered in Task 2.)

- [ ] **Step 4: Commit**

```bash
git add src/components/hub/PdfView.tsx src/components/hub/HubFileViewer.tsx
git commit -m "feat(hub): PDF selection popover + note-colored highlight overlays"
```

---

## Task 5: Editor integration (lift viewer to `HubEditor` + note-card bookmark/color UI)

**Files:**
- Modify: `src/components/hub/HubEditor.tsx`, `HubItemList.tsx`, `HubNotesPanel.tsx`

**Interfaces:**
- `HubNote` (client type) gains `color: string`; notes carry `bookmarks` via a separate `bookmarks` array kept in `HubEditor` state.
- `HubNotesPanel` gains: `bookmarks: BookmarkLite[]`, `onOpenBookmark: (itemId: string, page: number) => void`, `onRenameBookmark`, `onDeleteBookmark`, and `onUpdate` extended to accept `color`.

- [ ] **Step 1: HubEditor — state, handlers, lift viewer**

In `HubEditor.tsx`:
- Add `HubNote.color` to the imported type usage (extend the `HubNote` interface in `HubNotesPanel.tsx`, Step 3).
- Add state: `const [bookmarks, setBookmarks] = useState<BookmarkLite[]>([])`, `const [viewerFile, setViewerFile] = useState<HubItem | null>(null)`, `const [viewerPage, setViewerPage] = useState<number | undefined>(undefined)`. Populate `setBookmarks(data.bookmarks ?? [])` in the fetch `.then`.
- Extend `handleUpdateNote`'s data param type to include `'color'`.
- Add handlers:
```tsx
  const handleCreateNoteReturnId = async (): Promise<string | null> => {
    const res = await fetch(`/api/hubs/${hubId}/notes`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
    if (!res.ok) return null
    const note = await res.json()
    setNotes((prev) => [...prev, note])
    return note.id
  }
  const handleCreateBookmark = async (input: { noteId: string; itemId: string; page: number; rects: unknown; text: string; title: string }) => {
    const res = await fetch(`/api/hubs/${hubId}/notes/${input.noteId}/bookmarks`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) })
    if (res.ok) { const bm = await res.json(); setBookmarks((prev) => [...prev, bm]) }
  }
  const handleRenameBookmark = async (noteId: string, bookmarkId: string, title: string) => {
    const res = await fetch(`/api/hubs/${hubId}/notes/${noteId}/bookmarks/${bookmarkId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title }) })
    if (res.ok) { const bm = await res.json(); setBookmarks((prev) => prev.map((b) => (b.id === bookmarkId ? bm : b))) }
  }
  const handleDeleteBookmark = async (noteId: string, bookmarkId: string) => {
    const res = await fetch(`/api/hubs/${hubId}/notes/${noteId}/bookmarks/${bookmarkId}`, { method: 'DELETE' })
    if (res.ok) setBookmarks((prev) => prev.filter((b) => b.id !== bookmarkId))
  }
  const openViewer = (item: HubItem, pageNum?: number) => { setViewerFile(item); setViewerPage(pageNum) }
  const openBookmark = (itemId: string, pageNum: number) => {
    const it = items.find((i) => i.id === itemId)
    if (it) openViewer(it, pageNum)
  }
```
- Change `<HubItemList … />` to pass `onView={(item) => openViewer(item)}` (add the prop; remove HubItemList's internal viewer — Step 2).
- Change `<HubNotesPanel … />` to pass `bookmarks={bookmarks}`, `onOpenBookmark={openBookmark}`, `onRenameBookmark={handleRenameBookmark}`, `onDeleteBookmark={handleDeleteBookmark}` (and the color-capable `onUpdate`).
- Render the viewer once at the end of HubEditor's JSX:
```tsx
      <HubFileViewer
        file={viewerFile}
        initialPage={viewerPage}
        onClose={() => { setViewerFile(null); setViewerPage(undefined) }}
        editable
        itemId={viewerFile?.id}
        notes={notes.map((n) => ({ id: n.id, title: n.title, color: n.color }))}
        bookmarks={bookmarks}
        onCreateBookmark={handleCreateBookmark}
        onCreateNote={handleCreateNoteReturnId}
      />
```
Import `HubFileViewer` and the `BookmarkLite` type (define/export `BookmarkLite` from `HubNotesPanel.tsx` or a shared spot).

- [ ] **Step 2: HubItemList — drop internal viewer, take `onView`**

In `HubItemList.tsx`: remove the `viewerFile` state and the `<HubFileViewer … />` render and its import. Add `onView: (item: HubItem) => void` to `HubItemListProps`; the View button calls `onView(item)`. Pass `onView` down to `ItemRow` (it already has an `onView` prop from Phase 1 — now sourced from the parent instead of local state).

- [ ] **Step 3: HubNotesPanel — color dot + bookmark list**

In `HubNotesPanel.tsx`:
- Add `color: string` to the `HubNote` interface; extend `onUpdate` Pick to include `'color'`.
- Add props `bookmarks`, `onOpenBookmark`, `onRenameBookmark`, `onDeleteBookmark` to `HubNotesPanelProps` and thread to `NoteCard`.
- Export `type BookmarkLite = { id: string; noteId: string; itemId: string; page: number; rects: {x:number;y:number;w:number;h:number}[]; title: string }`.
- In `NoteCard` (expanded view), add a **color dot** button before the title that cycles/opens the palette:
```tsx
        <button type="button" title="Highlight color" onClick={() => setPaletteOpen((v) => !v)} className="w-4 h-4 rounded-full border border-border shrink-0" style={{ backgroundColor: note.color }} />
```
with a small palette popover (`PALETTE.map` → `onUpdate(note.id, { color })`).
- Below the visibility row, render the note's bookmarks:
```tsx
        {noteBookmarks.length > 0 && (
          <div className="pt-1 border-t border-border space-y-1">
            {noteBookmarks.map((b) => (
              <div key={b.id} className="flex items-center gap-1.5 group/bm">
                <button type="button" onClick={() => onOpenBookmark(b.itemId, b.page)} className="flex-1 min-w-0 text-left text-xs text-primary hover:underline truncate">↳ {b.title} · p.{b.page}</button>
                <button type="button" onClick={() => { const t = prompt('Rename bookmark', b.title); if (t && t.trim()) onRenameBookmark(note.id, b.id, t.trim()) }} className="opacity-0 group-hover/bm:opacity-100 p-0.5 rounded hover:bg-muted" title="Rename"><Pencil className="w-3 h-3" /></button>
                <button type="button" onClick={() => { if (confirm('Delete bookmark?')) onDeleteBookmark(note.id, b.id) }} className="opacity-0 group-hover/bm:opacity-100 p-0.5 rounded hover:bg-destructive/10 text-destructive" title="Delete"><Trash2 className="w-3 h-3" /></button>
              </div>
            ))}
          </div>
        )}
```
where `const noteBookmarks = bookmarks.filter((b) => b.noteId === note.id)`. Import `Pencil` from lucide (Trash2 already imported). Add `useState` `paletteOpen`. Define `const PALETTE = ['#FDE047','#FCA5A5','#93C5FD','#86EFAC','#C4B5FD','#FDBA74']`.

- [ ] **Step 4: Typecheck + commit**

```bash
npx tsc --noEmit
git add src/components/hub/HubEditor.tsx src/components/hub/HubItemList.tsx src/components/hub/HubNotesPanel.tsx
git commit -m "feat(hub): editor bookmarks — lift viewer, note colors, bookmark links"
```

---

## Task 6: Public viewer integration

**Files:**
- Modify: `src/components/hub/HubViewer.tsx`
- Modify: `src/app/[username]/hub/[slug]/page.tsx` (pass `bookmarks` prop — deferred from Task 3 Step 5)

**Interfaces:**
- `HubViewer` gains `bookmarks: BookmarkLite[]`; `HubViewerNote` gains `color`. Rail bookmark links + read-only highlights in the viewer.

- [ ] **Step 1: HubViewer — accept bookmarks + colors, render rail links, pass to viewer**

In `HubViewer.tsx`:
- Add `bookmarks: {id:string;noteId:string;itemId:string;page:number;rects:{x:number;y:number;w:number;h:number}[];title:string}[]` to `HubViewerProps`; add `color: string` to `HubViewerNote`.
- Add `const [viewerPage, setViewerPage] = useState<number | undefined>(undefined)` alongside `viewerFile`.
- `NotesRail`: for each note, render its bookmarks (`bookmarks.filter(b => b.noteId === note.id)`) as read-only links calling `onOpenBookmark(itemId, page)`; add `onOpenBookmark` prop to `NotesRail`.
- Wire `openBookmark`:
```tsx
  const openBookmark = (itemId: string, pageNum: number) => {
    const it = items.find((i) => i.id === itemId)
    if (it) { setViewerFile(it); setViewerPage(pageNum) }
  }
```
- Pass to the rail: `<NotesRail notes={notes} items={items} bookmarks={bookmarks} onOpenBookmark={openBookmark} />`.
- Update the viewer render (read-only highlights):
```tsx
      <HubFileViewer
        file={viewerFile}
        initialPage={viewerPage}
        onClose={() => { setViewerFile(null); setViewerPage(undefined) }}
        notes={notes.map((n) => ({ id: n.id, title: n.title, color: n.color }))}
        bookmarks={bookmarks}
      />
```
(No `editable`/handlers → no popover; highlights still render since `PdfView` draws overlays from `bookmarks`.)

- [ ] **Step 2: Public page — load bookmarks, filter, pass the prop**

In `src/app/[username]/hub/[slug]/page.tsx`:
- Add import: `import { visibleBookmarks } from '@/lib/hub-highlight'`.
- Add `db.hubNoteBookmark.findMany({ where: { hubId: hub.id }, orderBy: { order: 'asc' } })` to the parallel loads and capture it as `bookmarks` in the destructure.
- Ensure each `safeNotes` entry includes `color: n.color`.
- After `safeNotes`, add:
```ts
  const noteVisibility = Object.fromEntries(notes.map((n) => [n.id, n.visibility]))
  const safeBookmarks = visibleBookmarks(bookmarks, noteVisibility, viewer === 'owner').map((b) => ({
    id: b.id, noteId: b.noteId, itemId: b.itemId, page: b.page, rects: b.rects, title: b.title,
  }))
```
- Pass `bookmarks={safeBookmarks}` to `<HubViewer>`.

- [ ] **Step 3: Update HubViewer test for the new required prop**

Run: `grep -n "render(<HubViewer" src/components/hub/HubViewer.test.tsx`. Add `bookmarks={[]}` to each render call (and `color` to any inline note fixtures the tests construct). Run:
`npx vitest run src/components/hub/HubViewer.test.tsx && npx tsc --noEmit` → pass + clean.

- [ ] **Step 4: Commit**

```bash
git add src/components/hub/HubViewer.tsx "src/app/[username]/hub/[slug]/page.tsx" src/components/hub/HubViewer.test.tsx
git commit -m "feat(hub): public viewer renders public bookmarks + highlight navigation"
```

---

## Task 7: Full verification

- [ ] **Step 1: Typecheck + targeted tests**

```bash
npx tsc --noEmit
npx vitest run src/lib/hub-highlight.test.ts src/lib/hub-notes.test.ts src/lib/hub-file-kind.test.ts src/components/hub/HubViewer.test.tsx src/components/hub/HubFileViewer.test.tsx
```
Expected: tsc clean; all pass.

- [ ] **Step 2: Production build smoke**

```bash
DATABASE_URL="postgresql://pages:pages@127.0.0.1:5434/pages" DATABASE_URL_UNPOOLED="postgresql://pages:pages@127.0.0.1:5434/pages" npx next build 2>&1 | tail -20
```
Expected: build succeeds (watch for react-pdf SSR regressions). If disk is tight, clear `.next` first; if it fails only on disk/time, note it and rely on the Vercel build.

- [ ] **Step 3: Manual browser smoke (dev server)**

```bash
DATABASE_URL="postgresql://pages:pages@127.0.0.1:5434/pages" DATABASE_URL_UNPOOLED="postgresql://pages:pages@127.0.0.1:5434/pages" pnpm dev
```
As a hub owner:
1. Open a PDF in a hub → **select text** → popover appears → pick a note (or **New note**), edit the title → Save → the passage is **highlighted in the note's color**, and a **bookmark link** shows on the note card.
2. Change the note's **color dot** → its highlight recolors.
3. Click the note-card **bookmark link** → viewer reopens at that page with the highlight visible.
4. Page/zoom → highlights stay aligned; text is still selectable (highlights don't block).
5. Mark one note **private**, one **public**. Publish → open the public URL logged-out → **only the public note's** highlight + bookmark appear; private is absent. Console clean (no CSP `Refused to…`).

Record any deviation and fix before completion.

- [ ] **Step 4: Final commit (if fixes)**

```bash
git add -A && git commit -m "fix(hub): highlight-bookmark smoke-test fixes"
```

---

## Notes for the implementer

- Do NOT stage/commit: `.claude/settings.local.json`, `Documents/`, `Images/`, `g1t.json`, `nul`, `test-output.txt`. Stage only each task's listed files.
- The pure coordinate math (Task 2) is where correctness lives — keep those tests green; the pdf.js overlay just consumes them.
- Keep the privacy filter server-side (public page): private bookmarks must never be in the client payload; `visibleBookmarks` is defense-in-depth, not the primary gate.
