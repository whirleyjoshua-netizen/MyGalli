import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({ getUser: vi.fn() }))
vi.mock('@/lib/db', () => ({
  db: {
    display: { findUnique: vi.fn() },
    waitlistSignup: { findMany: vi.fn() },
  },
}))

import { getUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { GET } from './route'

const ctx = { params: Promise.resolve({ displayId: 'd1', elementId: 'w1' }) }
const req = () => new Request('http://localhost/api/waitlist/d1/w1/export') as any

beforeEach(() => {
  vi.clearAllMocks()
  ;(db.display.findUnique as any).mockResolvedValue({ id: 'd1', userId: 'owner' })
})

describe('GET /api/waitlist/[displayId]/[elementId]/export', () => {
  it('403s a non-owner (no signups leak)', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'someone-else' })
    const res = await GET(req(), ctx)
    expect(res.status).toBe(403)
    expect(db.waitlistSignup.findMany).not.toHaveBeenCalled()
  })

  it('403s when there is no authenticated user', async () => {
    ;(getUser as any).mockResolvedValue(null)
    const res = await GET(req(), ctx)
    expect(res.status).toBe(403)
  })

  it('404s when the display does not exist', async () => {
    ;(db.display.findUnique as any).mockResolvedValue(null)
    ;(getUser as any).mockResolvedValue({ id: 'owner' })
    const res = await GET(req(), ctx)
    expect(res.status).toBe(404)
  })

  it('returns a CSV attachment for the owner, escaping commas/quotes in names', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'owner' })
    ;(db.waitlistSignup.findMany as any).mockResolvedValue([
      { email: 'a@b.com', name: 'Alice', createdAt: new Date('2026-01-01T00:00:00Z') },
      { email: 'c@d.com', name: 'Bob, "The Builder"', createdAt: new Date('2026-01-02T00:00:00Z') },
      { email: 'e@f.com', name: null, createdAt: new Date('2026-01-03T00:00:00Z') },
    ])

    const res = await GET(req(), ctx)
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toContain('text/csv')
    expect(res.headers.get('Content-Disposition')).toContain('attachment')
    expect(res.headers.get('Content-Disposition')).toContain('.csv')

    const text = await res.text()
    const lines = text.trim().split('\n')
    expect(lines[0]).toBe('email,name,joinedAt')
    expect(lines[1]).toBe('a@b.com,Alice,2026-01-01T00:00:00.000Z')
    expect(lines[2]).toBe('c@d.com,"Bob, ""The Builder""",2026-01-02T00:00:00.000Z')
    expect(lines[3]).toBe('e@f.com,,2026-01-03T00:00:00.000Z')

    expect(db.waitlistSignup.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { displayId: 'd1', elementId: 'w1' } }),
    )
  })
})
