'use client'
import type { InspectorProps } from './DefaultInspector'

export function CollectionViewInspector({ element, onChange }: InspectorProps) {
  const cols = element.collectionColumns || 3

  return (
    <div className="px-3 py-2 space-y-3">
      <div className="text-xs text-muted-foreground">
        Columns
        <div className="mt-1 flex gap-1">
          {[2, 3, 4].map((c) => (
            <button key={c} type="button" aria-pressed={cols === c}
              onClick={() => onChange({ collectionColumns: c as 2 | 3 | 4 })}
              className={`flex-1 py-1.5 text-xs font-medium rounded-md border transition ${
                cols === c ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'
              }`}>
              {c}
            </button>
          ))}
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground/70 border-t border-border pt-2">
        Use “Manage pages” on the card to choose which pages appear.
      </p>
    </div>
  )
}
