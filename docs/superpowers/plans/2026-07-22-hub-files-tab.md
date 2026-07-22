# Hub Files Tab Implementation Plan (Plan 2/2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give community hubs a real `Home | Files` tab bar whose Files tab renders the hub's data-room — browsable by everyone who can see the hub, manageable by the owner.

**Architecture:** Option (b) from the handoff. A new focused `HubFilesTab` reuses the existing leaf components (`HubFolderTree`, `HubFileViewer`) and implements its own fetch + handlers behind a `canManage` gate. `HubEditor` is **not touched**. Tab state lives in the URL (`?tab=files`) via `useSearchParams`, wrapped in `<Suspense>` per repo precedent. The server pre-filters folders/items through the existing `resolveHubVisibility` so nothing hidden ever reaches the client.

**Tech Stack:** Next.js 15 App Router, React 19, Prisma, Tailwind, Vitest + Testing Library (`fireEvent` — `@testing-library/user-event` is NOT installed).

## Global Constraints

- **Do not modify `HubEditor.tsx`.** It is the live file-only data-room owner view. Option (b) was chosen specifically to leave it alone.
- **Do not widen the file-mutation APIs.** `items/`, `items/[itemId]/`, `folders/`, `folders/[folderId]/` all gate on `ownHub()` (`hub.userId !== me.id` → 404). See "Deviation from spec D4" below.
- **Do not flip any hub's `community` flag** and do not change the file-only creation path.
- Members get no visibility tier beyond `public` — mapping a `members` tier onto `HubMember` is an explicit non-goal.
- Tests: run with `JWT_SECRET` set and `--maxWorkers=2`. Use `fireEvent`, never `user-event`.
- DB commands need `DATABASE_URL="postgresql://pages:pages@127.0.0.1:5434/pages"` and `DATABASE_URL_UNPOOLED="$DATABASE_URL"` (127.0.0.1, never `localhost`).

## Deviation from spec D4 — read this before Task 4

Spec D4 says **owner *and collaborators*** manage files via `canModerate`. The code disagrees: every file-mutation route uses

```ts
if (!hub || hub.userId !== me.id) return NextResponse.json({ error: 'Not found' }, { status: 404 })
```

Collaborators get a 404. Rendering manage controls to a collaborator would therefore ship upload/delete buttons that fail. Making D4 true as written means widening four production routes to `canModerate`, which would *also* grant collaborators on existing **file-only data-rooms** upload/delete/visibility rights — a live permission change on a surface the spec says to leave untouched.

**This plan ships `canManage = isOwner`.** Collaborators browse like members. Widening to collaborators is a separate change with its own review and its own tests against the data-room. Do not fold it in here.

## Second spec/code mismatch — affects Task 3

Spec Part B says the Files tab renders "`HubFolderTree` + `HubItemList` + `HubFileViewer`". `HubItemList` is **manage-only**: its signature is `({ items, isPro, onCreate, onUpdate, onDelete, onSetPrivacy, onView })` and it unconditionally renders an "Add" button. It has no read-only mode, and `HubViewer`'s read-only list is internal and not exported.

So: `HubItemList` is used **only** in the manage branch (Task 4). The read branch (Task 3) gets a small local `ReadOnlyItemList` inside `HubFilesTab`. Do not try to force `HubItemList` into read-only.

## Reuse, do not rewrite: `@/lib/hub-tree`

`src/lib/hub-tree.ts` **already exports** `buildFolderTree(folders: FolderNode[]): TreeNode[]`, already has tests in `hub-tree.test.ts`, and `TreeNode[]` is exactly what `HubFolderTree`'s `tree` prop takes. Do **not** write another tree builder — import the existing one.

Its `FolderNode` requires `{ id, parentId, name, order }`, so this plan's `FileFolder` (same four fields plus `locked`) is structurally compatible and can be passed straight in. Its orphan handling already matches what the Files tab needs: a folder whose parent was removed by visibility filtering is promoted to a root rather than dropped, so its visible children never vanish.

## File Structure

