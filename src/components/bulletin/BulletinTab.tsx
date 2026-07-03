'use client'

import { useCallback, useEffect, useState } from 'react'
import { useAuthStore } from '@/lib/store'
import { BulletinComposer } from './BulletinComposer'
import { BulletinPostCard, type FeedPost } from './BulletinPostCard'

export function BulletinTab() {
  const { user } = useAuthStore()
  const [posts, setPosts] = useState<FeedPost[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    setLoading(true)
    fetch('/api/bulletin/feed')
      .then((r) => (r.ok ? r.json() : { posts: [] }))
      .then((d) => setPosts(Array.isArray(d.posts) ? d.posts : []))
      .catch(() => setPosts([]))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const onDeleted = (id: string) => setPosts((prev) => prev.filter((p) => p.id !== id))

  return (
    <div className="space-y-3">
      <BulletinComposer onPosted={load} />
      {loading && posts.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>
      ) : posts.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
          No bulletins yet. Post one, or follow people to see theirs.
        </p>
      ) : (
        posts.map((p) => <BulletinPostCard key={p.id} post={p} currentUserId={user?.id} onDeleted={onDeleted} />)
      )}
    </div>
  )
}
