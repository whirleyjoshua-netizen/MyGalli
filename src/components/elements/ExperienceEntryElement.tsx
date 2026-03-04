'use client'

import { Trash2, Briefcase } from 'lucide-react'
import type { CanvasElement } from '@/lib/types/canvas'

interface Props {
  element: CanvasElement
  onChange: (updates: Partial<CanvasElement>) => void
  onDelete: () => void
  isSelected: boolean
  onSelect: () => void
}

export function ExperienceEntryElement({ element, onChange, onDelete, isSelected, onSelect }: Props) {
  return (
    <div
      className={`relative group rounded-xl border bg-background transition-all ${
        isSelected ? 'ring-2 ring-[#6C63FF] border-[#6C63FF]/30' : 'border-border hover:border-[#6C63FF]/30'
      }`}
      onClick={(e) => { e.stopPropagation(); onSelect() }}
    >
      {/* Violet left accent */}
      <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl bg-[#6C63FF]" />

      <div className="p-4 pl-5 space-y-3">
        {/* Header row */}
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-[#6C63FF]/10 text-[#6C63FF] mt-0.5">
            <Briefcase className="w-4 h-4" />
          </div>
          <div className="flex-1 space-y-2">
            <input
              type="text"
              value={element.expTitle || ''}
              onChange={(e) => onChange({ expTitle: e.target.value })}
              onClick={(e) => e.stopPropagation()}
              placeholder="Job Title"
              className="w-full bg-transparent border-none outline-none font-semibold text-foreground text-lg"
            />
            <input
              type="text"
              value={element.expCompany || ''}
              onChange={(e) => onChange({ expCompany: e.target.value })}
              onClick={(e) => e.stopPropagation()}
              placeholder="Company Name"
              className="w-full bg-transparent border-none outline-none text-foreground/80"
            />
          </div>
        </div>

        {/* Location & Dates */}
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            value={element.expLocation || ''}
            onChange={(e) => onChange({ expLocation: e.target.value })}
            onClick={(e) => e.stopPropagation()}
            placeholder="City, State"
            className="bg-muted/30 border border-border rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[#6C63FF] w-36"
          />
          <input
            type="text"
            value={element.expStartDate || ''}
            onChange={(e) => onChange({ expStartDate: e.target.value })}
            onClick={(e) => e.stopPropagation()}
            placeholder="Start (MM/YYYY)"
            className="bg-muted/30 border border-border rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[#6C63FF] w-36"
          />
          <span className="text-muted-foreground text-sm">—</span>
          {element.expCurrent ? (
            <span className="px-3 py-1.5 bg-[#6C63FF]/10 text-[#6C63FF] rounded-lg text-sm font-medium">Present</span>
          ) : (
            <input
              type="text"
              value={element.expEndDate || ''}
              onChange={(e) => onChange({ expEndDate: e.target.value })}
              onClick={(e) => e.stopPropagation()}
              placeholder="End (MM/YYYY)"
              className="bg-muted/30 border border-border rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[#6C63FF] w-36"
            />
          )}
          <label className="flex items-center gap-1.5 text-sm text-muted-foreground cursor-pointer" onClick={(e) => e.stopPropagation()}>
            <input
              type="checkbox"
              checked={element.expCurrent || false}
              onChange={(e) => onChange({ expCurrent: e.target.checked })}
              className="rounded accent-[#6C63FF]"
            />
            Current
          </label>
        </div>

        {/* Description */}
        <textarea
          value={element.expDescription || ''}
          onChange={(e) => onChange({ expDescription: e.target.value })}
          onClick={(e) => e.stopPropagation()}
          placeholder="Describe your key responsibilities and achievements..."
          rows={3}
          className="w-full bg-muted/30 border border-border rounded-lg p-3 outline-none text-sm text-foreground/80 resize-none focus:ring-2 focus:ring-[#6C63FF]"
        />
      </div>

      {/* Delete button */}
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
