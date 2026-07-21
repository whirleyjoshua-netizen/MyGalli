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
})
