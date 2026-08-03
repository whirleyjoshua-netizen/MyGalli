import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { ensureStages } from '@/lib/crm/stages'

export async function GET(request: NextRequest) {
  const user = await getUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  return NextResponse.json({ stages: await ensureStages(user.id) })
}

export async function POST(request: NextRequest) {
  const user = await getUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const name = typeof body.name === 'string' ? body.name.trim().slice(0, 40) : ''
  if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 })

  const color = typeof body.color === 'string' ? body.color.slice(0, 9) : '#39D98A'
  const last = await db.crmStage.findFirst({
    where: { ownerId: user.id },
    orderBy: { order: 'desc' },
    select: { order: true },
  })
  const order = (last?.order ?? -1) + 1

  try {
    const stage = await db.crmStage.create({ data: { ownerId: user.id, name, color, order } })
    return NextResponse.json(stage, { status: 201 })
  } catch (e: any) {
    if (e?.code === 'P2002') {
      return NextResponse.json({ error: 'You already have a stage with that name' }, { status: 409 })
    }
    throw e
  }
}
