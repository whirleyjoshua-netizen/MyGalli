'use client'

import { Trash2, GraduationCap } from 'lucide-react'
import type { CanvasElement } from '@/lib/types/canvas'

interface Props {
  element: CanvasElement
  onChange: (updates: Partial<CanvasElement>) => void
  onDelete: () => void
  isSelected: boolean
  onSelect: () => void
}

export function EducationEntryElement({ element, onChange, onDelete, isSelected, onSelect }: Props) {
  return (
    <div
      className={`relative group rounded-xl border bg-background transition-all ${
        isSelected ? 'ring-2 ring-[#6C63FF] border-[#6C63FF]/30' : 'border-border hover:border-[#6C63FF]/30'
      }`}
      onClick={(e) => { e.stopPropagation(); onSelect() }}
    >
      <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl bg-[#6C63FF]" />

      <div className="p-4 pl-5 space-y-3">
        {/* Header */}
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-[#6C63FF]/10 text-[#6C63FF] mt-0.5">
            <GraduationCap className="w-4 h-4" />
          </div>
          <div className="flex-1 space-y-2">
            <input
              type="text"
              value={element.eduInstitution || ''}
              onChange={(e) => onChange({ eduInstitution: e.target.value })}
              onClick={(e) => e.stopPropagation()}
              placeholder="University / School Name"
              className="w-full bg-transparent border-none outline-none font-semibold text-foreground text-lg"
            />
            <div className="flex flex-wrap gap-2">
              <input
                type="text"
                value={element.eduDegree || ''}
                onChange={(e) => onChange({ eduDegree: e.target.value })}
                onClick={(e) => e.stopPropagation()}
                placeholder="Degree (e.g. B.S.)"
                className="bg-muted/30 border border-border rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[#6C63FF] w-40"
              />
              <input
                type="text"
                value={element.eduField || ''}
                onChange={(e) => onChange({ eduField: e.target.value })}
                onClick={(e) => e.stopPropagation()}
                placeholder="Field of Study"
                className="bg-muted/30 border border-border rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[#6C63FF] flex-1 min-w-[160px]"
              />
            </div>
          </div>
        </div>

        {/* Metadata row */}
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            value={element.eduGpa || ''}
            onChange={(e) => onChange({ eduGpa: e.target.value })}
            onClick={(e) => e.stopPropagation()}
            placeholder="GPA"
            className="bg-muted/30 border border-border rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[#6C63FF] w-20"
          />
          <input
            type="text"
            value={element.eduStartDate || ''}
            onChange={(e) => onChange({ eduStartDate: e.target.value })}
            onClick={(e) => e.stopPropagation()}
            placeholder="Start (YYYY)"
            className="bg-muted/30 border border-border rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[#6C63FF] w-28"
          />
          <span className="text-muted-foreground text-sm">—</span>
          <input
            type="text"
            value={element.eduEndDate || ''}
            onChange={(e) => onChange({ eduEndDate: e.target.value })}
            onClick={(e) => e.stopPropagation()}
            placeholder="End (YYYY)"
            className="bg-muted/30 border border-border rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[#6C63FF] w-28"
          />
          <input
            type="text"
            value={element.eduHonors || ''}
            onChange={(e) => onChange({ eduHonors: e.target.value })}
            onClick={(e) => e.stopPropagation()}
            placeholder="Honors (e.g. Magna Cum Laude)"
            className="bg-muted/30 border border-border rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[#6C63FF] flex-1 min-w-[160px]"
          />
        </div>

        {/* Description */}
        <textarea
          value={element.eduDescription || ''}
          onChange={(e) => onChange({ eduDescription: e.target.value })}
          onClick={(e) => e.stopPropagation()}
          placeholder="Relevant coursework, activities, or achievements..."
          rows={2}
          className="w-full bg-muted/30 border border-border rounded-lg p-3 outline-none text-sm text-foreground/80 resize-none focus:ring-2 focus:ring-[#6C63FF]"
        />
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
