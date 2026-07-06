import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'

const ITEM_TYPES = new Set(['file', 'link', 'embed', 'note'])

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
  const type = typeof body.type === 'string' ? body.type : ''
  if (!ITEM_TYPES.has(type)) {
    return NextResponse.json({ error: 'type must be one of file, link, embed, note' }, { status: 400 })
  }
  const title = typeof body.title === 'string' ? body.title.trim() : ''
  if (!title) {
    return NextResponse.json({ error: 'title is required' }, { status: 400 })
  }
  const folderId: string | null = typeof body.folderId === 'string' ? body.folderId : null

  if (folderId) {
    const folder = await db.hubFolder.findUnique({ where: { id: folderId } })
    if (!folder || folder.hubId !== id) {
      return NextResponse.json({ error: 'Invalid folderId' }, { status: 400 })
    }
  }

  const max = await db.hubItem.findFirst({
    where: { hubId: id, folderId },
    orderBy: { order: 'desc' },
  })
  const order = (max?.order ?? -1) + 1

  const item = await db.hubItem.create({
    data: {
      hubId: id,
      folderId,
      type,
      title,
      url: typeof body.url === 'string' ? body.url : null,
      content: typeof body.content === 'string' ? body.content : null,
      order,
    },
  })
  return NextResponse.json(item, { status: 201 })
}
