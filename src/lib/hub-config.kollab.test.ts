import { describe, it, expect } from 'vitest'
import { sanitizeHubConfig, canDropToPool } from './hub-config'
import { DEFAULT_HUB_CONFIG } from './types/hub-config'

describe('sanitizeHubConfig kollab', () => {
  it('defaults kollab for a config missing it (old configs)', () => {
    const c = sanitizeHubConfig({ sidebar: [], feed: {}, access: {} })
    expect(c.kollab).toEqual({ enabled: true, whoCanDrop: 'members', requireApproval: false })
  })
  it('preserves an owner-only whoCanDrop and disabled flag', () => {
    const c = sanitizeHubConfig({ kollab: { enabled: false, whoCanDrop: 'owner-only' } })
    expect(c.kollab).toEqual({ enabled: false, whoCanDrop: 'owner-only', requireApproval: false })
  })
  it('coerces a bogus whoCanDrop to members', () => {
    const c = sanitizeHubConfig({ kollab: { enabled: true, whoCanDrop: 'anyone' } })
    expect(c.kollab.whoCanDrop).toBe('members')
  })
  it('DEFAULT_HUB_CONFIG has kollab enabled', () => {
    expect(DEFAULT_HUB_CONFIG.kollab).toEqual({ enabled: true, whoCanDrop: 'members', requireApproval: false })
  })
  it('defaults requireApproval to false so existing hubs are unchanged', () => {
    expect(sanitizeHubConfig(null).kollab.requireApproval).toBe(false)
  })
  it('coerces a non-boolean requireApproval', () => {
    expect(sanitizeHubConfig({ kollab: { requireApproval: 'yes' } }).kollab.requireApproval).toBe(false)
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
