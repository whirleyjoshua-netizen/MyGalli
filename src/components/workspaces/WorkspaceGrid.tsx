'use client'

import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { useWorkspaceGrid } from './useWorkspaceGrid'
import { GridCell } from './cells/GridCell'
import { ColumnEditorPopover } from './ColumnEditorPopover'

export function WorkspaceGrid({ workspaceId }: { workspaceId: string }) {
  const grid = useWorkspaceGrid(workspaceId)
  const [addingColumn, setAddingColumn] = useState(false)

  if (grid.loading) return <div className="p-8 text-muted-foreground">Loading…</div>
  if (grid.error && !grid.workspace) {
    return (
      <div className="p-8">
        <p className="mb-3 text-red-500">Couldn&apos;t load this workspace.</p>
        <button onClick={grid.reload} className="rounded-lg border border-border px-4 py-2">Retry</button>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col p-6 lg:p-8">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">{grid.workspace?.name}</h1>
        {grid.error && <span className="text-sm text-red-500">{grid.error}</span>}
      </div>

      {grid.fields.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center">
          <p className="mb-4 text-muted-foreground">Add your first column to get started.</p>
          <button onClick={() => setAddingColumn(true)} className="rounded-lg bg-galli px-4 py-2 font-medium text-white">
            Add column
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-surface">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted text-xs uppercase text-muted-foreground">
              <tr>
                {grid.fields.map((f) => (
                  <th key={f.id} className="group px-4 py-3 text-left font-semibold">
                    <span className="flex items-center gap-1">
                      {f.label}{f.required ? <span className="text-red-500">*</span> : null}
                      <button
                        onClick={() => { if (confirm(`Delete column "${f.label}"?`)) grid.deleteField(f.id) }}
                        className="opacity-0 transition group-hover:opacity-100"
                        title="Delete column"
                      >
                        <Trash2 size={13} className="text-muted-foreground hover:text-red-500" />
                      </button>
                    </span>
                  </th>
                ))}
                <th className="px-3 py-3">
                  <button onClick={() => setAddingColumn(true)} title="Add column"><Plus size={16} /></button>
                </th>
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
                    <button
                      onClick={() => { if (confirm('Delete this row?')) grid.deleteRow(rec.id) }}
                      className="opacity-0 transition group-hover:opacity-100"
                      title="Delete row"
                    >
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
        </div>
      )}

      {addingColumn && (
        <ColumnEditorPopover
          onClose={() => setAddingColumn(false)}
          onSubmit={(label, type, config) => { grid.addField(label, type, config); setAddingColumn(false) }}
        />
      )}
    </div>
  )
}
