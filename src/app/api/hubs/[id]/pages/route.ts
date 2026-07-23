import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'
import { canModerate, canViewCommunityHub } from '@/lib/community'
import { rateLimit } from '@/lib/rate-limit'
import { toHubPageDTO, visibleHubPageWhere, HUB_PAGE_DISPLAY_SELECT, HUB_PAGE_ORDER_BY } from '@/lib/hub-pages'

async function collaboratorIds(hubId: string): Promise<string[]> {
  const rows = await db.hubCollaborator.findMany({ where: { hubId }, select: { userId: true } })
  return rows.map((r) => r.userId)
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const hub = await db.hub.findUnique({ where: { id }, select: { id: true, userId: true, community: true, published: true } })
  if (!hub || !hub.community) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const me = await getUser(request)
  const collabIds = me ? await collaboratorIds(id) : []
  const isPrivileged = !!me && canModerate(me.id, hub, collabIds)
  if (!canViewCommunityHub({ published: hub.published, isPrivileged })) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const rows = await db.hubPage.findMany({
    where: visibleHubPageWhere({ hubId: id, viewerId: me?.id ?? null, isPrivileged }),
    orderBy: HUB_PAGE_ORDER_BY,
    include: HUB_PAGE_DISPLAY_SELECT,
  })
  return NextResponse.json({ pages: rows.map(toHubPageDTO) })
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const limited = await rateLimit(request, { limit: 20, windowMs: 60_000, prefix: 'hub-page' })
  if (limited) return limited

  const me = await getUser(request)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const hub = await db.hub.findUnique({ where: { id }, select: { id: true, userId: true, community: true, published: true } })
  if (!hub || !hub.community) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const collabIds = await collaboratorIds(id)
  const isPrivileged = canModerate(me.id, hub, collabIds)
  if (!isPrivileged) {
    const member = await db.hubMember.findUnique({ where: { hubId_userId: { hubId: id, userId: me.id } }, select: { id: true } })
    if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json().catch(() => ({}))
  const displayId = typeof body?.displayId === 'string' ? body.displayId : ''
  if (!displayId) return NextResponse.json({ error: 'displayId is required' }, { status: 400 })

  // Existence and ownership are one check on purpose: a caller must not be able
  // to probe for the existence of Pages that are not theirs.
  const display = await db.display.findUnique({ where: { id: displayId }, select: { id: true, userId: true, published: true, kind: true } })
  if (!display || display.userId !== me.id) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (display.kind === 'collection') return NextResponse.json({ error: 'Boards cannot be attached' }, { status: 422 })
  if (!display.published) return NextResponse.json({ error: 'Publish this Page first' }, { status: 422 })

  try {
    const created = await db.hubPage.create({
      data: {
        hubId: id,
        displayId,
        addedById: me.id,
        status: isPrivileged ? 'approved' : 'pending',
        ...(isPrivileged ? { reviewedAt: new Date(), reviewedById: me.id } : {}),
      },
    })
    return NextResponse.json({ id: created.id, status: isPrivileged ? 'approved' : 'pending' }, { status: 201 })
  } catch (e: unknown) {
    // Let the unique constraint decide rather than check-then-insert, which races.
    if ((e as { code?: string })?.code === 'P2002') {
      return NextResponse.json({ error: 'Already attached' }, { status: 409 })
    }
    throw e
  }
}
