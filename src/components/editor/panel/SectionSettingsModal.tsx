'use client'

import { X, Square, Columns2, Columns } from 'lucide-react'
import type { LayoutMode, ColumnSettings } from '@/lib/types/canvas'
import { ColumnStyleSettingsBody } from '@/components/canvas/ColumnStyleSettings'

interface SectionSettingsModalProps {
  isOpen: boolean
  onClose: () => void
  layout: LayoutMode
  onChangeLayout: (layout: LayoutMode) => void
  columnSettings: ColumnSettings
  onChangeColumnSettings: (settings: ColumnSettings) => void
}

const LAYOUTS: { mode: LayoutMode; label: string; Icon: typeof Square }[] = [
  { mode: 'full-width', label: 'Full width', Icon: Square },
  { mode: 'two-column', label: 'Two columns', Icon: Columns2 },
  { mode: 'three-column', label: 'Three columns', Icon: Columns },
]

export function SectionSettingsModal({
  isOpen, onClose, layout, onChangeLayout, columnSettings, onChangeColumnSettings,
}: SectionSettingsModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="bg-background border border-border rounded-xl shadow-lg w-full max-w-md max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="text-sm font-semibold">Section settings</h2>
          <button onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-5">
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-2">Layout</div>
            <div className="grid grid-cols-3 gap-2">
              {LAYOUTS.map(({ mode, label, Icon }) => (
                <button
                  key={mode}
                  onClick={() => onChangeLayout(mode)}
                  aria-pressed={layout === mode}
                  className={`flex flex-col items-center gap-1.5 py-3 rounded-lg border text-xs transition ${
                    layout === mode
                      ? 'border-primary bg-primary/5 text-primary font-medium'
                      : 'border-border text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-2">Column style</div>
            <ColumnStyleSettingsBody settings={columnSettings} onChange={onChangeColumnSettings} />
          </div>
        </div>

        <div className="flex justify-end px-4 py-3 border-t border-border">
          <button onClick={onClose} className="px-4 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition">
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
