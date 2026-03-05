'use client'

import { useState } from 'react'
import { Trash2, Plus, X, UtensilsCrossed, ChevronDown, ChevronRight } from 'lucide-react'
import type { CanvasElement } from '@/lib/types/canvas'

interface Props {
  element: CanvasElement
  onChange: (updates: Partial<CanvasElement>) => void
  onDelete: () => void
  isSelected: boolean
  onSelect: () => void
}

const TAG_OPTIONS = ['popular', 'new', 'vegan', 'gf', 'spicy'] as const

export function BusinessMenuElement({ element, onChange, onDelete, isSelected, onSelect }: Props) {
  const categories = element.bizMenuCategories ?? []
  const currency = element.bizMenuCurrency ?? '$'
  const [expandedCat, setExpandedCat] = useState<number>(0)

  const updateCategory = (catIdx: number, field: string, value: any) => {
    const updated = [...categories]
    updated[catIdx] = { ...updated[catIdx], [field]: value }
    onChange({ bizMenuCategories: updated })
  }

  const addCategory = () => {
    onChange({ bizMenuCategories: [...categories, { name: 'New Category', items: [] }] })
  }

  const removeCategory = (catIdx: number) => {
    onChange({ bizMenuCategories: categories.filter((_, i) => i !== catIdx) })
  }

  const addItem = (catIdx: number) => {
    const updated = [...categories]
    updated[catIdx] = {
      ...updated[catIdx],
      items: [...updated[catIdx].items, { name: '', description: '', price: '', tags: [] }],
    }
    onChange({ bizMenuCategories: updated })
  }

  const updateItem = (catIdx: number, itemIdx: number, field: string, value: any) => {
    const updated = [...categories]
    const items = [...updated[catIdx].items]
    items[itemIdx] = { ...items[itemIdx], [field]: value }
    updated[catIdx] = { ...updated[catIdx], items }
    onChange({ bizMenuCategories: updated })
  }

  const removeItem = (catIdx: number, itemIdx: number) => {
    const updated = [...categories]
    updated[catIdx] = {
      ...updated[catIdx],
      items: updated[catIdx].items.filter((_, i) => i !== itemIdx),
    }
    onChange({ bizMenuCategories: updated })
  }

  const toggleTag = (catIdx: number, itemIdx: number, tag: string) => {
    const item = categories[catIdx].items[itemIdx]
    const tags = item.tags.includes(tag)
      ? item.tags.filter(t => t !== tag)
      : [...item.tags, tag]
    updateItem(catIdx, itemIdx, 'tags', tags)
  }

  return (
    <div
      className={`relative group rounded-xl border bg-background transition-all ${
        isSelected ? 'ring-2 ring-amber-500 border-amber-500/30' : 'border-border hover:border-amber-500/30'
      }`}
      onClick={(e) => { e.stopPropagation(); onSelect() }}
    >
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UtensilsCrossed className="w-4 h-4 text-amber-500" />
            <input
              type="text"
              value={element.bizMenuTitle ?? 'Our Menu'}
              onChange={(e) => onChange({ bizMenuTitle: e.target.value })}
              onClick={(e) => e.stopPropagation()}
              className="text-sm font-semibold bg-transparent border-none outline-none"
            />
          </div>
          <select
            value={currency}
            onChange={(e) => onChange({ bizMenuCurrency: e.target.value as '$' | '€' | '£' })}
            onClick={(e) => e.stopPropagation()}
            className="text-xs bg-muted border border-border rounded px-2 py-1 outline-none"
          >
            <option value="$">$ USD</option>
            <option value="€">€ EUR</option>
            <option value="£">£ GBP</option>
          </select>
        </div>

        {categories.map((cat, catIdx) => (
          <div key={catIdx} className="border border-border rounded-lg overflow-hidden">
            <div
              className="flex items-center gap-2 px-3 py-2 bg-muted/30 cursor-pointer"
              onClick={(e) => { e.stopPropagation(); setExpandedCat(expandedCat === catIdx ? -1 : catIdx) }}
            >
              {expandedCat === catIdx ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              <input
                type="text"
                value={cat.name}
                onChange={(e) => updateCategory(catIdx, 'name', e.target.value)}
                onClick={(e) => e.stopPropagation()}
                className="flex-1 text-xs font-semibold bg-transparent border-none outline-none"
              />
              <span className="text-[10px] text-muted-foreground">{cat.items.length} items</span>
              <button onClick={(e) => { e.stopPropagation(); removeCategory(catIdx) }} className="p-0.5 hover:text-destructive">
                <X className="w-3 h-3" />
              </button>
            </div>

            {expandedCat === catIdx && (
              <div className="p-2 space-y-2">
                {cat.items.map((item, itemIdx) => (
                  <div key={itemIdx} className="border border-border rounded-md p-2 space-y-1.5 bg-background">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={item.name}
                        onChange={(e) => updateItem(catIdx, itemIdx, 'name', e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        placeholder="Item name"
                        className="flex-1 text-xs bg-transparent border border-border rounded px-2 py-1 outline-none focus:ring-1 focus:ring-amber-500"
                      />
                      <input
                        type="text"
                        value={item.price}
                        onChange={(e) => updateItem(catIdx, itemIdx, 'price', e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        placeholder="0.00"
                        className="w-20 text-xs bg-transparent border border-border rounded px-2 py-1 outline-none focus:ring-1 focus:ring-amber-500"
                      />
                      <button onClick={(e) => { e.stopPropagation(); removeItem(catIdx, itemIdx) }} className="p-1 hover:text-destructive">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                    <input
                      type="text"
                      value={item.description}
                      onChange={(e) => updateItem(catIdx, itemIdx, 'description', e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      placeholder="Description"
                      className="w-full text-[10px] bg-transparent border border-border rounded px-2 py-1 outline-none focus:ring-1 focus:ring-amber-500"
                    />
                    <div className="flex gap-1 flex-wrap">
                      {TAG_OPTIONS.map(tag => (
                        <button
                          key={tag}
                          onClick={(e) => { e.stopPropagation(); toggleTag(catIdx, itemIdx, tag) }}
                          className={`text-[9px] px-1.5 py-0.5 rounded-full border transition ${
                            item.tags.includes(tag)
                              ? 'bg-amber-500 text-white border-amber-500'
                              : 'border-border text-muted-foreground hover:border-amber-500/50'
                          }`}
                        >
                          {tag}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                <button
                  onClick={(e) => { e.stopPropagation(); addItem(catIdx) }}
                  className="flex items-center gap-1 text-[10px] text-amber-500 hover:text-amber-600 font-medium"
                >
                  <Plus className="w-3 h-3" /> Add item
                </button>
              </div>
            )}
          </div>
        ))}

        <button
          onClick={(e) => { e.stopPropagation(); addCategory() }}
          className="flex items-center gap-1.5 text-sm text-amber-500 hover:text-amber-600 font-medium transition"
        >
          <Plus className="w-3.5 h-3.5" /> Add category
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
