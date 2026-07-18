# Index Element Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a free, JSON-only `index` canvas element — a scannable, auto-numbered catalog of connected items with list + card-flip views, expandable entries, category grouping, and live search.

**Architecture:** Follows the established 7-seam element pattern (like `flowchart` / `product-list`). All data lives in the element JSON — no DB, no API, no server fetch. A pure, unit-tested helper module (`src/lib/index-element.ts`) holds the filter/group/number logic; an editor component and a public component consume it. Links pass through the existing `safeHref`; images rely on the existing image-host allowlist.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Tailwind, Vitest, lucide-react icons.

## Global Constraints

- Worktree: work in `C:/Users/whirl/pages-mvp-index` on branch `feat/index-element`. Verify branch before every commit (`git rev-parse --abbrev-ref HEAD` → `feat/index-element`).
- Element is **free** (no `pro: true` in the slash menu entry).
- Slash-menu category is exactly `'Content'`.
- Test runner: `pnpm test` (= `vitest run`). Test files import `{ describe, it, expect } from 'vitest'`.
- Accent color default `#39D98A` (brand green).
- All outbound links MUST route through `safeHref` from `@/lib/editor/safe-href` (signature: `safeHref(url?: string): string | undefined`).
- `createElement` in `src/lib/types/canvas.ts` is the SINGLE source of element defaults — do NOT add a default branch in `PageEditor`.
- Before claiming done / before any deploy: `pnpm tsc --noEmit` clean, `pnpm test` green, `pnpm exec next lint` clean (lint is NOT covered by tsc and breaks prod builds — watch `no-html-link-for-pages` and `react/no-unescaped-entities`).
- Editor component prop contract: `{ element, onChange, onDelete, isSelected, onSelect }`. Public component prop contract: `{ element }`.

---

## File Structure

- **Create** `src/lib/index-element.ts` — pure helpers: `filterEntries`, `groupByCategory`, `displayNumber`, `newEntryId`.
- **Create** `src/lib/index-element.test.ts` — unit tests for the helpers.
- **Create** `src/components/elements/IndexElement.tsx` — editor component.
- **Create** `src/components/elements/PublicIndexElement.tsx` — public/read-only component (list + cards).
- **Modify** `src/lib/types/canvas.ts` — `IndexEntry` interface, `ElementType` union, `CanvasElement` fields, `createElement('index')`.
- **Modify** `src/components/elements/index.ts` — export both components.
- **Modify** `src/components/canvas/SlashCommandMenu.tsx` — menu entry under `Content`.
- **Modify** `src/components/canvas/ColumnCanvas.tsx` — imports + `renderElement` case.
- **Modify** `src/lib/render-elements.tsx` — import + public render case.

---

## Task 1: Data model (types + createElement default)

**Files:**
- Modify: `src/lib/types/canvas.ts`

**Interfaces:**
- Produces: `IndexEntry` interface; `'index'` member of `ElementType`; `CanvasElement` fields `indexTitle?, indexIcon?, indexView?: 'list'|'cards', indexEnableSearch?, indexEnableNumbers?, indexAccent?, indexEntries?: IndexEntry[]`; `createElement('index')` returning those defaults with 2 seed entries.

- [ ] **Step 1: Add the `IndexEntry` interface**

In `src/lib/types/canvas.ts`, immediately after the `Product` interface block (the `// Product List element …` interface, ends ~line 54), add:

```ts
// Index element — a scannable catalog of connected items (all in element JSON)
export interface IndexEntry {
  id: string          // idx-<ts>-<rand>, stable per entry
  label: string       // primary line, e.g. "NASA Mars Data"
  subtitle?: string   // secondary line, e.g. "nasa.gov"
  linkUrl?: string    // resolved via safeHref (internal root-relative or http/mailto/external)
  category?: string   // group header; '' or undefined = ungrouped
  image?: string      // optional thumbnail (Blob URL / allowlisted host)
  note?: string       // expand-panel body text
  meta?: { key: string; value: string }[]  // freeform pairs, e.g. Author: NASA
  tags?: string[]     // chips; also searchable
}
```

- [ ] **Step 2: Add `'index'` to the `ElementType` union**

In the `ElementType` union, add a member near the other JSON-only special elements (after `| 'product-list'`):

```ts
  | 'index'                 // Scannable catalog of connected items (list + cards)
```

