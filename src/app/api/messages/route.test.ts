import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/rate-limit', () => ({ rateLimit: vi.fn().mockResolvedValue(null) }))
vi.mock('@/lib/auth', () => ({ getUser: vi.fn(), getJwtSecret: () => 'test-secret' }))
vi.mock('@/lib/notifications', () => ({ createNotification: vi.fn() }))
vi.mock('@/lib/db', () => ({
  db: {
    display: { findUnique: vi.fn() },
    message: { create: vi.fn().mockResolvedValue({ id: 'm1' }), findMany: vi.fn().mockResolvedValue([]) },
  },
}))

import { POST, GET } from './route'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'
import { createNotification } from '@/lib/notifications'

const mailboxDisplay = {
  id: 'd1', userId: 'owner1', title: 'My Page', published: true,
  sections: [{ columns: [{ elements: [{ id: 'el-mb', type: 'mailbox', mailboxRequireName: false }] }] }],
  tabs: null,
}
const post = (body: unknown) => new NextRequest('http://localhost/api/messages', { method: 'POST', body: JSON.stringify(body) })

beforeEach(() => vi.clearAllMocks())

describe('POST /api/messages', () => {
  it('persists a text message, sets ownerId, fires a notification', async () => {
    ;(db.display.findUnique as any).mockResolvedValue(mailboxDisplay)
    const res = await POST(post({ displayId: 'd1', elementId: 'el-mb', kind: 'text', body: 'hi' }))
    expect(res.status).toBe(201)
    expect(db.message.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ displayId: 'd1', ownerId: 'owner1', elementId: 'el-mb', kind: 'text', body: 'hi' }),
    }))
    expect(createNotification).toHaveBeenCalledWith(expect.objectContaining({ userId: 'owner1', type: 'message' }))
  })

  it('honeypot filled → 200 and nothing persisted', async () => {
    ;(db.display.findUnique as any).mockResolvedValue(mailboxDisplay)
    const res = await POST(post({ displayId: 'd1', elementId: 'el-mb', kind: 'text', body: 'hi', hp: 'bot' }))
    expect(res.status).toBe(200)
    expect(db.message.create).not.toHaveBeenCalled()
  })

  it('unpublished display → 404', async () => {
    ;(db.display.findUnique as any).mockResolvedValue({ ...mailboxDisplay, published: false })
    const res = await POST(post({ displayId: 'd1', elementId: 'el-mb', kind: 'text', body: 'hi' }))
    expect(res.status).toBe(404)
  })

  it('no mailbox element with that id → 400', async () => {
    ;(db.display.findUnique as any).mockResolvedValue({ ...mailboxDisplay, sections: [] })
    const res = await POST(post({ displayId: 'd1', elementId: 'ghost', kind: 'text', body: 'hi' }))
    expect(res.status).toBe(400)
  })

  it('empty text and no media → 400', async () => {
    ;(db.display.findUnique as any).mockResolvedValue(mailboxDisplay)
    const res = await POST(post({ displayId: 'd1', elementId: 'el-mb', kind: 'text' }))
    expect(res.status).toBe(400)
  })
})

describe('GET /api/messages', () => {
  it('401 when not signed in', async () => {
    ;(getUser as any).mockResolvedValue(null)
    const res = await GET(new NextRequest('http://localhost/api/messages'))
    expect(res.status).toBe(401)
  })
  it('lists only the caller’s messages', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'owner1' })
    await GET(new NextRequest('http://localhost/api/messages'))
    expect(db.message.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ ownerId: 'owner1' }),
    }))
  })
})
