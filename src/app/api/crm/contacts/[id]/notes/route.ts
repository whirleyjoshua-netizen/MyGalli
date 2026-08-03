import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'
import { db } from '@/lib/db'

type Ctx = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, { params }: Ctx) {
  const user = await getUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const owned = await db.crmContact.findFirst({ where: { id, ownerId: user.id } })
  if (!owned) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await request.json().catch(() => ({}))
  const rawText = typeof body.text === 'string' ? body.text.trim() : ''
  if (!rawText) return NextResponse.json({ error: 'text is required' }, { status: 400 })

  // Bound the stored text itself, not just the summary derived from it — an
  // untruncated payload is an unbounded JSON-column write vector even though
  // the summary looked capped.
  const text = rawText.slice(0, 5000)

  // sourceId stays null for notes: they are authored, not imported, so the
  // (source, sourceId) idempotency unique must not apply to them.
  const activity = await db.crmActivity.create({
    data: {
      contactId: id,
      source: 'note',
      sourceId: null,
      summary: text.slice(0, 280),
      payload: { text },
      occurredAt: new Date(),
    },
  })

  await db.crmContact.update({ where: { id, ownerId: user.id }, data: { updatedAt: new Date() } })

  return NextResponse.json(activity, { status: 201 })
}
