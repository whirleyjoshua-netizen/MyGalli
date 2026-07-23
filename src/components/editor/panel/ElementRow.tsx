'use client'

import { useRef, useEffect, useState } from 'react'
import { ChevronDown, Trash2, Clock } from 'lucide-react'
import type { CanvasElement } from '@/lib/types/canvas'
import type { ElementListRow } from '@/lib/editor/element-list'
import { elementRowLabel } from '@/lib/editor/element-list'
import { getInspector } from './inspectors/registry'
import { ElementStamp } from '@/components/elements/ElementStamp'

interface ElementRowProps {
  row: ElementListRow
  expanded: boolean
  displayId: string
  onToggle: () => void
  onChange: (updates: Partial<CanvasElement>) => void
  onDelete: () => void
  isPro: boolean
}

export function ElementRow({ row, expanded, displayId, onToggle, onChange, onDelete, isPro }: ElementRowProps) {
  const ref = useRef<HTMLDivElement>(null)
  const Inspector = getInspector(row.element.type)
  const [busy, setBusy] = useState(false)
  const el = row.element
  const stampUrl = `/api/displays/${displayId}/elements/${el.id}/stamp`

  // The instant is never invented here — we send only the viewer's zone as a
  // display hint and apply whatever the server wrote back.
  async function stamp() {
    setBusy(true)
    try {
      const res = await fetch(stampUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tz: Intl.DateTimeFormat().resolvedOptions().timeZone }),
      })
      if (res.ok) onChange(await res.json())
    } catch {
      // Leave the element unstamped; the button re-enables for a retry.
    } finally {
      setBusy(false)
    }
  }

  async function removeStamp() {
    setBusy(true)
    try {
      const res = await fetch(stampUrl, { method: 'DELETE' })
      if (res.ok) onChange({ stampedAt: undefined, stampedTz: undefined })
    } catch {
      // Leave the stamp in place; the button re-enables for a retry.
    } finally {
      setBusy(false)
    }
  }

  // Auto-scroll the opened row to the top of the scrolling panel body.
  useEffect(() => {
    if (expanded) ref.current?.scrollIntoView({ block: 'nearest' })
  }, [expanded])

  return (
    <div ref={ref} className={`rounded-lg border ${expanded ? 'border-primary/40 bg-muted/40' : 'border-transparent'}`}>
      <div className="flex items-center">
        <button
          onClick={onToggle}
          className="flex-1 flex items-center gap-2 px-2.5 py-2 text-sm text-left rounded-lg hover:bg-muted transition min-w-0"
        >
          <ChevronDown className={`w-3.5 h-3.5 flex-shrink-0 transition-transform ${expanded ? '' : '-rotate-90'} text-muted-foreground`} />
          <span className="truncate">{elementRowLabel(row.element)}</span>
        </button>
        <button onClick={onDelete} aria-label="Delete element" className="p-2 text-muted-foreground hover:text-destructive transition">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
      {expanded && (
        <div className="pb-2">
          <Inspector element={row.element} onChange={onChange} isPro={isPro} />

          {/* Applies to every element type, so it lives here rather than in any
              inspector — most types fall back to DefaultInspector and would
              otherwise never get it. */}
          <div className="mt-2 border-t border-border px-3 pt-3">
            {el.stampedAt ? (
              <div className="flex items-center justify-between gap-2">
                <ElementStamp stampedAt={el.stampedAt} stampedTz={el.stampedTz} />
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={stamp}
                    disabled={busy}
                    className="text-xs font-medium text-primary hover:underline disabled:opacity-50"
                  >
                    Re-stamp
                  </button>
                  <button
                    type="button"
                    onClick={removeStamp}
                    disabled={busy}
                    aria-label="Remove stamp"
                    className="text-xs text-muted-foreground hover:text-destructive disabled:opacity-50"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={stamp}
                disabled={busy}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-50"
              >
                <Clock className="h-3.5 w-3.5" /> Stamp
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
