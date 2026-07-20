import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'
import { canModerate } from '@/lib/community'

const RESOLVABLE_STATUSES = ['open', 'resolved', 'dismissed'] as const

async function collaboratorIds(hubId: string): Promise<string[]> {
  const rows = await db.hubCollaborator.findMany({ where: { hubId }, select: { userId: true } })
  return rows.map((r) => r.userId)
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; reportId: string }> },
) {
  const { id, reportId } = await params
  const me = await getUser(request)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const hub = await db.hub.findUnique({ where: { id }, select: { id: true, userId: true, community: true } })
  if (!hub || !hub.community) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const collabIds = await collaboratorIds(id)
  if (!canModerate(me.id, hub, collabIds)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // IDOR-scoped lookup: a report id from another hub must 404, never 403.
  const report = await db.hubReport.findFirst({ where: { id: reportId, hubId: id } })
  if (!report) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await request.json().catch(() => ({}))
  const status = body?.status
  if (!(RESOLVABLE_STATUSES as readonly string[]).includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }

  const updated = await db.hubReport.update({
    where: { id: report.id },
    data: {
      status,
      resolvedAt: status === 'open' ? null : new Date(),
      resolvedById: status === 'open' ? null : me.id,
    },
  })

  return NextResponse.json({ id: updated.id, status: updated.status })
}
