import { describe, it, expect } from 'vitest'
import { createElement } from './canvas'

describe('createElement("banner")', () => {
  it('produces the documented default shape', () => {
    const el = createElement('banner')
    expect(el.type).toBe('banner')
    expect(el.bannerPreset).toBe('ribbon')
    expect(el.bannerHeading).toBe('Your headline')
    expect(el.bannerSubtext).toBe('')
    expect(el.bannerFillKind).toBe('token')
    expect(el.bannerFillValue).toBe('primary')
    expect(el.bannerLinkLabel).toBe('')
    expect(el.bannerLinkUrl).toBe('')
  })

  it('gives each banner a distinct id', () => {
    expect(createElement('banner').id).not.toBe(createElement('banner').id)
  })
})
