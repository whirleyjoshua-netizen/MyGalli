'use client'

import { useState } from 'react'
import { X, Palette, Sparkles, Grid3X3, Image } from 'lucide-react'
import type { BackgroundConfig } from '@/lib/types/background'
import {
  PRESET_COLORS,
  PRESET_GRADIENTS,
  PRESET_PATTERNS,
} from '@/lib/types/background'
import { ImageUploadField } from '@/components/ui/ImageUploadField'

interface BackgroundSettingsProps {
  isOpen: boolean
  onClose: () => void
  config: BackgroundConfig
  onChange: (config: BackgroundConfig) => void
}

type TabType = 'solid' | 'gradient' | 'pattern' | 'image'

export function BackgroundSettingsBody({
  config,
  onChange,
}: {
  config: BackgroundConfig
  onChange: (config: BackgroundConfig) => void
}) {
  const [activeTab, setActiveTab] = useState<TabType>(config.type)

  const handleTypeChange = (type: TabType) => {
    setActiveTab(type)
    onChange({ ...config, type })
  }

  return (
    <>
        {/* Tabs — 2×2 grid of segmented pills so all modes fit the fixed-width panel */}
        <div className="grid grid-cols-2 gap-1 p-2 border-b border-border">
          {([
            ['solid', Palette, 'Solid'],
            ['gradient', Sparkles, 'Gradient'],
            ['pattern', Grid3X3, 'Pattern'],
            ['image', Image, 'Image'],
          ] as const).map(([type, Icon, label]) => (
            <button
              key={type}
              onClick={() => handleTypeChange(type)}
              className={`flex items-center justify-center gap-1.5 min-w-0 px-2 py-1.5 text-sm font-medium rounded-md transition-colors ${
                activeTab === type
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Solid Colors */}
          {activeTab === 'solid' && (
            <div>
              <label className="block text-sm font-medium mb-3">
                Choose a color
              </label>
              <div className="grid grid-cols-9 gap-2">
                {PRESET_COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => onChange({ ...config, type: 'solid', solidColor: color })}
                    className={`w-8 h-8 rounded-lg transition-all border-2 ${
                      config.solidColor === color && config.type === 'solid'
                        ? 'border-primary scale-110 shadow-md'
                        : 'border-transparent hover:scale-105'
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
              <div className="mt-4">
                <label className="block text-sm font-medium mb-2">
                  Custom color
                </label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={config.solidColor || '#ffffff'}
                    onChange={(e) =>
                      onChange({ ...config, type: 'solid', solidColor: e.target.value })
                    }
                    className="w-10 h-10 rounded cursor-pointer"
                  />
                  <input
                    type="text"
                    placeholder="#ffffff"
                    value={config.solidColor || ''}
                    onChange={(e) =>
                      onChange({ ...config, type: 'solid', solidColor: e.target.value })
                    }
                    className="flex-1 px-3 py-2 border border-border rounded-lg bg-background text-sm"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Gradients */}
          {activeTab === 'gradient' && (
            <div>
              <label className="block text-sm font-medium mb-3">
                Choose a gradient
              </label>
              <div className="grid grid-cols-2 gap-3">
                {PRESET_GRADIENTS.map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() =>
                      onChange({
                        ...config,
                        type: 'gradient',
                        gradient: {
                          type: 'linear',
                          direction: preset.direction,
                          colors: preset.colors,
                        },
                      })
                    }
                    className={`h-20 rounded-lg border-2 transition-all ${
                      config.gradient?.colors.join(',') === preset.colors.join(',')
                        ? 'border-primary'
                        : 'border-transparent hover:border-border'
                    }`}
                    style={{
                      background: `linear-gradient(${preset.direction}, ${preset.colors.join(', ')})`,
                    }}
                  >
                    <div className="w-full h-full flex items-end p-2 bg-gradient-to-t from-black/50 to-transparent rounded-lg">
                      <span className="text-white text-sm font-medium">
                        {preset.name}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Patterns */}
          {activeTab === 'pattern' && (
            <div>
              <label className="block text-sm font-medium mb-3">
                Choose a pattern
              </label>
              <div className="grid grid-cols-2 gap-3">
                {PRESET_PATTERNS.map((pattern) => (
                  <button
                    key={pattern.id}
                    onClick={() =>
                      onChange({ ...config, type: 'pattern', patternId: pattern.id })
                    }
                    className={`h-20 rounded-lg border-2 transition-all ${
                      config.patternId === pattern.id && config.type === 'pattern'
                        ? 'border-primary'
                        : 'border-border hover:border-primary/50'
                    }`}
                    style={{
                      background: pattern.css,
                      backgroundSize: pattern.size,
                      backgroundColor: '#ffffff',
                    }}
                  >
                    <div className="w-full h-full flex items-end p-2 bg-gradient-to-t from-white/90 to-transparent rounded-lg">
                      <span className="text-foreground text-sm font-medium">
                        {pattern.name}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Image */}
          {activeTab === 'image' && (
            <div>
              <ImageUploadField
                label="Background image"
                value={config.imageUrl}
                onChange={(url) =>
                  onChange({ ...config, type: 'image', imageUrl: url })
                }
                previewAspect="wide"
              />

              {config.imageUrl && (
                <div className="mt-4 space-y-4">
                  {/* Image Mode */}
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Image Mode
                    </label>
                    <div className="flex gap-2">
                      {(['cover', 'contain', 'tile'] as const).map((mode) => (
                        <button
                          key={mode}
                          onClick={() => onChange({ ...config, imageMode: mode })}
                          className={`flex-1 px-3 py-2 rounded-lg border text-sm capitalize ${
                            config.imageMode === mode
                              ? 'bg-primary text-primary-foreground border-primary'
                              : 'bg-background border-border hover:border-primary/50'
                          }`}
                        >
                          {mode}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Common Settings */}
          <div className="mt-6 pt-6 border-t border-border space-y-4">
            {/* Scroll Behavior */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Scroll Behavior
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => onChange({ ...config, scrollBehavior: 'scroll' })}
                  className={`flex-1 px-3 py-2 rounded-lg border text-sm ${
                    config.scrollBehavior === 'scroll'
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background border-border hover:border-primary/50'
                  }`}
                >
                  Scroll with page
                </button>
                <button
                  onClick={() => onChange({ ...config, scrollBehavior: 'fixed' })}
                  className={`flex-1 px-3 py-2 rounded-lg border text-sm ${
                    config.scrollBehavior === 'fixed'
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background border-border hover:border-primary/50'
                  }`}
                >
                  Fixed (Parallax)
                </button>
              </div>
            </div>

            {/* Opacity */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Opacity: {config.opacity}%
              </label>
              <input
                type="range"
                min="0"
                max="100"
                value={config.opacity}
                onChange={(e) =>
                  onChange({ ...config, opacity: Number(e.target.value) })
                }
                className="w-full"
              />
            </div>
          </div>
        </div>
    </>
  )
}

export function BackgroundSettings({
  isOpen,
  onClose,
  config,
  onChange,
}: BackgroundSettingsProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-background rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col border border-border">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-xl font-bold">Background Settings</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-muted rounded transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <BackgroundSettingsBody config={config} onChange={onChange} />

        {/* Footer */}
        <div className="flex justify-end gap-2 p-4 border-t border-border">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
