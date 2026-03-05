'use client'

import { useState } from 'react'
import { Trash2, Plus, X, Star, MessageSquare } from 'lucide-react'
import type { CanvasElement } from '@/lib/types/canvas'

interface Props {
  element: CanvasElement
  onChange: (updates: Partial<CanvasElement>) => void
  onDelete: () => void
  isSelected: boolean
  onSelect: () => void
}

export function BusinessReviewElement({ element, onChange, onDelete, isSelected, onSelect }: Props) {
  const curated = element.bizReviewCurated ?? []
  const allowSubmissions = element.bizReviewAllowSubmissions ?? true

  const updateReview = (index: number, field: string, value: any) => {
    const updated = [...curated]
    updated[index] = { ...updated[index], [field]: value }
    onChange({ bizReviewCurated: updated })
  }

  const addReview = () => {
    onChange({
      bizReviewCurated: [...curated, { author: '', rating: 5, text: '', date: '', source: '' }],
    })
  }

  const removeReview = (index: number) => {
    onChange({ bizReviewCurated: curated.filter((_, i) => i !== index) })
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
            <MessageSquare className="w-4 h-4 text-amber-500" />
            <input
              type="text"
              value={element.bizReviewTitle ?? 'Customer Reviews'}
              onChange={(e) => onChange({ bizReviewTitle: e.target.value })}
              onClick={(e) => e.stopPropagation()}
              className="text-sm font-semibold bg-transparent border-none outline-none"
            />
          </div>
          <label className="flex items-center gap-1.5 text-[10px] text-muted-foreground cursor-pointer" onClick={(e) => e.stopPropagation()}>
            <input
              type="checkbox"
              checked={allowSubmissions}
              onChange={(e) => onChange({ bizReviewAllowSubmissions: e.target.checked })}
              className="accent-amber-500"
            />
            Allow submissions
          </label>
        </div>

        <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Curated Reviews</div>

        {curated.map((review, index) => (
          <div key={index} className="border border-border rounded-lg p-2.5 space-y-1.5 bg-muted/10">
            <div className="flex gap-2 items-center">
              <input
                type="text"
                value={review.author}
                onChange={(e) => updateReview(index, 'author', e.target.value)}
                onClick={(e) => e.stopPropagation()}
                placeholder="Author name"
                className="flex-1 text-xs bg-transparent border border-border rounded px-2 py-1 outline-none focus:ring-1 focus:ring-amber-500"
              />
              <select
                value={review.rating}
                onChange={(e) => updateReview(index, 'rating', Number(e.target.value))}
                onClick={(e) => e.stopPropagation()}
                className="text-xs bg-muted border border-border rounded px-2 py-1 outline-none"
              >
                {[5, 4, 3, 2, 1].map(n => (
                  <option key={n} value={n}>{n} ★</option>
                ))}
              </select>
              <button onClick={(e) => { e.stopPropagation(); removeReview(index) }} className="p-1 hover:text-destructive">
                <X className="w-3 h-3" />
              </button>
            </div>
            <textarea
              value={review.text}
              onChange={(e) => updateReview(index, 'text', e.target.value)}
              onClick={(e) => e.stopPropagation()}
              placeholder="Review text..."
              rows={2}
              className="w-full text-[10px] bg-transparent border border-border rounded px-2 py-1 outline-none focus:ring-1 focus:ring-amber-500 resize-none"
            />
            <div className="flex gap-2">
              <input
                type="text"
                value={review.date}
                onChange={(e) => updateReview(index, 'date', e.target.value)}
                onClick={(e) => e.stopPropagation()}
                placeholder="Date (e.g. Jan 2026)"
                className="flex-1 text-[10px] bg-transparent border border-border rounded px-2 py-1 outline-none focus:ring-1 focus:ring-amber-500"
              />
              <input
                type="text"
                value={review.source}
                onChange={(e) => updateReview(index, 'source', e.target.value)}
                onClick={(e) => e.stopPropagation()}
                placeholder="Source (e.g. Google, Yelp)"
                className="flex-1 text-[10px] bg-transparent border border-border rounded px-2 py-1 outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>
          </div>
        ))}

        <button
          onClick={(e) => { e.stopPropagation(); addReview() }}
          className="flex items-center gap-1.5 text-sm text-amber-500 hover:text-amber-600 font-medium transition"
        >
          <Plus className="w-3.5 h-3.5" /> Add curated review
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
