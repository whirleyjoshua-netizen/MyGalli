import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'
import { canModerate } from '@/lib/community'
import { validateEventInput } from '@/lib/hub-events'

async function gate(request: NextRequest, id: string, eventId: string) {
  const me = await getUser(request)
  if (!me) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const hub = await db.hub.findUnique({ where: { id }, select: { id: true, userId: true, community: true } })
  if (!hub || !hub.community) return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) }
  const collabIds = (await db.hubCollaborator.findMany({ where: { hubId: id }, select: { userId: true } })).map((r) => r.userId)
  if (!canModerate(me.id, hub, collabIds)) return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  const event = await db.hubEvent.findFirst({ where: { id: eventId, hubId: id }, select: { id: true } })
  if (!event) return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) }
  return { ok: true as const }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string; eventId: string }> }): Promise<NextResponse> {
  const { id, eventId } = await params
  const g = await gate(request, id, eventId)
  if ('error' in g) return g.error
  const parsed = validateEventInput(await request.json().catch(() => ({})))
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
  const v = parsed.value
  await db.hubEvent.update({ where: { id: eventId }, data: { title: v.title, startsAt: v.startsAt, endsAt: v.endsAt, allDay: v.allDay, isOnline: v.isOnline, location: v.location, description: v.description } })
  return NextResponse.json({ ok: true })
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string; eventId: string }> }): Promise<NextResponse> {
  const { id, eventId } = await params
  const g = await gate(request, id, eventId)
  if ('error' in g) return g.error
  await db.hubEvent.delete({ where: { id: eventId } })
  return NextResponse.json({ ok: true })
}
