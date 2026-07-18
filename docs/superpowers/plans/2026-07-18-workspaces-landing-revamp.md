# Workspaces Landing Revamp Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Turn `/workspaces` from a bare card grid into an on-brand landing: pond hero, feature tour, "coming soon" templates, and searchable/sortable rich workspace cards with a tips rail.

**Architecture:** Enrich `GET /api/workspaces` with per-workspace metadata (record count, field count, primary view, last activity); build a reusable `WorkspaceCard`; put the static sections in `WorkspacesLandingSections`; rewrite `WorkspacesListClient` to compose hero + sections + controls + cards + empty state. Reuse the shipped `formatLastUpdated`.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Tailwind, Prisma/PostgreSQL, Vitest, next/image.

**Design ref:** `docs/superpowers/specs/2026-07-18-workspaces-landing-revamp-design.md`

## Global Constraints
- **Working directory is the WORKTREE:** `C:/Users/whirl/pages-mvp/.claude/worktrees/ws-landing`. `cd` there first. The main checkout `C:/Users/whirl/pages-mvp` is on **another session's branch (`feat/freebie-element`)** — NEVER read or edit it.
- Branch MUST be `workspaces-landing-revamp`. Run `git branch --show-current` before every commit; wrong branch → STOP, report BLOCKED.
- Running the suite in this worktree needs `JWT_SECRET` exported first: `export JWT_SECRET="$(sed -n 's/^JWT_SECRET=//p' .env | tr -d '\r' | tr -d '"')"`.
- Reuse the shipped relative-time helper: `import { formatLastUpdated } from '@/lib/last-updated'` — signature `(date: Date, now: Date): string`, returns e.g. `"just now"`, `"3 hours"`, `"2 days"`. Render it as `Updated {formatLastUpdated(...)}` (NO "ago" — matches `LastUpdatedBadge`). Do not write a new time formatter.
- The enriched `GET /api/workspaces` response is a SUPERSET of the old (still has `id`/`name`) — the other consumer `WorkspaceKpiElement.tsx` reads only `id`/`name` and stays working. Do not remove those fields.
- Templates are a **"Coming soon"** placeholder only — non-interactive, no links, no templates system.
- Banner source: `C:/Users/whirl/Downloads/ChatGPT Image Jul 18, 2026, 02_32_21 AM.png` (1930×815) → copy to `public/workspaces-pond-banner.png`.
- Match existing Tailwind conventions (`border-border`, `text-muted-foreground`, `bg-galli`, `bg-surface`, `rounded-2xl`). Never commit `.env`, `Documents/`, `Images/`, `nul`. tsc + lint + tests must pass.
- DB for the browser smoke: `DATABASE_URL="postgresql://pages:pages@127.0.0.1:5434/pages"` (127.0.0.1), inline.

---

### Task 1: Enrich `GET /api/workspaces` (TDD)

**Files:**
- Modify: `src/app/api/workspaces/route.ts` (GET only)
- Modify: `src/app/api/workspaces/route.test.ts`

**Interfaces:**
- Produces the list response items later tasks consume:
```ts
type WorkspaceListItem = {
  id: string; name: string; description: string | null; icon: string | null
  recordCount: number; fieldCount: number
  primaryView: string | null   // first view's type by position
  lastActivity: string         // ISO
}
```

