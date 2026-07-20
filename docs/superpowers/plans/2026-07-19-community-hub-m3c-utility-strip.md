# Community Hub M3c — Utility Strip Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Notes / Kollab AI / Tools utility strip above the community hub header, rebalance the page into three columns (Kollab pool as a left rail), and close the gap that leaves community owners unable to manage files and links.

**Architecture:** Pure composition over existing surfaces — no migration, no new API route. One new config block (`utility`), one new public component (`CommunityUtilityStrip`) with three cards, one new builder modal (`HubResourcesModal`) over the existing owner-gated `HubItem` endpoints, and a layout change in `CommunityHubView`.

**Tech Stack:** Next.js 15.5.19 App Router, React 19, TypeScript, Tailwind, Prisma/PostgreSQL, Vitest, lucide-react icons.

## Global Constraints

- Worktree: `C:\Users\whirl\pages-mvp\.claude\worktrees\community-m3c`, branch `feat/community-m3c`. **Verify the branch before every commit** (`git branch --show-current`) — this repo has concurrent sessions sharing checkouts.
- **No schema migration and no new API route in this milestone.** If a task seems to need one, stop and raise it.
- Notes are **owner-only**: `/api/hubs/[id]/notes` gates on `hub.userId !== me.id` → 404. Collaborators cannot create notes. Gate note-authoring UI on `isOwner`, never `isPrivileged`.
- `/api/hubs/[id]/items` (POST) and `/api/hubs/[id]/items/[itemId]` (PATCH/DELETE) are **owner-only** by the same rule.
- Private notes must be filtered **server-side** with `visibleNotes` — never send private note bodies to the client.
- `sanitizeHubConfig` must coerce malformed input to defaults, never throw. It runs on both read and write.
- Tests: `npx vitest run <path>`. Set `JWT_SECRET` in the shell — the worktree has no `.env`: `$env:JWT_SECRET='test-secret-for-local-run-only-1234567890'`.
- Lint in a worktree needs the nested-config workaround: temporarily write `{ "root": true, "extends": "next/core-web-vitals" }` to `.eslintrc.json`, run `npx eslint . --ext .ts,.tsx`, then `git checkout -- .eslintrc.json`. **`next lint` fails in a worktree** (plugin conflict with the parent checkout).
- Do not add an `eslint-disable` for a rule this config doesn't define — it is itself a lint error.

---

### Task 1: `utility` config block

**Files:**
- Modify: `src/lib/types/hub-config.ts`
- Modify: `src/lib/hub-config.ts:16-56` (`sanitizeHubConfig`)
- Test: `src/lib/hub-config.utility.test.ts` (create)

**Interfaces:**
- Consumes: nothing.
- Produces: `HUB_UTILITY_KEYS: readonly ['notes','ai','tools']`, `HubUtilityKey`, `HubUtilityWidget = { key: HubUtilityKey; enabled: boolean }`, `HubConfig.utility: HubUtilityWidget[]`, and `DEFAULT_HUB_CONFIG.utility`. Every later task reads `config.utility`.

- [ ] **Step 1: Write the failing test**

Create `src/lib/hub-config.utility.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { sanitizeHubConfig } from './hub-config'
import { DEFAULT_HUB_CONFIG, HUB_UTILITY_KEYS } from './types/hub-config'

describe('sanitizeHubConfig — utility strip', () => {
  it('defaults to all three cards enabled, in order', () => {
    expect(sanitizeHubConfig(null).utility).toEqual([
      { key: 'notes', enabled: true },
      { key: 'ai', enabled: true },
      { key: 'tools', enabled: true },
    ])
  })

  // Existing hubs were saved before `utility` existed; they must gain it.
  it('appends the block to a config saved before the strip shipped', () => {
    const legacy = { sidebar: [{ key: 'members', enabled: true }], access: { whoCanPost: 'members' } }
    expect(sanitizeHubConfig(legacy).utility).toEqual(DEFAULT_HUB_CONFIG.utility)
  })

  it('preserves caller order and disabled flags for known keys', () => {
    const raw = { utility: [{ key: 'tools', enabled: false }, { key: 'notes', enabled: true }] }
    expect(sanitizeHubConfig(raw).utility).toEqual([
      { key: 'tools', enabled: false },
      { key: 'notes', enabled: true },
      { key: 'ai', enabled: true },
    ])
  })

  it('drops unknown keys and de-dupes, without throwing', () => {
    const raw = { utility: [{ key: 'evil' }, { key: 'notes', enabled: false }, { key: 'notes', enabled: true }] }
    const out = sanitizeHubConfig(raw).utility
    expect(out.map((w) => w.key)).toEqual(['notes', 'ai', 'tools'])
    expect(out[0].enabled).toBe(false)
  })

  it('coerces a non-array utility to the default', () => {
    expect(sanitizeHubConfig({ utility: 'nope' }).utility).toEqual(DEFAULT_HUB_CONFIG.utility)
    expect(sanitizeHubConfig({ utility: 42 }).utility).toEqual(DEFAULT_HUB_CONFIG.utility)
  })

  it('exports exactly the three keys', () => {
    expect([...HUB_UTILITY_KEYS]).toEqual(['notes', 'ai', 'tools'])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/hub-config.utility.test.ts`
Expected: FAIL — `HUB_UTILITY_KEYS` is not exported from `./types/hub-config`.

- [ ] **Step 3: Add the types**

In `src/lib/types/hub-config.ts`, after the `HUB_SIDEBAR_KEYS` block (line 1-5), add:

```ts
export const HUB_UTILITY_KEYS = ['notes', 'ai', 'tools'] as const
export type HubUtilityKey = (typeof HUB_UTILITY_KEYS)[number]
export type HubUtilityWidget = { key: HubUtilityKey; enabled: boolean }
```

Add `utility: HubUtilityWidget[]` to the `HubConfig` type (after `sidebar`):

```ts
export type HubConfig = {
  sidebar: HubSidebarWidget[]
  utility: HubUtilityWidget[]
  feed: { composerEnabled: boolean; loadMoreEnabled: boolean; emptyStateText?: string }
  access: { whoCanPost: HubWhoCanPost }
  kollab: { enabled: boolean; whoCanDrop: HubWhoCanDrop }
}
```

And to `DEFAULT_HUB_CONFIG`, after the `sidebar` array:

```ts
  utility: [
    { key: 'notes', enabled: true },
    { key: 'ai', enabled: true },
    { key: 'tools', enabled: true },
  ],
```

- [ ] **Step 4: Sanitize the block**

In `src/lib/hub-config.ts`, import `HUB_UTILITY_KEYS` and `HubUtilityKey` alongside the existing imports:

```ts
import {
  HUB_SIDEBAR_KEYS,
  HUB_UTILITY_KEYS,
  DEFAULT_HUB_CONFIG,
  type HubConfig,
  type HubSidebarKey,
  type HubUtilityKey,
  type HubWhoCanPost,
  type HubWhoCanDrop,
} from './types/hub-config'
```

