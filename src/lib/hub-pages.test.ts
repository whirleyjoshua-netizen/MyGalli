import { describe, it, expect } from 'vitest'
import { toHubPageDTO, visibleHubPageWhere } from './hub-pages'

const row = {
  id: 'hp1',
  displayId: 'd1',
  status: 'approved',
  addedById: 'u1',
  createdAt: new Date('2026-07-22T00:00:00Z'),
  display: { title: 'My Page', slug: 'my-page', coverImage: null, user: { username: 'jo' } },
}

describe('toHubPageDTO', () => {
  it('flattens the joined display and owner', () => {
    expect(toHubPageDTO(row)).toEqual({
      id: 'hp1',
      displayId: 'd1',
      title: 'My Page',
      slug: 'my-page',
      coverImage: null,
      ownerUsername: 'jo',
      status: 'approved',
      addedById: 'u1',
      createdAt: '2026-07-22T00:00:00.000Z',
    })
  })
})

describe('visibleHubPageWhere', () => {
  it('logged-out viewers see only approved rows whose Page is published', () => {
    expect(visibleHubPageWhere({ hubId: 'h1', viewerId: null, isPrivileged: false })).toEqual({
      hubId: 'h1',
      status: 'approved',
      display: { is: { published: true } },
    })
  })

  it('a plain member also sees their own pending and rejected rows', () => {
    const w = visibleHubPageWhere({ hubId: 'h1', viewerId: 'u1', isPrivileged: false }) as any
    expect(w.hubId).toBe('h1')
    expect(w.OR).toEqual([
      { status: 'approved', display: { is: { published: true } } },
      { addedById: 'u1', status: { in: ['pending', 'rejected'] } },
    ])
  })

  it('a moderator also sees pending rows', () => {
    const w = visibleHubPageWhere({ hubId: 'h1', viewerId: 'mod', isPrivileged: true }) as any
    expect(w.OR).toContainEqual({ status: 'pending' })
  })

  it('never exposes another member rejected rows', () => {
    const w = visibleHubPageWhere({ hubId: 'h1', viewerId: 'mod', isPrivileged: true }) as any
    expect(w.OR).not.toContainEqual({ status: 'rejected' })
  })

  it('does not resurface the author own approved row once its Display is unpublished, but keeps their pending and rejected rows', () => {
    const w = visibleHubPageWhere({ hubId: 'h1', viewerId: 'u1', isPrivileged: false }) as any
    // The own-rows clause only ever matches pending/rejected — an approved row
    // must clear the same `display.published` bar as everyone else's, so an
    // author cannot see their own approved-but-unpublished row via this OR arm.
    const ownRowsClause = w.OR.find((clause: Record<string, unknown>) => clause.addedById === 'u1')
    expect(ownRowsClause).toEqual({ addedById: 'u1', status: { in: ['pending', 'rejected'] } })
    expect(ownRowsClause.status.in).not.toContain('approved')
  })
})
