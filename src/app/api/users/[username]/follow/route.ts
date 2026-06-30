import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'
import { isSelfFollow } from '@/lib/social'
import { rateLimit } from '@/lib/rate-limit'

async function resolveTarget(username: string) {
  return db.user.findUnique({ where: { username }, select: { id: true } })
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ username: string }> }) {
  const limited = await rateLimit(request, { limit: 30, windowMs: 60_000, prefix: 'follow' })
  if (limited) return limited
  try {
    const me = await getUser(request)
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { username } = await params
    const target = await resolveTarget(username)
    if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 })
    if (isSelfFollow(me.id, target.id)) return NextResponse.json({ error: 'Cannot follow yourself' }, { status: 400 })

    await db.follow.upsert({
      where: { followerId_followingId: { followerId: me.id, followingId: target.id } },
      create: { followerId: me.id, followingId: target.id },
      update: {},
    })
    return NextResponse.json({ following: true })
  } catch (error) {
    console.error('Follow error:', error)
    return NextResponse.json({ error: 'Failed to follow' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ username: string }> }) {
  const limited = await rateLimit(request, { limit: 30, windowMs: 60_000, prefix: 'follow' })
  if (limited) return limited
  try {
    const me = await getUser(request)
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { username } = await params
    const target = await resolveTarget(username)
    if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    await db.follow.deleteMany({ where: { followerId: me.id, followingId: target.id } })
    return NextResponse.json({ following: false })
  } catch (error) {
    console.error('Unfollow error:', error)
    return NextResponse.json({ error: 'Failed to unfollow' }, { status: 500 })
  }
}
