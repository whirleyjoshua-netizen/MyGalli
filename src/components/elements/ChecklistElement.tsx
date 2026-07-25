'use client'

import { Plus, X, Trash2 } from 'lucide-react'
import type { CanvasElement } from '@/lib/types/canvas'
import { checklistProgress } from '@/lib/checklist'

interface Props {
  element: CanvasElement
  onChange: (updates: Partial<CanvasElement>) => void
  onDelete: () => void
  isSelected: boolean
  onSelect: () => void
}

type Item = { id: string; text: string; done: boolean }

export function ChecklistElement({ element, onChange, onDelete, isSelected, onSelect }: Props) {
  const items: Item[] = element.checklistItems ?? []
  const showProgress = element.checklistShowProgress !== false
  const { done, total, pct } = checklistProgress(items)

  const setItems = (next: Item[]) => onChange({ checklistItems: next })
  const toggle = (i: number) => setItems(items.map((it, idx) => (idx === i ? { ...it, done: !it.done } : it)))
  const setText = (i: number, text: string) => setItems(items.map((it, idx) => (idx === i ? { ...it, text } : it)))
  const remove = (i: number) => setItems(items.filter((_, idx) => idx !== i))
  const add = () =>
    setItems([...items, { id: `chk-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, text: '', done: false }])

  return (
    <div
      onClick={onSelect}
      className={`w-full rounded-xl border p-3 ${isSelected ? 'border-primary/40 bg-muted/30' : 'border-border'}`}
    >
      <div className="flex items-center gap-2 mb-2">
        <input
          aria-label="Checklist title"
          value={element.checklistTitle ?? ''}
          onChange={(e) => onChange({ checklistTitle: e.target.value })}
          placeholder="Checklist title"
          className="flex-1 bg-transparent text-base font-semibold outline-none"
        />
        <button onClick={onDelete} aria-label="Delete element" className="p-1.5 text-muted-foreground hover:text-destructive">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {showProgress && total > 0 && (
        <div className="mb-2 text-xs text-muted-foreground">{done} of {total} · {pct}%</div>
      )}

      <ul className="space-y-1.5">
        {items.map((it, i) => (
          <li key={it.id} className="flex items-center gap-2">
            <input
              type="checkbox"
              aria-label={it.text || `item ${i + 1}`}
              checked={it.done}
              onChange={() => toggle(i)}
              className="h-4 w-4 accent-primary"
            />
            <input
              value={it.text}
              onChange={(e) => setText(i, e.target.value)}
              placeholder="Item text"
              className="flex-1 bg-transparent text-sm outline-none"
            />
            <button onClick={() => remove(i)} aria-label="Remove item" className="p-1 text-muted-foreground hover:text-destructive">
              <X className="h-3.5 w-3.5" />
            </button>
          </li>
        ))}
      </ul>

      <button onClick={add} className="mt-2 inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
        <Plus className="h-3.5 w-3.5" /> Add item
      </button>

      <label className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
        <input
          type="checkbox"
          aria-label="Show progress bar"
          checked={showProgress}
          onChange={(e) => onChange({ checklistShowProgress: e.target.checked })}
          className="h-3.5 w-3.5 accent-primary"
        />
        Show progress bar
      </label>
    </div>
  )
}
