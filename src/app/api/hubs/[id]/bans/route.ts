import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'
import { canModerate } from '@/lib/community'
import { rateLimit } from '@/lib/rate-limit'

async function collaboratorIds(hubId: string): Promise<string[]> {
  const rows = await db.hubCollaborator.findMany({ where: { hubId }, select: { userId: true } })
  return rows.map((r) => r.userId)
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const limited = await rateLimit(request, { limit: 10, windowMs: 60_000, prefix: 'hub-ban-create' })
  if (limited) return limited
  const me = await getUser(request)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const hub = await db.hub.findUnique({ where: { id }, select: { id: true, userId: true, community: true } })
  if (!hub || !hub.community) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const collabIds = await collaboratorIds(id)
  if (!canModerate(me.id, hub, collabIds)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json().catch(() => ({}))
  const targetId = typeof body?.userId === 'string' ? body.userId : ''
  const reason = typeof body?.reason === 'string' ? body.reason : undefined
  if (!targetId) return NextResponse.json({ error: 'userId required' }, { status: 400 })

  // Self-ban is checked first: without this, an owner or collaborator
  // self-targeting would otherwise be caught (and mis-classified as 403) by
  // the owner/collaborator guards below.
  if (targetId === me.id) return NextResponse.json({ error: 'Cannot ban yourself' }, { status: 400 })
  // A collaborator has canModerate but must never be able to ban the owner
  // out of their own community.
  if (targetId === hub.userId) return NextResponse.json({ error: 'Cannot ban the owner' }, { status: 403 })
  // Removing a collaborator is the existing collaborator surface, not this one.
  if (collabIds.includes(targetId)) return NextResponse.json({ error: 'Cannot ban a collaborator' }, { status: 403 })

  try {
    await db.$transaction([
      db.hubBan.create({ data: { hubId: id, userId: targetId, bannedById: me.id, reason } }),
      db.hubMember.deleteMany({ where: { hubId: id, userId: targetId } }),
    ])
  } catch (e: any) {
    // Already banned — no-op.
    if (e?.code === 'P2002') return NextResponse.json({ ok: true }, { status: 200 })
    throw e
  }

  return NextResponse.json({ ok: true }, { status: 201 })
}
