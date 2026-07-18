import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'
import { canModerate, canViewCommunityHub, postNotifyTargets } from '@/lib/community'
import { rateLimit } from '@/lib/rate-limit'
import { notifyHubMembers } from '@/lib/notifications'
import { validateEventInput, toEventDTO } from '@/lib/hub-events'
import type { Prisma } from '@prisma/client'

async function collaboratorIds(hubId: string): Promise<string[]> {
  const rows = await db.hubCollaborator.findMany({ where: { hubId }, select: { userId: true } })
  return rows.map((r) => r.userId)
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const hub = await db.hub.findUnique({ where: { id }, select: { id: true, userId: true, community: true, published: true } })
  if (!hub || !hub.community) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const me = await getUser(request)
  const isPrivileged = !!me && (me.id === hub.userId || (await collaboratorIds(id)).includes(me.id))
  if (!canViewCommunityHub({ published: hub.published, isPrivileged })) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const scope = new URL(request.url).searchParams.get('scope')
  const where: Prisma.HubEventWhereInput = scope === 'all' ? { hubId: id } : { hubId: id, startsAt: { gte: new Date() } }
  const rows = await db.hubEvent.findMany({ where, orderBy: { startsAt: 'asc' }, take: scope === 'all' ? 200 : 50 })
  return NextResponse.json({ events: rows.map(toEventDTO) })
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const limited = await rateLimit(request, { limit: 20, windowMs: 60_000, prefix: 'hub-event-create' })
  if (limited) return limited
  const me = await getUser(request)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const hub = await db.hub.findUnique({ where: { id }, select: { id: true, userId: true, community: true, title: true, slug: true, user: { select: { username: true } } } })
  if (!hub || !hub.community) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const collabIds = await collaboratorIds(id)
  if (!canModerate(me.id, hub, collabIds)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const parsed = validateEventInput(await request.json().catch(() => ({})))
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
  const v = parsed.value
  const event = await db.hubEvent.create({
    data: { hubId: id, title: v.title, startsAt: v.startsAt, endsAt: v.endsAt, allDay: v.allDay, isOnline: v.isOnline, location: v.location, description: v.description },
  })
  const memberIds = (await db.hubMember.findMany({ where: { hubId: id }, select: { userId: true } })).map((m) => m.userId)
  const targets = postNotifyTargets({ authorId: me.id, ownerId: hub.userId, collabIds, memberIds })
  await notifyHubMembers(targets, {
    type: 'hub_event',
    actor: { id: me.id, name: me.name || me.username, avatar: me.avatar },
    entityUrl: `/${hub.user.username}/hub/${hub.slug}`,
    contextText: hub.title,
  })
  return NextResponse.json({ id: event.id }, { status: 201 })
}
