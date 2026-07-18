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

// GET /api/workspaces - List user's workspaces (enriched for the landing cards)
export async function GET(request: NextRequest) {
  const user = await getUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rows = await db.workspace.findMany({
    where: { ownerId: user.id },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true, name: true, description: true, icon: true, updatedAt: true,
      _count: { select: { fields: true, records: { where: { status: 'active' } } } },
      views: { orderBy: { position: 'asc' }, take: 1, select: { type: true } },
      records: { where: { status: 'active' }, orderBy: { updatedAt: 'desc' }, take: 1, select: { updatedAt: true } },
    },
  })

  const items = rows.map((w) => {
    const latestRec = w.records[0]?.updatedAt
    const lastActivity = latestRec && latestRec > w.updatedAt ? latestRec : w.updatedAt
    return {
      id: w.id, name: w.name, description: w.description, icon: w.icon,
      recordCount: w._count.records, fieldCount: w._count.fields,
      primaryView: w.views[0]?.type ?? null,
      lastActivity: lastActivity.toISOString(),
    }
  })

  return NextResponse.json(items)
}
