'use client'

import type { HubConfig } from '@/lib/types/hub-config'

type PreviewHub = {
  id: string; title: string; tagline: string | null; description: string | null
  coverImage: string | null; heroVideoUrl: string | null; slug: string
  published: boolean; community: boolean; version: number; username: string
}

export function HubBuilderPreview({ hub, config }: { hub: PreviewHub; config: HubConfig }) {
  return <div className="text-sm text-muted-foreground">Coming in the next step</div>
}
