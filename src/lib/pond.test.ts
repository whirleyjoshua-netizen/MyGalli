import { describe, it, expect } from 'vitest'
import { filterSortCommunities, filterSortCollabs, type PondCommunity, type PondCollab } from './pond'

const c = (over: Partial<PondCommunity>): PondCommunity => ({
  id: 'x', title: 'X', username: 'u', slug: 's', coverImage: null,
  role: 'member', memberCount: 0, latestPost: null, updatedAt: '2026-07-01T00:00:00Z', ...over,
})

it('searches by title (case-insensitive)', () => {
  const list = [c({ id: 'a', title: 'Alpha' }), c({ id: 'b', title: 'Beta' })]
  const out = filterSortCommunities(list, { query: 'alp', filter: 'all', sort: 'alpha' })
  expect(out.map((x) => x.id)).toEqual(['a'])
})

it('filters by role', () => {
  const list = [c({ id: 'a', role: 'owner' }), c({ id: 'b', role: 'member' })]
  expect(filterSortCommunities(list, { query: '', filter: 'owned', sort: 'alpha' }).map((x) => x.id)).toEqual(['a'])
  expect(filterSortCommunities(list, { query: '', filter: 'joined', sort: 'alpha' }).map((x) => x.id)).toEqual(['b'])
})

it('sorts by members desc and alpha', () => {
  const list = [c({ id: 'a', title: 'Bravo', memberCount: 1 }), c({ id: 'b', title: 'Alpha', memberCount: 9 })]
  expect(filterSortCommunities(list, { query: '', filter: 'all', sort: 'members' }).map((x) => x.id)).toEqual(['b', 'a'])
  expect(filterSortCommunities(list, { query: '', filter: 'all', sort: 'alpha' }).map((x) => x.id)).toEqual(['b', 'a'])
})

it('sorts by activity using latestPost then updatedAt', () => {
  const list = [
    c({ id: 'old', updatedAt: '2026-01-01T00:00:00Z' }),
    c({ id: 'new', updatedAt: '2026-01-01T00:00:00Z', latestPost: { text: 'hi', createdAt: '2026-07-15T00:00:00Z' } }),
  ]
  expect(filterSortCommunities(list, { query: '', filter: 'all', sort: 'active' }).map((x) => x.id)).toEqual(['new', 'old'])
})

it('filterSortCollabs searches title and sorts by updated', () => {
  const d = (over: Partial<PondCollab>): PondCollab => ({ id: 'x', slug: 's', title: 'X', coverImage: null, published: true, updatedAt: '2026-07-01T00:00:00Z', owner: { username: 'u', name: null, avatar: null }, ...over })
  const list = [d({ id: 'a', title: 'Alpha', updatedAt: '2026-07-01T00:00:00Z' }), d({ id: 'b', title: 'Beta', updatedAt: '2026-07-10T00:00:00Z' })]
  expect(filterSortCollabs(list, { query: 'bet', sort: 'active' }).map((x) => x.id)).toEqual(['b'])
  expect(filterSortCollabs(list, { query: '', sort: 'active' }).map((x) => x.id)).toEqual(['b', 'a'])
})
