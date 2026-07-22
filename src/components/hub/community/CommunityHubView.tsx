'use client'

import { Suspense, useState } from 'react'
import { Search } from 'lucide-react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { CommunityTabs, tabFromParam, type CommunityTab } from './CommunityTabs'
import { HubFilesTab } from './HubFilesTab'
import type { FileFolder, FileItem } from '@/lib/hub-files-view'
import { CommunityHeader } from './CommunityHeader'
import { CommunityFeed } from './CommunityFeed'
import { CommunitySidebar } from './CommunitySidebar'
import { CommunityKollab } from './CommunityKollab'
import { CommunityUtilityStrip } from './CommunityUtilityStrip'
import { HubEventsModal } from '@/components/hub/builder/HubEventsModal'
import { HubResourcesModal } from '@/components/hub/builder/HubResourcesModal'
import type { HubConfig } from '@/lib/types/hub-config'
import type { EventDTO } from '@/lib/hub-events'
import type { DropDTO } from '@/lib/hub-drops'
import type { StripNote } from '@/lib/hub-notes'
import type { ActivityCounts } from '@/lib/hub-activity'
import type { AnnouncementDTO } from '@/lib/hub-announcements'

type CommunityMember = { userId: string; username: string; name: string | null; avatar: string | null }
type CommunityResource = { id: string; type: string; title: string; url: string | null }

function CommunityHubViewInner({
  hub, ownerUsername, currentUserId, isPrivileged, isOwner, joined: initialJoined, memberCount: initialCount, members, resources, events, drops, pendingCount = 0, notes, counts, activity, sharePath, config, preview, announcements = [], fileFolders = [], fileItems = [],
}: {
  hub: { id: string; title: string; tagline: string | null; description: string | null; coverImage: string | null; heroVideoUrl: string | null }
  ownerUsername: string
  currentUserId?: string
  isPrivileged: boolean
  isOwner?: boolean
  joined: boolean
  memberCount: number
  members: CommunityMember[]
  resources: CommunityResource[]
  events?: EventDTO[]
  drops: DropDTO[]
  /** Pending drops awaiting review. Server sends 0 to anyone who can't moderate. */
  pendingCount?: number
  notes?: StripNote[]
  counts: { posts: number; members: number; resources: number; events: number; kollab: number }
  activity?: ActivityCounts
  sharePath: string
  config: HubConfig
  preview?: boolean
  announcements?: AnnouncementDTO[]
  /** Visibility-filtered by the server — nothing hidden reaches this component. */
  fileFolders?: FileFolder[]
  fileItems?: FileItem[]
}) {
  const router = useRouter()
  const pathname = usePathname()
  const search = useSearchParams()
  const tab: CommunityTab = tabFromParam(search.get('tab'))

  function selectTab(next: CommunityTab) {
    const params = new URLSearchParams(search.toString())
    if (next === 'home') params.delete('tab')
    else params.set('tab', next)
    const qs = params.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }

  const [joined, setJoined] = useState(initialJoined)
  const [count, setCount] = useState(initialCount)
  const [pollNonce, setPollNonce] = useState(0)
  const [manageEvents, setManageEvents] = useState(false)
  const [manageResources, setManageResources] = useState(false)
  const canPost = isPrivileged || joined
  const nextEvent = events && events.length > 0 ? { title: events[0].title, startsAt: events[0].startsAt } : null

  async function toggleJoin() {
    const res = await fetch(`/api/hubs/${hub.id}/join`, { method: joined ? 'DELETE' : 'POST' })
    if (res.status === 401) { window.location.href = '/login'; return }
    if (res.ok) { const d = await res.json(); setJoined(d.joined); setCount(d.memberCount) }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-galli/5 to-transparent">
      <div className="w-full px-4 py-8 sm:px-6 lg:px-8">
        <CommunityUtilityStrip
          hubId={hub.id}
          config={config}
          notes={notes ?? []}
          isOwner={isOwner ?? false}
          isPrivileged={isPrivileged}
          preview={preview}
          activity={activity ?? { newPosts: 0, newDrops: 0, newMembers: 0 }}
          joined={joined}
          memberCount={count}
          tagline={hub.tagline}
          nextEvent={nextEvent}
          onToggleJoin={toggleJoin}
          onOpenPoll={() => setPollNonce((n) => n + 1)}
          onOpenEvents={() => setManageEvents(true)}
          onOpenResources={() => setManageResources(true)}
          onOpenFiles={() => selectTab('files')}
        />
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
            editHref={preview ? undefined : `/hubs/${hub.id}`}
            hubId={hub.id}
            announcements={announcements}
          />
          <div className="mt-5 flex items-center gap-3 border-t border-border pt-4">
            <CommunityTabs active={tab} onSelect={selectTab} />
            {/* The search box belongs to Home; wiring it is out of scope. */}
            {tab === 'home' && (
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input placeholder="Search this hub…" className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm" disabled />
              </div>
            )}
          </div>
        </div>

        {tab === 'files' && (
          <div className="mt-6">
            <HubFilesTab hubId={hub.id} canManage={!!isOwner} initialFolders={fileFolders} initialItems={fileItems} />
          </div>
        )}

        {tab === 'home' && (
        <div className={`mt-6 grid grid-cols-1 gap-6 ${config.kollab.enabled ? 'lg:grid-cols-[260px_1fr_320px]' : 'lg:grid-cols-[1fr_320px]'}`}>
          {config.kollab.enabled && (
            <div id="hub-kollab" className="order-2 lg:order-none">
              <CommunityKollab
                hubId={hub.id}
                hubTitle={hub.title}
                canDrop={config.kollab.whoCanDrop === 'owner-only' ? isPrivileged : (isPrivileged || joined)}
                isPrivileged={isPrivileged}
                currentUserId={currentUserId}
                enabled={config.kollab.enabled}
                pendingCount={pendingCount}
                initialDrops={drops}
                total={counts.kollab}
                narrow
                preview={preview}
              />
            </div>
          )}
          <div id="hub-feed" className="order-1 lg:order-none">
            <CommunityFeed hubId={hub.id} canPost={canPost} isPrivileged={isPrivileged} currentUserId={currentUserId} config={config} preview={preview} pollNonce={pollNonce} />
          </div>
          <div id="hub-members" className="order-3 lg:order-none">
            <CommunitySidebar config={config} heroVideoUrl={hub.heroVideoUrl} members={members} resources={resources} events={events} />
          </div>
        </div>
        )}

        <div className="mt-10 rounded-2xl border border-border bg-galli/5 py-6 text-center text-sm text-muted-foreground">
          Good ideas grow in great communities.
        </div>
      </div>
      {!preview && manageEvents && <HubEventsModal hubId={hub.id} onClose={() => setManageEvents(false)} />}
      {!preview && manageResources && <HubResourcesModal hubId={hub.id} onClose={() => setManageResources(false)} />}
    </div>
  )
}

// useSearchParams needs a Suspense boundary — this component is rendered from a
// server component, and without one Next fails the build with a CSR-bailout error.
export function CommunityHubView(props: React.ComponentProps<typeof CommunityHubViewInner>) {
  return (
    <Suspense fallback={null}>
      <CommunityHubViewInner {...props} />
    </Suspense>
  )
}