After the sidebar loop (which ends at line 32, `for (const key of HUB_SIDEBAR_KEYS) {...}`), add the mirrored block:

```ts
  const seenUtility = new Set<HubUtilityKey>()
  const utility: HubConfig['utility'] = []
  if (Array.isArray(r.utility)) {
    for (const w of r.utility) {
      const key = w?.key
      if ((HUB_UTILITY_KEYS as readonly string[]).includes(key) && !seenUtility.has(key)) {
        seenUtility.add(key)
        utility.push({ key, enabled: bool(w?.enabled, true) })
      }
    }
  }
  for (const key of HUB_UTILITY_KEYS) {
    if (!seenUtility.has(key)) utility.push({ key, enabled: true })
  }
```

Add `utility,` to the returned object, directly after `sidebar,`.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/lib/hub-config.utility.test.ts src/lib/hub-config.test.ts src/lib/hub-config.kollab.test.ts`
Expected: PASS. If `hub-config.test.ts` asserts an exact `sanitizeHubConfig` return shape, update that assertion to include `utility` — the new key is expected.

- [ ] **Step 6: Verify tsc + commit**

Run: `npx tsc --noEmit` → 0 errors.

```bash
git add src/lib/types/hub-config.ts src/lib/hub-config.ts src/lib/hub-config.utility.test.ts src/lib/hub-config.test.ts
git commit -m "feat(m3c): utility strip config block"
```

---

### Task 2: Public notes on the community page + `isOwner` threading

**Files:**
- Modify: `src/lib/hub-notes.ts`
- Modify: `src/app/[username]/hub/[slug]/page.tsx:71-106` (community branch)
- Modify: `src/components/hub/community/CommunityHubView.tsx:16-33` (props)
- Test: `src/lib/hub-notes.test.ts` (existing — append)

**Interfaces:**
- Consumes: `visibleNotes(notes, isOwner)` from `src/lib/hub-notes.ts`.
- Produces: `StripNote = { id: string; title: string; content: string; color: string }` and `toStripNote(row)` in `src/lib/hub-notes.ts`; `CommunityHubView` gains props `notes: StripNote[]` and `isOwner: boolean`.

**Why `isOwner`:** the notes POST route is owner-only, so a collaborator shown a "+" would get a 404. `CommunityHubView` currently receives only `isPrivileged` (owner **or** collaborator).

- [ ] **Step 1: Write the failing test**

Append to `src/lib/hub-notes.test.ts`:

```ts
import { toStripNote } from './hub-notes'

