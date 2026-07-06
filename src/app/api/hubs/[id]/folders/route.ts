import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'

async function ownHub(request: NextRequest, id: string) {
  const me = await getUser(request)
  if (!me) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const hub = await db.hub.findUnique({ where: { id } })
  if (!hub || hub.userId !== me.id) return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) }
  return { me, hub }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const r = await ownHub(request, id)
  if ('error' in r) return r.error

  const body = await request.json().catch(() => ({}))
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (!name || name.length > 120) {
    return NextResponse.json({ error: 'name is required (max 120 chars)' }, { status: 400 })
  }
  const parentId: string | null = typeof body.parentId === 'string' ? body.parentId : null

  if (parentId) {
    const parent = await db.hubFolder.findUnique({ where: { id: parentId } })
    if (!parent || parent.hubId !== id) {
      return NextResponse.json({ error: 'Invalid parentId' }, { status: 400 })
    }
  }

  const max = await db.hubFolder.findFirst({
    where: { hubId: id, parentId },
    orderBy: { order: 'desc' },
  })
  const order = (max?.order ?? -1) + 1

  const folder = await db.hubFolder.create({
    data: { hubId: id, name, parentId, order },
  })
  return NextResponse.json(folder, { status: 201 })
}
