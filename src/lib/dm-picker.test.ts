import { describe, it, expect } from 'vitest'
import { mergeSocialGraph, filterPickerUsers } from './dm-picker'

const row = (username: string, name: string | null = null) => ({
  username,
  name,
  avatar: null,
})

describe('mergeSocialGraph', () => {
  it('marks users present in both lists as mutual', () => {
    const out = mergeSocialGraph([row('sarah')], [row('sarah')])
    expect(out).toHaveLength(1)
    expect(out[0].isMutual).toBe(true)
  })

  it('marks a one-way follower as not mutual', () => {
    const out = mergeSocialGraph([row('sarah')], [])
    expect(out[0].isMutual).toBe(false)
  })

  it('dedupes by username so a mutual appears exactly once', () => {
    const out = mergeSocialGraph([row('sarah'), row('jo')], [row('sarah')])
    expect(out.map((u) => u.username)).toEqual(['sarah', 'jo'])
  })

  it('sorts mutuals first, then alphabetically by display name', () => {
    const followers = [row('zed', 'Zed'), row('amy', 'Amy'), row('bob', 'Bob')]
    const following = [row('zed', 'Zed')]
    const out = mergeSocialGraph(followers, following)
    expect(out.map((u) => u.username)).toEqual(['zed', 'amy', 'bob'])
  })

  it('falls back to username when name is null for sorting', () => {
    const out = mergeSocialGraph([row('bea'), row('ann')], [])
    expect(out.map((u) => u.username)).toEqual(['ann', 'bea'])
  })

  it('sorts case-insensitively', () => {
    const out = mergeSocialGraph([row('b', 'beta'), row('a', 'Alpha')], [])
    expect(out.map((u) => u.username)).toEqual(['a', 'b'])
  })

  it('prefers the richer record when the same user appears in both lists', () => {
    const out = mergeSocialGraph([row('sarah', null)], [
      { username: 'sarah', name: 'Sarah Johnson', avatar: '/a.png' },
    ])
    expect(out[0].name).toBe('Sarah Johnson')
    expect(out[0].avatar).toBe('/a.png')
  })

  it('returns an empty array when both lists are empty', () => {
    expect(mergeSocialGraph([], [])).toEqual([])
  })
})

describe('filterPickerUsers', () => {
  const users = mergeSocialGraph(
    [row('sarahj', 'Sarah Johnson'), row('bob', 'Bob Smith')],
    []
  )

  it('returns everything for an empty query', () => {
    expect(filterPickerUsers(users, '')).toHaveLength(2)
  })

  it('matches on username case-insensitively', () => {
    expect(filterPickerUsers(users, 'SARAH').map((u) => u.username)).toEqual(['sarahj'])
  })

  it('matches on display name', () => {
    expect(filterPickerUsers(users, 'smith').map((u) => u.username)).toEqual(['bob'])
  })

  it('ignores surrounding whitespace and a leading @', () => {
    expect(filterPickerUsers(users, '  @bob ').map((u) => u.username)).toEqual(['bob'])
  })

  it('returns an empty array when nothing matches', () => {
    expect(filterPickerUsers(users, 'zzz')).toEqual([])
  })
})
