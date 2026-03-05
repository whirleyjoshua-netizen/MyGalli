'use client'

import { Trash2, Plus, X, Quote } from 'lucide-react'
import type { CanvasElement } from '@/lib/types/canvas'

interface Props {
  element: CanvasElement
  onChange: (updates: Partial<CanvasElement>) => void
  onDelete: () => void
  isSelected: boolean
  onSelect: () => void
}

export function QuoteWallElement({ element, onChange, onDelete, isSelected, onSelect }: Props) {
  const quotes = element.quoteWallQuotes ?? []

  const updateQuote = (index: number, field: 'text' | 'author' | 'source', value: string) => {
    const updated = [...quotes]
    updated[index] = { ...updated[index], [field]: value }
    onChange({ quoteWallQuotes: updated })
  }

  const addQuote = () => {
    onChange({ quoteWallQuotes: [...quotes, { text: '', author: '', source: '' }] })
  }

  const removeQuote = (index: number) => {
    onChange({ quoteWallQuotes: quotes.filter((_, i) => i !== index) })
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
          <Quote className="w-4 h-4 text-[#FF6B6B]" />
          <input
            type="text"
            value={element.quoteWallTitle ?? 'Words I Live By'}
            onChange={(e) => onChange({ quoteWallTitle: e.target.value })}
            onClick={(e) => e.stopPropagation()}
            className="text-sm font-semibold bg-transparent border-none outline-none"
          />
        </div>

        <div className="space-y-3">
          {quotes.map((q, index) => (
            <div key={index} className="relative bg-muted/30 rounded-lg p-3 border border-border space-y-1.5">
              <textarea
                value={q.text}
                onChange={(e) => updateQuote(index, 'text', e.target.value)}
                onClick={(e) => e.stopPropagation()}
                placeholder="Quote text..."
                rows={2}
                className="w-full text-sm bg-transparent border-none outline-none resize-none"
              />
              <div className="flex gap-2">
                <input
                  type="text"
                  value={q.author}
                  onChange={(e) => updateQuote(index, 'author', e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  placeholder="Author"
                  className="flex-1 text-xs bg-transparent border border-border rounded px-2 py-1 outline-none focus:ring-1 focus:ring-[#FF6B6B]"
                />
                <input
                  type="text"
                  value={q.source}
                  onChange={(e) => updateQuote(index, 'source', e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  placeholder="Source (optional)"
                  className="flex-1 text-xs bg-transparent border border-border rounded px-2 py-1 outline-none focus:ring-1 focus:ring-[#FF6B6B]"
                />
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); removeQuote(index) }}
                className="absolute top-2 right-2 p-1 text-muted-foreground hover:text-destructive transition rounded-md hover:bg-destructive/10"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>

        <button
          onClick={(e) => { e.stopPropagation(); addQuote() }}
          className="flex items-center gap-1.5 text-sm text-[#FF6B6B] hover:text-[#e55a5a] font-medium transition"
        >
          <Plus className="w-3.5 h-3.5" />
          Add quote
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
