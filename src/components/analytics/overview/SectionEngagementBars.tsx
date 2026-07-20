'use client'

import { LayoutGrid } from 'lucide-react'
import { DataIllustration } from '@/components/analytics/DataIllustration'
import type { SectionEngagementRow } from '@/lib/data-overview'

export function SectionEngagementBars({ rows }: { rows: SectionEngagementRow[] }) {
  const max = Math.max(...rows.map((r) => r.count), 1)

  return (
    <div className="rounded-2xl border border-border bg-surface p-5 shadow-soft">
      <div className="mb-4 flex items-center gap-2">
        <LayoutGrid className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-bold">Top Content by Engagement</h3>
      </div>

      {rows.length === 0 ? (
        <div className="py-8 text-center">
          <DataIllustration variant="activity" />
          <p className="mt-3 text-sm font-medium">No section activity yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Once visitors interact with your sections, the busiest ones rank here.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => (
            <li key={row.id} className="flex items-center gap-3">
              <span className="w-28 shrink-0 truncate text-sm">{row.label}</span>
              <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                <span
                  className="block h-full rounded-full bg-galli"
                  style={{ width: `${(row.count / max) * 100}%` }}
                />
              </span>
              <span className="w-10 shrink-0 text-right text-xs text-muted-foreground">{row.count}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
