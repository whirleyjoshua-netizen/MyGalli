'use client'

import { Trash2, Plus, X, BarChart2 } from 'lucide-react'
import type { CanvasElement } from '@/lib/types/canvas'

interface Props {
  element: CanvasElement
  onChange: (updates: Partial<CanvasElement>) => void
  onDelete: () => void
  isSelected: boolean
  onSelect: () => void
}

export function MediaKitStatsElement({ element, onChange, onDelete, isSelected, onSelect }: Props) {
  const groups = element.mediaKitStats ?? []

  const updateGroup = (gIndex: number, field: string, value: any) => {
    const updated = [...groups]
    updated[gIndex] = { ...updated[gIndex], [field]: value }
    onChange({ mediaKitStats: updated })
  }

  const addGroup = () => {
    onChange({ mediaKitStats: [...groups, { label: 'New Group', items: [{ name: '', value: '' }] }] })
  }

  const removeGroup = (gIndex: number) => {
    onChange({ mediaKitStats: groups.filter((_, i) => i !== gIndex) })
  }

  const addItem = (gIndex: number) => {
    const updated = [...groups]
    updated[gIndex] = { ...updated[gIndex], items: [...updated[gIndex].items, { name: '', value: '' }] }
    onChange({ mediaKitStats: updated })
  }

  const updateItem = (gIndex: number, iIndex: number, field: 'name' | 'value', val: string) => {
    const updated = [...groups]
    const items = [...updated[gIndex].items]
    items[iIndex] = { ...items[iIndex], [field]: val }
    updated[gIndex] = { ...updated[gIndex], items }
    onChange({ mediaKitStats: updated })
  }

  const removeItem = (gIndex: number, iIndex: number) => {
    const updated = [...groups]
    updated[gIndex] = { ...updated[gIndex], items: updated[gIndex].items.filter((_, i) => i !== iIndex) }
    onChange({ mediaKitStats: updated })
  }

  return (
    <div
      className={`relative group rounded-xl border bg-background transition-all ${
        isSelected ? 'ring-2 ring-[#E040FB] border-[#E040FB]/30' : 'border-border hover:border-[#E040FB]/30'
      }`}
      onClick={(e) => { e.stopPropagation(); onSelect() }}
    >
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <BarChart2 className="w-4 h-4 text-[#E040FB]" />
          <input
            type="text"
            value={element.mediaKitTitle ?? 'Audience Demographics'}
            onChange={(e) => onChange({ mediaKitTitle: e.target.value })}
            onClick={(e) => e.stopPropagation()}
            className="text-sm font-semibold bg-transparent border-none outline-none"
          />
        </div>

        <div className="space-y-3">
          {groups.map((group, gi) => (
            <div key={gi} className="bg-muted/50 rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={group.label}
                  onChange={(e) => updateGroup(gi, 'label', e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  placeholder="Group label"
                  className="flex-1 text-xs font-semibold bg-transparent border-none outline-none uppercase tracking-wide"
                />
                <button
                  onClick={(e) => { e.stopPropagation(); removeGroup(gi) }}
                  className="p-0.5 text-muted-foreground hover:text-destructive"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
              <div className="space-y-1">
                {group.items.map((item, ii) => (
                  <div key={ii} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={item.name}
                      onChange={(e) => updateItem(gi, ii, 'name', e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      placeholder="Name"
                      className="flex-1 text-xs bg-transparent border border-border rounded px-2 py-0.5 outline-none"
                    />
                    <input
                      type="text"
                      value={item.value}
                      onChange={(e) => updateItem(gi, ii, 'value', e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      placeholder="Value (e.g. 45%)"
                      className="w-24 text-xs bg-transparent border border-border rounded px-2 py-0.5 outline-none text-right font-medium"
                    />
                    <button
                      onClick={(e) => { e.stopPropagation(); removeItem(gi, ii) }}
                      className="p-0.5 text-muted-foreground hover:text-destructive"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </div>
                ))}
                <button
                  onClick={(e) => { e.stopPropagation(); addItem(gi) }}
                  className="text-[10px] text-[#E040FB] font-medium"
                >
                  + item
                </button>
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={(e) => { e.stopPropagation(); addGroup() }}
          className="flex items-center gap-1.5 text-sm text-[#E040FB] hover:text-[#c030d8] font-medium transition"
        >
          <Plus className="w-3.5 h-3.5" />
          Add group
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
