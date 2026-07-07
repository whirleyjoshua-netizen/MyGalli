# Hub Notes Tool + Horizontal Toolbar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a hub-wide **Note** tool (pinned Notes panel, links to a hub item, public/private, minimizable) and replace the Hub editor's `Tools ▾` dropdown with a horizontal toolbar.

**Architecture:** New `HubNote` Prisma model (hub-scoped, soft link to a `HubItem`). Owner-gated CRUD routes under `/api/hubs/[id]/notes`. Pure helpers in `src/lib/hub-notes.ts` (tested). Editor gets a horizontal toolbar + right-hand Notes column; the public viewer gets a matching right-side Notes rail showing only public notes.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Prisma + Postgres, Tailwind, lucide-react icons, Vitest.

## Global Constraints

- **Auth:** API routes use `getUser(request)` and the existing `ownHub(request, id)` gate (owner-only). Copy the `ownHub` helper verbatim from `src/app/api/hubs/[id]/route.ts`.
- **Links:** any outbound URL must pass through `safeHref` from `@/lib/editor/safe-href`.
- **Migrations are non-interactive here.** Never run `prisma migrate dev`. Generate SQL via `prisma migrate diff … --script`, then `prisma migrate deploy`.
- **DB env:** machine `DATABASE_URL` is wrong; prefix every Prisma/DB command with `DATABASE_URL="postgresql://pages:pages@127.0.0.1:5434/pages"` (127.0.0.1, NOT localhost).
- **Styling:** semantic Tailwind tokens only (`surface`, `border`, `muted`, `primary`, `primary-foreground`, `foreground`, `muted-foreground`, `galli-violet`, `destructive`). Match existing hub components.
- **Visibility values:** the string literals `"public"` and `"private"` (matches `HubItem.visibility`).
- **Linkable item types:** `file`, `link`, `embed` only (NOT `note`).
- **Tests:** Vitest (`import { describe, it, expect } from 'vitest'`). Run with `pnpm test`.

---

## File Structure

- `prisma/schema.prisma` — add `HubNote` model + `notes` relation on `Hub` (Task 1).
- `prisma/migrations/<ts>_add_hub_note/migration.sql` — generated migration (Task 1).
- `src/lib/hub-notes.ts` — pure helpers: `LINKABLE_ITEM_TYPES`, `linkableItems`, `visibleNotes`, `resolveNoteLink` (Task 2).
- `src/lib/hub-notes.test.ts` — unit tests for the helpers (Task 2).
- `src/app/api/hubs/[id]/notes/route.ts` — `POST` create (Task 3).
- `src/app/api/hubs/[id]/notes/[noteId]/route.ts` — `PATCH` / `DELETE` (Task 3).
- `src/app/api/hubs/[id]/route.ts` — include `notes` in `GET` payload (Task 3).
- `src/components/hub/HubNotesPanel.tsx` — Notes panel + `NoteCard` for the editor (Task 4).
- `src/components/hub/HubEditor.tsx` — horizontal toolbar + wire in the Notes panel + state/handlers (Task 4).
- `src/components/hub/HubViewer.tsx` — right-side Notes rail (Task 5).
- `src/app/[username]/hub/[slug]/page.tsx` — fetch + thread public notes into `HubViewer` (Task 5).

---

## Task 1: `HubNote` schema + migration

**Files:**
- Modify: `prisma/schema.prisma:427-447` (Hub relations) and after `HubItem` (`:478`)
- Create: `prisma/migrations/<ts>_add_hub_note/migration.sql` (generated)

**Interfaces:**
- Produces: `HubNote` table with columns `id, hubId, title, content, linkedItemId, visibility, minimized, order, createdAt, updatedAt`; `Hub.notes` relation.

- [ ] **Step 1: Add the `notes` relation to the `Hub` model**

In `prisma/schema.prisma`, inside `model Hub { … }`, add to the relation list (next to `items HubItem[]`):

```prisma
  notes         HubNote[]
```

- [ ] **Step 2: Add the `HubNote` model**

Immediately after the closing `}` of `model HubItem` (line ~478), add:

