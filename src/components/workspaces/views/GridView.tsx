'use client'

import { useState } from 'react'
import { Plus, Trash2, ChevronUp, ChevronDown } from 'lucide-react'
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
                  <button
                    onClick={() => grid.setSort(f.key)}
                    title={`Sort by ${f.label}`}
                    aria-label={`Sort by ${f.label}`}
                    className="flex items-center gap-1"
                  >
                    {f.label}
                    {grid.activeSort?.field === f.key && (grid.activeSort.dir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
                  </button>
                  {f.required ? <span className="text-red-500">*</span> : null}
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
