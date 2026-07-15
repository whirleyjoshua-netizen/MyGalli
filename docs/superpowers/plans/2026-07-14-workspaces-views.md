# Workspaces Views (Sub-project C) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]`.

**Goal:** Add a view/renderer layer to Workspaces — the same records rendered as Grid / Gallery / Kanban, with a saved-view switcher.

**Architecture:** All views render the SAME `fields`+`records` already fetched by the detail page (no per-view data endpoint). Views persist in the existing `WorkspaceView` model (no migration). Branch `workspaces-c-views` off current `main`.

**Tech Stack:** Next.js 15, React 19, TS, Tailwind, Vitest.

## Global Constraints
- View types (verbatim): `grid`, `gallery`, `kanban`.
- Every workspace always has ≥1 view (auto-create a default `grid` view; refuse to delete the last).
- Kanban's `config.groupByField` must be a `choice` field key.
- Gallery's `config.titleField` optional (default: first text field).
- Never commit: Documents/, Images/, g1t.json, nul, .claude/. tsc+lint+tests must pass.

**Design ref:** `docs/superpowers/specs/2026-07-14-workspaces-views-design.md`

---

### Task 1: Backend — views in GET, POST types, DELETE view (TDD)

**Files:**
- Modify: `src/app/api/workspaces/[id]/route.ts` (GET adds views + ensures default)
- Modify: `src/app/api/workspaces/[id]/route.test.ts`
- Modify: `src/app/api/workspaces/[id]/views/route.ts` (broaden type + kanban config validation)
- Modify: `src/app/api/workspaces/[id]/views/[viewId]/route.ts` (add DELETE)
- Test: `src/app/api/workspaces/[id]/views/[viewId]/route.test.ts` (new)

- [ ] **Step 1: GET returns views + auto-creates default.** In `src/app/api/workspaces/[id]/route.ts` GET, add `workspaceView` to the `Promise.all` and ensure a default:
```ts
  const [fields, records, total, views] = await Promise.all([
    db.workspaceField.findMany({ where: { workspaceId: id }, orderBy: { position: 'asc' } }),
    db.workspaceRecord.findMany({
      where: { workspaceId: id, status: 'active' },
      orderBy: { createdAt: 'asc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: { id: true, data: true, updatedAt: true },
    }),
    db.workspaceRecord.count({ where: { workspaceId: id, status: 'active' } }),
    db.workspaceView.findMany({ where: { workspaceId: id }, orderBy: { position: 'asc' } }),
  ])

  let viewList = views
  if (viewList.length === 0) {
    const def = await db.workspaceView.create({ data: { workspaceId: id, name: 'Grid', type: 'grid', config: {}, position: 0 } })
    viewList = [def]
  }

  const ws = g.ws!
  return NextResponse.json({
    workspace: { id: ws.id, name: ws.name, description: ws.description, icon: ws.icon },
    fields,
    records,
    views: viewList,
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  })
```

- [ ] **Step 2: Update the GET test** in `route.test.ts` — extend the db mock and the assertion. Add `workspaceView: { findMany: vi.fn(), create: vi.fn() }` to the `db` mock, and in the "GET returns..." test mock `db.workspaceView.findMany` → `[{ id: 'v1', name: 'Grid', type: 'grid' }]` and assert `body.views` is present:
```ts
    ;(db.workspaceView.findMany as any).mockResolvedValue([{ id: 'v1', name: 'Grid', type: 'grid', config: {}, position: 0 }])
    // ... after GET:
    expect(body.views).toHaveLength(1)
    expect(body.views[0].type).toBe('grid')
```
Add a second test: auto-creates a default when none exist:
```ts
  it('GET auto-creates a default grid view when none exist', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'u1' })
    ;(db.workspace.findUnique as any).mockResolvedValue({ id: 'w1', ownerId: 'u1', name: 'S', description: null, icon: null })
    ;(db.workspaceField.findMany as any).mockResolvedValue([])
    ;(db.workspaceRecord.findMany as any).mockResolvedValue([])
    ;(db.workspaceRecord.count as any).mockResolvedValue(0)
    ;(db.workspaceView.findMany as any).mockResolvedValue([])
    ;(db.workspaceView.create as any).mockResolvedValue({ id: 'vDef', name: 'Grid', type: 'grid', config: {}, position: 0 })
    const res = await GET(req('GET'), ctx)
    const body = await res.json()
    expect(db.workspaceView.create).toHaveBeenCalled()
    expect(body.views[0].id).toBe('vDef')
  })
```
Run: `npx vitest run "src/app/api/workspaces/[id]/route.test.ts"` → pass.

