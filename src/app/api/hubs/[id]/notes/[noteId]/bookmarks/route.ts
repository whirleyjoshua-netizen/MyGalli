import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'

async function ownHubNote(request: NextRequest, id: string, noteId: string) {
  const me = await getUser(request)
  if (!me) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const hub = await db.hub.findUnique({ where: { id } })
  if (!hub || hub.userId !== me.id) return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) }
  const note = await db.hubNote.findUnique({ where: { id: noteId } })
  if (!note || note.hubId !== id) return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) }
  return { me, hub, note }
}

function validRects(v: unknown): v is { x: number; y: number; w: number; h: number }[] {
  return Array.isArray(v) && v.length > 0 && v.every(
    (r) => r && typeof r === 'object' &&
      ['x', 'y', 'w', 'h'].every((k) => Number.isFinite((r as Record<string, unknown>)[k]))
  )
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string; noteId: string }> }) {
  const { id, noteId } = await params
  const r = await ownHubNote(request, id, noteId)
  if ('error' in r) return r.error

  const body = await request.json().catch(() => ({}))
  const itemId = typeof body.itemId === 'string' ? body.itemId : ''
  const item = itemId ? await db.hubItem.findUnique({ where: { id: itemId } }) : null
  if (!item || item.hubId !== id) return NextResponse.json({ error: 'Invalid itemId' }, { status: 400 })

  const page = Number(body.page)
  if (!Number.isInteger(page) || page < 1) return NextResponse.json({ error: 'Invalid page' }, { status: 400 })
  if (!validRects(body.rects)) return NextResponse.json({ error: 'Invalid rects' }, { status: 400 })

  const text = typeof body.text === 'string' ? body.text.slice(0, 2000) : ''
  const title = typeof body.title === 'string' && body.title.trim() ? body.title.slice(0, 200) : (text.slice(0, 80) || 'Bookmark')

  const max = await db.hubNoteBookmark.findFirst({ where: { noteId }, orderBy: { order: 'desc' } })
  const order = (max?.order ?? -1) + 1

  const bookmark = await db.hubNoteBookmark.create({
    data: { noteId, hubId: id, itemId, page, rects: body.rects, text, title, order },
  })
  return NextResponse.json(bookmark, { status: 201 })
}
