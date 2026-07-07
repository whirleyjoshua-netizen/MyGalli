# In-Hub File Viewer (Phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** View PDFs and images inline inside the Hub (no download) via a full-screen `HubFileViewer` modal, launched from both the owner editor and the public viewer.

**Architecture:** A client-only modal (`HubFileViewer.tsx`) picks a renderer from a pure `fileKind()` helper: PDFs render with `react-pdf` (pdf.js) in a dynamically-imported (`ssr:false`) `PdfView.tsx` with a self-hosted worker; images render as a fitted `<img>` (folding in the old lightbox); anything else shows a Download fallback. No schema/API changes.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Tailwind, lucide-react, `react-pdf` + `pdfjs-dist`, Vitest + Testing Library.

## Global Constraints

- **No schema or API changes.** Phase 1 is pure client rendering of existing file items.
- **SSR safety:** pdf.js uses browser-only globals. The PDF renderer MUST be a separate module loaded via `next/dynamic` with `{ ssr: false }`. Never import `react-pdf` into a server component or top-level of a server-reachable module.
- **CSP (strict, no CDN):** the pdf.js worker is **self-hosted** at `public/pdf.worker.min.mjs` (committed). `next.config.js` CSP gains `worker-src 'self' blob:` and the Blob host in `connect-src`. No external script/style/frame hosts added.
- **Viewability gate:** an item is viewable iff `fileKind(item)` is `'pdf'` or `'image'` (keyed off `type` AND URL extension — uploads are stored as `type:'file'` with a `.pdf`/`.jpg` URL, so extension detection is required).
- **Links:** any outbound URL goes through `safeHref` from `@/lib/editor/safe-href`.
- **Styling:** semantic Tailwind tokens (`surface`/`border`/`muted`/`primary`/`foreground`/`muted-foreground`), lucide icons, modal pattern `fixed inset-0 z-50 bg-black/80` (matches the existing lightbox being replaced).
- **DB env for any command that needs it:** `DATABASE_URL="postgresql://pages:pages@127.0.0.1:5434/pages"` (127.0.0.1). Phase 1 needs no migrations.
- **Tests:** Vitest (`import { describe, it, expect } from 'vitest'`), run with `npx vitest run <path>` (avoid the full `pnpm test` — the repo has unrelated worker-timeout flakiness in other suites).

---

## File Structure

- `package.json` / lockfile — add `react-pdf` + `pdfjs-dist` (Task 1).
- `public/pdf.worker.min.mjs` — committed self-hosted pdf.js worker (Task 1).
- `next.config.js` — CSP `worker-src` + `connect-src` Blob host (Task 1).
- `src/lib/hub-file-kind.ts` + `.test.ts` — pure `fileKind()` (Task 2).
- `src/components/hub/PdfView.tsx` — client-only react-pdf renderer (Task 3).
- `src/components/hub/HubFileViewer.tsx` + `.test.tsx` — the modal (Task 3).
- `src/components/hub/HubViewer.tsx` — public viewer wiring; fold lightbox (Task 4).
- `src/components/hub/HubItemList.tsx` — editor wiring (Task 5).

---

## Task 1: Dependencies, self-hosted worker, CSP

**Files:**
- Modify: `package.json` (+ lockfile) — add deps
- Create: `public/pdf.worker.min.mjs` (copied from node_modules, committed)
- Modify: `next.config.js:3-16` (CSP array)

**Interfaces:**
- Produces: `react-pdf` importable; `pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'` resolvable; CSP permits the worker + Blob fetch.

- [ ] **Step 1: Install react-pdf and a version-matched pdfjs-dist**

Run (from the worktree):
```bash
pnpm add react-pdf
PV=$(node -e "console.log(require('pdfjs-dist/package.json').version)")
echo "pdfjs-dist resolved to $PV"
pnpm add "pdfjs-dist@$PV"
```
Expected: both land in `package.json` dependencies; `$PV` prints a 4.x version. (Pinning `pdfjs-dist` to the exact version react-pdf pulled guarantees the worker matches the API.)

- [ ] **Step 2: Copy the worker into public/ (self-hosted, committed)**

```bash
cp node_modules/pdfjs-dist/build/pdf.worker.min.mjs public/pdf.worker.min.mjs
ls -la public/pdf.worker.min.mjs
```
Expected: file exists (~1MB). If the path differs, locate it: `find node_modules/.pnpm -name 'pdf.worker.min.mjs' | head -1` and copy that. This file is committed so the Vercel build needs no postinstall.