- [ ] **Step 3: Broaden POST views + validate kanban config.** In `src/app/api/workspaces/[id]/views/route.ts`, replace the type-check block:
```ts
    const ALLOWED_VIEW_TYPES = ['grid', 'gallery', 'kanban']
    if (!ALLOWED_VIEW_TYPES.includes(type)) {
      return NextResponse.json({ error: 'Unsupported view type' }, { status: 400 })
    }

    const fields = await db.workspaceField.findMany({ where: { workspaceId } })
    const fieldKeys = fields.map((f) => f.key)

    if (type === 'kanban') {
      const gf = config?.groupByField
      const field = fields.find((f) => f.key === gf)
      if (!field || field.type !== 'choice') {
        return NextResponse.json({ error: 'Kanban needs a single-select field to group by' }, { status: 400 })
      }
    }
    if (config?.visibleFields) {
      const unknown = config.visibleFields.filter((f: string) => !fieldKeys.includes(f))
      if (unknown.length > 0) return NextResponse.json({ error: `Unknown fields: ${unknown.join(', ')}` }, { status: 400 })
    }
```
(Remove the old `if (type !== 'table')` block and the now-duplicated fields fetch.)

- [ ] **Step 4: Add DELETE to the view route.** Append to `src/app/api/workspaces/[id]/views/[viewId]/route.ts`:
```ts
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; viewId: string }> }
) {
  const user = await getUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id: workspaceId, viewId } = await params
  try {
    await authorizeWorkspace(user.id, workspaceId)
    const count = await db.workspaceView.count({ where: { workspaceId } })
    if (count <= 1) return NextResponse.json({ error: 'Cannot delete the last view' }, { status: 400 })
    const { count: deleted } = await db.workspaceView.deleteMany({ where: { id: viewId, workspaceId } })
    if (deleted === 0) return NextResponse.json({ error: 'View not found' }, { status: 404 })
    return NextResponse.json({ ok: true })
  } catch (error: any) {
    if (error.message === 'Unauthorized or Workspace not found') {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
    }
    console.error('Delete view error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```
