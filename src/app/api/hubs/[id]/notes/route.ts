import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'
import { LINKABLE_ITEM_TYPES } from '@/lib/hub-notes'

async function ownHub(request: NextRequest, id: string) {
  const me = await getUser(request)
  if (!me) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const hub = await db.hub.findUnique({ where: { id } })
  if (!hub || hub.userId !== me.id) return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) }
  return { me, hub }
}

async function validateLinkedItem(hubId: string, linkedItemId: unknown): Promise<string | null | 'invalid'> {
  if (linkedItemId === null || linkedItemId === undefined) return null
  if (typeof linkedItemId !== 'string') return 'invalid'
  const item = await db.hubItem.findUnique({ where: { id: linkedItemId } })
  if (!item || item.hubId !== hubId || !LINKABLE_ITEM_TYPES.has(item.type)) return 'invalid'
  return linkedItemId
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const r = await ownHub(request, id)
  if ('error' in r) return r.error

  const body = await request.json().catch(() => ({}))
  const visibility = body.visibility === 'private' ? 'private' : 'public'

  const linked = await validateLinkedItem(id, body.linkedItemId)
  if (linked === 'invalid') return NextResponse.json({ error: 'Invalid linkedItemId' }, { status: 400 })

  const max = await db.hubNote.findFirst({ where: { hubId: id }, orderBy: { order: 'desc' } })
  const order = (max?.order ?? -1) + 1

  const note = await db.hubNote.create({
    data: {
      hubId: id,
      title: typeof body.title === 'string' ? body.title.slice(0, 200) : '',
      content: typeof body.content === 'string' ? body.content.slice(0, 5000) : '',
      linkedItemId: linked,
      visibility,
      order,
    },
  })
  return NextResponse.json(note, { status: 201 })
}
