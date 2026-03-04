'use client'

import { Trash2, Plus, X, Hash } from 'lucide-react'
import type { CanvasElement } from '@/lib/types/canvas'

interface Props {
  element: CanvasElement
  onChange: (updates: Partial<CanvasElement>) => void
  onDelete: () => void
  isSelected: boolean
  onSelect: () => void
}

export function WeddingHashtagsElement({ element, onChange, onDelete, isSelected, onSelect }: Props) {
  const hashtags = element.weddingHashtags ?? []

  const updateHashtag = (index: number, value: string) => {
    const updated = [...hashtags]
    // Auto-prepend '#' if the user didn't type it
    if (value && !value.startsWith('#')) {
      value = '#' + value
    }
    updated[index] = value
    onChange({ weddingHashtags: updated })
  }

  const addHashtag = () => {
    onChange({ weddingHashtags: [...hashtags, '#'] })
  }

  const removeHashtag = (index: number) => {
    const updated = hashtags.filter((_, i) => i !== index)
    onChange({ weddingHashtags: updated })
  }

  return (
    <div
      className={`relative group rounded-xl border bg-background transition-all ${
        isSelected ? 'ring-2 ring-[#6C63FF] border-[#6C63FF]/30' : 'border-border hover:border-[#6C63FF]/30'
      }`}
      onClick={(e) => { e.stopPropagation(); onSelect() }}
    >
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Hash className="w-4 h-4 text-[#E8B4B8]" />
          Wedding Hashtags
        </div>

        <div className="space-y-2">
          {hashtags.map((tag, index) => (
            <div key={index} className="flex items-center gap-2">
              <input
                type="text"
                value={tag}
                onChange={(e) => updateHashtag(index, e.target.value)}
                onClick={(e) => e.stopPropagation()}
                placeholder="#YourHashtag"
                className="flex-1 bg-muted/30 border border-border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#E8B4B8] transition"
              />
              <button
                onClick={(e) => { e.stopPropagation(); removeHashtag(index) }}
                className="p-1.5 text-muted-foreground hover:text-destructive transition rounded-md hover:bg-destructive/10"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>

        <button
          onClick={(e) => { e.stopPropagation(); addHashtag() }}
          className="flex items-center gap-1.5 text-sm text-[#E8B4B8] hover:text-[#d4969b] font-medium transition"
        >
          <Plus className="w-3.5 h-3.5" />
          Add hashtag
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
