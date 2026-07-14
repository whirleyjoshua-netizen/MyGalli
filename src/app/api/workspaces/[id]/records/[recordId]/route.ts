import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'
import { updateWorkspaceRecord, deleteWorkspaceRecord } from '@/lib/workspaces/service'

type Ctx = { params: Promise<{ id: string; recordId: string }> }

function handleError(error: any) {
  if (error.type === 'VALIDATION_ERROR') {
    return NextResponse.json({ error: 'Validation failed', fields: error.errors }, { status: 422 })
  }
  if (error.type === 'NOT_FOUND' || error.message === 'Unauthorized or Workspace not found') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  console.error('Record route error:', error)
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
}

export async function PATCH(request: NextRequest, { params }: Ctx) {
  const user = await getUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id: workspaceId, recordId } = await params
  try {
    const body = await request.json()
    if (!body?.data || typeof body.data !== 'object') {
      return NextResponse.json({ error: 'data object required' }, { status: 400 })
    }
    const record = await updateWorkspaceRecord({ userId: user.id, workspaceId, recordId, patch: body.data })
    return NextResponse.json(record)
  } catch (error) {
    return handleError(error)
  }
}

export async function DELETE(request: NextRequest, { params }: Ctx) {
  const user = await getUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id: workspaceId, recordId } = await params
  try {
    await deleteWorkspaceRecord({ userId: user.id, workspaceId, recordId })
    return NextResponse.json({ ok: true })
  } catch (error) {
    return handleError(error)
  }
}
