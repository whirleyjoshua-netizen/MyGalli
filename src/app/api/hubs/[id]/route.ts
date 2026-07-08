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

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const r = await ownHub(request, id)
  if ('error' in r) return r.error
  const [folders, items, notes, bookmarks] = await Promise.all([
    db.hubFolder.findMany({ where: { hubId: id }, orderBy: { order: 'asc' } }),
    db.hubItem.findMany({ where: { hubId: id }, orderBy: { order: 'asc' } }),
    db.hubNote.findMany({ where: { hubId: id }, orderBy: { order: 'asc' } }),
    db.hubNoteBookmark.findMany({ where: { hubId: id }, orderBy: { order: 'asc' } }),
  ])
  const safeFolders = folders.map(({ passcodeHash, ...f }) => ({ ...f, hasPasscode: !!passcodeHash }))
  const safeItems = items.map(({ passcodeHash, ...i }) => ({ ...i, hasPasscode: !!passcodeHash }))
  return NextResponse.json({ hub: r.hub, folders: safeFolders, items: safeItems, notes, bookmarks })
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const r = await ownHub(request, id)
  if ('error' in r) return r.error
  const body = await request.json().catch(() => ({}))
  const data: Record<string, unknown> = {}
  if (typeof body.title === 'string') data.title = body.title.trim().slice(0, 120)
  if (typeof body.description === 'string') data.description = body.description.slice(0, 1000)
  if (typeof body.coverImage === 'string') data.coverImage = body.coverImage
  if (typeof body.community === 'boolean') data.community = body.community
  const hub = await db.hub.update({ where: { id }, data })
  return NextResponse.json(hub)
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const r = await ownHub(request, id)
  if ('error' in r) return r.error
  await db.hub.delete({ where: { id } }) // cascade removes folders + items
  return NextResponse.json({ ok: true })
}
