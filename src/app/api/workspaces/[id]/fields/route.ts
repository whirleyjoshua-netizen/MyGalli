import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'

type Ctx = { params: Promise<{ id: string }> }

// GET /api/workspaces/[id]/fields - List fields for a workspace
export async function GET(request: NextRequest, { params }: Ctx) {
  const { id } = await params
  const user = await getUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Verify ownership
  const workspace = await db.workspace.findUnique({
    where: { id },
    select: { ownerId: true },
  })
  if (!workspace || workspace.ownerId !== user.id) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
  }

  const fields = await db.workspaceField.findMany({
    where: { workspaceId: id },
    orderBy: { position: 'asc' },
  })

  return NextResponse.json(fields)
}

// POST /api/workspaces/[id]/fields - Add a field
export async function POST(request: NextRequest, { params }: Ctx) {
  const { id } = await params
  const user = await getUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Verify ownership
  const workspace = await db.workspace.findUnique({
    where: { id },
    select: { ownerId: true },
  })
  if (!workspace || workspace.ownerId !== user.id) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
  }

  try {
    const { key, label, type, required } = await request.json()
    if (!key || !label || !type) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Get current count for position
    const count = await db.workspaceField.count({ where: { workspaceId: id } })

    const field = await db.workspaceField.create({
      data: {
        workspaceId: id,
        key,
        label,
        type,
        required: !!required,
        position: count,
      },
    })
    return NextResponse.json(field, { status: 201 })
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'Field key already exists' }, { status: 409 })
    }
    console.error('Create field error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
