import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'
import { rateLimit } from '@/lib/rate-limit'
import { applyLiveAction, IDLE_STATE, type LiveAction, type LiveFeedState } from '@/lib/live-feed'

type Params = { params: Promise<{ liveFeedId: string }> }

function serialize(row: {
  isLive: boolean; valueA: number; valueB: number; startedAt: Date | null; lastUpdatedAt: Date
}) {
  return {
    isLive: row.isLive,
    valueA: row.valueA,
    valueB: row.valueB,
    startedAt: row.startedAt ? row.startedAt.toISOString() : null,
    lastUpdatedAt: row.lastUpdatedAt.toISOString(),
  }
}

// GET — public, numbers only, no caching so polling sees fresh values.
export async function GET(request: NextRequest, { params }: Params) {
  const { liveFeedId } = await params
  const limited = await rateLimit(request, { limit: 600, windowMs: 60_000, prefix: `live-read:${liveFeedId}` })
  if (limited) return limited

  const row = await db.liveFeed.findUnique({ where: { id: liveFeedId } })

  const body = row
    ? serialize(row)
    : { ...IDLE_STATE, lastUpdatedAt: null }

  return NextResponse.json(body, { headers: { 'Cache-Control': 'no-store' } })
}

// POST — owner-only. Row must already exist (created on page save).
export async function POST(request: NextRequest, { params }: Params) {
  const limited = await rateLimit(request, { limit: 240, windowMs: 60_000, prefix: 'live-write' })
  if (limited) return limited

  const { liveFeedId } = await params
  const user = await getUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const row = await db.liveFeed.findUnique({
    where: { id: liveFeedId },
    include: { display: { select: { userId: true } } },
  })
  if (!row) return NextResponse.json({ error: 'Not found — save your page first' }, { status: 404 })
  if (row.display.userId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let action: LiveAction
  try {
    action = (await request.json()) as LiveAction
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  const current: LiveFeedState = {
    isLive: row.isLive,
    valueA: row.valueA,
    valueB: row.valueB,
    startedAt: row.startedAt ? row.startedAt.toISOString() : null,
  }
  const next = applyLiveAction(current, action, new Date().toISOString())

  const updated = await db.liveFeed.update({
    where: { id: liveFeedId },
    data: {
      isLive: next.isLive,
      valueA: next.valueA,
      valueB: next.valueB,
      startedAt: next.startedAt ? new Date(next.startedAt) : null,
    },
  })

  return NextResponse.json(serialize(updated))
}
