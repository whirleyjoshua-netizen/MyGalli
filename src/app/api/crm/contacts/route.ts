import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { getUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { ensureStages } from '@/lib/crm/stages'
import { normalizeEmail } from '@/lib/crm/email'

export async function GET(request: NextRequest) {
  const user = await getUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(request.url)
  const q = url.searchParams.get('q')?.trim()
  const stageId = url.searchParams.get('stageId')?.trim()

  const where: Record<string, unknown> = { ownerId: user.id }
  if (stageId) where.stageId = stageId
  if (q) {
    where.OR = [
      { name: { contains: q, mode: 'insensitive' } },
      { email: { contains: q, mode: 'insensitive' } },
    ]
  }

  const contacts = await db.crmContact.findMany({
    where,
    orderBy: { updatedAt: 'desc' },
    take: 500,
    include: { activities: { orderBy: { occurredAt: 'desc' }, take: 1 } },
  })

  return NextResponse.json({ contacts })
}

export async function POST(request: NextRequest) {
  const user = await getUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const name = typeof body.name === 'string' ? body.name.trim().slice(0, 120) : ''
  const email = normalizeEmail(body.email)

  if (!name && !email) {
    return NextResponse.json({ error: 'A name or an email is required' }, { status: 400 })
  }

  const stages = await ensureStages(user.id)

  // A manual contact without an email still needs a non-null mergeKey: a
  // nullable unique does not enforce in Postgres, so two email-less contacts
  // would otherwise collapse into one row.
  const mergeKey = email ?? `manual:${randomUUID()}`

  try {
    const contact = await db.crmContact.create({
      data: { ownerId: user.id, stageId: stages[0].id, mergeKey, email, name: name || null },
    })
    return NextResponse.json(contact, { status: 201 })
  } catch (e: any) {
    if (e?.code === 'P2002') {
      return NextResponse.json({ error: 'You already have a contact with that email' }, { status: 409 })
    }
    throw e
  }
}
