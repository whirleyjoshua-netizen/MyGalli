import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({ getUser: vi.fn() }))
vi.mock('@/lib/rate-limit', () => ({ rateLimit: vi.fn().mockResolvedValue(null) }))
vi.mock('@/lib/notifications', () => ({ notifyHubMembers: vi.fn() }))
vi.mock('@/lib/db', () => ({
  db: {
    hub: { findUnique: vi.fn() },
    hubCollaborator: { findMany: vi.fn() },
    hubMember: { findMany: vi.fn() },
    hubEvent: { findMany: vi.fn(), create: vi.fn() },
  },
}))

import { getUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { notifyHubMembers } from '@/lib/notifications'
import { GET, POST } from './route'

const ctx = { params: Promise.resolve({ id: 'h1' }) }
const post = (b: unknown) => new Request('http://localhost/api/hubs/h1/events', { method: 'POST', body: JSON.stringify(b) }) as any
const get = (url = 'http://localhost/api/hubs/h1/events') => new Request(url, { method: 'GET' }) as any

beforeEach(() => {
  vi.clearAllMocks()
  ;(db.hub.findUnique as any).mockResolvedValue({ id: 'h1', userId: 'owner', community: true, published: true, title: 'Club', slug: 'club', user: { username: 'o' } })
  ;(db.hubCollaborator.findMany as any).mockResolvedValue([])
  ;(db.hubMember.findMany as any).mockResolvedValue([{ userId: 'm1' }])
  ;(db.hubEvent.findMany as any).mockResolvedValue([])
  ;(db.hubEvent.create as any).mockResolvedValue({ id: 'e1' })
})

describe('POST /events', () => {
  it('403 for a non-privileged member', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'm1', name: 'M', username: 'm1', avatar: null })
    const res = await POST(post({ title: 'X', startsAt: '2026-08-01T19:00:00Z' }), ctx)
    expect(res.status).toBe(403)
  })
  it('400 on invalid input', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'owner', name: 'O', username: 'o', avatar: null })
    expect((await POST(post({ startsAt: 'x' }), ctx)).status).toBe(400)
  })
  it('owner creates + notifies members', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'owner', name: 'O', username: 'o', avatar: null })
    const res = await POST(post({ title: 'Kickoff', startsAt: '2026-08-01T19:00:00Z' }), ctx)
    expect(res.status).toBe(201)
    expect(db.hubEvent.create).toHaveBeenCalled()
    const [targets, input] = (notifyHubMembers as any).mock.calls[0]
    expect([...targets]).toEqual(['m1'])
    expect(input.type).toBe('hub_event')
  })
})

describe('GET /events', () => {
  it('returns upcoming DTOs by default', async () => {
    ;(getUser as any).mockResolvedValue(null)
    ;(db.hubEvent.findMany as any).mockResolvedValue([{ id: 'e1', title: 'K', startsAt: new Date('2026-08-01T19:00:00Z'), endsAt: null, allDay: false, isOnline: true, location: null, description: null }])
    const res = await GET(get(), ctx)
    const body = await res.json()
    expect(body.events[0]).toMatchObject({ id: 'e1', isOnline: true, startsAt: '2026-08-01T19:00:00.000Z' })
    // default upcoming filter: startsAt gte was passed
    const arg = (db.hubEvent.findMany as any).mock.calls[0][0]
    expect(arg.where.startsAt).toBeDefined()
  })
})
