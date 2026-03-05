'use client'

import { useState } from 'react'
import { Palette, Copy, Check } from 'lucide-react'
import type { CanvasElement } from '@/lib/types/canvas'

interface Props {
  element: CanvasElement
}

export function PublicColorPaletteElement({ element }: Props) {
  const colors = element.colorPaletteColors ?? []
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)

  if (colors.length === 0) return null

  const handleCopy = async (hex: string, index: number) => {
    try {
      await navigator.clipboard.writeText(hex)
      setCopiedIndex(index)
      setTimeout(() => setCopiedIndex(null), 1500)
    } catch {
      // Clipboard API not available
    }
  }

  return (
    <div className="space-y-3">
      {element.colorPaletteTitle && (
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Palette className="w-4 h-4 text-[#FF6B6B]" />
          {element.colorPaletteTitle}
        </div>
      )}

      <div className="flex flex-wrap gap-4">
        {colors.map((color, index) => (
          <button
            key={index}
            onClick={() => handleCopy(color.hex, index)}
            className="group/swatch flex flex-col items-center gap-2 cursor-pointer"
            title={`Click to copy ${color.hex}`}
          >
            <div
              className="w-16 h-16 rounded-xl shadow-sm group-hover/swatch:shadow-md transition-shadow ring-1 ring-black/5"
              style={{ backgroundColor: color.hex }}
            />
            {color.name && (
              <span className="text-xs font-medium text-foreground">{color.name}</span>
            )}
            <span className="text-[10px] font-mono text-muted-foreground flex items-center gap-1">
              {color.hex}
              {copiedIndex === index ? (
                <Check className="w-3 h-3 text-green-500" />
              ) : (
                <Copy className="w-3 h-3 opacity-0 group-hover/swatch:opacity-100 transition-opacity" />
              )}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
