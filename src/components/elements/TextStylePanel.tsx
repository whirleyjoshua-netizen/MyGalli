'use client'

import { useState } from 'react'
import {
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  Italic, X, ChevronDown
} from 'lucide-react'
import { FontPicker } from './FontPicker'
import type { TextStyle } from '@/lib/types/canvas'

const PRESET_SIZES = [12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 64, 72, 96]

const FONT_WEIGHTS = [
  { value: 100, label: 'Thin' },
  { value: 200, label: 'Extra Light' },
  { value: 300, label: 'Light' },
  { value: 400, label: 'Regular' },
  { value: 500, label: 'Medium' },
  { value: 600, label: 'Semibold' },
  { value: 700, label: 'Bold' },
  { value: 800, label: 'Extra Bold' },
  { value: 900, label: 'Black' },
]

const PRESET_COLORS = [
  '#000000', '#ffffff', '#64748b', '#ef4444',
  '#f97316', '#f59e0b', '#22c55e', '#3b82f6',
  '#8b5cf6', '#ec4899', '#39D98A', '#1FB6FF',
]

const ALIGNMENTS = [
  { value: 'left' as const, icon: AlignLeft },
  { value: 'center' as const, icon: AlignCenter },
  { value: 'right' as const, icon: AlignRight },
  { value: 'justify' as const, icon: AlignJustify },
]

const TRANSFORMS = [
  { value: 'none' as const, label: 'Aa' },
  { value: 'uppercase' as const, label: 'AA' },
  { value: 'lowercase' as const, label: 'aa' },
  { value: 'capitalize' as const, label: 'Ab' },
]

interface TextStylePanelProps extends TextStyle {
  onChange: (updates: Partial<TextStyle>) => void
  onClose: () => void
}

