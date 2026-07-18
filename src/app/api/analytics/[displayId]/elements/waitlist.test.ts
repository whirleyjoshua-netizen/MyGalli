import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({ getUser: vi.fn() }))
vi.mock('@/lib/db', () => ({
  db: {
    display: { findUnique: vi.fn() },
    formResponse: { findMany: vi.fn().mockResolvedValue([]) },
    comment: { findMany: vi.fn().mockResolvedValue([]) },
    waitlistSignup: { findMany: vi.fn() },
  },
}))

import { getUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { GET } from './route'

const WAITLIST_EL = { id: 'w1', type: 'waitlist', waitlistTitle: 'Beta', waitlistCapacity: 500 }
const ctx = { params: Promise.resolve({ displayId: 'd1' }) }
const req = () => new Request('http://localhost/api/analytics/d1/elements') as any

beforeEach(() => {
  vi.clearAllMocks()
  ;(db.display.findUnique as any).mockResolvedValue({
    id: 'd1', userId: 'owner',
    sections: [{ columns: [{ elements: [WAITLIST_EL] }] }],
    tabs: null,
  })
  ;(db.waitlistSignup.findMany as any).mockResolvedValue([
    { elementId: 'w1', email: 'a@b.com', name: 'A', createdAt: new Date('2026-01-01T00:00:00Z') },
    { elementId: 'w1', email: 'c@d.com', name: null, createdAt: new Date('2026-01-02T00:00:00Z') },
  ])
})

describe('GET analytics elements — waitlist', () => {
  it('returns the waitlist with its signups for the owner', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'owner' })
    const res = await GET(req(), ctx)
    const body = await res.json()
    const wl = body.elements.find((e: any) => e.type === 'waitlist')
    expect(wl).toBeTruthy()
    expect(wl.count).toBe(2)
    expect(wl.capacity).toBe(500)
    expect(wl.signups.map((s: any) => s.email)).toEqual(['a@b.com', 'c@d.com'])
  })

  it('403s a non-owner (no signups leak)', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'someone-else' })
    const res = await GET(req(), ctx)
    expect(res.status).toBe(403)
  })
})
