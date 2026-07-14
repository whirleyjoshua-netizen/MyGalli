# Workspaces Live KPI (Sub-project D) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** A Display canvas element (`workspace-kpi`) that renders a live aggregate (count/sum/avg/min/max) of a Workspace field — computed server-side on the published page, live-previewed in the editor.

**Architecture:** Binding (workspace/field/agg) lives in the element JSON (no DB model, no migration). The editor previews via an owner-gated aggregate endpoint. The published Server Component computes the aggregate server-side and injects the value — no public probe surface. Depends on Sub-project A (branch `workspaces-foundation`; this plan runs on `workspaces-live-kpi` stacked off it).

**Tech Stack:** Next.js 15 App Router (async Server Components), React 19, TypeScript, Prisma, Tailwind, Vitest.

## Global Constraints

- **Aggregations:** exactly `count | sum | avg | min | max`. `count` = active-record row count (field-independent). `sum/avg/min/max` = over `data[fieldKey]` values that are finite numbers; empty set → `null`. `avg` rounded to ≤ 2 decimals.
- **Security:** the ONLY endpoint is owner-gated `GET /api/workspaces/[id]/aggregate` (getUser + authorizeWorkspace). NO public aggregate endpoint. The published page computes server-side and ONLY for workspaces owned by the page owner (else value `null`).
- **Element JSON fields** (exact names): `workspaceKpiWorkspaceId`, `workspaceKpiWorkspaceName`, `workspaceKpiFieldKey`, `workspaceKpiFieldLabel`, `workspaceKpiAgg`, `workspaceKpiLabel`, `workspaceKpiSuffix`, `workspaceKpiValue`.
- **Element type string:** `workspace-kpi`. Slash category: `'Data & Visuals'`.
- **Never commit:** `Documents/`, `Images/`, `g1t.json`, `nul`, `.claude/settings.local.json`.
- **CI:** tsc + lint + test must pass. (3 pre-existing pro-gating test failures from main commit `f5abe64` are NOT ours — ignore them.)
- **Windows/DB:** stop `next dev` before builds; for any DB run set `DATABASE_URL`/`DATABASE_URL_UNPOOLED` to `postgresql://pages:pages@127.0.0.1:5434/pages`.

**Design reference:** `docs/superpowers/specs/2026-07-14-workspaces-live-kpi-design.md`

---

### Task 1: `computeAggregate` pure lib (TDD)

**Files:**
- Create: `src/lib/workspaces/aggregate.ts`
- Test: `src/lib/workspaces/aggregate.test.ts`

**Interfaces:**
- Produces: `type WorkspaceAgg = 'count'|'sum'|'avg'|'min'|'max'` and `computeAggregate(records: Array<{ data: Record<string, any> }>, fieldKey: string, agg: WorkspaceAgg): number | null`.

- [ ] **Step 1: Write the failing test**

`src/lib/workspaces/aggregate.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { computeAggregate } from './aggregate'

const recs = (vals: any[]) => vals.map((v) => ({ data: { grade: v } }))

describe('computeAggregate', () => {
  it('count = row count regardless of field values', () => {
    expect(computeAggregate(recs([90, null, 'x']), 'grade', 'count')).toBe(3)
    expect(computeAggregate([], 'grade', 'count')).toBe(0)
  })
  it('sum/avg/min/max over finite numbers only', () => {
    const r = recs([90, 80, 100, null, 'x'])
    expect(computeAggregate(r, 'grade', 'sum')).toBe(270)
    expect(computeAggregate(r, 'grade', 'avg')).toBe(90)
    expect(computeAggregate(r, 'grade', 'min')).toBe(80)
    expect(computeAggregate(r, 'grade', 'max')).toBe(100)
  })
  it('avg rounds to <= 2 decimals', () => {
    expect(computeAggregate(recs([1, 2, 2]), 'grade', 'avg')).toBe(1.67)
  })
  it('empty numeric set -> null for sum/avg/min/max', () => {
    const r = recs([null, 'x'])
    for (const op of ['sum', 'avg', 'min', 'max'] as const) {
      expect(computeAggregate(r, 'grade', op)).toBeNull()
    }
  })
})
```

- [ ] **Step 2: Run to verify fail**

