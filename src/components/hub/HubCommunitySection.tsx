'use client'
import { useEffect, useState } from 'react'
import { UsersRound } from 'lucide-react'
import { BulletinPostCard, type FeedPost } from '@/components/bulletin/BulletinPostCard'
import { HubPostComposer } from './HubPostComposer'

export function HubCommunitySection({
  hubId,
  initialJoined,
  memberCount: initialCount,
  isPrivileged,
  currentUserId,
}: {
  hubId: string
  initialJoined: boolean
  memberCount: number
  isPrivileged: boolean
  currentUserId?: string
}) {
  const [joined, setJoined] = useState(initialJoined)
  const [count, setCount] = useState(initialCount)
  const [posts, setPosts] = useState<FeedPost[]>([])
  const canPost = isPrivileged || joined

  async function load() {
    const res = await fetch(`/api/hubs/${hubId}/posts`)
    if (res.ok) setPosts((await res.json()).posts)
  }
  useEffect(() => { load() }, [hubId])

  async function toggleJoin() {
    const res = await fetch(`/api/hubs/${hubId}/join`, { method: joined ? 'DELETE' : 'POST' })
    if (res.status === 401) { window.location.href = '/login'; return }
    if (res.ok) { const d = await res.json(); setJoined(d.joined); setCount(d.memberCount) }
  }

  return (
    <section className="mt-8">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <UsersRound className="h-5 w-5 text-primary" /> Community
          <span className="text-sm font-normal text-muted-foreground">({count} member{count === 1 ? '' : 's'})</span>
        </h2>
        {!isPrivileged && (
          <button
            onClick={toggleJoin}
            className={`rounded-full px-4 py-2 text-sm font-semibold ${joined ? 'border border-border text-foreground' : 'bg-foreground text-background'}`}
          >
            {joined ? 'Joined' : 'Join'}
          </button>
        )}
      </div>
      {canPost && <div className="mb-4"><HubPostComposer hubId={hubId} onPosted={load} /></div>}
      <div className="space-y-4">
        {posts.length === 0 ? (
          <p className="text-sm text-muted-foreground">No posts yet.</p>
        ) : (
          posts.map((p) => (
            <BulletinPostCard key={p.id} post={p} currentUserId={currentUserId} basePath={`/api/hubs/${hubId}/posts`} onDeleted={(delId) => setPosts((cur) => cur.filter((x) => x.id !== delId))} />
          ))
        )}
      </div>
    </section>
  )
}
