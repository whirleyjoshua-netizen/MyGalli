'use client'

import { Trash2 } from 'lucide-react'
import type { CanvasElement } from '@/lib/types/canvas'

interface Props {
  element: CanvasElement
  onChange: (updates: Partial<CanvasElement>) => void
  onDelete: () => void
  isSelected: boolean
  onSelect: () => void
}

export function SkillBarElement({ element, onChange, onDelete, isSelected, onSelect }: Props) {
  const proficiency = element.skillProficiency ?? 75

  return (
    <div
      className={`relative group rounded-xl border bg-background transition-all ${
        isSelected ? 'ring-2 ring-[#6C63FF] border-[#6C63FF]/30' : 'border-border hover:border-[#6C63FF]/30'
      }`}
      onClick={(e) => { e.stopPropagation(); onSelect() }}
    >
      <div className="p-4 space-y-3">
        {/* Inputs row */}
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            value={element.skillName || ''}
            onChange={(e) => onChange({ skillName: e.target.value })}
            onClick={(e) => e.stopPropagation()}
            placeholder="Skill name"
            className="flex-1 min-w-[160px] bg-transparent border-none outline-none font-medium text-foreground"
          />
          <input
            type="text"
            value={element.skillCategory || ''}
            onChange={(e) => onChange({ skillCategory: e.target.value })}
            onClick={(e) => e.stopPropagation()}
            placeholder="Category (optional)"
            className="bg-muted/30 border border-border rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[#6C63FF] w-40"
          />
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={0}
              max={100}
              value={proficiency}
              onChange={(e) => onChange({ skillProficiency: parseInt(e.target.value) })}
              onClick={(e) => e.stopPropagation()}
              className="w-24 accent-[#6C63FF]"
            />
            <span className="text-sm font-medium text-[#6C63FF] w-10 text-right">{proficiency}%</span>
          </div>
        </div>

        {/* Preview bar */}
        <div className="w-full bg-muted/50 rounded-full h-2.5 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#6C63FF] to-[#8B83FF] transition-all duration-300"
            style={{ width: `${proficiency}%` }}
          />
        </div>
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
