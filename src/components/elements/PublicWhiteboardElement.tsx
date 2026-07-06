import type { CanvasElement } from '@/lib/types/canvas'

// Public render is a plain image of the owner's board — no fabric ships here.
export function PublicWhiteboardElement({ element }: { element: CanvasElement }) {
  const src = element.whiteboardPreviewUrl
  if (!src) return null
  const w = element.whiteboardWidth || 800
  const h = element.whiteboardHeight || 450
  return (
    <div className="w-full overflow-hidden rounded-lg border border-border/50">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt="Whiteboard"
        width={w}
        height={h}
        className="block w-full h-auto"
        style={{ aspectRatio: `${w} / ${h}` }}
      />
    </div>
  )
}
