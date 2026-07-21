import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', () => ({ getUser: vi.fn() }))
vi.mock('@/lib/db', () => ({
  db: {
    display: { findMany: vi.fn().mockResolvedValue([]) },
    formResponse: { findMany: vi.fn().mockResolvedValue([]) },
    comment: { groupBy: vi.fn().mockResolvedValue([]) },
    message: { groupBy: vi.fn().mockResolvedValue([]) },
    waitlistSignup: { groupBy: vi.fn().mockResolvedValue([]) },
    booking: { groupBy: vi.fn().mockResolvedValue([]) },
    jerseySignature: { groupBy: vi.fn().mockResolvedValue([]) },
    bulletinPost: { findMany: vi.fn().mockResolvedValue([]) },
  },
}))

import { GET } from './route'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'

const req = () => new NextRequest('http://localhost/api/data/elements/pulse')
beforeEach(() => vi.clearAllMocks())

describe('GET /api/data/elements/pulse', () => {
  it('401s when unauthenticated', async () => {
    ;(getUser as any).mockResolvedValue(null)
    expect((await GET(req())).status).toBe(401)
  })

  it('returns only key, lastResponseAt, todayCount and live', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'me' })
    ;(db.display.findMany as any).mockResolvedValue([{ id: 'd1', published: true }])
    ;(db.waitlistSignup.groupBy as any).mockResolvedValue([
      { displayId: 'd1', elementId: 'w1', _count: { _all: 3 }, _max: { createdAt: new Date() } },
    ])
    const body = await (await GET(req())).json()
    expect(Object.keys(body)).toEqual(['pulse'])
    expect(Object.keys(body.pulse[0]).sort()).toEqual(['key', 'lastResponseAt', 'live', 'todayCount'])
  })

  it('does not read page sections — it never needs element metadata', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'me' })
    await GET(req())
    const select = (db.display.findMany as any).mock.calls[0][0].select
    expect(select).not.toHaveProperty('sections')
    expect(select).not.toHaveProperty('tabs')
  })

  it('marks an element live when its latest response is inside 24h on a published page', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'me' })
    ;(db.display.findMany as any).mockResolvedValue([{ id: 'd1', published: true }])
    ;(db.waitlistSignup.groupBy as any).mockResolvedValue([
      { displayId: 'd1', elementId: 'w1', _count: { _all: 1 }, _max: { createdAt: new Date() } },
    ])
    const body = await (await GET(req())).json()
    expect(body.pulse[0].live).toBe(true)
  })

  it('is not live when the page is unpublished', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'me' })
    ;(db.display.findMany as any).mockResolvedValue([{ id: 'd1', published: false }])
    ;(db.waitlistSignup.groupBy as any).mockResolvedValue([
      { displayId: 'd1', elementId: 'w1', _count: { _all: 1 }, _max: { createdAt: new Date() } },
    ])
    const body = await (await GET(req())).json()
    expect(body.pulse[0].live).toBe(false)
  })

  it('takes today\'s count from the today-scoped query, never from the aggregate max', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'me' })
    ;(db.display.findMany as any).mockResolvedValue([{ id: 'd1', published: true }])
    // 40 signups all time, newest today; only 2 of them actually arrived today.
    ;(db.waitlistSignup.groupBy as any).mockImplementation(({ where }: any) =>
      Promise.resolve(
        where?.createdAt
          ? [{ displayId: 'd1', elementId: 'w1', _count: { _all: 2 } }]
          : [{ displayId: 'd1', elementId: 'w1', _count: { _all: 40 }, _max: { createdAt: new Date() } }]
      )
    )
    const body = await (await GET(req())).json()
    expect(body.pulse.find((p: any) => p.key === 'd1:w1').todayCount).toBe(2)
  })

  it('scopes mailbox reads to the owner', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'me' })
    ;(db.display.findMany as any).mockResolvedValue([{ id: 'd1', published: true }])
    await GET(req())
    expect(db.message.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ ownerId: 'me' }) })
    )
  })

  it('scopes bulletin reads by authorId and keys instruments by post', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'me' })
    ;(db.bulletinPost.findMany as any).mockResolvedValue([
      { id: 'p1', responses: [{ createdAt: new Date(), responses: { b1: { type: 'poll', answer: 'A' } } }] },
    ])
    const body = await (await GET(req())).json()
    expect(db.bulletinPost.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ authorId: 'me' }) })
    )
    expect(body.pulse.find((p: any) => p.key === 'bulletin:p1:b1')).toBeTruthy()
  })

  it('keeps a form element in the payload when its newest response is inside the live window but before midnight', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'me' })
    ;(db.display.findMany as any).mockResolvedValue([{ id: 'd1', published: true }])
    const twoHoursAgo = new Date(Date.now() - 2 * 3600 * 1000)
    ;(db.formResponse.findMany as any).mockResolvedValue([
      { displayId: 'd1', responses: { e1: { type: 'poll', answer: 'A' } }, submittedAt: twoHoursAgo },
    ])
    const body = await (await GET(req())).json()
    const p = body.pulse.find((x: any) => x.key === 'd1:e1')
    expect(p).toBeTruthy()
    expect(p.live).toBe(true)
  })

  it('queries form responses over the 24h live window, not just since midnight', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'me' })
    ;(db.display.findMany as any).mockResolvedValue([{ id: 'd1', published: true }])
    const startOfToday = new Date()
    startOfToday.setHours(0, 0, 0, 0)
    await GET(req())
    const arg = (db.formResponse.findMany as any).mock.calls[0][0]
    expect(arg.where.submittedAt.gte.getTime()).toBeLessThanOrEqual(Date.now() - 23 * 3600 * 1000)
    expect(arg.where.submittedAt.gte.getTime()).toBeLessThan(startOfToday.getTime() + 1)
  })
})
