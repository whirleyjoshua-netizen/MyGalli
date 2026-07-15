'use client'

import { X, Filter } from 'lucide-react'
import { describeFilter, type FilterSpec, type FilterField } from '@/lib/workspaces/filter'
import type { GridField } from './useWorkspaceGrid'

export function FilterChips({
  filter,
  fields,
  count,
  onRemove,
}: {
  filter: FilterSpec | null
  fields: GridField[]
  count?: number
  onRemove?: () => void
}) {
  if (!filter) return null
  let text: string
  try {
    text = describeFilter(filter, fields as unknown as FilterField[])
  } catch {
    return null
  }

  return (
    <div className="mb-3 flex items-center gap-2 text-sm">
      <span className="inline-flex items-center gap-1.5 rounded-full bg-galli/10 px-3 py-1 font-medium text-galli">
        <Filter size={12} />
        {text}
      </span>
      {typeof count === 'number' && (
        <span className="text-muted-foreground">{count} matching</span>
      )}
      {onRemove && (
        <button onClick={onRemove} title="Remove filter" className="text-muted-foreground hover:text-red-500">
          <X size={14} />
        </button>
      )}
    </div>
  )
}
