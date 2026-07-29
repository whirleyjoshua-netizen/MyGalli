'use client'
import type { InspectorProps } from './DefaultInspector'

const FIELD = 'mt-1 w-full text-sm bg-muted rounded-md px-2 py-1.5 border border-border focus:outline-none focus:ring-2 focus:ring-primary'

export function PollInspector({ element, onChange }: InspectorProps) {
  const count = (element.pollOptions ?? []).length

  return (
    <div className="px-3 py-2 space-y-3">
      <label className="block text-xs text-muted-foreground">
        Question
        <input type="text" value={element.pollQuestion ?? ''} placeholder="What do you think?" className={FIELD}
          onChange={(e) => onChange({ pollQuestion: e.target.value })} />
      </label>

      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <input type="checkbox" className="rounded" checked={element.pollAllowMultiple ?? false}
          onChange={(e) => onChange({ pollAllowMultiple: e.target.checked })} />
        Allow multiple selections
      </label>

      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <input type="checkbox" className="rounded" checked={element.pollShowResultsBeforeVote ?? false}
          onChange={(e) => onChange({ pollShowResultsBeforeVote: e.target.checked })} />
        Show results before voting
      </label>

      <p className="text-[11px] text-muted-foreground/70 border-t border-border pt-2">
        {count} options are edited on the card — click the block to add, rename or remove them (max 8).
      </p>
    </div>
  )
}