(Ensure `authorizeWorkspace` + `db` are imported — the file's PATCH already imports them.)

- [ ] **Step 5: Test DELETE.** Create `src/app/api/workspaces/[id]/views/[viewId]/route.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { DELETE } from './route'
import { getUser } from '@/lib/auth'
import { authorizeWorkspace } from '@/lib/workspaces/authorize'
import { db } from '@/lib/db'

vi.mock('@/lib/auth', () => ({ getUser: vi.fn() }))
vi.mock('@/lib/workspaces/authorize', () => ({ authorizeWorkspace: vi.fn() }))
vi.mock('@/lib/db', () => ({ db: { workspaceView: { count: vi.fn(), deleteMany: vi.fn() } } }))

const ctx = { params: Promise.resolve({ id: 'w1', viewId: 'v2' }) }
const req = () => ({} as any)

describe('DELETE view', () => {
  beforeEach(() => vi.clearAllMocks())
  it('401 unauth', async () => { ;(getUser as any).mockResolvedValue(null); expect((await DELETE(req(), ctx)).status).toBe(401) })
  it('400 on the last view', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'u1' }); ;(authorizeWorkspace as any).mockResolvedValue({})
    ;(db.workspaceView.count as any).mockResolvedValue(1)
    expect((await DELETE(req(), ctx)).status).toBe(400)
  })
  it('200 deletes a non-last view', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'u1' }); ;(authorizeWorkspace as any).mockResolvedValue({})
    ;(db.workspaceView.count as any).mockResolvedValue(2)
    ;(db.workspaceView.deleteMany as any).mockResolvedValue({ count: 1 })
    expect((await DELETE(req(), ctx)).status).toBe(200)
  })
})
```
Run: `npx vitest run "src/app/api/workspaces/[id]/views"` → pass. Then `npx vitest run src/app/api/workspaces` once.

- [ ] **Step 6: Commit.**
```bash
git add "src/app/api/workspaces/[id]/route.ts" "src/app/api/workspaces/[id]/route.test.ts" "src/app/api/workspaces/[id]/views"
git commit -m "feat(workspaces): views in GET (+default), view types grid/gallery/kanban, DELETE view"
```

---

### Task 2: Kanban grouping helper + hook view state (TDD)

**Files:**
- Create: `src/lib/workspaces/kanban.ts`
- Test: `src/lib/workspaces/kanban.test.ts`
- Modify: `src/components/workspaces/useWorkspaceGrid.ts`

**Interfaces:**
- `groupRecordsByField(records, fieldKey, options): Record<string, GridRecord[]>` (key `__uncategorized` for null/unknown).
- Hook adds `views: WorkspaceView[]`, `addView(name,type,config): Promise<WorkspaceView|null>`, `deleteView(id): Promise<void>`.

- [ ] **Step 1: Kanban helper test** — `src/lib/workspaces/kanban.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { groupRecordsByField } from './kanban'

const r = (id: string, sport: any) => ({ id, data: { sport }, updatedAt: '' })

describe('groupRecordsByField', () => {
  it('buckets records by option, null/unknown -> __uncategorized', () => {
    const recs = [r('1', 'Soccer'), r('2', 'Tennis'), r('3', null), r('4', 'Ghost'), r('5', 'Soccer')]
    const g = groupRecordsByField(recs as any, 'sport', ['Soccer', 'Tennis', 'None'])
    expect(g['Soccer'].map((x) => x.id)).toEqual(['1', '5'])
    expect(g['Tennis'].map((x) => x.id)).toEqual(['2'])
    expect(g['None']).toEqual([])
    expect(g['__uncategorized'].map((x) => x.id)).toEqual(['3', '4'])
  })
})
```

- [ ] **Step 2: Run → fail**, implement `src/lib/workspaces/kanban.ts`:
```ts
import type { GridRecord } from '@/components/workspaces/useWorkspaceGrid'

export const UNCATEGORIZED = '__uncategorized'

export function groupRecordsByField(
  records: GridRecord[],
  fieldKey: string,
  options: string[]
): Record<string, GridRecord[]> {
  const groups: Record<string, GridRecord[]> = {}
  for (const opt of options) groups[opt] = []
  groups[UNCATEGORIZED] = []
  for (const rec of records) {
    const v = rec.data?.[fieldKey]
    if (v != null && options.includes(v)) groups[v].push(rec)
    else groups[UNCATEGORIZED].push(rec)
  }
  return groups
}
```
Run: `npx vitest run src/lib/workspaces/kanban.test.ts` → pass.

- [ ] **Step 3: Add view state + CRUD to the hook.** In `useWorkspaceGrid.ts`:
  - Add the type + state:
```ts
export type WorkspaceView = { id: string; name: string; type: string; config: any; position: number }
```
  - Add `const [views, setViews] = useState<WorkspaceView[]>([])` alongside the other state.
  - In `reload()`, after `setFields(body.fields)`, add `setViews(body.views ?? [])`.
  - Add the methods (before the return):
```ts
  const addView = useCallback(async (name: string, type: string, config?: any): Promise<WorkspaceView | null> => {
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/views`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, type, config: config ?? {} }),
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Add view failed')
      const view = await res.json()
      await reload()
      return view
    } catch (e: any) { setError(e.message || 'Add view failed'); return null }
  }, [workspaceId, reload])

  const deleteView = useCallback(async (viewId: string) => {
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/views/${viewId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Delete view failed')
      await reload()
    } catch (e: any) { setError(e.message || 'Delete view failed') }
  }, [workspaceId, reload])
