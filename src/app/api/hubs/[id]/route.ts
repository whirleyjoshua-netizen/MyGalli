import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'
import { sanitizeHubConfig } from '@/lib/hub-config'

async function ownHub(request: NextRequest, id: string) {
  const me = await getUser(request)
  if (!me) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const hub = await db.hub.findUnique({ where: { id }, include: { user: { select: { username: true } } } })
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
  if (typeof body.published === 'boolean') data.published = body.published
  if (typeof body.tagline === 'string') data.tagline = body.tagline.trim().slice(0, 160)
  if (typeof body.heroVideoUrl === 'string') data.heroVideoUrl = body.heroVideoUrl.trim().slice(0, 500)
  if ('config' in body) data.config = sanitizeHubConfig(body.config) as unknown as object
  if (typeof body.version === 'number' && body.version !== r.hub.version) {
    return NextResponse.json({ error: 'Conflict', version: r.hub.version }, { status: 409 })
  }
  if (typeof body.version === 'number') data.version = r.hub.version + 1
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
