import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'
import { canModerate } from '@/lib/community'

async function collaboratorIds(hubId: string): Promise<string[]> {
  const rows = await db.hubCollaborator.findMany({ where: { hubId }, select: { userId: true } })
  return rows.map((r) => r.userId)
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string; userId: string }> }) {
  const { id, userId } = await params
  const me = await getUser(request)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const hub = await db.hub.findUnique({ where: { id }, select: { id: true, userId: true, community: true } })
  if (!hub || !hub.community) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const collabIds = await collaboratorIds(id)
  if (!canModerate(me.id, hub, collabIds)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // IDOR-scoped: the ban must belong to this hub.
  const ban = await db.hubBan.findFirst({ where: { hubId: id, userId }, select: { id: true } })
  if (!ban) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Lifting a ban must NOT restore membership — that is a separate, explicit
  // action (rejoin/invite), not implied by unbanning.
  await db.hubBan.delete({ where: { id: ban.id } })

  return NextResponse.json({ ok: true }, { status: 200 })
}
