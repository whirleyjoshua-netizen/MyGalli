'use client'

import { useState, useEffect } from 'react'
import { X, Library, Layers } from 'lucide-react'
import Link from 'next/link'
import { CARD_PROVIDERS } from '@/lib/cards/registry'
import type { CardProviderConfig } from '@/lib/cards/registry'
import { VouchCard } from '@/components/elements/cards/VouchCard'
import { IframeCardRenderer } from '@/components/elements/cards/IframeCardRenderer'

const BUILTIN_RENDERERS: Record<string, React.ComponentType<{ data: Record<string, any>; style?: 'default' | 'compact' | 'detailed' }>> = {
  vouch: VouchCard,
}

interface LibraryItem {
  id: string
  provider: string
  name: string
  data: Record<string, any>
  style: string
}

interface CardLibraryPickerProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (card: { provider: string; data: Record<string, any>; style: string }) => void
}

function MiniPreview({ provider, data, style }: { provider: CardProviderConfig; data: Record<string, any>; style: string }) {
  const cardStyle = (style || 'default') as 'default' | 'compact' | 'detailed'

  if (provider.type === 'external' && provider.iframeUrl) {
    return (
      <IframeCardRenderer
        url={provider.iframeUrl}
        data={data}
        style={cardStyle}
      />
    )
  }

  const Renderer = BUILTIN_RENDERERS[provider.id]
  if (Renderer) {
    return <Renderer data={data} style={cardStyle} />
  }

  return <div className="p-4 text-xs text-muted-foreground text-center">No preview</div>
}

export function CardLibraryPicker({ isOpen, onClose, onSelect }: CardLibraryPickerProps) {
  const [items, setItems] = useState<LibraryItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isOpen) return
    setLoading(true)
    fetch('/api/card-library')
      .then(res => res.ok ? res.json() : [])
      .then(data => setItems(data))
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }, [isOpen])

  if (!isOpen) return null

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-50" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="bg-background border border-border rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-galli/10 rounded-lg">
                <Layers className="w-5 h-5 text-gallio" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Choose a Card</h3>
                <p className="text-xs text-muted-foreground">Select a card from your library</p>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 hover:bg-muted rounded-lg transition">
              <X className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>

          {/* Content */}
          <div className="overflow-y-auto flex-1 p-6">
            {loading ? (
              <div className="text-center py-12 text-muted-foreground">Loading library...</div>
            ) : items.length === 0 ? (
              <div className="text-center py-12">
                <Library className="w-12 h-12 text-muted-foreground/20 mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No cards in your library</h3>
                <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
                  Visit Card Studio to browse available cards and add them to your library.
                </p>
                <Link
                  href="/card-studio"
                  onClick={onClose}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-full text-sm font-medium hover:shadow-lg transition"
                >
                  <Layers className="w-4 h-4" />
                  Open Card Studio
                </Link>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {items.map(item => {
                  const provider = CARD_PROVIDERS[item.provider]
                  if (!provider) return null
                  return (
                    <button
                      key={item.id}
                      onClick={() => onSelect({
                        provider: item.provider,
                        data: item.data,
                        style: item.style,
                      })}
                      className="group text-left border border-border rounded-xl overflow-hidden hover:border-galli/40 hover:shadow-lg hover:shadow-galli/10 transition-all bg-background"
                    >
                      {/* Preview */}
                      <div className="p-3 bg-muted/20 border-b border-border min-h-[120px] flex items-center justify-center">
                        <div className="w-full max-w-[240px] transform scale-75 origin-center pointer-events-none">
                          <MiniPreview provider={provider} data={item.data} style={item.style} />
                        </div>
                      </div>
                      {/* Info */}
                      <div className="p-3">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold group-hover:text-gallio transition-colors truncate">
                            {item.name}
                          </span>
                          <span className={`px-2 py-0.5 text-[10px] font-medium rounded-full flex-shrink-0 ${
                            provider.type === 'builtin'
                              ? 'bg-galli/10 text-gallio'
                              : 'bg-galli-violet/10 text-galli-violet'
                          }`}>
                            {provider.name}
                          </span>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-3 border-t border-border flex-shrink-0 flex items-center justify-between bg-muted/20">
            <Link
              href="/card-studio"
              onClick={onClose}
              className="text-xs text-muted-foreground hover:text-foreground transition"
            >
              Manage library in Card Studio
            </Link>
            <button
              onClick={onClose}
              className="px-4 py-1.5 text-sm text-muted-foreground hover:text-foreground transition"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