describe('toStripNote', () => {
  const row = {
    id: 'n1', title: 'Welcome', content: 'Share ideas', color: '#FDE047',
    visibility: 'private', linkedItemId: 'item1', order: 3, minimized: false,
  }

  it('maps only the fields the strip renders', () => {
    expect(toStripNote(row)).toEqual({
      id: 'n1', title: 'Welcome', content: 'Share ideas', color: '#FDE047',
    })
  })

  // The DTO crosses to the client; visibility/linkedItemId must not ride along.
  it('omits visibility and linkedItemId', () => {
    const dto = toStripNote(row) as Record<string, unknown>
    expect(dto.visibility).toBeUndefined()
    expect(dto.linkedItemId).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/hub-notes.test.ts`
Expected: FAIL — `toStripNote` is not exported.

- [ ] **Step 3: Add the helper**

Append to `src/lib/hub-notes.ts`:

```ts
// The strip's Notes card renders these four fields and nothing else. Keeping the
// DTO narrow means a private note's metadata can never leak through the payload.
export type StripNote = { id: string; title: string; content: string; color: string }

export function toStripNote(row: {
  id: string; title: string; content: string; color: string
}): StripNote {
  return { id: row.id, title: row.title, content: row.content, color: row.color }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/hub-notes.test.ts`
Expected: PASS.

- [ ] **Step 5: Fetch notes in the community branch**

In `src/app/[username]/hub/[slug]/page.tsx`, add `toStripNote` to the existing `visibleNotes` import:

```ts
import { visibleNotes, toStripNote } from '@/lib/hub-notes'
```

Add a tenth entry to the community branch's `Promise.all` array (after the `db.hubDrop.count(...)` entry) and widen the destructuring on line 71 to include it:

```ts
    const [memberRows, items, postsCount, mine, eventRows, eventsCount, dropRows, dropsCount, noteRows] = await Promise.all([
```

```ts
      db.hubNote.findMany({ where: { hubId: hub.id }, orderBy: { order: 'asc' } }),
```

Then, next to the existing `const drops = ...` line, add:

```ts
    // visibleNotes runs server-side: a visitor's HTML never contains a private note.
    const notes = visibleNotes(noteRows, viewer === 'owner').map(toStripNote)
```

And pass two new props to `<CommunityHubView>`:

```tsx
        notes={notes}
        isOwner={viewer === 'owner'}
```

- [ ] **Step 6: Accept the props**

In `src/components/hub/community/CommunityHubView.tsx`, add `notes` and `isOwner` to the destructured parameter list and the prop type:

```ts
  hub, ownerUsername, currentUserId, isPrivileged, isOwner, joined: initialJoined, memberCount: initialCount, members, resources, events, drops, notes, counts, sharePath, config, preview,
```

```ts
  isOwner?: boolean
  notes?: StripNote[]
```

Import the type: `import type { StripNote } from '@/lib/hub-notes'`.

Both are optional so `HubBuilderPreview` (which renders `CommunityHubView` without them) keeps compiling; default them at the use site with `notes ?? []` and `isOwner ?? false`.

- [ ] **Step 7: Verify tsc + commit**

Run: `npx tsc --noEmit` → 0 errors.

```bash
git add src/lib/hub-notes.ts src/lib/hub-notes.test.ts "src/app/[username]/hub/[slug]/page.tsx" src/components/hub/community/CommunityHubView.tsx
git commit -m "feat(m3c): public notes DTO + isOwner threaded to the community view"
```

---

### Task 3: Strip shell + inert Kollab AI card

**Files:**
- Create: `src/components/hub/community/CommunityUtilityStrip.tsx`
- Modify: `src/components/hub/community/CommunityHubView.tsx`
- Test: `src/components/hub/community/CommunityUtilityStrip.test.tsx` (create)

**Interfaces:**
- Consumes: `HubConfig` (`config.utility` from Task 1); `StripNote` (Task 2).
- Produces: `CommunityUtilityStrip({ hubId, config, notes, isOwner, isPrivileged, preview, onOpenPoll, onOpenEvents, onOpenResources })`. Tasks 4 and 7 fill the Notes and Tools cards; this task renders the shell plus the AI card and leaves the other two as stubs that render their heading only.

- [ ] **Step 1: Write the failing test**

Create `src/components/hub/community/CommunityUtilityStrip.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CommunityUtilityStrip } from './CommunityUtilityStrip'
import { DEFAULT_HUB_CONFIG } from '@/lib/types/hub-config'

const base = {
  hubId: 'h1', config: DEFAULT_HUB_CONFIG, notes: [], isOwner: false,
  isPrivileged: false, preview: true,
  onOpenPoll: () => {}, onOpenEvents: () => {}, onOpenResources: () => {},
}

describe('CommunityUtilityStrip', () => {
  it('renders Notes and Kollab AI for a visitor', () => {
    render(<CommunityUtilityStrip {...base} />)
    expect(screen.getByText('Notes')).toBeInTheDocument()
    expect(screen.getByText('Kollab AI')).toBeInTheDocument()
  })

  // Tools actions are owner surfaces; a visitor must not see the card at all.
  it('hides Tools from a visitor and shows it to a privileged viewer', () => {
    const { rerender } = render(<CommunityUtilityStrip {...base} />)
    expect(screen.queryByText('Tools')).toBeNull()
    rerender(<CommunityUtilityStrip {...base} isPrivileged />)
    expect(screen.getByText('Tools')).toBeInTheDocument()
  })

  it('respects per-card config toggles', () => {
    const config = { ...DEFAULT_HUB_CONFIG, utility: [
      { key: 'notes' as const, enabled: false },
      { key: 'ai' as const, enabled: true },
      { key: 'tools' as const, enabled: true },
    ] }
    render(<CommunityUtilityStrip {...base} config={config} isPrivileged />)
    expect(screen.queryByText('Notes')).toBeNull()
    expect(screen.getByText('Kollab AI')).toBeInTheDocument()
  })

  it('renders nothing when every card is disabled', () => {
    const config = { ...DEFAULT_HUB_CONFIG, utility: [
      { key: 'notes' as const, enabled: false },
      { key: 'ai' as const, enabled: false },
      { key: 'tools' as const, enabled: false },
    ] }
    const { container } = render(<CommunityUtilityStrip {...base} config={config} />)
    expect(container).toBeEmptyDOMElement()
  })

  // The M4 slot must read as deliberate, not broken.
  it('shows the AI prompt as disabled with a coming-soon label', () => {
    render(<CommunityUtilityStrip {...base} />)
    expect(screen.getByPlaceholderText('Ask Kollab AI anything…')).toBeDisabled()
    expect(screen.getByText('Coming soon')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/hub/community/CommunityUtilityStrip.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the component**

Create `src/components/hub/community/CommunityUtilityStrip.tsx`:

```tsx
'use client'

import { Sparkles, StickyNote, Wrench } from 'lucide-react'
import type { HubConfig, HubUtilityKey } from '@/lib/types/hub-config'
import type { StripNote } from '@/lib/hub-notes'

export function CommunityUtilityStrip({
  hubId, config, notes, isOwner, isPrivileged, preview, onOpenPoll, onOpenEvents, onOpenResources,
}: {
  hubId: string
  config: HubConfig
  notes: StripNote[]
  isOwner: boolean
  isPrivileged: boolean
  preview?: boolean
  onOpenPoll: () => void
  onOpenEvents: () => void
  onOpenResources: () => void
}) {
  const visible = config.utility.filter((w) => {
    if (!w.enabled) return false
    if (w.key === 'tools') return isPrivileged // Tools actions are owner surfaces
    return true
  })
  if (visible.length === 0) return null

  const card = (key: HubUtilityKey) => {
    if (key === 'notes') return <NotesCard key="notes" hubId={hubId} notes={notes} isOwner={isOwner} preview={preview} />
    if (key === 'ai') return <AiCard key="ai" />
    return <ToolsCard key="tools" onOpenPoll={onOpenPoll} onOpenEvents={onOpenEvents} onOpenResources={onOpenResources} />
  }

  return (
    <div className={`mb-6 grid gap-4 ${visible.length === 1 ? '' : visible.length === 2 ? 'md:grid-cols-2' : 'md:grid-cols-3'}`}>
      {visible.map((w) => card(w.key))}
    </div>
  )
}

function Shell({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section className="flex max-h-44 flex-col rounded-2xl border border-border bg-surface p-4">
      <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">{icon} {title}</h3>
      {children}
    </section>
  )
}

function AiCard() {
  return (
    <Shell icon={<Sparkles className="h-4 w-4 text-galli-violet" />} title="Kollab AI">
      <p className="mb-2 text-xs text-muted-foreground">Ask, brainstorm, get ideas.</p>
      <input
        disabled
        placeholder="Ask Kollab AI anything…"
        className="w-full cursor-not-allowed rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm"
      />
      <span className="mt-2 self-start rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">Coming soon</span>
    </Shell>
  )
}

// Filled in by Task 4.
function NotesCard(_: { hubId: string; notes: StripNote[]; isOwner: boolean; preview?: boolean }) {
  return <Shell icon={<StickyNote className="h-4 w-4 text-primary" />} title="Notes"><div /></Shell>
}

// Filled in by Task 7.
function ToolsCard(_: { onOpenPoll: () => void; onOpenEvents: () => void; onOpenResources: () => void }) {
  return <Shell icon={<Wrench className="h-4 w-4 text-primary" />} title="Tools"><div /></Shell>
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/hub/community/CommunityUtilityStrip.test.tsx`
Expected: PASS (5 tests).

- [ ] **Step 5: Render it in the view**

In `CommunityHubView.tsx`, import the strip and render it as the **first child** inside `<div className="mx-auto max-w-5xl px-4 py-8">`, above the header card `div`. Wire the three callbacks to `useState` handles that Tasks 6/7 consume:

```tsx
import { CommunityUtilityStrip } from './CommunityUtilityStrip'
```

```tsx
  const [pollNonce, setPollNonce] = useState(0)
  const [manageEvents, setManageEvents] = useState(false)
  const [manageResources, setManageResources] = useState(false)
```

```tsx
        <CommunityUtilityStrip
          hubId={hub.id}
          config={config}
          notes={notes ?? []}
          isOwner={isOwner ?? false}
          isPrivileged={isPrivileged}
          preview={preview}
          onOpenPoll={() => setPollNonce((n) => n + 1)}
          onOpenEvents={() => setManageEvents(true)}
          onOpenResources={() => setManageResources(true)}
        />
```

- [ ] **Step 6: Verify tsc + commit**

Run: `npx tsc --noEmit` → 0 errors.

```bash
git add src/components/hub/community/CommunityUtilityStrip.tsx src/components/hub/community/CommunityUtilityStrip.test.tsx src/components/hub/community/CommunityHubView.tsx
git commit -m "feat(m3c): utility strip shell + inert Kollab AI slot"
```

---

### Task 4: Notes card

**Files:**
- Modify: `src/components/hub/community/CommunityUtilityStrip.tsx` (replace the `NotesCard` stub)
- Test: `src/components/hub/community/CommunityUtilityStrip.test.tsx` (append)

**Interfaces:**
- Consumes: `StripNote[]` (Task 2), `POST /api/hubs/[id]/notes` (existing, owner-only, body `{ title, content, visibility }`, returns the created row 201).
- Produces: no new exports.

- [ ] **Step 1: Write the failing test**

Append to `CommunityUtilityStrip.test.tsx`:

```tsx
const notes = [
  { id: 'n1', title: 'Welcome', content: 'Share ideas and connect.', color: '#FDE047' },
  { id: 'n2', title: 'Rules', content: 'Be kind.', color: '#FDE047' },
  { id: 'n3', title: 'Third', content: 'Hidden behind view-all.', color: '#FDE047' },
]

describe('Notes card', () => {
  it('shows the first two notes and a view-all affordance', () => {
    render(<CommunityUtilityStrip {...base} notes={notes} />)
    expect(screen.getByText('Welcome')).toBeInTheDocument()
    expect(screen.getByText('Rules')).toBeInTheDocument()
    expect(screen.queryByText('Third')).toBeNull()
    expect(screen.getByText('View all notes →')).toBeInTheDocument()
  })

  it('hides the view-all affordance when everything already fits', () => {
    render(<CommunityUtilityStrip {...base} notes={notes.slice(0, 1)} />)
    expect(screen.queryByText('View all notes →')).toBeNull()
  })

  // The notes route is owner-only; a collaborator or visitor must not see "+".
  it('shows the add control only to the owner', () => {
    const { rerender } = render(<CommunityUtilityStrip {...base} notes={notes} isPrivileged />)
    expect(screen.queryByTitle('Add note')).toBeNull()
    rerender(<CommunityUtilityStrip {...base} notes={notes} isOwner />)
    expect(screen.getByTitle('Add note')).toBeInTheDocument()
  })

  it('invites the owner to write the first note when empty', () => {
    render(<CommunityUtilityStrip {...base} notes={[]} isOwner />)
    expect(screen.getByText('No notes yet.')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/hub/community/CommunityUtilityStrip.test.tsx`
Expected: FAIL — the stub renders no note text.

- [ ] **Step 3: Implement the card**

Replace the `NotesCard` stub in `CommunityUtilityStrip.tsx` (add `useState` to the React import and `Plus`, `X` to the lucide import):

```tsx
function NotesCard({ hubId, notes: initial, isOwner, preview }: { hubId: string; notes: StripNote[]; isOwner: boolean; preview?: boolean }) {
  const [notes, setNotes] = useState(initial)
  const [showAll, setShowAll] = useState(false)
  const [adding, setAdding] = useState(false)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [busy, setBusy] = useState(false)

  async function add() {
    if (preview || !title.trim()) return
    setBusy(true)
    try {
      const res = await fetch(`/api/hubs/${hubId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), content: content.trim(), visibility: 'public' }),
      })
      if (!res.ok) return
      const n = await res.json()
      setNotes((cur) => [{ id: n.id, title: n.title, content: n.content, color: n.color }, ...cur])
      setTitle(''); setContent(''); setAdding(false)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Shell icon={<StickyNote className="h-4 w-4 text-primary" />} title="Notes">
      {notes.length === 0 ? (
        <p className="text-xs text-muted-foreground">No notes yet.</p>
      ) : (
        <ul className="min-h-0 flex-1 space-y-1.5 overflow-y-auto">
          {notes.slice(0, 2).map((n) => (
            <li key={n.id} className="rounded-lg border-l-2 bg-muted/40 px-2 py-1.5" style={{ borderColor: n.color }}>
              <p className="truncate text-xs font-medium">{n.title}</p>
              <p className="truncate text-xs text-muted-foreground">{n.content}</p>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-2 flex items-center justify-between">
        {notes.length > 2 ? (
          <button onClick={() => setShowAll(true)} className="text-xs text-primary hover:underline">View all notes →</button>
        ) : <span />}
        {isOwner && (
          <button title="Add note" onClick={() => setAdding(true)} className="rounded p-1 text-muted-foreground hover:bg-muted">
            <Plus className="h-4 w-4" />
          </button>
        )}
      </div>

      {showAll && (
        <NoteModal title="Notes" onClose={() => setShowAll(false)}>
          {notes.map((n) => (
            <div key={n.id} className="mb-2 rounded-lg border-l-2 bg-muted/40 px-3 py-2" style={{ borderColor: n.color }}>
              <p className="text-sm font-medium">{n.title}</p>
              <p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">{n.content}</p>
            </div>
          ))}
        </NoteModal>
      )}

      {adding && (
        <NoteModal title="New note" onClose={() => setAdding(false)}>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" maxLength={200} className="mb-2 w-full rounded-lg border border-border bg-transparent px-3 py-2 text-sm" />
          <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Write a note for your community…" rows={4} maxLength={5000} className="w-full rounded-lg border border-border bg-transparent px-3 py-2 text-sm" />
          <button onClick={add} disabled={busy || !title.trim()} className="mt-3 w-full rounded-lg bg-primary py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">
            {busy ? 'Saving…' : 'Add note'}
          </button>
        </NoteModal>
      )}
    </Shell>
  )
}

function NoteModal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="max-h-[80vh] w-full max-w-md overflow-y-auto rounded-2xl bg-surface p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">{title}</h2>
          <button onClick={onClose} className="rounded p-1 text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>
        {children}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/hub/community/CommunityUtilityStrip.test.tsx`
Expected: PASS (9 tests).

- [ ] **Step 5: Verify tsc + commit**

Run: `npx tsc --noEmit` → 0 errors.

```bash
git add src/components/hub/community/CommunityUtilityStrip.tsx src/components/hub/community/CommunityUtilityStrip.test.tsx
git commit -m "feat(m3c): Notes card with view-all and owner quick-add"
```

---

### Task 5: `HubResourcesModal` — the missing files/links manager

**Files:**
- Create: `src/components/hub/builder/HubResourcesModal.tsx`
- Test: `src/components/hub/builder/HubResourcesModal.test.tsx` (create)

**Interfaces:**
- Consumes: `GET /api/hubs/[id]` → `{ hub, folders, items, notes, bookmarks }` (owner-only); `POST /api/hubs/[id]/items` body `{ type: 'file'|'link', title, url }` → 201; `DELETE /api/hubs/[id]/items/[itemId]`.
- Produces: `HubResourcesModal({ hubId, onClose })`.

**Context:** community hubs render `HubBuilder`, never `HubEditor`, so there is currently **no** way for a community owner to add files or links. `HubItem.visibility` defaults to `"public"`, so anything created here appears in the public Resources widget immediately.

- [ ] **Step 1: Write the failing test**

Create `src/components/hub/builder/HubResourcesModal.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { HubResourcesModal } from './HubResourcesModal'

const items = [
  { id: 'i1', type: 'file', title: 'Welcome Guide.pdf', url: 'https://x/y.pdf' },
  { id: 'i2', type: 'link', title: 'Useful Links', url: 'https://example.com' },
  { id: 'i3', type: 'note', title: 'Not a resource', url: null },
]

beforeEach(() => {
  vi.restoreAllMocks()
  global.fetch = vi.fn(async (url: any, init?: any) => {
    if (String(url).endsWith('/api/hubs/h1')) return { ok: true, json: async () => ({ items }) } as any
    if (init?.method === 'POST') return { ok: true, status: 201, json: async () => ({ id: 'i9', type: 'link', title: 'New Link', url: 'https://new.test' }) } as any
    return { ok: true, json: async () => ({}) } as any
  }) as any
})

describe('HubResourcesModal', () => {
  it('lists only file and link items', async () => {
    render(<HubResourcesModal hubId="h1" onClose={() => {}} />)
    expect(await screen.findByText('Welcome Guide.pdf')).toBeInTheDocument()
    expect(screen.getByText('Useful Links')).toBeInTheDocument()
    expect(screen.queryByText('Not a resource')).toBeNull()
  })

  it('adds a link through the items API', async () => {
    render(<HubResourcesModal hubId="h1" onClose={() => {}} />)
    await screen.findByText('Welcome Guide.pdf')
    fireEvent.change(screen.getByPlaceholderText('Title'), { target: { value: 'New Link' } })
    fireEvent.change(screen.getByPlaceholderText('https://…'), { target: { value: 'https://new.test' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    await waitFor(() => {
      const call = (global.fetch as any).mock.calls.find((c: any[]) => c[1]?.method === 'POST')
      expect(call[0]).toBe('/api/hubs/h1/items')
      expect(JSON.parse(call[1].body)).toMatchObject({ type: 'link', title: 'New Link', url: 'https://new.test' })
    })
  })

  it('requires a title before Add is enabled', async () => {
    render(<HubResourcesModal hubId="h1" onClose={() => {}} />)
    await screen.findByText('Welcome Guide.pdf')
    expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/hub/builder/HubResourcesModal.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the modal**

Create `src/components/hub/builder/HubResourcesModal.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'
import { X, Trash2, FileText, Link as LinkIcon } from 'lucide-react'

type Item = { id: string; type: string; title: string; url: string | null }

export function HubResourcesModal({ hubId, onClose }: { hubId: string; onClose: () => void }) {
  const [items, setItems] = useState<Item[]>([])
  const [kind, setKind] = useState<'link' | 'file'>('link')
  const [title, setTitle] = useState('')
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)

  // The hub GET is owner-gated and already returns every item; filter to the two
  // types the public Resources widget renders.
  const load = async () => {
    const res = await fetch(`/api/hubs/${hubId}`)
    if (!res.ok) return
    const d = await res.json()
    setItems((d.items ?? []).filter((i: Item) => i.type === 'file' || i.type === 'link'))
  }
  useEffect(() => { load() }, [hubId])

  async function add() {
    if (!title.trim()) return
    setBusy(true)
    try {
      const res = await fetch(`/api/hubs/${hubId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: kind, title: title.trim(), url: url.trim() || null }),
      })
      if (!res.ok) return
      const created = await res.json()
      setItems((cur) => [...cur, { id: created.id, type: created.type, title: created.title, url: created.url }])
      setTitle(''); setUrl('')
    } finally {
      setBusy(false)
    }
  }

  async function remove(id: string) {
    if (!window.confirm('Remove this resource?')) return
    const res = await fetch(`/api/hubs/${hubId}/items/${id}`, { method: 'DELETE' })
    if (res.ok) setItems((cur) => cur.filter((i) => i.id !== id))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-surface p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">Files &amp; links ({items.length})</h2>
          <button onClick={onClose} className="rounded-md p-1 text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>

        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No resources yet.</p>
        ) : (
          <ul className="mb-4 space-y-2">
            {items.map((i) => (
              <li key={i.id} className="flex items-center gap-2 rounded-lg border border-border p-2">
                {i.type === 'link' ? <LinkIcon className="h-4 w-4 text-muted-foreground" /> : <FileText className="h-4 w-4 text-muted-foreground" />}
                <span className="flex-1 truncate text-sm">{i.title}</span>
                <button onClick={() => remove(i.id)} title="Delete" className="rounded p-1 text-muted-foreground hover:bg-muted"><Trash2 className="h-4 w-4" /></button>
              </li>
            ))}
          </ul>
        )}

        <div className="space-y-2 rounded-xl border border-border p-3">
          <div className="flex gap-2">
            <select value={kind} onChange={(e) => setKind(e.target.value as 'link' | 'file')} className="rounded-lg border border-border bg-transparent px-2 py-1 text-sm">
              <option value="link">Link</option>
              <option value="file">File</option>
            </select>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className="flex-1 rounded-lg border border-border bg-transparent px-3 py-1.5 text-sm" />
          </div>
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" className="w-full rounded-lg border border-border bg-transparent px-3 py-1.5 text-sm" />
          <button onClick={add} disabled={busy || !title.trim()} className="w-full rounded-lg bg-primary py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">Add</button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/hub/builder/HubResourcesModal.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Verify tsc + commit**

Run: `npx tsc --noEmit` → 0 errors.

```bash
git add src/components/hub/builder/HubResourcesModal.tsx src/components/hub/builder/HubResourcesModal.test.tsx
git commit -m "feat(m3c): resources manager modal for community hubs"
```

---

### Task 6: Poll composer signal

**Files:**
- Modify: `src/components/hub/HubPostComposer.tsx`
- Modify: `src/components/hub/community/CommunityFeed.tsx`
- Modify: `src/components/hub/community/CommunityHubView.tsx`
- Test: `src/components/hub/HubPostComposer.test.tsx` (create)

**Interfaces:**
- Consumes: `makeBlock('poll')` from `@/components/bulletin/BlockEditor` (existing).
- Produces: `HubPostComposer` gains optional prop `pollNonce?: number`; `CommunityFeed` gains optional `pollNonce?: number` and forwards it. `CommunityHubView` already owns `pollNonce` state from Task 3.

**Why a nonce:** the Tools button may be pressed repeatedly. A counter that increments re-fires the effect each time, where a boolean would latch after the first press.

- [ ] **Step 1: Write the failing test**

Create `src/components/hub/HubPostComposer.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { HubPostComposer } from './HubPostComposer'

beforeEach(() => {
  vi.restoreAllMocks()
  window.HTMLElement.prototype.scrollIntoView = vi.fn()
})

describe('HubPostComposer pollNonce', () => {
  it('does not open a block by default', () => {
    render(<HubPostComposer hubId="h1" onPosted={() => {}} />)
    expect(screen.getByTitle('Poll')).toBeInTheDocument() // picker still collapsed
  })

  it('opens a poll block when the nonce increments', () => {
    const { rerender } = render(<HubPostComposer hubId="h1" onPosted={() => {}} pollNonce={0} />)
    rerender(<HubPostComposer hubId="h1" onPosted={() => {}} pollNonce={1} />)
    // With a block open the picker row is replaced by the BlockEditor.
    expect(screen.queryByTitle('Poll')).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/hub/HubPostComposer.test.tsx`
Expected: FAIL — `pollNonce` is not a prop; the picker is still present after rerender.

- [ ] **Step 3: Add the prop**

In `src/components/hub/HubPostComposer.tsx`, add `useEffect`/`useRef` to the React import, accept the prop, and add the effect plus a wrapper ref:

```tsx
export function HubPostComposer({ hubId, onPosted, pollNonce }: { hubId: string; onPosted: () => void; pollNonce?: number }) {
```

```tsx
  const rootRef = useRef<HTMLDivElement>(null)

  // Driven by the Tools card. A counter (not a boolean) so repeat presses re-fire.
  useEffect(() => {
    if (!pollNonce) return
    setBlock(makeBlock('poll'))
    rootRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [pollNonce])
```

Attach the ref to the outer div: `<div ref={rootRef} className="rounded-xl border border-border bg-surface p-4">`.

- [ ] **Step 4: Forward it through the feed**

In `CommunityFeed.tsx`, add `pollNonce` to the props and pass it down:

```tsx
  hubId, canPost, isPrivileged, currentUserId, config, preview, pollNonce,
```

```tsx
  pollNonce?: number
```

```tsx
      {canPost && config.feed.composerEnabled && <HubPostComposer hubId={hubId} onPosted={load} pollNonce={pollNonce} />}
```

In `CommunityHubView.tsx`, pass the state through: `<CommunityFeed ... pollNonce={pollNonce} />`.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/components/hub/HubPostComposer.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 6: Verify tsc + commit**

Run: `npx tsc --noEmit` → 0 errors.

```bash
git add src/components/hub/HubPostComposer.tsx src/components/hub/HubPostComposer.test.tsx src/components/hub/community/CommunityFeed.tsx src/components/hub/community/CommunityHubView.tsx
git commit -m "feat(m3c): pollNonce opens the composer with a poll block"
```

---

### Task 7: Tools card

**Files:**
- Modify: `src/components/hub/community/CommunityUtilityStrip.tsx` (replace the `ToolsCard` stub)
- Modify: `src/components/hub/community/CommunityHubView.tsx` (mount the two modals)
- Test: `src/components/hub/community/CommunityUtilityStrip.test.tsx` (append)

**Interfaces:**
- Consumes: `onOpenPoll`/`onOpenEvents`/`onOpenResources` (Task 3), `HubEventsModal` (existing), `HubResourcesModal` (Task 5).
- Produces: no new exports.

**Deviation from the mockup (intentional):** no "View all tools →" link — there is no fifth tool, and a dead link is worse than its absence.

- [ ] **Step 1: Write the failing test**

Append to `CommunityUtilityStrip.test.tsx`:

```tsx
describe('Tools card', () => {
  it('fires the matching callback for each tool', async () => {
    const onOpenPoll = vi.fn(), onOpenEvents = vi.fn(), onOpenResources = vi.fn()
    render(<CommunityUtilityStrip {...base} isPrivileged onOpenPoll={onOpenPoll} onOpenEvents={onOpenEvents} onOpenResources={onOpenResources} />)
    fireEvent.click(screen.getByRole('button', { name: 'Polls' }))
    fireEvent.click(screen.getByRole('button', { name: 'Events' }))
    fireEvent.click(screen.getByRole('button', { name: 'Files' }))
    fireEvent.click(screen.getByRole('button', { name: 'Links' }))
    expect(onOpenPoll).toHaveBeenCalledTimes(1)
    expect(onOpenEvents).toHaveBeenCalledTimes(1)
    expect(onOpenResources).toHaveBeenCalledTimes(2) // Files and Links share the manager
  })
})
```

Add `vi` to the vitest import and `fireEvent` to the `@testing-library/react` import at the top of the file.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/hub/community/CommunityUtilityStrip.test.tsx`
Expected: FAIL — no buttons in the stub.

- [ ] **Step 3: Implement the card**

Replace the `ToolsCard` stub (add `BarChart3`, `CalendarDays`, `FolderOpen`, `Link2` to the lucide import):

```tsx
function ToolsCard({ onOpenPoll, onOpenEvents, onOpenResources }: { onOpenPoll: () => void; onOpenEvents: () => void; onOpenResources: () => void }) {
  const tools = [
    { label: 'Polls', icon: <BarChart3 className="h-4 w-4" />, onClick: onOpenPoll },
    { label: 'Events', icon: <CalendarDays className="h-4 w-4" />, onClick: onOpenEvents },
    { label: 'Files', icon: <FolderOpen className="h-4 w-4" />, onClick: onOpenResources },
    { label: 'Links', icon: <Link2 className="h-4 w-4" />, onClick: onOpenResources },
  ]
  return (
    <Shell icon={<Wrench className="h-4 w-4 text-primary" />} title="Tools">
      <div className="grid grid-cols-4 gap-2">
        {tools.map((t) => (
          <button
            key={t.label}
            onClick={t.onClick}
            className="flex flex-col items-center gap-1 rounded-lg border border-border p-2 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>
    </Shell>
  )
}
```

- [ ] **Step 4: Mount the modals**

In `CommunityHubView.tsx`, import both modals and render them at the end of the outer wrapper, gated so they never open in preview:

```tsx
import { HubEventsModal } from '@/components/hub/builder/HubEventsModal'
import { HubResourcesModal } from '@/components/hub/builder/HubResourcesModal'
```

```tsx
      {!preview && manageEvents && <HubEventsModal hubId={hub.id} onClose={() => setManageEvents(false)} />}
      {!preview && manageResources && <HubResourcesModal hubId={hub.id} onClose={() => setManageResources(false)} />}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/components/hub/community/CommunityUtilityStrip.test.tsx`
Expected: PASS (10 tests).

- [ ] **Step 6: Verify tsc + commit**

Run: `npx tsc --noEmit` → 0 errors.

```bash
git add src/components/hub/community/CommunityUtilityStrip.tsx src/components/hub/community/CommunityUtilityStrip.test.tsx src/components/hub/community/CommunityHubView.tsx
git commit -m "feat(m3c): Tools card wired to composer, events and resources"
```

---

### Task 8: Three-column layout + narrow Kollab rail

**Files:**
- Modify: `src/components/hub/community/CommunityHubView.tsx:44-93`
- Modify: `src/components/hub/community/CommunityKollab.tsx`
- Test: `src/components/hub/community/CommunityHubView.test.tsx` (create)

**Interfaces:**
- Consumes: `config.kollab.enabled`.
- Produces: `CommunityKollab` gains optional prop `narrow?: boolean`.

**Layout contract:** container `max-w-7xl`; when the pool is enabled the grid is `lg:grid-cols-[260px_1fr_320px]`, otherwise `lg:grid-cols-[1fr_320px]`. DOM order is pool → feed → widgets for desktop, so mobile needs explicit ordering to put the feed first.

- [ ] **Step 1: Write the failing test**

Create `src/components/hub/community/CommunityHubView.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { CommunityHubView } from './CommunityHubView'
import { DEFAULT_HUB_CONFIG } from '@/lib/types/hub-config'

vi.mock('./CommunityFeed', () => ({ CommunityFeed: () => <div data-testid="feed" /> }))
vi.mock('./CommunitySidebar', () => ({ CommunitySidebar: () => <div data-testid="sidebar" /> }))

const base = {
  hub: { id: 'h1', title: 'Hub', tagline: null, description: null, coverImage: null, heroVideoUrl: null },
  ownerUsername: 'o', isPrivileged: false, joined: false, memberCount: 0,
  members: [], resources: [], events: [], drops: [], notes: [],
  counts: { posts: 0, members: 0, resources: 0, events: 0, kollab: 0 },
  sharePath: '/o/hub/h', config: DEFAULT_HUB_CONFIG, preview: true,
}

describe('CommunityHubView layout', () => {
  it('uses three columns when the pool is enabled', () => {
    const { container } = render(<CommunityHubView {...base} />)
    expect(container.querySelector('.lg\\:grid-cols-\\[260px_1fr_320px\\]')).toBeTruthy()
  })

  // An empty 260px rail would otherwise sit there when the pool is off.
  it('falls back to two columns when the pool is disabled', () => {
    const config = { ...DEFAULT_HUB_CONFIG, kollab: { ...DEFAULT_HUB_CONFIG.kollab, enabled: false } }
    const { container } = render(<CommunityHubView {...base} config={config} />)
    expect(container.querySelector('.lg\\:grid-cols-\\[260px_1fr_320px\\]')).toBeNull()
    expect(container.querySelector('.lg\\:grid-cols-\\[1fr_320px\\]')).toBeTruthy()
  })

  it('widens the container for three columns', () => {
    const { container } = render(<CommunityHubView {...base} />)
    expect(container.querySelector('.max-w-7xl')).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/hub/community/CommunityHubView.test.tsx`
Expected: FAIL — container is `max-w-5xl` and the pool sits in its own band.

- [ ] **Step 3: Restructure the layout**

In `CommunityHubView.tsx`, change `max-w-5xl` → `max-w-7xl`. Delete the standalone `{config.kollab.enabled && (<div className="mt-6">…</div>)}` block (lines 70-83) and replace the grid (lines 85-88) with:

```tsx
        <div className={`mt-6 grid grid-cols-1 gap-6 ${config.kollab.enabled ? 'lg:grid-cols-[260px_1fr_320px]' : 'lg:grid-cols-[1fr_320px]'}`}>
          {config.kollab.enabled && (
            <div className="order-2 lg:order-none">
              <CommunityKollab
                hubId={hub.id}
                canDrop={config.kollab.whoCanDrop === 'owner-only' ? isPrivileged : (isPrivileged || joined)}
                isPrivileged={isPrivileged}
                currentUserId={currentUserId}
                enabled={config.kollab.enabled}
                initialDrops={drops}
                total={counts.kollab}
                narrow
                preview={preview}
              />
            </div>
          )}
          <div className="order-1 lg:order-none">
            <CommunityFeed hubId={hub.id} canPost={canPost} isPrivileged={isPrivileged} currentUserId={currentUserId} config={config} preview={preview} pollNonce={pollNonce} />
          </div>
          <div className="order-3 lg:order-none">
            <CommunitySidebar config={config} heroVideoUrl={hub.heroVideoUrl} members={members} resources={resources} events={events} />
          </div>
        </div>
```

- [ ] **Step 4: Add the narrow variant**

In `CommunityKollab.tsx`, accept `narrow?: boolean` in the props (type and destructuring) and use it for the tile grid. Change:

```tsx
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
```

to:

```tsx
        <div className={`grid gap-2 ${narrow ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4'}`}>
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/components/hub/community/CommunityHubView.test.tsx src/components/hub/community/CommunityUtilityStrip.test.tsx`
Expected: PASS.

- [ ] **Step 6: Verify tsc + commit**

Run: `npx tsc --noEmit` → 0 errors.

```bash
git add src/components/hub/community/CommunityHubView.tsx src/components/hub/community/CommunityKollab.tsx src/components/hub/community/CommunityHubView.test.tsx
git commit -m "feat(m3c): three-column layout with the Kollab pool as a left rail"
```

---

### Task 9: Builder — enable the "Widgets & Tools" section

**Files:**
- Modify: `src/components/hub/builder/HubBuilderNav.tsx`
- Modify: `src/components/hub/builder/HubBuilder.tsx`
- Create: `src/components/hub/builder/WidgetsToolsSection.tsx`
- Test: `src/components/hub/builder/WidgetsToolsSection.test.tsx` (create)

**Interfaces:**
- Consumes: `config.utility` (Task 1), `HubResourcesModal` (Task 5).
- Produces: `WidgetsToolsSection({ config, onChange, hubId })`; `BuilderSection` union gains `'widgets'`.

**Context:** the nav already lists "Widgets & Tools — Top utility widgets" in its disabled `SOON` array. Move it into `ITEMS` rather than inventing a new home.

- [ ] **Step 1: Write the failing test**

Create `src/components/hub/builder/WidgetsToolsSection.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { WidgetsToolsSection } from './WidgetsToolsSection'
import { DEFAULT_HUB_CONFIG } from '@/lib/types/hub-config'

describe('WidgetsToolsSection', () => {
  it('lists the three utility cards with labels', () => {
    render(<WidgetsToolsSection config={DEFAULT_HUB_CONFIG} onChange={() => {}} hubId="h1" />)
    expect(screen.getByText('Notes')).toBeInTheDocument()
    expect(screen.getByText('Kollab AI')).toBeInTheDocument()
    expect(screen.getByText('Tools')).toBeInTheDocument()
  })

  it('toggles a card off through onChange', async () => {
    const onChange = vi.fn()
    render(<WidgetsToolsSection config={DEFAULT_HUB_CONFIG} onChange={onChange} hubId="h1" />)
    fireEvent.click(screen.getAllByRole('checkbox')[0])
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange.mock.calls[0][0].utility[0]).toEqual({ key: 'notes', enabled: false })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/hub/builder/WidgetsToolsSection.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the section**

Create `src/components/hub/builder/WidgetsToolsSection.tsx`:

```tsx
'use client'

import { useState } from 'react'
import type { HubConfig, HubUtilityKey } from '@/lib/types/hub-config'
import { HubResourcesModal } from './HubResourcesModal'

const LABELS: Record<HubUtilityKey, string> = { notes: 'Notes', ai: 'Kollab AI', tools: 'Tools' }
const SUBS: Record<HubUtilityKey, string> = {
  notes: 'Pinned notes for your community',
  ai: 'Reserved for Kollab AI — coming soon',
  tools: 'Quick actions, visible only to you',
}

export function WidgetsToolsSection({ config, onChange, hubId }: { config: HubConfig; onChange: (c: HubConfig) => void; hubId: string }) {
  const [manageResources, setManageResources] = useState(false)

  const toggle = (i: number) => {
    const utility = config.utility.map((w, k) => (k === i ? { ...w, enabled: !w.enabled } : w))
    onChange({ ...config, utility })
  }

  return (
    <div className="max-w-2xl space-y-8">
      <section>
        <h2 className="text-lg font-bold">Utility strip</h2>
        <p className="mb-3 text-sm text-muted-foreground">The row of cards above your hub header.</p>
        <div className="space-y-2">
          {config.utility.map((w, i) => (
            <div key={w.key} className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3">
              <div className="flex-1">
                <p className="text-sm font-medium">{LABELS[w.key]}</p>
                <p className="text-xs text-muted-foreground">{SUBS[w.key]}</p>
              </div>
              <label className="relative inline-flex cursor-pointer items-center">
                <input type="checkbox" checked={w.enabled} onChange={() => toggle(i)} className="peer sr-only" />
                <div className="h-5 w-9 rounded-full bg-muted peer-checked:bg-galli after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all peer-checked:after:translate-x-4" />
              </label>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-bold">Files &amp; links</h2>
        <p className="mb-3 text-sm text-muted-foreground">Resources shown in your community sidebar.</p>
        <button onClick={() => setManageResources(true)} className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted">Manage files &amp; links</button>
      </section>

      {manageResources && <HubResourcesModal hubId={hubId} onClose={() => setManageResources(false)} />}
    </div>
  )
}
```

- [ ] **Step 4: Enable it in the nav**

In `HubBuilderNav.tsx`: extend the union to `export type BuilderSection = 'settings' | 'layout' | 'profile' | 'community' | 'widgets'`, remove the `Widgets & Tools` entry from `SOON`, and add to `ITEMS` after the `layout` entry:

```ts
  { key: 'widgets', label: 'Widgets & Tools', sub: 'Top utility widgets', icon: Boxes, enabled: true },
```

In `HubBuilder.tsx`, import `WidgetsToolsSection` and render it for the new section, following the existing section-switch pattern:

```tsx
      {section === 'widgets' && <WidgetsToolsSection config={config} onChange={setConfig} hubId={hubId} />}
```

Match the exact prop names the sibling sections use (`config`/`onChange`/`hubId`) — read `HubBuilder.tsx` and mirror how `LayoutSectionsSection` is invoked.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/components/hub/builder/WidgetsToolsSection.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 6: Verify tsc + lint + commit**

Run: `npx tsc --noEmit` → 0 errors.
Lint (worktree workaround from Global Constraints) → 0 errors.

```bash
git add src/components/hub/builder/
git commit -m "feat(m3c): enable the Widgets & Tools builder section"
```

---

### Task 10: Full verification + browser smoke

**Files:** none (verification only).

**This milestone's primary gate is the browser.** M3b shipped a CSP bug that every server-side test missed because the failure existed only in a browser. M3c is almost entirely client-side, so the browser pass happens **before merge**.

- [ ] **Step 1: Static gate**

```bash
npx tsc --noEmit                       # expect 0
npx vitest run                         # expect all pass
npx next build                         # expect exit 0
```
Lint via the worktree workaround → **0 errors** (warnings are pre-existing).

If `next build` reports stale `.next/types` errors for moved routes, delete `.next` and rebuild.

- [ ] **Step 2: Seed a throwaway DB**

```bash
docker start pages-mvp-postgres-1
docker exec pages-mvp-postgres-1 psql -U pages -d postgres -c "DROP DATABASE IF EXISTS pages_m3c;" -c "CREATE DATABASE pages_m3c OWNER pages;"
```
Then with `DATABASE_URL`/`DATABASE_URL_UNPOOLED` = `postgresql://pages:pages@127.0.0.1:5434/pages_m3c`, run `npx prisma migrate deploy`.

Seed: one owner, one member, one published community hub with 3 notes (one `visibility:'private'`), 2 file/link items, 1 upcoming event, and 30 drops.

- [ ] **Step 3: Browser smoke (real Chrome, `next start`)**

Build, then `npx next start -p 3021` against `pages_m3c`. Use the `superpowers-chrome:browsing` skill. Verify **against server truth, not UI timing**:

1. **Visitor** sees a 2-card strip (Notes + Kollab AI); **no Tools card**; page source contains **no private note text**.
2. **Owner** sees 3 cards; Tools shows Polls / Events / Files / Links.
3. Notes card lists 2 notes + "View all notes →"; the modal lists all public notes.
4. Owner `+` → add a note → 201 and it appears without reload.
5. Tools → Polls scrolls to the composer with a poll block open.
6. Tools → Events opens the events modal; Tools → Files and Links both open the resources modal.
7. Resources modal: add a link → appears in the public Resources widget after reload.
8. Layout: three columns at ≥1024px; at 375px the order is **feed → pool → widgets**.
9. Kollab rail: 2-up tiles, lightbox opens, "Load more" reaches drop 30.
10. **Browser console has no CSP or other errors** on load and after each interaction.

- [ ] **Step 4: Builder check**

Open `/hubs/<id>`: the "Widgets & Tools" nav item is enabled; toggling a card off updates the live preview and, after autosave, the public page.

- [ ] **Step 5: Clean up + merge**

Drop `pages_m3c`, remove any scratch scripts, confirm `git status` is clean, then merge `origin/main` into the branch, re-run the static gate, and merge to `main` only after the browser smoke passed.

---

## Self-review notes (author)

- **Spec coverage:** R1 config → Task 1; R2 three-column layout + narrow rail → Task 8; R3 strip shell → Task 3; R4 Notes card → Tasks 2+4; R5 inert AI slot → Task 3; R6 Tools → Tasks 6+7; R7 builder → Task 9; verification → Task 10.
- **Spec amendments made during planning** (the spec is now stale on these three points; update it or accept this plan as the authority):
  1. Notes authoring is gated on **`isOwner`**, not `isPrivileged` — the notes route rejects collaborators. Task 2 threads a new prop.
  2. The spec assumed a "Manage files & links" surface existed. It does **not** for community hubs — `HubEditor` is unreachable when `hub.community` is true. Task 5 builds `HubResourcesModal` to close that gap (user-approved).
  3. Builder toggles live in a newly enabled **"Widgets & Tools"** nav section (already reserved in `HubBuilderNav`'s `SOON` list), not in Layout & Sections.
- **Type consistency:** `HubUtilityKey`/`HubUtilityWidget` (Task 1) are consumed unchanged in Tasks 3, 9. `StripNote`/`toStripNote` (Task 2) used in Tasks 3, 4. `pollNonce: number` identical across Tasks 3, 6, 8. `HubResourcesModal({hubId, onClose})` identical in Tasks 5, 7, 9. `narrow?: boolean` defined and consumed in Task 8.
- **No migration, no new API route** — holds across all ten tasks.
