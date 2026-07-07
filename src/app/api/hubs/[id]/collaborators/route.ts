import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'
import { isPro } from '@/lib/plan'
import { createNotification } from '@/lib/notifications'

async function ownedHub(request: NextRequest, id: string) {
  const me = await getUser(request)
  if (!me) return { err: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const hub = await db.hub.findUnique({ where: { id } })
  if (!hub || hub.userId !== me.id) return { err: NextResponse.json({ error: 'Not found' }, { status: 404 }) }
  return { me, hub }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const r = await ownedHub(request, id); if ('err' in r) return r.err
  const rows = await db.hubCollaborator.findMany({
    where: { hubId: id },
    select: { userId: true, user: { select: { username: true, name: true, avatar: true } } },
  })
  return NextResponse.json({ collaborators: rows })
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const r = await ownedHub(request, id); if ('err' in r) return r.err
  if (!isPro(r.me)) return NextResponse.json({ error: 'Pro required' }, { status: 403 })
  const body = await request.json().catch(() => ({}))
  const username = typeof body.username === 'string' ? body.username.trim() : ''
  if (!username) return NextResponse.json({ error: 'username required' }, { status: 400 })
  const target = await db.user.findUnique({ where: { username }, select: { id: true } })
  if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 })
  if (target.id === r.me.id) return NextResponse.json({ error: 'You already own this hub' }, { status: 400 })
  await db.hubCollaborator.upsert({
    where: { hubId_userId: { hubId: id, userId: target.id } },
    create: { hubId: id, userId: target.id },
    update: {},
  })
  await createNotification({
    userId: target.id, type: 'hub_collaborator',
    actor: { id: r.me.id, name: r.me.name || r.me.username, avatar: r.me.avatar },
    entityUrl: `/hubs/${id}`, contextText: r.hub.title,
  })
  return NextResponse.json({ ok: true })
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const r = await ownedHub(request, id); if ('err' in r) return r.err
  if (!isPro(r.me)) return NextResponse.json({ error: 'Pro required' }, { status: 403 })
  const body = await request.json().catch(() => ({}))
  if (typeof body.userId !== 'string') return NextResponse.json({ error: 'userId required' }, { status: 400 })
  await db.hubCollaborator.deleteMany({ where: { hubId: id, userId: body.userId } })
  return NextResponse.json({ ok: true })
}
