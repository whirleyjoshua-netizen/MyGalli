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