- [ ] **Step 3: Add fields to `CanvasElement`**

In the `CanvasElement` interface, after the Product List block (the `productListTitle?` / `products?` lines, ~line 326), add:

```ts
  // Index specific (scannable catalog; all in element JSON)
  indexTitle?: string
  indexIcon?: string                 // single emoji for the header, e.g. "🔎"
  indexView?: 'list' | 'cards'       // default rendering mode
  indexEnableSearch?: boolean        // show the live filter box
  indexEnableNumbers?: boolean       // auto-number entries 001, 002…
  indexAccent?: string               // accent color, default #39D98A
  indexEntries?: IndexEntry[]
```

- [ ] **Step 4: Add the `createElement('index')` default**

In `createElement`, add a case next to `case 'product-list':` (~line 1311):

```ts
    case 'index':
      return {
        ...base,
        indexTitle: 'Index',
        indexIcon: '🔎',
        indexView: 'list',
        indexEnableSearch: true,
        indexEnableNumbers: true,
        indexAccent: '#39D98A',
        indexEntries: [
          { id: `idx-${Date.now()}-a`, label: 'First entry', subtitle: 'example.com', linkUrl: '' },
          { id: `idx-${Date.now()}-b`, label: 'Second entry', subtitle: 'example.org', linkUrl: '' },
        ],
      }
```

- [ ] **Step 5: Typecheck**

Run: `pnpm tsc --noEmit`
Expected: no errors (clean exit). If pre-existing errors appear unrelated to `canvas.ts`, confirm they exist on a clean `origin/main` before proceeding.

- [ ] **Step 6: Commit**

```bash
git add src/lib/types/canvas.ts
git commit -m "feat(index): add Index element types and createElement default"
```

---

## Task 2: Pure helper module (`index-element.ts`) — TDD

**Files:**
- Create: `src/lib/index-element.ts`
- Test: `src/lib/index-element.test.ts`

**Interfaces:**
- Consumes: `IndexEntry` from `./types/canvas`.
- Produces:
  - `filterEntries(entries: IndexEntry[], query: string): IndexEntry[]`
  - `groupByCategory(entries: IndexEntry[]): { category: string; entries: IndexEntry[] }[]`
  - `displayNumber(index: number): string`  (0-based index → `"001"`)
  - `newEntryId(): string`  (`idx-<ts>-<rand>`)

- [ ] **Step 1: Write the failing tests**

Create `src/lib/index-element.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { filterEntries, groupByCategory, displayNumber, newEntryId } from './index-element'
import type { IndexEntry } from './types/canvas'

const entries: IndexEntry[] = [
  { id: '1', label: 'NASA Mars Data', subtitle: 'nasa.gov', category: 'Research', tags: ['space'] },
  { id: '2', label: 'Climate Study', subtitle: 'journal.com', category: 'Research' },
  { id: '3', label: 'Deep Work', subtitle: 'Cal Newport', category: 'Books' },
  { id: '4', label: 'Loose Note', subtitle: '' }, // no category
]

describe('filterEntries', () => {
  it('returns all entries for an empty or whitespace query', () => {
    expect(filterEntries(entries, '')).toHaveLength(4)
    expect(filterEntries(entries, '   ')).toHaveLength(4)
  })
  it('matches label case-insensitively', () => {
    const r = filterEntries(entries, 'mars')
    expect(r.map(e => e.id)).toEqual(['1'])
  })
  it('matches subtitle', () => {
    const r = filterEntries(entries, 'journal')
    expect(r.map(e => e.id)).toEqual(['2'])
  })
  it('matches tags', () => {
    const r = filterEntries(entries, 'space')
    expect(r.map(e => e.id)).toEqual(['1'])
  })
  it('returns empty array when nothing matches', () => {
    expect(filterEntries(entries, 'zzzzz')).toEqual([])
  })
})

describe('groupByCategory', () => {
  it('groups entries preserving first-seen category order', () => {
    const groups = groupByCategory(entries)
    expect(groups.map(g => g.category)).toEqual(['Research', 'Books', ''])
    expect(groups[0].entries.map(e => e.id)).toEqual(['1', '2'])
    expect(groups[2].entries.map(e => e.id)).toEqual(['4'])
  })
  it('puts everything in one empty-category group when none are set', () => {
    const groups = groupByCategory([{ id: 'a', label: 'x' }])
    expect(groups).toHaveLength(1)
    expect(groups[0].category).toBe('')
  })
})

describe('displayNumber', () => {
  it('zero-pads to three digits, 1-based', () => {
    expect(displayNumber(0)).toBe('001')
    expect(displayNumber(11)).toBe('012')
  })
  it('does not pad beyond three digits', () => {
    expect(displayNumber(999)).toBe('1000')
  })
})

describe('newEntryId', () => {
  it('produces unique ids with the idx- prefix', () => {
    const a = newEntryId()
    const b = newEntryId()
    expect(a).toMatch(/^idx-/)
    expect(a).not.toBe(b)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test src/lib/index-element.test.ts`
