import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'
import { assembleFeedPosts } from '@/lib/bulletin-feed'

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

    const feed = assembleFeedPosts(posts, likeGroups, myLikes, allResponses, me.id)

    return NextResponse.json({ posts: feed, hasMore: page * limit < total, page })
  } catch (error) {
    console.error('Bulletin feed error:', error)
    return NextResponse.json({ error: 'Failed to fetch feed' }, { status: 500 })
  }
}
