import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { getUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { normalizeEmail } from '@/lib/crm/email'

// A busy commenter accumulates one activity per touch forever. Every other
// query on this feature is bounded; this one is what the drawer renders into a
// single list.
const MAX_TIMELINE = 200

type Ctx = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: Ctx) {
  const user = await getUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const contact = await db.crmContact.findFirst({
    where: { id, ownerId: user.id },
    include: { activities: { orderBy: { occurredAt: 'desc' }, take: MAX_TIMELINE } },
  })
  if (!contact) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json(contact)
}

export async function PATCH(request: NextRequest, { params }: Ctx) {
  const user = await getUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const owned = await db.crmContact.findFirst({ where: { id, ownerId: user.id } })
  if (!owned) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await request.json().catch(() => ({}))
  const data: Record<string, unknown> = {}

  if (typeof body.stageId === 'string') {
    // The stage must also be the caller's, or restaging becomes a way to
    // move your contact into someone else's pipeline.
    const stage = await db.crmStage.findFirst({ where: { id: body.stageId, ownerId: user.id } })
    if (!stage) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    data.stageId = body.stageId
  }

  // `null` is a real instruction here — it is how the drawer clears a name.
  // Accepting only strings silently dropped it, and the route then answered
  // 200 with the unchanged row while the UI showed an empty field.
  if (typeof body.name === 'string') data.name = body.name.trim().slice(0, 120) || null
  else if (body.name === null) data.name = null

  if (body.email !== undefined) {
    const email = normalizeEmail(body.email)
    if (body.email && !email) {
      return NextResponse.json({ error: 'That is not a valid email' }, { status: 400 })
    }
    data.email = email
    // The merge key follows the email on every write, not just when a new one
    // is supplied. Leaving the old key behind when the email is cleared meant
    // future touches from that address kept merging into a contact the owner
    // had deliberately unlinked — and never restored the visible email, so
    // there was no way to see why it was happening.
    data.mergeKey = email ?? `manual:${randomUUID()}`
  }

  if (body.followUpAt !== undefined) {
    if (body.followUpAt) {
      const followUpAt = new Date(body.followUpAt)
      if (Number.isNaN(followUpAt.getTime())) {
        return NextResponse.json({ error: 'That is not a valid date' }, { status: 400 })
      }
      data.followUpAt = followUpAt
    } else {
      data.followUpAt = null
    }
  }

  try {
    // Scope the write by ownerId too, not just the findFirst guard above. The
    // guard makes this safe today, but an independent unscoped update is one
    // refactor away from being a cross-tenant write.
    return NextResponse.json(
      await db.crmContact.update({ where: { id, ownerId: user.id }, data })
    )
  } catch (e: any) {
    if (e?.code === 'P2002') {
      return NextResponse.json({ error: 'Another contact already uses that email' }, { status: 409 })
    }
    throw e
  }
}
