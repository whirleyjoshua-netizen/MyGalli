import { it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/rate-limit', () => ({ rateLimit: vi.fn().mockResolvedValue(null) }))
vi.mock('@/lib/db', () => {
  // `db` is both the top-level client and the `tx` handed to $transaction's
  // callback (the route does `db.$transaction(async (tx) => ...)`), so the
  // mock transaction just invokes the callback with the same mocked object.
  const db: any = {
    liveFeed: { findUnique: vi.fn(), update: vi.fn() },
    liveFeedVote: { create: vi.fn() },
    display: { findUnique: vi.fn() },
  }
  db.$transaction = vi.fn(async (fn: (tx: unknown) => unknown) => fn(db))
  db.$executeRaw = vi.fn().mockResolvedValue(undefined)
  return { db }
})

import { POST } from './route'
import { db } from '@/lib/db'

const ctx = (id: string) => ({ params: Promise.resolve({ liveFeedId: id }) })
const req = (body: unknown) => new NextRequest('http://localhost/api/live/el-1/vote', { method: 'POST', body: JSON.stringify(body) })
// The feed row plus the element preset it resolves to (see the route: it looks up the element's preset via the display sections; the test stubs whatever lookup the route uses).
const pollRow = () => ({ id: 'el-1', displayId: 'd1', isLive: true, values: [{ id: 'opt1', label: 'Pizza', value: 0 }, { id: 'opt2', label: 'Tacos', value: 0 }], startedAt: null, lastUpdatedAt: new Date(), clockMode: 'off', clockRunning: false, clockElapsedMs: 0, clockLastStartedAt: null, clockDurationMs: null, preset: 'poll' })

beforeEach(() => vi.clearAllMocks())

it('404 when the feed does not exist', async () => {
  ;(db.liveFeed.findUnique as any).mockResolvedValue(null)
  expect((await POST(req({ optionId: 'opt1', sessionId: 's1' }), ctx('el-1'))).status).toBe(404)
})

it('409 when the feed is not a live poll', async () => {
  ;(db.liveFeed.findUnique as any).mockResolvedValue({ ...pollRow(), isLive: false })
  expect((await POST(req({ optionId: 'opt1', sessionId: 's1' }), ctx('el-1'))).status).toBe(409)
})

it('400 for an unknown optionId', async () => {
  ;(db.liveFeed.findUnique as any).mockResolvedValue(pollRow())
  expect((await POST(req({ optionId: 'nope', sessionId: 's1' }), ctx('el-1'))).status).toBe(400)
})

it('first vote 200 and bumps the option', async () => {
  ;(db.liveFeed.findUnique as any).mockResolvedValue(pollRow())
  ;(db.liveFeedVote.create as any).mockResolvedValue({ id: 'v1' })
  ;(db.liveFeed.update as any).mockResolvedValue({ lastUpdatedAt: new Date() })
  const res = await POST(req({ optionId: 'opt1', sessionId: 's1' }), ctx('el-1'))
  expect(res.status).toBe(200)
  const json = await res.json()
  expect(json.values.find((v: any) => v.id === 'opt1').value).toBe(1)
  expect((db.liveFeed.update as any).mock.calls[0][0].data.values.find((v: any) => v.id === 'opt1').value).toBe(1)
})

it('409 on a duplicate vote (unique violation)', async () => {
  ;(db.liveFeed.findUnique as any).mockResolvedValue(pollRow())
  ;(db.liveFeedVote.create as any).mockRejectedValue({ code: 'P2002' })
  expect((await POST(req({ optionId: 'opt1', sessionId: 's1' }), ctx('el-1'))).status).toBe(409)
  expect(db.liveFeed.update).not.toHaveBeenCalled()
})

// True concurrent-safety (two distinct voters racing on the same feed) is a
// Postgres property enforced by `FOR UPDATE` and can't be exercised against
// a mocked db in a unit test. This only documents that the lock statement is
// issued, inside the same transaction, before the tally is written.
it('takes a row lock on the feed before writing the tally', async () => {
  ;(db.liveFeed.findUnique as any).mockResolvedValue(pollRow())
  ;(db.liveFeedVote.create as any).mockResolvedValue({ id: 'v1' })
  ;(db.liveFeed.update as any).mockResolvedValue({ lastUpdatedAt: new Date() })
  const res = await POST(req({ optionId: 'opt1', sessionId: 's1' }), ctx('el-1'))
  expect(res.status).toBe(200)
  expect(db.$transaction).toHaveBeenCalledTimes(1)
  expect(db.$executeRaw).toHaveBeenCalledTimes(1)
  const lockOrder = (db.$executeRaw as any).mock.invocationCallOrder[0]
  const updateOrder = (db.liveFeed.update as any).mock.invocationCallOrder[0]
  expect(lockOrder).toBeLessThan(updateOrder)
})