```prisma
model HubNote {
  id           String   @id @default(cuid())
  hubId        String
  hub          Hub      @relation(fields: [hubId], references: [id], onDelete: Cascade)
  title        String   @default("")
  content      String   @default("")
  linkedItemId String?
  visibility   String   @default("public")
  minimized    Boolean  @default(false)
  order        Int      @default(0)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  @@index([hubId])
}
```

- [ ] **Step 3: Validate schema and regenerate client**

Run:
```bash
DATABASE_URL="postgresql://pages:pages@127.0.0.1:5434/pages" npx prisma validate
DATABASE_URL="postgresql://pages:pages@127.0.0.1:5434/pages" npx prisma generate
```
Expected: "The schema … is valid" and "Generated Prisma Client". (If `generate` EPERMs on Windows because dev holds the engine dll, stop `next dev` and retry — non-blocking.)

- [ ] **Step 4: Generate the migration SQL**

Run:
```bash
mkdir -p "prisma/migrations/20260707000000_add_hub_note"
DATABASE_URL="postgresql://pages:pages@127.0.0.1:5434/pages" npx prisma migrate diff \
  --from-url "postgresql://pages:pages@127.0.0.1:5434/pages" \
  --to-schema-datamodel prisma/schema.prisma \
  --script > "prisma/migrations/20260707000000_add_hub_note/migration.sql"
```
Expected: a `migration.sql` containing `CREATE TABLE "HubNote"` and `CREATE INDEX "HubNote_hubId_idx"`. Open it and confirm it ONLY creates `HubNote` (no unrelated drops). If it contains unrelated changes, the local DB is behind — stop and reconcile before continuing.

- [ ] **Step 5: Apply the migration**

Run:
```bash
DATABASE_URL="postgresql://pages:pages@127.0.0.1:5434/pages" npx prisma migrate deploy
```
Expected: "1 migration … applied" (or "No pending migrations" if already applied). Restart any running `next dev` so it picks up the new Prisma client (stale-client gotcha).

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260707000000_add_hub_note
git commit -m "feat(hub): HubNote model + migration"
```

---

## Task 2: Pure helpers `src/lib/hub-notes.ts` (TDD)

**Files:**
- Create: `src/lib/hub-notes.ts`
- Test: `src/lib/hub-notes.test.ts`

**Interfaces:**
- Produces:
  - `LINKABLE_ITEM_TYPES: Set<string>` = `{'file','link','embed'}`
  - `linkableItems<T extends { type: string }>(items: T[]): T[]`
  - `visibleNotes<T extends { visibility: string }>(notes: T[], isOwner: boolean): T[]`
  - `resolveNoteLink(note: { linkedItemId: string | null }, items: { id: string; url: string | null }[]): string | null`
- Consumes: `safeHref` from `@/lib/editor/safe-href`.

- [ ] **Step 1: Write the failing test**

Create `src/lib/hub-notes.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { LINKABLE_ITEM_TYPES, linkableItems, visibleNotes, resolveNoteLink } from './hub-notes'

describe('LINKABLE_ITEM_TYPES', () => {
  it('includes file/link/embed but not note', () => {
    expect([...LINKABLE_ITEM_TYPES].sort()).toEqual(['embed', 'file', 'link'])
    expect(LINKABLE_ITEM_TYPES.has('note')).toBe(false)
  })
})

describe('linkableItems', () => {
  it('keeps only linkable types', () => {
    const items = [
      { id: 'a', type: 'file' },
      { id: 'b', type: 'note' },
      { id: 'c', type: 'link' },
      { id: 'd', type: 'embed' },
    ]
    expect(linkableItems(items).map((i) => i.id)).toEqual(['a', 'c', 'd'])
  })
})

describe('visibleNotes', () => {
  const notes = [
    { id: 'p', visibility: 'public' },
    { id: 's', visibility: 'private' },
  ]
  it('owner sees all', () => {
    expect(visibleNotes(notes, true).map((n) => n.id)).toEqual(['p', 's'])
  })
  it('visitor sees only public', () => {
    expect(visibleNotes(notes, false).map((n) => n.id)).toEqual(['p'])
  })
})

