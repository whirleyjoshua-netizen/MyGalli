'use client'

import { Users, ExternalLink } from 'lucide-react'
import type { CanvasElement } from '@/lib/types/canvas'

const PLATFORM_COLORS: Record<string, string> = {
  instagram: '#E4405F',
  tiktok: '#000000',
  youtube: '#FF0000',
  twitter: '#1DA1F2',
  twitch: '#9146FF',
  linkedin: '#0A66C2',
  pinterest: '#BD081C',
  snapchat: '#FFFC00',
}

const PLATFORM_LABELS: Record<string, string> = {
  instagram: 'Instagram',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  twitter: 'X / Twitter',
  twitch: 'Twitch',
  linkedin: 'LinkedIn',
  pinterest: 'Pinterest',
  snapchat: 'Snapchat',
}

interface Props {
  element: CanvasElement
}

export function PublicSocialStatsElement({ element }: Props) {
  const platforms = element.socialStatsPlatforms ?? []

  if (platforms.length === 0) return null

  return (
    <div className="space-y-3">
      {element.socialStatsTitle && (
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Users className="w-4 h-4 text-[#E040FB]" />
          {element.socialStatsTitle}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {platforms.map((p, i) => {
          const color = PLATFORM_COLORS[p.platform] || '#6B7280'
          const label = PLATFORM_LABELS[p.platform] || p.platform
          const card = (
            <div
              key={i}
              className="relative rounded-xl border border-border bg-white overflow-hidden hover:shadow-md transition-shadow group/card"
            >
              <div className="absolute top-0 left-0 right-0 h-1" style={{ backgroundColor: color }} />
              <div className="p-4 text-center">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                  {label}
                </div>
                <div className="text-2xl font-bold" style={{ color }}>
                  {p.followers}
                </div>
                <div className="text-xs text-muted-foreground mt-1">{p.handle}</div>
                {p.url && (
                  <ExternalLink className="w-3 h-3 text-muted-foreground mt-2 mx-auto opacity-0 group-hover/card:opacity-100 transition-opacity" />
                )}
              </div>
            </div>
          )

          if (p.url) {
            return (
              <a key={i} href={p.url} target="_blank" rel="noopener noreferrer" className="block">
                {card}
              </a>
            )
          }
          return card
        })}
      </div>
    </div>
  )
}