Run: `npx vitest run src/lib/workspaces/aggregate.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`src/lib/workspaces/aggregate.ts`:
```ts
export type WorkspaceAgg = 'count' | 'sum' | 'avg' | 'min' | 'max'

export function computeAggregate(
  records: Array<{ data: Record<string, any> }>,
  fieldKey: string,
  agg: WorkspaceAgg
): number | null {
  if (agg === 'count') return records.length

  const nums = records
    .map((r) => r.data?.[fieldKey])
    .filter((v): v is number => typeof v === 'number' && Number.isFinite(v))

  if (nums.length === 0) return null

  switch (agg) {
    case 'sum':
      return nums.reduce((a, b) => a + b, 0)
    case 'avg': {
      const avg = nums.reduce((a, b) => a + b, 0) / nums.length
      return Math.round(avg * 100) / 100
    }
    case 'min':
      return Math.min(...nums)
    case 'max':
      return Math.max(...nums)
  }
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/lib/workspaces/aggregate.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/workspaces/aggregate.ts src/lib/workspaces/aggregate.test.ts
git commit -m "feat(workspaces): computeAggregate helper for KPI element"
```

---

### Task 2: Owner-gated aggregate endpoint (TDD)

**Files:**
- Create: `src/app/api/workspaces/[id]/aggregate/route.ts`
- Test: `src/app/api/workspaces/[id]/aggregate/route.test.ts`

**Interfaces:**
- Consumes: `computeAggregate` (Task 1), `authorizeWorkspace` (`@/lib/workspaces/authorize`), `db`, `getUser`.
- Produces: `GET /api/workspaces/[id]/aggregate?field=<key>&op=<agg>` → `{ value: number|null }`; 401/404/400. ctx `{ params: Promise<{ id: string }> }`.

- [ ] **Step 1: Write the failing test**

`src/app/api/workspaces/[id]/aggregate/route.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET } from './route'
import { getUser } from '@/lib/auth'
import { authorizeWorkspace } from '@/lib/workspaces/authorize'
import { db } from '@/lib/db'

vi.mock('@/lib/auth', () => ({ getUser: vi.fn() }))
vi.mock('@/lib/workspaces/authorize', () => ({ authorizeWorkspace: vi.fn() }))
vi.mock('@/lib/db', () => ({ db: { workspaceField: { findFirst: vi.fn() }, workspaceRecord: { findMany: vi.fn() } } }))

const ctx = { params: Promise.resolve({ id: 'w1' }) }
const req = (qs: string) => ({ nextUrl: new URL(`http://localhost/api/workspaces/w1/aggregate?${qs}`) } as any)

describe('GET aggregate', () => {
  beforeEach(() => vi.clearAllMocks())

  it('401 when unauthenticated', async () => {
    ;(getUser as any).mockResolvedValue(null)
    const res = await GET(req('field=grade&op=avg'), ctx)
    expect(res.status).toBe(401)
  })

  it('404 when not owner', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'u1' })
    ;(authorizeWorkspace as any).mockRejectedValue(new Error('Unauthorized or Workspace not found'))
    const res = await GET(req('field=grade&op=avg'), ctx)
    expect(res.status).toBe(404)
  })

  it('400 on bad op', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'u1' })
    ;(authorizeWorkspace as any).mockResolvedValue({ id: 'w1', ownerId: 'u1' })
    const res = await GET(req('field=grade&op=median'), ctx)
    expect(res.status).toBe(400)
  })

  it('400 on unknown field', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'u1' })
    ;(authorizeWorkspace as any).mockResolvedValue({ id: 'w1', ownerId: 'u1' })
    ;(db.workspaceField.findFirst as any).mockResolvedValue(null)
    const res = await GET(req('field=ghost&op=avg'), ctx)
    expect(res.status).toBe(400)
  })

  it('200 returns computed value', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'u1' })
    ;(authorizeWorkspace as any).mockResolvedValue({ id: 'w1', ownerId: 'u1' })
    ;(db.workspaceField.findFirst as any).mockResolvedValue({ key: 'grade' })
    ;(db.workspaceRecord.findMany as any).mockResolvedValue([{ data: { grade: 80 } }, { data: { grade: 100 } }])
    const res = await GET(req('field=grade&op=avg'), ctx)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ value: 90 })
  })
})
```

- [ ] **Step 2: Run to verify fail**

Run: `npx vitest run "src/app/api/workspaces/[id]/aggregate/route.test.ts"`
Expected: FAIL — `./route` not found.

- [ ] **Step 3: Implement**

`src/app/api/workspaces/[id]/aggregate/route.ts`:
```ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'
import { authorizeWorkspace } from '@/lib/workspaces/authorize'
import { computeAggregate, WorkspaceAgg } from '@/lib/workspaces/aggregate'

