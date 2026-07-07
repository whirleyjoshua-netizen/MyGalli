import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'
import { toMemberDTO } from '@/lib/community'

async function ownHub(request: NextRequest, id: string) {
  const me = await getUser(request)
  if (!me) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const hub = await db.hub.findUnique({ where: { id } })
  if (!hub || hub.userId !== me.id) return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) }
  return { me, hub }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const r = await ownHub(request, id)
  if ('error' in r) return r.error
  const rows = await db.hubMember.findMany({
    where: { hubId: id },
    orderBy: { createdAt: 'desc' },
    select: { userId: true, user: { select: { username: true, name: true, avatar: true } } },
  })
  return NextResponse.json({ members: rows.map(toMemberDTO), count: rows.length })
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const r = await ownHub(request, id)
  if ('error' in r) return r.error
  const body = await request.json().catch(() => ({}))
  if (typeof body.userId !== 'string') return NextResponse.json({ error: 'userId required' }, { status: 400 })
  await db.hubMember.deleteMany({ where: { hubId: id, userId: body.userId } })
  return NextResponse.json({ ok: true })
}
