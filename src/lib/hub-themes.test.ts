import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { HUB_THEMES, resolveHubTheme } from './hub-themes'
import { HUB_THEME_KEYS } from './types/hub-config'

describe('HUB_THEMES', () => {
  it('covers every declared key exactly once', () => {
    expect(HUB_THEMES.map((t) => t.key).sort()).toEqual([...HUB_THEME_KEYS].sort())
  })

  it('gives every preset all three colours and a label', () => {
    for (const t of HUB_THEMES) {
      expect(t.label.length).toBeGreaterThan(0)
      for (const field of ['primary', 'primaryForeground', 'accent'] as const) {
        // HSL triple, e.g. "153 64% 53%" — the format the CSS vars already use
        expect(t[field]).toMatch(/^\d{1,3} \d{1,3}% \d{1,3}%$/)
      }
    }
  })

  it('keeps the galli preset identical to the live --primary in globals.css', () => {
    // THE regression guard for "existing hubs render unchanged". If this fails,
    // shipping would silently restyle every hub that never picked a theme.
    const css = readFileSync(resolve(process.cwd(), 'src/app/globals.css'), 'utf8')
    const match = css.match(/--primary:\s*([^;]+);/)
    // If the variable is ever renamed, fail loudly rather than silently passing.
    expect(match, '--primary not found in globals.css').not.toBeNull()
    expect(resolveHubTheme('galli').primary).toBe(match![1].trim())
  })
})

describe('resolveHubTheme', () => {
  it('returns the requested preset', () => {
    expect(resolveHubTheme('sunset').key).toBe('sunset')
  })

  it('falls back to galli for unknown, empty or undefined keys', () => {
    expect(resolveHubTheme('nonsense').key).toBe('galli')
    expect(resolveHubTheme('').key).toBe('galli')
    expect(resolveHubTheme(undefined).key).toBe('galli')
  })
})
