'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Plus, X, Upload } from 'lucide-react'
import { useWorkspaceGrid, PAGE_SIZE } from './useWorkspaceGrid'
import { GridView } from './views/GridView'
import { GalleryView } from './views/GalleryView'
import { KanbanView } from './views/KanbanView'
import { AddViewModal } from './AddViewModal'
import { FilterChips } from './FilterChips'
import { ImportCsvModal } from './ImportCsvModal'

export function WorkspaceViews({ workspaceId }: { workspaceId: string }) {
  const router = useRouter()
  const params = useSearchParams()
  const grid = useWorkspaceGrid(workspaceId, params.get('view'))
  const [addingView, setAddingView] = useState(false)
  const [importing, setImporting] = useState(false)
  // Local, always-mounted controlled state for the search input. Typing here
  // never touches `grid.search` (the fetch driver) directly — a debounced
  // effect below pushes it after a pause. This keeps the <input> node itself
  // stable across the loading gate below, so typing can never lose focus,
  // and keeps every keystroke from firing a full-table ILIKE scan.
  const [searchInput, setSearchInput] = useState(grid.search)

  // Debounce: push the local input value to the hook's fetch-driving `search`
  // state ~300ms after the user stops typing.
  useEffect(() => {
    const t = setTimeout(() => grid.setSearch(searchInput), 300)
    return () => clearTimeout(t)
  }, [searchInput, grid.setSearch])

  // Keep the visible input in sync when the active view changes (the hook
  // clears `grid.search` on view switch — mirror that locally so the box
  // doesn't show a stale query for the new view).
  useEffect(() => { setSearchInput('') }, [grid.activeViewId])

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
  const active = views.find((v) => v.id === grid.activeViewId) ?? views[0]

  function switchTo(id: string) {
    grid.setActiveViewId(id)
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
        <button onClick={() => setImporting(true)} className="ml-1 flex items-center gap-1 px-2 py-2 text-sm text-muted-foreground hover:text-galli" title="Import CSV">
          <Upload size={14} /> Import CSV
        </button>
      </div>

      {/* Search box, filter chips and errors derive from view config / local
          state, not from the in-flight records fetch — they stay mounted
          across loading states so typing never loses focus and the pager
          buttons never vanish mid-click. */}
      <input
        value={searchInput}
        onChange={(e) => setSearchInput(e.target.value)}
        placeholder="Search records…"
        className="mb-3 w-full max-w-xs rounded-lg border border-border bg-transparent px-3 py-2 text-sm"
      />
      <FilterChips
        filter={active?.config?.filter ?? null}
        fields={grid.fields}
        count={grid.total ?? undefined}
        onRemove={active ? () => {
          const { filter: _filter, ...rest } = active.config ?? {}
          grid.updateView(active.id, rest)
        } : undefined}
      />
      {grid.filterError && (
        <p className="mb-3 text-sm text-amber-600">
          This view&apos;s filter no longer matches the columns ({grid.filterError}) — showing all records.
        </p>
      )}
      {grid.sortError && (
        <p className="mb-3 text-sm text-amber-600">
          This view&apos;s sort no longer matches the columns — showing default order.
        </p>
      )}

      {/* Only the records-dependent body sits behind the loading gate. */}
      {active && grid.recordsViewId === active.id ? (
        active.type === 'gallery' ? (
          <GalleryView fields={grid.fields} records={grid.records} config={active.config} />
        ) : active.type === 'kanban' ? (
          <KanbanView fields={grid.fields} records={grid.records} config={active.config} />
        ) : (
          <GridView grid={grid} />
        )
      ) : (
        <div className="p-8 text-muted-foreground">Loading…</div>
      )}

      {typeof grid.total === 'number' && grid.total > 0 && (() => {
        const from = (grid.page - 1) * PAGE_SIZE + 1
        const to = Math.min(grid.page * PAGE_SIZE, grid.total)
        return (
          <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
            <span>Showing {from}–{to} of {grid.total}</span>
            <div className="flex gap-2">
              <button disabled={grid.page <= 1} onClick={() => grid.setPage(grid.page - 1)}
                className="rounded-lg border border-border px-3 py-1 disabled:opacity-40">‹ Prev</button>
              <button disabled={to >= grid.total} onClick={() => grid.setPage(grid.page + 1)}
                className="rounded-lg border border-border px-3 py-1 disabled:opacity-40">Next ›</button>
            </div>
          </div>
        )
      })()}

      {addingView && (
        <AddViewModal fields={grid.fields} workspaceId={workspaceId} onClose={() => setAddingView(false)}
          onSubmit={async (name, type, config) => {
            setAddingView(false)
            const v = await grid.addView(name, type, config)
            if (v) switchTo(v.id)
          }} />
      )}

      {importing && (
        <ImportCsvModal
          workspaceId={workspaceId}
          fields={grid.fields}
          onClose={() => setImporting(false)}
          onImported={() => grid.reload()}
        />
      )}
    </div>
  )
}
