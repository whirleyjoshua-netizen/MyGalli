'use client'
import { useRef, useState } from 'react'
import type { CanvasElement } from '@/lib/types/canvas'

export function PublicBeforeAfterElement({ element }: { element: CanvasElement }) {
  const before = element.beforeAfterBefore
  const after = element.beforeAfterAfter
  const height = element.beforeAfterHeight || 400
  const [pos, setPos] = useState(50)
  const ref = useRef<HTMLDivElement>(null)

  if (!before || !after) {
    return <div className="text-center text-sm text-muted-foreground py-6 border border-dashed border-border rounded-xl" style={{ minHeight: 120 }}>Add both a before and an after image.</div>
  }
  const setFromClientX = (clientX: number) => {
    const rect = ref.current?.getBoundingClientRect()
    if (!rect) return
    setPos(Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100)))
  }
  return (
    <div ref={ref} className="relative w-full overflow-hidden rounded-xl select-none" style={{ height }}
      onPointerMove={(e) => { if (e.buttons === 1) setFromClientX(e.clientX) }}
      onPointerDown={(e) => setFromClientX(e.clientX)}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={before} alt={element.beforeAfterBeforeLabel || 'Before'} className="absolute inset-0 w-full h-full object-cover" draggable={false} />
      <div className="absolute inset-0 overflow-hidden" style={{ width: `${pos}%` }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={after} alt={element.beforeAfterAfterLabel || 'After'} className="absolute inset-0 h-full object-cover" style={{ width: ref.current?.clientWidth || '100%' }} draggable={false} />
      </div>
      <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-black/60 text-white text-xs">{element.beforeAfterAfterLabel || 'After'}</span>
      <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-black/60 text-white text-xs">{element.beforeAfterBeforeLabel || 'Before'}</span>
      <div role="slider" aria-valuenow={Math.round(pos)} aria-valuemin={0} aria-valuemax={100} tabIndex={0}
        className="absolute top-0 bottom-0 w-1 bg-white cursor-ew-resize" style={{ left: `${pos}%`, transform: 'translateX(-50%)' }}
        onKeyDown={(e) => { if (e.key === 'ArrowLeft') setPos((p) => Math.max(0, p - 2)); if (e.key === 'ArrowRight') setPos((p) => Math.min(100, p + 2)) }}
      >
        <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white shadow flex items-center justify-center text-slate-700 text-xs">↔</span>
      </div>
    </div>
  )
}
