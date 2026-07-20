import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', () => ({ getUser: vi.fn() }))
vi.mock('@/lib/db', () => ({
  db: { conversationParticipant: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) } },
}))

import { PATCH } from './route'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'

const ctx = (id: string) => ({ params: Promise.resolve({ id }) })
const patch = (body: unknown) =>
  new NextRequest('http://localhost/api/dm/conversations/c1', {
    method: 'PATCH',
    body: JSON.stringify(body),
  })

beforeEach(() => vi.clearAllMocks())

describe('PATCH /api/dm/conversations/[id]', () => {
  it('401 unauthenticated', async () => {
    ;(getUser as any).mockResolvedValue(null)
    expect((await PATCH(patch({ starred: true }), ctx('c1'))).status).toBe(401)
  })

  it('scopes the update to the caller so nobody can flip another person’s row', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'me' })
    await PATCH(patch({ starred: true }), ctx('c1'))
    expect(db.conversationParticipant.updateMany).toHaveBeenCalledWith({
      where: { conversationId: 'c1', userId: 'me' },
      data: { starred: true },
    })
  })

  it('accepts a request', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'me' })
    await PATCH(patch({ state: 'accepted' }), ctx('c1'))
    expect(db.conversationParticipant.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { state: 'accepted' } })
    )
  })

  it('rejects an unknown state', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'me' })
    expect((await PATCH(patch({ state: 'nonsense' }), ctx('c1'))).status).toBe(400)
  })

  it('400 when no updatable field is supplied', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'me' })
    expect((await PATCH(patch({}), ctx('c1'))).status).toBe(400)
  })

  it('404 when the caller is not a participant', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'stranger' })
    ;(db.conversationParticipant.updateMany as any).mockResolvedValue({ count: 0 })
    expect((await PATCH(patch({ starred: true }), ctx('c1'))).status).toBe(404)
  })
})
