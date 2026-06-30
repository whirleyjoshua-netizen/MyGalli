import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'

export async function GET(request: NextRequest, { params }: { params: Promise<{ username: string }> }) {
  try {
    const { username } = await params
    const me = await getUser(request)
    const user = await db.user.findUnique({ where: { username }, select: { id: true } })
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    const rows = await db.follow.findMany({
      where: { followerId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: { following: { select: { id: true, username: true, name: true, avatar: true } } },
    })
    const users = rows.map((r) => r.following)
    const myFollowing = me
      ? new Set((await db.follow.findMany({ where: { followerId: me.id, followingId: { in: users.map((u) => u.id) } }, select: { followingId: true } })).map((f) => f.followingId))
      : new Set<string>()

    return NextResponse.json({ users: users.map((u) => ({ username: u.username, name: u.name, avatar: u.avatar, isFollowing: myFollowing.has(u.id) })) })
  } catch (error) {
    console.error('Following fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch following' }, { status: 500 })
  }
}
