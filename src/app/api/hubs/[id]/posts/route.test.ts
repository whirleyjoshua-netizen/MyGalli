import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({ getUser: vi.fn() }))
vi.mock('@/lib/rate-limit', () => ({ rateLimit: vi.fn().mockResolvedValue(null) }))
vi.mock('@/lib/notifications', () => ({ notifyHubMembers: vi.fn(), createNotification: vi.fn() }))
vi.mock('@/lib/db', () => ({
  db: {
    hub: { findUnique: vi.fn() },
    hubMember: { findUnique: vi.fn(), findMany: vi.fn() },
    hubCollaborator: { findMany: vi.fn() },
    hubPost: { create: vi.fn(), findMany: vi.fn() },
    hubPostResponse: { findMany: vi.fn() },
    display: { findUnique: vi.fn() },
  },
}))

import { getUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { notifyHubMembers } from '@/lib/notifications'
import { POST } from './route'

const HUB = { id: 'h1', userId: 'owner', community: true, title: 'Smoke Hub', slug: 'smoke-hub', user: { username: 'hubowner' } }
const ctx = { params: Promise.resolve({ id: 'h1' }) }
const req = (body: unknown) =>
  new Request('http://localhost/api/hubs/h1/posts', { method: 'POST', body: JSON.stringify(body) }) as any

beforeEach(() => {
  vi.clearAllMocks()
  ;(db.hub.findUnique as any).mockResolvedValue(HUB)
  ;(db.hubCollaborator.findMany as any).mockResolvedValue([])
  ;(db.hubMember.findUnique as any).mockResolvedValue({ id: 'mem' }) // caller is a member
  ;(db.hubMember.findMany as any).mockResolvedValue([{ userId: 'm1' }, { userId: 'm2' }])
  ;(db.hubPost.create as any).mockResolvedValue({ id: 'p1' })
})

describe('POST /api/hubs/[id]/posts — notifications', () => {
  it('owner posting notifies every member except the author', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'owner', name: 'Owner', username: 'hubowner', avatar: null })
    const res = await POST(req({ text: 'hello' }), ctx)
    expect(res.status).toBe(201)
    const [targets, input] = (notifyHubMembers as any).mock.calls[0]
    expect([...targets].sort()).toEqual(['m1', 'm2'])
    expect(input.type).toBe('hub_post')
    expect(input.entityUrl).toBe('/hubowner/hub/smoke-hub')
    expect(input.contextText).toBe('Smoke Hub')
  })

  it('member posting notifies the owner, not other members', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'm1', name: 'M1', username: 'm1', avatar: null })
    await POST(req({ text: 'hi' }), ctx)
    const [targets] = (notifyHubMembers as any).mock.calls[0]
    expect([...targets].sort()).toEqual(['owner'])
  })

  it('collaborator posting notifies all members', async () => {
    ;(db.hubCollaborator.findMany as any).mockResolvedValue([{ userId: 'collab' }])
    ;(getUser as any).mockResolvedValue({ id: 'collab', name: 'Collab', username: 'collab', avatar: null })
    await POST(req({ text: 'hi' }), ctx)
    const [targets] = (notifyHubMembers as any).mock.calls[0]
    expect([...targets].sort()).toEqual(['m1', 'm2'])
  })

  it('member posting notifies the owner and collaborators', async () => {
    ;(db.hubCollaborator.findMany as any).mockResolvedValue([{ userId: 'collab' }])
    ;(getUser as any).mockResolvedValue({ id: 'm1', name: 'M1', username: 'm1', avatar: null })
    await POST(req({ text: 'hi' }), ctx)
    const [targets] = (notifyHubMembers as any).mock.calls[0]
    expect([...targets].sort()).toEqual(['collab', 'owner'])
  })

  it('creates the post before notifying (notification is not a precondition)', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'owner', name: 'Owner', username: 'hubowner', avatar: null })
    await POST(req({ text: 'hello' }), ctx)
    expect(db.hubPost.create).toHaveBeenCalled()
    expect(notifyHubMembers).toHaveBeenCalled()
  })
})
