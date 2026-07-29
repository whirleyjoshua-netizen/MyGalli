'use client'
import type { InspectorProps } from './DefaultInspector'

const FIELD = 'mt-1 w-full text-sm bg-muted rounded-md px-2 py-1.5 border border-border focus:outline-none focus:ring-2 focus:ring-primary'

export function IndexInspector({ element, onChange }: InspectorProps) {
  const count = (element.indexEntries ?? []).length

  return (
    <div className="px-3 py-2 space-y-3">
      <label className="block text-xs text-muted-foreground">
        View
        <select value={element.indexView ?? 'list'} className={FIELD}
          onChange={(e) => onChange({ indexView: e.target.value as 'list' | 'cards' })}>
          <option value="list">List</option>
          <option value="cards">Cards</option>
        </select>
      </label>

      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <input type="checkbox" className="rounded" checked={element.indexEnableSearch ?? true}
          onChange={(e) => onChange({ indexEnableSearch: e.target.checked })} />
        Search box
      </label>

      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <input type="checkbox" className="rounded" checked={element.indexEnableNumbers ?? true}
          onChange={(e) => onChange({ indexEnableNumbers: e.target.checked })} />
        Auto-number entries
      </label>

      <label className="block text-xs text-muted-foreground">
        Accent
        <input type="color" value={element.indexAccent ?? '#39D98A'}
          className="mt-1 h-8 w-full rounded-md border border-border cursor-pointer"
          onChange={(e) => onChange({ indexAccent: e.target.value })} />
      </label>

      <p className="text-[11px] text-muted-foreground/70 border-t border-border pt-2">
        {count} entries are edited on the card, along with the title and icon.
      </p>
    </div>
  )
}
