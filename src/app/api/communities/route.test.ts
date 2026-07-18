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

const req = () => new Request('http://localhost/api/communities', { method: 'GET' }) as any

const hub = (over: Partial<any> = {}) => ({
  id: 'h1',
  title: 'My Community',
  slug: 'my-community',
  coverImage: null,
  user: { username: 'owner' },
  _count: { members: 3 },
  posts: [],
  ...over,
})

beforeEach(() => {
  vi.clearAllMocks()
  ;(db.hub.findMany as any).mockResolvedValue([])
  ;(db.hubMember.findMany as any).mockResolvedValue([])
})

describe('GET /api/communities', () => {
  it('401 when unauthenticated', async () => {
    ;(getUser as any).mockResolvedValue(null)
    const res = await GET(req())
    expect(res.status).toBe(401)
  })

  it('returns owned communities flagged isOwner with member count and latest post', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'me' })
    ;(db.hub.findMany as any).mockResolvedValue([
      hub({ posts: [{ text: 'hello', createdAt: new Date('2026-07-16T00:00:00Z') }] }),
    ])
    const res = await GET(req())
    const { communities } = await res.json()
    expect(communities).toHaveLength(1)
    expect(communities[0]).toMatchObject({
      id: 'h1',
      isOwner: true,
      memberCount: 3,
      latestPost: { text: 'hello', createdAt: '2026-07-16T00:00:00.000Z' },
    })
  })

  it('includes joined communities flagged isOwner=false', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'me' })
    ;(db.hubMember.findMany as any).mockResolvedValue([
      { hub: hub({ id: 'h2', title: 'Joined', slug: 'joined' }) },
    ])
    const res = await GET(req())
    const { communities } = await res.json()
    expect(communities).toHaveLength(1)
    expect(communities[0]).toMatchObject({ id: 'h2', isOwner: false })
  })

  it('dedupes when the user both owns and is a member; owned wins', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'me' })
    ;(db.hub.findMany as any).mockResolvedValue([hub()])
    ;(db.hubMember.findMany as any).mockResolvedValue([{ hub: hub() }])
    const res = await GET(req())
    const { communities } = await res.json()
    expect(communities).toHaveLength(1)
    expect(communities[0].isOwner).toBe(true)
  })
})
