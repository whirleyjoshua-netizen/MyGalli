'use client'

import { Music, ExternalLink } from 'lucide-react'
import type { CanvasElement } from '@/lib/types/canvas'

interface Props {
  element: CanvasElement
}

export function PublicPlaylistElement({ element }: Props) {
  const items = element.playlistItems ?? []

  if (items.length === 0) return null

  return (
    <div className="space-y-3">
      {element.playlistTitle && (
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Music className="w-4 h-4 text-[#FF6B6B]" />
          {element.playlistTitle}
        </div>
      )}

      <div className="space-y-1">
        {items.map((item, index) => (
          <div
            key={index}
            className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 transition group/track"
          >
            <div className="flex items-center justify-center w-8 text-xs text-muted-foreground font-mono">
              {index + 1}
            </div>
            {item.coverUrl ? (
              <img
                src={item.coverUrl}
                alt={item.title}
                className="w-10 h-10 rounded-lg object-cover shadow-sm"
              />
            ) : (
              <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                <Music className="w-4 h-4 text-muted-foreground/50" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-foreground truncate">{item.title || 'Untitled'}</div>
              {item.artist && (
                <div className="text-xs text-muted-foreground truncate">{item.artist}</div>
              )}
            </div>
            {item.link && (
              <a
                href={item.link}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 text-muted-foreground hover:text-[#FF6B6B] opacity-0 group-hover/track:opacity-100 transition"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
