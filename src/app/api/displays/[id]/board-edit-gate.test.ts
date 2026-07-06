import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({ getUser: vi.fn() }))
vi.mock('@/lib/db', () => ({
  db: {
    display: { findUnique: vi.fn(), update: vi.fn() },
  },
}))
vi.mock('@/lib/notifications', () => ({ notifyFollowers: vi.fn() }))

import { getUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { PATCH } from './route'

function req(body: unknown) {
  return new Request('http://localhost/api/displays/b1', {
    method: 'PATCH',
    body: JSON.stringify(body),
  }) as any
}
const ctx = { params: Promise.resolve({ id: 'b1' }) }

const board = {
  id: 'b1',
  userId: 'u1',
  kind: 'collection',
  version: 1,
  published: false,
  slug: 'roster',
  title: 'Roster',
  collaborators: [],
}

beforeEach(() => vi.clearAllMocks())

describe('PATCH /api/displays/[id] Pro-gates board edits', () => {
  it('403s a FREE owner saving edits to a collection board', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'u1', username: 'coach', plan: 'free' })
    ;(db.display.findUnique as any).mockResolvedValue(board)
    const res = await PATCH(req({ title: 'New title' }), ctx)
    expect(res.status).toBe(403)
    expect(db.display.update as any).not.toHaveBeenCalled()
  })

  it('does not 403 a PRO owner on the Pro gate', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'u1', username: 'coach', plan: 'pro' })
    ;(db.display.findUnique as any).mockResolvedValue(board)
    ;(db.display.update as any).mockResolvedValue({ ...board, title: 'New title' })
    const res = await PATCH(req({ title: 'New title' }), ctx)
    expect(res.status).not.toBe(403)
  })
})
