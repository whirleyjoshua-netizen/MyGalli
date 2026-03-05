'use client'

import { Grid3X3 } from 'lucide-react'
import type { CanvasElement } from '@/lib/types/canvas'

interface Props {
  element: CanvasElement
}

export function PublicMoodBoardElement({ element }: Props) {
  const items = element.moodBoardItems ?? []
  const columns = element.moodBoardColumns ?? 3

  if (items.length === 0) return null

  const colClass = columns === 2 ? 'columns-2' : columns === 4 ? 'columns-4' : 'columns-3'

  return (
    <div className="space-y-3">
      {element.moodBoardTitle && (
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Grid3X3 className="w-4 h-4 text-[#FF6B6B]" />
          {element.moodBoardTitle}
        </div>
      )}

      <div className={`${colClass} gap-3`}>
        {items.filter(item => item.imageUrl).map((item, index) => (
          <div key={index} className="break-inside-avoid mb-3 rounded-xl overflow-hidden group/card shadow-sm hover:shadow-md transition-shadow">
            <img
              src={item.imageUrl}
              alt={item.caption || ''}
              className="w-full object-cover"
            />
            {item.caption && (
              <div className="px-3 py-2 bg-background/80 backdrop-blur-sm text-xs text-muted-foreground">
                {item.caption}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
