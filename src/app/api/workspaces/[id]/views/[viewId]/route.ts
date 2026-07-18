import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { authorizeWorkspace } from '@/lib/workspaces/authorize'
import { validateFilter, validateSort, FilterError, type FilterField } from '@/lib/workspaces/filter'

// PATCH /api/workspaces/[id]/views/[viewId] - Update view config
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; viewId: string }> }
) {
  const user = await getUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: workspaceId, viewId } = await params

  try {
    // 1. Authorize ownership
    await authorizeWorkspace(user.id, workspaceId)

    const { config } = await request.json()
    if (!config) return NextResponse.json({ error: 'Config is required' }, { status: 400 })

    // 2. Validate config fields against Workspace schema
    const fields = await db.workspaceField.findMany({ where: { workspaceId } })
    const fieldKeys = fields.map((f) => f.key)

    if (config?.visibleFields) {
      const unknownFields = config.visibleFields.filter(
        (f: string) => !fieldKeys.includes(f)
      )
      if (unknownFields.length > 0) {
        return NextResponse.json({ error: `Unknown fields: ${unknownFields.join(', ')}` }, { status: 400 })
      }
    }

    // Validate + normalize any saved filter against the real schema, same as
    // POST /views — a filter is only ever persisted in its coerced form, and
    // PATCH must not accept a payload POST would reject.
    let storedConfig = config
    if (storedConfig?.filter) {
      try {
        storedConfig = {
          ...storedConfig,
          filter: validateFilter(storedConfig.filter, fields as unknown as FilterField[]),
        }
      } catch (e: any) {
        if (e instanceof FilterError) {
          return NextResponse.json({ error: e.message }, { status: 400 })
        }
        throw e
      }
    }

    if (storedConfig?.sort) {
      try {
        storedConfig = { ...storedConfig, sort: validateSort(storedConfig.sort, fields as unknown as FilterField[]) }
      } catch (e: any) {
        if (e instanceof FilterError) return NextResponse.json({ error: e.message }, { status: 400 })
        throw e
      }
    }

    // 3. Persist
    const view = await db.workspaceView.update({
      where: { id: viewId, workspaceId },
      data: { config: storedConfig },
    })

    return NextResponse.json(view)
  } catch (error: any) {
    if (error.message === 'Unauthorized or Workspace not found') {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
    }
    console.error('Update view error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/workspaces/[id]/views/[viewId] - Delete a view
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; viewId: string }> }
) {
  const user = await getUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id: workspaceId, viewId } = await params
  try {
    await authorizeWorkspace(user.id, workspaceId)
    const count = await db.workspaceView.count({ where: { workspaceId } })
    if (count <= 1) return NextResponse.json({ error: 'Cannot delete the last view' }, { status: 400 })
    const { count: deleted } = await db.workspaceView.deleteMany({ where: { id: viewId, workspaceId } })
    if (deleted === 0) return NextResponse.json({ error: 'View not found' }, { status: 404 })
    return NextResponse.json({ ok: true })
  } catch (error: any) {
    if (error.message === 'Unauthorized or Workspace not found') {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
    }
    console.error('Delete view error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
