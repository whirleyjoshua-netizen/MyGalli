'use client'

import { useState } from 'react'
import { Trash2, Settings } from 'lucide-react'
import { CARD_PROVIDERS } from '@/lib/cards/registry'
import type { CardField } from '@/lib/cards/registry'
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
  onChange: (updates: Partial<{
    cardProvider: string
    cardData: Record<string, any>
    cardStyle: 'default' | 'compact' | 'detailed'
  }>) => void
}

export function CardElement({
  provider,
  data,
  style,
  isSelected,
  onSelect,
  onDelete,
  onChange,
}: CardElementProps) {
  const [showSettings, setShowSettings] = useState(false)
  const providerConfig = CARD_PROVIDERS[provider]
  const Renderer = CARD_RENDERERS[provider]

  const handleProviderChange = (newProvider: string) => {
    const config = CARD_PROVIDERS[newProvider]
    if (config) {
      onChange({
        cardProvider: newProvider,
        cardData: { ...config.defaultData },
        cardStyle: 'default',
      })
    }
  }

  const handleFieldChange = (key: string, value: any) => {
    onChange({
      cardData: { ...data, [key]: value },
    })
  }

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
              setShowSettings(!showSettings)
            }}
            className="p-1.5 bg-background border border-border rounded-md shadow-sm hover:bg-muted transition"
          >
            <Settings className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
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

      {/* Settings Panel */}
      {showSettings && isSelected && (
        <div
          className="absolute top-full left-0 mt-2 w-80 bg-background border border-border rounded-lg shadow-xl p-4 z-50 max-h-96 overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <h4 className="font-medium mb-3 text-sm">Card Settings</h4>

          {/* Provider selector */}
          <div className="mb-3">
            <label className="text-xs text-muted-foreground block mb-1">Provider</label>
            <select
              value={provider}
              onChange={(e) => handleProviderChange(e.target.value)}
              className="w-full px-2 py-1.5 text-sm bg-muted border border-border rounded-md outline-none focus:ring-2 focus:ring-primary"
            >
              {Object.values(CARD_PROVIDERS).map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {/* Style selector */}
          <div className="mb-3">
            <label className="text-xs text-muted-foreground block mb-1">Style</label>
            <div className="flex gap-1">
              {(['default', 'compact', 'detailed'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => onChange({ cardStyle: s })}
                  className={`flex-1 py-1.5 text-xs rounded-md border transition capitalize ${
                    style === s
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-muted border-border hover:border-muted-foreground'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Dynamic fields */}
          {providerConfig && (
            <div className="space-y-2 border-t border-border pt-3">
              <label className="text-xs text-muted-foreground block">Card Data</label>
              {providerConfig.fields.map((field: CardField) => (
                <div key={field.key}>
                  <label className="text-xs text-muted-foreground block mb-0.5">
                    {field.label}
                    {field.required && <span className="text-destructive ml-0.5">*</span>}
                  </label>
                  {field.type === 'textarea' ? (
                    <textarea
                      value={data[field.key] ?? ''}
                      onChange={(e) => handleFieldChange(field.key, e.target.value)}
                      placeholder={field.placeholder}
                      rows={2}
                      className="w-full px-2 py-1.5 text-sm bg-muted border border-border rounded-md outline-none focus:ring-2 focus:ring-primary resize-none"
                    />
                  ) : field.type === 'number' ? (
                    <input
                      type="number"
                      value={data[field.key] ?? ''}
                      onChange={(e) => handleFieldChange(field.key, parseInt(e.target.value) || 0)}
                      placeholder={field.placeholder}
                      className="w-full px-2 py-1.5 text-sm bg-muted border border-border rounded-md outline-none focus:ring-2 focus:ring-primary"
                    />
                  ) : (
                    <input
                      type={field.type === 'url' ? 'url' : 'text'}
                      value={data[field.key] ?? ''}
                      onChange={(e) => handleFieldChange(field.key, e.target.value)}
                      placeholder={field.placeholder}
                      className="w-full px-2 py-1.5 text-sm bg-muted border border-border rounded-md outline-none focus:ring-2 focus:ring-primary"
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
