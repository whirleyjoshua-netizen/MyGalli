import { describe, it, expect } from 'vitest'
import { sanitizeHubConfig, canDropToPool, canStitchReel } from './hub-config'
import { DEFAULT_HUB_CONFIG } from './types/hub-config'

describe('sanitizeHubConfig kollab', () => {
  it('defaults kollab for a config missing it (old configs)', () => {
    const c = sanitizeHubConfig({ sidebar: [], feed: {}, access: {} })
    expect(c.kollab).toEqual({ enabled: true, whoCanDrop: 'members', whoCanStitch: 'members' })
  })
  it('preserves an owner-only whoCanDrop and disabled flag', () => {
    const c = sanitizeHubConfig({ kollab: { enabled: false, whoCanDrop: 'owner-only' } })
    expect(c.kollab).toEqual({ enabled: false, whoCanDrop: 'owner-only', whoCanStitch: 'members' })
  })
  it('coerces a bogus whoCanDrop to members', () => {
    const c = sanitizeHubConfig({ kollab: { enabled: true, whoCanDrop: 'anyone' } })
    expect(c.kollab.whoCanDrop).toBe('members')
  })
  it('DEFAULT_HUB_CONFIG has kollab enabled', () => {
    expect(DEFAULT_HUB_CONFIG.kollab).toEqual({ enabled: true, whoCanDrop: 'members', whoCanStitch: 'members' })
  })
  it('drops a legacy requireApproval key without throwing', () => {
    const c = sanitizeHubConfig({ kollab: { enabled: true, whoCanDrop: 'members', requireApproval: true } })
    expect(c.kollab).toEqual({ enabled: true, whoCanDrop: 'members', whoCanStitch: 'members' })
  })
})

describe('canDropToPool', () => {
  it('members mode: any participant can drop', () => {
    expect(canDropToPool({ canParticipate: true, whoCanDrop: 'members', isPrivileged: false })).toBe(true)
  })
  it('members mode: non-participant cannot', () => {
    expect(canDropToPool({ canParticipate: false, whoCanDrop: 'members', isPrivileged: false })).toBe(false)
  })
  it('owner-only mode: only privileged', () => {
    expect(canDropToPool({ canParticipate: true, whoCanDrop: 'owner-only', isPrivileged: false })).toBe(false)
    expect(canDropToPool({ canParticipate: true, whoCanDrop: 'owner-only', isPrivileged: true })).toBe(true)
  })
})

describe('whoCanStitch', () => {
  it('defaults to members when absent', () => {
    expect(sanitizeHubConfig({ kollab: { enabled: true, whoCanDrop: 'members' } }).kollab.whoCanStitch).toBe('members')
  })

  it('preserves owner-only', () => {
    expect(sanitizeHubConfig({ kollab: { whoCanStitch: 'owner-only' } }).kollab.whoCanStitch).toBe('owner-only')
  })

  it('coerces an unknown value to members', () => {
    expect(sanitizeHubConfig({ kollab: { whoCanStitch: 'nonsense' } }).kollab.whoCanStitch).toBe('members')
  })

  it('leaves whoCanDrop independent of whoCanStitch', () => {
    const c = sanitizeHubConfig({ kollab: { whoCanDrop: 'owner-only', whoCanStitch: 'members' } })
    expect(c.kollab.whoCanDrop).toBe('owner-only')
    expect(c.kollab.whoCanStitch).toBe('members')
  })
})

describe('canStitchReel', () => {
  it('lets a participating member stitch in members mode', () => {
    expect(canStitchReel({ canParticipate: true, whoCanStitch: 'members', isPrivileged: false })).toBe(true)
  })

  it('blocks a plain member in owner-only mode', () => {
    expect(canStitchReel({ canParticipate: true, whoCanStitch: 'owner-only', isPrivileged: false })).toBe(false)
  })

  it('lets a moderator stitch in owner-only mode', () => {
    expect(canStitchReel({ canParticipate: false, whoCanStitch: 'owner-only', isPrivileged: true })).toBe(true)
  })

  it('blocks a non-participant in members mode', () => {
    expect(canStitchReel({ canParticipate: false, whoCanStitch: 'members', isPrivileged: false })).toBe(false)
  })
})