export function TextStylePanel({
  fontFamily,
  fontSize,
  fontWeight,
  fontStyle,
  textAlign,
  textColor,
  letterSpacing,
  lineHeight,
  textTransform,
  onChange,
  onClose,
}: TextStylePanelProps) {
  const [showSizePresets, setShowSizePresets] = useState(false)
  const [customColor, setCustomColor] = useState(textColor || '')

  return (
    <div
      className="absolute top-full left-0 mt-2 w-80 bg-background border border-border rounded-xl shadow-xl z-50 overflow-hidden"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-muted/50 border-b border-border">
        <h4 className="font-semibold text-sm">Text Style</h4>
        <button onClick={onClose} className="p-0.5 hover:bg-muted rounded">
          <X className="w-3.5 h-3.5 text-muted-foreground" />
        </button>
      </div>

      <div className="p-4 space-y-4 max-h-[400px] overflow-y-auto">
        {/* Font Family */}
        <div>
          <label className="text-xs font-medium text-muted-foreground block mb-1.5">Font</label>
          <FontPicker
            value={fontFamily}
            onChange={(family) => onChange({ fontFamily: family || undefined })}
          />
        </div>

        {/* Font Size + Weight row */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1.5">Size</label>
            <div className="relative">
              <input
                type="number"
                value={fontSize || ''}
                onChange={(e) => onChange({ fontSize: e.target.value ? Number(e.target.value) : undefined })}
                placeholder="Auto"
                min={8}
                max={200}
                className="w-full px-2.5 py-1.5 pr-7 text-sm bg-muted border border-border rounded-lg outline-none focus:ring-2 focus:ring-primary"
              />
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setShowSizePresets(!showSizePresets)
                }}
                className="absolute right-1.5 top-1/2 -translate-y-1/2"
              >
                <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
              {showSizePresets && (
                <div className="absolute top-full left-0 mt-1 w-full bg-background border border-border rounded-lg shadow-xl z-10 max-h-40 overflow-y-auto">
                  {PRESET_SIZES.map((size) => (
                    <button
                      key={size}
                      onClick={(e) => {
                        e.stopPropagation()
                        onChange({ fontSize: size })
                        setShowSizePresets(false)
                      }}
                      className={`w-full text-left px-2.5 py-1 text-sm hover:bg-muted transition ${
                        fontSize === size ? 'bg-primary/10 text-primary font-medium' : ''
                      }`}
                    >
                      {size}px
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1.5">Weight</label>
            <select
              value={fontWeight || 400}
              onChange={(e) => {
                const val = Number(e.target.value)
                onChange({ fontWeight: val === 400 ? undefined : val })
              }}
              className="w-full px-2.5 py-1.5 text-sm bg-muted border border-border rounded-lg outline-none focus:ring-2 focus:ring-primary"
            >
              {FONT_WEIGHTS.map((w) => (
                <option key={w.value} value={w.value}>{w.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Italic + Text Transform */}
        <div>
          <label className="text-xs font-medium text-muted-foreground block mb-1.5">Style</label>
          <div className="flex gap-1">
            <button
              onClick={() => onChange({ fontStyle: fontStyle === 'italic' ? 'normal' : 'italic' })}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition ${
                fontStyle === 'italic'
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-muted border-border hover:border-muted-foreground/50'
              }`}
            >
              <Italic className="w-3.5 h-3.5" />
            </button>
            <div className="w-px bg-border mx-1" />
            {TRANSFORMS.map((t) => (
              <button
                key={t.value}
                onClick={() => onChange({ textTransform: textTransform === t.value ? 'none' : t.value })}
                className={`px-2.5 py-1.5 text-xs font-medium rounded-lg border transition ${
                  (textTransform || 'none') === t.value && t.value !== 'none'
                    ? 'bg-primary text-primary-foreground border-primary'
                    : t.value === 'none' && (!textTransform || textTransform === 'none')
                    ? 'bg-muted border-border text-muted-foreground'
                    : 'bg-muted border-border hover:border-muted-foreground/50'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Text Alignment */}
        <div>
          <label className="text-xs font-medium text-muted-foreground block mb-1.5">Alignment</label>
          <div className="flex gap-1">
            {ALIGNMENTS.map((a) => (
              <button
                key={a.value}
                onClick={() => onChange({ textAlign: textAlign === a.value ? undefined : a.value })}
                className={`flex-1 flex items-center justify-center py-1.5 rounded-lg border transition ${
                  textAlign === a.value
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-muted border-border hover:border-muted-foreground/50'
                }`}
              >
                <a.icon className="w-3.5 h-3.5" />
              </button>
            ))}
          </div>
        </div>

        {/* Text Color */}
        <div>
          <label className="text-xs font-medium text-muted-foreground block mb-1.5">Color</label>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {/* Reset to default */}
            <button
              onClick={() => {
                onChange({ textColor: undefined })
                setCustomColor('')
              }}
              className={`w-7 h-7 rounded-lg border-2 transition flex items-center justify-center text-[10px] font-medium ${
                !textColor
                  ? 'border-primary scale-110 shadow-sm'
                  : 'border-border hover:scale-105'
              }`}
              title="Default"
            >
              Auto
            </button>
            {PRESET_COLORS.map((color) => (
              <button
                key={color}
                onClick={() => {
                  onChange({ textColor: color })
                  setCustomColor(color)
                }}
                className={`w-7 h-7 rounded-lg border-2 transition ${
                  textColor === color
                    ? 'border-primary scale-110 shadow-sm'
                    : 'border-transparent hover:scale-105'
                }`}
                style={{ backgroundColor: color }}
                title={color}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={customColor || '#000000'}
              onChange={(e) => {
                setCustomColor(e.target.value)
                onChange({ textColor: e.target.value })
              }}
              className="w-7 h-7 rounded cursor-pointer border-0 p-0"
            />
            <input
              type="text"
              value={customColor}
              onChange={(e) => {
                setCustomColor(e.target.value)
                if (/^#[0-9a-fA-F]{6}$/.test(e.target.value)) {
                  onChange({ textColor: e.target.value })
                }
              }}
              placeholder="#000000"
              className="flex-1 px-2.5 py-1 text-xs bg-muted border border-border rounded-lg outline-none focus:ring-2 focus:ring-primary font-mono"
            />
          </div>
        </div>

        {/* Letter Spacing */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-medium text-muted-foreground">Letter Spacing</label>
            <span className="text-[10px] text-muted-foreground font-mono">
              {letterSpacing != null ? `${letterSpacing}em` : 'auto'}
            </span>
          </div>
          <input
            type="range"
            min={-0.05}
            max={0.3}
            step={0.01}
            value={letterSpacing ?? 0}
            onChange={(e) => {
              const val = parseFloat(e.target.value)
              onChange({ letterSpacing: val === 0 ? undefined : val })
            }}
            className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
          />
        </div>

        {/* Line Height */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-medium text-muted-foreground">Line Height</label>
            <span className="text-[10px] text-muted-foreground font-mono">
              {lineHeight != null ? lineHeight.toFixed(1) : 'auto'}
            </span>
          </div>
          <input
            type="range"
            min={0.8}
            max={3}
            step={0.1}
            value={lineHeight ?? 1.5}
            onChange={(e) => {
              const val = parseFloat(e.target.value)
              onChange({ lineHeight: val === 1.5 ? undefined : val })
            }}
            className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
          />
        </div>
      </div>
    </div>
  )
}
