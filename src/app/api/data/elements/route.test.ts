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
    analyticsEvent: { findMany: vi.fn().mockResolvedValue([]) },
  },
}))

import { GET } from './route'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'

const req = () => new NextRequest('http://localhost/api/data/elements')

const display = (over: Record<string, unknown> = {}) => ({
  id: 'd1',
  title: 'Homepage',
  slug: 'homepage',
  published: true,
  sections: [{ id: 's1', layout: 'single', columns: [{ id: 'c1', elements: [{ id: 'e1', type: 'poll', pollQuestion: 'Best player?' }] }] }],
  tabs: null,
  ...over,
})

beforeEach(() => vi.clearAllMocks())

describe('GET /api/data/elements', () => {
  it('401s when unauthenticated', async () => {
    ;(getUser as any).mockResolvedValue(null)
    expect((await GET(req())).status).toBe(401)
  })

  it('only ever reads displays owned by the caller', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'me' })
    await GET(req())
    expect(db.display.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ userId: 'me' }) })
    )
  })

  it('returns one summary per data-collecting element', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'me' })
    ;(db.display.findMany as any).mockResolvedValue([display()])
    const body = await (await GET(req())).json()
    expect(body.elements).toHaveLength(1)
    expect(body.elements[0]).toMatchObject({
      key: 'd1:e1',
      type: 'poll',
      title: 'Best player?',
      pageTitle: 'Homepage',
      source: 'page',
      published: true,
    })
  })

  it('counts responses per element from FormResponse payloads', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'me' })
    ;(db.display.findMany as any).mockResolvedValue([display()])
    ;(db.formResponse.findMany as any).mockResolvedValue([
      { displayId: 'd1', responses: { e1: { type: 'poll', answer: 'A' } }, submittedAt: new Date('2026-07-20T10:00:00Z') },
      { displayId: 'd1', responses: { e1: { type: 'poll', answer: 'B' } }, submittedAt: new Date('2026-07-19T10:00:00Z') },
      { displayId: 'd1', responses: { other: { type: 'poll', answer: 'B' } }, submittedAt: new Date('2026-07-19T10:00:00Z') },
    ])
    const body = await (await GET(req())).json()
    expect(body.elements[0].responseCount).toBe(2)
    expect(body.elements[0].lastResponseAt).toBe('2026-07-20T10:00:00.000Z')
  })

  it('reports totals across all elements', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'me' })
    ;(db.display.findMany as any).mockResolvedValue([display()])
    ;(db.formResponse.findMany as any).mockResolvedValue([
      { displayId: 'd1', responses: { e1: { type: 'poll', answer: 'A' } }, submittedAt: new Date() },
    ])
    const body = await (await GET(req())).json()
    expect(body.totals).toMatchObject({ elements: 1, responses: 1 })
    expect(body.totals).not.toHaveProperty('needsAttention')
  })

  it('leaves engagement null when the page is below the viewer floor', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'me' })
    ;(db.display.findMany as any).mockResolvedValue([display()])
    const body = await (await GET(req())).json()
    expect(body.elements[0].engagement).toBeNull()
  })

  it('caps the number of displays it will parse and flags truncation', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'me' })
    ;(db.display.findMany as any).mockResolvedValue(
      Array.from({ length: 201 }, (_, i) => display({ id: `d${i}` }))
    )
    const body = await (await GET(req())).json()
    expect(body.truncated).toBe(true)
    expect(body.elements).toHaveLength(200)
  })
})
