'use client'

import { useCallback, useEffect, useState } from 'react'
import { useAuthStore } from '@/lib/store'
import { BulletinComposer } from './BulletinComposer'
import { BulletinPostCard, type FeedPost } from './BulletinPostCard'

type Tab = 'following' | 'trending'
const ENDPOINT: Record<Tab, string> = {
  following: '/api/bulletin/feed',
  trending: '/api/bulletin/trending',
}

export function BulletinTab() {
  const { user } = useAuthStore()
  const [tab, setTab] = useState<Tab>('following')
  const [posts, setPosts] = useState<FeedPost[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback((which: Tab) => {
    setLoading(true)
    fetch(ENDPOINT[which])
      .then((r) => (r.ok ? r.json() : { posts: [] }))
      .then((d) => setPosts(Array.isArray(d.posts) ? d.posts : []))
      .catch(() => setPosts([]))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load(tab) }, [load, tab])

  const onDeleted = (id: string) => setPosts((prev) => prev.filter((p) => p.id !== id))

  const tabBtn = (id: Tab, label: string) => {
    const active = tab === id
    return (
      <button
        onClick={() => setTab(id)}
        className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
          active
            ? 'bg-gradient-to-r from-galli via-galli-aqua to-galli-violet text-white'
            : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        {label}
      </button>
    )
  }

  return (
    <div className="rounded-2xl bg-gradient-to-br from-galli via-galli-aqua to-galli-violet p-[1.5px]">
      <div className="rounded-[15px] bg-surface p-3 space-y-3">
        <div className="flex gap-1 rounded-xl bg-background p-1">
          {tabBtn('following', 'Following')}
          {tabBtn('trending', 'Trending')}
        </div>

        <BulletinComposer onPosted={() => load(tab)} />

        {loading && posts.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>
        ) : posts.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
            {tab === 'following'
              ? 'No bulletins yet. Post one, or follow people to see theirs.'
              : 'Nothing trending yet — share a post publicly to start.'}
          </p>
        ) : (
          posts.map((p) => <BulletinPostCard key={p.id} post={p} currentUserId={user?.id} onDeleted={onDeleted} />)
        )}
      </div>
    </div>
  )
}
