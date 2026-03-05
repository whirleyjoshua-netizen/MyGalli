'use client'

import { Trash2, Plus, X, Palette } from 'lucide-react'
import type { CanvasElement } from '@/lib/types/canvas'

interface Props {
  element: CanvasElement
  onChange: (updates: Partial<CanvasElement>) => void
  onDelete: () => void
  isSelected: boolean
  onSelect: () => void
}

export function ColorPaletteElement({ element, onChange, onDelete, isSelected, onSelect }: Props) {
  const colors = element.colorPaletteColors ?? []

  const updateColor = (index: number, field: 'hex' | 'name', value: string) => {
    const updated = [...colors]
    updated[index] = { ...updated[index], [field]: value }
    onChange({ colorPaletteColors: updated })
  }

  const addColor = () => {
    onChange({ colorPaletteColors: [...colors, { hex: '#cccccc', name: '' }] })
  }

  const removeColor = (index: number) => {
    onChange({ colorPaletteColors: colors.filter((_, i) => i !== index) })
  }

  return (
    <div
      className={`relative group rounded-xl border bg-background transition-all ${
        isSelected ? 'ring-2 ring-[#FF6B6B] border-[#FF6B6B]/30' : 'border-border hover:border-[#FF6B6B]/30'
      }`}
      onClick={(e) => { e.stopPropagation(); onSelect() }}
    >
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Palette className="w-4 h-4 text-[#FF6B6B]" />
          <input
            type="text"
            value={element.colorPaletteTitle ?? 'My Palette'}
            onChange={(e) => onChange({ colorPaletteTitle: e.target.value })}
            onClick={(e) => e.stopPropagation()}
            className="text-sm font-semibold bg-transparent border-none outline-none"
          />
        </div>

        <div className="flex flex-wrap gap-3">
          {colors.map((color, index) => (
            <div key={index} className="relative group/swatch flex flex-col items-center gap-1.5">
              <div className="relative">
                <input
                  type="color"
                  value={color.hex}
                  onChange={(e) => updateColor(index, 'hex', e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  className="w-14 h-14 rounded-xl cursor-pointer border-2 border-border"
                />
                <button
                  onClick={(e) => { e.stopPropagation(); removeColor(index) }}
                  className="absolute -top-1.5 -right-1.5 p-0.5 bg-background border border-border rounded-full text-muted-foreground hover:text-destructive opacity-0 group-hover/swatch:opacity-100 transition"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
              <input
                type="text"
                value={color.name}
                onChange={(e) => updateColor(index, 'name', e.target.value)}
                onClick={(e) => e.stopPropagation()}
                placeholder="Name"
                className="w-16 text-[10px] text-center bg-transparent border-none outline-none text-muted-foreground"
              />
              <span className="text-[9px] text-muted-foreground/60 font-mono">{color.hex}</span>
            </div>
          ))}
        </div>

        <button
          onClick={(e) => { e.stopPropagation(); addColor() }}
          className="flex items-center gap-1.5 text-sm text-[#FF6B6B] hover:text-[#e55a5a] font-medium transition"
        >
          <Plus className="w-3.5 h-3.5" />
          Add color
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