```
  - Add `views, addView, deleteView` to the returned object.

- [ ] **Step 4: Verify** `npx vitest run src/lib/workspaces src/components/workspaces` (green) + `npx tsc --noEmit 2>&1 | grep -iE 'kanban|useWorkspaceGrid' || echo clean`.

- [ ] **Step 5: Commit.**
```bash
git add src/lib/workspaces/kanban.ts src/lib/workspaces/kanban.test.ts src/components/workspaces/useWorkspaceGrid.ts
git commit -m "feat(workspaces): kanban grouping helper + hook view state/CRUD"
```

---

### Task 3: Extract GridView + WorkspaceViews container (switcher) + AddViewModal

**Files:**
- Create: `src/components/workspaces/views/GridView.tsx` (the table extracted from WorkspaceGrid)
- Create: `src/components/workspaces/WorkspaceViews.tsx` (container: header + switcher + active renderer)
- Create: `src/components/workspaces/AddViewModal.tsx`
- Modify: `src/app/(dashboard)/workspaces/[id]/page.tsx` (render `WorkspaceViews`)
- Delete: `src/components/workspaces/WorkspaceGrid.tsx`

**Interfaces:** `GridView({ grid })` where `grid` is the `useWorkspaceGrid` return. `WorkspaceViews({ workspaceId })`.

- [ ] **Step 1: Extract `GridView`.** Create `src/components/workspaces/views/GridView.tsx` — move the table + add-row + column-editor JSX out of `WorkspaceGrid.tsx` into a component that takes the grid hook:
```tsx
'use client'

import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { GridCell } from '../cells/GridCell'
import { ColumnEditorPopover } from '../ColumnEditorPopover'
import type { useWorkspaceGrid } from '../useWorkspaceGrid'

