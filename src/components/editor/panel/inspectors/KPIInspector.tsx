'use client'
import type { InspectorProps } from './DefaultInspector'
import { COLOR_THEMES } from '@/components/elements/KPIElement'

const TRENDS = [
  { id: 'up' as const, label: 'Up' },
  { id: 'neutral' as const, label: 'None' },
  { id: 'down' as const, label: 'Down' },
]

export function KPIInspector({ element, onChange }: InspectorProps) {
  const trend = element.kpiTrend ?? 'neutral'
  const color = element.kpiColor ?? 'blue'
  const field = 'mt-1 w-full text-sm bg-muted rounded-md px-2 py-1.5 border border-border focus:outline-none focus:ring-2 focus:ring-primary'

  return (
    <div className="px-3 py-2 space-y-3">
      <label className="block text-xs text-muted-foreground">
        Label
        <input type="text" value={element.kpiLabel ?? ''} className={field}
          onChange={(e) => onChange({ kpiLabel: e.target.value })} />
      </label>

      <label className="block text-xs text-muted-foreground">
        Value
        <input type="text" value={element.kpiValue ?? ''} className={field}
          onChange={(e) => onChange({ kpiValue: e.target.value })} />
      </label>

      <div className="grid grid-cols-2 gap-2">
        <label className="block text-xs text-muted-foreground">
          Prefix
          <input type="text" value={element.kpiPrefix ?? ''} placeholder="$" className={field}
            onChange={(e) => onChange({ kpiPrefix: e.target.value })} />
        </label>
        <label className="block text-xs text-muted-foreground">
          Suffix
          <input type="text" value={element.kpiSuffix ?? ''} placeholder="%" className={field}
            onChange={(e) => onChange({ kpiSuffix: e.target.value })} />
        </label>
      </div>

      <div className="text-xs text-muted-foreground">
        Trend
        <div className="mt-1 flex gap-1">
          {TRENDS.map((t) => (
            <button key={t.id} type="button" aria-pressed={trend === t.id}
              onClick={() => onChange({ kpiTrend: t.id })}
              className={`flex-1 py-1.5 text-xs font-medium rounded-md border transition ${
                trend === t.id ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'
              }`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <label className="block text-xs text-muted-foreground">
        Trend text
        <input type="text" value={element.kpiTrendValue ?? ''} placeholder="+12% from last month" className={field}
          onChange={(e) => onChange({ kpiTrendValue: e.target.value })} />
      </label>

      <div className="text-xs text-muted-foreground">
        Colour
        <div className="mt-1 flex gap-2">
          {(Object.keys(COLOR_THEMES) as Array<keyof typeof COLOR_THEMES>).map((c) => (
            <button key={c} type="button" aria-label={c} aria-pressed={color === c}
              onClick={() => onChange({ kpiColor: c })}
              className={`w-7 h-7 rounded-full bg-gradient-to-br ${COLOR_THEMES[c].gradient} transition ${
                color === c ? 'ring-2 ring-offset-2 ring-foreground scale-110' : 'hover:scale-105'
              }`} />
          ))}
        </div>
      </div>
    </div>
  )
}
