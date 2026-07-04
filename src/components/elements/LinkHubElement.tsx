'use client'

import { Trash2, X, Plus, ArrowUp, ArrowDown, Link2 } from 'lucide-react'
import type { CanvasElement } from '@/lib/types/canvas'
import { LINK_ICON_KEYS } from './PublicLinkHubElement'

interface Props {
  element: CanvasElement
  onChange: (updates: Partial<CanvasElement>) => void
  onDelete: () => void
  isSelected: boolean
  onSelect: () => void
}

export function LinkHubElement({ element, onChange, onDelete, isSelected, onSelect }: Props) {
  const items = element.linkHubItems || []
  const set = (next: typeof items) => onChange({ linkHubItems: next })
  const update = (i: number, patch: Partial<{ label: string; url: string; icon: string }>) =>
    set(items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)))
  const remove = (i: number) => set(items.filter((_, idx) => idx !== i))
  const move = (i: number, d: -1 | 1) => {
    const j = i + d
    if (j < 0 || j >= items.length) return
    const next = [...items]
    ;[next[i], next[j]] = [next[j], next[i]]
    set(next)
  }
  const addLink = () => set([...items, { label: '', url: '', icon: 'website' }])

  return (
    <div
      className={`relative group rounded-xl border bg-background transition-all ${
        isSelected ? 'ring-2 ring-primary border-primary/30' : 'border-border hover:border-primary/30'
      }`}
      onClick={(e) => { e.stopPropagation(); onSelect() }}
    >
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Link2 className="w-4 h-4 text-primary" />
          <input
            type="text"
            value={element.linkHubTitle ?? ''}
            onChange={(e) => onChange({ linkHubTitle: e.target.value })}
            onClick={(e) => e.stopPropagation()}
            placeholder="Link hub title"
            className="text-sm font-semibold bg-transparent border-none outline-none flex-1"
          />
        </div>

        <div className="space-y-2">
          {items.map((item, i) => (
            <div key={i} className="flex items-center gap-2 p-2 rounded-lg border border-border">
              <select
                value={item.icon ?? 'website'}
                onChange={(e) => update(i, { icon: e.target.value })}
                onClick={(e) => e.stopPropagation()}
                className="text-xs bg-transparent border border-border rounded px-1 py-1"
              >
                {LINK_ICON_KEYS.map((key) => (
                  <option key={key} value={key}>{key}</option>
                ))}
              </select>
              <input
                type="text"
                value={item.label}
                onChange={(e) => update(i, { label: e.target.value })}
                onClick={(e) => e.stopPropagation()}
                placeholder="Label"
                className="text-sm bg-transparent border border-border rounded px-2 py-1 w-24"
              />
              <input
                type="text"
                value={item.url}
                onChange={(e) => update(i, { url: e.target.value })}
                onClick={(e) => e.stopPropagation()}
                placeholder="https://..."
                className="text-sm bg-transparent border border-border rounded px-2 py-1 flex-1 min-w-0"
              />
              <button
                onClick={(e) => { e.stopPropagation(); move(i, -1) }}
                disabled={i === 0}
                className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"
              >
                <ArrowUp className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); move(i, 1) }}
                disabled={i === items.length - 1}
                className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"
              >
                <ArrowDown className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); remove(i) }}
                className="p-1 text-muted-foreground hover:text-destructive"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>

        <button
          onClick={(e) => { e.stopPropagation(); addLink() }}
          className="flex items-center gap-1.5 text-sm text-primary hover:opacity-80 font-medium transition"
        >
          <Plus className="w-3.5 h-3.5" />
          Add link
        </button>
      </div>

      {isSelected && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete() }}
          className="absolute -top-3 -right-3 p-1.5 bg-background border border-border rounded-md shadow-sm hover:bg-destructive hover:text-destructive-foreground transition"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  )
}
