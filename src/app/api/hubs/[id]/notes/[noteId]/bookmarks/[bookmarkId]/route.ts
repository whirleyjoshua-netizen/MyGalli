import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'

async function ownBookmark(request: NextRequest, id: string, noteId: string, bookmarkId: string) {
  const me = await getUser(request)
  if (!me) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const hub = await db.hub.findUnique({ where: { id } })
  if (!hub || hub.userId !== me.id) return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) }
  const bm = await db.hubNoteBookmark.findUnique({ where: { id: bookmarkId } })
  if (!bm || bm.hubId !== id || bm.noteId !== noteId) return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) }
  return { me, bm }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string; noteId: string; bookmarkId: string }> }) {
  const { id, noteId, bookmarkId } = await params
  const r = await ownBookmark(request, id, noteId, bookmarkId)
  if ('error' in r) return r.error
  const body = await request.json().catch(() => ({}))
  const data: Record<string, unknown> = {}
  if (typeof body.title === 'string' && body.title.trim()) data.title = body.title.slice(0, 200)
  const bookmark = await db.hubNoteBookmark.update({ where: { id: bookmarkId }, data })
  return NextResponse.json(bookmark)
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string; noteId: string; bookmarkId: string }> }) {
  const { id, noteId, bookmarkId } = await params
  const r = await ownBookmark(request, id, noteId, bookmarkId)
  if ('error' in r) return r.error
  await db.hubNoteBookmark.delete({ where: { id: bookmarkId } })
  return NextResponse.json({ ok: true })
}
