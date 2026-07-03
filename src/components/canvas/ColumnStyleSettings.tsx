'use client'

import { X, Palette, Square, ToggleRight, Maximize } from 'lucide-react'
import type { ColumnSettings } from '@/lib/types/canvas'
import { DEFAULT_COLUMN_SETTINGS } from '@/lib/types/canvas'

interface ColumnStyleSettingsProps {
  isOpen: boolean
  onClose: () => void
  settings: ColumnSettings
  onChange: (settings: ColumnSettings) => void
}

const PRESET_COLORS = [
  '#ffffff', '#f8fafc', '#f1f5f9', '#e2e8f0',
  '#1e293b', '#0f172a', '#020617', '#000000',
  '#fef2f2', '#fef7ee', '#fefce8', '#f0fdf4',
  '#ecfeff', '#eff6ff', '#f5f3ff', '#fdf4ff',
  '#fee2e2', '#fed7aa', '#fef08a', '#bbf7d0',
  '#a5f3fc', '#bfdbfe', '#ddd6fe', '#f5d0fe',
]

export function ColumnStyleSettingsBody({
  settings,
  onChange,
}: {
  settings: ColumnSettings
  onChange: (settings: ColumnSettings) => void
}) {
  const handleBackgroundTypeChange = (type: ColumnSettings['background']) => {
    onChange({ ...settings, background: type })
  }

  return (
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Background Type */}
          <div>
            <label className="block text-sm font-medium mb-3">
              Background Style
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => handleBackgroundTypeChange('transparent')}
                className={`flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all ${
                  settings.background === 'transparent'
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <div className="w-10 h-10 rounded border-2 border-dashed border-muted-foreground/30 flex items-center justify-center">
                  <Square className="w-5 h-5 text-muted-foreground/50" />
                </div>
                <span className="text-xs font-medium">Transparent</span>
              </button>
              <button
                onClick={() => handleBackgroundTypeChange('translucent')}
                className={`flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all ${
                  settings.background === 'translucent'
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <div className="w-10 h-10 rounded bg-white/60 backdrop-blur-sm border border-white/20 shadow-sm" />
                <span className="text-xs font-medium">Glass</span>
              </button>
              <button
                onClick={() => handleBackgroundTypeChange('solid')}
                className={`flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all ${
                  settings.background === 'solid'
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <div
                  className="w-10 h-10 rounded shadow-sm border border-border"
                  style={{ backgroundColor: settings.backgroundColor }}
                />
                <span className="text-xs font-medium">Solid</span>
              </button>
            </div>
          </div>

          {/* Background Color - only show for solid and translucent */}
          {(settings.background === 'solid' || settings.background === 'translucent') && (
            <div>
              <label className="block text-sm font-medium mb-3">
                {settings.background === 'translucent' ? 'Tint Color' : 'Background Color'}
              </label>
              <div className="grid grid-cols-8 gap-2 mb-3">
                {PRESET_COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => onChange({ ...settings, backgroundColor: color })}
                    className={`w-8 h-8 rounded-lg transition-all border-2 ${
                      settings.backgroundColor === color
                        ? 'border-primary scale-110 shadow-md'
                        : 'border-transparent hover:scale-105'
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={settings.backgroundColor}
                  onChange={(e) => onChange({ ...settings, backgroundColor: e.target.value })}
                  className="w-10 h-10 rounded cursor-pointer"
                />
                <input
                  type="text"
                  placeholder="#ffffff"
                  value={settings.backgroundColor}
                  onChange={(e) => onChange({ ...settings, backgroundColor: e.target.value })}
                  className="flex-1 px-3 py-2 border border-border rounded-lg bg-background text-sm"
                />
              </div>
            </div>
          )}

          {/* Border Settings */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium mb-3">
              <input
                type="checkbox"
                checked={settings.borderVisible}
                onChange={(e) => onChange({ ...settings, borderVisible: e.target.checked })}
                className="rounded"
              />
              Show Border
            </label>

            {settings.borderVisible && (
              <div className="pl-6 space-y-3">
                <div>
                  <label className="block text-xs text-muted-foreground mb-2">
                    Border Color
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={settings.borderColor}
                      onChange={(e) => onChange({ ...settings, borderColor: e.target.value })}
                      className="w-8 h-8 rounded cursor-pointer"
                    />
                    <input
                      type="text"
                      placeholder="#e2e8f0"
                      value={settings.borderColor}
                      onChange={(e) => onChange({ ...settings, borderColor: e.target.value })}
                      className="flex-1 px-3 py-1.5 border border-border rounded-lg bg-background text-sm"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Border Radius */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Corner Radius: {settings.borderRadius}px
            </label>
            <input
              type="range"
              min="0"
              max="32"
              value={settings.borderRadius}
              onChange={(e) => onChange({ ...settings, borderRadius: Number(e.target.value) })}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>Sharp</span>
              <span>Round</span>
            </div>
          </div>

          {/* Padding */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Padding: {settings.padding}px
            </label>
            <input
              type="range"
              min="0"
              max="48"
              step="4"
              value={settings.padding}
              onChange={(e) => onChange({ ...settings, padding: Number(e.target.value) })}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>None</span>
              <span>Spacious</span>
            </div>
          </div>

          {/* Preview */}
          <div>
            <label className="block text-sm font-medium mb-3">Preview</label>
            <div className="p-4 rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-500/20">
              <div
                className="transition-all"
                style={{
                  backgroundColor: settings.background === 'solid'
                    ? settings.backgroundColor
                    : settings.background === 'translucent'
                    ? `${settings.backgroundColor}80`
                    : 'transparent',
                  backdropFilter: settings.background === 'translucent' ? 'blur(12px)' : 'none',
                  border: settings.borderVisible
                    ? `1px solid ${settings.borderColor}`
                    : settings.background === 'translucent'
                    ? '1px solid rgba(255,255,255,0.2)'
                    : 'none',
                  borderRadius: `${settings.borderRadius}px`,
                  padding: `${settings.padding}px`,
                  boxShadow: settings.background === 'translucent'
                    ? '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)'
                    : 'none',
                }}
              >
                <div className="text-sm font-medium mb-1">Sample Content</div>
                <div className="text-xs text-muted-foreground">
                  This is how your column will look with the current settings.
                </div>
              </div>
            </div>
          </div>
        </div>
  )
}

export function ColumnStyleSettings({
  isOpen,
  onClose,
  settings,
  onChange,
}: ColumnStyleSettingsProps) {
  if (!isOpen) return null

  const handleReset = () => {
    onChange(DEFAULT_COLUMN_SETTINGS)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-background rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col border border-border">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-bold">Column Style</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-muted rounded transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <ColumnStyleSettingsBody settings={settings} onChange={onChange} />

        {/* Footer */}
        <div className="flex justify-between gap-2 p-4 border-t border-border">
          <button
            onClick={handleReset}
            className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition"
          >
            Reset to Default
          </button>
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
