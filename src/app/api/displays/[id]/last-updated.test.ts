import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({ getUser: vi.fn() }))
vi.mock('@/lib/db', () => ({
  db: {
    display: { findUnique: vi.fn(), update: vi.fn() },
    liveFeed: { createMany: vi.fn() },
  },
}))
vi.mock('@/lib/notifications', () => ({ notifyFollowers: vi.fn() }))

import { getUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { PATCH } from './route'

function req(body: unknown) {
  return new Request('http://localhost/api/displays/d1', {
    method: 'PATCH',
    body: JSON.stringify(body),
  }) as any
}
const ctx = { params: Promise.resolve({ id: 'd1' }) }

const page = {
  id: 'd1',
  userId: 'u1',
  kind: 'page',
  version: 1,
  published: true,
  slug: 'portfolio',
  title: 'Portfolio',
  showLastUpdated: false,
  contentUpdatedAt: null as Date | null,
  collaborators: [],
}

/** The `data` object handed to db.display.update by the route. */
function updateData() {
  return (db.display.update as any).mock.calls[0][0].data
}

beforeEach(() => {
  vi.clearAllMocks()
  ;(db.display.update as any).mockResolvedValue({ ...page, sections: [], tabs: null, headerCard: null })
})

describe('PATCH /api/displays/[id] — contentUpdatedAt stamping', () => {
  it('stamps when a visible field (title) changes', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'u1', username: 'josh' })
    ;(db.display.findUnique as any).mockResolvedValue(page)

    await PATCH(req({ title: 'New title' }), ctx)

    expect(updateData().contentUpdatedAt).toBeInstanceOf(Date)
  })

  it('stamps when the description changes', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'u1', username: 'josh' })
    ;(db.display.findUnique as any).mockResolvedValue(page)

    await PATCH(req({ description: 'New description' }), ctx)

    expect(updateData().contentUpdatedAt).toBeInstanceOf(Date)
  })

  it('stamps when the canvas changes', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'u1', username: 'josh' })
    ;(db.display.findUnique as any).mockResolvedValue(page)

    await PATCH(req({ sections: [], version: 1 }), ctx)

    expect(updateData().contentUpdatedAt).toBeInstanceOf(Date)
  })

  // Publishing changes nothing a visitor can see on the page itself. This models
  // the real PublishDialog client, which always sends `coverImage` (often null)
  // alongside published/category — a cover swap alone must not count as an edit.
  it('does not stamp on publish alone', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'u1', username: 'josh' })
    ;(db.display.findUnique as any).mockResolvedValue({ ...page, published: false })

    await PATCH(req({ published: true, category: 'creative', coverImage: null }), ctx)

    expect(updateData().contentUpdatedAt).toBeUndefined()
  })

  // The dashboard/my-pages thumbnail swap path: cover-only PATCH.
  it('does not stamp on a cover-image-only change', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'u1', username: 'josh' })
    ;(db.display.findUnique as any).mockResolvedValue(page)

    await PATCH(req({ coverImage: 'https://example.com/x.png' }), ctx)

    expect(updateData().contentUpdatedAt).toBeUndefined()
  })

  // The whole point of the feature: a view must never look like an edit.
  it('does not stamp when only the toggle changes', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'u1', username: 'josh' })
    ;(db.display.findUnique as any).mockResolvedValue({
      ...page,
      contentUpdatedAt: new Date('2026-01-01T00:00:00.000Z'),
    })

    await PATCH(req({ showLastUpdated: true }), ctx)

    expect(updateData().contentUpdatedAt).toBeUndefined()
  })

  it('bootstraps the date when enabling on a page that has never been stamped', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'u1', username: 'josh' })
    ;(db.display.findUnique as any).mockResolvedValue({ ...page, contentUpdatedAt: null })

    await PATCH(req({ showLastUpdated: true }), ctx)

    expect(updateData().contentUpdatedAt).toBeInstanceOf(Date)
  })

  it('does not bootstrap when disabling', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'u1', username: 'josh' })
    ;(db.display.findUnique as any).mockResolvedValue({ ...page, contentUpdatedAt: null, showLastUpdated: true })

    await PATCH(req({ showLastUpdated: false }), ctx)

    expect(updateData().contentUpdatedAt).toBeUndefined()
  })

  it('lets a collaborator edit the canvas but not the toggle', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'u2', username: 'helper' })
    ;(db.display.findUnique as any).mockResolvedValue({
      ...page,
      collaborators: [{ userId: 'u2' }],
    })

    const res = await PATCH(req({ showLastUpdated: true }), ctx)

    expect(res.status).toBe(403)
  })
})
