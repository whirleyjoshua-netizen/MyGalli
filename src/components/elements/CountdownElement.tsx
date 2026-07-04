'use client'

import { Trash2, Timer } from 'lucide-react'
import type { CanvasElement } from '@/lib/types/canvas'

interface Props {
  element: CanvasElement
  onChange: (updates: Partial<CanvasElement>) => void
  onDelete: () => void
  isSelected: boolean
  onSelect: () => void
}

export function CountdownElement({ element, onChange, onDelete, isSelected, onSelect }: Props) {
  return (
    <div
      className={`relative group rounded-xl border bg-background transition-all ${
        isSelected ? 'ring-2 ring-[#39D98A] border-[#39D98A]/30' : 'border-border hover:border-[#39D98A]/30'
      }`}
      onClick={(e) => { e.stopPropagation(); onSelect() }}
    >
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Timer className="w-4 h-4 text-[#39D98A]" />
          <input
            type="text"
            value={element.countdownTitle ?? 'Counting down'}
            onChange={(e) => onChange({ countdownTitle: e.target.value })}
            onClick={(e) => e.stopPropagation()}
            className="text-sm font-semibold bg-transparent border-none outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Target date &amp; time
            <input
              type="datetime-local"
              value={element.countdownTarget ?? ''}
              onChange={(e) => onChange({ countdownTarget: e.target.value })}
              onClick={(e) => e.stopPropagation()}
              className="text-sm bg-transparent border border-border rounded-md px-2 py-1"
            />
          </label>

          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Accent color
            <input
              type="color"
              value={element.countdownColor ?? '#39D98A'}
              onChange={(e) => onChange({ countdownColor: e.target.value })}
              onClick={(e) => e.stopPropagation()}
              className="w-10 h-8 rounded-md cursor-pointer border border-border"
            />
          </label>
        </div>

        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Expired message
          <input
            type="text"
            value={element.countdownExpiredText ?? "It's here! 🎉"}
            onChange={(e) => onChange({ countdownExpiredText: e.target.value })}
            onClick={(e) => e.stopPropagation()}
            className="text-sm bg-transparent border border-border rounded-md px-2 py-1"
          />
        </label>
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
