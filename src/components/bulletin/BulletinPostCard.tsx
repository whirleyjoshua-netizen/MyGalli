'use client'

import { useState, type ReactNode } from 'react'
import { Heart, Trash2 } from 'lucide-react'
import type { ElementAggregate } from '@/lib/element-aggregate'
import { BulletinBlock } from './BulletinBlock'
import type { CanvasElement } from '@/lib/types/canvas'
import { timeAgo } from '@/lib/time-ago'
import { ReactionBar } from '@/components/hub/community/ReactionBar'
import type { ReactionSummary } from '@/lib/hub-reactions'

export interface FeedPost {
  id: string
  author: { id: string; name: string | null; username: string; avatar: string | null }
  text: string | null
  imageUrl: string | null
  block: CanvasElement | null
  settings: { revealAfterAnswer: boolean; liveTally: boolean }
  createdAt: string
  likeCount?: number
  likedByMe?: boolean
  myResponse: Record<string, { type: string; answer: unknown }> | null
  results: ElementAggregate | null
  reactions?: ReactionSummary
  commentCount?: number
}

export function BulletinPostCard({
  post,
  currentUserId,
  onDeleted,
  basePath = '/api/bulletin',
  canModerate,
  canReact,
  reportSlot,
}: {
  post: FeedPost
  currentUserId?: string
  onDeleted: (id: string) => void
  basePath?: string
  canModerate?: boolean
  canReact?: boolean
  // Optional render-slot so a host surface (e.g. Hub communities) can attach a
  // ReportButton without coupling this shared card to hub-only concepts. Bulletin's
  // own usage passes nothing and renders unchanged.
  reportSlot?: ReactNode
}) {
  const [liked, setLiked] = useState(post.likedByMe ?? false)
  const [likeCount, setLikeCount] = useState(post.likeCount ?? 0)
  const resolvedCanReact = canReact ?? (currentUserId != null)
  const [results, setResults] = useState<ElementAggregate | null>(post.results)
  const [myResponse, setMyResponse] = useState(post.myResponse)

  const toggleLike = async () => {
    const next = !liked
    setLiked(next)
    setLikeCount((c) => c + (next ? 1 : -1))
    try {
      const res = await fetch(`${basePath}/${post.id}/like`, { method: next ? 'POST' : 'DELETE' })
      if (res.ok) {
        const data = await res.json()
        setLiked(data.likedByMe)
        setLikeCount(data.likeCount)
      }
    } catch {
      setLiked(!next)
      setLikeCount((c) => c + (next ? -1 : 1))
    }
  }

  const del = async () => {
    if (!window.confirm('Delete this post?')) return
    try {
      const res = await fetch(`${basePath}/${post.id}`, { method: 'DELETE' })
      if (res.ok) onDeleted(post.id)
    } catch {
      /* ignore */
    }
  }

  const name = post.author.name || post.author.username

  return (
    <div className="rounded-2xl border border-border bg-surface p-3 space-y-2.5">
      <div className="flex items-center gap-2">
        <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full bg-gradient-to-br from-galli/30 to-galli-violet/30">
          {post.author.avatar && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={post.author.avatar} alt="" className="h-full w-full object-cover" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">{name}</p>
          <p className="text-xs text-muted-foreground">@{post.author.username} · {timeAgo(post.createdAt)}</p>
        </div>
        {reportSlot}
        {(currentUserId === post.author.id || canModerate) && (
          <button onClick={del} title="Delete" className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
        )}
      </div>

      {post.text && <p className="whitespace-pre-wrap text-sm text-foreground">{post.text}</p>}

      {post.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={post.imageUrl} alt="" className="w-full rounded-lg" />
      )}

      {post.block && (
        <BulletinBlock
          postId={post.id}
          basePath={basePath}
          block={post.block}
          results={results}
          myResponse={myResponse}
          onResults={(r) => {
            setResults(r)
            setMyResponse((prev) => prev ?? {})
          }}
        />
      )}

      {post.reactions ? (
        <ReactionBar postId={post.id} basePath={basePath} initial={post.reactions} disabled={!resolvedCanReact} />
      ) : (
        <div className="flex items-center gap-1 pt-0.5">
          <button onClick={toggleLike} className={`flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium ${liked ? 'text-red-500' : 'text-muted-foreground hover:text-foreground'}`}>
            <Heart className={`h-4 w-4 ${liked ? 'fill-red-500' : ''}`} /> {likeCount > 0 ? likeCount : ''}
          </button>
        </div>
      )}
    </div>
  )
}
