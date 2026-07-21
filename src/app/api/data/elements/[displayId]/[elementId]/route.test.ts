import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', () => ({ getUser: vi.fn() }))
vi.mock('@/lib/db', () => ({
  db: {
    display: { findUnique: vi.fn() },
    formResponse: { findMany: vi.fn().mockResolvedValue([]) },
  },
}))

import { GET } from './route'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'

const req = () => new NextRequest('http://localhost/api/data/elements/d1/e1')
const ctx = { params: Promise.resolve({ displayId: 'd1', elementId: 'e1' }) }

const display = {
  id: 'd1',
  userId: 'me',
  title: 'Homepage',
  sections: [{ id: 's1', layout: 'single', columns: [{ id: 'c1', elements: [{ id: 'e1', type: 'poll', pollQuestion: 'Best?' }] }] }],
  tabs: null,
}

beforeEach(() => vi.clearAllMocks())

describe('GET /api/data/elements/[displayId]/[elementId]', () => {
  it('401s when unauthenticated', async () => {
    ;(getUser as any).mockResolvedValue(null)
    expect((await GET(req(), ctx)).status).toBe(401)
  })

  it('404s for a display that does not exist', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'me' })
    ;(db.display.findUnique as any).mockResolvedValue(null)
    expect((await GET(req(), ctx)).status).toBe(404)
  })

  it('403s when the display belongs to someone else', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'me' })
    ;(db.display.findUnique as any).mockResolvedValue({ ...display, userId: 'someone-else' })
    expect((await GET(req(), ctx)).status).toBe(403)
  })

  it('404s when the element is not on that page', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'me' })
    ;(db.display.findUnique as any).mockResolvedValue(display)
    const res = await GET(req(), { params: Promise.resolve({ displayId: 'd1', elementId: 'nope' }) })
    expect(res.status).toBe(404)
  })

  it('returns the element, its responses and a daily series', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'me' })
    ;(db.display.findUnique as any).mockResolvedValue(display)
    ;(db.formResponse.findMany as any).mockResolvedValue([
      { responses: { e1: { type: 'poll', answer: 'A' } }, submittedAt: new Date('2026-07-20T10:00:00Z') },
      { responses: { e1: { type: 'poll', answer: 'B' } }, submittedAt: new Date('2026-07-20T11:00:00Z') },
      { responses: { other: { type: 'poll', answer: 'C' } }, submittedAt: new Date('2026-07-20T12:00:00Z') },
    ])
    const body = await (await GET(req(), ctx)).json()
    expect(body.element).toMatchObject({ elementId: 'e1', type: 'poll', title: 'Best?' })
    expect(body.responses).toHaveLength(2)
    expect(body.series.find((d: any) => d.date === '2026-07-20').count).toBe(2)
  })
})
