import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'
import { deriveFriend } from '@/lib/social'

export async function GET(request: NextRequest, { params }: { params: Promise<{ username: string }> }) {
  try {
    const { username } = await params
    const me = await getUser(request)

    const user = await db.user.findUnique({
      where: { username },
      select: { id: true, username: true, name: true, avatar: true, bio: true },
    })
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    const [followerCount, followingCount, displays, iFollow, followsMe] = await Promise.all([
      db.follow.count({ where: { followingId: user.id } }),
      db.follow.count({ where: { followerId: user.id } }),
      db.display.findMany({
        where: { userId: user.id, published: true },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, slug: true, title: true, coverImage: true, views: true,
          user: { select: { username: true, name: true, avatar: true } },
        },
      }),
      me ? db.follow.findUnique({ where: { followerId_followingId: { followerId: me.id, followingId: user.id } }, select: { id: true } }) : Promise.resolve(null),
      me ? db.follow.findUnique({ where: { followerId_followingId: { followerId: user.id, followingId: me.id } }, select: { id: true } }) : Promise.resolve(null),
    ])

    // friendCount: users who both follow and are followed by this user
    const theirFollowingIds = (await db.follow.findMany({ where: { followerId: user.id }, select: { followingId: true } })).map((f) => f.followingId)
    const friendCount = theirFollowingIds.length
      ? await db.follow.count({ where: { followerId: { in: theirFollowingIds }, followingId: user.id } })
      : 0

    const isFollowing = !!iFollow
    const isFollowedBy = !!followsMe

    return NextResponse.json({
      ...user,
      followerCount,
      followingCount,
      friendCount,
      isFollowing,
      isFollowedBy,
      isFriend: deriveFriend(isFollowing, isFollowedBy),
      displays,
    })
  } catch (error) {
    console.error('Profile fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 })
  }
}
