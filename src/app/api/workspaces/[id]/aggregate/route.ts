import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'
import { authorizeWorkspace } from '@/lib/workspaces/authorize'
import { computeAggregate, WorkspaceAgg } from '@/lib/workspaces/aggregate'

const OPS: WorkspaceAgg[] = ['count', 'sum', 'avg', 'min', 'max']
type Ctx = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: Ctx) {
  const user = await getUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  try {
    await authorizeWorkspace(user.id, id)
  } catch {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
  }

  const sp = request.nextUrl.searchParams
  const field = sp.get('field') || ''
  const op = (sp.get('op') || '') as WorkspaceAgg
  if (!OPS.includes(op)) return NextResponse.json({ error: 'Invalid op' }, { status: 400 })

  // count is field-independent; other ops require a real field
  if (op !== 'count') {
    if (!field) return NextResponse.json({ error: 'field required' }, { status: 400 })
    const exists = await db.workspaceField.findFirst({ where: { workspaceId: id, key: field }, select: { key: true } })
    if (!exists) return NextResponse.json({ error: 'Unknown field' }, { status: 400 })
  }

  const records = await db.workspaceRecord.findMany({
    where: { workspaceId: id, status: 'active' },
    select: { data: true },
  })
  const value = computeAggregate(records as Array<{ data: Record<string, any> }>, field, op)
  return NextResponse.json({ value })
}
