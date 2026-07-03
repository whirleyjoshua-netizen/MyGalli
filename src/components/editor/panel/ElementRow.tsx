'use client'

import { useRef, useEffect } from 'react'
import { ChevronDown, Trash2 } from 'lucide-react'
import type { CanvasElement } from '@/lib/types/canvas'
import type { ElementListRow } from '@/lib/editor/element-list'
import { elementRowLabel } from '@/lib/editor/element-list'
import { getInspector } from './inspectors/registry'

interface ElementRowProps {
  row: ElementListRow
  expanded: boolean
  onToggle: () => void
  onChange: (updates: Partial<CanvasElement>) => void
  onDelete: () => void
  isPro: boolean
}

export function ElementRow({ row, expanded, onToggle, onChange, onDelete, isPro }: ElementRowProps) {
  const ref = useRef<HTMLDivElement>(null)
  const Inspector = getInspector(row.element.type)

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
        </div>
      )}
    </div>
  )
}
