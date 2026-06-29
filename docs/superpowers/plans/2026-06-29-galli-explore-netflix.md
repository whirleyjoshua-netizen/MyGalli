# Galli Categorized Explore — Sub-project B (Netflix-style UI)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`).

**Goal:** Replace Explore's single filtered grid with a Netflix-style browse: a Trending row, a horizontal row per category, category chips, search, and a full per-category grid — all cover-forward.

**Architecture:** A shared `getExploreRows()` (used by both a new `/api/explore/rows` route and the Explore page server component) returns Trending + per-category rows. `ExploreClient` is rebuilt to switch between three modes — **rows** (default), **category grid**, **search grid** — reusing `ScrollRow` and a new cover-forward `ExploreRowCard`. The kit filter is removed.

**Tech Stack:** Next.js 14 App Router, TypeScript, Prisma + PostgreSQL, lucide-react, Tailwind.

## Global Constraints

- **Default view = rows:** a **Trending** row (most-viewed) + **one horizontal row per non-empty category**, with **category chips** to jump/filter; clicking a chip/row → **full grid** for that category; **search** → results grid. (`GET /api/explore?category=&search=` already supports the grids from Sub-project A.)
- **Cover-forward cards** use `display.coverImage` (set at publish), gradient + title fallback. Kit badge dropped. Profile-canvas displays already excluded (`kind != 'profile'`).
- **Kits are creation-side only** — remove the Explore kit filter UI entirely.
- Verify: `pnpm exec tsc --noEmit`, `pnpm test`. **Don't run `pnpm build` while a dev server runs** (`.next` race); rely on tsc + tests + live render, or stop the server first. No migration in this sub-project.

---

### Task 1: getExploreRows + /api/explore/rows

**Files:** Create `src/lib/explore.ts`, `src/app/api/explore/rows/route.ts`.

**Interfaces:**
- `ExploreRowItem = { id; slug; title; coverImage: string | null; views: number; category: string | null; user: { username; name: string | null; avatar: string | null } }`
- `getExploreRows(): Promise<{ trending: ExploreRowItem[]; categories: { id: string; label: string; displays: ExploreRowItem[] }[] }>` — categories with zero displays are omitted.
- `GET /api/explore/rows` → that object.

- [ ] **Step 1: Implement the shared builder**
```ts
// src/lib/explore.ts
import { db } from './db'
import { CATEGORIES } from './categories'

export interface ExploreRowItem {
  id: string
  slug: string
  title: string
  coverImage: string | null
  views: number
  category: string | null
  user: { username: string; name: string | null; avatar: string | null }
}

const CARD_SELECT = {
  id: true, slug: true, title: true, coverImage: true, views: true, category: true,
  user: { select: { username: true, name: true, avatar: true } },
} as const

const ROW_LIMIT = 12

export async function getExploreRows(): Promise<{
  trending: ExploreRowItem[]
  categories: { id: string; label: string; displays: ExploreRowItem[] }[]
}> {
  const baseWhere = { published: true, kind: { not: 'profile' } }
  const trending = await db.display.findMany({ where: baseWhere, orderBy: { views: 'desc' }, take: ROW_LIMIT, select: CARD_SELECT })
  const categories = await Promise.all(
    CATEGORIES.map(async (c) => ({
      id: c.id,
      label: c.label,
      displays: await db.display.findMany({ where: { ...baseWhere, category: c.id }, orderBy: { createdAt: 'desc' }, take: ROW_LIMIT, select: CARD_SELECT }),
    })),
  )
  return { trending, categories: categories.filter((c) => c.displays.length > 0) }
}
```

- [ ] **Step 2: Route**
```ts
// src/app/api/explore/rows/route.ts
import { NextResponse } from 'next/server'
import { getExploreRows } from '@/lib/explore'

export async function GET() {
  try {
    return NextResponse.json(await getExploreRows())
  } catch (e) {
    console.error('Explore rows error:', e)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
```

