'use client'

import { Briefcase, ExternalLink } from 'lucide-react'
import type { CanvasElement } from '@/lib/types/canvas'

interface Props {
  element: CanvasElement
}

export function PublicCollabCardElement({ element }: Props) {
  const items = element.collabItems ?? []

  if (items.length === 0) return null

  return (
    <div className="space-y-3">
      {element.collabTitle && (
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Briefcase className="w-4 h-4 text-[#E040FB]" />
          {element.collabTitle}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {items.map((item, i) => (
          <div
            key={i}
            className="rounded-xl border border-border bg-white overflow-hidden hover:shadow-md transition-shadow"
          >
            {item.image && (
              <div className="h-32 overflow-hidden">
                <img src={item.image} alt={item.brand} className="w-full h-full object-cover" />
              </div>
            )}
            <div className="p-4">
              <h4 className="font-semibold text-sm">{item.brand}</h4>
              <p className="text-xs text-[#E040FB] font-medium mt-0.5">{item.role}</p>
              {item.dateRange && (
                <p className="text-xs text-muted-foreground mt-1">{item.dateRange}</p>
              )}
              {item.description && (
                <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{item.description}</p>
              )}
              {item.link && (
                <a
                  href={item.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-[#E040FB] font-medium mt-3 hover:underline"
                >
                  View <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
