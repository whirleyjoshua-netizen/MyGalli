'use client'
import { Instagram, Twitter, Youtube, Github, Linkedin, Facebook, Twitch, Music, Mail, Globe, Link as LinkIcon } from 'lucide-react'
import type { CanvasElement } from '@/lib/types/canvas'
import { safeHref } from '@/lib/editor/safe-href'
import { trackInteraction } from '@/lib/analytics'

const LINK_ICONS: Record<string, typeof Globe> = {
  instagram: Instagram, twitter: Twitter, youtube: Youtube, github: Github,
  linkedin: Linkedin, facebook: Facebook, twitch: Twitch, tiktok: Music,
  spotify: Music, email: Mail, website: Globe,
}
const iconFor = (key?: string) => LINK_ICONS[key || ''] || LinkIcon
export const LINK_ICON_KEYS = Object.keys(LINK_ICONS)

export function PublicLinkHubElement({ element, displayId }: { element: CanvasElement; displayId?: string }) {
  const items = (element.linkHubItems || []).filter((i) => safeHref(i.url))
  return (
    <div className="space-y-3">
      {element.linkHubTitle && (
        <h3 className="text-lg font-bold text-center">{element.linkHubTitle}</h3>
      )}
      <div className="flex flex-col gap-2.5 max-w-md mx-auto w-full">
        {items.map((item, i) => {
          const Icon = iconFor(item.icon)
          return (
            <a
              key={i}
              href={safeHref(item.url)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => { if (displayId) void trackInteraction(displayId, element.id, 'link-hub', 'click') }}
              className="flex items-center gap-3 px-4 py-3 rounded-xl border border-border bg-surface font-medium text-foreground hover:border-primary hover:shadow-soft transition-all"
            >
              <Icon className="w-5 h-5 shrink-0 text-primary" />
              <span className="flex-1 text-center -ml-8">{item.label || item.url}</span>
            </a>
          )
        })}
      </div>
    </div>
  )
}
