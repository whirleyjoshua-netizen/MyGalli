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
