'use client'
import type { InspectorProps } from './DefaultInspector'

const FIELD = 'mt-1 w-full text-sm bg-muted rounded-md px-2 py-1.5 border border-border focus:outline-none focus:ring-2 focus:ring-primary'
const CHOICE = 'flex-1 py-1.5 text-xs font-medium rounded-md border transition'
const STYLES = [
  { id: 'stars' as const, label: 'Stars' },
  { id: 'numeric' as const, label: 'Numeric' },
]

export function RatingInspector({ element, onChange }: InspectorProps) {
  const style = element.ratingStyle ?? 'stars'
  const max = element.ratingMax ?? 5

  return (
    <div className="px-3 py-2 space-y-3">
      <label className="block text-xs text-muted-foreground">
        Question
        <input type="text" value={element.ratingQuestion ?? ''} className={FIELD}
          onChange={(e) => onChange({ ratingQuestion: e.target.value })} />
      </label>

      <div className="text-xs text-muted-foreground">
        Style
        <div className="mt-1 flex gap-1">
          {STYLES.map((s) => (
            <button key={s.id} type="button" aria-pressed={style === s.id}
              onClick={() => onChange({ ratingStyle: s.id })}
              className={`${CHOICE} ${style === s.id ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'}`}>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="text-xs text-muted-foreground">
        Max value
        <div className="mt-1 flex gap-1">
          {[5, 10].map((v) => (
            <button key={v} type="button" aria-pressed={max === v}
              onClick={() => onChange({ ratingMax: v })}
              className={`${CHOICE} ${max === v ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'}`}>
              {v}
            </button>
          ))}
        </div>
      </div>

      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <input type="checkbox" className="rounded" checked={element.ratingRequired ?? false}
          onChange={(e) => onChange({ ratingRequired: e.target.checked })} />
        Required
      </label>
    </div>
  )
}
