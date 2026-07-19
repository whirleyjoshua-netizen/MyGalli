import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'
import { canParticipate, canViewCommunityHub, postNotifyTargets } from '@/lib/community'
import { sanitizeHubConfig, canDropToPool } from '@/lib/hub-config'
import { rateLimit } from '@/lib/rate-limit'
import { notifyHubMembers } from '@/lib/notifications'
import { validateDropInput, toDropDTO } from '@/lib/hub-drops'

const PAGE = 24

async function collaboratorIds(hubId: string): Promise<string[]> {
  const rows = await db.hubCollaborator.findMany({ where: { hubId }, select: { userId: true } })
  return rows.map((r) => r.userId)
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const hub = await db.hub.findUnique({ where: { id }, select: { id: true, userId: true, community: true, published: true } })
  if (!hub || !hub.community) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const me = await getUser(request)
  const collabIds = await collaboratorIds(id)
  const isPrivileged = !!me && (me.id === hub.userId || collabIds.includes(me.id))
  if (!canViewCommunityHub({ published: hub.published, isPrivileged })) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const before = new URL(request.url).searchParams.get('before')
  const where: any = { hubId: id }
  if (!isPrivileged) where.hidden = false
  if (before) {
    const d = new Date(before)
    if (!isNaN(d.getTime())) where.createdAt = { lt: d }
  }

  const rows = await db.hubDrop.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: PAGE + 1,
    include: { author: { select: { id: true, username: true, name: true, avatar: true } } },
  })
  const hasMore = rows.length > PAGE
  const page = hasMore ? rows.slice(0, PAGE) : rows
  const nextCursor = hasMore ? page[page.length - 1].createdAt.toISOString() : null
  return NextResponse.json({ drops: page.map(toDropDTO), nextCursor })
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const limited = await rateLimit(request, { limit: 20, windowMs: 60_000, prefix: 'hub-drop-create' })
  if (limited) return limited
  const me = await getUser(request)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const hub = await db.hub.findUnique({
    where: { id },
    select: { id: true, userId: true, community: true, title: true, slug: true, config: true, user: { select: { username: true } } },
  })
  if (!hub || !hub.community) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const collabIds = await collaboratorIds(id)
  const isMember = !!(await db.hubMember.findUnique({ where: { hubId_userId: { hubId: id, userId: me.id } }, select: { id: true } }))
  const isPrivileged = me.id === hub.userId || collabIds.includes(me.id)
  const participates = canParticipate(me.id, hub, collabIds, isMember)
  const config = sanitizeHubConfig(hub.config)
  if (!canDropToPool({ canParticipate: participates, whoCanDrop: config.kollab.whoCanDrop, isPrivileged })) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const parsed = validateDropInput(await request.json().catch(() => ({})))
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
  const v = parsed.value
  const drop = await db.hubDrop.create({
    data: {
      hubId: id,
      authorId: me.id,
      type: v.type,
      url: v.url,
      thumbnailUrl: v.thumbnailUrl,
      caption: v.caption,
      mimeType: v.mimeType,
      width: v.width,
      height: v.height,
    },
  })
  const memberIds = (await db.hubMember.findMany({ where: { hubId: id }, select: { userId: true } })).map((m) => m.userId)
  const targets = postNotifyTargets({ authorId: me.id, ownerId: hub.userId, collabIds, memberIds })
  await notifyHubMembers(targets, {
    type: 'hub_drop',
    actor: { id: me.id, name: me.name || me.username, avatar: me.avatar },
    entityUrl: `/${hub.user.username}/hub/${hub.slug}`,
    contextText: hub.title,
  })
  return NextResponse.json({ id: drop.id }, { status: 201 })
}
