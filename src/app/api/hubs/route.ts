import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'
import { slugify } from '@/lib/utils'

export async function GET(request: NextRequest) {
  const me = await getUser(request)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const hubs = await db.hub.findMany({
    where: { userId: me.id },
    orderBy: { updatedAt: 'desc' },
    select: { id: true, title: true, slug: true, displayId: true, coverImage: true, community: true,
      _count: { select: { items: true, folders: true } } },
  })
  return NextResponse.json({ hubs })
}

export async function POST(request: NextRequest) {
  const me = await getUser(request)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await request.json().catch(() => ({}))
  let displayId: string | null = typeof body.displayId === 'string' ? body.displayId : null
  if (displayId) {
    const owned = await db.display.findUnique({ where: { id: displayId }, select: { userId: true } })
    if (!owned || owned.userId !== me.id) displayId = null
  }
  const title = typeof body.title === 'string' && body.title.trim() ? body.title.trim().slice(0, 120) : 'Untitled Hub'
  const slug = `${slugify(title)}-${Math.random().toString(36).slice(2, 7)}`
  const isCommunity = body.community === true
  const hub = await db.hub.create({ data: { userId: me.id, displayId, title, slug, community: isCommunity, published: isCommunity } })
  return NextResponse.json(hub, { status: 201 })
}
