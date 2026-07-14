import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'

type Ctx = { params: Promise<{ id: string; fieldId: string }> }

async function assertOwner(request: NextRequest, workspaceId: string) {
  const user = await getUser(request)
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const ws = await db.workspace.findUnique({ where: { id: workspaceId }, select: { ownerId: true } })
  if (!ws || ws.ownerId !== user.id) {
    return { error: NextResponse.json({ error: 'Workspace not found' }, { status: 404 }) }
  }
  return { user }
}

// Only these keys are updatable; key and type are immutable.
const ALLOWED = ['label', 'config', 'required', 'position'] as const

export async function PATCH(request: NextRequest, { params }: Ctx) {
  const { id, fieldId } = await params
  const gate = await assertOwner(request, id)
  if (gate.error) return gate.error
  try {
    const body = await request.json()
    const data: Record<string, any> = {}
    for (const k of ALLOWED) if (k in body) data[k] = body[k]
    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'No updatable fields' }, { status: 400 })
    }
    const { count } = await db.workspaceField.updateMany({ where: { id: fieldId, workspaceId: id }, data })
    if (count === 0) return NextResponse.json({ error: 'Field not found' }, { status: 404 })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Field PATCH error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: Ctx) {
  const { id, fieldId } = await params
  const gate = await assertOwner(request, id)
  if (gate.error) return gate.error
  const { count } = await db.workspaceField.deleteMany({ where: { id: fieldId, workspaceId: id } })
  if (count === 0) return NextResponse.json({ error: 'Field not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
