import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({ getUser: vi.fn() }))
vi.mock('@/lib/db', () => ({
  db: {
    acknowledgment: { findMany: vi.fn() },
    acknowledgmentRound: { findUnique: vi.fn() },
    display: { findUnique: vi.fn() },
    hubPost: { findUnique: vi.fn() },
  },
}))

import { getUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { GET } from './route'

const ctx = { params: Promise.resolve({ elementId: 'el-1' }) }
const get = (qs: string) => new Request(`http://localhost/api/acknowledgments/el-1?${qs}`) as any

const records = [
  { userId: 'u1', round: 0, createdAt: new Date('2026-07-20T10:00:00.000Z'), user: { name: 'Ada Lovelace', username: 'ada' } },
  { userId: 'u2', round: 0, createdAt: new Date('2026-07-20T11:00:00.000Z'), user: { name: 'Grace Hopper', username: 'grace' } },
]

beforeEach(() => {
  vi.clearAllMocks()
  ;(getUser as any).mockResolvedValue(null)
  ;(db.acknowledgment.findMany as any).mockResolvedValue(records)
  ;(db.acknowledgmentRound.findUnique as any).mockResolvedValue(null)
  ;(db.display.findUnique as any).mockResolvedValue({ id: 'd1', userId: 'owner' })
  ;(db.hubPost.findUnique as any).mockResolvedValue({ id: 'p1', hub: { userId: 'owner' } })
})

describe('GET /api/acknowledgments/[elementId]', () => {
  it('400 without a context param', async () => {
    const res = await GET(get(''), ctx)
    expect(res.status).toBe(400)
  })

  it('returns the count to a signed-out visitor without any roster', async () => {
    const res = await GET(get('displayId=d1'), ctx)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.count).toBe(2)
    expect(body.mine).toBe('none')
    expect(body.roster).toEqual([])
    expect(body.canSeeRoster).toBe(false)
  })

  it('reports the viewer own status', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'u1', plan: 'free' })
    const body = await (await GET(get('displayId=d1'), ctx)).json()
    expect(body.mine).toBe('current')
  })

  it('reports stale when the viewer acknowledged an earlier round', async () => {
    ;(db.acknowledgmentRound.findUnique as any).mockResolvedValue({ scopeKey: 'display:d1:el-1', round: 1 })
    ;(getUser as any).mockResolvedValue({ id: 'u1', plan: 'free' })
    const body = await (await GET(get('displayId=d1'), ctx)).json()
    expect(body.mine).toBe('stale')
  })

  it('hides the roster from a non-owner even on Pro', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'someone-else', plan: 'pro' })
    const body = await (await GET(get('displayId=d1'), ctx)).json()
    expect(body.isOwner).toBe(false)
    expect(body.canSeeRoster).toBe(false)
    expect(body.roster).toEqual([])
  })

  // Pro gating is deliberately deferred: the roster ships free for now and the
  // gate lands later in one place (see ROSTER GATE in route.ts). Ownership is
  // still enforced — only the plan check is absent.
  it('gives a free owner the roster while the Pro gate is deferred', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'owner', plan: 'free' })
    const body = await (await GET(get('displayId=d1'), ctx)).json()
    expect(body.isOwner).toBe(true)
    expect(body.canSeeRoster).toBe(true)
    expect(body.roster).toHaveLength(2)
    expect(body.count).toBe(2)
  })

  it('gives an owner the named roster newest first', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'owner', plan: 'pro' })
    const body = await (await GET(get('displayId=d1'), ctx)).json()
    expect(body.canSeeRoster).toBe(true)
    expect(body.roster.map((r: any) => r.username)).toEqual(['grace', 'ada'])
  })

  it('resolves hub post ownership through the hub', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'owner', plan: 'pro' })
    const body = await (await GET(get('hubPostId=p1'), ctx)).json()
    expect(body.isOwner).toBe(true)
    expect(db.hubPost.findUnique).toHaveBeenCalled()
  })

  it('404 when the display does not exist', async () => {
    ;(db.display.findUnique as any).mockResolvedValue(null)
    const res = await GET(get('displayId=d1'), ctx)
    expect(res.status).toBe(404)
  })

  it('counts only the current round', async () => {
    ;(db.acknowledgmentRound.findUnique as any).mockResolvedValue({ scopeKey: 'display:d1:el-1', round: 1 })
    ;(db.acknowledgment.findMany as any).mockResolvedValue([
      ...records,
      { userId: 'u3', round: 1, createdAt: new Date('2026-07-21T10:00:00.000Z'), user: { name: 'New Round', username: 'new' } },
    ])
    const body = await (await GET(get('displayId=d1'), ctx)).json()
    expect(body.count).toBe(1)
    expect(body.progress).toEqual({ current: 1, previous: 2 })
  })
})
