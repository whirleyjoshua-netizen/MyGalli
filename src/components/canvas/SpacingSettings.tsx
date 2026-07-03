'use client'

import { X, AlignVerticalSpaceAround } from 'lucide-react'
import type {
  SpacingConfig,
  ContentWidth,
  SpacingScale,
  PagePadding,
} from '@/lib/types/spacing'
import { DEFAULT_SPACING_CONFIG, getSpacingStyles } from '@/lib/types/spacing'

interface SpacingSettingsProps {
  isOpen: boolean
  onClose: () => void
  config: SpacingConfig
  onChange: (config: SpacingConfig) => void
}

const WIDTH_OPTIONS: { value: ContentWidth; label: string }[] = [
  { value: 'narrow', label: 'Narrow' },
  { value: 'normal', label: 'Normal' },
  { value: 'wide', label: 'Wide' },
  { value: 'full', label: 'Full' },
]

const SCALE_OPTIONS: { value: SpacingScale; label: string }[] = [
  { value: 'compact', label: 'Compact' },
  { value: 'normal', label: 'Normal' },
  { value: 'relaxed', label: 'Relaxed' },
]

const PADDING_OPTIONS: { value: PagePadding; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'small', label: 'Small' },
  { value: 'normal', label: 'Normal' },
  { value: 'large', label: 'Large' },
]

function SegmentedControl<T extends string>({
  label,
  help,
  value,
  options,
  onSelect,
}: {
  label: string
  help?: string
  value: T
  options: { value: T; label: string }[]
  onSelect: (v: T) => void
}) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1">{label}</label>
      {help && <p className="text-xs text-muted-foreground mb-2">{help}</p>}
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onSelect(opt.value)}
            className={`px-3 py-2 rounded-lg border text-sm transition-all ${
              value === opt.value
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background border-border hover:border-primary/50'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export function SpacingSettingsBody({
  config,
  onChange,
}: {
  config: SpacingConfig
  onChange: (config: SpacingConfig) => void
}) {
  const cfg = { ...DEFAULT_SPACING_CONFIG, ...config }
  const s = getSpacingStyles(cfg)

  return (
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          <SegmentedControl
            label="Content width"
            help="Side margins around your page content."
            value={cfg.contentWidth}
            options={WIDTH_OPTIONS}
            onSelect={(v) => onChange({ ...cfg, contentWidth: v })}
          />

          <SegmentedControl
            label="Section spacing"
            help="Gap between stacked sections and columns."
            value={cfg.sectionSpacing}
            options={SCALE_OPTIONS}
            onSelect={(v) => onChange({ ...cfg, sectionSpacing: v })}
          />

          <SegmentedControl
            label="Element spacing"
            help="Gap between elements within a column."
            value={cfg.elementSpacing}
            options={SCALE_OPTIONS}
            onSelect={(v) => onChange({ ...cfg, elementSpacing: v })}
          />

          <SegmentedControl
            label="Page padding"
            help="Outer breathing room around the whole page."
            value={cfg.pagePadding}
            options={PADDING_OPTIONS}
            onSelect={(v) => onChange({ ...cfg, pagePadding: v })}
          />

          {/* Preview */}
          <div>
            <label className="block text-sm font-medium mb-3">Preview</label>
            <div className="rounded-lg bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-border overflow-hidden">
              <div
                style={{
                  paddingTop: `${Math.min(s.paddingY, 32)}px`,
                  paddingBottom: `${Math.min(s.paddingY, 32)}px`,
                  paddingLeft: `${s.paddingX}px`,
                  paddingRight: `${s.paddingX}px`,
                }}
              >
                <div
                  style={{
                    maxWidth: s.maxWidth ? `${Math.min(s.maxWidth / 3, 320)}px` : '100%',
                    marginLeft: 'auto',
                    marginRight: 'auto',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: `${s.sectionGap}px`,
                  }}
                >
                  {[0, 1].map((sec) => (
                    <div
                      key={sec}
                      style={{ display: 'flex', flexDirection: 'column', gap: `${s.elementGap}px` }}
                    >
                      <div className="h-3 rounded bg-primary/40" />
                      <div className="h-3 rounded bg-primary/25 w-3/4" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="pt-2">
            <button
              onClick={() => onChange(DEFAULT_SPACING_CONFIG)}
              className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition"
            >
              Reset to Default
            </button>
          </div>
        </div>
  )
}

export function SpacingSettings({
  isOpen,
  onClose,
  config,
  onChange,
}: SpacingSettingsProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-background rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col border border-border">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <AlignVerticalSpaceAround className="w-5 h-5" />
            Layout &amp; Spacing
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-muted rounded transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <SpacingSettingsBody config={config} onChange={onChange} />

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