- [ ] **Step 3: Update CSP in `next.config.js`**

In the `csp` array, change the `connect-src` line to add the Blob host, and add a new `worker-src` line. Replace:
```js
  "connect-src 'self' https://accounts.google.com https://apis.google.com https://oauth2.googleapis.com https://nominatim.openstreetmap.org",
```
with:
```js
  "connect-src 'self' blob: data: https://*.public.blob.vercel-storage.com https://accounts.google.com https://apis.google.com https://oauth2.googleapis.com https://nominatim.openstreetmap.org",
  "worker-src 'self' blob:",
```
(Rationale: pdf.js `fetch`es the PDF bytes from the Blob host and may spin a blob-URL worker; `default-src 'self'` would otherwise block both.)

- [ ] **Step 4: Typecheck + build smoke**

```bash
npx tsc --noEmit
```
Expected: exit 0. (Full `next build` is exercised in Task 6; tsc confirms the deps typecheck.)

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-lock.yaml public/pdf.worker.min.mjs next.config.js
git commit -m "feat(hub): add react-pdf + self-hosted worker + CSP for file viewer"
```

---

## Task 2: `fileKind` helper (TDD)

**Files:**
- Create: `src/lib/hub-file-kind.ts`
- Test: `src/lib/hub-file-kind.test.ts`

**Interfaces:**
- Produces: `type FileKind = 'pdf' | 'image' | 'other'` and
  `fileKind(input: { type?: string | null; url?: string | null }): FileKind`.

- [ ] **Step 1: Write the failing test**

Create `src/lib/hub-file-kind.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { fileKind } from './hub-file-kind'

describe('fileKind', () => {
  it('detects pdf by type', () => {
    expect(fileKind({ type: 'pdf', url: null })).toBe('pdf')
  })
  it('detects pdf by url extension (ignoring query/hash)', () => {
    expect(fileKind({ type: 'file', url: 'https://x.blob/report.pdf' })).toBe('pdf')
    expect(fileKind({ type: 'file', url: 'https://x.blob/report.pdf?token=abc#p=2' })).toBe('pdf')
  })
  it('detects image by type', () => {
    expect(fileKind({ type: 'image', url: null })).toBe('image')
  })
  it('detects image by each known extension', () => {
    for (const ext of ['.jpg', '.jpeg', '.png', '.gif', '.webp']) {
      expect(fileKind({ type: 'file', url: `https://x.blob/pic${ext}` })).toBe('image')
    }
  })
  it('is case-insensitive on the extension', () => {
    expect(fileKind({ type: 'file', url: 'https://x.blob/PIC.PNG' })).toBe('image')
    expect(fileKind({ type: 'file', url: 'https://x.blob/DOC.PDF' })).toBe('pdf')
  })
  it('returns other for links, audio, unknown, and empty', () => {
    expect(fileKind({ type: 'link', url: 'https://example.com' })).toBe('other')
    expect(fileKind({ type: 'file', url: 'https://x.blob/song.mp3' })).toBe('other')
    expect(fileKind({ type: 'file', url: null })).toBe('other')
    expect(fileKind({})).toBe('other')
  })
})
```

- [ ] **Step 2: Run it, confirm it fails**

Run: `npx vitest run src/lib/hub-file-kind.test.ts`
Expected: FAIL — cannot resolve `./hub-file-kind`.

- [ ] **Step 3: Implement**

Create `src/lib/hub-file-kind.ts`:
```ts
export type FileKind = 'pdf' | 'image' | 'other'

const IMAGE_EXT = ['.jpg', '.jpeg', '.png', '.gif', '.webp']

