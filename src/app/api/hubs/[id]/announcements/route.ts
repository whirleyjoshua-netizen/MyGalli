import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'
import { canModerate, canViewCommunityHub } from '@/lib/community'
import { rateLimit } from '@/lib/rate-limit'
import { validateAnnouncementBody, toAnnouncementDTO } from '@/lib/hub-announcements'

const PAGE = 10

async function collaboratorIds(hubId: string): Promise<string[]> {
  const rows = await db.hubCollaborator.findMany({ where: { hubId }, select: { userId: true } })
  return rows.map((r) => r.userId)
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const hub = await db.hub.findUnique({ where: { id }, select: { id: true, userId: true, community: true, published: true } })
  if (!hub || !hub.community) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const me = await getUser(request)
  // Privilege requires a signed-in viewer, so skip the collaborator lookup
  // entirely for logged-out readers rather than fetching rows we can't use.
  const collabIds = me ? await collaboratorIds(id) : []
  const isPrivileged = !!me && (me.id === hub.userId || collabIds.includes(me.id))
  if (!canViewCommunityHub({ published: hub.published, isPrivileged })) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const rows = await db.hubAnnouncement.findMany({
    where: { hubId: id },
    orderBy: { createdAt: 'desc' },
    take: PAGE,
    include: { author: { select: { username: true, name: true, avatar: true } } },
  })
  return NextResponse.json({ announcements: rows.map(toAnnouncementDTO) })
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const limited = await rateLimit(request, { limit: 20, windowMs: 60_000, prefix: 'hub-announcement' })
  if (limited) return limited
  const me = await getUser(request)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const hub = await db.hub.findUnique({ where: { id }, select: { id: true, userId: true, community: true, published: true } })
  if (!hub || !hub.community) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const collabIds = await collaboratorIds(id)
  if (!canModerate(me.id, hub, collabIds)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json().catch(() => ({}))
  const parsed = validateAnnouncementBody(body?.body)
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })

  const created = await db.hubAnnouncement.create({ data: { hubId: id, authorId: me.id, body: parsed.value } })
  return NextResponse.json({ id: created.id }, { status: 201 })
}
