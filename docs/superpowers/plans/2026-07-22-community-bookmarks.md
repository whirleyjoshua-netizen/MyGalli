# Community Hub Bookmarks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The community hub owner highlights passages in a PDF; every reader sees those highlights and can jump between them, entirely inside the file viewer.

**Architecture:** Almost entirely wiring. `PdfView` already paints highlight overlays and already runs the select-text → `SelectionPopover` → create-note/create-bookmark flow; it only needs the props. The server already computes visibility-filtered notes. New code is limited to one small pure component (the jump strip), two fetch handlers in `HubFilesTab`, and a bookmark fetch + visibility filter in `page.tsx`.

**Tech Stack:** Next.js 15 App Router, React 19, Prisma, Tailwind, Vitest + Testing Library (`fireEvent` only — `@testing-library/user-event` is NOT installed).

**Spec:** `docs/superpowers/specs/2026-07-22-community-bookmarks-design.md`. Read it first; decisions D1–D3 and the visibility hinge are not restated in full here.

## Global Constraints

- **Owner-only authoring.** `editable` is `canManage`, which is `isOwner`. Do **not** widen `ownHub` / `ownHubNote` on any notes or bookmarks route — they already match this gate.
- **The jump strip must render `null` when a file has no bookmarks**, so existing data-rooms are visually unchanged.
- **The server must filter bookmarks by note visibility** with `visibleBookmarks` from `@/lib/hub-highlight`, building `noteVisibility` from the **unfiltered** `noteRows`. `HubFileViewer` filters by `itemId` only; without the server filter a member receives the owner's private-note highlight text.
- **Creating a note from the viewer must send an explicit `title` and `visibility: 'public'`** — the note also appears in the Home tab's Notes card, where a blank title would surface as an unexplained empty entry.
- Tests: `JWT_SECRET` set, `--maxWorkers=2`, `fireEvent` not `user-event`.
- DB commands: `DATABASE_URL="postgresql://pages:pages@127.0.0.1:5434/pages"` and `DATABASE_URL_UNPOOLED="$DATABASE_URL"` (127.0.0.1, never `localhost`).
- **PDF behaviour cannot be smoke-tested through `next dev`** in this worktree: pdf.js fails module interop through the symlinked `node_modules` and the viewer hits an error boundary. Use `npx next build && npx next start` for any runtime PDF check. This is a rig artifact, not a product bug.

## File Structure

| File | Responsibility |
|---|---|
| `src/components/hub/PdfBookmarkStrip.tsx` (create) | The jump strip. Pure presentational — no react-pdf, no pdf.js — so it is unit-testable, which `PdfView` itself is not. |
| `src/components/hub/PdfView.tsx` (modify, ~L59-70) | Render the strip under the existing controls bar; wire its `onJump` to `setPage`. |
| `src/components/hub/community/HubFilesTab.tsx` (modify) | Accept notes + bookmarks, hold them in state, add `createNote` / `createBookmark`, pass everything to `HubFileViewer`. |
| `src/components/hub/community/CommunityHubView.tsx` (modify) | Forward `notes` and the new `fileBookmarks` into `HubFilesTab`. |
| `src/app/[username]/hub/[slug]/page.tsx` (modify, community branch) | Fetch bookmarks, filter with `visibleBookmarks`, pass down. |

---

### Task 1: The jump strip component

**Files:**
- Create: `src/components/hub/PdfBookmarkStrip.tsx`
- Test: `src/components/hub/PdfBookmarkStrip.test.tsx`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `export type StripBookmark = { id: string; noteId: string; page: number; title: string }`
  - `export function PdfBookmarkStrip({ bookmarks, noteColors, onJump }: { bookmarks: StripBookmark[]; noteColors?: Record<string, string>; onJump: (page: number) => void })`

`StripBookmark` is a structural subset of `PdfView`'s local `BookmarkLite`, so `BookmarkLite[]` can be passed straight in with no conversion.

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/hub/PdfBookmarkStrip.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PdfBookmarkStrip, type StripBookmark } from './PdfBookmarkStrip'

const bm = (id: string, page: number, noteId = 'n1'): StripBookmark =>
  ({ id, noteId, page, title: `Mark ${id}` })

