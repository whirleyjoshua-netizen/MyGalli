'use client'

import { Trash2, Plus, X, Music } from 'lucide-react'
import type { CanvasElement } from '@/lib/types/canvas'

interface Props {
  element: CanvasElement
  onChange: (updates: Partial<CanvasElement>) => void
  onDelete: () => void
  isSelected: boolean
  onSelect: () => void
}

export function PlaylistElement({ element, onChange, onDelete, isSelected, onSelect }: Props) {
  const items = element.playlistItems ?? []

  const updateItem = (index: number, field: keyof typeof items[0], value: string) => {
    const updated = [...items]
    updated[index] = { ...updated[index], [field]: value }
    onChange({ playlistItems: updated })
  }

  const addItem = () => {
    onChange({ playlistItems: [...items, { title: '', artist: '', coverUrl: '', link: '' }] })
  }

  const removeItem = (index: number) => {
    onChange({ playlistItems: items.filter((_, i) => i !== index) })
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
          <Music className="w-4 h-4 text-[#FF6B6B]" />
          <input
            type="text"
            value={element.playlistTitle ?? 'My Playlist'}
            onChange={(e) => onChange({ playlistTitle: e.target.value })}
            onClick={(e) => e.stopPropagation()}
            className="text-sm font-semibold bg-transparent border-none outline-none"
          />
        </div>

        <div className="space-y-2">
          {items.map((item, index) => (
            <div key={index} className="flex items-start gap-2 bg-muted/30 rounded-lg p-2 border border-border">
              <div className="flex-1 grid grid-cols-2 gap-1.5">
                <input
                  type="text"
                  value={item.title}
                  onChange={(e) => updateItem(index, 'title', e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  placeholder="Song title"
                  className="text-xs bg-transparent border border-border rounded px-2 py-1 outline-none focus:ring-1 focus:ring-[#FF6B6B]"
                />
                <input
                  type="text"
                  value={item.artist}
                  onChange={(e) => updateItem(index, 'artist', e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  placeholder="Artist"
                  className="text-xs bg-transparent border border-border rounded px-2 py-1 outline-none focus:ring-1 focus:ring-[#FF6B6B]"
                />
                <input
                  type="text"
                  value={item.coverUrl}
                  onChange={(e) => updateItem(index, 'coverUrl', e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  placeholder="Cover image URL"
                  className="text-xs bg-transparent border border-border rounded px-2 py-1 outline-none focus:ring-1 focus:ring-[#FF6B6B]"
                />
                <input
                  type="text"
                  value={item.link}
                  onChange={(e) => updateItem(index, 'link', e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  placeholder="Spotify/YouTube link"
                  className="text-xs bg-transparent border border-border rounded px-2 py-1 outline-none focus:ring-1 focus:ring-[#FF6B6B]"
                />
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); removeItem(index) }}
                className="p-1 text-muted-foreground hover:text-destructive transition rounded-md hover:bg-destructive/10 mt-1"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>

        <button
          onClick={(e) => { e.stopPropagation(); addItem() }}
          className="flex items-center gap-1.5 text-sm text-[#FF6B6B] hover:text-[#e55a5a] font-medium transition"
        >
          <Plus className="w-3.5 h-3.5" />
          Add song
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
