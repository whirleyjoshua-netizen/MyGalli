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

describe('GET /api/data/elements — all stores', () => {
  const waitlistDisplay = () =>
    display({
      sections: [{ id: 's1', layout: 'single', columns: [{ id: 'c1', elements: [
        { id: 'w1', type: 'waitlist', waitlistTitle: 'Beta list' },
        { id: 'm1', type: 'mailbox', mailboxTitle: 'Say hi' },
      ] }] }],
    })

  it('counts waitlist signups per element', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'me' })
    ;(db.display.findMany as any).mockResolvedValue([waitlistDisplay()])
    ;(db.waitlistSignup.groupBy as any).mockResolvedValue([
      { displayId: 'd1', elementId: 'w1', _count: { _all: 12 }, _max: { createdAt: new Date('2026-07-20T09:00:00Z') } },
    ])
    const body = await (await GET(req())).json()
    const w = body.elements.find((e: any) => e.key === 'd1:w1')
    expect(w.responseCount).toBe(12)
    expect(w.lastResponseAt).toBe('2026-07-20T09:00:00.000Z')
  })

  it('reports unread mailbox messages so the client can flag attention', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'me' })
    ;(db.display.findMany as any).mockResolvedValue([waitlistDisplay()])
    ;(db.message.groupBy as any).mockImplementation(({ where }: any) =>
      Promise.resolve(
        where?.read === false
          ? [{ displayId: 'd1', elementId: 'm1', _count: { _all: 4 }, _max: { createdAt: new Date('2026-07-20T08:00:00Z') } }]
          : [{ displayId: 'd1', elementId: 'm1', _count: { _all: 9 }, _max: { createdAt: new Date('2026-07-20T08:00:00Z') } }]
      )
    )
    const body = await (await GET(req())).json()
    const m = body.elements.find((e: any) => e.key === 'd1:m1')
    expect(m.responseCount).toBe(9)
    expect(m.unreadCount).toBe(4)
  })

  it('scopes mailbox reads to the owner', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'me' })
    ;(db.display.findMany as any).mockResolvedValue([waitlistDisplay()])
    await GET(req())
    expect(db.message.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ ownerId: 'me' }) })
    )
  })

  it('computes engagement from unique visitors, not event counts', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'me' })
    ;(db.display.findMany as any).mockResolvedValue([display()])
    // 25 distinct viewers of d1; one of them fires 40 interact events on e1.
    const views = Array.from({ length: 25 }, (_, i) => ({
      displayId: 'd1', eventType: 'view', visitorId: `v${i}`, sessionId: null, metadata: null,
    }))
    const interacts = Array.from({ length: 40 }, () => ({
      displayId: 'd1', eventType: 'interact', visitorId: 'v0', sessionId: null, metadata: { elementId: 'e1' },
    }))
    ;(db.analyticsEvent.findMany as any).mockResolvedValue([...views, ...interacts])
    const body = await (await GET(req())).json()
    // 1 responder / 25 viewers = 4%, NOT 160%
    expect(body.elements[0].engagement).toBe(4)
  })

  it('falls back to sessionId when visitorId is null on legacy events', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'me' })
    ;(db.display.findMany as any).mockResolvedValue([display()])
    ;(db.analyticsEvent.findMany as any).mockResolvedValue([
      ...Array.from({ length: 20 }, (_, i) => ({ displayId: 'd1', eventType: 'view', visitorId: null, sessionId: `s${i}`, metadata: null })),
      { displayId: 'd1', eventType: 'interact', visitorId: null, sessionId: 's0', metadata: { elementId: 'e1' } },
    ])
    const body = await (await GET(req())).json()
    expect(body.elements[0].engagement).toBe(5)
  })

  it('attributes page-scoped comment rows to the first comment element on that page', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'me' })
    ;(db.display.findMany as any).mockResolvedValue([
      display({
        sections: [{ id: 's1', layout: 'single', columns: [{ id: 'c1', elements: [
          { id: 'cm1', type: 'comment', commentTitle: 'Wall one' },
          { id: 'cm2', type: 'comment', commentTitle: 'Wall two' },
        ] }] }],
      }),
    ])
    // Comment has no elementId column — the count is per display.
    ;(db.comment.groupBy as any).mockResolvedValue([
      { displayId: 'd1', _count: { _all: 7 }, _max: { createdAt: new Date('2026-07-20T07:00:00Z') } },
    ])
    const body = await (await GET(req())).json()
    expect(body.elements.find((e: any) => e.key === 'd1:cm1').responseCount).toBe(7)
    // Not double counted onto the second wall — they share one store.
    expect(body.elements.find((e: any) => e.key === 'd1:cm2').responseCount).toBe(0)
    expect(body.totals.responses).toBe(7)
  })

  it('groups comments by displayId only, never by elementId', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'me' })
    ;(db.display.findMany as any).mockResolvedValue([display()])
    await GET(req())
    expect(db.comment.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({ by: ['displayId'] })
    )
  })

  it('includes bulletin instruments keyed by post, tagged as bulletin source', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'me' })
    ;(db.bulletinPost.findMany as any).mockResolvedValue([
      {
        id: 'p1',
        createdAt: new Date('2026-07-12T00:00:00Z'),
        blocks: [{ id: 'b1', type: 'poll', pollQuestion: 'Best practice time?' }],
        responses: [{ createdAt: new Date('2026-07-20T12:00:00Z'), responses: { b1: { type: 'poll', answer: 'AM' } } }],
      },
    ])
    const body = await (await GET(req())).json()
    const b = body.elements.find((e: any) => e.key === 'bulletin:p1:b1')
    expect(b).toMatchObject({ source: 'bulletin', type: 'poll', title: 'Best practice time?', published: true, responseCount: 1 })
    expect(b.engagement).toBeNull()
  })

  it('counts only today\'s signups as today, not the whole aggregate', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'me' })
    ;(db.display.findMany as any).mockResolvedValue([waitlistDisplay()])
    ;(db.waitlistSignup.groupBy as any).mockImplementation(({ where }: any) =>
      Promise.resolve(
        where?.createdAt
          ? [{ displayId: 'd1', elementId: 'w1', _count: { _all: 1 } }]
          : [{ displayId: 'd1', elementId: 'w1', _count: { _all: 12 }, _max: { createdAt: new Date() } }]
      )
    )
    const body = await (await GET(req())).json()
    const w = body.elements.find((e: any) => e.key === 'd1:w1')
    expect(w.responseCount).toBe(12)
    expect(w.todayCount).toBe(1)
  })

  it('reports zero today when the aggregated store has no rows from today', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'me' })
    ;(db.display.findMany as any).mockResolvedValue([waitlistDisplay()])
    ;(db.waitlistSignup.groupBy as any).mockImplementation(({ where }: any) =>
      Promise.resolve(
        where?.createdAt
          ? []
          : [{ displayId: 'd1', elementId: 'w1', _count: { _all: 12 }, _max: { createdAt: new Date() } }]
      )
    )
    const body = await (await GET(req())).json()
    expect(body.elements.find((e: any) => e.key === 'd1:w1').todayCount).toBe(0)
  })

  it('only reads bulletin posts authored by the caller', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'me' })
    await GET(req())
    // BulletinPost's owner column is authorId, NOT userId.
    expect(db.bulletinPost.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ authorId: 'me' }) })
    )
  })
})
