import { NextRequest, NextResponse } from 'next/server'
import { hash } from 'bcryptjs'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'
import { isPro } from '@/lib/plan'

async function ownHub(request: NextRequest, id: string) {
  const me = await getUser(request)
  if (!me) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const hub = await db.hub.findUnique({ where: { id } })
  if (!hub || hub.userId !== me.id) return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) }
  return { me, hub }
}

async function ownItem(id: string, itemId: string) {
  const item = await db.hubItem.findUnique({ where: { id: itemId } })
  if (!item || item.hubId !== id) return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) }
  return { item }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const { id, itemId } = await params
  const r = await ownHub(request, id)
  if ('error' in r) return r.error
  const it = await ownItem(id, itemId)
  if ('error' in it) return it.error

  const body = await request.json().catch(() => ({}))
  const data: Record<string, unknown> = {}

  if (typeof body.title === 'string') {
    const title = body.title.trim()
    if (!title) return NextResponse.json({ error: 'title cannot be empty' }, { status: 400 })
    data.title = title
  }
  if (typeof body.url === 'string' || body.url === null) data.url = body.url
  if (typeof body.content === 'string' || body.content === null) data.content = body.content
  if (typeof body.order === 'number') data.order = body.order

  if (body.visibility === 'private' || (typeof body.passcode === 'string' && body.passcode)) {
    if (!isPro(r.me)) return NextResponse.json({ error: 'Pro required to make items private' }, { status: 403 })
  }
  if (body.visibility === 'public' || body.visibility === 'private') data.visibility = body.visibility
  if (body.passcode === null || body.passcode === '') data.passcodeHash = null
  else if (typeof body.passcode === 'string') data.passcodeHash = await hash(body.passcode, 12)

  if (body.folderId !== undefined) {
    if (body.folderId === null) {
      data.folderId = null
    } else if (typeof body.folderId === 'string') {
      const folder = await db.hubFolder.findUnique({ where: { id: body.folderId } })
      if (!folder || folder.hubId !== id) {
        return NextResponse.json({ error: 'Invalid folderId' }, { status: 400 })
      }
      data.folderId = body.folderId
    }
  }

  const item = await db.hubItem.update({ where: { id: itemId }, data })
  const { passcodeHash: _passcodeHash, ...safeItem } = item
  return NextResponse.json(safeItem)
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const { id, itemId } = await params
  const r = await ownHub(request, id)
  if ('error' in r) return r.error
  const it = await ownItem(id, itemId)
  if ('error' in it) return it.error

  await db.hubItem.delete({ where: { id: itemId } })
  return NextResponse.json({ ok: true })
}
