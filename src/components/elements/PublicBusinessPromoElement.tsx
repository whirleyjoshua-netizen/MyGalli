'use client'

import { Sparkles } from 'lucide-react'
import type { CanvasElement } from '@/lib/types/canvas'

interface Props {
  element: CanvasElement
}

export function PublicBusinessPromoElement({ element }: Props) {
  const items = element.bizPromoItems ?? []

  if (items.length === 0) return null

  const now = new Date()

  return (
    <div className="space-y-4">
      {element.bizPromoTitle && (
        <div className="flex items-center gap-2 text-lg font-bold text-foreground">
          <Sparkles className="w-5 h-5 text-amber-500" />
          {element.bizPromoTitle}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {items.map((item, index) => {
          const isExpired = item.endDate && new Date(item.endDate) < now
          if (isExpired) return null

          return (
            <div
              key={index}
              className="relative border border-border rounded-xl overflow-hidden hover:shadow-lg transition-shadow bg-background"
            >
              {item.image && (
                <img src={item.image} alt={item.title} className="w-full h-40 object-cover" />
              )}

              {item.badge && (
                <div className="absolute top-3 right-3 bg-amber-500 text-white text-[10px] font-bold px-2.5 py-1 rounded-full shadow-sm uppercase tracking-wider">
                  {item.badge}
                </div>
              )}

              <div className="p-4 space-y-2">
                <h3 className="font-semibold text-foreground">{item.title}</h3>
                {item.description && (
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                )}

                {(item.startDate || item.endDate) && (
                  <p className="text-[10px] text-muted-foreground">
                    {item.startDate && `From ${item.startDate}`}
                    {item.startDate && item.endDate && ' · '}
                    {item.endDate && `Until ${item.endDate}`}
                  </p>
                )}

                {item.ctaText && item.ctaUrl && (
                  <a
                    href={item.ctaUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block mt-1 px-4 py-1.5 bg-amber-500 text-white text-sm font-medium rounded-full hover:bg-amber-600 transition"
                  >
                    {item.ctaText}
                  </a>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
