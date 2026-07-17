import { describe, it, expect } from 'vitest'
import { canPostToHub, toMemberDTO, canParticipate, canModerate, postNotifyTargets, canViewCommunityHub } from './community'

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

describe('postNotifyTargets', () => {
  const base = { ownerId: 'owner', collabIds: ['collab'], memberIds: ['m1', 'm2'] }

  it('owner posting notifies all members, never the author', () => {
    expect(postNotifyTargets({ ...base, authorId: 'owner' }).sort()).toEqual(['m1', 'm2'])
  })

  it('collaborator posting notifies all members', () => {
    expect(postNotifyTargets({ ...base, authorId: 'collab' }).sort()).toEqual(['m1', 'm2'])
  })

  it('member posting notifies owner + collaborators only', () => {
    expect(postNotifyTargets({ ...base, authorId: 'm1' }).sort()).toEqual(['collab', 'owner'])
  })

  it('excludes the author when the author is also a member', () => {
    const out = postNotifyTargets({ ...base, authorId: 'owner', memberIds: ['owner', 'm1'] })
    expect(out).toEqual(['m1'])
  })

  it('de-duplicates repeated ids', () => {
    const out = postNotifyTargets({ ...base, authorId: 'm1', collabIds: ['collab', 'collab'], memberIds: ['m1'] })
    expect(out.sort()).toEqual(['collab', 'owner'])
  })

  it('returns empty when there is nobody else to notify', () => {
    expect(postNotifyTargets({ authorId: 'owner', ownerId: 'owner', collabIds: [], memberIds: [] })).toEqual([])
  })
})

describe('canViewCommunityHub', () => {
  it('published communities are public', () => {
    expect(canViewCommunityHub({ published: true, isPrivileged: false })).toBe(true)
  })
  it('unpublished communities are visible only to privileged viewers', () => {
    expect(canViewCommunityHub({ published: false, isPrivileged: false })).toBe(false)
    expect(canViewCommunityHub({ published: false, isPrivileged: true })).toBe(true)
  })
})
