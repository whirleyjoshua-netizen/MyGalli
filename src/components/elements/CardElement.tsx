'use client'

import { Trash2 } from 'lucide-react'
import { CARD_PROVIDERS } from '@/lib/cards/registry'
import { VouchCard } from './cards/VouchCard'
import { IframeCardRenderer } from './cards/IframeCardRenderer'

const CARD_RENDERERS: Record<string, React.ComponentType<{ data: Record<string, any>; style?: 'default' | 'compact' | 'detailed' }>> = {
  vouch: VouchCard,
}

interface CardElementProps {
  provider: string
  data: Record<string, any>
  style: 'default' | 'compact' | 'detailed'
  isSelected: boolean
  onSelect: () => void
  onDelete: () => void
}

export function CardElement({
  provider,
  data,
  style,
  isSelected,
  onSelect,
  onDelete,
}: CardElementProps) {
  const providerConfig = CARD_PROVIDERS[provider]
  const Renderer = CARD_RENDERERS[provider]

  return (
    <div
      className={`relative group transition-all ${isSelected ? 'ring-2 ring-primary rounded-xl' : ''}`}
      onClick={(e) => {
        e.stopPropagation()
        onSelect()
      }}
    >
      {/* Card preview */}
      {providerConfig?.type === 'external' && providerConfig.iframeUrl ? (
        <IframeCardRenderer
          url={providerConfig.iframeUrl}
          data={data}
          style={style}
        />
      ) : Renderer ? (
        <Renderer data={data} style={style} />
      ) : (
        <div className="p-6 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 text-center">
          <p className="text-sm text-slate-500">Select a card provider to get started</p>
        </div>
      )}

      {/* Controls */}
      {isSelected && (
        <div className="absolute -top-3 right-2 flex items-center gap-1 z-10">
          <button
            onClick={(e) => {
              e.stopPropagation()
              onDelete()
            }}
            className="p-1.5 bg-background border border-border rounded-md shadow-sm hover:bg-destructive hover:text-destructive-foreground transition"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

    </div>
  )
}
