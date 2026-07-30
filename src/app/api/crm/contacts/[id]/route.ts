import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { normalizeEmail } from '@/lib/crm/email'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: Ctx) {
  const user = await getUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const contact = await db.crmContact.findFirst({
    where: { id, ownerId: user.id },
    include: { activities: { orderBy: { occurredAt: 'desc' } } },
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

  if (typeof body.name === 'string') data.name = body.name.trim().slice(0, 120) || null

  if (body.email !== undefined) {
    const email = normalizeEmail(body.email)
    if (body.email && !email) {
      return NextResponse.json({ error: 'That is not a valid email' }, { status: 400 })
    }
    data.email = email
    // The merge key follows the email, so a corrected address starts merging
    // future touches onto this contact.
    if (email) data.mergeKey = email
  }

  if (body.followUpAt !== undefined) {
    data.followUpAt = body.followUpAt ? new Date(body.followUpAt) : null
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
