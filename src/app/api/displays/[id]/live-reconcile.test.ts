import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', () => ({ getUser: vi.fn().mockResolvedValue({ id: 'u1', name: 'U', username: 'u', avatar: null }) }))
vi.mock('@/lib/collab', () => ({
  canEdit: () => true,
  splitUpdate: (known: Record<string, unknown>) => ({ data: known, rejected: [] }),
  COLLAB_FIELDS: ['sections', 'tabs', 'background', 'spacing', 'headerCard'],
  VISIBLE_FIELDS: ['sections', 'tabs', 'background', 'spacing', 'headerCard', 'title', 'description'],
}))
vi.mock('@/lib/categories', () => ({ isValidCategory: () => true }))
vi.mock('@/lib/notifications', () => ({ notifyFollowers: vi.fn() }))
vi.mock('@/lib/db', () => ({
  db: {
    display: {
      findUnique: vi.fn().mockResolvedValue({ id: 'd1', userId: 'u1', published: false, version: 0, collaborators: [] }),
      update: vi.fn(),
    },
    liveFeed: { createMany: vi.fn().mockResolvedValue({ count: 1 }) },
  },
}))

import { PATCH } from './route'
import { db } from '@/lib/db'

const sections = [{ id: 's1', columns: [{ id: 'c1', elements: [{ id: 'el-live', type: 'live-feed' }] }] }]

beforeEach(() => vi.clearAllMocks())

it('creates a LiveFeed row for each live-feed element on save', async () => {
  ;(db.display.update as any).mockResolvedValue({ id: 'd1', sections, tabs: null })
  const request = new NextRequest('http://localhost/api/displays/d1', {
    method: 'PATCH',
    body: JSON.stringify({ sections, version: 0 }),
  })
  const res = await PATCH(request, { params: Promise.resolve({ id: 'd1' }) })
  expect(res.status).toBe(200)
  expect(db.liveFeed.createMany).toHaveBeenCalledWith({
    data: [{ id: 'el-live', displayId: 'd1' }],
    skipDuplicates: true,
  })
})
