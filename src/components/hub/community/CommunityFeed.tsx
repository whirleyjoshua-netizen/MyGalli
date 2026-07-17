'use client'

import { useEffect, useState } from 'react'
import { BulletinPostCard, type FeedPost } from '@/components/bulletin/BulletinPostCard'
import { HubPostComposer } from '@/components/hub/HubPostComposer'
import { HubPostComments } from '@/components/hub/HubPostComments'

export function CommunityFeed({
  hubId, canPost, isPrivileged, currentUserId,
}: {
  hubId: string
  canPost: boolean
  isPrivileged: boolean
  currentUserId?: string
}) {
  const [posts, setPosts] = useState<FeedPost[]>([])
  const [loaded, setLoaded] = useState(false)

  async function load() {
    const res = await fetch(`/api/hubs/${hubId}/posts`)
    if (res.ok) setPosts((await res.json()).posts)
    setLoaded(true)
  }
  useEffect(() => { load() }, [hubId])

  return (
    <div className="space-y-4">
      {canPost && <HubPostComposer hubId={hubId} onPosted={load} />}
      {loaded && posts.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">No posts yet. Be the first to share something.</p>
      ) : (
        posts.map((p) => (
          <div key={p.id}>
            <BulletinPostCard
              post={p}
              currentUserId={currentUserId}
              basePath={`/api/hubs/${hubId}/posts`}
              canModerate={isPrivileged}
              onDeleted={(delId) => setPosts((cur) => cur.filter((x) => x.id !== delId))}
            />
            <HubPostComments
              hubId={hubId}
              postId={p.id}
              initialCount={(p as { commentCount?: number }).commentCount ?? 0}
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