- [ ] **Step 1: Write the failing test** — append a GET describe block to `src/app/api/workspaces/route.test.ts` (reuse the file's existing `getUser`/`db` mocks; add `workspace.findMany` to the db mock if not present):

```ts
import { GET } from './route'

describe('GET /api/workspaces (enriched)', () => {
  beforeEach(() => vi.clearAllMocks())
  const req = () => ({} as any)

  it('401 unauth', async () => {
    ;(getUser as any).mockResolvedValue(null)
    expect((await GET(req())).status).toBe(401)
  })

  it('maps counts, primary view, and lastActivity (max of workspace + latest record)', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'u1' })
    const wsUpdated = new Date('2026-07-10T00:00:00Z')
    const recUpdated = new Date('2026-07-15T00:00:00Z') // newer than workspace
    ;(db.workspace.findMany as any).mockResolvedValue([
      {
        id: 'w1', name: 'Students', description: 'roster', icon: '🎓', updatedAt: wsUpdated,
        _count: { records: 12, fields: 4 },
        views: [{ type: 'grid' }],
        records: [{ updatedAt: recUpdated }],
      },
      {
        id: 'w2', name: 'Empty', description: null, icon: null, updatedAt: wsUpdated,
        _count: { records: 0, fields: 1 },
        views: [],
        records: [],
      },
    ])
    const body = await (await GET(req())).json()
    expect(body[0]).toEqual({
      id: 'w1', name: 'Students', description: 'roster', icon: '🎓',
      recordCount: 12, fieldCount: 4, primaryView: 'grid',
      lastActivity: recUpdated.toISOString(), // record newer than workspace
    })
    expect(body[1]).toMatchObject({ recordCount: 0, primaryView: null, lastActivity: wsUpdated.toISOString() })
  })

  it('scopes to the caller and requests active records only', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'u1' })
    ;(db.workspace.findMany as any).mockResolvedValue([])
    await GET(req())
    const arg = (db.workspace.findMany as any).mock.calls[0][0]
    expect(arg.where).toEqual({ ownerId: 'u1' })
    // active-only record count + latest active record
    expect(arg.select._count.select.records.where).toEqual({ status: 'active' })
    expect(arg.select.records.where).toEqual({ status: 'active' })
  })
})
```
Ensure the db mock includes `workspace: { findMany: vi.fn(), create: vi.fn() }` (create is used by the existing POST tests).

- [ ] **Step 2: Run → fail**

Run: `export JWT_SECRET="$(sed -n 's/^JWT_SECRET=//p' .env | tr -d '\r' | tr -d '"')"; npx vitest run "src/app/api/workspaces/route.test.ts"`
Expected: FAIL — GET returns raw rows, not the mapped shape.

- [ ] **Step 3: Implement** — replace the GET function in `src/app/api/workspaces/route.ts`:

```ts
// GET /api/workspaces - List user's workspaces (enriched for the landing cards)
export async function GET(request: NextRequest) {
  const user = await getUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rows = await db.workspace.findMany({
    where: { ownerId: user.id },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true, name: true, description: true, icon: true, updatedAt: true,
      _count: { select: { fields: true, records: { where: { status: 'active' } } } },
      views: { orderBy: { position: 'asc' }, take: 1, select: { type: true } },
      records: { where: { status: 'active' }, orderBy: { updatedAt: 'desc' }, take: 1, select: { updatedAt: true } },
    },
  })

  const items = rows.map((w) => {
    const latestRec = w.records[0]?.updatedAt
    const lastActivity = latestRec && latestRec > w.updatedAt ? latestRec : w.updatedAt
    return {
      id: w.id, name: w.name, description: w.description, icon: w.icon,
      recordCount: w._count.records, fieldCount: w._count.fields,
      primaryView: w.views[0]?.type ?? null,
      lastActivity: lastActivity.toISOString(),
    }
  })

  return NextResponse.json(items)
}
```

- [ ] **Step 4: Run → pass**

Run: `npx vitest run "src/app/api/workspaces/route.test.ts"`
Expected: PASS (existing POST tests + the 3 new GET tests).

- [ ] **Step 5: Commit**

```bash
git branch --show-current   # must be workspaces-landing-revamp
git add "src/app/api/workspaces/route.ts" "src/app/api/workspaces/route.test.ts"
git commit -m "feat(workspaces): enrich GET /api/workspaces with counts, primary view, lastActivity"
```

---

### Task 2: `WorkspaceCard` (TDD)

**Files:**
- Create: `src/components/workspaces/WorkspaceCard.tsx`
- Test: `src/components/workspaces/WorkspaceCard.test.tsx`

**Interfaces:**
- Consumes: the Task-1 `WorkspaceListItem` shape; `formatLastUpdated` from `@/lib/last-updated`.
- Produces: `export type WorkspaceListItem = {...}` (declare it here, exported, so the client imports it); `WorkspaceCard({ ws, layout }: { ws: WorkspaceListItem; layout: 'grid' | 'list' })`.

- [ ] **Step 1: Write the failing test** — create `src/components/workspaces/WorkspaceCard.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { WorkspaceCard, type WorkspaceListItem } from './WorkspaceCard'

const base: WorkspaceListItem = {
  id: 'w1', name: 'Students', description: 'Grade & class tracking', icon: '🎓',
  recordCount: 12, fieldCount: 4, primaryView: 'grid',
  lastActivity: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(), // 3h ago
}

describe('WorkspaceCard', () => {
  it('renders name, description, count, view badge, and relative updated time', () => {
    render(<WorkspaceCard ws={base} layout="grid" />)
    expect(screen.getByText('Students')).toBeInTheDocument()
    expect(screen.getByText(/Grade & class tracking/)).toBeInTheDocument()
    expect(screen.getByText(/12 records/)).toBeInTheDocument()
    expect(screen.getByText(/Grid view/i)).toBeInTheDocument()
    expect(screen.getByText(/Updated 3 hours/)).toBeInTheDocument()
  })
  it('links to the workspace', () => {
    render(<WorkspaceCard ws={base} layout="grid" />)
    expect(screen.getByRole('link')).toHaveAttribute('href', '/workspaces/w1')
  })
  it('handles zero records and no views', () => {
    render(<WorkspaceCard ws={{ ...base, recordCount: 0, primaryView: null }} layout="grid" />)
    expect(screen.getByText(/0 records/)).toBeInTheDocument()
    expect(screen.getByText(/No views/i)).toBeInTheDocument()
  })
  it('singularizes one record', () => {
    render(<WorkspaceCard ws={{ ...base, recordCount: 1 }} layout="grid" />)
    expect(screen.getByText(/1 record\b/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run → fail**

Run: `npx vitest run src/components/workspaces/WorkspaceCard.test.tsx`
Expected: FAIL — cannot find module `./WorkspaceCard`.

- [ ] **Step 3: Implement** — create `src/components/workspaces/WorkspaceCard.tsx`:

```tsx
'use client'

import Link from 'next/link'
import { Database } from 'lucide-react'
import { formatLastUpdated } from '@/lib/last-updated'

export type WorkspaceListItem = {
  id: string
  name: string
  description: string | null
  icon: string | null
  recordCount: number
  fieldCount: number
  primaryView: string | null
  lastActivity: string
}

function viewLabel(v: string | null): string {
  if (!v) return 'No views'
  return `${v.charAt(0).toUpperCase()}${v.slice(1)} view`
}

export function WorkspaceCard({ ws, layout }: { ws: WorkspaceListItem; layout: 'grid' | 'list' }) {
  const meta = (
    <p className="text-xs text-muted-foreground">
      {ws.recordCount} {ws.recordCount === 1 ? 'record' : 'records'} · {viewLabel(ws.primaryView)} ·{' '}
      Updated {formatLastUpdated(new Date(ws.lastActivity), new Date())}
    </p>
  )
  const icon = ws.icon ? <span className="text-lg leading-none">{ws.icon}</span> : <Database size={18} className="text-galli" />

  if (layout === 'list') {
    return (
      <Link href={`/workspaces/${ws.id}`}
        className="flex items-center gap-4 rounded-xl border border-border bg-surface px-4 py-3 transition hover:shadow-md">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">{icon}</span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2"><span className="truncate font-semibold">{ws.name}</span></span>
          {ws.description && <span className="block truncate text-sm text-muted-foreground">{ws.description}</span>}
        </span>
        <span className="hidden shrink-0 sm:block">{meta}</span>
      </Link>
    )
  }

  return (
    <Link href={`/workspaces/${ws.id}`}
      className="flex flex-col rounded-xl border border-border bg-surface p-5 transition hover:shadow-md">
      <div className="mb-1.5 flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">{icon}</span>
        <h3 className="truncate font-semibold">{ws.name}</h3>
      </div>
      {ws.description && <p className="mb-3 line-clamp-2 text-sm text-muted-foreground">{ws.description}</p>}
      <div className="mt-auto">{meta}</div>
    </Link>
  )
}
```

- [ ] **Step 4: Run → pass**

Run: `npx vitest run src/components/workspaces/WorkspaceCard.test.tsx`
Expected: PASS. (If `formatLastUpdated` output for 3h differs from `"3 hours"`, match the test to the real helper — it returns `plural(hours, 'hour')` → `"3 hours"`.)

- [ ] **Step 5: Commit**

```bash
git branch --show-current
git add src/components/workspaces/WorkspaceCard.tsx src/components/workspaces/WorkspaceCard.test.tsx
git commit -m "feat(workspaces): WorkspaceCard — rich card with count/view/last-activity, grid+list layouts"
```

---

### Task 3: `WorkspacesLandingSections` — static feature tour, templates (coming soon), tips (TDD)

**Files:**
- Create: `src/components/workspaces/WorkspacesLandingSections.tsx`
- Test: `src/components/workspaces/WorkspacesLandingSections.test.tsx`

**Interfaces:**
- Produces three static components used by the client: `FeatureTour()`, `TemplatesComingSoon()`, `TipsRail()`.

- [ ] **Step 1: Write the failing test** — create `src/components/workspaces/WorkspacesLandingSections.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { FeatureTour, TemplatesComingSoon, TipsRail } from './WorkspacesLandingSections'

describe('landing sections', () => {
  it('FeatureTour shows the four capabilities', () => {
    render(<FeatureTour />)
    expect(screen.getByText(/Define your schema/i)).toBeInTheDocument()
    expect(screen.getByText(/Add and edit data/i)).toBeInTheDocument()
    expect(screen.getByText(/View your data/i)).toBeInTheDocument()
    expect(screen.getByText(/Track live metrics/i)).toBeInTheDocument()
  })
  it('TemplatesComingSoon shows placeholder cards marked coming soon and none are links', () => {
    const { container } = render(<TemplatesComingSoon />)
    expect(screen.getAllByText(/Coming soon/i).length).toBeGreaterThanOrEqual(1)
    expect(container.querySelectorAll('a').length).toBe(0) // non-interactive
  })
  it('TipsRail renders tips', () => {
    render(<TipsRail />)
    expect(screen.getByText(/tips/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run → fail**

Run: `npx vitest run src/components/workspaces/WorkspacesLandingSections.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement** — create `src/components/workspaces/WorkspacesLandingSections.tsx`:

```tsx
import { Table2, Pencil, LayoutGrid, LineChart, Sparkles, Lightbulb } from 'lucide-react'

const FEATURES = [
  { icon: Table2, title: 'Define your schema', body: 'Choose from 10 field types to build a structured foundation.' },
  { icon: Pencil, title: 'Add and edit data', body: 'Use the spreadsheet grid to enter and update records — or import a CSV.' },
  { icon: LayoutGrid, title: 'View your data', body: 'Switch between Grid, Gallery, and Kanban views.' },
  { icon: LineChart, title: 'Track live metrics', body: 'Add KPIs to any page and keep your metrics up to date.' },
]

const TEMPLATES = ['Project Tracker', 'Content Calendar', 'CRM Pipeline', 'Event Planner', 'Inventory Tracker']

const TIPS = [
  'Use single-select fields to unlock Kanban grouping.',
  'Add KPIs to pages to surface the metrics that matter.',
  'You can add or change fields anytime as your data evolves.',
]

export function FeatureTour() {
  return (
    <section className="mb-8">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">What you can do in Workspaces</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {FEATURES.map((f) => (
          <div key={f.title} className="rounded-xl border border-border bg-surface p-4">
            <f.icon size={20} className="mb-2 text-galli" />
            <h3 className="mb-1 text-sm font-semibold">{f.title}</h3>
            <p className="text-xs text-muted-foreground">{f.body}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

export function TemplatesComingSoon() {
  return (
    <section className="mb-8">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        <Sparkles size={14} /> Start from a template
      </h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {TEMPLATES.map((t) => (
          <div key={t} className="rounded-xl border border-dashed border-border bg-muted/30 p-4 opacity-80" aria-disabled="true">
            <p className="mb-1 text-sm font-medium">{t}</p>
            <span className="inline-block rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">Coming soon</span>
          </div>
        ))}
      </div>
    </section>
  )
}

export function TipsRail() {
  return (
    <aside className="rounded-2xl border border-border bg-surface p-4">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold"><Lightbulb size={16} className="text-galli" /> Workspace tips</h3>
      <ul className="space-y-3">
        {TIPS.map((t) => <li key={t} className="text-xs text-muted-foreground">{t}</li>)}
      </ul>
    </aside>
  )
}
```

- [ ] **Step 4: Run → pass**

Run: `npx vitest run src/components/workspaces/WorkspacesLandingSections.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git branch --show-current
git add src/components/workspaces/WorkspacesLandingSections.tsx src/components/workspaces/WorkspacesLandingSections.test.tsx
git commit -m "feat(workspaces): static landing sections — feature tour, templates coming-soon, tips"
```

---

### Task 4: Banner asset + `WorkspacesListClient` rewrite (TDD)

**Files:**
- Create: `public/workspaces-pond-banner.png` (copied asset)
- Modify: `src/components/workspaces/WorkspacesListClient.tsx` (rewrite)
- Test: `src/components/workspaces/WorkspacesListClient.test.tsx` (new)

**Interfaces:**
- Consumes: `WorkspaceCard` + `WorkspaceListItem` (Task 2); `FeatureTour`/`TemplatesComingSoon`/`TipsRail` (Task 3); existing `CreateWorkspaceModal`.

- [ ] **Step 1: Copy the banner asset**

```bash
cp "C:/Users/whirl/Downloads/ChatGPT Image Jul 18, 2026, 02_32_21 AM.png" "public/workspaces-pond-banner.png"
ls -la public/workspaces-pond-banner.png
```
Confirm the file exists (~2.6MB).

- [ ] **Step 2: Write a failing component test** — create `src/components/workspaces/WorkspacesListClient.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { WorkspacesListClient } from './WorkspacesListClient'

const items = [
  { id: 'w1', name: 'Students', description: 'roster', icon: '🎓', recordCount: 12, fieldCount: 4, primaryView: 'grid', lastActivity: new Date().toISOString() },
  { id: 'w2', name: 'Budget', description: 'money', icon: '💰', recordCount: 3, fieldCount: 2, primaryView: 'kanban', lastActivity: new Date(Date.now() - 86400000).toISOString() },
]

beforeEach(() => {
  vi.restoreAllMocks()
  localStorage.clear()
})

function mockList(data: any) {
  vi.spyOn(global, 'fetch').mockResolvedValue({ ok: true, json: async () => data } as any)
}

describe('WorkspacesListClient', () => {
  it('renders rich cards for each workspace', async () => {
    mockList(items)
    render(<WorkspacesListClient />)
    await waitFor(() => expect(screen.getByText('Students')).toBeInTheDocument())
    expect(screen.getByText('Budget')).toBeInTheDocument()
  })

  it('search narrows the list', async () => {
    mockList(items)
    render(<WorkspacesListClient />)
    await waitFor(() => screen.getByText('Students'))
    fireEvent.change(screen.getByPlaceholderText(/search/i), { target: { value: 'bud' } })
    expect(screen.queryByText('Students')).not.toBeInTheDocument()
    expect(screen.getByText('Budget')).toBeInTheDocument()
  })

  it('shows the welcoming empty state (with feature tour) when there are no workspaces', async () => {
    mockList([])
    render(<WorkspacesListClient />)
    await waitFor(() => expect(screen.getByText(/No workspaces yet/i)).toBeInTheDocument())
    // feature tour still renders so new users see the value
    expect(screen.getByText(/What you can do in Workspaces/i)).toBeInTheDocument()
  })

  it('persists the layout toggle to localStorage', async () => {
    mockList(items)
    render(<WorkspacesListClient />)
    await waitFor(() => screen.getByText('Students'))
    fireEvent.click(screen.getByRole('button', { name: /list view/i }))
    expect(localStorage.getItem('galli-ws-layout')).toBe('list')
  })
})
```

- [ ] **Step 3: Run → fail**

Run: `npx vitest run src/components/workspaces/WorkspacesListClient.test.tsx`
Expected: FAIL — old client has no search/toggle/feature-tour.

- [ ] **Step 4: Rewrite** — replace `src/components/workspaces/WorkspacesListClient.tsx`:

```tsx
'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import { Plus, Search, LayoutGrid, List, Database } from 'lucide-react'
import { CreateWorkspaceModal } from './CreateWorkspaceModal'
import { WorkspaceCard, type WorkspaceListItem } from './WorkspaceCard'
import { FeatureTour, TemplatesComingSoon, TipsRail } from './WorkspacesLandingSections'

type SortKey = 'recent' | 'name'
type Layout = 'grid' | 'list'

export function WorkspacesListClient() {
  const [items, setItems] = useState<WorkspaceListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortKey>('recent')
  const [layout, setLayout] = useState<Layout>('grid')

  useEffect(() => {
    const saved = typeof window !== 'undefined' ? window.localStorage.getItem('galli-ws-layout') : null
    if (saved === 'grid' || saved === 'list') setLayout(saved)
  }, [])

  useEffect(() => {
    fetch('/api/workspaces')
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setItems(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false))
  }, [])

  function chooseLayout(next: Layout) {
    setLayout(next)
    try { window.localStorage.setItem('galli-ws-layout', next) } catch {}
  }

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    const filtered = q
      ? items.filter((w) => w.name.toLowerCase().includes(q) || (w.description ?? '').toLowerCase().includes(q))
      : items
    const sorted = [...filtered].sort((a, b) =>
      sort === 'name' ? a.name.localeCompare(b.name) : b.lastActivity.localeCompare(a.lastActivity)
    )
    return sorted
  }, [items, search, sort])

  return (
    <div className="px-6 py-7 lg:px-8">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Workspaces 🌿</h1>
          <p className="text-muted-foreground">Your data, organized.</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 rounded-lg bg-galli px-4 py-2 font-medium text-white">
          <Plus size={18} /> New workspace
        </button>
      </div>

      {/* Hero banner */}
      <div className="relative mb-8 h-36 w-full overflow-hidden rounded-2xl border border-border sm:h-44 lg:h-52">
        <Image src="/workspaces-pond-banner.png" alt="Pond workspace" fill priority className="object-cover" sizes="100vw" />
      </div>

      <FeatureTour />
      <TemplatesComingSoon />

      {/* Your workspaces */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Your workspaces</h2>
        {loading ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-12 text-center">
            <Database className="mx-auto mb-3 text-muted-foreground" />
            <p className="mb-1 font-medium">No workspaces yet</p>
            <p className="mb-4 text-sm text-muted-foreground">Create your first workspace to start organizing your data.</p>
            <button onClick={() => setShowCreate(true)} className="rounded-lg bg-galli px-4 py-2 font-medium text-white">
              Create your first workspace 🌿
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_280px]">
            <div>
              {/* Controls */}
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <div className="relative flex-1 min-w-[180px]">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search workspaces…"
                    className="w-full rounded-lg border border-border bg-transparent py-2 pl-9 pr-3 text-sm" />
                </div>
                <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)}
                  className="rounded-lg border border-border bg-transparent px-3 py-2 text-sm">
                  <option value="recent">Recently updated</option>
                  <option value="name">Name</option>
                </select>
                <div className="flex overflow-hidden rounded-lg border border-border">
                  <button onClick={() => chooseLayout('grid')} title="Grid view" aria-label="Grid view"
                    className={`px-2.5 py-2 ${layout === 'grid' ? 'bg-muted text-galli' : 'text-muted-foreground'}`}><LayoutGrid size={16} /></button>
                  <button onClick={() => chooseLayout('list')} title="List view" aria-label="List view"
                    className={`px-2.5 py-2 ${layout === 'list' ? 'bg-muted text-galli' : 'text-muted-foreground'}`}><List size={16} /></button>
                </div>
              </div>

              {visible.length === 0 ? (
                <p className="text-sm text-muted-foreground">No workspaces match “{search}”.</p>
              ) : layout === 'grid' ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {visible.map((ws) => <WorkspaceCard key={ws.id} ws={ws} layout="grid" />)}
                </div>
              ) : (
                <div className="space-y-2">
                  {visible.map((ws) => <WorkspaceCard key={ws.id} ws={ws} layout="list" />)}
                </div>
              )}
            </div>

            <TipsRail />
          </div>
        )}
      </section>

      {showCreate && <CreateWorkspaceModal onClose={() => setShowCreate(false)} />}
    </div>
  )
}
```

- [ ] **Step 5: Run → pass**

Run: `npx vitest run src/components/workspaces/WorkspacesListClient.test.tsx`
Expected: PASS — 4 tests.

- [ ] **Step 6: Verify + commit**

```bash
export JWT_SECRET="$(sed -n 's/^JWT_SECRET=//p' .env | tr -d '\r' | tr -d '"')"
npx tsc --noEmit 2>&1 | grep -iE 'workspace|WorkspaceCard|Landing' || echo clean
npx vitest run src/components/workspaces
```
Expected: tsc clean for these; component tests green.
```bash
git branch --show-current
git add public/workspaces-pond-banner.png src/components/workspaces/WorkspacesListClient.tsx src/components/workspaces/WorkspacesListClient.test.tsx
git commit -m "feat(workspaces): landing revamp — pond hero, feature tour, templates, rich cards + controls + tips"
```

---

### Task 5: Full gate + browser smoke

- [ ] **Step 1: Full gate** (in the worktree; deps: run `pnpm install` first if node_modules is absent):
```bash
export JWT_SECRET="$(sed -n 's/^JWT_SECRET=//p' .env | tr -d '\r' | tr -d '"')"
npx tsc --noEmit
npx next lint 2>&1 | grep -iE "Error:" || echo "no lint errors"
npx vitest run src/components/workspaces "src/app/api/workspaces"
```
Expected: tsc 0; no lint errors (pre-existing `<img>`/exhaustive-deps warnings OK — note the banner uses `next/image`, not `<img>`, so it adds none); the workspaces suites green. (A full `npx vitest run` is ideal but the Windows forks pool is flaky under load — if it degrades, the per-area runs above plus tsc are the reliable signal.)

- [ ] **Step 2: Browser smoke.** Confirm which checkout owns the dev port (`Get-NetTCPConnection -LocalPort 3300`), then:
```bash
DATABASE_URL="postgresql://pages:pages@127.0.0.1:5434/pages" npx next dev -p 3300
```
Seed a couple of workspaces for `hubowner@test.local` with varied record counts + view types (grid + kanban), mint a `galli-auth` cookie, set the cookie in the browser, and load `/workspaces`. Verify + screenshot:
1. The **pond banner** renders as a strip under the header.
2. The **feature tour** (4 cards) and **templates "Coming soon"** row render.
3. **Rich cards** show `N records · <View> view · Updated …` with correct values.
4. **Search** narrows; **sort** reorders; the **grid/list toggle** switches layout and survives a reload (localStorage).
5. Load `/workspaces` for a fresh account (no workspaces) → the **empty state** shows the create CTA while the feature tour still renders.
Screenshot the grid view, the list view, and the empty state.

- [ ] **Step 3: Record results** in `.superpowers/sdd/progress.md`, remove any temp seed scripts, then STOP and report. This branch is independent (off current main) — finishing/PR is a separate decision.

## Out of scope
Real templates/instantiation, workspace sharing + "All owners" filter, per-card ⋮ actions, reordering, changes to the workspace detail page.

## Success criteria
`/workspaces` shows the pond hero, feature tour, coming-soon templates, and a searchable/sortable/toggleable grid of rich cards (record count · view · last activity), with a welcoming empty state. tsc/lint/tests green; browser smoke confirms the visual + card metadata.
