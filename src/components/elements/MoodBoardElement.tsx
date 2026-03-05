'use client'

import { useState } from 'react'
import { Trash2, Plus, X, ImageIcon, Grid3X3 } from 'lucide-react'
import type { CanvasElement } from '@/lib/types/canvas'

interface Props {
  element: CanvasElement
  onChange: (updates: Partial<CanvasElement>) => void
  onDelete: () => void
  isSelected: boolean
  onSelect: () => void
}

export function MoodBoardElement({ element, onChange, onDelete, isSelected, onSelect }: Props) {
  const items = element.moodBoardItems ?? []
  const columns = element.moodBoardColumns ?? 3

  const updateItem = (index: number, field: 'imageUrl' | 'caption', value: string) => {
    const updated = [...items]
    updated[index] = { ...updated[index], [field]: value }
    onChange({ moodBoardItems: updated })
  }

  const addItem = () => {
    onChange({ moodBoardItems: [...items, { imageUrl: '', caption: '' }] })
  }

  const removeItem = (index: number) => {
    onChange({ moodBoardItems: items.filter((_, i) => i !== index) })
  }

  return (
    <div
      className={`relative group rounded-xl border bg-background transition-all ${
        isSelected ? 'ring-2 ring-[#FF6B6B] border-[#FF6B6B]/30' : 'border-border hover:border-[#FF6B6B]/30'
      }`}
      onClick={(e) => { e.stopPropagation(); onSelect() }}
    >
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Grid3X3 className="w-4 h-4 text-[#FF6B6B]" />
            <input
              type="text"
              value={element.moodBoardTitle ?? 'Mood Board'}
              onChange={(e) => onChange({ moodBoardTitle: e.target.value })}
              onClick={(e) => e.stopPropagation()}
              className="text-sm font-semibold bg-transparent border-none outline-none"
            />
          </div>
          <select
            value={columns}
            onChange={(e) => onChange({ moodBoardColumns: Number(e.target.value) as 2 | 3 | 4 })}
            onClick={(e) => e.stopPropagation()}
            className="text-xs bg-muted border border-border rounded px-2 py-1 outline-none"
          >
            <option value={2}>2 cols</option>
            <option value={3}>3 cols</option>
            <option value={4}>4 cols</option>
          </select>
        </div>

        <div className={`grid gap-2 ${columns === 2 ? 'grid-cols-2' : columns === 4 ? 'grid-cols-4' : 'grid-cols-3'}`}>
          {items.map((item, index) => (
            <div key={index} className="relative group/item border border-border rounded-lg overflow-hidden bg-muted/30">
              {item.imageUrl ? (
                <img src={item.imageUrl} alt={item.caption} className="w-full aspect-square object-cover" />
              ) : (
                <div className="w-full aspect-square flex items-center justify-center">
                  <ImageIcon className="w-6 h-6 text-muted-foreground/40" />
                </div>
              )}
              <div className="p-1.5 space-y-1">
                <input
                  type="text"
                  value={item.imageUrl}
                  onChange={(e) => updateItem(index, 'imageUrl', e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  placeholder="Image URL"
                  className="w-full text-[10px] bg-transparent border border-border rounded px-1.5 py-0.5 outline-none focus:ring-1 focus:ring-[#FF6B6B]"
                />
                <input
                  type="text"
                  value={item.caption}
                  onChange={(e) => updateItem(index, 'caption', e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  placeholder="Caption"
                  className="w-full text-[10px] bg-transparent border border-border rounded px-1.5 py-0.5 outline-none focus:ring-1 focus:ring-[#FF6B6B]"
                />
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); removeItem(index) }}
                className="absolute top-1 right-1 p-1 bg-background/80 rounded-md text-muted-foreground hover:text-destructive opacity-0 group-hover/item:opacity-100 transition"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>

        <button
          onClick={(e) => { e.stopPropagation(); addItem() }}
          className="flex items-center gap-1.5 text-sm text-[#FF6B6B] hover:text-[#e55a5a] font-medium transition"
        >
          <Plus className="w-3.5 h-3.5" />
          Add image
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
