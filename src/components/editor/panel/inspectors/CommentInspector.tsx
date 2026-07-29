'use client'
import type { InspectorProps } from './DefaultInspector'

export function CommentInspector({ element, onChange }: InspectorProps) {
  const maxLength = element.commentMaxLength ?? 1000

  return (
    <div className="px-3 py-2 space-y-3">
      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <input type="checkbox" className="rounded" checked={element.commentRequireName ?? true}
          onChange={(e) => onChange({ commentRequireName: e.target.checked })} />
        Require name
      </label>

      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <input type="checkbox" className="rounded" checked={element.commentRequireEmail ?? false}
          onChange={(e) => onChange({ commentRequireEmail: e.target.checked })} />
        Require email
      </label>

      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <input type="checkbox" className="rounded" checked={element.commentModerated ?? false}
          onChange={(e) => onChange({ commentModerated: e.target.checked })} />
        Moderate comments before they appear
      </label>

      <label className="block text-xs text-muted-foreground">
        Max length: {maxLength} chars
        <input type="range" min={100} max={5000} step={100} value={maxLength} className="mt-1 w-full"
          onChange={(e) => onChange({ commentMaxLength: parseInt(e.target.value) })} />
      </label>

      <p className="text-[11px] text-muted-foreground/70 border-t border-border pt-2">
        The title and theme are set on the card.
      </p>
    </div>
  )
}
