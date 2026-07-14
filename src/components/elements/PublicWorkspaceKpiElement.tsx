'use client'

import { CanvasElement } from '@/lib/types/canvas'

const AGG_LABEL: Record<string, string> = { count: 'Count', sum: 'Sum', avg: 'Avg', min: 'Min', max: 'Max' }

export function kpiDefaultLabel(element: CanvasElement): string {
  if (element.workspaceKpiLabel) return element.workspaceKpiLabel
  const agg = AGG_LABEL[element.workspaceKpiAgg || 'avg'] || 'Value'
  const field = element.workspaceKpiFieldLabel
  if (element.workspaceKpiAgg === 'count') return field ? `Count of ${field}` : 'Count'
  return field ? `${agg} of ${field}` : agg
}

export function formatKpiValue(value: number | null | undefined, suffix?: string): string {
  if (value === null || value === undefined) return '—'
  return `${value}${suffix || ''}`
}

export function PublicWorkspaceKpiElement({ element }: { element: CanvasElement }) {
  return (
    <div className="rounded-xl border border-border bg-surface px-6 py-5 text-center">
      <div className="text-3xl font-bold text-galli">
        {formatKpiValue(element.workspaceKpiValue, element.workspaceKpiSuffix)}
      </div>
      <div className="mt-1 text-sm text-muted-foreground">{kpiDefaultLabel(element)}</div>
    </div>
  )
}
