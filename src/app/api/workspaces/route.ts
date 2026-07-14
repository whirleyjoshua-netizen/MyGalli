import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'

// POST /api/workspaces - Create a new workspace
export async function POST(request: NextRequest) {
  const user = await getUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { name, description, icon } = await request.json()
    if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 })

    const workspace = await db.workspace.create({
      data: {
        name,
        description,
        icon,
        ownerId: user.id,
      },
    })
    return NextResponse.json(workspace, { status: 201 })
  } catch (error) {
    console.error('Create workspace error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// GET /api/workspaces - List user's workspaces
export async function GET(request: NextRequest) {
  const user = await getUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const workspaces = await db.workspace.findMany({
    where: { ownerId: user.id },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(workspaces)
}
