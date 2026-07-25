'use client'

import { Check } from 'lucide-react'
import type { CanvasElement } from '@/lib/types/canvas'
import { checklistProgress } from '@/lib/checklist'

export function PublicChecklistElement({ element }: { element: CanvasElement }) {
  const items = element.checklistItems ?? []
  const showProgress = element.checklistShowProgress !== false
  const { done, total, pct } = checklistProgress(items)

  return (
    <div className="w-full">
      {element.checklistTitle && (
        <h3 className="text-base font-semibold text-foreground mb-2">{element.checklistTitle}</h3>
      )}

      {showProgress && total > 0 && (
        <div className="mb-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
            <span>{done} of {total}</span>
            <span>{pct}%</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}

      {total === 0 ? (
        <p className="text-sm text-muted-foreground">No items yet.</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((it) => (
            <li key={it.id} data-done={it.done} className="flex items-start gap-2.5 text-sm">
              <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                it.done ? 'border-primary bg-primary text-primary-foreground' : 'border-border'
              }`}>
                {it.done && <Check className="h-3 w-3" />}
              </span>
              <span className={it.done ? 'text-muted-foreground line-through' : 'text-foreground'}>{it.text}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
