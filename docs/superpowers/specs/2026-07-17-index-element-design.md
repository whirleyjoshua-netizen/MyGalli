# Index element — design

**Date:** 2026-07-17
**Branch/worktree:** `feat/index-element` @ `C:/Users/whirl/pages-mvp-index` (off `origin/main`)
**Status:** approved design → pending implementation plan

## Summary

A new **free**, JSON-only canvas element (`type: 'index'`): a scannable,
auto-numbered **catalog of connected items**. It renders as either a vertical
list or a flip-through card deck, with expandable entries, category grouping,
and a live filter box. All data lives in the element JSON (no DB, no API),
exactly like `flowchart`, `product-list`, and `link-hub`.

The visual metaphor is a Rolodex; the capability is **structured knowledge** —
one component that powers citations, directories, reading lists, resource
collections, bookmarks, partner lists, etc.

### Why this element (positioning)

My Galli already ships ~80 elements. Two of the four styles from the original
brief overlap existing elements and are therefore **out of scope**:

- **Timeline Index** → the existing `timeline` element already covers this.
- **Constellation Index** → the existing `flowchart` element is already the
  node-graph concept.

The genuinely new capability is the **catalog**: a numbered, filterable,
groupable, clickable index of items. That is what v1 delivers.

## Decisions (locked with user)

| Question | Decision |
|---|---|
| v1 visual form | **Both** — vertical list (default) **and** a card-flip view, one dataset, visitor-side toggle |
| Entry depth | **One flexible schema, expand-on-click** — compact by default, expandable detail |
| Navigation affordances | **Category groups + live search/filter + auto-numbering** (all three) |
| Pricing | **Free** (like link-hub / product-list / flowchart / timeline) |
| Slash category | **Content** (alongside text, heading, quote, callout, toggle, timeline) |

## Data model

Added to `src/lib/types/canvas.ts`.

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
  meta?: { key: string; value: string }[]  // up to ~4 freeform pairs (e.g. Author: NASA)
  tags?: string[]     // chips; also searchable
}
```

Fields added to the `CanvasElement` interface:

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

`ElementType` union gains `| 'index'`.

`createElement('index')` default:

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

(Note: entry ids seeded here reuse `Date.now()` with distinct suffixes — same
pattern as `flowchart`'s seeded node id. New entries added in the editor use the
`newEntryId()` factory below for full uniqueness.)

## The 7 element seams

Adding an element type touches these seams (per project convention):

1. **`src/lib/types/canvas.ts`** — `IndexEntry` interface + `ElementType` union
   member + `CanvasElement` fields + `createElement('index')` default. **Single
   source of default** — no `PageEditor` edit needed.
2. **`src/components/elements/IndexElement.tsx`** — editor component.
3. **`src/components/elements/PublicIndexElement.tsx`** — public component.
4. **`src/components/canvas/SlashCommandMenu.tsx`** — menu entry under `Content`.
5. **`src/components/canvas/ColumnCanvas.tsx`** — `renderElement`: preview →
   Public component, else editor component.
6. **`src/components/elements/index.ts`** — export both components.
7. **`src/components/canvas/render-elements.tsx`** — public render mapping
   (share `/s/[code]` + SSR public page paths).

Exact file locations for seams 5–7 will be confirmed against the current tree
during implementation; the pattern above matches how `flowchart` and
`product-list` are wired.

## Editor component behavior (`IndexElement.tsx`)

Props: `{ element, onChange, onDelete, isSelected, onSelect }` (standard editor
contract).

Controls:
- Header: title text, icon (emoji) field, accent color.
- Toggles: default view (`list` / `cards`), enable search, enable numbers.
- Entries list: add entry, delete entry, reorder (up/down buttons — no drag in
  v1, matching flowchart's no-drag approach), and per-entry edit of:
  label, subtitle, link (via a link field), category, image, note, meta pairs
  (add/remove, capped ~4), tags.
- Each entry row is collapsible in the editor so long catalogs stay manageable.

## Public component behavior (`PublicIndexElement.tsx`)

Props: `{ element }`.

- Renders a header (icon + title) with the accent color.
- **View toggle** (`☰ List` / `▭ Cards`) shown when there are entries; initial
  mode from `indexView`. Purely client-side visitor state.
- **Live search box** (when `indexEnableSearch`): filters entries by
  label/subtitle/tags as the visitor types, via `filterEntries`.
- **List view:** entries grouped by category (headers) when any category is set;
  each row shows `[number] label / subtitle → `; clicking a row with detail
  (note/meta/tags/image) expands it inline. `linkUrl` opens via `safeHref`.
- **Cards view:** one card at a time with prev/next controls; card shows number,
  label, subtitle, image, and detail; link is a button. Search + category
  grouping still narrow the deck.
- **Auto-numbering** (when `indexEnableNumbers`): `displayNumber(i)` → `001`,
  based on filtered display order.
- Empty state when no entries.

All links pass through the existing `safe-href.ts`; images rely on the existing
Next/CSP image-host allowlist. No server fetch → **no SSRF surface** (unlike
`product-list`, the owner types URLs directly; nothing is fetched server-side).

## Pure helper (TDD)

`src/lib/index-element.ts` — DB-free, unit-tested (mirrors
`flowchart-layout.ts` / `link-preview.ts`):

```ts
export function filterEntries(entries: IndexEntry[], query: string): IndexEntry[]
export function groupByCategory(entries: IndexEntry[]): { category: string; entries: IndexEntry[] }[]
export function displayNumber(index: number): string   // 0 -> "001"
export function newEntryId(): string                    // "idx-<ts>-<rand>"
```

- `filterEntries`: case-insensitive match against label, subtitle, and tags;
  empty/whitespace query returns all entries (stable order).
- `groupByCategory`: preserves entry order; ungrouped entries (`''`/undefined)
  fall under a single implicit group rendered without a header. Groups appear in
  first-seen order.
- `displayNumber`: 1-based, zero-padded to 3 digits (`001`), plain number beyond
  999.

`newEntryId` uses `Date.now()` + random — acceptable in the editor (client
runtime); the pure test file exercises the deterministic functions.

## Testing

- **Unit:** `src/lib/index-element.test.ts` — filter (match/no-match/empty/tags),
  group (ordering, ungrouped bucket), number (padding, >999).
- `pnpm tsc --noEmit` clean.
- Full `pnpm test` suite green.
- `pnpm exec next lint` clean before any deploy (lint runs in `next build` but
  **not** in `tsc` — a known deploy-breaker in this repo; watch
  `no-html-link-for-pages` and `react/no-unescaped-entities`).
- Manual/browser smoke: insert element, add entries, toggle views, search,
  publish, verify public render (deferred to implementation; noted, not assumed).

## Out of scope for v1 (future)

- **Timeline / Constellation styles** — overlap existing `timeline` / `flowchart`.
- **Nesting inside a "Portal"** — no Portal element exists yet.
- **Drag-to-reorder across categories** — v1 uses up/down buttons.
- **Server-side or AI-assisted entry enrichment** (auto-fill from URL like
  product-list's link-preview) — deliberately excluded to keep zero SSRF surface.

## Isolation / integration

Built entirely in the `feat/index-element` worktree
(`C:/Users/whirl/pages-mvp-index`), off `origin/main`. Committed there and
finished via PR — the active `feat/community-entity` checkout and other
concurrent worktrees are untouched. (Per the shared-worktree hazard: verify
branch before every commit/push.)
