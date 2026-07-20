import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'
import { canParticipate, canModerate, isUserBanned } from '@/lib/community'
import { rateLimit } from '@/lib/rate-limit'
import { notifyHubMembers } from '@/lib/notifications'
import { validateReportInput } from '@/lib/hub-reports'

async function collaboratorIds(hubId: string): Promise<string[]> {
  const rows = await db.hubCollaborator.findMany({ where: { hubId }, select: { userId: true } })
  return rows.map((r) => r.userId)
}

// The target must exist and belong to this hub. A miss here is 404, never
// 403 — this endpoint must not become an enumeration oracle for hidden or
// deleted content by leaking whether an id exists elsewhere.
async function targetExists(hubId: string, targetType: string, targetId: string): Promise<boolean> {
  switch (targetType) {
    case 'post':
      return !!(await db.hubPost.findFirst({ where: { id: targetId, hubId }, select: { id: true } }))
    case 'comment':
      return !!(await db.hubPostComment.findFirst({ where: { id: targetId, post: { hubId } }, select: { id: true } }))
    case 'drop':
      return !!(await db.hubDrop.findFirst({ where: { id: targetId, hubId }, select: { id: true } }))
    case 'member':
      return !!(await db.hubMember.findFirst({ where: { userId: targetId, hubId }, select: { id: true } }))
    default:
      return false
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const limited = await rateLimit(request, { limit: 10, windowMs: 60_000, prefix: 'hub-report-create' })
  if (limited) return limited
  const me = await getUser(request)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const hub = await db.hub.findUnique({
    where: { id },
    select: { id: true, userId: true, community: true, title: true, slug: true, user: { select: { username: true } } },
  })
  if (!hub || !hub.community) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const collabIds = await collaboratorIds(id)
  const isMember = !!(await db.hubMember.findUnique({ where: { hubId_userId: { hubId: id, userId: me.id } }, select: { id: true } }))
  const isBanned = await isUserBanned(id, me.id)
  if (!canParticipate(me.id, hub, collabIds, isMember, isBanned)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const parsed = validateReportInput(await request.json().catch(() => ({})))
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
  const v = parsed.value

  const exists = await targetExists(id, v.targetType, v.targetId)
  if (!exists) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  let report
  try {
    report = await db.hubReport.create({
      data: {
        hubId: id,
        reporterId: me.id,
        targetType: v.targetType,
        targetId: v.targetId,
        reason: v.reason,
        note: v.note,
      },
    })
  } catch (e: any) {
    // Duplicate report (same reporter, same target) is a no-op — never
    // reveal that this or any other user has already reported this target.
    if (e?.code === 'P2002') return NextResponse.json({ ok: true }, { status: 200 })
    throw e
  }

  const targets = [...new Set([hub.userId, ...collabIds])].filter((uid) => uid !== me.id)
  await notifyHubMembers(targets, {
    type: 'hub_report',
    actor: { id: me.id, name: me.name || me.username, avatar: me.avatar },
    entityUrl: `/${hub.user.username}/hub/${hub.slug}`,
    contextText: hub.title,
  })

  return NextResponse.json({ id: report.id }, { status: 201 })
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const hub = await db.hub.findUnique({ where: { id }, select: { id: true, userId: true, community: true } })
  if (!hub || !hub.community) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const me = await getUser(request)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const collabIds = await collaboratorIds(id)
  if (!canModerate(me.id, hub, collabIds)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const rows = await db.hubReport.findMany({
    where: { hubId: id, status: 'open' },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json({
    reports: rows.map((r: any) => ({
      id: r.id,
      targetType: r.targetType,
      targetId: r.targetId,
      reason: r.reason,
      note: r.note,
      status: r.status,
      createdAt: r.createdAt,
      resolvedAt: r.resolvedAt,
      resolvedById: r.resolvedById,
    })),
  })
}
