import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'

type Ctx = { params: Promise<{ id: string }> }

// Only these transitions are reachable from the UI: accepting a request, or
// ignoring it (which blocks). 'requested' is set by the server on creation.
const ALLOWED_STATES = ['accepted', 'blocked'] as const

export async function PATCH(request: NextRequest, { params }: Ctx) {
  const user = await getUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  let payload: Record<string, unknown>
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  const data: { state?: string; starred?: boolean; muted?: boolean } = {}

  if (payload.state !== undefined) {
    const next = String(payload.state)
    if (!ALLOWED_STATES.includes(next as (typeof ALLOWED_STATES)[number])) {
      return NextResponse.json({ error: 'Invalid state' }, { status: 400 })
    }
    data.state = next
  }
  if (typeof payload.starred === 'boolean') data.starred = payload.starred
  if (typeof payload.muted === 'boolean') data.muted = payload.muted

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }

  // Scoping by userId means a non-participant updates zero rows.
  const result = await db.conversationParticipant.updateMany({
    where: { conversationId: id, userId: user.id },
    data,
  })
  if (result.count === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({ ok: true })
}