Expected: FAIL — cannot resolve `./index-element` / functions not defined.

- [ ] **Step 3: Write the implementation**

Create `src/lib/index-element.ts`:

```ts
import type { IndexEntry } from './types/canvas'

// Case-insensitive filter across label, subtitle, and tags.
// Empty/whitespace query returns all entries in original order.
export function filterEntries(entries: IndexEntry[], query: string): IndexEntry[] {
  const q = query.trim().toLowerCase()
  if (!q) return entries
  return entries.filter((e) => {
    const hay = [
      e.label,
      e.subtitle ?? '',
      ...(e.tags ?? []),
    ]
      .join(' ')
      .toLowerCase()
    return hay.includes(q)
  })
}

// Group entries by category, preserving entry order within a group and
// first-seen order of categories. Ungrouped entries (''/undefined) collapse
// into a single group keyed by '' (rendered without a header).
export function groupByCategory(
  entries: IndexEntry[],
): { category: string; entries: IndexEntry[] }[] {
  const order: string[] = []
  const map = new Map<string, IndexEntry[]>()
  for (const e of entries) {
    const cat = e.category ?? ''
    if (!map.has(cat)) {
      map.set(cat, [])
      order.push(cat)
    }
    map.get(cat)!.push(e)
  }
  return order.map((category) => ({ category, entries: map.get(category)! }))
}

// 0-based index → 1-based, zero-padded to 3 digits ("001"); plain past 999.
export function displayNumber(index: number): string {
  return String(index + 1).padStart(3, '0')
}

// Stable-enough unique id for a new entry (editor/client runtime only).
export function newEntryId(): string {
  return `idx-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test src/lib/index-element.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add src/lib/index-element.ts src/lib/index-element.test.ts
git commit -m "feat(index): add pure filter/group/number helpers with tests"
```

---

## Task 3: Editor component (`IndexElement.tsx`)

**Files:**
- Create: `src/components/elements/IndexElement.tsx`

**Interfaces:**
- Consumes: `CanvasElement`, `IndexEntry` from `@/lib/types/canvas`; `newEntryId` from `@/lib/index-element`.
- Produces: `export function IndexElement({ element, onChange, onDelete, isSelected, onSelect })`.

- [ ] **Step 1: Write the component**

Create `src/components/elements/IndexElement.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { Plus, Trash2, ChevronUp, ChevronDown, GripVertical, Settings2 } from 'lucide-react'
import type { CanvasElement, IndexEntry } from '@/lib/types/canvas'
import { newEntryId } from '@/lib/index-element'

interface Props {
  element: CanvasElement
  onChange: (updates: Partial<CanvasElement>) => void
  onDelete: () => void
  isSelected: boolean
  onSelect: () => void
}

