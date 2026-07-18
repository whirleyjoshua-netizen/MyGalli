import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { authorizeWorkspace } from '@/lib/workspaces/authorize'
import { validateImportRows, type ImportField } from '@/lib/workspaces/import'

const MAX_ROWS = 5000

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: workspaceId } = await params

  let body: { rows?: unknown; dryRun?: boolean }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
  const rows = body.rows
  if (!Array.isArray(rows)) return NextResponse.json({ error: 'rows must be an array' }, { status: 400 })
  if (rows.length > MAX_ROWS) {
    return NextResponse.json({ error: `Too many rows (max ${MAX_ROWS})` }, { status: 400 })
  }

  try {
    const workspace = await authorizeWorkspace(user.id, workspaceId)
    const fields = (await db.workspaceField.findMany({ where: { workspaceId } })) as unknown as ImportField[]

    const { valid, errors, validCount, skippedCount } = validateImportRows(fields, rows as Array<Record<string, unknown>>)

    if (body.dryRun) {
      return NextResponse.json({ validCount, skippedCount, errors })
    }

    if (valid.length > 0) {
      await db.workspaceRecord.createMany({
        data: valid.map((d) => ({
          workspaceId,
          data: d,
          schemaVersion: workspace.schemaVersion,
          createdById: user.id,
          status: 'active',
        })),
      })
    }

    return NextResponse.json({ inserted: valid.length, skipped: skippedCount, errors })
  } catch (error: any) {
    if (error.message === 'Unauthorized or Workspace not found') {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
    }
    console.error('CSV import error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
