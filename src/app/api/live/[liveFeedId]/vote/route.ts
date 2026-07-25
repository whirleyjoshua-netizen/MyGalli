import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { rateLimit } from '@/lib/rate-limit'
import { applyLiveAction, type LiveFeedState, type ValueEntry, type LiveClock } from '@/lib/live-feed'

type Params = { params: Promise<{ liveFeedId: string }> }

// Structure-agnostic: find the element by id anywhere in the display JSON and
// return its liveFeedPreset / liveFeedPollReveal.
function findElementConfig(json: unknown, id: string): { preset?: string; pollReveal?: string } | null {
  let hit: { preset?: string; pollReveal?: string } | null = null
  const walk = (n: unknown) => {
    if (hit) return
    if (Array.isArray(n)) { n.forEach(walk); return }
    if (n && typeof n === 'object') {
      const o = n as Record<string, unknown>
      if (o.id === id && o.type === 'live-feed') { hit = { preset: o.liveFeedPreset as string, pollReveal: o.liveFeedPollReveal as string }; return }
      Object.values(o).forEach(walk)
    }
  }
  walk(json)
  return hit
}

function rowToState(row: any): LiveFeedState {
  return {
    isLive: row.isLive,
    values: Array.isArray(row.values) ? (row.values as ValueEntry[]) : [],
    startedAt: row.startedAt ? new Date(row.startedAt).toISOString() : null,
    clock: { mode: (row.clockMode as LiveClock['mode']) ?? 'off', running: row.clockRunning, elapsedMs: row.clockElapsedMs, lastStartedAt: row.clockLastStartedAt ? new Date(row.clockLastStartedAt).toISOString() : null, durationMs: row.clockDurationMs },
  }
}

export async function POST(request: NextRequest, { params }: Params) {
  const { liveFeedId } = await params
  const limited = await rateLimit(request, { limit: 30, windowMs: 60_000, prefix: 'live-vote' })
  if (limited) return limited

  let body: { optionId?: string; sessionId?: string }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }
  const optionId = typeof body.optionId === 'string' ? body.optionId : ''
  const voterKey = typeof body.sessionId === 'string' && body.sessionId ? body.sessionId : ''
  if (!optionId || !voterKey) return NextResponse.json({ error: 'optionId and sessionId required' }, { status: 400 })

  const row = await db.liveFeed.findUnique({ where: { id: liveFeedId } })
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Preset lookup: the test stubs `row.preset`; in production resolve from the display JSON.
  let preset = (row as any).preset as string | undefined
  if (!preset) {
    const display = await db.display.findUnique({ where: { id: row.displayId }, select: { sections: true, tabs: true, headerCard: true } })
    preset = findElementConfig(display?.sections, liveFeedId)?.preset
      ?? findElementConfig(display?.tabs, liveFeedId)?.preset
      ?? findElementConfig(display?.headerCard, liveFeedId)?.preset
  }
  if (preset !== 'poll' || !row.isLive) return NextResponse.json({ error: 'Voting is closed' }, { status: 409 })

  const state = rowToState(row)
  if (!state.values.some((v) => v.id === optionId)) return NextResponse.json({ error: 'Unknown option' }, { status: 400 })

  try {
    await db.liveFeedVote.create({ data: { liveFeedId, voterKey, optionId } })
  } catch (e: unknown) {
    if ((e as { code?: string })?.code === 'P2002') return NextResponse.json({ error: 'Already voted' }, { status: 409 })
    throw e
  }

  const next = applyLiveAction(state, { action: 'bump', id: optionId, delta: 1 }, new Date().toISOString())
  await db.liveFeed.update({
    where: { id: liveFeedId },
    data: {
      values: next.values as unknown as object,
      isLive: next.isLive, startedAt: next.startedAt ? new Date(next.startedAt) : null,
      clockMode: next.clock.mode, clockRunning: next.clock.running, clockElapsedMs: next.clock.elapsedMs,
      clockLastStartedAt: next.clock.lastStartedAt ? new Date(next.clock.lastStartedAt) : null, clockDurationMs: next.clock.durationMs,
    },
  })
  return NextResponse.json({ isLive: next.isLive, values: next.values, startedAt: next.startedAt, clock: next.clock, serverTime: new Date().toISOString() })
}
