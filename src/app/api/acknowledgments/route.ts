import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'
import { rateLimit } from '@/lib/rate-limit'
import { parseScope, scopeKeyFor } from '@/lib/acknowledgment'

export async function POST(request: NextRequest) {
  try {
    const user = await getUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const limited = await rateLimit(request, {
      limit: 30,
      windowMs: 60_000,
      prefix: 'ack',
      identifier: user.id,
    })
    if (limited) return limited

    const body = await request.json().catch(() => ({}))
    const elementId = typeof body.elementId === 'string' && body.elementId ? body.elementId : null
    const scope = parseScope(body)
    if (!elementId || !scope) {
      return NextResponse.json(
        { error: 'elementId and exactly one of displayId/hubPostId are required' },
        { status: 400 }
      )
    }

    const scopeKey = scopeKeyFor(elementId, scope)
    const roundRow = await db.acknowledgmentRound.findUnique({ where: { scopeKey } })
    const round = roundRow?.round ?? 0

    try {
      await db.acknowledgment.create({
        data: {
          scopeKey,
          elementId,
          displayId: 'displayId' in scope ? scope.displayId : null,
          hubPostId: 'hubPostId' in scope ? scope.hubPostId : null,
          userId: user.id,
          round,
        },
      })
    } catch (error) {
      // Already acknowledged this round — the unique constraint makes the
      // endpoint idempotent, so a repeat submit is a success, not an error.
      if ((error as { code?: string }).code === 'P2002') {
        return NextResponse.json({ ok: true })
      }
      throw error
    }

    return NextResponse.json({ ok: true }, { status: 201 })
  } catch (error) {
    console.error('POST /api/acknowledgments error:', error)
    return NextResponse.json({ error: 'Failed to record acknowledgment' }, { status: 500 })
  }
}
