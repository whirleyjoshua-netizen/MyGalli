'use client'

import { Trash2, Award } from 'lucide-react'
import type { CanvasElement } from '@/lib/types/canvas'

interface Props {
  element: CanvasElement
  onChange: (updates: Partial<CanvasElement>) => void
  onDelete: () => void
  isSelected: boolean
  onSelect: () => void
}

export function CertificationBadgeElement({ element, onChange, onDelete, isSelected, onSelect }: Props) {
  return (
    <div
      className={`relative group rounded-xl border bg-background transition-all ${
        isSelected ? 'ring-2 ring-[#6C63FF] border-[#6C63FF]/30' : 'border-border hover:border-[#6C63FF]/30'
      }`}
      onClick={(e) => { e.stopPropagation(); onSelect() }}
    >
      <div className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-[#6C63FF]/10 text-[#6C63FF] mt-0.5">
            <Award className="w-4 h-4" />
          </div>
          <div className="flex-1 space-y-2">
            <input
              type="text"
              value={element.certName || ''}
              onChange={(e) => onChange({ certName: e.target.value })}
              onClick={(e) => e.stopPropagation()}
              placeholder="Certification Name"
              className="w-full bg-transparent border-none outline-none font-semibold text-foreground text-lg"
            />
            <input
              type="text"
              value={element.certIssuer || ''}
              onChange={(e) => onChange({ certIssuer: e.target.value })}
              onClick={(e) => e.stopPropagation()}
              placeholder="Issuing Organization"
              className="w-full bg-transparent border-none outline-none text-foreground/80"
            />
          </div>
        </div>

        {/* Metadata row */}
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            value={element.certDateObtained || ''}
            onChange={(e) => onChange({ certDateObtained: e.target.value })}
            onClick={(e) => e.stopPropagation()}
            placeholder="Date Obtained (MM/YYYY)"
            className="bg-muted/30 border border-border rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[#6C63FF] w-44"
          />
          <input
            type="text"
            value={element.certExpirationDate || ''}
            onChange={(e) => onChange({ certExpirationDate: e.target.value })}
            onClick={(e) => e.stopPropagation()}
            placeholder="Expiration (optional)"
            className="bg-muted/30 border border-border rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[#6C63FF] w-44"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            value={element.certCredentialId || ''}
            onChange={(e) => onChange({ certCredentialId: e.target.value })}
            onClick={(e) => e.stopPropagation()}
            placeholder="Credential ID (optional)"
            className="bg-muted/30 border border-border rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[#6C63FF] flex-1 min-w-[160px]"
          />
          <input
            type="url"
            value={element.certCredentialUrl || ''}
            onChange={(e) => onChange({ certCredentialUrl: e.target.value })}
            onClick={(e) => e.stopPropagation()}
            placeholder="Verification URL (optional)"
            className="bg-muted/30 border border-border rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[#6C63FF] flex-1 min-w-[160px]"
          />
        </div>
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
