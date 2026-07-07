import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'
import { rateLimit } from '@/lib/rate-limit'
import { createNotification } from '@/lib/notifications'

async function loadCommunityHub(id: string) {
  const hub = await db.hub.findUnique({ where: { id }, select: { id: true, userId: true, title: true, community: true } })
  if (!hub || !hub.community) return null
  return hub
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const limited = await rateLimit(request, { limit: 20, windowMs: 60_000, prefix: 'hubjoin' })
  if (limited) return limited
  const { id } = await params
  const me = await getUser(request)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const hub = await loadCommunityHub(id)
  if (!hub) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (hub.userId === me.id) return NextResponse.json({ error: 'You own this hub' }, { status: 400 })

  const existing = await db.hubMember.findUnique({ where: { hubId_userId: { hubId: id, userId: me.id } }, select: { id: true } })
  if (!existing) {
    await db.hubMember.create({ data: { hubId: id, userId: me.id } })
    await createNotification({
      userId: hub.userId,
      type: 'hub_member',
      actor: { id: me.id, name: me.name || me.username, avatar: me.avatar },
      entityUrl: `/hubs/${id}`,
      contextText: hub.title,
    })
  }
  const memberCount = await db.hubMember.count({ where: { hubId: id } })
  return NextResponse.json({ joined: true, memberCount })
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const limited = await rateLimit(request, { limit: 20, windowMs: 60_000, prefix: 'hubjoin' })
  if (limited) return limited
  const { id } = await params
  const me = await getUser(request)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  await db.hubMember.deleteMany({ where: { hubId: id, userId: me.id } })
  const memberCount = await db.hubMember.count({ where: { hubId: id } })
  return NextResponse.json({ joined: false, memberCount })
}
