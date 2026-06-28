import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'

const PAGE_SIZE = 12

export async function GET(request: NextRequest) {
  try {
    const me = await getUser(request)
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = request.nextUrl
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const limit = Math.min(PAGE_SIZE, Math.max(1, parseInt(searchParams.get('limit') || String(PAGE_SIZE), 10)))

    const followingIds = (await db.follow.findMany({ where: { followerId: me.id }, select: { followingId: true } })).map((f) => f.followingId)
    if (followingIds.length === 0) {
      return NextResponse.json({ displays: [], hasMore: false, page, pageSize: limit, empty: true })
    }

    const where = { published: true, kind: { not: 'profile' }, userId: { in: followingIds } }
    const [total, displays] = await Promise.all([
      db.display.count({ where }),
      db.display.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true, slug: true, title: true, coverImage: true, views: true,
          user: { select: { username: true, name: true, avatar: true } },
        },
      }),
    ])

    return NextResponse.json({ displays, hasMore: page * limit < total, page, pageSize: limit, empty: false })
  } catch (error) {
    console.error('Feed error:', error)
    return NextResponse.json({ error: 'Failed to fetch feed' }, { status: 500 })
  }
}
