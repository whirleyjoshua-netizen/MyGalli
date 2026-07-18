'use client'

import { useState } from 'react'
import { Monitor, Smartphone } from 'lucide-react'
import { CommunityHubView } from '@/components/hub/community/CommunityHubView'
import type { HubConfig } from '@/lib/types/hub-config'

type PreviewHub = {
  id: string; title: string; tagline: string | null; description: string | null
  coverImage: string | null; heroVideoUrl: string | null; slug: string
  published: boolean; community: boolean; version: number; username: string
}

// Render the real page at a FIXED logical width so its layout is always clean
// (no mid-breakpoint squish/overlap in the header stat tiles), then uniformly
// scale it down to fit the side panel. Desktop uses a >=lg width so the true
// 2-column layout shows; mobile renders near 1:1. The frame clips to a fixed
// viewport height.
const DESKTOP_W = 1120
const MOBILE_W = 390
const PANEL_W = 388 // the builder's preview aside is w-[420px] minus its p-4
const FRAME_H = 540

export function HubBuilderPreview({ hub, config }: { hub: PreviewHub; config: HubConfig }) {
  const [mobile, setMobile] = useState(false)
  const logicalW = mobile ? MOBILE_W : DESKTOP_W
  const scale = Math.min(1, PANEL_W / logicalW)

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Live preview</span>
        <div className="flex gap-1">
          <button
            onClick={() => setMobile(false)}
            aria-label="Desktop preview"
            className={`rounded p-1 ${!mobile ? 'bg-galli/10 text-primary' : 'text-muted-foreground'}`}
          >
            <Monitor className="h-4 w-4" />
          </button>
          <button
            onClick={() => setMobile(true)}
            aria-label="Mobile preview"
            className={`rounded p-1 ${mobile ? 'bg-galli/10 text-primary' : 'text-muted-foreground'}`}
          >
            <Smartphone className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div
        className="mx-auto overflow-hidden rounded-2xl border border-border bg-background shadow-soft"
        style={{ width: PANEL_W, height: FRAME_H }}
      >
        <div className="pointer-events-none origin-top-left" style={{ width: logicalW, transform: `scale(${scale})` }}>
          <CommunityHubView
            hub={hub}
            config={config}
            ownerUsername={hub.username}
            isPrivileged
            joined
            memberCount={0}
            members={[]}
            resources={[]}
            counts={{ posts: 0, members: 0, resources: 0, events: 0 }}
            sharePath={`/${hub.username}/hub/${hub.slug}`}
            preview
          />
        </div>
      </div>

      <p className="mt-2 text-center text-[11px] text-muted-foreground">Sample data &middot; {mobile ? 'mobile' : 'desktop'} view</p>
    </div>
  )
}