- [ ] **Step 3: tsc + curl smoke** — publish a couple of pages in different categories (or reuse existing), then `GET /api/explore/rows` returns `{ trending: [...], categories: [{ id, label, displays: [...] }] }` with only non-empty categories.
- [ ] **Step 4: Commit**
```bash
git add src/lib/explore.ts src/app/api/explore/rows/route.ts
git commit -m "feat(explore): getExploreRows + /api/explore/rows endpoint"
```

---

### Task 2: ExploreRowCard + ExploreCategoryChips

**Files:** Create `src/components/explore/ExploreRowCard.tsx`, `src/components/explore/ExploreCategoryChips.tsx`.

**Interfaces:**
- `<ExploreRowCard item: ExploreRowItem; index: number; size?: 'row' | 'grid' />` — cover-forward card linking to `/${item.user.username}/${item.slug}`.
- `<ExploreCategoryChips active: string | null; onSelect: (id: string | null) => void />` — an "All" chip + one chip per category (icon + label), highlighting `active`.

- [ ] **Step 1: ExploreRowCard** (client) — cover image (or gradient), title + author overlaid at the bottom, view count; `w-64` in row mode, full-width in grid mode. Reuse the gradient list pattern from the existing `FeedCard`. Drop the kit badge.
```tsx
// src/components/explore/ExploreRowCard.tsx
'use client'
import { Eye, Globe } from 'lucide-react'
import type { ExploreRowItem } from '@/lib/explore'

const GRADIENTS = ['from-galli/20 via-galli-aqua/10 to-galli-violet/10', 'from-galli-aqua/20 via-galli-violet/10 to-galli/10', 'from-galli-violet/20 via-galli/10 to-galli-aqua/10']

export function ExploreRowCard({ item, index, size = 'row' }: { item: ExploreRowItem; index: number; size?: 'row' | 'grid' }) {
  const author = item.user.name || item.user.username
  return (
    <a href={`/${item.user.username}/${item.slug}`}
      className={`group relative ${size === 'row' ? 'shrink-0 w-64 snap-start' : 'w-full'} rounded-2xl border border-border bg-surface overflow-hidden shadow-soft hover:shadow-soft-lg hover:border-primary/30 transition-all cursor-pointer`}>
      <div className={`relative ${size === 'row' ? 'h-40' : 'h-44'} ${item.coverImage ? '' : `bg-gradient-to-br ${GRADIENTS[index % GRADIENTS.length]}`}`}>
        {item.coverImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.coverImage} alt="" className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
        )}
        {item.views > 0 && (
          <span className="absolute top-2.5 right-2.5 inline-flex items-center gap-1 rounded-full bg-black/50 text-white text-xs px-2 py-0.5 backdrop-blur-sm">
            <Eye className="w-3 h-3" /> {item.views.toLocaleString()}
          </span>
        )}
        <div className="absolute bottom-0 inset-x-0 h-16 bg-gradient-to-t from-black/55 to-transparent" />
        <div className="absolute bottom-2.5 left-3 right-3">
          <h3 className="text-white font-semibold text-sm truncate drop-shadow">{item.title}</h3>
          <p className="flex items-center gap-1 text-white/80 text-xs truncate"><Globe className="w-3 h-3" /> by {author}</p>
        </div>
      </div>
    </a>
  )
}
```

