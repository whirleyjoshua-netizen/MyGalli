import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/rate-limit', () => ({ rateLimit: vi.fn().mockResolvedValue(null) }))
vi.mock('@/lib/auth', () => ({ getUser: vi.fn().mockResolvedValue(null) }))
vi.mock('@/lib/db', () => ({
  db: {
    display: { findUnique: vi.fn() },
    waitlistSignup: { count: vi.fn(), create: vi.fn(), findUnique: vi.fn() },
  },
}))

import { getUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { POST } from './route'

const WAITLIST_EL = { id: 'w1', type: 'waitlist', waitlistCapacity: 2 }
const DISPLAY = {
  id: 'd1',
  published: true,
  sections: [{ columns: [{ elements: [WAITLIST_EL] }] }],
}
const req = (body: unknown) =>
  new Request('http://localhost/api/waitlist/join', { method: 'POST', body: JSON.stringify(body) }) as any

beforeEach(() => {
  vi.clearAllMocks()
  ;(db.display.findUnique as any).mockResolvedValue(DISPLAY)
  ;(db.waitlistSignup.findUnique as any).mockResolvedValue(null)
  ;(db.waitlistSignup.count as any).mockResolvedValue(0)
  ;(db.waitlistSignup.create as any).mockResolvedValue({ id: 's1' })
})

describe('POST /api/waitlist/join', () => {
  it('creates a signup and returns the new count', async () => {
    ;(db.waitlistSignup.count as any).mockResolvedValueOnce(0).mockResolvedValueOnce(1)
    const res = await POST(req({ displayId: 'd1', elementId: 'w1', email: 'a@b.com' }))
    expect(res.status).toBe(201)
    expect((await res.json()).count).toBe(1)
    expect(db.waitlistSignup.create).toHaveBeenCalled()
  })

  it('is idempotent for a duplicate email (no second row, 200)', async () => {
    ;(db.waitlistSignup.findUnique as any).mockResolvedValue({ id: 'existing' })
    ;(db.waitlistSignup.count as any).mockResolvedValue(1)
    const res = await POST(req({ displayId: 'd1', elementId: 'w1', email: 'a@b.com' }))
    expect(res.status).toBe(200)
    expect(db.waitlistSignup.create).not.toHaveBeenCalled()
    expect((await res.json()).count).toBe(1)
  })

  it('rejects with 409 when the list is full', async () => {
    ;(db.waitlistSignup.count as any).mockResolvedValue(2) // capacity is 2
    const res = await POST(req({ displayId: 'd1', elementId: 'w1', email: 'new@b.com' }))
    expect(res.status).toBe(409)
    expect(db.waitlistSignup.create).not.toHaveBeenCalled()
  })

  it('captures userId when the visitor is logged in', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'u1' })
    ;(db.waitlistSignup.count as any).mockResolvedValueOnce(0).mockResolvedValueOnce(1)
    await POST(req({ displayId: 'd1', elementId: 'w1', email: 'a@b.com' }))
    expect((db.waitlistSignup.create as any).mock.calls[0][0].data.userId).toBe('u1')
  })

  it('400s on an invalid email', async () => {
    const res = await POST(req({ displayId: 'd1', elementId: 'w1', email: 'notanemail' }))
    expect(res.status).toBe(400)
  })

  it('404s when the element is not a waitlist on the display', async () => {
    const res = await POST(req({ displayId: 'd1', elementId: 'nope', email: 'a@b.com' }))
    expect(res.status).toBe(404)
  })

  it('403s when the display is unpublished', async () => {
    ;(db.display.findUnique as any).mockResolvedValue({ ...DISPLAY, published: false })
    const res = await POST(req({ displayId: 'd1', elementId: 'w1', email: 'a@b.com' }))
    expect(res.status).toBe(403)
  })
})
