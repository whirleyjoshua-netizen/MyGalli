'use client'

import { Blocks } from 'lucide-react'
import { Sparkline } from '@/components/analytics/Sparkline'
import { DataIllustration } from '@/components/analytics/DataIllustration'
import type { WidgetPerformanceRow } from '@/lib/data-overview'

export function WidgetPerformanceTable({ rows }: { rows: WidgetPerformanceRow[] }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-5 shadow-soft">
      <div className="mb-4 flex items-center gap-2">
        <Blocks className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-bold">Widget Performance</h3>
      </div>

      {rows.length === 0 ? (
        <div className="py-8 text-center">
          <DataIllustration variant="device" />
          <p className="mt-3 text-sm font-medium">No widget activity yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Add an interactive element — a poll, form or rating — to start collecting signal.
          </p>
        </div>
      ) : (
        <ul className="space-y-4">
          {rows.map((row) => (
            <li key={row.elementType} className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{row.label}</p>
                <p className="truncate text-xs text-muted-foreground">{row.stat}</p>
              </div>
              <div className="w-24 shrink-0 text-galli">
                <Sparkline values={row.trend} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