- [ ] **Step 2: ExploreCategoryChips** (client) — uses `CATEGORIES`; resolve each `icon` string from a small lucide map (`Trophy, Palette, Briefcase, Store, User, PartyPopper, GraduationCap, Sparkles`). "All" chip sets `null`.
```tsx
// src/components/explore/ExploreCategoryChips.tsx
'use client'
import { Trophy, Palette, Briefcase, Store, User, PartyPopper, GraduationCap, Sparkles, LayoutGrid } from 'lucide-react'
import { CATEGORIES } from '@/lib/categories'

const ICONS: Record<string, typeof Trophy> = { Trophy, Palette, Briefcase, Store, User, PartyPopper, GraduationCap, Sparkles }

export function ExploreCategoryChips({ active, onSelect }: { active: string | null; onSelect: (id: string | null) => void }) {
  const chip = (selected: boolean) =>
    `inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors cursor-pointer border ${selected ? 'bg-primary text-primary-foreground border-primary' : 'bg-surface text-muted-foreground border-border hover:bg-muted'}`
  return (
    <div className="flex gap-2 overflow-x-auto scrollbar-hide py-1">
      <button onClick={() => onSelect(null)} className={chip(active === null)}><LayoutGrid className="w-4 h-4" /> All</button>
      {CATEGORIES.map((c) => {
        const Icon = ICONS[c.icon] ?? Sparkles
        return (
          <button key={c.id} onClick={() => onSelect(c.id)} className={chip(active === c.id)}>
            <Icon className="w-4 h-4" /> {c.label}
          </button>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 3: tsc + commit**
```bash
git add src/components/explore/ExploreRowCard.tsx src/components/explore/ExploreCategoryChips.tsx
git commit -m "feat(explore): cover-forward row card + category chips"
```

---

### Task 3: ExploreClient rebuild + page wiring

**Files:** Rewrite `src/components/explore/ExploreClient.tsx`; modify `src/app/explore/page.tsx` (fetch rows via `getExploreRows`, pass as `initialRows`); the old `ExploreCard.tsx` is no longer imported (leave the file; it's unused).

**Interfaces:** `ExploreClient` props become `{ initialRows: { trending: ExploreRowItem[]; categories: { id; label; displays: ExploreRowItem[] }[] } }`. Consumes `ScrollRow`, `ExploreRowCard`, `ExploreCategoryChips`, `GET /api/explore?category=&search=`.

- [ ] **Step 1: Page server component** — replace `ExploreContent` to fetch rows:
```tsx
// in src/app/explore/page.tsx — replace the ExploreContent body
import { getExploreRows } from '@/lib/explore'

async function ExploreContent() {
  const initialRows = await getExploreRows()
  return <ExploreClient initialRows={initialRows} />
}
```
Remove the now-unused `PAGE_SIZE`/`db` imports there if they become unused (keep `Suspense`, `ExploreCardSkeleton` for the loading shell, `Metadata`). Update the `ExploreClient` import usage accordingly.

- [ ] **Step 2: Rewrite `ExploreClient`** — three modes:
```tsx
// src/components/explore/ExploreClient.tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { Search, X, Compass, Loader2 } from 'lucide-react'
import { Wordmark } from '@/components/brand/Wordmark'
import { ScrollRow } from '@/components/dashboard/ScrollRow'
import { ExploreRowCard } from './ExploreRowCard'
import { ExploreCategoryChips } from './ExploreCategoryChips'
import { categoryLabel } from '@/lib/categories'
import type { ExploreRowItem } from '@/lib/explore'

interface Rows { trending: ExploreRowItem[]; categories: { id: string; label: string; displays: ExploreRowItem[] }[] }