export function GridView({ grid }: { grid: ReturnType<typeof useWorkspaceGrid> }) {
  const [addingColumn, setAddingColumn] = useState(false)
  if (grid.fields.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-12 text-center">
        <p className="mb-4 text-muted-foreground">Add your first column to get started.</p>
        <button onClick={() => setAddingColumn(true)} className="rounded-lg bg-galli px-4 py-2 font-medium text-white">Add column</button>
        {addingColumn && (
          <ColumnEditorPopover onClose={() => setAddingColumn(false)}
            onSubmit={(label, type, config) => { grid.addField(label, type, config); setAddingColumn(false) }} />
        )}
      </div>
    )
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-surface">
      <table className="w-full text-sm">
        <thead className="border-b border-border bg-muted text-xs uppercase text-muted-foreground">
          <tr>
            {grid.fields.map((f) => (
              <th key={f.id} className="group px-4 py-3 text-left font-semibold">
                <span className="flex items-center gap-1">
                  {f.label}{f.required ? <span className="text-red-500">*</span> : null}
                  <button onClick={() => { if (confirm(`Delete column "${f.label}"?`)) grid.deleteField(f.id) }}
                    className="opacity-0 transition group-hover:opacity-100" title="Delete column">
                    <Trash2 size={13} className="text-muted-foreground hover:text-red-500" />
                  </button>
                </span>
              </th>
            ))}
            <th className="px-3 py-3"><button onClick={() => setAddingColumn(true)} title="Add column"><Plus size={16} /></button></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {grid.records.map((rec) => (
            <tr key={rec.id} className="group hover:bg-muted/40">
              {grid.fields.map((f) => (
                <td key={f.id} className="px-4 py-2 align-top">
                  <GridCell field={f} value={rec.data[f.key]} onCommit={(v) => grid.updateCell(rec.id, f.key, v)} />
                </td>
              ))}
              <td className="px-3 py-2">
                <button onClick={() => { if (confirm('Delete this row?')) grid.deleteRow(rec.id) }}
                  className="opacity-0 transition group-hover:opacity-100" title="Delete row">
                  <Trash2 size={14} className="text-muted-foreground hover:text-red-500" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button onClick={grid.addRow} className="flex w-full items-center gap-2 px-4 py-3 text-sm text-muted-foreground hover:bg-muted/40">
        <Plus size={16} /> Add row
      </button>
      {addingColumn && (
        <ColumnEditorPopover onClose={() => setAddingColumn(false)}
          onSubmit={(label, type, config) => { grid.addField(label, type, config); setAddingColumn(false) }} />
      )}
    </div>
  )
}
```

- [ ] **Step 2: AddViewModal.** Create `src/components/workspaces/AddViewModal.tsx`:
```tsx
'use client'

import { useState } from 'react'
import type { GridField } from './useWorkspaceGrid'

const VIEW_TYPES = [{ value: 'grid', label: 'Grid' }, { value: 'gallery', label: 'Gallery' }, { value: 'kanban', label: 'Kanban' }]

export function AddViewModal({ fields, onSubmit, onClose }: {
  fields: GridField[]
  onSubmit: (name: string, type: string, config: any) => void
  onClose: () => void
}) {
  const [name, setName] = useState('')
  const [type, setType] = useState('gallery')
  const [titleField, setTitleField] = useState('')
  const [groupByField, setGroupByField] = useState('')
  const choiceFields = fields.filter((f) => f.type === 'choice')

  function submit() {
    if (!name.trim()) return
    if (type === 'kanban' && !groupByField) return
    const config = type === 'kanban' ? { groupByField } : type === 'gallery' ? { titleField: titleField || undefined } : {}
    onSubmit(name.trim(), type, config)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl bg-surface p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="mb-3 font-semibold">Add view</h3>
        <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="View name"
          className="mb-3 w-full rounded-lg border border-border bg-transparent px-3 py-2" />
        <select value={type} onChange={(e) => setType(e.target.value)} className="mb-3 w-full rounded-lg border border-border bg-transparent px-3 py-2">
          {VIEW_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        {type === 'gallery' && (
          <select value={titleField} onChange={(e) => setTitleField(e.target.value)} className="mb-3 w-full rounded-lg border border-border bg-transparent px-3 py-2">
            <option value="">Title field (auto)</option>
            {fields.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
          </select>
        )}
        {type === 'kanban' && (
          <select value={groupByField} onChange={(e) => setGroupByField(e.target.value)} className="mb-3 w-full rounded-lg border border-border bg-transparent px-3 py-2">
            <option value="">Group by (single-select field)…</option>
            {choiceFields.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
          </select>
        )}
        {type === 'kanban' && choiceFields.length === 0 && (
          <p className="mb-3 text-xs text-muted-foreground">Add a single-select column first to use Kanban.</p>
        )}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-muted-foreground">Cancel</button>
          <button onClick={submit} disabled={!name.trim() || (type === 'kanban' && !groupByField)}
            className="rounded-lg bg-galli px-4 py-2 font-medium text-white disabled:opacity-50">Add</button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: WorkspaceViews container.** Create `src/components/workspaces/WorkspaceViews.tsx`:
```tsx
'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Plus, X } from 'lucide-react'
import { useWorkspaceGrid } from './useWorkspaceGrid'
import { GridView } from './views/GridView'
import { GalleryView } from './views/GalleryView'
import { KanbanView } from './views/KanbanView'
import { AddViewModal } from './AddViewModal'

export function WorkspaceViews({ workspaceId }: { workspaceId: string }) {
  const grid = useWorkspaceGrid(workspaceId)
  const router = useRouter()
  const params = useSearchParams()
  const [addingView, setAddingView] = useState(false)

  if (grid.loading) return <div className="p-8 text-muted-foreground">Loading…</div>
  if (grid.error && !grid.workspace) {
    return (
      <div className="p-8">
        <p className="mb-3 text-red-500">Couldn&apos;t load this workspace.</p>
        <button onClick={grid.reload} className="rounded-lg border border-border px-4 py-2">Retry</button>
      </div>
    )
  }

  const views = grid.views
  const activeId = params.get('view')
  const active = views.find((v) => v.id === activeId) ?? views[0]

  function switchTo(id: string) {
    router.replace(`/workspaces/${workspaceId}?view=${id}`)
  }

  return (
    <div className="flex h-full flex-col p-6 lg:p-8">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">{grid.workspace?.name}</h1>
        {grid.error && <span className="text-sm text-red-500">{grid.error}</span>}
      </div>

      {/* View switcher */}
      <div className="mb-4 flex items-center gap-1 border-b border-border">
        {views.map((v) => (
          <div key={v.id} className={`group flex items-center gap-1 border-b-2 px-3 py-2 text-sm ${active?.id === v.id ? 'border-galli font-semibold text-galli' : 'border-transparent text-muted-foreground'}`}>
            <button onClick={() => switchTo(v.id)}>{v.name}</button>
            {views.length > 1 && (
              <button onClick={() => { if (confirm(`Delete view "${v.name}"?`)) grid.deleteView(v.id) }}
                className="opacity-0 transition group-hover:opacity-100" title="Delete view">
                <X size={12} className="text-muted-foreground hover:text-red-500" />
              </button>
            )}
          </div>
        ))}
        <button onClick={() => setAddingView(true)} className="ml-1 flex items-center gap-1 px-2 py-2 text-sm text-muted-foreground hover:text-galli" title="Add view">
          <Plus size={14} /> View
        </button>
      </div>

      {/* Active view */}
      {active?.type === 'gallery' ? (
        <GalleryView fields={grid.fields} records={grid.records} config={active.config} />
      ) : active?.type === 'kanban' ? (
        <KanbanView fields={grid.fields} records={grid.records} config={active.config} />
      ) : (
        <GridView grid={grid} />
      )}

      {addingView && (
        <AddViewModal fields={grid.fields} onClose={() => setAddingView(false)}
          onSubmit={async (name, type, config) => {
            setAddingView(false)
            const v = await grid.addView(name, type, config)
            if (v) switchTo(v.id)
          }} />
      )}
    </div>
  )
}
```

- [ ] **Step 4: Wire the page + delete old grid.** Replace `src/app/(dashboard)/workspaces/[id]/page.tsx`:
```tsx
import { Suspense } from 'react'
import { WorkspaceViews } from '@/components/workspaces/WorkspaceViews'

export default async function WorkspacePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return (
    <Suspense fallback={<div className="p-8 text-muted-foreground">Loading…</div>}>
      <WorkspaceViews workspaceId={id} />
    </Suspense>
  )
}
```
(`useSearchParams` requires a Suspense boundary.) Then create the two view components in Task 4 BEFORE running tsc — this task's tsc will fail until GalleryView/KanbanView exist, so **do Task 4 before verifying tsc**. For now: `git rm src/components/workspaces/WorkspaceGrid.tsx` and confirm nothing else imports it: `grep -rn "WorkspaceGrid" src/ | grep -v WorkspaceGrid.test` → only the (now-updated) page should have referenced it.

- [ ] **Step 5: Commit** (after Task 4 makes it compile). Deferred — commit at the end of Task 4.

---

### Task 4: GalleryView + KanbanView renderers (+ compile + commit Tasks 3–4)

**Files:**
- Create: `src/components/workspaces/views/GalleryView.tsx`
- Create: `src/components/workspaces/views/KanbanView.tsx`
- Test: `src/components/workspaces/views/GalleryView.test.tsx`

- [ ] **Step 1: GalleryView.** Create `src/components/workspaces/views/GalleryView.tsx`:
```tsx
'use client'

import type { GridField, GridRecord } from '../useWorkspaceGrid'
import { formatFieldValue } from '@/lib/workspaces/format-value'

export function GalleryView({ fields, records, config }: { fields: GridField[]; records: GridRecord[]; config: any }) {
  if (fields.length === 0) return <div className="rounded-2xl border border-dashed border-border p-12 text-center text-muted-foreground">Add a column first.</div>
  const titleKey = config?.titleField || fields.find((f) => f.type === 'text')?.key || fields[0].key
  const titleField = fields.find((f) => f.key === titleKey)
  const rest = fields.filter((f) => f.key !== titleKey)

  if (records.length === 0) return <div className="rounded-2xl border border-dashed border-border p-12 text-center text-muted-foreground">No records yet.</div>

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {records.map((rec) => (
        <div key={rec.id} className="rounded-xl border border-border bg-surface p-4 shadow-soft">
          <div className="mb-2 font-semibold">
            {titleField ? String(formatFieldValue(titleField.type, rec.data[titleKey], titleField.config) || '—') : '—'}
          </div>
          <dl className="space-y-1 text-sm">
            {rest.map((f) => (
              <div key={f.id} className="flex justify-between gap-3">
                <dt className="text-muted-foreground">{f.label}</dt>
                <dd className="truncate text-right">{formatFieldValue(f.type, rec.data[f.key], f.config) || '—'}</dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: GalleryView test** — `src/components/workspaces/views/GalleryView.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { GalleryView } from './GalleryView'

const fields = [
  { id: 'f1', key: 'name', label: 'Name', type: 'text', position: 0 },
  { id: 'f2', key: 'fee', label: 'Fee', type: 'currency', position: 1, config: { symbol: '$' } },
] as any
const records = [{ id: 'r1', data: { name: 'Jordan', fee: 1200 }, updatedAt: '' }] as any

describe('GalleryView', () => {
  it('renders a card with the title + formatted field', () => {
    render(<GalleryView fields={fields} records={records} config={{ titleField: 'name' }} />)
    expect(screen.getByText('Jordan')).toBeInTheDocument()
    expect(screen.getByText('$1,200')).toBeInTheDocument()
  })
})
```

- [ ] **Step 3: KanbanView.** Create `src/components/workspaces/views/KanbanView.tsx`:
```tsx
'use client'

import type { GridField, GridRecord } from '../useWorkspaceGrid'
import { groupRecordsByField, UNCATEGORIZED } from '@/lib/workspaces/kanban'
import { formatFieldValue } from '@/lib/workspaces/format-value'

export function KanbanView({ fields, records, config }: { fields: GridField[]; records: GridRecord[]; config: any }) {
  const groupKey: string | undefined = config?.groupByField
  const groupField = fields.find((f) => f.key === groupKey)
  if (!groupField || groupField.type !== 'choice') {
    return <div className="rounded-2xl border border-dashed border-border p-12 text-center text-muted-foreground">This board needs a single-select field to group by.</div>
  }
  const options: string[] = groupField.config?.options ?? []
  const groups = groupRecordsByField(records, groupKey!, options)
  const columns = [...options, UNCATEGORIZED]
  const titleKey = fields.find((f) => f.type === 'text')?.key || fields[0]?.key
  const titleField = fields.find((f) => f.key === titleKey)

  return (
    <div className="flex gap-4 overflow-x-auto pb-2">
      {columns.map((col) => (
        <div key={col} className="w-64 shrink-0 rounded-xl border border-border bg-muted/30 p-3">
          <div className="mb-2 flex items-center justify-between text-sm font-semibold">
            <span>{col === UNCATEGORIZED ? 'Uncategorized' : col}</span>
            <span className="text-muted-foreground">{groups[col].length}</span>
          </div>
          <div className="space-y-2">
            {groups[col].map((rec) => (
              <div key={rec.id} className="rounded-lg border border-border bg-surface p-2.5 text-sm shadow-soft">
                {titleField ? String(formatFieldValue(titleField.type, rec.data[titleKey!], titleField.config) || '—') : rec.id}
              </div>
            ))}
            {groups[col].length === 0 && <div className="py-2 text-center text-xs text-muted-foreground">—</div>}
          </div>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Compile + verify + delete-check.**
```bash
grep -rn "WorkspaceGrid" src/ | grep -v "WorkspaceGrid.test" || echo "no WorkspaceGrid refs (good)"
npx tsc --noEmit 2>&1 | grep -iE 'workspace|view|gallery|kanban' || echo clean
npx next lint 2>&1 | grep -iE 'GalleryView|KanbanView|WorkspaceViews|Error:' || echo "no lint errors"
npx vitest run src/components/workspaces src/lib/workspaces src/app/api/workspaces
```
Expected: no WorkspaceGrid refs, no tsc/lint output, tests green.

- [ ] **Step 5: Commit Tasks 3 + 4 together.**
```bash
git add src/components/workspaces "src/app/(dashboard)/workspaces/[id]/page.tsx"
git commit -m "feat(workspaces): view switcher + GridView/GalleryView/KanbanView + AddViewModal"
```

---

### Task 5: Verify + browser smoke + PR
- [ ] Full gate: `npx tsc --noEmit` (0), `npx next lint` (no errors), `npx vitest run` (all green).
- [ ] Browser smoke (Chrome plugin, per `browser-smoke-tooling` memory — inject the `galli-auth` cookie via CDP, use LONG waits due to slow dev compile, verify via DB): seed a workspace with a `choice` field + records, create a Gallery + a Kanban view, switch between them, screenshot each. Confirm the same records render as grid/cards/columns.
- [ ] Push `workspaces-c-views`; open PR (base main): summary of the 3 renderers + switcher + saved views, no migration.

## Out of scope
Calendar/Map/Timeline, kanban drag-to-move, per-view filters/sort/visible-fields, editing in Gallery/Kanban, view rename/reorder, public rendering of views.
