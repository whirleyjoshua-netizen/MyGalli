import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/rate-limit', () => ({ rateLimit: vi.fn().mockResolvedValue(null) }))
vi.mock('@/lib/auth', () => ({ getUser: vi.fn(), getJwtSecret: () => 'test-secret' }))
vi.mock('@/lib/notifications', () => ({ createNotification: vi.fn() }))
vi.mock('@/lib/db', () => ({
  db: {
    user: { findUnique: vi.fn() },
    message: { create: vi.fn().mockResolvedValue({ id: 'm1' }) },
  },
}))

import { POST } from './route'
import { db } from '@/lib/db'
import { createNotification } from '@/lib/notifications'

const post = (body: unknown) =>
  new NextRequest('http://localhost/api/messages/profile', { method: 'POST', body: JSON.stringify(body) })

beforeEach(() => vi.clearAllMocks())

describe('POST /api/messages/profile', () => {
  it('persists a message with displayId null and profile-mailbox elementId, fires a notification', async () => {
    ;(db.user.findUnique as any).mockResolvedValue({ id: 'owner1' })
    const res = await POST(post({ username: 'someuser', kind: 'text', body: 'hi' }))
    expect(res.status).toBe(201)
    expect(db.message.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ displayId: null, ownerId: 'owner1', elementId: 'profile-mailbox', kind: 'text', body: 'hi' }),
    }))
    expect(createNotification).toHaveBeenCalledWith(expect.objectContaining({ userId: 'owner1', type: 'message', entityUrl: '/data?tab=messages' }))
  })

  it('honeypot filled → 200 and nothing persisted', async () => {
    const res = await POST(post({ username: 'someuser', kind: 'text', body: 'hi', hp: 'bot' }))
    expect(res.status).toBe(200)
    expect(db.message.create).not.toHaveBeenCalled()
    expect(db.user.findUnique).not.toHaveBeenCalled()
  })

  it('unknown username → 404', async () => {
    ;(db.user.findUnique as any).mockResolvedValue(null)
    const res = await POST(post({ username: 'ghost', kind: 'text', body: 'hi' }))
    expect(res.status).toBe(404)
    expect(db.message.create).not.toHaveBeenCalled()
  })

  it('missing username → 400', async () => {
    const res = await POST(post({ kind: 'text', body: 'hi' }))
    expect(res.status).toBe(400)
  })

  it('empty body and no media → 400', async () => {
    const res = await POST(post({ username: 'someuser', kind: 'text' }))
    expect(res.status).toBe(400)
  })
})