function extname(url: string): string {
  // strip query/hash, then take the trailing .ext, lowercased
  const path = url.split(/[?#]/)[0]
  const dot = path.lastIndexOf('.')
  return dot === -1 ? '' : path.slice(dot).toLowerCase()
}

export function fileKind(input: { type?: string | null; url?: string | null }): FileKind {
  const type = (input.type ?? '').toLowerCase()
  const ext = input.url ? extname(input.url) : ''
  if (type === 'pdf' || ext === '.pdf') return 'pdf'
  if (type === 'image' || IMAGE_EXT.includes(ext)) return 'image'
  return 'other'
}
```

- [ ] **Step 4: Run it, confirm it passes**

Run: `npx vitest run src/lib/hub-file-kind.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add src/lib/hub-file-kind.ts src/lib/hub-file-kind.test.ts
git commit -m "feat(hub): fileKind helper (pdf/image/other) with tests"
```

---

## Task 3: `PdfView` + `HubFileViewer` modal

**Files:**
- Create: `src/components/hub/PdfView.tsx`
- Create: `src/components/hub/HubFileViewer.tsx`
- Test: `src/components/hub/HubFileViewer.test.tsx`

**Interfaces:**
- Consumes: `fileKind` (Task 2), `safeHref`.
- Produces:
  - `PdfView` (default export): `({ url }: { url: string }) => JSX` — client-only.
  - `HubFileViewerFile` interface `{ id: string; type: string; title: string; url: string | null }`.
  - `HubFileViewer` (named export): `({ file, onClose, initialPage? }) => JSX`. `file: HubFileViewerFile | null` — null renders nothing.

- [ ] **Step 1: Create `PdfView.tsx`**

Create `src/components/hub/PdfView.tsx`:
```tsx
'use client'

import { useState } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/TextLayer.css'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import { Loader2, ChevronLeft, ChevronRight, Minus, Plus } from 'lucide-react'

// Self-hosted worker (committed at public/pdf.worker.min.mjs) — no CDN, CSP-safe.
pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'

export default function PdfView({ url, initialPage = 1 }: { url: string; initialPage?: number }) {
  const [numPages, setNumPages] = useState(0)
  const [page, setPage] = useState(initialPage)
  const [scale, setScale] = useState(1.2)
  const [error, setError] = useState(false)

  const btn = 'p-1.5 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-40 text-white'

  return (
    <div className="flex flex-col items-center gap-3 w-full">
      <div className="flex items-center gap-2 text-sm text-white">
        <button type="button" className={btn} onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} aria-label="Previous page">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="tabular-nums">{page} / {numPages || '…'}</span>
        <button type="button" className={btn} onClick={() => setPage((p) => Math.min(numPages || p, p + 1))} disabled={!!numPages && page >= numPages} aria-label="Next page">
          <ChevronRight className="w-4 h-4" />
        </button>
        <span className="mx-1 w-px h-4 bg-white/20" />
        <button type="button" className={btn} onClick={() => setScale((s) => Math.max(0.5, +(s - 0.2).toFixed(2)))} aria-label="Zoom out">
          <Minus className="w-4 h-4" />
        </button>
        <button type="button" className="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs" onClick={() => setScale(1.2)}>Reset</button>
        <button type="button" className={btn} onClick={() => setScale((s) => Math.min(3, +(s + 0.2).toFixed(2)))} aria-label="Zoom in">
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {error ? (
        <p className="text-sm text-white/80 mt-6">Couldn&apos;t render this PDF — use Download instead.</p>
      ) : (
        <div className="overflow-auto max-h-[80vh] rounded-lg bg-white">
          <Document
            file={url}
            onLoadSuccess={({ numPages }) => setNumPages(numPages)}
            onLoadError={() => setError(true)}
            loading={<div className="p-10"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>}
          >
            <Page pageNumber={page} scale={scale} renderTextLayer renderAnnotationLayer={false} />
          </Document>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Create `HubFileViewer.tsx`**

Create `src/components/hub/HubFileViewer.tsx`:
```tsx
'use client'

import { useEffect } from 'react'
import dynamic from 'next/dynamic'
import { X, Download, Loader2 } from 'lucide-react'
import { fileKind } from '@/lib/hub-file-kind'
import { safeHref } from '@/lib/editor/safe-href'

// PDF renderer is client-only (pdf.js touches browser globals) — never SSR it.
const PdfView = dynamic(() => import('./PdfView'), {
  ssr: false,
  loading: () => <div className="p-10"><Loader2 className="w-6 h-6 animate-spin text-white" /></div>,
})

export interface HubFileViewerFile {
  id: string
  type: string
  title: string
  url: string | null
}

interface HubFileViewerProps {
  file: HubFileViewerFile | null
  onClose: () => void
  initialPage?: number
}

export function HubFileViewer({ file, onClose, initialPage }: HubFileViewerProps) {
  useEffect(() => {
    if (!file) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [file, onClose])

  if (!file) return null
  const href = safeHref(file.url ?? undefined)
  const kind = fileKind(file)

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex flex-col" onClick={onClose}>
      <div
        className="flex items-center justify-between px-4 py-3 text-white shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-sm font-medium truncate pr-4">{file.title}</p>
        <div className="flex items-center gap-2 shrink-0">
          {href && (
            <a href={href} download className="p-2 rounded-full bg-white/10 hover:bg-white/20" title="Download" aria-label="Download">
              <Download className="w-5 h-5" />
            </a>
          )}
          <button type="button" onClick={onClose} className="p-2 rounded-full bg-white/10 hover:bg-white/20" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div
        className="flex-1 overflow-auto flex items-start justify-center p-4"
        onClick={(e) => e.stopPropagation()}
      >
        {!href ? (
          <p className="text-white/80 text-sm mt-8">This file has no URL.</p>
        ) : kind === 'pdf' ? (
          <PdfView url={href} initialPage={initialPage} />
        ) : kind === 'image' ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={href} alt={file.title} className="max-w-full max-h-full rounded-lg object-contain" />
        ) : (
          <div className="text-center text-white/80 mt-8">
            <p className="text-sm mb-3">This file can&apos;t be previewed.</p>
            <a href={href} download className="inline-flex items-center gap-1 text-sm text-white underline">
              <Download className="w-4 h-4" /> Download
            </a>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Write the component test**

Create `src/components/hub/HubFileViewer.test.tsx`:
```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { HubFileViewer } from './HubFileViewer'

// Avoid loading react-pdf/pdf.js in jsdom (no image/pdf test needs it).
vi.mock('./PdfView', () => ({ default: () => <div data-testid="pdfview" /> }))

describe('HubFileViewer', () => {
  it('renders nothing when file is null', () => {
    const { container } = render(<HubFileViewer file={null} onClose={() => {}} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders an image and a Download link for an image file', () => {
    render(
      <HubFileViewer
        file={{ id: '1', type: 'file', title: 'Pic', url: 'https://x.blob/pic.png' }}
        onClose={() => {}}
      />
    )
    const img = screen.getByAltText('Pic') as HTMLImageElement
    expect(img.src).toContain('pic.png')
    expect(screen.getByLabelText('Download')).toBeTruthy()
  })

  it('closes on Escape and on backdrop click', () => {
    const onClose = vi.fn()
    render(
      <HubFileViewer
        file={{ id: '1', type: 'file', title: 'Pic', url: 'https://x.blob/pic.png' }}
        onClose={onClose}
      />
    )
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
    // backdrop is the Close button's reliable proxy here:
    fireEvent.click(screen.getByLabelText('Close'))
    expect(onClose).toHaveBeenCalledTimes(2)
  })
})
```

- [ ] **Step 4: Run tests + typecheck**

Run: `npx vitest run src/components/hub/HubFileViewer.test.tsx && npx tsc --noEmit`
Expected: 3/3 pass; tsc exit 0. (If `@testing-library/jest-dom` matchers like `toBeEmptyDOMElement`/`toBeTruthy` aren't set up, the repo's existing tests show the available style — mirror `HubViewer.test.tsx`'s imports/matchers; adjust assertions to that style if needed.)

- [ ] **Step 5: Commit**

```bash
git add src/components/hub/PdfView.tsx src/components/hub/HubFileViewer.tsx src/components/hub/HubFileViewer.test.tsx
git commit -m "feat(hub): HubFileViewer modal (PDF via react-pdf, image, fallback)"
```

---

## Task 4: Wire into the public viewer (fold the lightbox)

**Files:**
- Modify: `src/components/hub/HubViewer.tsx` (imports; `ItemCard` → `onView`; `HubViewer` state + render)

**Interfaces:**
- Consumes: `HubFileViewer`, `HubFileViewerFile`, `fileKind`.

- [ ] **Step 1: Add imports**

At the top of `src/components/hub/HubViewer.tsx`, add:
```tsx
import { HubFileViewer } from './HubFileViewer'
import { fileKind } from '@/lib/hub-file-kind'
```
(The `Eye` icon is also needed — add `Eye` to the existing `lucide-react` import.)

- [ ] **Step 2: Give `ItemCard` an `onView` prop and route viewable files through it**

Change the `ItemCard` signature (currently `function ItemCard({ item, hubId }: { item: HubViewerItem; hubId?: string })`) to also accept `onView`:
```tsx
function ItemCard({ item, hubId, onView }: { item: HubViewerItem; hubId?: string; onView: (item: HubViewerItem) => void }) {
```
Replace the whole `if (item.type === 'image') { … }` block (the thumbnail + lightbox, lines ~137-174) with a `fileKind`-based image card that opens the viewer instead of the old lightbox:
```tsx
  const kind = fileKind(item)

  if (kind === 'image') {
    return (
      <button
        type="button"
        onClick={() => onView(item)}
        className="flex items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2.5 text-left w-full hover:border-galli/50 transition"
      >
        {href ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={href} alt={item.title} className="w-10 h-10 rounded-lg object-cover shrink-0" />
        ) : (
          <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate">{item.title}</p>
        </div>
      </button>
    )
  }
```
(Note: `const href = safeHref(...)` already exists above this point; `kind` is declared here. Leave the `embed` and `note` branches unchanged — they appear before this in the function, so move the `const kind = fileKind(item)` line to just after `const href = ...` near line 135 to keep it in scope for the checks below. The `X` import may become unused once the lightbox markup is gone — remove `X` from the lucide import only if `grep -n "\bX\b" src/components/hub/HubViewer.tsx` shows no other use.)

- [ ] **Step 3: Give the generic file row a View action**

Replace the final `return` of `ItemCard` (the `// audio / video / file / pdf / link → Open link` block, lines ~202-219) with one that shows **View** for viewable files (pdf) and keeps **Open** for the rest:
```tsx
  // pdf → View in-app; audio / video / other file / link → Open
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2.5">
      <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">{item.title}</p>
      </div>
      {kind === 'pdf' ? (
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => onView(item)}
            className="px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-lg hover:opacity-90 inline-flex items-center gap-1"
          >
            <Eye className="w-3.5 h-3.5" /> View
          </button>
          {href && (
            <a href={href} download className="px-2 py-1.5 text-xs font-medium bg-muted rounded-lg hover:bg-muted/80">
              Download
            </a>
          )}
        </div>
      ) : (
        href && (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-lg hover:opacity-90"
          >
            Open
          </a>
        )
      )}
    </div>
  )
```

- [ ] **Step 4: Add viewer state to `HubViewer` and render it; pass `onView`**

In the `HubViewer` function body (after the other `useState` calls, ~line 269) add:
```tsx
  const [viewerFile, setViewerFile] = useState<HubViewerItem | null>(null)
```
Change the item render loop (line ~378) to pass `onView`:
```tsx
            <ItemCard key={item.id} item={item} hubId={hubId} onView={setViewerFile} />
```
Just before the final closing `</div>` of the outer wrapper (after `<NotesRail … />`, line ~387), add:
```tsx
      <HubFileViewer file={viewerFile} onClose={() => setViewerFile(null)} />
```

- [ ] **Step 5: Update the viewer test if it referenced the lightbox**

Run: `grep -n "lightbox\|getByAltText\|role=\"dialog\"" src/components/hub/HubViewer.test.tsx`
If any test asserted the old image-lightbox behavior, update it to the new flow (clicking an image card calls the viewer). If nothing matches, no test change is needed. Then run:
`npx vitest run src/components/hub/HubViewer.test.tsx && npx tsc --noEmit`
Expected: pass; tsc exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/components/hub/HubViewer.tsx src/components/hub/HubViewer.test.tsx
git commit -m "feat(hub): public viewer opens PDFs/images in HubFileViewer (folds lightbox)"
```

---

## Task 5: Wire into the editor item list

**Files:**
- Modify: `src/components/hub/HubItemList.tsx` (imports; `ItemRow` View action; `HubItemList` state + render)

**Interfaces:**
- Consumes: `HubFileViewer`, `fileKind`.

- [ ] **Step 1: Add imports**

At the top of `src/components/hub/HubItemList.tsx`, add:
```tsx
import { Eye } from 'lucide-react' // add to existing lucide import
import { HubFileViewer } from './HubFileViewer'
import { fileKind } from '@/lib/hub-file-kind'
```
(Merge `Eye` into the existing `lucide-react` import line rather than duplicating the import.)

- [ ] **Step 2: Add a View action to `ItemRow` for viewable files**

`ItemRow` receives the item and renders action buttons (edit/delete/privacy). Give it an `onView` prop:
```tsx
function ItemRow({
  item,
  isPro,
  onUpdate,
  onDelete,
  onSetPrivacy,
  onView,
}: {
  item: HubItem
  isPro: boolean
  onUpdate: (id: string, data: { title?: string; url?: string | null; content?: string | null }) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onSetPrivacy: (id: string, data: PrivacyApply) => Promise<void>
  onView: (item: HubItem) => void
}) {
```
In the non-editing return, immediately before the Edit (`Pencil`) button, add a View button shown only for viewable files:
```tsx
      {fileKind(item) !== 'other' && (
        <button
          type="button"
          onClick={() => onView(item)}
          className="p-1.5 rounded-lg hover:bg-muted opacity-0 group-hover:opacity-100 transition-opacity"
          title="View"
        >
          <Eye className="w-3.5 h-3.5" />
        </button>
      )}
```

- [ ] **Step 3: Add viewer state to `HubItemList`, pass `onView`, render the viewer**

In `HubItemList`, add state near the other `useState` (`addType`/`menuOpen`):
```tsx
  const [viewerFile, setViewerFile] = useState<HubItem | null>(null)
```
Pass `onView={setViewerFile}` to each `<ItemRow … />`. At the end of the `HubItemList` returned JSX (just before the outermost closing tag), add:
```tsx
      <HubFileViewer file={viewerFile} onClose={() => setViewerFile(null)} />
```
(`HubItem` from this file structurally satisfies `HubFileViewerFile` — `{ id, type, title, url }` are all present.)

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/components/hub/HubItemList.tsx
git commit -m "feat(hub): editor item list opens files in HubFileViewer"
```

---

## Task 6: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Typecheck + targeted tests**

```bash
npx tsc --noEmit
npx vitest run src/lib/hub-file-kind.test.ts src/components/hub/HubFileViewer.test.tsx src/components/hub/HubViewer.test.tsx
```
Expected: tsc exit 0; all listed tests pass.

- [ ] **Step 2: Production build smoke**

```bash
DATABASE_URL="postgresql://pages:pages@127.0.0.1:5434/pages" npx next build 2>&1 | tail -25
```
Expected: build succeeds. Watch specifically for: react-pdf SSR errors (would indicate the `ssr:false` dynamic import regressed), or worker/module resolution errors. If `next build` races a running `next dev` on Windows (`.next` EPERM), stop dev first and retry.

- [ ] **Step 3: Manual browser smoke (dev server)**

```bash
DATABASE_URL="postgresql://pages:pages@127.0.0.1:5434/pages" pnpm dev
```
As a logged-in hub owner:
1. Open a hub editor (`/hubs/<id>`) that has an uploaded **PDF** item → click the **View** (eye) action → the modal opens, the PDF renders, pages/zoom work, text is selectable, **Escape**/backdrop/Close all dismiss.
2. Open an **image** item → it opens in the same modal (not the old lightbox), fits the viewport, **Download** works.
3. Publish the hub → open the public URL as a logged-out visitor → **View** a PDF and an image there too.
4. **CSP check (critical):** open the browser console during steps 1–3 and confirm **no** `Refused to…` violations (worker, `connect-src` fetch of the PDF). If any appear, the `next.config.js` CSP needs the exact host/scheme the console names.

Expected: all steps pass with a clean console. Record any deviation and fix before marking complete.

- [ ] **Step 4: Final commit (if fixes were needed)**

```bash
git add -A
git commit -m "fix(hub): file viewer smoke-test fixes"
```

---

## Notes for the implementer

- Do NOT stage/commit: `.claude/settings.local.json`, `Documents/`, `Images/`, `g1t.json`, `nul`, `test-output.txt`. Stage only the files each task lists.
- `react-pdf` + React 19: if `pnpm add react-pdf` reports a peer-dependency conflict with React 19, install and verify it still builds/renders; react-pdf 9.1+ supports React 19. If it is genuinely incompatible, STOP and report (fallback would be raw `pdfjs-dist`, a larger change) rather than forcing it.
- The self-hosted worker file (`public/pdf.worker.min.mjs`) is intentionally committed so the Vercel build is deterministic with no postinstall step.
