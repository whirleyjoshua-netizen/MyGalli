import { normalizeSettings, resultsVisible } from '@/lib/bulletin'
import { aggregateBlock, toRecords } from '@/lib/element-aggregate'

export interface FeedRowAuthor { id: string; name: string | null; username: string; avatar: string | null }
export interface FeedPostRow {
  id: string
  text: string | null
  imageUrl: string | null
  blocks: unknown
  settings: unknown
  createdAt: Date
  authorId: string
  author: FeedRowAuthor
}
export interface FeedResponseRow {
  postId: string
  userId: string
  responses: unknown
  createdAt: Date
  user: { name: string | null; username: string; avatar: string | null }
}

export function assembleFeedPosts(
  posts: FeedPostRow[],
  likeGroups: { postId: string; _count: { postId: number } }[],
  myLikes: { postId: string }[],
  responseRows: FeedResponseRow[],
  meId: string,
) {
  const likeCountByPost = new Map(likeGroups.map((g) => [g.postId, g._count.postId]))
  const likedSet = new Set(myLikes.map((l) => l.postId))
  const responsesByPost = new Map<string, FeedResponseRow[]>()
  for (const r of responseRows) {
    const arr = responsesByPost.get(r.postId) || []
    arr.push(r)
    responsesByPost.set(r.postId, arr)
  }

  return posts.map((p) => {
    const blocks = Array.isArray(p.blocks) ? (p.blocks as any[]) : []
    const block = blocks[0] || null
    const settings = normalizeSettings(p.settings)
    const rows = responsesByPost.get(p.id) || []
    const mine = rows.find((r) => r.userId === meId)
    const isAuthor = p.authorId === meId
    const hasResponded = !!mine

    let results = null
    if (block) {
      const canSee = resultsVisible({ isAuthor, revealAfterAnswer: settings.revealAfterAnswer, hasResponded })
      if (canSee) {
        results = aggregateBlock(block, toRecords(rows, false))
      }
    }

    return {
      id: p.id,
      author: { id: p.author.id, name: p.author.name, username: p.author.username, avatar: p.author.avatar },
      text: p.text,
      imageUrl: p.imageUrl,
      block,
      settings,
      createdAt: p.createdAt.toISOString(),
      likeCount: likeCountByPost.get(p.id) || 0,
      likedByMe: likedSet.has(p.id),
      myResponse: (mine?.responses as Record<string, { type: string; answer: unknown }>) || null,
      results,
    }
  })
}
