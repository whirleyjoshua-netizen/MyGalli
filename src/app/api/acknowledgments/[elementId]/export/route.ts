import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'
import { parseScope, scopeKeyFor, buildRoster, rosterCsv } from '@/lib/acknowledgment'

interface Props {
  params: Promise<{ elementId: string }>
}

export async function GET(request: NextRequest, { params }: Props) {
  try {
    const { elementId } = await params
    const url = new URL(request.url)
    const scope = parseScope({
      displayId: url.searchParams.get('displayId') ?? undefined,
      hubPostId: url.searchParams.get('hubPostId') ?? undefined,
    })
    if (!scope) {
      return NextResponse.json({ error: 'Exactly one of displayId/hubPostId is required' }, { status: 400 })
    }

    const user = await getUser(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    let ownerId: string | null = null
    if ('displayId' in scope) {
      const display = await db.display.findUnique({ where: { id: scope.displayId }, select: { userId: true } })
      if (!display) return NextResponse.json({ error: 'Not found' }, { status: 404 })
      ownerId = display.userId
    } else {
      const post = await db.hubPost.findUnique({
        where: { id: scope.hubPostId },
        select: { hub: { select: { userId: true } } },
      })
      if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 })
      ownerId = post.hub.userId
    }

    // EXPORT GATE — the single place that decides who may download names.
    // The design gates this behind Pro; that is deferred by decision, so for
    // now ownership alone is enough. To gate: import { isPro } from '@/lib/plan'
    // and change this to `user.id !== ownerId || !isPro(user)`.
    if (user.id !== ownerId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const scopeKey = scopeKeyFor(elementId, scope)
    const roundRow = await db.acknowledgmentRound.findUnique({ where: { scopeKey } })
    const round = roundRow?.round ?? 0

    const records = await db.acknowledgment.findMany({
      where: { scopeKey, round },
      select: {
        userId: true,
        round: true,
        createdAt: true,
        user: { select: { name: true, username: true } },
      },
    })

    return new NextResponse(rosterCsv(buildRoster(records, round)), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="acknowledgments-${elementId}.csv"`,
      },
    })
  } catch (error) {
    console.error('GET /api/acknowledgments/[elementId]/export error:', error)
    return NextResponse.json({ error: 'Failed to export acknowledgments' }, { status: 500 })
  }
}
