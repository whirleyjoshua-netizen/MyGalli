'use client'

import { Trash2, Plus, X, Users } from 'lucide-react'
import type { CanvasElement } from '@/lib/types/canvas'

const PLATFORMS = ['instagram', 'tiktok', 'youtube', 'twitter', 'twitch', 'linkedin', 'pinterest', 'snapchat']

interface Props {
  element: CanvasElement
  onChange: (updates: Partial<CanvasElement>) => void
  onDelete: () => void
  isSelected: boolean
  onSelect: () => void
}

export function SocialStatsElement({ element, onChange, onDelete, isSelected, onSelect }: Props) {
  const platforms = element.socialStatsPlatforms ?? []

  const update = (index: number, field: string, value: string) => {
    const updated = [...platforms]
    updated[index] = { ...updated[index], [field]: value }
    onChange({ socialStatsPlatforms: updated })
  }

  const add = () => {
    onChange({ socialStatsPlatforms: [...platforms, { platform: 'instagram', handle: '', followers: '0', url: '' }] })
  }

  const remove = (index: number) => {
    onChange({ socialStatsPlatforms: platforms.filter((_, i) => i !== index) })
  }

  return (
    <div
      className={`relative group rounded-xl border bg-background transition-all ${
        isSelected ? 'ring-2 ring-[#E040FB] border-[#E040FB]/30' : 'border-border hover:border-[#E040FB]/30'
      }`}
      onClick={(e) => { e.stopPropagation(); onSelect() }}
    >
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-[#E040FB]" />
          <input
            type="text"
            value={element.socialStatsTitle ?? 'Social Media'}
            onChange={(e) => onChange({ socialStatsTitle: e.target.value })}
            onClick={(e) => e.stopPropagation()}
            className="text-sm font-semibold bg-transparent border-none outline-none"
          />
        </div>

        <div className="space-y-2">
          {platforms.map((p, i) => (
            <div key={i} className="flex items-center gap-2 bg-muted/50 rounded-lg p-2">
              <select
                value={p.platform}
                onChange={(e) => update(i, 'platform', e.target.value)}
                onClick={(e) => e.stopPropagation()}
                className="text-xs bg-transparent border border-border rounded px-1.5 py-1 outline-none"
              >
                {PLATFORMS.map(pl => (
                  <option key={pl} value={pl}>{pl.charAt(0).toUpperCase() + pl.slice(1)}</option>
                ))}
              </select>
              <input
                type="text"
                value={p.handle}
                onChange={(e) => update(i, 'handle', e.target.value)}
                onClick={(e) => e.stopPropagation()}
                placeholder="@handle"
                className="flex-1 text-xs bg-transparent border-none outline-none"
              />
              <input
                type="text"
                value={p.followers}
                onChange={(e) => update(i, 'followers', e.target.value)}
                onClick={(e) => e.stopPropagation()}
                placeholder="Followers"
                className="w-20 text-xs bg-transparent border-none outline-none text-right font-medium"
              />
              <input
                type="text"
                value={p.url ?? ''}
                onChange={(e) => update(i, 'url', e.target.value)}
                onClick={(e) => e.stopPropagation()}
                placeholder="URL"
                className="w-32 text-xs bg-transparent border-none outline-none text-muted-foreground"
              />
              <button
                onClick={(e) => { e.stopPropagation(); remove(i) }}
                className="p-0.5 text-muted-foreground hover:text-destructive"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>

        <button
          onClick={(e) => { e.stopPropagation(); add() }}
          className="flex items-center gap-1.5 text-sm text-[#E040FB] hover:text-[#c030d8] font-medium transition"
        >
          <Plus className="w-3.5 h-3.5" />
          Add platform
        </button>
      </div>

      {isSelected && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete() }}
          className="absolute -top-3 -right-3 p-1.5 bg-background border border-border rounded-md shadow-sm hover:bg-destructive hover:text-destructive-foreground transition"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  )
}
