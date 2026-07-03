import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'
import { normalizeSettings, resultsVisible } from '@/lib/bulletin'
import { aggregateBlock, toRecords } from '@/lib/element-aggregate'

const PAGE_SIZE = 15

export async function GET(request: NextRequest) {
  try {
    const me = await getUser(request)
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = request.nextUrl
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const limit = Math.min(PAGE_SIZE, Math.max(1, parseInt(searchParams.get('limit') || String(PAGE_SIZE), 10)))

    const followingIds = (
      await db.follow.findMany({ where: { followerId: me.id }, select: { followingId: true } })
    ).map((f) => f.followingId)
    const authorIds = [me.id, ...followingIds]

    const where = { authorId: { in: authorIds } }
    const [total, posts] = await Promise.all([
      db.bulletinPost.count({ where }),
      db.bulletinPost.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          text: true,
          imageUrl: true,
          blocks: true,
          settings: true,
          createdAt: true,
          authorId: true,
          author: { select: { id: true, name: true, username: true, avatar: true } },
        },
      }),
    ])

    const postIds = posts.map((p) => p.id)
    const [likeGroups, myLikes, allResponses] = await Promise.all([
      db.bulletinLike.groupBy({ by: ['postId'], where: { postId: { in: postIds } }, _count: { postId: true } }),
      db.bulletinLike.findMany({ where: { postId: { in: postIds }, userId: me.id }, select: { postId: true } }),
      db.bulletinResponse.findMany({
        where: { postId: { in: postIds } },
        select: { postId: true, userId: true, responses: true, createdAt: true, user: { select: { name: true, username: true, avatar: true } } },
      }),
    ])

    const likeCountByPost = new Map(likeGroups.map((g) => [g.postId, g._count.postId]))
    const likedSet = new Set(myLikes.map((l) => l.postId))
    const responsesByPost = new Map<string, typeof allResponses>()
    for (const r of allResponses) {
      const arr = responsesByPost.get(r.postId) || []
      arr.push(r)
      responsesByPost.set(r.postId, arr)
    }

    const feed = posts.map((p) => {
      const blocks = Array.isArray(p.blocks) ? (p.blocks as any[]) : []
      const block = blocks[0] || null
      const settings = normalizeSettings(p.settings)
      const rows = responsesByPost.get(p.id) || []
      const mine = rows.find((r) => r.userId === me.id)
      const isAuthor = p.authorId === me.id
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

    return NextResponse.json({ posts: feed, hasMore: page * limit < total, page })
  } catch (error) {
    console.error('Bulletin feed error:', error)
    return NextResponse.json({ error: 'Failed to fetch feed' }, { status: 500 })
  }
}
