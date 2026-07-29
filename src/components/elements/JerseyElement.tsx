'use client'

import { Trash2, Shirt } from 'lucide-react'
import type { CanvasElement } from '@/lib/types/canvas'
import { JerseySVG } from './JerseySVG'

interface Props {
  element: CanvasElement
  onChange: (updates: Partial<CanvasElement>) => void
  onDelete: () => void
  isSelected: boolean
  onSelect: () => void
}

export function JerseyElement({ element, onChange, onDelete, isSelected, onSelect }: Props) {

  const number = element.jerseyNumber || '1'
  const name = element.jerseyName || 'PLAYER'
  const primaryColor = element.jerseyPrimaryColor || '#39D98A'
  const secondaryColor = element.jerseySecondaryColor || '#0F3D2E'
  const style = element.jerseyStyle || 'classic'

  return (
    <div
      className={`relative rounded-xl border transition-all ${
        isSelected ? 'border-primary ring-2 ring-primary/20' : 'border-border hover:border-border/80'
      }`}
      onClick={(e) => { e.stopPropagation(); onSelect() }}
    >
      {/* Controls */}
      {isSelected && (
        <div className="absolute -top-3 right-2 flex items-center gap-1 z-10">
          <button
            onClick={(e) => { e.stopPropagation(); onDelete() }}
            className="p-1.5 rounded-lg bg-background border border-border shadow-sm hover:bg-destructive/10 hover:text-destructive transition"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <div className="p-6">
        {/* Label */}
        <div className="flex items-center gap-2 mb-4">
          <Shirt className="w-5 h-5 text-primary" />
          <span className="text-lg font-semibold">My Jersey</span>
        </div>

        {/* Preview */}
        <div className="flex justify-center mb-4">
          <div className="drop-shadow-lg">
            <JerseySVG
              primaryColor={primaryColor}
              secondaryColor={secondaryColor}
              number={number}
              name={name}
              style={style}
            />
          </div>
        </div>

      </div>
    </div>
  )
}
