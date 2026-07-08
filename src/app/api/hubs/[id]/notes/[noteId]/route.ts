import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'
import { LINKABLE_ITEM_TYPES } from '@/lib/hub-notes'

async function ownHubNote(request: NextRequest, id: string, noteId: string) {
  const me = await getUser(request)
  if (!me) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const hub = await db.hub.findUnique({ where: { id } })
  if (!hub || hub.userId !== me.id) return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) }
  const note = await db.hubNote.findUnique({ where: { id: noteId } })
  if (!note || note.hubId !== id) return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) }
  return { me, hub, note }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; noteId: string }> }
) {
  const { id, noteId } = await params
  const r = await ownHubNote(request, id, noteId)
  if ('error' in r) return r.error

  const body = await request.json().catch(() => ({}))
  const data: Record<string, unknown> = {}
  if (typeof body.title === 'string') data.title = body.title.slice(0, 200)
  if (typeof body.content === 'string') data.content = body.content.slice(0, 5000)
  if (body.visibility === 'public' || body.visibility === 'private') data.visibility = body.visibility
  if (typeof body.minimized === 'boolean') data.minimized = body.minimized
  if (typeof body.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(body.color)) data.color = body.color
  if ('linkedItemId' in body) {
    if (body.linkedItemId === null) {
      data.linkedItemId = null
    } else if (typeof body.linkedItemId === 'string') {
      const item = await db.hubItem.findUnique({ where: { id: body.linkedItemId } })
      if (!item || item.hubId !== id || !LINKABLE_ITEM_TYPES.has(item.type)) {
        return NextResponse.json({ error: 'Invalid linkedItemId' }, { status: 400 })
      }
      data.linkedItemId = body.linkedItemId
    } else {
      return NextResponse.json({ error: 'Invalid linkedItemId' }, { status: 400 })
    }
  }

  const note = await db.hubNote.update({ where: { id: noteId }, data })
  return NextResponse.json(note)
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; noteId: string }> }
) {
  const { id, noteId } = await params
  const r = await ownHubNote(request, id, noteId)
  if ('error' in r) return r.error
  await db.hubNote.delete({ where: { id: noteId } })
  return NextResponse.json({ ok: true })
}
