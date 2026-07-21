'use client'

import { BadgeCheck, Trash2 } from 'lucide-react'
import type { CanvasElement } from '@/lib/types/canvas'
import { ACK_CONFIRM_LABEL_DEFAULT, ACK_BUTTON_LABEL_DEFAULT } from '@/lib/acknowledgment'

interface AcknowledgmentElementProps {
  element: CanvasElement
  onChange: (updates: Partial<CanvasElement>) => void
  onDelete: () => void
  isSelected: boolean
  onSelect: () => void
}

export function AcknowledgmentElement({
  element,
  onChange,
  onDelete,
  isSelected,
  onSelect,
}: AcknowledgmentElementProps) {
  return (
    <div
      onClick={onSelect}
      className={`rounded-xl border bg-white p-4 space-y-3 transition ${
        isSelected ? 'border-primary ring-2 ring-primary/20' : 'border-slate-200'
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BadgeCheck className="w-4 h-4 text-primary" />
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Acknowledgment
          </span>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
          className="text-slate-400 hover:text-red-500"
          aria-label="Delete acknowledgment"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <label className="block">
        <span className="text-xs font-medium text-slate-600">What are they acknowledging?</span>
        <textarea
          value={element.ackStatement || ''}
          onChange={(e) => onChange({ ackStatement: e.target.value })}
          rows={2}
          placeholder="Please confirm you have read the information above."
          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary/50"
        />
      </label>

      <label className="block">
        <span className="text-xs font-medium text-slate-600">Supporting text (optional)</span>
        <input
          value={element.ackDescription || ''}
          onChange={(e) => onChange({ ackDescription: e.target.value })}
          placeholder="Adds a line of context below the statement"
          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary/50"
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-xs font-medium text-slate-600">Confirm label</span>
          <input
            value={element.ackConfirmLabel || ''}
            onChange={(e) => onChange({ ackConfirmLabel: e.target.value })}
            placeholder={ACK_CONFIRM_LABEL_DEFAULT}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary/50"
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-slate-600">Button label</span>
          <input
            value={element.ackButtonLabel || ''}
            onChange={(e) => onChange({ ackButtonLabel: e.target.value })}
            placeholder={ACK_BUTTON_LABEL_DEFAULT}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary/50"
          />
        </label>
      </div>

      <p className="text-xs text-slate-400">
        Visitors must be signed in to acknowledge. Only you can see who did.
      </p>
    </div>
  )
}
