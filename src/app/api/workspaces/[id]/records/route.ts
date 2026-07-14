import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'
import { createWorkspaceRecord } from '@/lib/workspaces/service'

type CreateWorkspaceRecordBody = {
  data: Record<string, unknown>
  displayId?: string
}

function handleWorkspaceError(error: any) {
  if (error.type === 'VALIDATION_ERROR') {
    return NextResponse.json({ error: 'Validation failed', fields: error.errors }, { status: 422 })
  }
  if (error.type === 'CONFLICT_ERROR') {
    return NextResponse.json({ error: error.message }, { status: 409 })
  }
  if (error.message === 'Unauthorized or Workspace not found') {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
  }
  console.error('Workspace service error:', error)
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
}

// POST /api/workspaces/[id]/records - Create a record
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: workspaceId } = await params

  try {
    const body: CreateWorkspaceRecordBody = await request.json()
    if (!body.data) return NextResponse.json({ error: 'Data is required' }, { status: 400 })

    const record = await createWorkspaceRecord({
      workspaceId,
      userId: user.id,
      input: body.data,
      displayId: body.displayId,
    })

    return NextResponse.json(record, { status: 201 })
  } catch (error) {
    return handleWorkspaceError(error)
  }
}
