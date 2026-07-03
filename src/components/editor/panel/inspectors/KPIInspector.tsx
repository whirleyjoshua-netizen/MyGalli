'use client'
import type { InspectorProps } from './DefaultInspector'

export function KPIInspector({ element, onChange }: InspectorProps) {
  return (
    <div className="px-3 py-2 space-y-3">
      <label className="block text-xs text-muted-foreground">
        Label
        <input
          type="text"
          value={element.kpiLabel ?? ''}
          onChange={(e) => onChange({ kpiLabel: e.target.value })}
          className="mt-1 w-full text-sm bg-muted rounded-md px-2 py-1.5 border border-border focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </label>
      <label className="block text-xs text-muted-foreground">
        Value
        <input
          type="text"
          value={element.kpiValue ?? ''}
          onChange={(e) => onChange({ kpiValue: e.target.value })}
          className="mt-1 w-full text-sm bg-muted rounded-md px-2 py-1.5 border border-border focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </label>
    </div>
  )
}
