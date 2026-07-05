import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'
import { rankTrending } from '@/lib/bulletin'
import { assembleFeedPosts } from '@/lib/bulletin-feed'

const PAGE_SIZE = 15
const CANDIDATE_CAP = 200
const WINDOW_DAYS = 7

export async function GET(request: NextRequest) {
  try {
    const me = await getUser(request)
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = request.nextUrl
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const limit = Math.min(PAGE_SIZE, Math.max(1, parseInt(searchParams.get('limit') || String(PAGE_SIZE), 10)))

    const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000)

    // 1) Bounded candidate set: public posts within the window.
    const candidates = await db.bulletinPost.findMany({
      where: { isPublic: true, createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' },
      take: CANDIDATE_CAP,
      select: { id: true, createdAt: true },
    })

    if (candidates.length === 0) {
      return NextResponse.json({ posts: [], hasMore: false, page })
    }

    // 2) Engagement counts for candidates (batched — no N+1).
    const candidateIds = candidates.map((c) => c.id)
    const [likeGroupsAll, responseGroupsAll] = await Promise.all([
      db.bulletinLike.groupBy({ by: ['postId'], where: { postId: { in: candidateIds } }, _count: { postId: true } }),
      db.bulletinResponse.groupBy({ by: ['postId'], where: { postId: { in: candidateIds } }, _count: { postId: true } }),
    ])
    const likeCountMap = new Map(likeGroupsAll.map((g) => [g.postId, g._count.postId]))
    const responseCountMap = new Map(responseGroupsAll.map((g) => [g.postId, g._count.postId]))

    // 3) Rank + paginate (pure helper).
    const { pageItems, total } = rankTrending(
      candidates.map((c) => ({
        id: c.id,
        createdAt: c.createdAt,
        likeCount: likeCountMap.get(c.id) || 0,
        responseCount: responseCountMap.get(c.id) || 0,
      })),
      page,
      limit,
    )
    const pageIds = pageItems.map((i) => i.id)
    if (pageIds.length === 0) {
      return NextResponse.json({ posts: [], hasMore: false, page })
    }

    // 4) Fetch full data for the page, then assemble (same shape as the feed route).
    const [pagePosts, pageLikeGroups, myLikes, responseRows] = await Promise.all([
      db.bulletinPost.findMany({
        where: { id: { in: pageIds } },
        select: {
          id: true, text: true, imageUrl: true, blocks: true, settings: true, createdAt: true, authorId: true,
          author: { select: { id: true, name: true, username: true, avatar: true } },
        },
      }),
      db.bulletinLike.groupBy({ by: ['postId'], where: { postId: { in: pageIds } }, _count: { postId: true } }),
      db.bulletinLike.findMany({ where: { postId: { in: pageIds }, userId: me.id }, select: { postId: true } }),
      db.bulletinResponse.findMany({
        where: { postId: { in: pageIds } },
        select: { postId: true, userId: true, responses: true, createdAt: true, user: { select: { name: true, username: true, avatar: true } } },
      }),
    ])

    // Preserve ranked order (findMany does not guarantee it).
    const orderIndex = new Map(pageIds.map((id, i) => [id, i]))
    pagePosts.sort((a, b) => (orderIndex.get(a.id)! - orderIndex.get(b.id)!))

    const posts = assembleFeedPosts(pagePosts, pageLikeGroups, myLikes, responseRows, me.id)

    return NextResponse.json({ posts, hasMore: page * limit < total, page })
  } catch (error) {
    console.error('Bulletin trending error:', error)
    return NextResponse.json({ error: 'Failed to fetch trending' }, { status: 500 })
  }
}
