import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/rate-limit', () => ({ rateLimit: vi.fn().mockResolvedValue(null) }))
vi.mock('@/lib/auth', () => ({ getUser: vi.fn() }))
vi.mock('@/lib/db', () => ({
  db: {
    display: { findUnique: vi.fn() },
    comment: { create: vi.fn(), findMany: vi.fn(), updateMany: vi.fn() },
  },
}))
vi.mock('@/lib/notifications', () => ({ createNotification: vi.fn().mockResolvedValue(undefined) }))
vi.mock('@/lib/crm/ingest', () => ({ ingestLead: vi.fn().mockResolvedValue(undefined) }))

import { db } from '@/lib/db'
import { createNotification } from '@/lib/notifications'
import { ingestLead } from '@/lib/crm/ingest'
import { POST } from './route'

const ctx = { params: Promise.resolve({ id: 'd1' }) }
const req = (body: unknown) =>
  new Request('http://localhost/api/displays/d1/comments', {
    method: 'POST',
    body: JSON.stringify(body),
  }) as never

const DISPLAY = {
  id: 'd1',
  userId: 'owner1',
  title: 'My Page',
  slug: 'my-page',
  sections: [],
  user: { username: 'owner' },
}

beforeEach(() => {
  vi.clearAllMocks()
  ;(db.display.findUnique as any).mockResolvedValue(DISPLAY)
  ;(db.comment.create as any).mockResolvedValue({
    id: 'c1',
    authorName: 'Visitor',
    authorEmail: 'visitor@example.com',
    content: 'Nice page!',
  })
})

describe('POST /api/displays/[id]/comments', () => {
  it('creates a comment and ingests a lead with the commenter email/name', async () => {
    const res = await POST(
      req({ authorName: 'Visitor', authorEmail: 'visitor@example.com', content: 'Nice page!' }),
      ctx
    )
    expect(res.status).toBe(201)
    expect(db.comment.create).toHaveBeenCalledTimes(1)
    expect(ingestLead).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'comment',
        sourceId: 'c1',
        email: 'visitor@example.com',
        name: 'Visitor',
      })
    )
    expect(createNotification).toHaveBeenCalledTimes(1)
  })

  it('still calls ingestLead with email: null for an anonymous commenter (no pre-filtering)', async () => {
    ;(db.comment.create as any).mockResolvedValue({
      id: 'c2',
      authorName: 'Anonymous',
      authorEmail: null,
      content: 'hi',
    })
    const res = await POST(req({ authorEmail: null, content: 'hi' }), ctx)
    expect(res.status).toBe(201)
    expect(ingestLead).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'comment',
        sourceId: 'c2',
        email: null,
        name: 'Anonymous',
      })
    )
  })
})
