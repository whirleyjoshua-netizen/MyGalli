'use client'
import type { InspectorProps } from './DefaultInspector'

const FIELD = 'mt-1 w-full text-sm bg-muted rounded-md px-2 py-1.5 border border-border focus:outline-none focus:ring-2 focus:ring-primary'

export function MCQInspector({ element, onChange }: InspectorProps) {
  const count = (element.mcqOptions ?? []).length

  return (
    <div className="px-3 py-2 space-y-3">
      <label className="block text-xs text-muted-foreground">
        Question
        <input type="text" value={element.mcqQuestion ?? ''} className={FIELD}
          onChange={(e) => onChange({ mcqQuestion: e.target.value })} />
      </label>

      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <input type="checkbox" className="rounded" checked={element.mcqAllowMultiple ?? false}
          onChange={(e) => onChange({ mcqAllowMultiple: e.target.checked })} />
        Allow multiple selections
      </label>

      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <input type="checkbox" className="rounded" checked={element.mcqRequired ?? false}
          onChange={(e) => onChange({ mcqRequired: e.target.checked })} />
        Required
      </label>

      <p className="text-[11px] text-muted-foreground/70 border-t border-border pt-2">
        {count} options are edited on the card — click the block to add, rename or remove them.
      </p>
    </div>
  )
}
