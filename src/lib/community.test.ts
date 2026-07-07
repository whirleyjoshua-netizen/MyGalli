import { describe, it, expect } from 'vitest'
import { canPostToHub, toMemberDTO } from './community'

describe('canPostToHub', () => {
  const hub = { userId: 'owner1' }
  it('owner can post', () => {
    expect(canPostToHub('owner1', hub, [])).toBe(true)
  })
  it('collaborator can post', () => {
    expect(canPostToHub('col1', hub, ['col1', 'col2'])).toBe(true)
  })
  it('a random member cannot post', () => {
    expect(canPostToHub('rando', hub, ['col1'])).toBe(false)
  })
})

describe('toMemberDTO', () => {
  it('exposes only public fields', () => {
    const row = { userId: 'u1', user: { username: 'ann', name: 'Ann', avatar: null } }
    expect(toMemberDTO(row)).toEqual({ userId: 'u1', username: 'ann', name: 'Ann', avatar: null })
  })
})