describe('resolveNoteLink', () => {
  const items = [
    { id: 'x', url: 'https://example.com/file.pdf' },
    { id: 'y', url: 'javascript:alert(1)' },
    { id: 'z', url: null },
  ]
  it('returns null when unlinked', () => {
    expect(resolveNoteLink({ linkedItemId: null }, items)).toBeNull()
  })
  it('returns null when the linked item is missing', () => {
    expect(resolveNoteLink({ linkedItemId: 'gone' }, items)).toBeNull()
  })
  it('resolves a safe href for a linked item', () => {
    expect(resolveNoteLink({ linkedItemId: 'x' }, items)).toBe('https://example.com/file.pdf')
  })
  it('returns null for an unsafe href', () => {
    expect(resolveNoteLink({ linkedItemId: 'y' }, items)).toBeNull()
  })
  it('returns null when the linked item has no url', () => {
    expect(resolveNoteLink({ linkedItemId: 'z' }, items)).toBeNull()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test -- src/lib/hub-notes.test.ts`
Expected: FAIL — cannot resolve module `./hub-notes`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/hub-notes.ts`:

```ts
import { safeHref } from '@/lib/editor/safe-href'

export const LINKABLE_ITEM_TYPES = new Set(['file', 'link', 'embed'])

export function linkableItems<T extends { type: string }>(items: T[]): T[] {
  return items.filter((i) => LINKABLE_ITEM_TYPES.has(i.type))
}

export function visibleNotes<T extends { visibility: string }>(notes: T[], isOwner: boolean): T[] {
  return isOwner ? notes : notes.filter((n) => n.visibility === 'public')
}

export function resolveNoteLink(
  note: { linkedItemId: string | null },
  items: { id: string; url: string | null }[]
): string | null {
  if (!note.linkedItemId) return null
  const item = items.find((i) => i.id === note.linkedItemId)
  if (!item) return null
  return safeHref(item.url ?? undefined) ?? null
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test -- src/lib/hub-notes.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add src/lib/hub-notes.ts src/lib/hub-notes.test.ts
git commit -m "feat(hub): pure note helpers — linkableItems/visibleNotes/resolveNoteLink"
```

---

## Task 3: Notes API routes + GET payload

**Files:**
- Create: `src/app/api/hubs/[id]/notes/route.ts`
- Create: `src/app/api/hubs/[id]/notes/[noteId]/route.ts`
- Modify: `src/app/api/hubs/[id]/route.ts:16-24` (add notes to GET)

**Interfaces:**
- Consumes: `ownHub`, `db`, `LINKABLE_ITEM_TYPES` (from `@/lib/hub-notes`).
- Produces:
  - `POST /api/hubs/[id]/notes` → 201 `HubNote`
  - `PATCH /api/hubs/[id]/notes/[noteId]` → 200 `HubNote`
  - `DELETE /api/hubs/[id]/notes/[noteId]` → 200 `{ ok: true }`
  - `GET /api/hubs/[id]` response gains `notes: HubNote[]`

- [ ] **Step 1: Create the collection route (POST)**

Create `src/app/api/hubs/[id]/notes/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'
import { LINKABLE_ITEM_TYPES } from '@/lib/hub-notes'

async function ownHub(request: NextRequest, id: string) {
  const me = await getUser(request)
  if (!me) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const hub = await db.hub.findUnique({ where: { id } })
  if (!hub || hub.userId !== me.id) return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) }
  return { me, hub }
}

async function validateLinkedItem(hubId: string, linkedItemId: unknown): Promise<string | null | 'invalid'> {
  if (linkedItemId === null || linkedItemId === undefined) return null
  if (typeof linkedItemId !== 'string') return 'invalid'
  const item = await db.hubItem.findUnique({ where: { id: linkedItemId } })
  if (!item || item.hubId !== hubId || !LINKABLE_ITEM_TYPES.has(item.type)) return 'invalid'
  return linkedItemId
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const r = await ownHub(request, id)
  if ('error' in r) return r.error

  const body = await request.json().catch(() => ({}))
  const visibility = body.visibility === 'private' ? 'private' : 'public'

  const linked = await validateLinkedItem(id, body.linkedItemId)
  if (linked === 'invalid') return NextResponse.json({ error: 'Invalid linkedItemId' }, { status: 400 })

  const max = await db.hubNote.findFirst({ where: { hubId: id }, orderBy: { order: 'desc' } })
  const order = (max?.order ?? -1) + 1

  const note = await db.hubNote.create({
    data: {
      hubId: id,
      title: typeof body.title === 'string' ? body.title.slice(0, 200) : '',
      content: typeof body.content === 'string' ? body.content.slice(0, 5000) : '',
      linkedItemId: linked,
      visibility,
      order,
    },
  })
  return NextResponse.json(note, { status: 201 })
}
```

- [ ] **Step 2: Create the item route (PATCH / DELETE)**

Create `src/app/api/hubs/[id]/notes/[noteId]/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'
import { LINKABLE_ITEM_TYPES } from '@/lib/hub-notes'

async function ownHubNote(request: NextRequest, id: string, noteId: string) {
  const me = await getUser(request)
  if (!me) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const hub = await db.hub.findUnique({ where: { id } })
  if (!hub || hub.userId !== me.id) return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) }
  const note = await db.hubNote.findUnique({ where: { id: noteId } })
  if (!note || note.hubId !== id) return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) }
  return { me, hub, note }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; noteId: string }> }
) {
  const { id, noteId } = await params
  const r = await ownHubNote(request, id, noteId)
  if ('error' in r) return r.error

  const body = await request.json().catch(() => ({}))
  const data: Record<string, unknown> = {}
  if (typeof body.title === 'string') data.title = body.title.slice(0, 200)
  if (typeof body.content === 'string') data.content = body.content.slice(0, 5000)
  if (body.visibility === 'public' || body.visibility === 'private') data.visibility = body.visibility
  if (typeof body.minimized === 'boolean') data.minimized = body.minimized
  if ('linkedItemId' in body) {
    if (body.linkedItemId === null) {
      data.linkedItemId = null
    } else if (typeof body.linkedItemId === 'string') {
      const item = await db.hubItem.findUnique({ where: { id: body.linkedItemId } })
      if (!item || item.hubId !== id || !LINKABLE_ITEM_TYPES.has(item.type)) {
        return NextResponse.json({ error: 'Invalid linkedItemId' }, { status: 400 })
      }
      data.linkedItemId = body.linkedItemId
    } else {
      return NextResponse.json({ error: 'Invalid linkedItemId' }, { status: 400 })
    }
  }

  const note = await db.hubNote.update({ where: { id: noteId }, data })
  return NextResponse.json(note)
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; noteId: string }> }
) {
  const { id, noteId } = await params
  const r = await ownHubNote(request, id, noteId)
  if ('error' in r) return r.error
  await db.hubNote.delete({ where: { id: noteId } })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 3: Include notes in the editor GET payload**

In `src/app/api/hubs/[id]/route.ts`, in the `GET` handler, extend the `Promise.all` and the response.

Change:
```ts
  const [folders, items] = await Promise.all([
    db.hubFolder.findMany({ where: { hubId: id }, orderBy: { order: 'asc' } }),
    db.hubItem.findMany({ where: { hubId: id }, orderBy: { order: 'asc' } }),
  ])
```
to:
```ts
  const [folders, items, notes] = await Promise.all([
    db.hubFolder.findMany({ where: { hubId: id }, orderBy: { order: 'asc' } }),
    db.hubItem.findMany({ where: { hubId: id }, orderBy: { order: 'asc' } }),
    db.hubNote.findMany({ where: { hubId: id }, orderBy: { order: 'asc' } }),
  ])
```
And change the return:
```ts
  return NextResponse.json({ hub: r.hub, folders: safeFolders, items: safeItems })
```
to:
```ts
  return NextResponse.json({ hub: r.hub, folders: safeFolders, items: safeItems, notes })
```

- [ ] **Step 4: Typecheck**

Run: `DATABASE_URL="postgresql://pages:pages@127.0.0.1:5434/pages" npx prisma generate && npx tsc --noEmit`
Expected: no errors. (`db.hubNote` resolves after `prisma generate`.)

- [ ] **Step 5: Commit**

```bash
git add src/app/api/hubs
git commit -m "feat(hub): notes CRUD routes + notes in GET payload"
```

---

## Task 4: Editor — horizontal toolbar + Notes panel

**Files:**
- Create: `src/components/hub/HubNotesPanel.tsx`
- Modify: `src/components/hub/HubEditor.tsx` (imports, state, handlers, toolbar, grid)

**Interfaces:**
- Consumes: `notes` from `GET /api/hubs/[id]`; `linkableItems` from `@/lib/hub-notes`; `resolveNoteLink`.
- Produces:
  - `HubNote` client type: `{ id, hubId, title, content, linkedItemId, visibility, minimized, order }`
  - `HubNotesPanel` component with props `{ notes, items, onUpdate, onDelete }`.

- [ ] **Step 1: Create the Notes panel component**

Create `src/components/hub/HubNotesPanel.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { StickyNote, Trash2, ChevronDown, ChevronRight, Lock, Globe, ExternalLink } from 'lucide-react'
import { linkableItems, resolveNoteLink } from '@/lib/hub-notes'
import type { HubItem } from './HubItemList'

export interface HubNote {
  id: string
  hubId: string
  title: string
  content: string
  linkedItemId: string | null
  visibility: string
  minimized: boolean
  order: number
}

interface HubNotesPanelProps {
  notes: HubNote[]
  items: HubItem[]
  onUpdate: (id: string, data: Partial<Pick<HubNote, 'title' | 'content' | 'linkedItemId' | 'visibility' | 'minimized'>>) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

function NoteCard({
  note,
  items,
  onUpdate,
  onDelete,
}: {
  note: HubNote
  items: HubItem[]
  onUpdate: HubNotesPanelProps['onUpdate']
  onDelete: HubNotesPanelProps['onDelete']
}) {
  const [title, setTitle] = useState(note.title)
  const [content, setContent] = useState(note.content)
  const linkable = linkableItems(items)
  const href = resolveNoteLink(note, items)

  if (note.minimized) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2">
        <button
          type="button"
          onClick={() => onUpdate(note.id, { minimized: false })}
          className="p-0.5 rounded hover:bg-muted shrink-0"
          title="Expand"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
        <StickyNote className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        <span className="text-sm font-medium truncate flex-1">{note.title || 'Untitled note'}</span>
        {note.visibility === 'private' && <Lock className="w-3 h-3 text-galli-violet shrink-0" aria-label="Private" />}
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-3 space-y-2">
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onUpdate(note.id, { minimized: true })}
          className="p-0.5 rounded hover:bg-muted shrink-0"
          title="Minimize"
        >
          <ChevronDown className="w-4 h-4" />
        </button>
        <StickyNote className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => title !== note.title && onUpdate(note.id, { title })}
          placeholder="Note title"
          className="flex-1 min-w-0 text-sm font-medium bg-transparent focus:outline-none focus:ring-2 focus:ring-primary rounded px-1"
        />
        <button
          type="button"
          onClick={() => {
            if (confirm('Delete this note?')) onDelete(note.id)
          }}
          className="p-1 rounded hover:bg-destructive/10 text-destructive shrink-0"
          title="Delete"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onBlur={() => content !== note.content && onUpdate(note.id, { content })}
        placeholder="Write a note…"
        rows={3}
        className="w-full text-sm bg-background border border-border rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary resize-none"
      />

      <select
        value={note.linkedItemId ?? ''}
        onChange={(e) => onUpdate(note.id, { linkedItemId: e.target.value || null })}
        className="w-full text-xs bg-background border border-border rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary"
      >
        <option value="">No linked item</option>
        {linkable.map((it) => (
          <option key={it.id} value={it.id}>
            {it.title}
          </option>
        ))}
      </select>

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => onUpdate(note.id, { visibility: note.visibility === 'private' ? 'public' : 'private' })}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          title="Toggle visibility"
        >
          {note.visibility === 'private' ? (
            <><Lock className="w-3 h-3 text-galli-violet" /> Private</>
          ) : (
            <><Globe className="w-3 h-3" /> Public</>
          )}
        </button>
        {href && (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            Open <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>
    </div>
  )
}

export function HubNotesPanel({ notes, items, onUpdate, onDelete }: HubNotesPanelProps) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-3 shadow-soft h-fit">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
        Notes ({notes.length})
      </h2>
      {notes.length === 0 ? (
        <p className="text-xs text-muted-foreground py-2">
          Add a note from the toolbar. Notes can link to any file, link, or embed in this hub.
        </p>
      ) : (
        <div className="space-y-2">
          {notes.map((note) => (
            <NoteCard key={note.id} note={note} items={items} onUpdate={onUpdate} onDelete={onDelete} />
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Wire notes state + handlers into `HubEditor`**

In `src/components/hub/HubEditor.tsx`:

Add imports near the top (with the other `./` imports):
```tsx
import { HubNotesPanel, type HubNote } from './HubNotesPanel'
```
Add to the lucide import on line 5 the `StickyNote` icon (append inside the braces):
```tsx
import { Image as ImageIcon, Loader2, Trash2, FolderPlus, ChevronRight, ChevronDown, Users, StickyNote } from 'lucide-react'
```

Add state (next to `const [items, setItems] = useState<HubItem[]>([])`, ~line 30):
```tsx
  const [notes, setNotes] = useState<HubNote[]>([])
```

In the `useEffect` `.then((data) => {…})` block, after `setItems(data.items)`:
```tsx
        setNotes(data.notes ?? [])
```

Add handlers after `handleDeleteItem` (~line 206):
```tsx
  const handleAddNote = async () => {
    const res = await fetch(`/api/hubs/${hubId}/notes`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
    if (res.ok) {
      const note = await res.json()
      setNotes((prev) => [...prev, note])
    }
  }

  const handleUpdateNote = async (
    id: string,
    data: Partial<Pick<HubNote, 'title' | 'content' | 'linkedItemId' | 'visibility' | 'minimized'>>
  ) => {
    const res = await fetch(`/api/hubs/${hubId}/notes/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (res.ok) {
      const updated = await res.json()
      setNotes((prev) => prev.map((n) => (n.id === id ? updated : n)))
    }
  }

  const handleDeleteNote = async (id: string) => {
    const res = await fetch(`/api/hubs/${hubId}/notes/${id}`, { method: 'DELETE' })
    if (res.ok) setNotes((prev) => prev.filter((n) => n.id !== id))
  }
```

- [ ] **Step 3: Replace the `Tools ▾` dropdown with a horizontal toolbar**

In `HubEditor.tsx`, replace the entire `{/* Toolbar */}` block (lines ~244-270, the `<div className="flex justify-end mb-4">…</div>`) with:

```tsx
      {/* Toolbar */}
      <div className="flex items-center gap-2 mb-4 rounded-xl border border-border bg-surface px-2 py-1.5 shadow-soft">
        <button
          type="button"
          onClick={handleAddNote}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg hover:bg-muted/60"
        >
          <StickyNote className="w-4 h-4" /> Note
        </button>
        <button
          type="button"
          onClick={() => {
            if (isPro) setShowCollaborators(true)
            else setShowUpgrade(true)
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg hover:bg-muted/60"
        >
          <Users className="w-4 h-4" /> Collaborators
        </button>
      </div>
```

Then remove the now-unused `toolsOpen` state (line 41: `const [toolsOpen, setToolsOpen] = useState(false)`) and the now-unused `ChevronDown` import ONLY IF it is no longer referenced. NOTE: `ChevronDown` is still used inside `HubNotesPanel` but that's a separate file; in `HubEditor.tsx` check for other uses of `ChevronDown` — the folder tree uses `ChevronRight`/`ChevronDown`? Search first: `grep -n "ChevronDown" src/components/hub/HubEditor.tsx`. If the only remaining use was the dropdown you deleted, drop `ChevronDown` from the import.

- [ ] **Step 4: Add the Notes column to the grid**

In `HubEditor.tsx`, change the grid container:
```tsx
      <div className="grid md:grid-cols-[240px_1fr] gap-6">
```
to:
```tsx
      <div className="grid lg:grid-cols-[240px_1fr_260px] gap-6">
```
Then, immediately BEFORE the closing `</div>` of that grid (after the `{/* Item list */}` `<div>…</div>` block, ~line 407), add the panel as the third grid child:
```tsx
        {/* Notes panel */}
        <HubNotesPanel notes={notes} items={items} onUpdate={handleUpdateNote} onDelete={handleDeleteNote} />
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. If `ChevronDown`/`toolsOpen` are flagged as unused, remove them.

- [ ] **Step 6: Commit**

```bash
git add src/components/hub/HubNotesPanel.tsx src/components/hub/HubEditor.tsx
git commit -m "feat(hub): horizontal toolbar + editor Notes panel"
```

---

## Task 5: Public viewer — right-side Notes rail

**Files:**
- Modify: `src/components/hub/HubViewer.tsx` (props, layout, rail)
- Modify: `src/app/[username]/hub/[slug]/page.tsx` (fetch + pass public notes)

**Interfaces:**
- Consumes: `visibleNotes`, `resolveNoteLink` from `@/lib/hub-notes`.
- Produces: `HubViewerNote` type; `HubViewer` accepts a `notes: HubViewerNote[]` prop.

- [ ] **Step 1: Add notes to the public page data and thread into `HubViewer`**

In `src/app/[username]/hub/[slug]/page.tsx`:

Add the import:
```tsx
import { visibleNotes } from '@/lib/hub-notes'
```

Extend the `Promise.all` (lines 49-52):
```tsx
  const [folders, items, notes] = await Promise.all([
    db.hubFolder.findMany({ where: { hubId: hub.id }, orderBy: { order: 'asc' } }),
    db.hubItem.findMany({ where: { hubId: hub.id }, orderBy: { order: 'asc' } }),
    db.hubNote.findMany({ where: { hubId: hub.id }, orderBy: { order: 'asc' } }),
  ])
```

After `safeItems` is built (after line 100), add:
```tsx
  const safeNotes = visibleNotes(notes, viewer === 'owner').map((n) => ({
    id: n.id,
    title: n.title,
    content: n.content,
    linkedItemId: n.linkedItemId,
    minimized: n.minimized,
  }))
```

Add `notes={safeNotes}` to the `<HubViewer … />` props:
```tsx
      notes={safeNotes}
```

- [ ] **Step 2: Add the rail to `HubViewer`**

In `src/components/hub/HubViewer.tsx`:

Add the import:
```tsx
import { resolveNoteLink } from '@/lib/hub-notes'
```
Add `StickyNote` and `ExternalLink` and `ChevronRight` to the existing lucide import (ChevronRight already present — add the others):
```tsx
import { Folder, File, Link as LinkIcon, Code2, StickyNote, ChevronRight, ChevronDown, X, Lock, ExternalLink } from 'lucide-react'
```

Add the note type and extend props. After `HubViewerItem` interface (line ~25) add:
```tsx
export interface HubViewerNote {
  id: string
  title: string
  content: string
  linkedItemId: string | null
  minimized: boolean
}
```
Change the `HubViewerProps` interface to add `notes`:
```tsx
interface HubViewerProps {
  hub: HubViewerHub
  folders: HubViewerFolder[]
  items: HubViewerItem[]
  notes: HubViewerNote[]
  username: string
  hubId?: string
}
```

Add a rail component above the `HubViewer` function:
```tsx
function NotesRail({ notes, items }: { notes: HubViewerNote[]; items: HubViewerItem[] }) {
  const [open, setOpen] = useState<Record<string, boolean>>({})
  if (notes.length === 0) return null
  return (
    <aside className="lg:w-64 shrink-0 space-y-2">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
        <StickyNote className="w-3.5 h-3.5" /> Notes
      </h2>
      {notes.map((note) => {
        const expanded = open[note.id] ?? !note.minimized
        const href = resolveNoteLink(note, items)
        return (
          <div key={note.id} className="rounded-xl border border-border bg-surface p-3">
            <button
              type="button"
              onClick={() => setOpen((s) => ({ ...s, [note.id]: !expanded }))}
              className="flex items-center gap-1.5 w-full text-left"
            >
              {expanded ? <ChevronDown className="w-4 h-4 shrink-0" /> : <ChevronRight className="w-4 h-4 shrink-0" />}
              <span className="text-sm font-medium truncate">{note.title || 'Note'}</span>
            </button>
            {expanded && (
              <div className="mt-2 space-y-2">
                {note.content && <p className="text-sm text-muted-foreground whitespace-pre-wrap">{note.content}</p>}
                {href && (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                  >
                    Open <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            )}
          </div>
        )
      })}
    </aside>
  )
}
```

- [ ] **Step 3: Restructure the viewer layout into content + rail**

In `HubViewer`, update the destructure to include `notes`:
```tsx
export function HubViewer({ hub, folders, items, notes, username, hubId }: HubViewerProps) {
```
Change the outer wrapper (line 241) from:
```tsx
    <div className="max-w-3xl mx-auto px-4 py-10">
```
to a flex layout that keeps the existing content and adds the rail. Wrap the current content in a `<div className="flex-1 min-w-0">` and add `<NotesRail … />`:
```tsx
    <div className="max-w-5xl mx-auto px-4 py-10 flex flex-col lg:flex-row gap-8 items-start">
      <div className="flex-1 min-w-0 w-full">
```
Then, at the very end of the component, BEFORE the final closing `</div>` of that outer wrapper, close the content div and add the rail. Find the current final `</div>` (line 332) and replace the tail:
```tsx
      </div>
      <NotesRail notes={notes} items={items} />
    </div>
```
(i.e. the outer wrapper now has two children: the content `<div className="flex-1 …">…</div>` and `<NotesRail/>`.)

- [ ] **Step 4: Update the existing HubViewer test to pass the new required prop**

Run: `grep -n "HubViewer" src/components/hub/HubViewer.test.tsx` to find render calls. Every `render(<HubViewer … />)` needs `notes={[]}` added (the prop is required). Add `notes={[]}` to each render. If the test file constructs props via an object, add `notes: []`.

- [ ] **Step 5: Run viewer tests + typecheck**

Run: `pnpm test -- src/components/hub/HubViewer.test.tsx && npx tsc --noEmit`
Expected: PASS and no type errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/hub/HubViewer.tsx src/components/hub/HubViewer.test.tsx src/app/[username]/hub/[slug]/page.tsx
git commit -m "feat(hub): public viewer Notes rail (public notes only)"
```

---

## Task 6: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Full typecheck + test suite**

Run: `npx tsc --noEmit && pnpm test`
Expected: no type errors; all tests pass (including `hub-notes.test.ts` and hub viewer tests).

- [ ] **Step 2: Manual smoke (dev server)**

Start dev with the correct DB env:
```bash
DATABASE_URL="postgresql://pages:pages@127.0.0.1:5434/pages" pnpm dev
```
Then in the browser (logged in as a hub owner):
1. Open a hub editor (`/hubs/<id>`). Confirm the horizontal toolbar shows **Note** and **Collaborators** (no dropdown).
2. Click **Note** → a card appears in the right Notes column. Type a title/content; add a file/link/embed item first if none exist, then link the note to it → **Open ↗** appears and opens the file in a new tab.
3. Minimize the note (chevron) → collapses to title strip; reload → still collapsed.
4. Toggle a note to **Private**; toggle another **Public**.
5. Publish the hub's page; open the public URL (`/<username>/hub/<slug>`) as a logged-out visitor → the right **Notes** rail shows ONLY the public note; the private note is absent; **Open ↗** works.

Expected: all steps behave as described. Note any deviation and fix before marking complete.

- [ ] **Step 3: Final commit (if any fixes)**

```bash
git add -A
git commit -m "fix(hub): notes tool smoke-test fixes"
```

---

## Notes for the implementer

- Do NOT stage or commit: `Documents/`, `Images/`, `g1t.json`, `nul`, `.claude/settings.local.json`, `test-output.txt` (untracked/modified — leave them). Stage only the exact files each task lists.
- If `prisma generate` EPERMs on Windows, stop `next dev` and retry — it's non-blocking.
- The existing folder-scoped `note` **item** type is unchanged and unrelated to this work.
