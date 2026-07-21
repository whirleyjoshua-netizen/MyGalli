import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'
import { parseScope, scopeKeyFor } from '@/lib/acknowledgment'

interface Props {
  params: Promise<{ elementId: string }>
}

export async function POST(request: NextRequest, { params }: Props) {
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

    // RESET GATE — the single place that decides who may supersede a round.
    // The design gates this behind Pro; that is deferred by decision, so for
    // now ownership alone is enough. To gate: import { isPro } from '@/lib/plan'
    // and change this to `user.id !== ownerId || !isPro(user)`.
    if (user.id !== ownerId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const scopeKey = scopeKeyFor(elementId, scope)
    const existing = await db.acknowledgmentRound.findUnique({ where: { scopeKey } })
    const next = (existing?.round ?? 0) + 1

    // Prior rounds are deliberately left in place: a reset supersedes the old
    // receipts rather than erasing them, which is what makes the record an
    // audit trail.
    await db.acknowledgmentRound.upsert({
      where: { scopeKey },
      create: { scopeKey, round: next },
      update: { round: next },
    })

    return NextResponse.json({ ok: true, round: next })
  } catch (error) {
    console.error('POST /api/acknowledgments/[elementId]/reset error:', error)
    return NextResponse.json({ error: 'Failed to reset acknowledgments' }, { status: 500 })
  }
}
