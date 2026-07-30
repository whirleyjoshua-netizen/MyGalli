'use client'
import type { InspectorProps } from './DefaultInspector'
import type { CanvasElement } from '@/lib/types/canvas'

const FIELD = 'mt-1 w-full text-sm bg-muted rounded-md px-2 py-1.5 border border-border focus:outline-none focus:ring-2 focus:ring-primary'
const TYPES = ['bar', 'line', 'pie'] as const

// Every effect flag defaults to ON in ChartElement (`?? true`) — the inspector
// must read them the same way or the boxes lie about what the chart renders.
const EFFECTS: { key: keyof CanvasElement; label: string }[] = [
  { key: 'chartEnable3D', label: '3D effect' },
  { key: 'chartEnableGlow', label: 'Glow' },
  { key: 'chartEnableGradient', label: 'Gradient' },
  { key: 'chartShowValues', label: 'Show values' },
  { key: 'chartShowLegend', label: 'Legend' },
  { key: 'chartShowGrid', label: 'Grid' },
]

export function ChartInspector({ element, onChange }: InspectorProps) {
  const chartType = element.chartType ?? 'bar'
  const nodeSize = element.chartNodeSize ?? 8

  return (
    <div className="px-3 py-2 space-y-3">
      <label className="block text-xs text-muted-foreground">
        Title
        <input type="text" value={element.chartTitle ?? ''} placeholder="Chart Title" className={FIELD}
          onChange={(e) => onChange({ chartTitle: e.target.value })} />
      </label>

      <div className="text-xs text-muted-foreground">
        Type
        <div className="mt-1 flex gap-1">
          {TYPES.map((t) => (
            <button key={t} type="button" aria-pressed={chartType === t}
              onClick={() => onChange({ chartType: t })}
              className={`flex-1 py-1.5 text-xs font-medium rounded-md border capitalize transition ${
                chartType === t ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'
              }`}>
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2 border-t border-border pt-2">
        <div className="text-xs text-muted-foreground">Visual effects</div>
        {EFFECTS.map((fx) => (
          <label key={fx.key} className="flex items-center gap-2 text-xs text-muted-foreground">
            <input type="checkbox" className="rounded" checked={element[fx.key] !== false}
              onChange={(e) => onChange({ [fx.key]: e.target.checked })} />
            {fx.label}
          </label>
        ))}

        {chartType === 'line' && (
          <label className="block text-xs text-muted-foreground">
            Node size: {nodeSize}px
            <input type="range" min={0} max={20} value={nodeSize} className="mt-1 w-full"
              onChange={(e) => onChange({ chartNodeSize: parseInt(e.target.value) })} />
          </label>
        )}
      </div>

      <p className="text-[11px] text-muted-foreground/70 border-t border-border pt-2">
        Data points are edited on the card, where there is room for the rows.
      </p>
    </div>
  )
}
