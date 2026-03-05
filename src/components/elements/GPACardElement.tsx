'use client'

import { Trash2, GraduationCap } from 'lucide-react'

interface Props {
  element: any
  onChange: (updates: Record<string, any>) => void
  onDelete: () => void
  isSelected: boolean
  onSelect: () => void
}

export function GPACardElement({ element, onChange, onDelete, isSelected, onSelect }: Props) {
  return (
    <div
      className={`relative group rounded-xl border bg-background transition-all ${
        isSelected
          ? 'border-[#6C63FF] shadow-md ring-2 ring-[#6C63FF]/20'
          : 'border-border hover:border-[#6C63FF]/30'
      }`}
      onClick={(e) => { e.stopPropagation(); onSelect() }}
    >
      <div className="p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-[#6C63FF]/10 text-[#6C63FF]">
            <GraduationCap className="w-4 h-4" />
          </div>
          <span className="text-sm font-semibold text-[#6C63FF]">GPA Card</span>
        </div>

        {/* GPA Value + Scale row */}
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <label className="text-xs font-medium text-muted-foreground block mb-1">GPA</label>
            <input
              type="text"
              value={element.gpaValue || ''}
              onChange={(e) => onChange({ gpaValue: e.target.value })}
              onClick={(e) => e.stopPropagation()}
              placeholder="3.85"
              className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-2xl font-bold text-foreground outline-none focus:ring-2 focus:ring-[#6C63FF] focus:border-transparent"
            />
          </div>
          <div className="w-28">
            <label className="text-xs font-medium text-muted-foreground block mb-1">Scale</label>
            <select
              value={element.gpaScale || '4.0'}
              onChange={(e) => onChange({ gpaScale: e.target.value })}
              onClick={(e) => e.stopPropagation()}
              className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-[#6C63FF] focus:border-transparent appearance-none cursor-pointer"
            >
              <option value="4.0">/ 4.0</option>
              <option value="5.0">/ 5.0</option>
              <option value="100">/ 100</option>
            </select>
          </div>
        </div>

        {/* Label */}
        <div>
          <label className="text-xs font-medium text-muted-foreground block mb-1">Label</label>
          <input
            type="text"
            value={element.gpaLabel || ''}
            onChange={(e) => onChange({ gpaLabel: e.target.value })}
            onClick={(e) => e.stopPropagation()}
            placeholder="Cumulative GPA"
            className="w-full bg-muted/30 border border-border rounded-lg px-3 py-1.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-[#6C63FF] focus:border-transparent"
          />
        </div>

        {/* Trend + Honors row */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Trend</label>
            <input
              type="text"
              value={element.gpaTrend || ''}
              onChange={(e) => onChange({ gpaTrend: e.target.value })}
              onClick={(e) => e.stopPropagation()}
              placeholder="+0.2 from last semester"
              className="w-full bg-muted/30 border border-border rounded-lg px-3 py-1.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-[#6C63FF] focus:border-transparent"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Honors</label>
            <input
              type="text"
              value={element.gpaHonors || ''}
              onChange={(e) => onChange({ gpaHonors: e.target.value })}
              onClick={(e) => e.stopPropagation()}
              placeholder="Magna Cum Laude"
              className="w-full bg-muted/30 border border-border rounded-lg px-3 py-1.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-[#6C63FF] focus:border-transparent"
            />
          </div>
        </div>

        {/* Weighted toggle */}
        <label
          className="flex items-center gap-2 cursor-pointer"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            role="switch"
            aria-checked={!!element.gpaWeighted}
            onClick={(e) => {
              e.stopPropagation()
              onChange({ gpaWeighted: !element.gpaWeighted })
            }}
            className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors ${
              element.gpaWeighted
                ? 'bg-[#6C63FF] border-[#6C63FF]'
                : 'bg-muted border-border'
            }`}
          >
            <span
              className={`pointer-events-none block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform ${
                element.gpaWeighted ? 'translate-x-4' : 'translate-x-0.5'
              }`}
            />
          </button>
          <span className="text-sm text-muted-foreground">Weighted GPA</span>
        </label>
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
