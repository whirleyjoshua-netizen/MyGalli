'use client'

import { Quote } from 'lucide-react'
import type { CanvasElement } from '@/lib/types/canvas'

interface Props {
  element: CanvasElement
}

export function PublicQuoteWallElement({ element }: Props) {
  const quotes = element.quoteWallQuotes ?? []

  if (quotes.length === 0) return null

  return (
    <div className="space-y-3">
      {element.quoteWallTitle && (
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Quote className="w-4 h-4 text-[#FF6B6B]" />
          {element.quoteWallTitle}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {quotes.map((q, index) => (
          <div
            key={index}
            className="relative rounded-xl border border-border bg-muted/20 p-5 hover:shadow-sm transition-shadow"
          >
            <Quote className="w-5 h-5 text-[#FF6B6B]/30 absolute top-3 left-3" />
            <p className="text-sm leading-relaxed italic pl-6 text-foreground">{q.text}</p>
            <div className="mt-3 pl-6 flex items-center gap-2">
              {q.author && (
                <span className="text-xs font-medium text-foreground">— {q.author}</span>
              )}
              {q.source && (
                <span className="text-xs text-muted-foreground">{q.source}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
