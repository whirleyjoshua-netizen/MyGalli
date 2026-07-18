'use client'

import { useState } from 'react'
import { Leaf, Search } from 'lucide-react'
import { CommunityHeader } from './CommunityHeader'
import { CommunityFeed } from './CommunityFeed'
import { CommunitySidebar } from './CommunitySidebar'
import type { HubConfig } from '@/lib/types/hub-config'

type CommunityMember = { userId: string; username: string; name: string | null; avatar: string | null }
type CommunityResource = { id: string; type: string; title: string; url: string | null }

export function CommunityHubView({
  hub, ownerUsername, currentUserId, isPrivileged, joined: initialJoined, memberCount: initialCount, members, resources, counts, sharePath, config,
}: {
  hub: { id: string; title: string; tagline: string | null; description: string | null; coverImage: string | null; heroVideoUrl: string | null }
  ownerUsername: string
  currentUserId?: string
  isPrivileged: boolean
  joined: boolean
  memberCount: number
  members: CommunityMember[]
  resources: CommunityResource[]
  counts: { posts: number; members: number; resources: number; events: number }
  sharePath: string
  config: HubConfig
}) {
  const [joined, setJoined] = useState(initialJoined)
  const [count, setCount] = useState(initialCount)
  const canPost = isPrivileged || joined

  async function toggleJoin() {
    const res = await fetch(`/api/hubs/${hub.id}/join`, { method: joined ? 'DELETE' : 'POST' })
    if (res.status === 401) { window.location.href = '/login'; return }
    if (res.ok) { const d = await res.json(); setJoined(d.joined); setCount(d.memberCount) }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-galli/5 to-transparent">
      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="rounded-3xl border border-border bg-surface p-6 shadow-soft">
          <CommunityHeader
            title={hub.title}
            tagline={hub.tagline}
            ownerUsername={ownerUsername}
            coverImage={hub.coverImage}
            memberAvatars={members}
            counts={{ ...counts, members: count }}
            joined={joined}
            isPrivileged={isPrivileged}
            onToggleJoin={toggleJoin}
            sharePath={sharePath}
          />
          <div className="mt-5 flex items-center gap-3 border-t border-border pt-4">
            <span className="inline-flex items-center gap-1.5 border-b-2 border-primary pb-1 text-sm font-medium"><Leaf className="h-4 w-4 text-primary" /> Home</span>
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input placeholder="Search this hub…" className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm" disabled />
            </div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
          <CommunityFeed hubId={hub.id} canPost={canPost} isPrivileged={isPrivileged} currentUserId={currentUserId} config={config} />
          <CommunitySidebar config={config} heroVideoUrl={hub.heroVideoUrl} members={members} resources={resources} />
        </div>

        <div className="mt-10 rounded-2xl border border-border bg-galli/5 py-6 text-center text-sm text-muted-foreground">
          Good ideas grow in great communities.
        </div>
      </div>
    </div>
  )
}