const OPS: WorkspaceAgg[] = ['count', 'sum', 'avg', 'min', 'max']
type Ctx = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: Ctx) {
  const user = await getUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  try {
    await authorizeWorkspace(user.id, id)
  } catch {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
  }

  const sp = request.nextUrl.searchParams
  const field = sp.get('field') || ''
  const op = (sp.get('op') || '') as WorkspaceAgg
  if (!OPS.includes(op)) return NextResponse.json({ error: 'Invalid op' }, { status: 400 })

  // count is field-independent; other ops require a real field
  if (op !== 'count') {
    if (!field) return NextResponse.json({ error: 'field required' }, { status: 400 })
    const exists = await db.workspaceField.findFirst({ where: { workspaceId: id, key: field }, select: { key: true } })
    if (!exists) return NextResponse.json({ error: 'Unknown field' }, { status: 400 })
  }

  const records = await db.workspaceRecord.findMany({
    where: { workspaceId: id, status: 'active' },
    select: { data: true },
  })
  const value = computeAggregate(records as Array<{ data: Record<string, any> }>, field, op)
  return NextResponse.json({ value })
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run "src/app/api/workspaces/[id]/aggregate/route.test.ts"`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add "src/app/api/workspaces/[id]/aggregate"
git commit -m "feat(workspaces): owner-gated aggregate endpoint"
```

---

### Task 3: Canvas type seams (ElementType + fields + createElement)

**Files:**
- Modify: `src/lib/types/canvas.ts` (union arm + `CanvasElement` fields + `createElement` case)

**Interfaces:**
- Produces: `'workspace-kpi'` in `ElementType`; the 8 `workspaceKpi*` optional fields on `CanvasElement`; `createElement('workspace-kpi')` default.

- [ ] **Step 1: Add the union arm**

In `src/lib/types/canvas.ts`, add to the `ElementType` union (near the other data elements):
```ts
  | 'workspace-kpi'   // Live aggregate (count/sum/avg/min/max) of a Workspace field
```

- [ ] **Step 2: Add the CanvasElement fields**

In the `CanvasElement` interface, add a block (near the existing `kpi*` fields):
```ts
  // workspace-kpi (live aggregate bound to a Workspace field)
  workspaceKpiWorkspaceId?: string
  workspaceKpiWorkspaceName?: string
  workspaceKpiFieldKey?: string
  workspaceKpiFieldLabel?: string
  workspaceKpiAgg?: 'count' | 'sum' | 'avg' | 'min' | 'max'
  workspaceKpiLabel?: string
  workspaceKpiSuffix?: string
  workspaceKpiValue?: number | null
```

- [ ] **Step 3: Add the createElement case**

In the `createElement` `switch`, add:
```ts
    case 'workspace-kpi':
      return {
        ...base,
        workspaceKpiAgg: 'avg',
        workspaceKpiLabel: '',
        workspaceKpiSuffix: '',
        workspaceKpiValue: null,
      }
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit 2>&1 | grep -iE 'canvas|workspace-kpi'`
Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add src/lib/types/canvas.ts
git commit -m "feat(workspaces): workspace-kpi element type + fields"
```

---

### Task 4: Editor + Public components + register seams

**Files:**
- Create: `src/components/elements/WorkspaceKpiElement.tsx`
- Create: `src/components/elements/PublicWorkspaceKpiElement.tsx`
- Test: `src/components/elements/PublicWorkspaceKpiElement.test.tsx`
- Modify: `src/components/elements/index.ts`, `src/components/canvas/SlashCommandMenu.tsx`, `src/components/canvas/ColumnCanvas.tsx`, `src/lib/render-elements.tsx`

**Interfaces:**
- Consumes: `CanvasElement`, the aggregate endpoint, `GET /api/workspaces`, `GET /api/workspaces/[id]`.
- Produces: `WorkspaceKpiElement` (editor) + `PublicWorkspaceKpiElement` (public), registered across the 4 seams.

- [ ] **Step 1: Public component + its test (TDD)**

`src/components/elements/PublicWorkspaceKpiElement.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PublicWorkspaceKpiElement } from './PublicWorkspaceKpiElement'

