import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { authorizeWorkspace } from '@/lib/workspaces/authorize'

// POST /api/workspaces/[id]/views - Create a new view
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: workspaceId } = await params

  try {
    // 1. Authorize ownership
    await authorizeWorkspace(user.id, workspaceId)

    const { name, type, config } = await request.json()
    if (!name || !type) return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })

    // 2. Validate View Type
    const ALLOWED_VIEW_TYPES = ['grid', 'gallery', 'kanban']
    if (!ALLOWED_VIEW_TYPES.includes(type)) {
      return NextResponse.json({ error: 'Unsupported view type' }, { status: 400 })
    }

    // 3. Validate config fields against Workspace schema
    const fields = await db.workspaceField.findMany({ where: { workspaceId } })
    const fieldKeys = fields.map((f) => f.key)

    if (type === 'kanban') {
      const gf = config?.groupByField
      const field = fields.find((f) => f.key === gf)
      if (!field || field.type !== 'choice') {
        return NextResponse.json({ error: 'Kanban needs a single-select field to group by' }, { status: 400 })
      }
    }
    if (config?.visibleFields) {
      const unknownFields = config.visibleFields.filter(
        (f: string) => !fieldKeys.includes(f)
      )
      if (unknownFields.length > 0) {
        return NextResponse.json({ error: `Unknown fields: ${unknownFields.join(', ')}` }, { status: 400 })
      }
    }

    // 4. Determine position
    const count = await db.workspaceView.count({ where: { workspaceId } })

    // 5. Persist
    const view = await db.workspaceView.create({
      data: {
        workspaceId,
        name,
        type,
        config: config || {},
        position: count,
      },
    })

    return NextResponse.json(view, { status: 201 })
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'View name already exists' }, { status: 409 })
    }
    if (error.message === 'Unauthorized or Workspace not found') {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
    }
    console.error('Create view error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
