import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  db: {
    follow: { findMany: vi.fn() },
    notification: { create: vi.fn(), createMany: vi.fn() },
  },
}))

import { db } from '@/lib/db'
import { notifyFollowers, createNotification } from './notifications'

const mockDb = db as unknown as {
  follow: { findMany: ReturnType<typeof vi.fn> }
  notification: { create: ReturnType<typeof vi.fn>; createMany: ReturnType<typeof vi.fn> }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('notifyFollowers', () => {
  it('creates one row per follower with denormalized actor + context', async () => {
    mockDb.follow.findMany.mockResolvedValue([{ followerId: 'a' }, { followerId: 'b' }])
    mockDb.notification.createMany.mockResolvedValue({ count: 2 })
    await notifyFollowers('actor1', {
      type: 'bulletin',
      actor: { id: 'actor1', name: 'Marcus', avatar: 'x.png' },
      entityUrl: '/bulletin',
    })
    expect(mockDb.notification.createMany).toHaveBeenCalledTimes(1)
    const arg = mockDb.notification.createMany.mock.calls[0][0]
    expect(arg.data).toHaveLength(2)
    expect(arg.data[0]).toMatchObject({ userId: 'a', type: 'bulletin', actorId: 'actor1', actorName: 'Marcus', actorAvatar: 'x.png', entityUrl: '/bulletin' })
    expect(arg.data[1].userId).toBe('b')
  })
  it('is a no-op when the actor has no followers', async () => {
    mockDb.follow.findMany.mockResolvedValue([])
    await notifyFollowers('actor1', { type: 'bulletin', actor: { id: 'actor1', name: 'Marcus' } })
    expect(mockDb.notification.createMany).not.toHaveBeenCalled()
  })
  it('never throws even if the db call fails', async () => {
    mockDb.follow.findMany.mockRejectedValue(new Error('db down'))
    await expect(notifyFollowers('actor1', { type: 'bulletin', actor: { id: 'actor1', name: 'M' } })).resolves.toBeUndefined()
  })
})

describe('createNotification', () => {
  it('creates a single row with a null actorId for anonymous actors', async () => {
    mockDb.notification.create.mockResolvedValue({})
    await createNotification({
      userId: 'owner1',
      type: 'comment',
      actor: { id: null, name: 'Guest' },
      entityUrl: '/josh/trip',
      contextText: 'Trip',
    })
    expect(mockDb.notification.create).toHaveBeenCalledTimes(1)
    expect(mockDb.notification.create.mock.calls[0][0].data).toMatchObject({ userId: 'owner1', type: 'comment', actorId: null, actorName: 'Guest', entityUrl: '/josh/trip', contextText: 'Trip' })
  })
})
