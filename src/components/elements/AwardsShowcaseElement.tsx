'use client'

import { Trash2, Plus, X, Award } from 'lucide-react'

interface Props {
  element: any
  onChange: (updates: Record<string, any>) => void
  onDelete: () => void
  isSelected: boolean
  onSelect: () => void
}

interface AwardItem {
  title: string
  issuer: string
  date: string
  description: string
  icon: string
}

export function AwardsShowcaseElement({ element, onChange, onDelete, isSelected, onSelect }: Props) {
  const title: string = element.awardsShowcaseTitle ?? 'Awards & Honors'
  const items: AwardItem[] = element.awardsShowcaseItems ?? []

  const updateItem = (index: number, field: keyof AwardItem, value: string) => {
    const updated = [...items]
    updated[index] = { ...updated[index], [field]: value }
    onChange({ awardsShowcaseItems: updated })
  }

  const addItem = () => {
    onChange({
      awardsShowcaseItems: [
        ...items,
        { title: '', issuer: '', date: '', description: '', icon: 'Award' },
      ],
    })
  }

  const removeItem = (index: number) => {
    onChange({ awardsShowcaseItems: items.filter((_, i) => i !== index) })
  }

  return (
    <div
      className={`relative group rounded-xl border bg-background transition-all ${
        isSelected
          ? 'border-[#6C63FF] shadow-md ring-2 ring-[#6C63FF]/20'
          : 'border-border hover:border-[#6C63FF]/30'
      }`}
      onClick={(e) => { e.stopPropagation(); onSelect() }}
    >
      <div className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-center gap-2">
          <Award className="w-5 h-5 text-[#6C63FF]" />
          <input
            type="text"
            value={title}
            onChange={(e) => onChange({ awardsShowcaseTitle: e.target.value })}
            onClick={(e) => e.stopPropagation()}
            placeholder="Awards & Honors"
            className="text-lg font-semibold bg-transparent border-none outline-none flex-1"
          />
        </div>

        {/* Award Items */}
        <div className="space-y-3">
          {items.map((item, index) => (
            <div
              key={index}
              className="relative group/item bg-muted/30 rounded-lg p-3 border border-border space-y-2"
            >
              {/* Row 1: Title + Date */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={item.title}
                  onChange={(e) => updateItem(index, 'title', e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  placeholder="Award title"
                  className="flex-1 text-sm font-semibold bg-transparent border border-border rounded px-2 py-1 outline-none focus:ring-1 focus:ring-[#6C63FF]"
                />
                <input
                  type="text"
                  value={item.date}
                  onChange={(e) => updateItem(index, 'date', e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  placeholder="Date (e.g. 2025)"
                  className="w-36 text-xs bg-transparent border border-border rounded px-2 py-1 outline-none focus:ring-1 focus:ring-[#6C63FF]"
                />
              </div>

              {/* Row 2: Issuer + Icon */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={item.issuer}
                  onChange={(e) => updateItem(index, 'issuer', e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  placeholder="Issuing organization"
                  className="flex-1 text-xs bg-transparent border border-border rounded px-2 py-1 outline-none focus:ring-1 focus:ring-[#6C63FF]"
                />
                <input
                  type="text"
                  value={item.icon}
                  onChange={(e) => updateItem(index, 'icon', e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  placeholder="Icon (Award, Star, Trophy)"
                  className="w-44 text-xs bg-transparent border border-border rounded px-2 py-1 outline-none focus:ring-1 focus:ring-[#6C63FF]"
                />
              </div>

              {/* Row 3: Description */}
              <textarea
                value={item.description}
                onChange={(e) => updateItem(index, 'description', e.target.value)}
                onClick={(e) => e.stopPropagation()}
                placeholder="Description (optional)"
                rows={2}
                className="w-full text-xs bg-transparent border border-border rounded px-2 py-1 outline-none resize-none focus:ring-1 focus:ring-[#6C63FF]"
              />

              {/* Remove Button */}
              <button
                onClick={(e) => { e.stopPropagation(); removeItem(index) }}
                className="absolute top-2 right-2 p-1 text-muted-foreground hover:text-destructive transition rounded-md hover:bg-destructive/10"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>

        {/* Add Award Button */}
        <button
          onClick={(e) => { e.stopPropagation(); addItem() }}
          className="flex items-center gap-1.5 text-sm text-[#6C63FF] hover:text-[#5a52e0] font-medium transition"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Award
        </button>
      </div>

      {/* Delete Button (visible when selected) */}
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
