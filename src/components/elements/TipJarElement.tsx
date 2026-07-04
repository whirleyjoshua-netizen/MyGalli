'use client'

import { Trash2, HandCoins } from 'lucide-react'
import type { CanvasElement } from '@/lib/types/canvas'

interface Props {
  element: CanvasElement
  onChange: (updates: Partial<CanvasElement>) => void
  onDelete: () => void
  isSelected: boolean
  onSelect: () => void
}

export function TipJarElement({ element, onChange, onDelete, isSelected, onSelect }: Props) {
  const amounts = element.tipJarAmounts ?? []

  return (
    <div
      className={`relative group rounded-xl border bg-background transition-all ${
        isSelected ? 'ring-2 ring-primary border-primary/30' : 'border-border hover:border-primary/30'
      }`}
      onClick={(e) => { e.stopPropagation(); onSelect() }}
    >
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <HandCoins className="w-4 h-4 text-primary" />
          <input
            type="text"
            value={element.tipJarTitle ?? ''}
            onChange={(e) => onChange({ tipJarTitle: e.target.value })}
            onClick={(e) => e.stopPropagation()}
            placeholder="Support my work"
            className="text-sm font-semibold bg-transparent border-none outline-none flex-1"
          />
        </div>

        <textarea
          value={element.tipJarMessage ?? ''}
          onChange={(e) => onChange({ tipJarMessage: e.target.value })}
          onClick={(e) => e.stopPropagation()}
          placeholder="If you enjoy what I do, consider leaving a tip"
          rows={2}
          className="w-full text-sm bg-transparent border border-border rounded-lg p-2 outline-none resize-none"
        />

        <div className="flex gap-2">
          <select
            value={element.tipJarPlatform ?? 'custom'}
            onChange={(e) => onChange({ tipJarPlatform: e.target.value as CanvasElement['tipJarPlatform'] })}
            onClick={(e) => e.stopPropagation()}
            className="text-sm bg-transparent border border-border rounded-lg p-2 outline-none"
          >
            <option value="kofi">Ko-fi</option>
            <option value="venmo">Venmo</option>
            <option value="paypal">PayPal</option>
            <option value="cashapp">Cash App</option>
            <option value="stripe">Stripe</option>
            <option value="custom">Custom</option>
          </select>

          <input
            type="text"
            value={element.tipJarUrl ?? ''}
            onChange={(e) => onChange({ tipJarUrl: e.target.value })}
            onClick={(e) => e.stopPropagation()}
            placeholder="https://ko-fi.com/yourname"
            className="flex-1 text-sm bg-transparent border border-border rounded-lg p-2 outline-none"
          />
        </div>

        <input
          type="text"
          value={element.tipJarButtonText ?? ''}
          onChange={(e) => onChange({ tipJarButtonText: e.target.value })}
          onClick={(e) => e.stopPropagation()}
          placeholder="Leave a tip"
          className="w-full text-sm bg-transparent border border-border rounded-lg p-2 outline-none"
        />

        <input
          type="text"
          value={amounts.join(', ')}
          onChange={(e) => onChange({ tipJarAmounts: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })}
          onClick={(e) => e.stopPropagation()}
          placeholder="$3, $5, $10"
          className="w-full text-sm bg-transparent border border-border rounded-lg p-2 outline-none"
        />
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
