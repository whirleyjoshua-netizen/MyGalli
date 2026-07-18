'use client'

import type { CanvasElement } from '@/lib/types/canvas'

type Props = {
  element: CanvasElement
  onChange: (updates: Partial<CanvasElement>) => void
  onDelete: () => void
  isSelected: boolean
  onSelect: () => void
}

const field = 'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none'
const label = 'block text-xs font-semibold text-muted-foreground mb-1'

export function WaitlistElement({ element, onChange, onSelect, isSelected }: Props) {
  const style = element.waitlistStyle ?? 'hero'
  return (
    <div
      onClick={onSelect}
      className={`rounded-2xl border bg-surface p-4 space-y-3 ${isSelected ? 'border-primary' : 'border-border'}`}
    >
      <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Wait List</p>

      <div>
        <label className={label} htmlFor="wl-title">Title</label>
        <input id="wl-title" className={field} value={element.waitlistTitle ?? ''} onChange={(e) => onChange({ waitlistTitle: e.target.value })} />
      </div>

      <div>
        <label className={label} htmlFor="wl-desc">Description</label>
        <textarea id="wl-desc" className={field} rows={2} value={element.waitlistDescription ?? ''} onChange={(e) => onChange({ waitlistDescription: e.target.value })} />
      </div>

      <div>
        <span className={label}>Style</span>
        <div className="flex gap-2">
          {(['hero', 'progress'] as const).map((s) => (
            <button
              key={s} type="button" onClick={() => onChange({ waitlistStyle: s })}
              className={`rounded-lg px-3 py-1.5 text-sm capitalize ${style === s ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={label} htmlFor="wl-btn">Button label</label>
          <input id="wl-btn" className={field} value={element.waitlistButtonLabel ?? ''} onChange={(e) => onChange({ waitlistButtonLabel: e.target.value })} />
        </div>
        <div>
          <label className={label} htmlFor="wl-cap">Capacity (optional)</label>
          <input
            id="wl-cap" type="number" min={0} className={field}
            value={element.waitlistCapacity ?? ''}
            onChange={(e) => onChange({ waitlistCapacity: e.target.value === '' ? null : Number(e.target.value) })}
          />
        </div>
      </div>

      <div>
        <label className={label} htmlFor="wl-date">Launch date (optional)</label>
        <input
          id="wl-date" type="datetime-local" className={field}
          value={element.waitlistLaunchDate ? element.waitlistLaunchDate.slice(0, 16) : ''}
          onChange={(e) => onChange({ waitlistLaunchDate: e.target.value ? new Date(e.target.value).toISOString() : null })}
        />
      </div>

      <div className="flex flex-wrap gap-4 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={element.waitlistCollectName ?? false} onChange={(e) => onChange({ waitlistCollectName: e.target.checked })} />
          Collect name
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={element.waitlistShowCount ?? true} onChange={(e) => onChange({ waitlistShowCount: e.target.checked })} />
          Show count
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={element.waitlistShowCountdown ?? true} onChange={(e) => onChange({ waitlistShowCountdown: e.target.checked })} />
          Show countdown
        </label>
      </div>

      <div>
        <label className={label} htmlFor="wl-confirm">Confirmation message</label>
        <input id="wl-confirm" className={field} value={element.waitlistConfirmationMessage ?? ''} onChange={(e) => onChange({ waitlistConfirmationMessage: e.target.value })} />
      </div>
    </div>
  )
}
