'use client'

import { useState } from 'react'
import { Trash2, Settings, Shirt } from 'lucide-react'
import type { CanvasElement } from '@/lib/types/canvas'
import { JerseySVG } from './JerseySVG'

interface Props {
  element: CanvasElement
  onChange: (updates: Partial<CanvasElement>) => void
  onDelete: () => void
  isSelected: boolean
  onSelect: () => void
}

export function JerseyElement({ element, onChange, onDelete, isSelected, onSelect }: Props) {
  const [showSettings, setShowSettings] = useState(false)

  const number = element.jerseyNumber || '1'
  const name = element.jerseyName || 'PLAYER'
  const primaryColor = element.jerseyPrimaryColor || '#39D98A'
  const secondaryColor = element.jerseySecondaryColor || '#0F3D2E'
  const style = element.jerseyStyle || 'classic'
  const signaturesEnabled = element.jerseySignaturesEnabled !== false

  return (
    <div
      className={`relative rounded-xl border transition-all ${
        isSelected ? 'border-primary ring-2 ring-primary/20' : 'border-border hover:border-border/80'
      }`}
      onClick={(e) => { e.stopPropagation(); onSelect() }}
    >
      {/* Controls */}
      {isSelected && (
        <div className="absolute -top-3 right-2 flex items-center gap-1 z-10">
          <button
            onClick={(e) => { e.stopPropagation(); setShowSettings(!showSettings) }}
            className="p-1.5 rounded-lg bg-background border border-border shadow-sm hover:bg-muted transition"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete() }}
            className="p-1.5 rounded-lg bg-background border border-border shadow-sm hover:bg-destructive/10 hover:text-destructive transition"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <div className="p-6">
        {/* Label */}
        <div className="flex items-center gap-2 mb-4">
          <Shirt className="w-5 h-5 text-primary" />
          <span className="text-lg font-semibold">My Jersey</span>
        </div>

        {/* Preview */}
        <div className="flex justify-center mb-4">
          <div className="drop-shadow-lg">
            <JerseySVG
              primaryColor={primaryColor}
              secondaryColor={secondaryColor}
              number={number}
              name={name}
              style={style}
            />
          </div>
        </div>

        {/* Settings Panel */}
        {showSettings && (
          <div className="border-t border-border pt-4 space-y-4">
            {/* Number & Name */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Number</label>
                <input
                  type="text"
                  value={number}
                  onChange={(e) => onChange({ jerseyNumber: e.target.value })}
                  maxLength={3}
                  className="w-full px-3 py-2 border border-border rounded-xl text-center text-2xl font-bold outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => onChange({ jerseyName: e.target.value })}
                  maxLength={20}
                  className="w-full px-3 py-2 border border-border rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-primary uppercase"
                />
              </div>
            </div>

            {/* Colors */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Primary Color</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={primaryColor}
                    onChange={(e) => onChange({ jerseyPrimaryColor: e.target.value })}
                    className="w-8 h-8 rounded-lg cursor-pointer border border-border"
                  />
                  <input
                    type="text"
                    value={primaryColor}
                    onChange={(e) => onChange({ jerseyPrimaryColor: e.target.value })}
                    className="flex-1 px-2 py-1 border border-border rounded-lg text-xs font-mono outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Secondary Color</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={secondaryColor}
                    onChange={(e) => onChange({ jerseySecondaryColor: e.target.value })}
                    className="w-8 h-8 rounded-lg cursor-pointer border border-border"
                  />
                  <input
                    type="text"
                    value={secondaryColor}
                    onChange={(e) => onChange({ jerseySecondaryColor: e.target.value })}
                    className="flex-1 px-2 py-1 border border-border rounded-lg text-xs font-mono outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>
            </div>

            {/* Style */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Jersey Style</label>
              <div className="flex gap-2">
                {(['classic', 'modern', 'retro'] as const).map((s) => (
                  <button
                    key={s}
                    onClick={(e) => { e.stopPropagation(); onChange({ jerseyStyle: s }) }}
                    className={`px-4 py-2 text-xs font-medium rounded-full border transition ${
                      style === s
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'border-border hover:bg-muted'
                    }`}
                  >
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Signatures toggle */}
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-medium">Fan Signatures</div>
                <div className="text-[10px] text-muted-foreground">Allow visitors to sign your jersey</div>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onChange({ jerseySignaturesEnabled: !signaturesEnabled })
                }}
                className={`relative w-10 h-5 rounded-full transition ${
                  signaturesEnabled ? 'bg-primary' : 'bg-muted'
                }`}
              >
                <div
                  className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                    signaturesEnabled ? 'translate-x-5' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
