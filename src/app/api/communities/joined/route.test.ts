import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({ getUser: vi.fn() }))
vi.mock('@/lib/db', () => ({
  db: {
    hub: { findMany: vi.fn() },
    hubMember: { findMany: vi.fn() },
  },
}))

import { getUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { GET } from './route'

const req = () => new Request('http://localhost/api/communities/joined') as any

beforeEach(() => {
  vi.clearAllMocks()
  ;(getUser as any).mockResolvedValue({ id: 'me' })
})

it('returns 401 when unauthenticated', async () => {
  ;(getUser as any).mockResolvedValue(null)
  const res = await GET(req())
  expect(res.status).toBe(401)
})

it('merges owned + joined community hubs, dedupes, derives role and memberCount', async () => {
  ;(db.hub.findMany as any).mockResolvedValue([
    { id: 'h1', title: 'Owned One', slug: 'owned-one', coverImage: null,
      updatedAt: new Date('2026-07-10T00:00:00Z'), user: { username: 'me' },
      _count: { members: 3 },
      posts: [{ text: 'hi', createdAt: new Date('2026-07-11T00:00:00Z') }] },
  ])
  ;(db.hubMember.findMany as any).mockResolvedValue([
    { hub: { id: 'h2', title: 'Joined Two', slug: 'joined-two', coverImage: 'c.png',
      updatedAt: new Date('2026-07-09T00:00:00Z'), user: { username: 'alice' },
      _count: { members: 8 }, posts: [] } },
    // duplicate of an owned hub — owner must win, no dupe
    { hub: { id: 'h1', title: 'Owned One', slug: 'owned-one', coverImage: null,
      updatedAt: new Date('2026-07-10T00:00:00Z'), user: { username: 'me' },
      _count: { members: 3 }, posts: [] } },
  ])

  const res = await GET(req())
  const body = await res.json()
  expect(res.status).toBe(200)
  const byId = Object.fromEntries(body.communities.map((c: any) => [c.id, c]))
  expect(Object.keys(byId)).toHaveLength(2)
  expect(byId.h1.role).toBe('owner')
  expect(byId.h1.memberCount).toBe(3)
  expect(byId.h1.latestPost).toEqual({ text: 'hi', createdAt: '2026-07-11T00:00:00.000Z' })
  expect(byId.h2.role).toBe('member')
  expect(byId.h2.memberCount).toBe(8)
  expect(byId.h2.latestPost).toBeNull()
  expect(byId.h2.updatedAt).toBe('2026-07-09T00:00:00.000Z')
})
