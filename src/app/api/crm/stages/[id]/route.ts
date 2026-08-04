import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { deleteStage } from '@/lib/crm/stages'

type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(request: NextRequest, { params }: Ctx) {
  const user = await getUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  // Scoped lookup: a stage belonging to another user is indistinguishable
  // from one that does not exist.
  const owned = await db.crmStage.findFirst({ where: { id, ownerId: user.id } })
  if (!owned) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await request.json().catch(() => ({}))
  const data: { name?: string; color?: string } = {}
  if (typeof body.name === 'string' && body.name.trim()) data.name = body.name.trim().slice(0, 40)
  if (typeof body.color === 'string') data.color = body.color.slice(0, 9)

  try {
    return NextResponse.json(await db.crmStage.update({ where: { id, ownerId: user.id }, data }))
  } catch (e: any) {
    if (e?.code === 'P2002') {
      return NextResponse.json({ error: 'You already have a stage with that name' }, { status: 409 })
    }
    throw e
  }
}

export async function DELETE(request: NextRequest, { params }: Ctx) {
  const user = await getUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const result = await deleteStage(user.id, id)

  if (!result.ok) {
    if (result.reason === 'last-stage') {
      return NextResponse.json({ error: 'You need at least one stage' }, { status: 409 })
    }
    if (result.reason === 'conflict') {
      return NextResponse.json(
        { error: 'Your stages changed while we were deleting. Please try again.' },
        { status: 409 }
      )
    }
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return NextResponse.json({ movedTo: result.movedTo, moved: result.moved })
}
