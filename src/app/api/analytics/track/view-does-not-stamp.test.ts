import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/rate-limit', () => ({ rateLimit: vi.fn().mockResolvedValue(null) }))
vi.mock('@/lib/db', () => ({
  db: {
    display: { findUnique: vi.fn(), update: vi.fn() },
    analyticsEvent: { create: vi.fn() },
  },
}))

import { db } from '@/lib/db'
import { POST } from './route'

beforeEach(() => vi.clearAllMocks())

describe('POST /api/analytics/track', () => {
  // Display.updatedAt is @updatedAt, so this view increment already restamps it.
  // That is exactly why the badge reads contentUpdatedAt instead — and why this
  // route must never touch contentUpdatedAt.
  it('increments views without touching contentUpdatedAt', async () => {
    ;(db.display.findUnique as any).mockResolvedValue({ id: 'd1', published: true })
    ;(db.analyticsEvent.create as any).mockResolvedValue({ id: 'e1' })
    ;(db.display.update as any).mockResolvedValue({})

    const req = new Request('http://localhost/api/analytics/track', {
      method: 'POST',
      body: JSON.stringify({ displayId: 'd1', eventType: 'view' }),
    }) as any

    await POST(req)

    // Exact-match: any extra field here — contentUpdatedAt above all — fails.
    expect(db.display.update).toHaveBeenCalledWith({
      where: { id: 'd1' },
      data: { views: { increment: 1 } },
    })
  })
})