export function ExploreClient({ initialRows }: { initialRows: Rows }) {
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [grid, setGrid] = useState<ExploreRowItem[]>([])
  const [loading, setLoading] = useState(false)
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  const inGridMode = activeCategory !== null || search.trim().length > 0

  // Fetch the grid when a category or search is active
  useEffect(() => {
    if (!inGridMode) { setGrid([]); return }
    setLoading(true)
    const params = new URLSearchParams({ limit: '24' })
    if (activeCategory) params.set('category', activeCategory)
    if (search.trim()) params.set('search', search.trim())
    const run = () =>
      fetch(`/api/explore?${params.toString()}`)
        .then((r) => (r.ok ? r.json() : { displays: [] }))
        .then((d) => setGrid(Array.isArray(d.displays) ? d.displays : []))
        .catch(() => setGrid([]))
        .finally(() => setLoading(false))
    if (debounce.current) clearTimeout(debounce.current)
    debounce.current = setTimeout(run, search.trim() ? 300 : 0)
    return () => { if (debounce.current) clearTimeout(debounce.current) }
  }, [activeCategory, search, inGridMode])

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-surface/60 backdrop-blur sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-4">
          <a href="/dashboard" className="text-xl"><Wordmark /></a>
          <div className="flex-1 flex items-center gap-2 px-3.5 h-10 rounded-full border border-border bg-surface max-w-md">
            <Search className="w-4 h-4 text-muted-foreground shrink-0" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search Galli pages…" className="bg-transparent outline-none text-sm w-full" />
            {search && <button onClick={() => setSearch('')} aria-label="Clear"><X className="w-4 h-4 text-muted-foreground" /></button>}
          </div>
        </div>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 pb-2">
          <ExploreCategoryChips active={activeCategory} onSelect={(id) => { setActiveCategory(id); setSearch('') }} />
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        {inGridMode ? (
          <>
            <h2 className="text-lg font-bold mb-4">
              {search.trim() ? `Results for "${search.trim()}"` : categoryLabel(activeCategory!)}
            </h2>
            {loading ? (
              <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 text-primary animate-spin" /></div>
            ) : grid.length === 0 ? (
              <p className="text-center text-muted-foreground py-20">No pages found.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {grid.map((item, i) => <ExploreRowCard key={item.id} item={item} index={i} size="grid" />)}
              </div>
            )}
          </>
        ) : (
          <>
            {initialRows.trending.length > 0 && (
              <ScrollRow title="Trending" subtitle="Most-viewed pages right now." icon={<Compass className="w-4 h-4" />}>
                {initialRows.trending.map((item, i) => <ExploreRowCard key={item.id} item={item} index={i} />)}
              </ScrollRow>
            )}
            {initialRows.categories.map((cat) => (
              <ScrollRow key={cat.id} title={cat.label} action={<button onClick={() => setActiveCategory(cat.id)} className="text-xs font-medium text-primary hover:underline cursor-pointer mr-1">See all</button>}>
                {cat.displays.map((item, i) => <ExploreRowCard key={item.id} item={item} index={i} />)}
              </ScrollRow>
            ))}
            {initialRows.trending.length === 0 && initialRows.categories.length === 0 && (
              <p className="text-center text-muted-foreground py-20">No public pages yet — be the first to publish one!</p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
```
(`ScrollRow`'s `subtitle`/`action` props already exist; the chips' `onSelect` clears search so the two modes don't fight.)

- [ ] **Step 3: tsc + manual check** — `/explore` default shows Trending + per-category rows; a chip switches to that category's grid; "See all" on a row does the same; search shows a results grid; clearing returns to rows. No kit filter remains.
- [ ] **Step 4: Commit**
```bash
git add src/components/explore/ExploreClient.tsx "src/app/explore/page.tsx"
git commit -m "feat(explore): Netflix-style rows/category/search Explore"
```

---

## Self-Review

**Spec coverage (Sub-project B):**
- `GET /api/explore/rows` returning `{trending, categories:[{id,label,displays}]}` → Task 1. ✅
- Default rows view (Trending + per-category, non-empty only) → Task 1 (data) + Task 3 (render). ✅
- Category chips jump/filter → Task 2 (`ExploreCategoryChips`) + Task 3 (wiring). ✅
- Click category / "See all" → full grid via `/api/explore?category=` → Task 3. ✅
- Search → results grid via `/api/explore?search=` → Task 3. ✅
- Cover-forward cards, kit badge dropped → Task 2 (`ExploreRowCard`). ✅
- Kit filter removed → Task 3 (new `ExploreClient` has none; old `ExploreCard` left unused). ✅

**Placeholder scan:** none — Task 1/2/3 carry complete code, including the full rewritten `ExploreClient`.

**Type consistency:** `ExploreRowItem` defined in Task 1 (`src/lib/explore.ts`) and consumed by `ExploreRowCard` (Task 2) and `ExploreClient` (Task 3). `getExploreRows()` return shape matches `ExploreClient`'s `initialRows` prop and the `/api/explore/rows` response. `/api/explore` grid response `{ displays: [...] }` (Sub-project A) consumed in Task 3. `categoryLabel` (from `src/lib/categories.ts`) used for the grid heading.