describe('PdfBookmarkStrip', () => {
  it('renders nothing when there are no bookmarks', () => {
    // Guards the data-room: a file with no highlights must look exactly as before.
    const { container } = render(<PdfBookmarkStrip bookmarks={[]} onJump={() => {}} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('lists one entry per bookmark, ordered by page', () => {
    render(<PdfBookmarkStrip bookmarks={[bm('c', 6), bm('a', 1), bm('b', 3)]} onJump={() => {}} />)
    const names = screen.getAllByRole('button').map((b) => b.getAttribute('aria-label'))
    expect(names).toEqual(['Jump to page 1', 'Jump to page 3', 'Jump to page 6'])
  })

  it('reports the page when an entry is clicked', () => {
    const onJump = vi.fn()
    render(<PdfBookmarkStrip bookmarks={[bm('a', 1), bm('b', 4)]} onJump={onJump} />)
    fireEvent.click(screen.getByRole('button', { name: 'Jump to page 4' }))
    expect(onJump).toHaveBeenCalledWith(4)
  })

  it('tints each entry with its own note colour', () => {
    render(
      <PdfBookmarkStrip
        bookmarks={[bm('a', 1, 'n1'), bm('b', 2, 'n2')]}
        noteColors={{ n1: 'rgb(1, 2, 3)', n2: 'rgb(4, 5, 6)' }}
        onJump={() => {}}
      />
    )
    expect(screen.getByRole('button', { name: 'Jump to page 1' }).querySelector('span'))
      .toHaveStyle({ backgroundColor: 'rgb(1, 2, 3)' })
  })

  it('falls back to a default colour when the note has none', () => {
    render(<PdfBookmarkStrip bookmarks={[bm('a', 1, 'missing')]} onJump={() => {}} />)
    expect(screen.getByRole('button', { name: 'Jump to page 1' })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/jenniferjordan/joshwhirley/mg-hub-unified && JWT_SECRET=test-secret npx vitest run src/components/hub/PdfBookmarkStrip.test.tsx`
Expected: FAIL — cannot resolve `./PdfBookmarkStrip`

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/components/hub/PdfBookmarkStrip.tsx
'use client'

export type StripBookmark = { id: string; noteId: string; page: number; title: string }

const DEFAULT_COLOR = '#FDE047'

/**
 * Page jumps for a file's highlights. Renders nothing when the file has none,
 * so data-rooms without bookmarks look exactly as they did before this existed.
 */
export function PdfBookmarkStrip({
  bookmarks, noteColors = {}, onJump,
}: {
  bookmarks: StripBookmark[]
  noteColors?: Record<string, string>
  onJump: (page: number) => void
}) {
  if (bookmarks.length === 0) return null
  const ordered = [...bookmarks].sort((a, b) => a.page - b.page)

  return (
    <div className="flex flex-wrap items-center justify-center gap-1.5 text-white/80">
      <span className="text-xs uppercase tracking-wide text-white/50">Marks</span>
      {ordered.map((b) => (
        <button
          key={b.id}
          type="button"
          aria-label={`Jump to page ${b.page}`}
          title={b.title}
          onClick={() => onJump(b.page)}
          className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-xs hover:bg-white/20"
        >
          <span
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: noteColors[b.noteId] ?? DEFAULT_COLOR }}
          />
          p{b.page}
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/jenniferjordan/joshwhirley/mg-hub-unified && JWT_SECRET=test-secret npx vitest run src/components/hub/PdfBookmarkStrip.test.tsx`
Expected: PASS — 5 tests

- [ ] **Step 5: Commit**

```bash
git add src/components/hub/PdfBookmarkStrip.tsx src/components/hub/PdfBookmarkStrip.test.tsx
git commit -m "feat(hub): bookmark jump strip for the PDF viewer"
```

---

### Task 2: Render the strip inside PdfView

**Files:**
- Modify: `src/components/hub/PdfView.tsx`

**Interfaces:**
- Consumes: `PdfBookmarkStrip` (Task 1).
- Produces: no signature change — `PdfView`'s props are unchanged; it already receives `bookmarks` and `noteColors`.

`PdfView` has no test file: it imports `react-pdf`, which needs pdf.js browser globals that jsdom lacks. That is exactly why the strip is its own component. Verification here is typecheck + build, with behaviour covered by Task 1's tests and the Task 6 browser smoke.

- [ ] **Step 1: Import the strip**

```tsx
import { PdfBookmarkStrip } from './PdfBookmarkStrip'
```

- [ ] **Step 2: Render it under the controls bar**

Immediately after the closing `</div>` of the `flex items-center gap-2 text-sm text-white` controls row (~L70), insert:

```tsx
      {/* All of this file's marks, not just the current page's — this is the
          only way to discover highlights on other pages, since D2 puts no
          notes panel on the Files tab. */}
      <PdfBookmarkStrip bookmarks={bookmarks} noteColors={noteColors} onJump={setPage} />
```

Note it takes `bookmarks`, NOT the existing `pageBookmarks` local (which is filtered to the current page and drives the overlays).

- [ ] **Step 3: Verify**

Run: `cd /Users/jenniferjordan/joshwhirley/mg-hub-unified && npx tsc --noEmit -p tsconfig.json`
Expected: exit 0, no output.

- [ ] **Step 4: Commit**

```bash
git add src/components/hub/PdfView.tsx
git commit -m "feat(hub): show the bookmark jump strip in the PDF viewer"
```

---

### Task 3: HubFilesTab holds notes/bookmarks and authors them

**Files:**
- Modify: `src/components/hub/community/HubFilesTab.tsx`
- Test: `src/components/hub/community/HubFilesTab.test.tsx` (append)

**Interfaces:**
- Consumes: `StripNote` from `@/lib/hub-notes`; `HubFileViewer` (already imported).
- Produces: two new optional props on `HubFilesTab`:
  - `notes?: { id: string; title: string; color: string }[]` (default `[]`)
  - `initialBookmarks?: { id: string; noteId: string; itemId: string; page: number; rects: { x: number; y: number; w: number; h: number }[]; title: string }[]` (default `[]`)

- [ ] **Step 1: Write the failing test**

`createNote` and `createBookmark` are only reachable through `PdfView`, which cannot render in jsdom (react-pdf needs pdf.js browser globals). Reaching into component internals to invoke them would test the test harness, not the code. So the decision-carrying parts — the request shapes, which is where the two silent-failure modes live — are extracted as pure functions and tested directly. The wiring itself is covered by the tsc gate and the Task 6 browser smoke.

```ts
// src/lib/hub-bookmark-requests.test.ts
import { describe, it, expect } from 'vitest'
import { newNoteBody, bookmarkUrl } from './hub-bookmark-requests'

describe('newNoteBody', () => {
  it('titles the note after its source file and marks it public', () => {
    // Both matter: the note also appears in the Home tab's Notes card, where a
    // blank title reads as an unexplained empty entry; and a non-public note
    // would hide every highlight under it from members.
    expect(newNoteBody('Q3 Deck.pdf')).toEqual({ title: 'Notes on Q3 Deck.pdf', content: '', visibility: 'public' })
  })

  it('truncates a long file name to the route cap of 200 chars', () => {
    expect(newNoteBody('x'.repeat(400)).title.length).toBe(200)
  })
})

describe('bookmarkUrl', () => {
  it('nests the bookmark under its note', () => {
    expect(bookmarkUrl('h1', 'n1')).toBe('/api/hubs/h1/notes/n1/bookmarks')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/jenniferjordan/joshwhirley/mg-hub-unified && JWT_SECRET=test-secret npx vitest run src/lib/hub-bookmark-requests.test.ts`
Expected: FAIL — cannot resolve `./hub-bookmark-requests`

- [ ] **Step 3: Write the pure helpers**

`PdfView` and `HubFileViewer` each already declare their own local `BookmarkLite`. Rather than adding a third and fourth copy in `HubFilesTab` and `CommunityHubView`, export one shared type here and use it in the new code. Leave the two existing local copies alone — they are structurally identical, and rewiring them is unrelated refactoring.

```ts
// src/lib/hub-bookmark-requests.ts
import type { Rect } from '@/lib/hub-highlight'

/** Shared by the Files tab and the community view. Structurally identical to the
 *  local BookmarkLite in PdfView and HubFileViewer, so it passes straight in. */
export type BookmarkLite = {
  id: string
  noteId: string
  itemId: string
  page: number
  rects: Rect[]
  title: string
}

const TITLE_MAX = 200 // matches the notes route's slice(0, 200)

/**
 * Body for a note created by highlighting inside the file viewer.
 *
 * `visibility` is sent explicitly rather than relying on the route's default:
 * every highlight under a non-public note is invisible to members, so the whole
 * feature depends on it. The title matters because this note also appears in
 * the Home tab's Notes card — an empty title shows there as a blank entry.
 */
export function newNoteBody(fileTitle: string): { title: string; content: string; visibility: 'public' } {
  return { title: `Notes on ${fileTitle}`.slice(0, TITLE_MAX), content: '', visibility: 'public' }
}

export function bookmarkUrl(hubId: string, noteId: string): string {
  return `/api/hubs/${hubId}/notes/${noteId}/bookmarks`
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/jenniferjordan/joshwhirley/mg-hub-unified && JWT_SECRET=test-secret npx vitest run src/lib/hub-bookmark-requests.test.ts`
Expected: PASS — 3 tests

- [ ] **Step 5: Wire the handlers into HubFilesTab**

Add imports:

```tsx
import { newNoteBody, bookmarkUrl, type BookmarkLite } from '@/lib/hub-bookmark-requests'
import type { Rect } from '@/lib/hub-highlight'
```

Add to props (destructure and type), defaulting both to `[]`:

```tsx
  notes?: { id: string; title: string; color: string }[]
  initialBookmarks?: BookmarkLite[]
```

Add state and handlers inside the component:

```tsx
  const [noteList, setNoteList] = useState(notes)
  const [bookmarks, setBookmarks] = useState<BookmarkLite[]>(initialBookmarks)

  async function createNote(): Promise<string | null> {
    if (!viewing) return null
    const res = await fetch(`/api/hubs/${hubId}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newNoteBody(viewing.title)),
    })
    if (!res.ok) {
      setError((await res.json().catch(() => ({}))).error || 'Could not create the note')
      return null
    }
    const n = await res.json()
    setNoteList((cur) => [...cur, { id: n.id, title: n.title, color: n.color }])
    return n.id
  }

  async function createBookmark(input: { noteId: string; itemId: string; page: number; rects: Rect[]; text: string; title: string }) {
    const res = await fetch(bookmarkUrl(hubId, input.noteId), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })
    if (!res.ok) {
      setError((await res.json().catch(() => ({}))).error || 'Could not save the highlight')
      return
    }
    const b = await res.json()
    setBookmarks((cur) => [...cur, { id: b.id, noteId: b.noteId, itemId: b.itemId, page: b.page, rects: b.rects, title: b.title }])
  }
```

Extend the `HubFileViewer` call:

```tsx
      <HubFileViewer
        file={viewing ? { id: viewing.id, type: viewing.type, title: viewing.title, url: viewing.url } : null}
        onClose={() => setViewing(null)}
        editable={canManage}
        notes={noteList}
        bookmarks={bookmarks}
        onCreateNote={createNote}
        onCreateBookmark={createBookmark}
      />
```

- [ ] **Step 6: Verify nothing regressed**

Run: `cd /Users/jenniferjordan/joshwhirley/mg-hub-unified && JWT_SECRET=test-secret npx vitest run src/components/hub/community/ && npx tsc --noEmit -p tsconfig.json`
Expected: all community suites PASS, tsc exit 0.

- [ ] **Step 7: Commit**

```bash
git add src/lib/hub-bookmark-requests.ts src/lib/hub-bookmark-requests.test.ts src/components/hub/community/HubFilesTab.tsx
git commit -m "feat(hub): author and display bookmarks from the community Files tab"
```

---

### Task 4: Thread the props through CommunityHubView

**Files:**
- Modify: `src/components/hub/community/CommunityHubView.tsx`
- Test: `src/components/hub/community/CommunityHubView.test.tsx` (append)

**Interfaces:**
- Consumes: `HubFilesTab`'s new props (Task 3).
- Produces: new optional prop `fileBookmarks?: BookmarkLite[]` (default `[]`). The existing `notes` prop is reused — it is already `visibleNotes(...).map(toStripNote)` and `StripNote` is a superset of what the viewer needs.

This task is pure prop threading through a component whose Files body cannot render its viewer in jsdom. There is no honest unit assertion to add here beyond what Task 1 already covers, so **verification is the tsc gate plus the Task 6 browser smoke** — do not manufacture a test that only asserts an unrelated button still exists.

- [ ] **Step 1: Add and forward the prop**

Add `fileBookmarks = [],` to the destructure and `fileBookmarks?: BookmarkLite[]` to the props type (importing the shared type per Task 3), then extend the `HubFilesTab` call:

```tsx
            <HubFilesTab
              hubId={hub.id}
              canManage={!!isOwner}
              initialFolders={fileFolders}
              initialItems={fileItems}
              notes={notes.map((n) => ({ id: n.id, title: n.title, color: n.color }))}
              initialBookmarks={fileBookmarks}
            />
```

- [ ] **Step 2: Verify**

Run: `cd /Users/jenniferjordan/joshwhirley/mg-hub-unified && JWT_SECRET=test-secret npx vitest run src/components/hub/community/ && npx tsc --noEmit -p tsconfig.json`
Expected: existing community suites still PASS (no regression), tsc exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/components/hub/community/CommunityHubView.tsx
git commit -m "feat(hub): thread notes and bookmarks to the community Files tab"
```

---

### Task 5: Serve visibility-filtered bookmarks

**Files:**
- Modify: `src/app/[username]/hub/[slug]/page.tsx` (community branch)

**Interfaces:**
- Consumes: `visibleBookmarks` from `@/lib/hub-highlight`.
- Produces: `fileBookmarks` prop on `<CommunityHubView>`.

**This task carries the security requirement.** Read the spec's "Security: the visibility hinge" before starting.

- [ ] **Step 1: Import the helper**

Add to the existing imports:

```ts
import { visibleBookmarks } from '@/lib/hub-highlight'
```

- [ ] **Step 2: Fetch the bookmarks**

Append to the community branch's existing `Promise.all` array and add `bookmarkRows` to its destructure:

```ts
      db.hubNoteBookmark.findMany({ where: { hubId: hub.id }, orderBy: { order: 'asc' } }),
```

- [ ] **Step 3: Filter by note visibility**

After the `Promise.all`, beside the existing `const notes = visibleNotes(noteRows, viewer === 'owner').map(toStripNote)`:

```ts
    // Built from the UNFILTERED noteRows: a bookmark whose note was filtered out
    // must resolve to that note's real visibility and be dropped deliberately,
    // not fall through an undefined lookup.
    const noteVisibility = Object.fromEntries(noteRows.map((n) => [n.id, n.visibility]))
    const fileBookmarks = visibleBookmarks(bookmarkRows, noteVisibility, viewer === 'owner').map((b) => ({
      id: b.id,
      noteId: b.noteId,
      itemId: b.itemId,
      page: b.page,
      rects: b.rects as unknown as { x: number; y: number; w: number; h: number }[],
      title: b.title,
    }))
```

- [ ] **Step 4: Pass it down**

Add `fileBookmarks={fileBookmarks}` to `<CommunityHubView …>`, beside the existing `fileFolders` / `fileItems`.

- [ ] **Step 5: Verify**

Run: `cd /Users/jenniferjordan/joshwhirley/mg-hub-unified && npx tsc --noEmit -p tsconfig.json && npx next build`
Expected: tsc exit 0; build prints `Compiled successfully`.

- [ ] **Step 6: Commit**

```bash
git add "src/app/[username]/hub/[slug]/page.tsx"
git commit -m "feat(hub): SSR visibility-filtered bookmarks for the community Files tab"
```

---

### Task 6: Whole-feature verification

- [ ] **Step 1: Static gates**

```bash
cd /Users/jenniferjordan/joshwhirley/mg-hub-unified
npx tsc --noEmit -p tsconfig.json                 # exit 0
npx next lint --dir src                            # 0 errors
JWT_SECRET=test-secret npx vitest run --maxWorkers=2
npx next build                                     # Compiled successfully
```

- [ ] **Step 2: Seed the fixture**

Extend the existing smoke community hub (`smoke-community`, owner `smoketester`) with:
- a **public** note plus a bookmark on the valid PDF, titled `PUBLIC_MARK`
- a **private** note plus a bookmark on the same PDF, titled `SECRET_MARK`

- [ ] **Step 3: Runtime smoke**

Against `next start` (not `next dev` — see Global Constraints), with a forged `galli-auth` per role:

- `POST /api/hubs/<id>/notes` as owner → 201; as member → 404; as collaborator → 404
- `POST /api/hubs/<id>/notes/<noteId>/bookmarks` as owner → 201; as member → 404
- **Member's `?tab=files` HTML contains `PUBLIC_MARK` and does NOT contain `SECRET_MARK`**
- Owner's `?tab=files` HTML contains both

- [ ] **Step 4: Browser smoke**

Headless Chrome over CDP against the production server:
- Owner opens the PDF → jump strip shows one entry per visible mark → clicking one changes the page
- Owner selects text → `SelectionPopover` appears → saving paints a highlight → reload → highlight persists
- Member opens the same PDF → sees `PUBLIC_MARK`'s highlight and strip entry, never `SECRET_MARK` → selecting text produces no popover
- A file with no bookmarks shows no strip at all

- [ ] **Step 5: Ship**

Merge to `main` (auto-deploys). No migration in this feature, so the deploy is code-only.
