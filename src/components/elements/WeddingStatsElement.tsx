'use client'

import { Trash2, Plus, Heart, Cake, MapPin, Calendar, Star, Music, Camera, Coffee, Plane, Gift } from 'lucide-react'
import type { CanvasElement } from '@/lib/types/canvas'

const ICON_OPTIONS = [
  { value: 'Heart', label: 'Heart', Icon: Heart },
  { value: 'Cake', label: 'Cake', Icon: Cake },
  { value: 'MapPin', label: 'MapPin', Icon: MapPin },
  { value: 'Calendar', label: 'Calendar', Icon: Calendar },
  { value: 'Star', label: 'Star', Icon: Star },
  { value: 'Music', label: 'Music', Icon: Music },
  { value: 'Camera', label: 'Camera', Icon: Camera },
  { value: 'Coffee', label: 'Coffee', Icon: Coffee },
  { value: 'Plane', label: 'Plane', Icon: Plane },
  { value: 'Gift', label: 'Gift', Icon: Gift },
] as const

interface Props {
  element: CanvasElement
  onChange: (updates: Partial<CanvasElement>) => void
  onDelete: () => void
  isSelected: boolean
  onSelect: () => void
}

export function WeddingStatsElement({ element, onChange, onDelete, isSelected, onSelect }: Props) {
  const items = element.weddingStatsItems || []

  const updateItem = (index: number, field: 'label' | 'value' | 'icon', val: string) => {
    const updated = items.map((item, i) =>
      i === index ? { ...item, [field]: val } : item
    )
    onChange({ weddingStatsItems: updated })
  }

  const addItem = () => {
    onChange({
      weddingStatsItems: [
        ...items,
        { label: '', value: '', icon: 'Heart' },
      ],
    })
  }

  const removeItem = (index: number) => {
    onChange({ weddingStatsItems: items.filter((_, i) => i !== index) })
  }

  const getIconComponent = (iconName?: string) => {
    const match = ICON_OPTIONS.find(o => o.value === iconName)
    return match ? match.Icon : Heart
  }

  return (
    <div
      className={`relative rounded-xl border transition-all ${
        isSelected ? 'border-[#E8B4B8] ring-2 ring-[#E8B4B8]/30' : 'border-border hover:border-[#E8B4B8]/40'
      }`}
      onClick={(e) => { e.stopPropagation(); onSelect() }}
    >
      {/* Delete button */}
      {isSelected && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete() }}
          className="absolute -top-3 -right-3 p-1.5 bg-background border border-border rounded-md shadow-sm hover:bg-destructive hover:text-destructive-foreground transition z-10"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}

      <div className="p-4 space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Wedding Stats</h3>

        {/* Stat items list */}
        <div className="space-y-2">
          {items.map((item, i) => {
            const IconComp = getIconComponent(item.icon)
            return (
              <div key={i} className="flex items-center gap-2 group/row">
                {/* Icon dropdown */}
                <div className="relative flex-shrink-0">
                  <select
                    value={item.icon || 'Heart'}
                    onChange={(e) => { e.stopPropagation(); updateItem(i, 'icon', e.target.value) }}
                    onClick={(e) => e.stopPropagation()}
                    className="appearance-none w-10 h-10 rounded-lg bg-[#E8B4B8]/10 border border-[#E8B4B8]/30 text-center text-transparent cursor-pointer outline-none focus:ring-2 focus:ring-[#E8B4B8]"
                  >
                    {ICON_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <IconComp className="w-4 h-4 text-[#E8B4B8]" />
                  </div>
                </div>

                {/* Value input */}
                <input
                  type="text"
                  value={item.value}
                  onChange={(e) => updateItem(i, 'value', e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  placeholder="Value"
                  className="w-20 bg-muted/30 border border-border rounded-lg px-2.5 py-1.5 text-sm font-bold outline-none focus:ring-2 focus:ring-[#E8B4B8] text-center"
                />

                {/* Label input */}
                <input
                  type="text"
                  value={item.label}
                  onChange={(e) => updateItem(i, 'label', e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  placeholder="Label"
                  className="flex-1 bg-transparent border border-transparent hover:border-border focus:border-[#E8B4B8] rounded-lg px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[#E8B4B8]"
                />

                {/* Remove button */}
                <button
                  onClick={(e) => { e.stopPropagation(); removeItem(i) }}
                  className="p-1 opacity-0 group-hover/row:opacity-100 hover:text-destructive transition flex-shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )
          })}
        </div>

        {/* Add stat button */}
        <button
          onClick={(e) => { e.stopPropagation(); addItem() }}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Stat
        </button>
      </div>
    </div>
  )
}
