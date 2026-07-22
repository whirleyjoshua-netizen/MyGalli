import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'
import { canModerate } from '@/lib/community'

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string; announcementId: string }> }): Promise<NextResponse> {
  const { id, announcementId } = await params
  const me = await getUser(request)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const hub = await db.hub.findUnique({ where: { id }, select: { id: true, userId: true, community: true } })
  if (!hub || !hub.community) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  // Hub-scoped lookup: an announcement id from another hub 404s rather than deletes.
  const row = await db.hubAnnouncement.findFirst({ where: { id: announcementId, hubId: id }, select: { id: true } })
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const collabIds = (await db.hubCollaborator.findMany({ where: { hubId: id }, select: { userId: true } })).map((r) => r.userId)
  if (!canModerate(me.id, hub, collabIds)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  await db.hubAnnouncement.delete({ where: { id: announcementId } })
  return NextResponse.json({ ok: true })
}
