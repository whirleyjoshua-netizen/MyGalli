import { describe, it, expect } from 'vitest'
import { canPostToHub, toMemberDTO, canParticipate, canModerate } from './community'

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

const hub = { userId: 'owner1' }
describe('canParticipate', () => {
  it('owner can', () => expect(canParticipate('owner1', hub, [], false)).toBe(true))
  it('collaborator can', () => expect(canParticipate('c1', hub, ['c1'], false)).toBe(true))
  it('member can', () => expect(canParticipate('m1', hub, [], true)).toBe(true))
  it('stranger cannot', () => expect(canParticipate('x1', hub, [], false)).toBe(false))
})
describe('canModerate', () => {
  it('owner/collab moderate', () => {
    expect(canModerate('owner1', hub, [])).toBe(true)
    expect(canModerate('c1', hub, ['c1'])).toBe(true)
  })
  it('member does not moderate', () => expect(canModerate('m1', hub, [])).toBe(false))
})
