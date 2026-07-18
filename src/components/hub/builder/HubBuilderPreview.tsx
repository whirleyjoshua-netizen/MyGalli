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

export function HubBuilderPreview({ hub, config }: { hub: PreviewHub; config: HubConfig }) {
  const [mobile, setMobile] = useState(false)
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Live preview</span>
        <div className="flex gap-1">
          <button onClick={() => setMobile(false)} className={`rounded p-1 ${!mobile ? 'bg-galli/10 text-primary' : 'text-muted-foreground'}`}><Monitor className="h-4 w-4" /></button>
          <button onClick={() => setMobile(true)} className={`rounded p-1 ${mobile ? 'bg-galli/10 text-primary' : 'text-muted-foreground'}`}><Smartphone className="h-4 w-4" /></button>
        </div>
      </div>
      <div className={`mx-auto overflow-hidden rounded-2xl border border-border bg-background ${mobile ? 'max-w-[390px]' : 'w-full'}`}>
        <div className="pointer-events-none origin-top scale-[0.85]">
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
      <p className="mt-2 text-center text-[11px] text-muted-foreground">Preview uses sample data.</p>
    </div>
  )
}
