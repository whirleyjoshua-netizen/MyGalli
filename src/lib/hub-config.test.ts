import { describe, it, expect } from 'vitest'
import { DEFAULT_HUB_CONFIG } from './types/hub-config'
import { sanitizeHubConfig, canPostWithAccess, buildHubPayloadKey } from './hub-config'

describe('sanitizeHubConfig', () => {
  it('null/garbage → default config', () => {
    expect(sanitizeHubConfig(null)).toEqual(DEFAULT_HUB_CONFIG)
    expect(sanitizeHubConfig('nope')).toEqual(DEFAULT_HUB_CONFIG)
    expect(sanitizeHubConfig(42)).toEqual(DEFAULT_HUB_CONFIG)
  })
  it('keeps valid sidebar order + enabled, drops unknown keys, dedupes, and fills missing widgets', () => {
    const out = sanitizeHubConfig({
      sidebar: [{ key: 'video', enabled: false }, { key: 'bogus', enabled: true }, { key: 'video', enabled: true }],
      feed: { composerEnabled: false, loadMoreEnabled: true, emptyStateText: 'x'.repeat(500) },
      access: { whoCanPost: 'owner-only' },
    })
    // video first (from input, first occurrence wins), then the missing members+resources appended enabled
    expect(out.sidebar.map((s) => s.key)).toEqual(['video', 'members', 'events', 'resources'])
    expect(out.sidebar[0]).toEqual({ key: 'video', enabled: false })
    expect(out.feed.composerEnabled).toBe(false)
    expect(out.feed.emptyStateText!.length).toBeLessThanOrEqual(200)
    expect(out.access.whoCanPost).toBe('owner-only')
  })
  it('coerces invalid whoCanPost + non-boolean flags to defaults', () => {
    const out = sanitizeHubConfig({ feed: { composerEnabled: 'yes' }, access: { whoCanPost: 'anyone' } })
    expect(out.access.whoCanPost).toBe('members')
    expect(out.feed.composerEnabled).toBe(true)
  })
})

describe('canPostWithAccess', () => {
  it("members mode = base canParticipate", () => {
    expect(canPostWithAccess({ canParticipate: true, whoCanPost: 'members', isPrivileged: false })).toBe(true)
    expect(canPostWithAccess({ canParticipate: false, whoCanPost: 'members', isPrivileged: false })).toBe(false)
  })
  it('owner-only mode = privileged only, even for members', () => {
    expect(canPostWithAccess({ canParticipate: true, whoCanPost: 'owner-only', isPrivileged: false })).toBe(false)
    expect(canPostWithAccess({ canParticipate: true, whoCanPost: 'owner-only', isPrivileged: true })).toBe(true)
  })
})

describe('buildHubPayloadKey', () => {
  it('is stable regardless of key order', () => {
    expect(buildHubPayloadKey({ a: 1, b: 2 })).toBe(buildHubPayloadKey({ b: 2, a: 1 }))
  })
})

describe('sanitizeHubConfig appearance', () => {
  it('defaults a config with no appearance key to galli', () => {
    // Every hub created before themes existed takes this path.
    expect(sanitizeHubConfig({}).appearance).toEqual({ theme: 'galli' })
  })

  it('keeps a valid theme', () => {
    expect(sanitizeHubConfig({ appearance: { theme: 'sunset' } }).appearance.theme).toBe('sunset')
  })

  it('coerces an unknown theme to galli rather than passing it through', () => {
    expect(sanitizeHubConfig({ appearance: { theme: 'neon-chartreuse' } }).appearance.theme).toBe('galli')
  })

  it('survives a non-object appearance', () => {
    expect(sanitizeHubConfig({ appearance: 'nope' }).appearance.theme).toBe('galli')
    expect(sanitizeHubConfig({ appearance: null }).appearance.theme).toBe('galli')
  })
})