| File | Responsibility |
|---|---|
| `src/lib/hub-files-view.ts` (create) | One pure helper: `itemsInFolder`. **Folder-tree building already exists** — see below. |
| `src/components/hub/community/HubFilesTab.tsx` (create) | The Files tab. Read branch for everyone; manage branch behind `canManage`. Owns its fetch + handlers. |
| `src/components/hub/community/CommunityTabs.tsx` (create) | The `Home \| Files` tab bar. Reads/writes `?tab=`. |
| `src/components/hub/community/CommunityHubView.tsx` (modify ~L97) | Swap the decorative `Home` label for `CommunityTabs`; render Home body or `HubFilesTab`. |
| `src/app/[username]/hub/[slug]/page.tsx` (modify, community branch ~L76-140) | SSR visibility-filtered `folders`/`items` for community hubs. |
| `src/components/hub/community/CommunityUtilityStrip.tsx` (modify L215) | Files button → select Files tab instead of opening `HubResourcesModal`. |

---

### Task 1: Pure view helpers

**Files:**
- Create: `src/lib/hub-files-view.ts`
- Test: `src/lib/hub-files-view.test.ts`

**Interfaces:**
- Consumes: `buildFolderTree` from `@/lib/hub-tree` (existing — do not reimplement).
- Produces:
  - `export type FileFolder = { id: string; parentId: string | null; name: string; order: number; locked: boolean }`
  - `export type FileItem = { id: string; folderId: string | null; type: string; title: string; url: string | null; order: number; locked: boolean }`
  - `export function itemsInFolder(items: FileItem[], folderId: string | null): FileItem[]`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/hub-files-view.test.ts
import { describe, it, expect } from 'vitest'
import { buildFolderTree } from '@/lib/hub-tree'
import { itemsInFolder, type FileFolder, type FileItem } from './hub-files-view'

const f = (id: string, parentId: string | null, order = 0): FileFolder =>
  ({ id, parentId, name: id, order, locked: false })
const i = (id: string, folderId: string | null, order = 0): FileItem =>
  ({ id, folderId, type: 'file', title: id, url: null, order, locked: false })

describe('FileFolder feeds the existing tree builder', () => {
  // Guards the structural compatibility this plan depends on: if FileFolder or
  // hub-tree's FolderNode drift apart, this fails instead of the Files tab.
  it('nests and orders through buildFolderTree', () => {
    const tree = buildFolderTree([f('b', null, 1), f('a', null, 0), f('a1', 'a')])
    expect(tree.map((n) => n.id)).toEqual(['a', 'b'])
    expect(tree[0].children.map((n) => n.id)).toEqual(['a1'])
  })

  it('promotes a visibility-orphaned folder to the root instead of dropping it', () => {
    expect(buildFolderTree([f('orphan', 'hidden-parent')]).map((n) => n.id)).toEqual(['orphan'])
  })
})

