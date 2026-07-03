'use client'

import type { CanvasElement } from '@/lib/types/canvas'

interface InspectorProps {
  element: CanvasElement
  onChange: (updates: Partial<CanvasElement>) => void
  isPro: boolean
}

export function DefaultInspector({ element }: InspectorProps) {
  return (
    <div className="px-3 py-3 text-sm text-muted-foreground">
      <p>Detailed settings for this element are on the block itself — click it on the canvas to edit inline.</p>
      <p className="mt-2 text-xs opacity-70">Type: {element.type}</p>
    </div>
  )
}

export type { InspectorProps }
