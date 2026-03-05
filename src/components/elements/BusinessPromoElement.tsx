'use client'

import { Trash2, Plus, X, Sparkles } from 'lucide-react'
import type { CanvasElement } from '@/lib/types/canvas'

interface Props {
  element: CanvasElement
  onChange: (updates: Partial<CanvasElement>) => void
  onDelete: () => void
  isSelected: boolean
  onSelect: () => void
}

export function BusinessPromoElement({ element, onChange, onDelete, isSelected, onSelect }: Props) {
  const items = element.bizPromoItems ?? []

  const updateItem = (index: number, field: string, value: string) => {
    const updated = [...items]
    updated[index] = { ...updated[index], [field]: value }
    onChange({ bizPromoItems: updated })
  }

  const addItem = () => {
    onChange({
      bizPromoItems: [...items, { title: '', description: '', badge: '', ctaText: '', ctaUrl: '' }],
    })
  }

  const removeItem = (index: number) => {
    onChange({ bizPromoItems: items.filter((_, i) => i !== index) })
  }

  return (
    <div
      className={`relative group rounded-xl border bg-background transition-all ${
        isSelected ? 'ring-2 ring-amber-500 border-amber-500/30' : 'border-border hover:border-amber-500/30'
      }`}
      onClick={(e) => { e.stopPropagation(); onSelect() }}
    >
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-500" />
          <input
            type="text"
            value={element.bizPromoTitle ?? 'Specials & Promotions'}
            onChange={(e) => onChange({ bizPromoTitle: e.target.value })}
            onClick={(e) => e.stopPropagation()}
            className="text-sm font-semibold bg-transparent border-none outline-none"
          />
        </div>

        {items.map((item, index) => (
          <div key={index} className="border border-border rounded-lg p-3 space-y-2 bg-muted/10">
            <div className="flex gap-2">
              <input
                type="text"
                value={item.title}
                onChange={(e) => updateItem(index, 'title', e.target.value)}
                onClick={(e) => e.stopPropagation()}
                placeholder="Promo title"
                className="flex-1 text-xs bg-transparent border border-border rounded px-2 py-1 outline-none focus:ring-1 focus:ring-amber-500"
              />
              <input
                type="text"
                value={item.badge}
                onChange={(e) => updateItem(index, 'badge', e.target.value)}
                onClick={(e) => e.stopPropagation()}
                placeholder="Badge (e.g. NEW)"
                className="w-28 text-xs bg-transparent border border-border rounded px-2 py-1 outline-none focus:ring-1 focus:ring-amber-500"
              />
              <button onClick={(e) => { e.stopPropagation(); removeItem(index) }} className="p-1 hover:text-destructive">
                <X className="w-3 h-3" />
              </button>
            </div>
            <input
              type="text"
              value={item.description}
              onChange={(e) => updateItem(index, 'description', e.target.value)}
              onClick={(e) => e.stopPropagation()}
              placeholder="Description"
              className="w-full text-[10px] bg-transparent border border-border rounded px-2 py-1 outline-none focus:ring-1 focus:ring-amber-500"
            />
            <div className="flex gap-2">
              <input
                type="text"
                value={item.image ?? ''}
                onChange={(e) => updateItem(index, 'image', e.target.value)}
                onClick={(e) => e.stopPropagation()}
                placeholder="Image URL (optional)"
                className="flex-1 text-[10px] bg-transparent border border-border rounded px-2 py-1 outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={item.startDate ?? ''}
                onChange={(e) => updateItem(index, 'startDate', e.target.value)}
                onClick={(e) => e.stopPropagation()}
                placeholder="Start date"
                className="flex-1 text-[10px] bg-transparent border border-border rounded px-2 py-1 outline-none focus:ring-1 focus:ring-amber-500"
              />
              <input
                type="text"
                value={item.endDate ?? ''}
                onChange={(e) => updateItem(index, 'endDate', e.target.value)}
                onClick={(e) => e.stopPropagation()}
                placeholder="End date"
                className="flex-1 text-[10px] bg-transparent border border-border rounded px-2 py-1 outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={item.ctaText ?? ''}
                onChange={(e) => updateItem(index, 'ctaText', e.target.value)}
                onClick={(e) => e.stopPropagation()}
                placeholder="CTA text (optional)"
                className="flex-1 text-[10px] bg-transparent border border-border rounded px-2 py-1 outline-none focus:ring-1 focus:ring-amber-500"
              />
              <input
                type="text"
                value={item.ctaUrl ?? ''}
                onChange={(e) => updateItem(index, 'ctaUrl', e.target.value)}
                onClick={(e) => e.stopPropagation()}
                placeholder="CTA link"
                className="flex-1 text-[10px] bg-transparent border border-border rounded px-2 py-1 outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>
          </div>
        ))}

        <button
          onClick={(e) => { e.stopPropagation(); addItem() }}
          className="flex items-center gap-1.5 text-sm text-amber-500 hover:text-amber-600 font-medium transition"
        >
          <Plus className="w-3.5 h-3.5" /> Add promotion
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
