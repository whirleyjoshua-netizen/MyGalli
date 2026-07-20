import { describe, it, expect } from 'vitest'
import { sanitizeHubConfig } from './hub-config'
import { DEFAULT_HUB_CONFIG, HUB_UTILITY_KEYS } from './types/hub-config'

describe('sanitizeHubConfig — utility strip', () => {
  it('defaults to all three cards enabled, in order', () => {
    expect(sanitizeHubConfig(null).utility).toEqual([
      { key: 'notes', enabled: true },
      { key: 'ai', enabled: true },
      { key: 'tools', enabled: true },
    ])
  })

  // Existing hubs were saved before `utility` existed; they must gain it.
  it('appends the block to a config saved before the strip shipped', () => {
    const legacy = { sidebar: [{ key: 'members', enabled: true }], access: { whoCanPost: 'members' } }
    expect(sanitizeHubConfig(legacy).utility).toEqual(DEFAULT_HUB_CONFIG.utility)
  })

  it('preserves caller order and disabled flags for known keys', () => {
    const raw = { utility: [{ key: 'tools', enabled: false }, { key: 'notes', enabled: true }] }
    expect(sanitizeHubConfig(raw).utility).toEqual([
      { key: 'tools', enabled: false },
      { key: 'notes', enabled: true },
      { key: 'ai', enabled: true },
    ])
  })

  it('drops unknown keys and de-dupes, without throwing', () => {
    const raw = { utility: [{ key: 'evil' }, { key: 'notes', enabled: false }, { key: 'notes', enabled: true }] }
    const out = sanitizeHubConfig(raw).utility
    expect(out.map((w) => w.key)).toEqual(['notes', 'ai', 'tools'])
    expect(out[0].enabled).toBe(false)
  })

  it('coerces a non-array utility to the default', () => {
    expect(sanitizeHubConfig({ utility: 'nope' }).utility).toEqual(DEFAULT_HUB_CONFIG.utility)
    expect(sanitizeHubConfig({ utility: 42 }).utility).toEqual(DEFAULT_HUB_CONFIG.utility)
  })

  it('exports exactly the three keys', () => {
    expect([...HUB_UTILITY_KEYS]).toEqual(['notes', 'ai', 'tools'])
  })
})
