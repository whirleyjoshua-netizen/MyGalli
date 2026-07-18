import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'
import { canParticipate } from '@/lib/community'
import { rateLimit } from '@/lib/rate-limit'
import { isHubReactionEmoji, summarizeReactions } from '@/lib/hub-reactions'

async function reactionState(postId: string, userId: string) {
  const rows = await db.hubPostReaction.findMany({ where: { postId }, select: { emoji: true, userId: true } })
  return summarizeReactions(rows, userId)
}

async function collaboratorIds(hubId: string): Promise<string[]> {
  const rows = await db.hubCollaborator.findMany({ where: { hubId }, select: { userId: true } })
  return rows.map((r) => r.userId)
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string; postId: string }> }) {
  const { id, postId } = await params
  const limited = await rateLimit(request, { limit: 60, windowMs: 60_000, prefix: 'hub-reaction' })
  if (limited) return limited
  const me = await getUser(request)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await request.json().catch(() => ({}))
  if (!isHubReactionEmoji(body.emoji)) return NextResponse.json({ error: 'Invalid emoji' }, { status: 400 })
  const emoji = body.emoji as string
  const hub = await db.hub.findUnique({ where: { id }, select: { id: true, userId: true, community: true } })
  if (!hub || !hub.community) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const post = await db.hubPost.findFirst({ where: { id: postId, hubId: id }, select: { id: true } })
  if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const isMember = !!(await db.hubMember.findUnique({ where: { hubId_userId: { hubId: id, userId: me.id } }, select: { id: true } }))
  const collabIds = await collaboratorIds(id)
  if (!canParticipate(me.id, hub, collabIds, isMember)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  await db.hubPostReaction.upsert({
    where: { postId_userId_emoji: { postId, userId: me.id, emoji } },
    create: { postId, userId: me.id, emoji },
    update: {},
  })
  return NextResponse.json(await reactionState(postId, me.id))
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string; postId: string }> }) {
  const { postId } = await params
  const me = await getUser(request)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await request.json().catch(() => ({}))
  if (!isHubReactionEmoji(body.emoji)) return NextResponse.json({ error: 'Invalid emoji' }, { status: 400 })
  await db.hubPostReaction.deleteMany({ where: { postId, userId: me.id, emoji: body.emoji as string } })
  return NextResponse.json(await reactionState(postId, me.id))
}
