import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'
import { parseScope, scopeKeyFor, ackStatus, buildRoster, reAckProgress } from '@/lib/acknowledgment'

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

    // Resolve the owner of the container so the roster can be gated.
    let ownerId: string | null = null
    if ('displayId' in scope) {
      const display = await db.display.findUnique({
        where: { id: scope.displayId },
        select: { userId: true },
      })
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

    const user = await getUser(request)
    const scopeKey = scopeKeyFor(elementId, scope)

    const roundRow = await db.acknowledgmentRound.findUnique({ where: { scopeKey } })
    const round = roundRow?.round ?? 0

    const records = await db.acknowledgment.findMany({
      where: { scopeKey },
      select: {
        userId: true,
        round: true,
        createdAt: true,
        user: { select: { name: true, username: true } },
      },
    })

    const isOwner = !!user && user.id === ownerId

    // ROSTER GATE — the single place that decides who sees names.
    // The design gates this behind Pro; that is deferred by decision, so for
    // now ownership alone is enough. To gate: import { isPro } from '@/lib/plan'
    // and change this to `isOwner && isPro(user)`.
    const canSeeRoster = isOwner

    return NextResponse.json({
      count: records.filter((r) => r.round === round).length,
      round,
      mine: ackStatus(records, round, user?.id ?? null),
      isOwner,
      canSeeRoster,
      roster: canSeeRoster ? buildRoster(records, round) : [],
      progress: reAckProgress(records, round),
    })
  } catch (error) {
    console.error('GET /api/acknowledgments/[elementId] error:', error)
    return NextResponse.json({ error: 'Failed to load acknowledgments' }, { status: 500 })
  }
}
