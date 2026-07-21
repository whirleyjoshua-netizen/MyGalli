'use client'

import { useEffect, useRef, useState } from 'react'
import { BulletinPostCard, type FeedPost } from '@/components/bulletin/BulletinPostCard'
import { HubPostComposer } from '@/components/hub/HubPostComposer'
import { HubPostComments } from '@/components/hub/HubPostComments'
import { ReportButton } from '@/components/hub/ReportButton'
import type { HubConfig } from '@/lib/types/hub-config'

// Matches LIVE_POLL_MS on the analytics live surface.
export const FEED_POLL_MS = 20_000

export function CommunityFeed({
  hubId, canPost, isPrivileged, currentUserId, config, preview, pollNonce,
}: {
  hubId: string
  canPost: boolean
  isPrivileged: boolean
  currentUserId?: string
  config: HubConfig
  preview?: boolean
  pollNonce?: number
}) {
  const [posts, setPosts] = useState<FeedPost[]>([])
  const [loaded, setLoaded] = useState(false)
  const [pending, setPending] = useState<FeedPost[]>([])
  const topRef = useRef<HTMLDivElement>(null)
  // Refs mirror state so the polling callback can read current values without
  // being re-created (and without stale closures).
  const postsRef = useRef<FeedPost[]>([])
  const pendingRef = useRef<FeedPost[]>([])
  useEffect(() => { postsRef.current = posts }, [posts])
  useEffect(() => { pendingRef.current = pending }, [pending])

  async function load() {
    if (preview) { setPosts([]); setLoaded(true); return }
    const res = await fetch(`/api/hubs/${hubId}/posts`)
    if (res.ok) { setPosts((await res.json()).posts); setPending([]) }
    setLoaded(true)
  }
  useEffect(() => { load() }, [hubId])

  async function poll() {
    if (preview) return
    let incoming: FeedPost[]
    try {
      const res = await fetch(`/api/hubs/${hubId}/posts`)
      if (!res.ok) return // a failed poll is a no-op
      incoming = (await res.json()).posts
    } catch {
      return
    }
    const fresh = new Map(incoming.map((p) => [p.id, p]))

    // Visible posts: update counts only. Never reorder or replace the object
    // wholesale — that would re-mount the card and reset poll answers and
    // open comment threads.
    setPosts((cur) =>
      cur.map((p) => {
        const f = fresh.get(p.id)
        return f ? { ...p, reactions: f.reactions, commentCount: f.commentCount } : p
      }),
    )

    // Genuinely new posts go to the buffer, deduped against both lists.
    const displayed = new Set(postsRef.current.map((p) => p.id))
    const buffered = new Set(pendingRef.current.map((p) => p.id))
    const added = incoming.filter((p) => !displayed.has(p.id) && !buffered.has(p.id))
    if (added.length) setPending((cur) => [...added, ...cur])
  }

  const pollRef = useRef(poll)
  useEffect(() => { pollRef.current = poll })
  useEffect(() => {
    if (preview) return
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') pollRef.current()
    }, FEED_POLL_MS)
    return () => clearInterval(id)
  }, [preview])

  function showPending() {
    setPosts((cur) => {
      const ids = new Set(cur.map((p) => p.id))
      return [...pending.filter((p) => !ids.has(p.id)), ...cur]
    })
    setPending([])
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="space-y-4">
      <div ref={topRef} />
      {pending.length > 0 && (
        <button
          onClick={showPending}
          className="w-full rounded-full border border-border bg-surface py-2 text-sm font-medium text-primary shadow-soft hover:bg-muted"
        >
          ▲ {pending.length} new {pending.length === 1 ? 'post' : 'posts'}
        </button>
      )}
      {canPost && config.feed.composerEnabled && <HubPostComposer hubId={hubId} onPosted={load} pollNonce={pollNonce} />}
      {loaded && posts.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">{config.feed.emptyStateText || 'No posts yet. Be the first to share something.'}</p>
      ) : (
        posts.map((p) => (
          <div key={p.id}>
            <BulletinPostCard
              post={p}
              currentUserId={currentUserId}
              basePath={`/api/hubs/${hubId}/posts`}
              canModerate={isPrivileged}
              canReact={canPost}
              onDeleted={(delId) => setPosts((cur) => cur.filter((x) => x.id !== delId))}
              reportSlot={
                <ReportButton
                  hubId={hubId}
                  targetType="post"
                  targetId={p.id}
                  authorId={p.author.id}
                  currentUserId={currentUserId}
                />
              }
            />
            <HubPostComments
              hubId={hubId}
              postId={p.id}
              initialCount={p.commentCount ?? 0}
              canComment={canPost}
              canModerate={isPrivileged}
              currentUserId={currentUserId}
            />
          </div>
        ))
      )}
    </div>
  )
}
