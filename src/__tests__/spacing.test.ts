import { describe, it, expect } from 'vitest'
import {
  DEFAULT_SPACING_CONFIG,
  getSpacingStyles,
  getContainerStyle,
  type SpacingConfig,
} from '@/lib/types/spacing'

describe('getSpacingStyles', () => {
  it('resolves the default config to the current published-page look', () => {
    const s = getSpacingStyles(DEFAULT_SPACING_CONFIG)
    expect(s.maxWidth).toBe(1152) // max-w-6xl
    expect(s.paddingY).toBe(48) // py-12
    expect(s.paddingX).toBe(16) // px-4
    expect(s.sectionGap).toBe(32) // space-y-8
    expect(s.columnGap).toBe(24) // gap-6
    expect(s.elementGap).toBe(16) // space-y-4
  })

  it('falls back to defaults for null (legacy pages)', () => {
    expect(getSpacingStyles(null)).toEqual(getSpacingStyles(DEFAULT_SPACING_CONFIG))
    expect(getSpacingStyles(undefined)).toEqual(getSpacingStyles(DEFAULT_SPACING_CONFIG))
  })

  it('merges partial configs over defaults', () => {
    const s = getSpacingStyles({ contentWidth: 'narrow' } as SpacingConfig)
    expect(s.maxWidth).toBe(720)
    expect(s.sectionGap).toBe(32) // untouched → default
  })

  it('full width resolves to no max-width', () => {
    expect(getSpacingStyles({ ...DEFAULT_SPACING_CONFIG, contentWidth: 'full' }).maxWidth).toBeUndefined()
  })

  it('scales section and column gap together', () => {
    const compact = getSpacingStyles({ ...DEFAULT_SPACING_CONFIG, sectionSpacing: 'compact' })
    const relaxed = getSpacingStyles({ ...DEFAULT_SPACING_CONFIG, sectionSpacing: 'relaxed' })
    expect(compact.sectionGap).toBeLessThan(relaxed.sectionGap)
    expect(compact.columnGap).toBeLessThan(relaxed.columnGap)
  })

  it('page padding none zeroes vertical padding but keeps a horizontal gutter', () => {
    const s = getSpacingStyles({ ...DEFAULT_SPACING_CONFIG, pagePadding: 'none' })
    expect(s.paddingY).toBe(0)
    expect(s.paddingX).toBeGreaterThan(0)
  })
})

describe('getContainerStyle', () => {
  it('centers content and applies pixel max-width for bounded widths', () => {
    const style = getContainerStyle(DEFAULT_SPACING_CONFIG)
    expect(style.maxWidth).toBe('1152px')
    expect(style.marginLeft).toBe('auto')
    expect(style.marginRight).toBe('auto')
  })

  it('uses 100% for full width', () => {
    expect(getContainerStyle({ ...DEFAULT_SPACING_CONFIG, contentWidth: 'full' }).maxWidth).toBe('100%')
  })
})
