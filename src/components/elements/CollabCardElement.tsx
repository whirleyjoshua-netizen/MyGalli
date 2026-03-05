'use client'

import { Trash2, Plus, X, Briefcase } from 'lucide-react'
import type { CanvasElement } from '@/lib/types/canvas'

interface Props {
  element: CanvasElement
  onChange: (updates: Partial<CanvasElement>) => void
  onDelete: () => void
  isSelected: boolean
  onSelect: () => void
}

export function CollabCardElement({ element, onChange, onDelete, isSelected, onSelect }: Props) {
  const items = element.collabItems ?? []

  const update = (index: number, field: string, value: string) => {
    const updated = [...items]
    updated[index] = { ...updated[index], [field]: value }
    onChange({ collabItems: updated })
  }

  const add = () => {
    onChange({ collabItems: [...items, { brand: '', role: '', dateRange: '', description: '', image: '', link: '' }] })
  }

  const remove = (index: number) => {
    onChange({ collabItems: items.filter((_, i) => i !== index) })
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
          <Briefcase className="w-4 h-4 text-[#E040FB]" />
          <input
            type="text"
            value={element.collabTitle ?? 'Brand Collaborations'}
            onChange={(e) => onChange({ collabTitle: e.target.value })}
            onClick={(e) => e.stopPropagation()}
            className="text-sm font-semibold bg-transparent border-none outline-none"
          />
        </div>

        <div className="space-y-3">
          {items.map((item, i) => (
            <div key={i} className="bg-muted/50 rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={item.brand}
                  onChange={(e) => update(i, 'brand', e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  placeholder="Brand name"
                  className="flex-1 text-sm font-medium bg-transparent border-none outline-none"
                />
                <button
                  onClick={(e) => { e.stopPropagation(); remove(i) }}
                  className="p-0.5 text-muted-foreground hover:text-destructive"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={item.role}
                  onChange={(e) => update(i, 'role', e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  placeholder="Role (e.g. Sponsored Post)"
                  className="text-xs bg-transparent border border-border rounded px-2 py-1 outline-none"
                />
                <input
                  type="text"
                  value={item.dateRange ?? ''}
                  onChange={(e) => update(i, 'dateRange', e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  placeholder="Date range"
                  className="text-xs bg-transparent border border-border rounded px-2 py-1 outline-none"
                />
              </div>
              <textarea
                value={item.description ?? ''}
                onChange={(e) => update(i, 'description', e.target.value)}
                onClick={(e) => e.stopPropagation()}
                placeholder="Description"
                rows={2}
                className="w-full text-xs bg-transparent border border-border rounded px-2 py-1 outline-none resize-none"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={item.image ?? ''}
                  onChange={(e) => update(i, 'image', e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  placeholder="Image URL"
                  className="text-xs bg-transparent border border-border rounded px-2 py-1 outline-none"
                />
                <input
                  type="text"
                  value={item.link ?? ''}
                  onChange={(e) => update(i, 'link', e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  placeholder="Link URL"
                  className="text-xs bg-transparent border border-border rounded px-2 py-1 outline-none"
                />
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={(e) => { e.stopPropagation(); add() }}
          className="flex items-center gap-1.5 text-sm text-[#E040FB] hover:text-[#c030d8] font-medium transition"
        >
          <Plus className="w-3.5 h-3.5" />
          Add collab
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
