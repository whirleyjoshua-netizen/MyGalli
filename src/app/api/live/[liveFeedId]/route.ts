import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'
import { rateLimit } from '@/lib/rate-limit'
import { applyLiveAction, IDLE_STATE, type LiveAction, type LiveFeedState, type ValueEntry, type LiveClock } from '@/lib/live-feed'

type Params = { params: Promise<{ liveFeedId: string }> }

type Row = {
  isLive: boolean; values: unknown; startedAt: Date | null; lastUpdatedAt: Date
  clockMode: string; clockRunning: boolean; clockElapsedMs: number; clockLastStartedAt: Date | null; clockDurationMs: number | null
}

function rowToState(row: Row): LiveFeedState {
  return {
    isLive: row.isLive,
    values: Array.isArray(row.values) ? (row.values as ValueEntry[]) : [],
    startedAt: row.startedAt ? row.startedAt.toISOString() : null,
    clock: {
      mode: (row.clockMode as LiveClock['mode']) ?? 'off',
      running: row.clockRunning,
      elapsedMs: row.clockElapsedMs,
      lastStartedAt: row.clockLastStartedAt ? row.clockLastStartedAt.toISOString() : null,
      durationMs: row.clockDurationMs,
    },
  }
}

function serialize(state: LiveFeedState, lastUpdatedAt: Date | null) {
  return {
    isLive: state.isLive,
    values: state.values,
    startedAt: state.startedAt,
    clock: state.clock,
    serverTime: new Date().toISOString(),
    lastUpdatedAt: lastUpdatedAt ? lastUpdatedAt.toISOString() : null,
  }
}

function stateToData(state: LiveFeedState) {
  return {
    isLive: state.isLive,
    values: state.values as unknown as object,
    startedAt: state.startedAt ? new Date(state.startedAt) : null,
    clockMode: state.clock.mode,
    clockRunning: state.clock.running,
    clockElapsedMs: state.clock.elapsedMs,
    clockLastStartedAt: state.clock.lastStartedAt ? new Date(state.clock.lastStartedAt) : null,
    clockDurationMs: state.clock.durationMs,
  }
}

export async function GET(request: NextRequest, { params }: Params) {
  const { liveFeedId } = await params
  const limited = await rateLimit(request, { limit: 600, windowMs: 60_000, prefix: `live-read:${liveFeedId}` })
  if (limited) return limited
  const row = (await db.liveFeed.findUnique({ where: { id: liveFeedId } })) as Row | null
  const body = row ? serialize(rowToState(row), row.lastUpdatedAt) : serialize(IDLE_STATE, null)
  return NextResponse.json(body, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(request: NextRequest, { params }: Params) {
  const limited = await rateLimit(request, { limit: 240, windowMs: 60_000, prefix: 'live-write' })
  if (limited) return limited
  const { liveFeedId } = await params
  const user = await getUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const row = await db.liveFeed.findUnique({ where: { id: liveFeedId }, include: { display: { select: { userId: true } } } })
  if (!row) return NextResponse.json({ error: 'Not found — save your page first' }, { status: 404 })
  if (row.display.userId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let action: LiveAction
  try { action = (await request.json()) as LiveAction } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }
  // Server mints ids so a client can never dictate a value entry's id.
  if (action.action === 'addValue') action = { ...action, id: randomUUID().slice(0, 8) }

  const next = applyLiveAction(rowToState(row as unknown as Row), action, new Date().toISOString())
  const updated = await db.liveFeed.update({ where: { id: liveFeedId }, data: stateToData(next) })
  return NextResponse.json(serialize(next, updated.lastUpdatedAt))
}