export function IndexElement({ element, onChange, onDelete, isSelected, onSelect }: Props) {
  const entries = element.indexEntries ?? []
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const patchEntry = (id: string, updates: Partial<IndexEntry>) => {
    onChange({
      indexEntries: entries.map((e) => (e.id === id ? { ...e, ...updates } : e)),
    })
  }

  const addEntry = () => {
    const entry: IndexEntry = { id: newEntryId(), label: 'New entry', subtitle: '', linkUrl: '' }
    onChange({ indexEntries: [...entries, entry] })
    setExpandedId(entry.id)
  }

  const removeEntry = (id: string) => {
    onChange({ indexEntries: entries.filter((e) => e.id !== id) })
  }

  const moveEntry = (index: number, dir: -1 | 1) => {
    const target = index + dir
    if (target < 0 || target >= entries.length) return
    const next = [...entries]
    ;[next[index], next[target]] = [next[target], next[index]]
    onChange({ indexEntries: next })
  }

  const setMeta = (id: string, meta: { key: string; value: string }[]) => patchEntry(id, { meta })

  return (
    <div
      onClick={onSelect}
      className={`rounded-xl border bg-white p-4 transition-shadow ${
        isSelected ? 'border-galli ring-2 ring-galli/30' : 'border-slate-200'
      }`}
    >
      {/* Header controls */}
      <div className="mb-3 flex items-center gap-2">
        <input
          value={element.indexIcon ?? ''}
          onChange={(e) => onChange({ indexIcon: e.target.value.slice(0, 2) })}
          className="w-12 rounded-lg border border-slate-200 px-2 py-1.5 text-center text-lg"
          aria-label="Index icon (emoji)"
          placeholder="🔎"
        />
        <input
          value={element.indexTitle ?? ''}
          onChange={(e) => onChange({ indexTitle: e.target.value })}
          className="flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold"
          placeholder="Index title"
        />
        <button
          onClick={(e) => { e.stopPropagation(); onDelete() }}
          className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-500"
          aria-label="Delete element"
        >
          <Trash2 size={16} />
        </button>
      </div>

      {/* Display options */}
      <div className="mb-3 flex flex-wrap items-center gap-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
        <label className="flex items-center gap-1.5">
          View
          <select
            value={element.indexView ?? 'list'}
            onChange={(e) => onChange({ indexView: e.target.value as 'list' | 'cards' })}
            className="rounded border border-slate-200 px-1.5 py-1"
          >
            <option value="list">List</option>
            <option value="cards">Cards</option>
          </select>
        </label>
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={element.indexEnableSearch ?? true}
            onChange={(e) => onChange({ indexEnableSearch: e.target.checked })}
          />
          Search box
        </label>
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={element.indexEnableNumbers ?? true}
            onChange={(e) => onChange({ indexEnableNumbers: e.target.checked })}
          />
          Auto-number
        </label>
        <label className="flex items-center gap-1.5">
          Accent
          <input
            type="color"
            value={element.indexAccent ?? '#39D98A'}
            onChange={(e) => onChange({ indexAccent: e.target.value })}
            className="h-6 w-8 rounded border border-slate-200"
          />
        </label>
      </div>

      {/* Entries */}
      <div className="space-y-2">
        {entries.map((entry, i) => {
          const open = expandedId === entry.id
          return (
            <div key={entry.id} className="rounded-lg border border-slate-200">
              <div className="flex items-center gap-2 p-2">
                <GripVertical size={14} className="shrink-0 text-slate-300" />
                <div className="flex flex-col">
                  <button
                    onClick={(e) => { e.stopPropagation(); moveEntry(i, -1) }}
                    disabled={i === 0}
                    className="text-slate-400 hover:text-slate-700 disabled:opacity-30"
                    aria-label="Move up"
                  >
                    <ChevronUp size={14} />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); moveEntry(i, 1) }}
                    disabled={i === entries.length - 1}
                    className="text-slate-400 hover:text-slate-700 disabled:opacity-30"
                    aria-label="Move down"
                  >
                    <ChevronDown size={14} />
                  </button>
                </div>
                <input
                  value={entry.label}
                  onChange={(e) => patchEntry(entry.id, { label: e.target.value })}
                  className="flex-1 rounded border border-slate-200 px-2 py-1 text-sm"
                  placeholder="Label"
                />
                <input
                  value={entry.subtitle ?? ''}
                  onChange={(e) => patchEntry(entry.id, { subtitle: e.target.value })}
                  className="w-32 rounded border border-slate-200 px-2 py-1 text-xs text-slate-500"
                  placeholder="Subtitle"
                />
                <button
                  onClick={(e) => { e.stopPropagation(); setExpandedId(open ? null : entry.id) }}
                  className={`rounded p-1.5 ${open ? 'bg-galli/10 text-galli' : 'text-slate-400 hover:bg-slate-100'}`}
                  aria-label="Edit details"
                >
                  <Settings2 size={14} />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); removeEntry(entry.id) }}
                  className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500"
                  aria-label="Delete entry"
                >
                  <Trash2 size={14} />
                </button>
              </div>

              {open && (
                <div className="space-y-2 border-t border-slate-100 bg-slate-50 p-3">
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      value={entry.linkUrl ?? ''}
                      onChange={(e) => patchEntry(entry.id, { linkUrl: e.target.value })}
                      className="rounded border border-slate-200 px-2 py-1 text-xs"
                      placeholder="Link URL (https://… or /path)"
                    />
                    <input
                      value={entry.category ?? ''}
                      onChange={(e) => patchEntry(entry.id, { category: e.target.value })}
                      className="rounded border border-slate-200 px-2 py-1 text-xs"
                      placeholder="Category (group)"
                    />
                    <input
                      value={entry.image ?? ''}
                      onChange={(e) => patchEntry(entry.id, { image: e.target.value })}
                      className="rounded border border-slate-200 px-2 py-1 text-xs"
                      placeholder="Image URL (optional)"
                    />
                    <input
                      value={(entry.tags ?? []).join(', ')}
                      onChange={(e) =>
                        patchEntry(entry.id, {
                          tags: e.target.value.split(',').map((t) => t.trim()).filter(Boolean),
                        })
                      }
                      className="rounded border border-slate-200 px-2 py-1 text-xs"
                      placeholder="Tags (comma-separated)"
                    />
                  </div>
                  <textarea
                    value={entry.note ?? ''}
                    onChange={(e) => patchEntry(entry.id, { note: e.target.value })}
                    className="w-full rounded border border-slate-200 px-2 py-1 text-xs"
                    rows={2}
                    placeholder="Note / description (shown when expanded)"
                  />
                  {/* Meta pairs (cap 4) */}
                  <div className="space-y-1.5">
                    {(entry.meta ?? []).map((m, mi) => (
                      <div key={mi} className="flex items-center gap-2">
                        <input
                          value={m.key}
                          onChange={(e) => {
                            const meta = [...(entry.meta ?? [])]
                            meta[mi] = { ...meta[mi], key: e.target.value }
                            setMeta(entry.id, meta)
                          }}
                          className="w-28 rounded border border-slate-200 px-2 py-1 text-xs"
                          placeholder="Field"
                        />
                        <input
                          value={m.value}
                          onChange={(e) => {
                            const meta = [...(entry.meta ?? [])]
                            meta[mi] = { ...meta[mi], value: e.target.value }
                            setMeta(entry.id, meta)
                          }}
                          className="flex-1 rounded border border-slate-200 px-2 py-1 text-xs"
                          placeholder="Value"
                        />
                        <button
                          onClick={() => setMeta(entry.id, (entry.meta ?? []).filter((_, x) => x !== mi))}
                          className="rounded p-1 text-slate-400 hover:text-red-500"
                          aria-label="Remove field"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                    {(entry.meta ?? []).length < 4 && (
                      <button
                        onClick={() => setMeta(entry.id, [...(entry.meta ?? []), { key: '', value: '' }])}
                        className="text-xs font-medium text-galli hover:underline"
                      >
                        + Add field
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <button
        onClick={(e) => { e.stopPropagation(); addEntry() }}
        className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-300 py-2 text-sm font-medium text-slate-500 hover:border-galli hover:text-galli"
      >
        <Plus size={16} /> Add entry
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/elements/IndexElement.tsx
git commit -m "feat(index): add Index editor component"
```

---

## Task 4: Public component (`PublicIndexElement.tsx`)

**Files:**
- Create: `src/components/elements/PublicIndexElement.tsx`

**Interfaces:**
- Consumes: `CanvasElement` from `@/lib/types/canvas`; `filterEntries`, `groupByCategory`, `displayNumber` from `@/lib/index-element`; `safeHref` from `@/lib/editor/safe-href`.
- Produces: `export function PublicIndexElement({ element })`.

- [ ] **Step 1: Write the component**

Create `src/components/elements/PublicIndexElement.tsx`:

```tsx
'use client'

import { useMemo, useState } from 'react'
import { Search, ChevronRight, ChevronLeft, List as ListIcon, LayoutGrid, ExternalLink } from 'lucide-react'
import type { CanvasElement, IndexEntry } from '@/lib/types/canvas'
import { filterEntries, groupByCategory, displayNumber } from '@/lib/index-element'
import { safeHref } from '@/lib/editor/safe-href'

interface Props {
  element: CanvasElement
}

function hasDetail(e: IndexEntry): boolean {
  return Boolean(e.note || (e.meta && e.meta.length) || (e.tags && e.tags.length) || e.image)
}

export function PublicIndexElement({ element }: Props) {
  const accent = element.indexAccent || '#39D98A'
  const numbers = element.indexEnableNumbers ?? true
  const showSearch = element.indexEnableSearch ?? true
  const allEntries = element.indexEntries ?? []

  const [view, setView] = useState<'list' | 'cards'>(element.indexView ?? 'list')
  const [query, setQuery] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [cardIndex, setCardIndex] = useState(0)

  const filtered = useMemo(() => filterEntries(allEntries, query), [allEntries, query])

  if (allEntries.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-400">
        No entries yet.
      </div>
    )
  }

  const clampedIndex = Math.min(cardIndex, Math.max(0, filtered.length - 1))
  const groups = groupByCategory(filtered)

  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <div className="flex items-center gap-2">
          {element.indexIcon && <span className="text-lg leading-none">{element.indexIcon}</span>}
          <h3 className="text-sm font-semibold text-slate-800">{element.indexTitle || 'Index'}</h3>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
            {allEntries.length}
          </span>
        </div>
        <div className="flex overflow-hidden rounded-lg border border-slate-200">
          <button
            onClick={() => setView('list')}
            className={`p-1.5 ${view === 'list' ? 'text-white' : 'text-slate-400 hover:text-slate-600'}`}
            style={view === 'list' ? { backgroundColor: accent } : undefined}
            aria-label="List view"
          >
            <ListIcon size={15} />
          </button>
          <button
            onClick={() => setView('cards')}
            className={`p-1.5 ${view === 'cards' ? 'text-white' : 'text-slate-400 hover:text-slate-600'}`}
            style={view === 'cards' ? { backgroundColor: accent } : undefined}
            aria-label="Cards view"
          >
            <LayoutGrid size={15} />
          </button>
        </div>
      </div>

      {/* Search */}
      {showSearch && (
        <div className="border-b border-slate-100 px-4 py-2">
          <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-2.5 py-1.5">
            <Search size={14} className="text-slate-400" />
            <input
              value={query}
              onChange={(e) => { setQuery(e.target.value); setCardIndex(0) }}
              className="w-full bg-transparent text-sm outline-none"
              placeholder="Search…"
            />
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="p-6 text-center text-sm text-slate-400">No matches.</div>
      ) : view === 'list' ? (
        /* LIST VIEW */
        <div>
          {groups.map((group) => (
            <div key={group.category || '__ungrouped__'}>
              {group.category && (
                <div className="bg-slate-50 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  {group.category}
                </div>
              )}
              {group.entries.map((entry) => {
                const globalIndex = filtered.indexOf(entry)
                const href = safeHref(entry.linkUrl)
                const detail = hasDetail(entry)
                const open = expanded === entry.id
                return (
                  <div key={entry.id} className="border-b border-slate-50 last:border-b-0">
                    <div
                      className={`flex items-center gap-3 px-4 py-2.5 ${detail ? 'cursor-pointer hover:bg-slate-50' : ''}`}
                      onClick={detail ? () => setExpanded(open ? null : entry.id) : undefined}
                    >
                      {numbers && (
                        <span className="shrink-0 font-mono text-xs text-slate-300">
                          {displayNumber(globalIndex)}
                        </span>
                      )}
                      {entry.image && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={entry.image} alt="" className="h-8 w-8 shrink-0 rounded object-cover" />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-slate-800">{entry.label}</div>
                        {entry.subtitle && <div className="truncate text-xs text-slate-400">{entry.subtitle}</div>}
                      </div>
                      {href && (
                        <a
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer nofollow"
                          onClick={(e) => e.stopPropagation()}
                          className="shrink-0 text-slate-300 hover:text-slate-600"
                          style={{ color: accent }}
                          aria-label="Open link"
                        >
                          <ChevronRight size={16} />
                        </a>
                      )}
                    </div>
                    {open && detail && (
                      <div className="space-y-2 bg-slate-50 px-4 pb-3 pl-11 text-xs text-slate-600">
                        {entry.note && <p>{entry.note}</p>}
                        {entry.meta && entry.meta.length > 0 && (
                          <div className="flex flex-wrap gap-x-4 gap-y-1">
                            {entry.meta.map((m, i) => (
                              <span key={i}>
                                <span className="text-slate-400">{m.key}:</span> {m.value}
                              </span>
                            ))}
                          </div>
                        )}
                        {entry.tags && entry.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {entry.tags.map((t) => (
                              <span key={t} className="rounded-full bg-white px-2 py-0.5 text-[11px] text-slate-500">
                                #{t}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      ) : (
        /* CARDS VIEW */
        <div className="p-4">
          {(() => {
            const entry = filtered[clampedIndex]
            const href = safeHref(entry.linkUrl)
            return (
              <div className="rounded-xl border border-slate-200 p-4" style={{ borderTopColor: accent, borderTopWidth: 3 }}>
                <div className="mb-2 flex items-center gap-2">
                  {numbers && <span className="font-mono text-xs text-slate-300">{displayNumber(clampedIndex)}</span>}
                  {entry.category && <span className="text-xs font-semibold uppercase text-slate-400">{entry.category}</span>}
                </div>
                {entry.image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={entry.image} alt="" className="mb-3 h-32 w-full rounded-lg object-cover" />
                )}
                <div className="text-lg font-semibold text-slate-800">{entry.label}</div>
                {entry.subtitle && <div className="text-sm text-slate-400">{entry.subtitle}</div>}
                {entry.note && <p className="mt-2 text-sm text-slate-600">{entry.note}</p>}
                {entry.meta && entry.meta.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
                    {entry.meta.map((m, i) => (
                      <span key={i}><span className="text-slate-400">{m.key}:</span> {m.value}</span>
                    ))}
                  </div>
                )}
                {entry.tags && entry.tags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {entry.tags.map((t) => (
                      <span key={t} className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500">#{t}</span>
                    ))}
                  </div>
                )}
                {href && (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="mt-3 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-white"
                    style={{ backgroundColor: accent }}
                  >
                    Open <ExternalLink size={14} />
                  </a>
                )}
              </div>
            )
          })()}

          <div className="mt-3 flex items-center justify-between">
            <button
              onClick={() => setCardIndex((i) => Math.max(0, i - 1))}
              disabled={clampedIndex === 0}
              className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 disabled:opacity-40"
            >
              <ChevronLeft size={15} /> Prev
            </button>
            <span className="text-xs text-slate-400">
              {clampedIndex + 1} / {filtered.length}
            </span>
            <button
              onClick={() => setCardIndex((i) => Math.min(filtered.length - 1, i + 1))}
              disabled={clampedIndex >= filtered.length - 1}
              className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 disabled:opacity-40"
            >
              Next <ChevronRight size={15} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Lint the two new components (catches the img-element rule early)**

Run: `pnpm exec next lint --file src/components/elements/PublicIndexElement.tsx --file src/components/elements/IndexElement.tsx`
Expected: no errors. (The `img` tags carry `eslint-disable-next-line @next/next/no-img-element`; if the runner rejects `--file`, run the full `pnpm exec next lint` in Task 5 instead.)

- [ ] **Step 4: Commit**

```bash
git add src/components/elements/PublicIndexElement.tsx
git commit -m "feat(index): add Index public component (list + cards)"
```

---

## Task 5: Wire the seams (menu, canvas, exports, public render)

**Files:**
- Modify: `src/components/elements/index.ts`
- Modify: `src/components/canvas/SlashCommandMenu.tsx`
- Modify: `src/components/canvas/ColumnCanvas.tsx`
- Modify: `src/lib/render-elements.tsx`

**Interfaces:**
- Consumes: `IndexElement`, `PublicIndexElement` from Tasks 3–4.
- Produces: `'index'` reachable from the slash menu, editor canvas, preview, and public/share render paths.

- [ ] **Step 1: Export both components**

In `src/components/elements/index.ts`, add near the `ProductListElement` exports:

```ts
export { IndexElement } from './IndexElement'
export { PublicIndexElement } from './PublicIndexElement'
```

- [ ] **Step 2: Add the slash-menu entry**

In `src/components/canvas/SlashCommandMenu.tsx`:
1. Add `LibraryBig` to the existing `lucide-react` import.
2. In the command list, in the `Content` category block (after the `timeline` entry, ~line 84), add:

```ts
  { id: 'index', label: 'Index', icon: LibraryBig, description: 'Scannable catalog of linked items', category: 'Content' },
```

- [ ] **Step 3: Wire ColumnCanvas**

In `src/components/canvas/ColumnCanvas.tsx`:
1. Add imports near the `ProductListElement` imports (~line 121):

```ts
import { IndexElement } from '@/components/elements/IndexElement'
import { PublicIndexElement } from '@/components/elements/PublicIndexElement'
```

2. In `renderElement`, add a case after the `product-list` case (~line 864):

```tsx
      case 'index':
        if (isPreviewMode) {
          return <PublicIndexElement element={element} />
        }
        return (
          <IndexElement
            element={element}
            onChange={(updates) => onUpdateElement(sectionId, columnId, element.id, updates)}
            onDelete={() => onDeleteElement(sectionId, columnId, element.id)}
            isSelected={commonProps.isSelected}
            onSelect={commonProps.onSelect}
          />
        )
```

- [ ] **Step 4: Wire the public render map**

In `src/lib/render-elements.tsx`:
1. Add the import near the `PublicProductListElement` import (~line 64):

```ts
import { PublicIndexElement } from '@/components/elements/PublicIndexElement'
```

2. Add a case after the `product-list` case (~line 440):

```tsx
    case 'index':
      return <PublicIndexElement element={element} />
```

- [ ] **Step 5: Typecheck**

Run: `pnpm tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Run the full test suite**

Run: `pnpm test`
Expected: all pass (existing suite + the new `index-element.test.ts`).

- [ ] **Step 7: Lint**

Run: `pnpm exec next lint`
Expected: no errors (specifically no `no-html-link-for-pages`, `no-img-element`, or `react/no-unescaped-entities` from the new files).

- [ ] **Step 8: Commit**

```bash
git add src/components/elements/index.ts src/components/canvas/SlashCommandMenu.tsx src/components/canvas/ColumnCanvas.tsx src/lib/render-elements.tsx
git commit -m "feat(index): wire Index element into slash menu, canvas, and public render"
```

---

## Task 6: Manual verification & finish

**Files:** none (verification only)

- [ ] **Step 1: Build sanity (optional but recommended)**

Stop any running `pnpm dev` first (Windows `.next` race). Run in the worktree:
`pnpm build`
Expected: build succeeds. If a stale-Prisma or dev-race error appears, rely on `tsc --noEmit` + `pnpm test` + `next lint` (all green from Task 5).

- [ ] **Step 2: Browser smoke (documented, not assumed)**

With the correct DB env (`export DATABASE_URL="postgresql://pages:pages@127.0.0.1:5434/pages"`), start `pnpm dev`, then in the editor:
1. `/` → Content → **Index** inserts the element with 2 seed entries.
2. Add an entry, set a category on two entries, add tags + a note + a link.
3. Public preview: verify group headers, auto-numbering (`001`…), search filtering, expand-on-click, and the List/Cards toggle (prev/next deck).
4. Publish and load the public page; confirm the same render via `render-elements.tsx`.

Record actual results (pass/fail per step). Do not claim success without observing it.

- [ ] **Step 3: Finish the branch**

Invoke `superpowers:finishing-a-development-branch` to open the PR (base `main`). PR body should note: free element, JSON-only (no migration), no SSRF surface, suite green, lint clean.

---

## Self-Review notes

- **Spec coverage:** types+default (Task 1) ✔; helpers filter/group/number (Task 2) ✔; editor with entries/meta/tags/reorder (Task 3) ✔; public list+cards+search+groups+numbers+expand (Task 4) ✔; 7 seams (Tasks 1,3,4,5) ✔; free + Content category (Task 5, Global Constraints) ✔; TDD helper + full-suite + lint (Tasks 2,5) ✔; safeHref on every link (Task 4) ✔.
- **Type consistency:** `filterEntries`/`groupByCategory`/`displayNumber`/`newEntryId` signatures match between Task 2 definition and Task 3/4 usage. `indexView` union `'list'|'cards'` consistent across types, editor, public. Component export names (`IndexElement`, `PublicIndexElement`) consistent across Tasks 3–5.
- **No placeholders:** every code step shows complete code; no TBD/TODO.
- **Image note:** public component uses raw `<img>` with an inline `eslint-disable` for `@next/next/no-img-element` (entry images can be arbitrary allowlisted hosts; matches how other gallery-style elements render user image URLs). Verified against the lint gate in Task 5 Step 7.
