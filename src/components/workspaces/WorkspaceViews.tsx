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
