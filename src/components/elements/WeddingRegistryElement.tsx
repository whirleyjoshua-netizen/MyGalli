'use client'

import { Trash2, Plus, Gift } from 'lucide-react'
import type { CanvasElement } from '@/lib/types/canvas'

interface RegistryItem {
  name: string
  url: string
  type: 'amazon' | 'target' | 'honeymoon' | 'custom'
  description?: string
}

interface Props {
  element: CanvasElement
  onChange: (updates: Partial<CanvasElement>) => void
  onDelete: () => void
  isSelected: boolean
  onSelect: () => void
}

export function WeddingRegistryElement({ element, onChange, onDelete, isSelected, onSelect }: Props) {
  const title = element.weddingRegistryTitle || 'Our Registry'
  const items: RegistryItem[] = element.weddingRegistryItems || []

  const updateItem = (index: number, field: keyof RegistryItem, value: string) => {
    const updated = items.map((item, i) =>
      i === index ? { ...item, [field]: value } : item
    )
    onChange({ weddingRegistryItems: updated })
  }

  const addItem = () => {
    onChange({
      weddingRegistryItems: [
        ...items,
        { name: '', url: '', type: 'custom' as const, description: '' },
      ],
    })
  }

  const removeItem = (index: number) => {
    onChange({ weddingRegistryItems: items.filter((_, i) => i !== index) })
  }

  return (
    <div
      className={`relative rounded-xl border transition-all ${
        isSelected ? 'border-[#E8B4B8] ring-2 ring-[#E8B4B8]/30' : 'border-border hover:border-border/80'
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

      <div className="p-4">
        {/* Title */}
        <div className="flex items-center gap-2 mb-4">
          <Gift className="w-5 h-5 text-[#E8B4B8]" />
          <input
            type="text"
            value={title}
            onChange={(e) => onChange({ weddingRegistryTitle: e.target.value })}
            className="text-lg font-semibold bg-transparent border-none outline-none flex-1"
            placeholder="Our Registry"
          />
        </div>

        {/* Registry Items */}
        <div className="space-y-3">
          {items.map((item, i) => (
            <div
              key={i}
              className="group/item p-3 rounded-lg border border-border/50 bg-muted/30 hover:bg-muted/50 transition"
            >
              <div className="flex items-start gap-3">
                <div className="flex-1 space-y-2">
                  {/* Name & Type row */}
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={item.name}
                      onChange={(e) => updateItem(i, 'name', e.target.value)}
                      placeholder="Registry name (e.g., Amazon Wedding)"
                      className="flex-1 bg-transparent border border-transparent hover:border-border focus:border-[#E8B4B8] rounded px-2 py-1 text-sm outline-none"
                    />
                    <select
                      value={item.type}
                      onChange={(e) => updateItem(i, 'type', e.target.value)}
                      className="bg-transparent border border-transparent hover:border-border focus:border-[#E8B4B8] rounded px-2 py-1 text-xs outline-none"
                    >
                      <option value="amazon">Amazon</option>
                      <option value="target">Target</option>
                      <option value="honeymoon">Honeymoon</option>
                      <option value="custom">Custom</option>
                    </select>
                  </div>

                  {/* URL */}
                  <input
                    type="url"
                    value={item.url}
                    onChange={(e) => updateItem(i, 'url', e.target.value)}
                    placeholder="https://registry-link.com"
                    className="w-full bg-transparent border border-transparent hover:border-border focus:border-[#E8B4B8] rounded px-2 py-1 text-xs text-muted-foreground outline-none"
                  />

                  {/* Description */}
                  <input
                    type="text"
                    value={item.description || ''}
                    onChange={(e) => updateItem(i, 'description', e.target.value)}
                    placeholder="Short description (optional)"
                    className="w-full bg-transparent border border-transparent hover:border-border focus:border-[#E8B4B8] rounded px-2 py-1 text-xs outline-none"
                  />
                </div>

                {/* Remove */}
                <button
                  onClick={(e) => { e.stopPropagation(); removeItem(i) }}
                  className="p-1 mt-1 opacity-0 group-hover/item:opacity-100 hover:text-destructive transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Add Item */}
        <button
          onClick={(e) => { e.stopPropagation(); addItem() }}
          className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Registry Link
        </button>
      </div>
    </div>
  )
}
