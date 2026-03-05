'use client'

import { Trophy, FileText, Heart, Sparkles, Library } from 'lucide-react'
import { KIT_REGISTRY } from '@/lib/kits/registry'
import '@/lib/kits/athlete-kit'
import '@/lib/kits/resume-kit'
import '@/lib/kits/wedding-kit'
import '@/lib/kits/creator-kit'
import '@/lib/kits/academic-kit'

interface KitBannerProps {
  kitId: string
}

const ICON_MAP: Record<string, typeof Trophy> = {
  Trophy,
  FileText,
  Heart,
  Sparkles,
  Library,
}

export function KitBanner({ kitId }: KitBannerProps) {
  const kit = KIT_REGISTRY[kitId]
  if (!kit) return null

  const Icon = ICON_MAP[kit.icon] || Trophy

  return (
    <div
      className="flex items-center justify-center gap-2 px-4 py-1.5 text-xs font-semibold"
      style={{
        backgroundColor: `${kit.color}15`,
        color: kit.color,
        borderBottom: `1px solid ${kit.color}30`,
      }}
    >
      <Icon className="w-3.5 h-3.5" />
      <span>{kit.name}</span>
    </div>
  )
}