describe('itemsInFolder', () => {
  it('returns only that folder, ordered', () => {
    expect(itemsInFolder([i('b', 'f1', 1), i('a', 'f1', 0), i('c', 'f2')], 'f1').map((x) => x.id))
      .toEqual(['a', 'b'])
  })

  it('treats null as the root folder', () => {
    expect(itemsInFolder([i('root', null), i('nested', 'f1')], null).map((x) => x.id)).toEqual(['root'])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/jenniferjordan/joshwhirley/mg-hub-unified && JWT_SECRET=test-secret npx vitest run src/lib/hub-files-view.test.ts`
Expected: FAIL — `Failed to resolve import "./hub-files-view"`

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/hub-files-view.ts
// Folder-tree building lives in @/lib/hub-tree — FileFolder is shaped to feed it.
export type FileFolder = { id: string; parentId: string | null; name: string; order: number; locked: boolean }
export type FileItem = { id: string; folderId: string | null; type: string; title: string; url: string | null; order: number; locked: boolean }

export function itemsInFolder(items: FileItem[], folderId: string | null): FileItem[] {
  return items
    .filter((i) => (i.folderId ?? null) === folderId)
    .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title))
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/jenniferjordan/joshwhirley/mg-hub-unified && JWT_SECRET=test-secret npx vitest run src/lib/hub-files-view.test.ts`
Expected: PASS — 4 tests

- [ ] **Step 5: Commit**

```bash
git add src/lib/hub-files-view.ts src/lib/hub-files-view.test.ts
git commit -m "feat(hub): item-in-folder helper and file view types for the Files tab"
```

---

### Task 2: The Home | Files tab bar

**Files:**
- Create: `src/components/hub/community/CommunityTabs.tsx`
- Test: `src/components/hub/community/CommunityTabs.test.tsx`

**Interfaces:**
- Consumes: nothing.
- Produces: `export type CommunityTab = 'home' | 'files'`, `export function tabFromParam(raw: string | null): CommunityTab`, `export function CommunityTabs({ active, onSelect }: { active: CommunityTab; onSelect: (t: CommunityTab) => void })`

The component is **controlled** — it does not read the URL itself. `CommunityHubView` owns the URL wiring (Task 5). This keeps the tab bar trivially testable without a router mock.

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/hub/community/CommunityTabs.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CommunityTabs, tabFromParam } from './CommunityTabs'

describe('tabFromParam', () => {
  it('maps "files" to files and everything else to home', () => {
    expect(tabFromParam('files')).toBe('files')
    expect(tabFromParam(null)).toBe('home')
    expect(tabFromParam('')).toBe('home')
    expect(tabFromParam('nonsense')).toBe('home')
  })
})

describe('CommunityTabs', () => {
  it('marks the active tab for assistive tech', () => {
    render(<CommunityTabs active="files" onSelect={() => {}} />)
    expect(screen.getByRole('tab', { name: /files/i })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: /home/i })).toHaveAttribute('aria-selected', 'false')
  })

  it('reports the selected tab', () => {
    const onSelect = vi.fn()
    render(<CommunityTabs active="home" onSelect={onSelect} />)
    fireEvent.click(screen.getByRole('tab', { name: /files/i }))
    expect(onSelect).toHaveBeenCalledWith('files')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/jenniferjordan/joshwhirley/mg-hub-unified && JWT_SECRET=test-secret npx vitest run src/components/hub/community/CommunityTabs.test.tsx`
Expected: FAIL — cannot resolve `./CommunityTabs`

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/components/hub/community/CommunityTabs.tsx
'use client'

import { Leaf, FolderOpen } from 'lucide-react'

export type CommunityTab = 'home' | 'files'

export function tabFromParam(raw: string | null): CommunityTab {
  return raw === 'files' ? 'files' : 'home'
}

const TABS: { key: CommunityTab; label: string; icon: React.ReactNode }[] = [
  { key: 'home', label: 'Home', icon: <Leaf className="h-4 w-4" /> },
  { key: 'files', label: 'Files', icon: <FolderOpen className="h-4 w-4" /> },
]

export function CommunityTabs({ active, onSelect }: { active: CommunityTab; onSelect: (t: CommunityTab) => void }) {
  return (
    <div role="tablist" className="flex items-center gap-3">
      {TABS.map((t) => {
        const on = t.key === active
        return (
          <button
            key={t.key}
            role="tab"
            type="button"
            aria-selected={on}
            onClick={() => onSelect(t.key)}
            className={`inline-flex items-center gap-1.5 pb-1 text-sm font-medium transition-colors ${
              on ? 'border-b-2 border-primary text-foreground' : 'border-b-2 border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <span className={on ? 'text-primary' : ''}>{t.icon}</span> {t.label}
          </button>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/jenniferjordan/joshwhirley/mg-hub-unified && JWT_SECRET=test-secret npx vitest run src/components/hub/community/CommunityTabs.test.tsx`
Expected: PASS — 4 tests

- [ ] **Step 5: Commit**

```bash
git add src/components/hub/community/CommunityTabs.tsx src/components/hub/community/CommunityTabs.test.tsx
git commit -m "feat(hub): Home | Files tab bar for community hubs"
```

---

### Task 3: HubFilesTab — read branch

**Files:**
- Create: `src/components/hub/community/HubFilesTab.tsx`
- Test: `src/components/hub/community/HubFilesTab.test.tsx`

**Interfaces:**
- Consumes: `itemsInFolder`, `FileFolder`, `FileItem` (Task 1); `buildFolderTree` from `@/lib/hub-tree` (existing); `HubFolderTree` from `@/components/hub/HubFolderTree` (props: `{ tree, selectedId, onSelect }`).
- Produces: `export function HubFilesTab({ hubId, canManage, initialFolders, initialItems }: { hubId: string; canManage: boolean; initialFolders: FileFolder[]; initialItems: FileItem[] })`

Read branch only in this task — `canManage` is accepted but only used to pick the empty-state copy. Task 4 adds the manage controls.

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/hub/community/HubFilesTab.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { HubFilesTab } from './HubFilesTab'
import type { FileFolder, FileItem } from '@/lib/hub-files-view'

const folders: FileFolder[] = [{ id: 'f1', parentId: null, name: 'Decks', order: 0, locked: false }]
const items: FileItem[] = [
  { id: 'i1', folderId: null, type: 'file', title: 'Root Readme', url: 'https://x/1', order: 0, locked: false },
  { id: 'i2', folderId: 'f1', type: 'file', title: 'Q3 Deck', url: 'https://x/2', order: 0, locked: false },
  { id: 'i3', folderId: 'f1', type: 'file', title: 'Locked Thing', url: null, order: 1, locked: true },
]

describe('HubFilesTab (read)', () => {
  it('shows root items first', () => {
    render(<HubFilesTab hubId="h1" canManage={false} initialFolders={folders} initialItems={items} />)
    expect(screen.getByText('Root Readme')).toBeInTheDocument()
    expect(screen.queryByText('Q3 Deck')).not.toBeInTheDocument()
  })

  it('navigates into a folder', () => {
    render(<HubFilesTab hubId="h1" canManage={false} initialFolders={folders} initialItems={items} />)
    fireEvent.click(screen.getByRole('button', { name: /decks/i }))
    expect(screen.getByText('Q3 Deck')).toBeInTheDocument()
  })

  it('renders no download link for a locked item', () => {
    render(<HubFilesTab hubId="h1" canManage={false} initialFolders={folders} initialItems={items} />)
    fireEvent.click(screen.getByRole('button', { name: /decks/i }))
    expect(screen.getByText('Locked Thing')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /locked thing/i })).not.toBeInTheDocument()
  })

  it('never shows manage controls to a non-manager', () => {
    render(<HubFilesTab hubId="h1" canManage={false} initialFolders={folders} initialItems={items} />)
    expect(screen.queryByRole('button', { name: /upload|add|new folder/i })).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/jenniferjordan/joshwhirley/mg-hub-unified && JWT_SECRET=test-secret npx vitest run src/components/hub/community/HubFilesTab.test.tsx`
Expected: FAIL — cannot resolve `./HubFilesTab`

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/components/hub/community/HubFilesTab.tsx
'use client'

import { useMemo, useState } from 'react'
import { FileText, Lock, Download } from 'lucide-react'
import { HubFolderTree } from '@/components/hub/HubFolderTree'
import { buildFolderTree } from '@/lib/hub-tree'
import { itemsInFolder, type FileFolder, type FileItem } from '@/lib/hub-files-view'

export function HubFilesTab({
  hubId, canManage, initialFolders, initialItems,
}: {
  hubId: string
  canManage: boolean
  initialFolders: FileFolder[]
  initialItems: FileItem[]
}) {
  const [folders] = useState<FileFolder[]>(initialFolders)
  const [items] = useState<FileItem[]>(initialItems)
  const [folderId, setFolderId] = useState<string | null>(null)

  const tree = useMemo(() => buildFolderTree(folders), [folders])
  const visible = useMemo(() => itemsInFolder(items, folderId), [items, folderId])

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[240px_1fr]">
      <aside className="rounded-2xl border border-border bg-surface p-3">
        <HubFolderTree tree={tree} selectedId={folderId} onSelect={setFolderId} />
      </aside>

      <section className="rounded-2xl border border-border bg-surface p-4">
        {visible.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            {canManage ? 'Nothing here yet — upload a file to get started.' : 'Nothing here yet.'}
          </p>
        ) : (
          <ul className="space-y-2">
            {visible.map((it) => (
              <li key={it.id} className="flex items-center gap-3 rounded-xl border border-border px-3 py-2.5">
                {it.locked ? <Lock className="h-4 w-4 shrink-0 text-muted-foreground" /> : <FileText className="h-4 w-4 shrink-0 text-primary" />}
                <span className="min-w-0 flex-1 truncate text-sm">{it.title}</span>
                {!it.locked && it.url && (
                  <a href={it.url} target="_blank" rel="noreferrer" aria-label={it.title}
                     className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                    <Download className="h-3.5 w-3.5" /> Open
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/jenniferjordan/joshwhirley/mg-hub-unified && JWT_SECRET=test-secret npx vitest run src/components/hub/community/HubFilesTab.test.tsx`
Expected: PASS — 4 tests

- [ ] **Step 5: Commit**

```bash
git add src/components/hub/community/HubFilesTab.tsx src/components/hub/community/HubFilesTab.test.tsx
git commit -m "feat(hub): Files tab read view (folder tree + visibility-aware item list)"
```

---

### Task 4: HubFilesTab — manage branch (owner only)

**Files:**
- Modify: `src/components/hub/community/HubFilesTab.tsx`
- Test: `src/components/hub/community/HubFilesTab.test.tsx` (append)

**Interfaces:**
- Consumes: `POST /api/hubs/[id]/folders` `{ name, parentId }`; `DELETE /api/hubs/[id]/items/[itemId]`. Both owner-gated server-side.
- Produces: no new exports.

Read the Deviation note at the top before starting: `canManage` is **owner only**, never collaborators.

- [ ] **Step 1: Write the failing test**

```tsx
// append to src/components/hub/community/HubFilesTab.test.tsx
import { vi, beforeEach } from 'vitest'

describe('HubFilesTab (manage)', () => {
  beforeEach(() => {
    global.fetch = vi.fn(async () => ({ ok: true, json: async () => ({ id: 'new' }) })) as any
    vi.spyOn(window, 'confirm').mockReturnValue(true)
  })

  it('shows manage controls to a manager', () => {
    render(<HubFilesTab hubId="h1" canManage initialFolders={folders} initialItems={items} />)
    expect(screen.getByRole('button', { name: /new folder/i })).toBeInTheDocument()
  })

  it('creates a folder and adds it to the tree', async () => {
    vi.spyOn(window, 'prompt').mockReturnValue('Contracts')
    render(<HubFilesTab hubId="h1" canManage initialFolders={folders} initialItems={items} />)

    fireEvent.click(screen.getByRole('button', { name: /new folder/i }))

    await vi.waitFor(() => expect(screen.getByRole('button', { name: /contracts/i })).toBeInTheDocument())
    expect(global.fetch).toHaveBeenCalledWith('/api/hubs/h1/folders', expect.objectContaining({ method: 'POST' }))
  })

  it('deletes an item and removes it from the list', async () => {
    render(<HubFilesTab hubId="h1" canManage initialFolders={folders} initialItems={items} />)

    fireEvent.click(screen.getByRole('button', { name: /delete root readme/i }))

    await vi.waitFor(() => expect(screen.queryByText('Root Readme')).not.toBeInTheDocument())
    expect(global.fetch).toHaveBeenCalledWith('/api/hubs/h1/items/i1', { method: 'DELETE' })
  })

  it('keeps the item when the delete confirm is dismissed', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    render(<HubFilesTab hubId="h1" canManage initialFolders={folders} initialItems={items} />)

    fireEvent.click(screen.getByRole('button', { name: /delete root readme/i }))

    expect(global.fetch).not.toHaveBeenCalled()
    expect(screen.getByText('Root Readme')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/jenniferjordan/joshwhirley/mg-hub-unified && JWT_SECRET=test-secret npx vitest run src/components/hub/community/HubFilesTab.test.tsx`
Expected: FAIL — no "New folder" button exists

- [ ] **Step 3: Write minimal implementation**

Change the `useState` lines to be mutable and add handlers + controls:

```tsx
  const [folders, setFolders] = useState<FileFolder[]>(initialFolders)
  const [items, setItems] = useState<FileItem[]>(initialItems)
  const [busy, setBusy] = useState(false)

  async function createFolder() {
    const name = window.prompt('Folder name')?.trim()
    if (!name) return
    setBusy(true)
    try {
      const res = await fetch(`/api/hubs/${hubId}/folders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, parentId: folderId }),
      })
      if (!res.ok) return
      const { id } = await res.json()
      setFolders((cur) => [...cur, { id, parentId: folderId, name, order: cur.length, locked: false }])
    } finally {
      setBusy(false)
    }
  }

  async function deleteItem(it: FileItem) {
    if (!window.confirm(`Delete "${it.title}"?`)) return
    const res = await fetch(`/api/hubs/${hubId}/items/${it.id}`, { method: 'DELETE' })
    if (res.ok) setItems((cur) => cur.filter((x) => x.id !== it.id))
  }
```

Add above the `<section>`'s list, inside the `<section>`:

```tsx
        {canManage && (
          <div className="mb-3 flex justify-end">
            <button type="button" onClick={createFolder} disabled={busy}
              className="rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground disabled:opacity-60">
              New folder
            </button>
          </div>
        )}
```

And inside each `<li>`, after the download link:

```tsx
                {canManage && (
                  <button type="button" aria-label={`Delete ${it.title}`} onClick={() => deleteItem(it)}
                    className="rounded p-1 text-muted-foreground hover:bg-muted">✕</button>
                )}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/jenniferjordan/joshwhirley/mg-hub-unified && JWT_SECRET=test-secret npx vitest run src/components/hub/community/HubFilesTab.test.tsx`
Expected: PASS — 8 tests

- [ ] **Step 5: Commit**

```bash
git add src/components/hub/community/HubFilesTab.tsx src/components/hub/community/HubFilesTab.test.tsx
git commit -m "feat(hub): owner-only manage controls on the Files tab"
```

---

### Task 5: Wire the tab bar into CommunityHubView

**Files:**
- Modify: `src/components/hub/community/CommunityHubView.tsx` (the decorative Home label, ~L97)
- Test: `src/components/hub/community/CommunityHubView.test.tsx` (create if absent)

**Interfaces:**
- Consumes: `CommunityTabs`, `tabFromParam` (Task 2); `HubFilesTab` (Tasks 3-4).
- Produces: two new optional props on `CommunityHubView`: `fileFolders?: FileFolder[]`, `fileItems?: FileItem[]`, both defaulting to `[]`.

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/hub/community/CommunityHubView.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

const replace = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push: replace }),
  useSearchParams: () => new URLSearchParams(''),
  usePathname: () => '/u/hub/s',
}))

import { CommunityHubView } from './CommunityHubView'

// Minimal props: extend if CommunityHubView's required props change.
const base: any = {
  hub: { id: 'h1', title: 'T', tagline: null, coverImage: null, heroVideoUrl: null },
  ownerUsername: 'o', isPrivileged: false, isOwner: false, joined: false,
  memberCount: 0, members: [], resources: [], events: [], drops: [], notes: [],
  counts: { posts: 0, members: 0, resources: 0, events: 0, kollab: 0 },
  activity: [], sharePath: '/u/hub/s',
  config: { kollab: { enabled: false, whoCanDrop: 'owner-only' } },
  announcements: [],
}

describe('CommunityHubView tabs', () => {
  it('renders a real tab bar, not a decorative label', () => {
    render(<CommunityHubView {...base} />)
    expect(screen.getByRole('tab', { name: /home/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /files/i })).toBeInTheDocument()
  })

  it('pushes ?tab=files when Files is chosen', () => {
    render(<CommunityHubView {...base} />)
    fireEvent.click(screen.getByRole('tab', { name: /files/i }))
    expect(replace).toHaveBeenCalledWith(expect.stringContaining('tab=files'), expect.anything())
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/jenniferjordan/joshwhirley/mg-hub-unified && JWT_SECRET=test-secret npx vitest run src/components/hub/community/CommunityHubView.test.tsx`
Expected: FAIL — no element with role `tab`

- [ ] **Step 3: Write minimal implementation**

Add imports:

```tsx
import { Suspense, useState } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { CommunityTabs, tabFromParam, type CommunityTab } from './CommunityTabs'
import { HubFilesTab } from './HubFilesTab'
import type { FileFolder, FileItem } from '@/lib/hub-files-view'
```

Add to the props destructure and type: `fileFolders = [], fileItems = [],` / `fileFolders?: FileFolder[]` / `fileItems?: FileItem[]`.

Inside the component body:

```tsx
  const router = useRouter()
  const pathname = usePathname()
  const search = useSearchParams()
  const tab: CommunityTab = tabFromParam(search.get('tab'))

  function selectTab(next: CommunityTab) {
    const params = new URLSearchParams(search.toString())
    if (next === 'home') params.delete('tab')
    else params.set('tab', next)
    const qs = params.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }
```

Replace the decorative label line with `<CommunityTabs active={tab} onSelect={selectTab} />`, and keep the search box only on Home by wrapping it in `{tab === 'home' && (...)}`.

Then gate the 3-column body: wrap the existing `<div className={\`mt-6 grid ...\`}>…</div>` in `{tab === 'home' && ( … )}` and add after it:

```tsx
        {tab === 'files' && (
          <div className="mt-6">
            <HubFilesTab hubId={hub.id} canManage={isOwner} initialFolders={fileFolders} initialItems={fileItems} />
          </div>
        )}
```

**`useSearchParams` requires a Suspense boundary.** `CommunityHubView` is rendered by a server component, so wrap the export:

```tsx
export function CommunityHubView(props: CommunityHubViewProps) {
  return <Suspense fallback={null}><CommunityHubViewInner {...props} /></Suspense>
}
```

renaming the existing function to `CommunityHubViewInner`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/jenniferjordan/joshwhirley/mg-hub-unified && JWT_SECRET=test-secret npx vitest run src/components/hub/community/`
Expected: PASS — all community suites including the two new tab tests

- [ ] **Step 5: Commit**

```bash
git add src/components/hub/community/CommunityHubView.tsx src/components/hub/community/CommunityHubView.test.tsx
git commit -m "feat(hub): real Home | Files tab bar wired to ?tab="
```

---

### Task 6: SSR the visibility-filtered files for community hubs

**Files:**
- Modify: `src/app/[username]/hub/[slug]/page.tsx` (community branch, ~L76-140)

**Interfaces:**
- Consumes: `resolveHubVisibility`, `readUnlockToken` (already imported at L6); `viewer` (already computed at L62-67).
- Produces: `fileFolders` / `fileItems` props on `<CommunityHubView>`.

This mirrors the existing non-community filtering at L146-187 exactly — same `resolveHubVisibility` call, same locked-nulling — so nothing hidden reaches the client.

- [ ] **Step 1: Add the fetches to the community branch's `Promise.all`**

Append two entries to the existing `Promise.all` array at L76 and two names to its destructure (`fileFolderRows`, `fileItemRows`):

```ts
      db.hubFolder.findMany({ where: { hubId: hub.id }, orderBy: { order: 'asc' } }),
      db.hubItem.findMany({ where: { hubId: hub.id }, orderBy: { order: 'asc' } }),
```

- [ ] **Step 2: Filter them, after the `Promise.all`**

```ts
    const cookieStore = await cookies()
    const unlockedIds = new Set(readUnlockToken(cookieStore.get(`hub_unlock_${hub.id}`)?.value, hub.id))
    const fileStatus = resolveHubVisibility({
      folders: fileFolderRows.map((f) => ({ id: f.id, parentId: f.parentId, visibility: f.visibility, hasPasscode: !!f.passcodeHash })),
      items: fileItemRows.map((i) => ({ id: i.id, folderId: i.folderId, visibility: i.visibility, hasPasscode: !!i.passcodeHash })),
      viewer,
      unlockedIds,
    })
    const fileFolders = fileFolderRows
      .filter((f) => fileStatus.get(f.id) !== 'hidden')
      .map((f) => ({ id: f.id, parentId: f.parentId, name: f.name, order: f.order, locked: fileStatus.get(f.id) === 'locked' }))
    const fileItems = fileItemRows
      .filter((i) => fileStatus.get(i.id) !== 'hidden')
      .map((i) => {
        const locked = fileStatus.get(i.id) === 'locked'
        return { id: i.id, folderId: i.folderId, type: i.type, title: i.title, url: locked ? null : i.url, order: i.order, locked }
      })
```

- [ ] **Step 3: Pass them to the view**

Add `fileFolders={fileFolders}` and `fileItems={fileItems}` to `<CommunityHubView … />` at ~L117.

- [ ] **Step 4: Verify**

Run: `cd /Users/jenniferjordan/joshwhirley/mg-hub-unified && npx tsc --noEmit -p tsconfig.json`
Expected: exit 0, no output.

- [ ] **Step 5: Commit**

```bash
git add "src/app/[username]/hub/[slug]/page.tsx"
git commit -m "feat(hub): SSR visibility-filtered files for the community Files tab"
```

---

### Task 7: Rewire the Tools card's Files button

**Files:**
- Modify: `src/components/hub/community/CommunityUtilityStrip.tsx` (L215)

**Interfaces:**
- Consumes: a new optional prop `onOpenFiles?: () => void`, passed down from `CommunityHubView` as `() => selectTab('files')`.
- Produces: nothing.

Note L213: the Files/Links buttons are already inside an `isOwner` guard. The **Files** entry moves out of that guard (everyone can browse); **Links** stays owner-only and keeps `onOpenResources`.

- [ ] **Step 1: Move Files out of the owner-only block**

```tsx
    { label: 'Events', icon: <CalendarDays className="h-4 w-4" />, onClick: onOpenEvents },
    { label: 'Files', icon: <FolderOpen className="h-4 w-4" />, onClick: onOpenFiles ?? onOpenResources },
    ...(isOwner
      ? [{ label: 'Links', icon: <Link2 className="h-4 w-4" />, onClick: onOpenResources }]
      : []),
```

- [ ] **Step 2: Thread the prop from CommunityHubView**

Pass `onOpenFiles={() => selectTab('files')}` wherever `CommunityUtilityStrip` is rendered.

- [ ] **Step 3: Verify**

Run: `cd /Users/jenniferjordan/joshwhirley/mg-hub-unified && JWT_SECRET=test-secret npx vitest run src/components/hub/community/ && npx tsc --noEmit -p tsconfig.json`
Expected: all suites PASS, tsc exit 0.

- [ ] **Step 4: Commit**

```bash
git add src/components/hub/community/CommunityUtilityStrip.tsx src/components/hub/community/CommunityHubView.tsx
git commit -m "feat(hub): Tools card Files button selects the Files tab"
```

---

### Task 8: Whole-branch verification

- [ ] **Step 1: Full static gates**

```bash
cd /Users/jenniferjordan/joshwhirley/mg-hub-unified
npx tsc --noEmit -p tsconfig.json          # expect exit 0
npx next lint --dir src                     # expect 0 errors (warnings ok)
JWT_SECRET=test-secret npx vitest run --maxWorkers=2 src/lib src/components/hub src/app/api/hubs
```

- [ ] **Step 2: Production build**

```bash
npx next build     # expect "Compiled successfully", exit 0
```

- [ ] **Step 3: Runtime smoke (needs the migration applied)**

Prereq: `DATABASE_URL="postgresql://pages:pages@127.0.0.1:5434/pages" DATABASE_URL_UNPOOLED="$DATABASE_URL" npx prisma migrate deploy`

With a forged `galli-auth` cookie against `next dev -p 3100`, assert:
- `GET  /api/hubs/<id>/announcements` logged-out on a published hub → 200
- `POST /api/hubs/<id>/announcements` as member → 403; as owner → 201; empty body as owner → 400
- `DELETE /api/hubs/<id>/announcements/<aid>` as member → 403; as owner → 200
- `POST /api/hubs/<id>/folders` as **collaborator** → 404 (documents the D4 deviation)
- The announcement body appears in the SSR'd HTML of the published hub
- `?tab=files` SSR HTML contains a public item's title and does **not** contain a private item's title

- [ ] **Step 4: Browser smoke**

Headless Chrome over CDP (same approach as the notification-dropdown fix): load the hub, click the Files tab, confirm the URL gains `?tab=files` and the folder tree renders; confirm a member session sees no "New folder" button.

- [ ] **Step 5: Commit any fixes, then merge**

Merge to `main` per superpowers:finishing-a-development-branch. Main auto-deploys; the `HubAnnouncement` migration applies to prod Neon on that deploy. Verify the deploy by polling the live site (`gh` is not installed on this device).
