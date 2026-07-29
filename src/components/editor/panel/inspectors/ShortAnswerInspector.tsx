'use client'
import type { InspectorProps } from './DefaultInspector'

const FIELD = 'mt-1 w-full text-sm bg-muted rounded-md px-2 py-1.5 border border-border focus:outline-none focus:ring-2 focus:ring-primary'

export function ShortAnswerInspector({ element, onChange }: InspectorProps) {
  const maxLength = element.shortAnswerMaxLength ?? 500

  return (
    <div className="px-3 py-2 space-y-3">
      <label className="block text-xs text-muted-foreground">
        Question
        <input type="text" value={element.shortAnswerQuestion ?? ''} className={FIELD}
          onChange={(e) => onChange({ shortAnswerQuestion: e.target.value })} />
      </label>

      <label className="block text-xs text-muted-foreground">
        Placeholder
        <input type="text" value={element.shortAnswerPlaceholder ?? ''} placeholder="Type your answer..." className={FIELD}
          onChange={(e) => onChange({ shortAnswerPlaceholder: e.target.value })} />
      </label>

      <label className="block text-xs text-muted-foreground">
        Max length: {maxLength}
        <input type="range" min={50} max={2000} step={50} value={maxLength} className="mt-1 w-full"
          onChange={(e) => onChange({ shortAnswerMaxLength: Number(e.target.value) })} />
      </label>

      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <input type="checkbox" className="rounded" checked={element.shortAnswerRequired ?? false}
          onChange={(e) => onChange({ shortAnswerRequired: e.target.checked })} />
        Required
      </label>
    </div>
  )
}
