import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'

type Ctx = { params: Promise<{ id: string }> }

async function gate(request: NextRequest, id: string) {
  const user = await getUser(request)
  if (!user) return { res: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const ws = await db.workspace.findUnique({ where: { id } })
  if (!ws || ws.ownerId !== user.id) {
    return { res: NextResponse.json({ error: 'Workspace not found' }, { status: 404 }) }
  }
  return { user, ws }
}

export async function GET(request: NextRequest, { params }: Ctx) {
  const { id } = await params
  const g = await gate(request, id)
  if (g.res) return g.res

  const searchParams = request.nextUrl.searchParams
  const parsedPage = parseInt(searchParams.get('page') || '1')
  const page = Number.isFinite(parsedPage) ? Math.max(1, parsedPage) : 1
  const parsedPageSize = parseInt(searchParams.get('pageSize') || '100')
  const pageSize = Number.isFinite(parsedPageSize) ? Math.min(200, Math.max(1, parsedPageSize)) : 100

  const [fields, records, total, views] = await Promise.all([
    db.workspaceField.findMany({ where: { workspaceId: id }, orderBy: { position: 'asc' } }),
    db.workspaceRecord.findMany({
      where: { workspaceId: id, status: 'active' },
      orderBy: { createdAt: 'asc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: { id: true, data: true, updatedAt: true },
    }),
    db.workspaceRecord.count({ where: { workspaceId: id, status: 'active' } }),
    db.workspaceView.findMany({ where: { workspaceId: id }, orderBy: { position: 'asc' } }),
  ])

  let viewList = views
  if (viewList.length === 0) {
    const def = await db.workspaceView.create({ data: { workspaceId: id, name: 'Grid', type: 'grid', config: {}, position: 0 } })
    viewList = [def]
  }

  const ws = g.ws!
  return NextResponse.json({
    workspace: { id: ws.id, name: ws.name, description: ws.description, icon: ws.icon },
    fields,
    records,
    views: viewList,
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  })
}

export async function PATCH(request: NextRequest, { params }: Ctx) {
  const { id } = await params
  const g = await gate(request, id)
  if (g.res) return g.res
  try {
    const body = await request.json()
    const data: Record<string, any> = {}
    for (const k of ['name', 'description', 'icon'] as const) if (k in body) data[k] = body[k]
    if (Object.keys(data).length === 0) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
    const updated = await db.workspace.update({ where: { id }, data })
    return NextResponse.json(updated)
  } catch (error: any) {
    if (error.code === 'P2002') return NextResponse.json({ error: 'Name already in use' }, { status: 409 })
    console.error('Workspace PATCH error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: Ctx) {
  const { id } = await params
  const g = await gate(request, id)
  if (g.res) return g.res
  await db.workspace.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