const base: any = { id: 'e1', type: 'workspace-kpi', workspaceKpiFieldLabel: 'Grade', workspaceKpiAgg: 'avg' }

describe('PublicWorkspaceKpiElement', () => {
  it('renders value + default label + suffix', () => {
    render(<PublicWorkspaceKpiElement element={{ ...base, workspaceKpiValue: 3.74, workspaceKpiSuffix: ' GPA' }} />)
    expect(screen.getByText('3.74 GPA')).toBeInTheDocument()
    expect(screen.getByText(/Avg of Grade/i)).toBeInTheDocument()
  })
  it('renders an em-dash when value is null', () => {
    render(<PublicWorkspaceKpiElement element={{ ...base, workspaceKpiValue: null }} />)
    expect(screen.getByText('—')).toBeInTheDocument()
  })
  it('uses a custom label when provided', () => {
    render(<PublicWorkspaceKpiElement element={{ ...base, workspaceKpiLabel: 'Class GPA', workspaceKpiValue: 3 }} />)
    expect(screen.getByText('Class GPA')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run to verify fail**

Run: `npx vitest run src/components/elements/PublicWorkspaceKpiElement.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the Public component + a shared label helper**

`src/components/elements/PublicWorkspaceKpiElement.tsx`:
```tsx
'use client'

import { CanvasElement } from '@/lib/types/canvas'

const AGG_LABEL: Record<string, string> = { count: 'Count', sum: 'Sum', avg: 'Avg', min: 'Min', max: 'Max' }

export function kpiDefaultLabel(element: CanvasElement): string {
  if (element.workspaceKpiLabel) return element.workspaceKpiLabel
  const agg = AGG_LABEL[element.workspaceKpiAgg || 'avg'] || 'Value'
  const field = element.workspaceKpiFieldLabel
  if (element.workspaceKpiAgg === 'count') return field ? `Count of ${field}` : 'Count'
  return field ? `${agg} of ${field}` : agg
}

export function formatKpiValue(value: number | null | undefined, suffix?: string): string {
  if (value === null || value === undefined) return '—'
  return `${value}${suffix || ''}`
}

export function PublicWorkspaceKpiElement({ element }: { element: CanvasElement }) {
  return (
    <div className="rounded-xl border border-border bg-surface px-6 py-5 text-center">
      <div className="text-3xl font-bold text-galli">
        {formatKpiValue(element.workspaceKpiValue, element.workspaceKpiSuffix)}
      </div>
      <div className="mt-1 text-sm text-muted-foreground">{kpiDefaultLabel(element)}</div>
    </div>
  )
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/components/elements/PublicWorkspaceKpiElement.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Implement the Editor component**

`src/components/elements/WorkspaceKpiElement.tsx`:
```tsx
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { CanvasElement } from '@/lib/types/canvas'
import { kpiDefaultLabel, formatKpiValue } from './PublicWorkspaceKpiElement'

interface Props {
  element: CanvasElement
  onChange: (updates: Partial<CanvasElement>) => void
  onDelete: () => void
  isSelected: boolean
  onSelect: () => void
}

const AGGS = ['count', 'sum', 'avg', 'min', 'max'] as const

type WsSummary = { id: string; name: string }
type Field = { key: string; label: string; type: string }

export function WorkspaceKpiElement({ element, onChange, onDelete, isSelected, onSelect }: Props) {
  const [workspaces, setWorkspaces] = useState<WsSummary[]>([])
  const [fields, setFields] = useState<Field[]>([])
  const [configuring, setConfiguring] = useState(!element.workspaceKpiWorkspaceId)

  const wsId = element.workspaceKpiWorkspaceId
  const fieldKey = element.workspaceKpiFieldKey
  const agg = element.workspaceKpiAgg || 'avg'

  // Route onChange through a ref so the refresh effect (below) does NOT retrigger
  // every render just because ColumnCanvas passes a fresh inline onChange — that
  // would cause an infinite fetch loop.
  const onChangeRef = useRef(onChange)
  useEffect(() => { onChangeRef.current = onChange })

  // Load workspace list when configuring
  useEffect(() => {
    if (!configuring) return
    fetch('/api/workspaces').then((r) => (r.ok ? r.json() : [])).then(setWorkspaces)
  }, [configuring])

  // Load fields for the selected workspace
  useEffect(() => {
    if (!wsId) { setFields([]); return }
    fetch(`/api/workspaces/${wsId}`).then((r) => (r.ok ? r.json() : null)).then((d) => setFields(d?.fields ?? []))
  }, [wsId])

  // Fetch the live value whenever the binding changes
  const refresh = useCallback(async () => {
    if (!wsId || (agg !== 'count' && !fieldKey)) return
    const qs = new URLSearchParams({ field: fieldKey || '', op: agg })
    const res = await fetch(`/api/workspaces/${wsId}/aggregate?${qs}`)
    if (res.ok) {
      const { value } = await res.json()
      onChangeRef.current({ workspaceKpiValue: value })
    }
  }, [wsId, fieldKey, agg]) // NOT onChange — see onChangeRef above

  useEffect(() => { refresh() }, [refresh])

  function pickWorkspace(w: WsSummary) {
    onChange({ workspaceKpiWorkspaceId: w.id, workspaceKpiWorkspaceName: w.name, workspaceKpiFieldKey: undefined, workspaceKpiFieldLabel: undefined })
  }
  function pickField(f: Field) {
    onChange({ workspaceKpiFieldKey: f.key, workspaceKpiFieldLabel: f.label })
  }

  if (configuring) {
    return (
      <div onClick={onSelect} className={`rounded-xl border p-4 ${isSelected ? 'border-galli' : 'border-border'} bg-surface`}>
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm font-semibold">Workspace Metric</span>
          <button onClick={onDelete} className="text-xs text-muted-foreground hover:text-red-500">Remove</button>
        </div>

        <label className="mb-1 block text-xs text-muted-foreground">Workspace</label>
        <select value={wsId || ''} onChange={(e) => { const w = workspaces.find((x) => x.id === e.target.value); if (w) pickWorkspace(w) }}
          className="mb-3 w-full rounded-lg border border-border bg-transparent px-2 py-1.5 text-sm">
          <option value="">Select…</option>
          {workspaces.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>

        <label className="mb-1 block text-xs text-muted-foreground">Metric</label>
        <select value={agg} onChange={(e) => onChange({ workspaceKpiAgg: e.target.value as any })}
          className="mb-3 w-full rounded-lg border border-border bg-transparent px-2 py-1.5 text-sm">
          {AGGS.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>

        {agg !== 'count' && (
          <>
            <label className="mb-1 block text-xs text-muted-foreground">Field (number)</label>
            <select value={fieldKey || ''} onChange={(e) => { const f = fields.find((x) => x.key === e.target.value); if (f) pickField(f) }}
              disabled={!wsId}
              className="mb-3 w-full rounded-lg border border-border bg-transparent px-2 py-1.5 text-sm">
              <option value="">Select…</option>
              {fields.filter((f) => f.type === 'number').map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
            </select>
          </>
        )}

        <label className="mb-1 block text-xs text-muted-foreground">Label (optional)</label>
        <input value={element.workspaceKpiLabel || ''} onChange={(e) => onChange({ workspaceKpiLabel: e.target.value })}
          placeholder={kpiDefaultLabel(element)} className="mb-3 w-full rounded-lg border border-border bg-transparent px-2 py-1.5 text-sm" />

        <label className="mb-1 block text-xs text-muted-foreground">Suffix (optional)</label>
        <input value={element.workspaceKpiSuffix || ''} onChange={(e) => onChange({ workspaceKpiSuffix: e.target.value })}
          placeholder="e.g. %, lbs" className="mb-3 w-full rounded-lg border border-border bg-transparent px-2 py-1.5 text-sm" />

        <button onClick={() => setConfiguring(false)} disabled={!wsId || (agg !== 'count' && !fieldKey)}
          className="w-full rounded-lg bg-galli px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50">Done</button>
      </div>
    )
  }

  return (
    <div onClick={onSelect} className={`group relative rounded-xl border ${isSelected ? 'border-galli' : 'border-border'} bg-surface px-6 py-5 text-center`}>
      <div className="text-3xl font-bold text-galli">{formatKpiValue(element.workspaceKpiValue, element.workspaceKpiSuffix)}</div>
      <div className="mt-1 text-sm text-muted-foreground">{kpiDefaultLabel(element)}</div>
      <button onClick={(e) => { e.stopPropagation(); setConfiguring(true) }}
        className="absolute right-2 top-2 text-xs text-muted-foreground opacity-0 transition group-hover:opacity-100 hover:text-galli">Edit</button>
    </div>
  )
}
```

- [ ] **Step 6: Register the barrel export**

In `src/components/elements/index.ts` add:
```ts
export { WorkspaceKpiElement } from './WorkspaceKpiElement'
export { PublicWorkspaceKpiElement } from './PublicWorkspaceKpiElement'
```

- [ ] **Step 7: Register in SlashCommandMenu**

In `src/components/canvas/SlashCommandMenu.tsx`, add to the commands array (near the other `'Data & Visuals'` items; import an icon that already exists in the file's lucide import block, e.g. `Gauge` — if not imported, add it to the existing lucide-react import):
```ts
  { id: 'workspace-kpi', label: 'Workspace Metric', icon: Gauge, description: 'Live count/sum/avg from a Workspace', category: 'Data & Visuals' },
```

- [ ] **Step 8: Register in ColumnCanvas**

In `src/components/canvas/ColumnCanvas.tsx`, import both components (top of file, with the other element imports) and add a case to the render switch (mirror the `live-feed` case):
```tsx
      case 'workspace-kpi':
        if (isPreviewMode) return <PublicWorkspaceKpiElement element={element} />
        return (
          <WorkspaceKpiElement
            element={element}
            onChange={(updates) => onUpdateElement(sectionId, columnId, element.id, updates)}
            onDelete={() => onDeleteElement(sectionId, columnId, element.id)}
            isSelected={commonProps.isSelected}
            onSelect={commonProps.onSelect}
          />
        )
```

- [ ] **Step 9: Register in render-elements**

In `src/lib/render-elements.tsx`, import `PublicWorkspaceKpiElement` (with the other Public imports) and add to the switch:
```tsx
    case 'workspace-kpi':
      return <PublicWorkspaceKpiElement element={element} />
```

- [ ] **Step 10: Typecheck + lint + tests**

Run:
```bash
npx tsc --noEmit 2>&1 | grep -iE 'workspace|kpi|canvas|slash|column|render-elements'
npx next lint 2>&1 | grep -iE 'WorkspaceKpi|workspace-kpi|Error:'
npx vitest run src/components/elements/PublicWorkspaceKpiElement.test.tsx
```
Expected: no tsc output; no lint errors; test passes. (Watch `react/no-unescaped-entities` — no raw apostrophes in the new JSX.)

- [ ] **Step 11: Commit**

```bash
git add src/components/elements/WorkspaceKpiElement.tsx src/components/elements/PublicWorkspaceKpiElement.tsx src/components/elements/PublicWorkspaceKpiElement.test.tsx src/components/elements/index.ts src/components/canvas/SlashCommandMenu.tsx src/components/canvas/ColumnCanvas.tsx src/lib/render-elements.tsx
git commit -m "feat(workspaces): workspace-kpi editor + public components, wired into canvas"
```

---

### Task 5: Published-page server hydration (TDD)

**Files:**
- Create: `src/lib/workspaces/kpi-hydrate.ts`
- Test: `src/lib/workspaces/kpi-hydrate.test.ts`
- Modify: `src/app/[username]/[slug]/page.tsx` (and `src/app/s/[code]/page.tsx` IF it renders elements via `renderElement`)

**Interfaces:**
- Consumes: `computeAggregate`. Deps injected for testability.
- Produces: `hydrateWorkspaceKpis(sections, ownerId, deps): Promise<Section[]>` where `deps = { getWorkspaceOwnerId(id): Promise<string|null>, getActiveRecords(id): Promise<Array<{data}>> }`. Returns NEW sections with each `workspace-kpi` element's `workspaceKpiValue` set (computed only when the bound workspace's owner === `ownerId`; else `null`); non-KPI elements untouched.

- [ ] **Step 1: Write the failing test**

`src/lib/workspaces/kpi-hydrate.test.ts`:
```ts
import { describe, it, expect, vi } from 'vitest'
import { hydrateWorkspaceKpis } from './kpi-hydrate'

const sections = () => [{
  id: 's1',
  columns: [{ id: 'c1', elements: [
    { id: 'e1', type: 'workspace-kpi', workspaceKpiWorkspaceId: 'w1', workspaceKpiFieldKey: 'grade', workspaceKpiAgg: 'avg' },
    { id: 'e2', type: 'text', text: 'hi' },
    { id: 'e3', type: 'workspace-kpi', workspaceKpiWorkspaceId: 'wForeign', workspaceKpiFieldKey: 'grade', workspaceKpiAgg: 'avg' },
  ] }],
}]

describe('hydrateWorkspaceKpis', () => {
  it('computes owned KPI, nulls foreign KPI, leaves other elements untouched', async () => {
    const deps = {
      getWorkspaceOwnerId: vi.fn(async (id: string) => (id === 'w1' ? 'owner1' : 'someoneElse')),
      getActiveRecords: vi.fn(async () => [{ data: { grade: 80 } }, { data: { grade: 100 } }]),
    }
    const out = await hydrateWorkspaceKpis(sections() as any, 'owner1', deps)
    const els = out[0].columns[0].elements
    expect(els[0].workspaceKpiValue).toBe(90) // owned -> computed
    expect(els[1]).toEqual({ id: 'e2', type: 'text', text: 'hi' }) // untouched
    expect(els[2].workspaceKpiValue).toBeNull() // foreign workspace -> null
    expect(deps.getActiveRecords).toHaveBeenCalledTimes(1) // only the owned one
  })

  it('nulls a KPI with no binding', async () => {
    const secs = [{ id: 's', columns: [{ id: 'c', elements: [{ id: 'e', type: 'workspace-kpi', workspaceKpiAgg: 'avg' }] }] }]
    const deps = { getWorkspaceOwnerId: vi.fn(), getActiveRecords: vi.fn() }
    const out = await hydrateWorkspaceKpis(secs as any, 'owner1', deps)
    expect(out[0].columns[0].elements[0].workspaceKpiValue).toBeNull()
    expect(deps.getWorkspaceOwnerId).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run to verify fail**

Run: `npx vitest run src/lib/workspaces/kpi-hydrate.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`src/lib/workspaces/kpi-hydrate.ts`:
```ts
import { computeAggregate, WorkspaceAgg } from './aggregate'

type Deps = {
  getWorkspaceOwnerId: (workspaceId: string) => Promise<string | null>
  getActiveRecords: (workspaceId: string) => Promise<Array<{ data: Record<string, any> }>>
}

/**
 * Returns a deep-copied sections array where every `workspace-kpi` element has
 * workspaceKpiValue computed server-side — but ONLY when the bound workspace is
 * owned by `ownerId` (the page owner). Foreign/missing/unbound -> null.
 */
export async function hydrateWorkspaceKpis(sections: any[], ownerId: string, deps: Deps): Promise<any[]> {
  if (!Array.isArray(sections)) return sections
  return Promise.all(
    sections.map(async (section) => ({
      ...section,
      columns: await Promise.all(
        (section.columns || []).map(async (column: any) => ({
          ...column,
          elements: await Promise.all(
            (column.elements || []).map(async (el: any) => {
              if (el?.type !== 'workspace-kpi') return el
              const wsId = el.workspaceKpiWorkspaceId
              const agg = (el.workspaceKpiAgg || 'avg') as WorkspaceAgg
              if (!wsId || (agg !== 'count' && !el.workspaceKpiFieldKey)) {
                return { ...el, workspaceKpiValue: null }
              }
              const owner = await deps.getWorkspaceOwnerId(wsId)
              if (owner !== ownerId) return { ...el, workspaceKpiValue: null }
              const records = await deps.getActiveRecords(wsId)
              return { ...el, workspaceKpiValue: computeAggregate(records, el.workspaceKpiFieldKey || '', agg) }
            })
          ),
        }))
      ),
    }))
  )
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/lib/workspaces/kpi-hydrate.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Wire into the published page**

In `src/app/[username]/[slug]/page.tsx`, after the display + page-owner `user.id` are resolved and BEFORE the sections are rendered, hydrate the sections. Add the import:
```ts
import { hydrateWorkspaceKpis } from '@/lib/workspaces/kpi-hydrate'
import { db } from '@/lib/db'  // if not already imported
```
Find where the code obtains the sections array it maps over for rendering (e.g. `const sections = display.sections as any[]` or the active-tab sections). Replace that with a hydrated copy:
```ts
const rawSections = /* existing sections expression */
const sections = await hydrateWorkspaceKpis(rawSections, user.id, {
  getWorkspaceOwnerId: async (id) => (await db.workspace.findUnique({ where: { id }, select: { ownerId: true } }))?.ownerId ?? null,
  getActiveRecords: async (id) => db.workspaceRecord.findMany({ where: { workspaceId: id, status: 'active' }, select: { data: true } }) as any,
})
```
Then render from `sections`. (If the page renders multiple tab-section sets, hydrate each set the same way, or hydrate the full structure before picking the active tab — match the existing shape. If tabs are stored separately, hydrate the sections actually passed to `renderElement`.) Keep everything else unchanged.

- [ ] **Step 6: Apply the same to the share page IF applicable**

Check `src/app/s/[code]/page.tsx`: `grep -n "renderElement\|sections" src/app/s/[code]/page.tsx`. If it renders elements via `renderElement`, resolve the display's owner `userId` and hydrate its sections the same way before rendering. If it does not render element sections, skip and note so in the report.

- [ ] **Step 7: Typecheck + full test run**

Run:
```bash
npx tsc --noEmit 2>&1 | grep -iE 'kpi|workspace|page.tsx'
npx vitest run src/lib/workspaces src/app/api/workspaces src/components/elements/PublicWorkspaceKpiElement.test.tsx
```
Expected: no tsc output; all listed tests pass.

- [ ] **Step 8: Commit**

```bash
git add src/lib/workspaces/kpi-hydrate.ts src/lib/workspaces/kpi-hydrate.test.ts "src/app/[username]/[slug]/page.tsx"
git add "src/app/s/[code]/page.tsx" 2>/dev/null || true
git commit -m "feat(workspaces): server-side KPI hydration on published pages"
```

---

### Task 6: Verification + PR

**Files:** none (verification only)

- [ ] **Step 1: Full local gate**

Run (stop `next dev` first):
```bash
npx tsc --noEmit
npx next lint 2>&1 | grep -iE 'Error:' || echo "no lint errors"
npx vitest run 2>&1 | tail -5
```
Expected: 0 TS errors; no lint errors; only the 3 pre-existing pro-gating failures (collections/members, displays/collection-create, board-edit-gate) — everything else green.

- [ ] **Step 2: DB smoke for the aggregate path**

Write a temp script IN the project root (so `@prisma/client` resolves), run with the DB env, then delete it. It should: find/create a workspace with a numeric field + a few records, call `computeAggregate` on the fetched records, and assert the avg/sum/min/max match hand-computed values. (Model on the Sub-project A smoke pattern.) Record the output in the report. Delete the temp file.

- [ ] **Step 3: Push + PR**

```bash
git push -u origin workspaces-live-kpi
gh pr create --base main --head workspaces-live-kpi --title "Workspaces live KPI element (Sub-project D)" --body "<summary: element, server-side compute, owner-gated preview endpoint, no public probe surface; DB smoke result; note it stacks on #14 (workspaces-foundation) and the 3 pre-existing pro-gating failures>"
```
Expected: PR opened. (Stacks on #14 — mention that base should be `workspaces-foundation` conceptually; since GitHub PRs target `main`, note the dependency in the body.)

---

## Out of scope (explicit)
Filters/segmented aggregates, real-time polling on published pages, collaborator-workspace aggregates, charts/sparklines/multi-metric, aggregating non-numeric fields beyond `count`, published-page caching changes.

## Notes for the implementer
- Read the spec (`docs/superpowers/specs/2026-07-14-workspaces-live-kpi-design.md`) for the "why," especially the security model.
- Follow the `live-feed` element as the structural precedent for the 7 seams (editor/public pair, ColumnCanvas case, render-elements case).
- The published page must NEVER expose records — only the single computed number, and only for workspaces owned by the page owner.
