'use client'

import { useState } from 'react'
import { Hash, Copy, Check } from 'lucide-react'
import type { CanvasElement } from '@/lib/types/canvas'

interface Props {
  element: CanvasElement
}

export function PublicWeddingHashtagsElement({ element }: Props) {
  const hashtags = element.weddingHashtags ?? []
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)

  if (hashtags.length === 0) return null

  const handleCopy = async (tag: string, index: number) => {
    try {
      await navigator.clipboard.writeText(tag)
      setCopiedIndex(index)
      setTimeout(() => setCopiedIndex(null), 1500)
    } catch {
      // Clipboard API not available
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Hash className="w-4 h-4 text-[#E8B4B8]" />
        Wedding Hashtags
      </div>

      <div className="flex flex-wrap gap-2">
        {hashtags.map((tag, index) => (
          <button
            key={index}
            onClick={() => handleCopy(tag, index)}
            className="group/pill inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 cursor-pointer hover:shadow-md"
            style={{
              backgroundColor: '#E8B4B8',
              color: '#4a2028',
            }}
            title="Click to copy"
          >
            <span>{tag}</span>
            {copiedIndex === index ? (
              <Check className="w-3.5 h-3.5 shrink-0" />
            ) : (
              <Copy className="w-3.5 h-3.5 shrink-0 opacity-0 group-hover/pill:opacity-100 transition-opacity" />
            )}
            {copiedIndex === index && (
              <span className="text-xs font-normal opacity-80">Copied!</span>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}
