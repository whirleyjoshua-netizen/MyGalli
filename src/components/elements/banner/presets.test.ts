import { describe, it, expect } from 'vitest'
import { BANNER_PRESETS, resolveFill } from './presets'

describe('BANNER_PRESETS', () => {
  it('covers all seven presets', () => {
    expect(Object.keys(BANNER_PRESETS).sort()).toEqual(
      ['band', 'crest', 'hero', 'notice', 'pennant', 'ribbon', 'strip']
    )
  })

  it('gives heraldic presets a shape and announcement presets none', () => {
    expect(BANNER_PRESETS.ribbon.clipPath).toBeTruthy()
    expect(BANNER_PRESETS.pennant.clipPath).toBeTruthy()
    expect(BANNER_PRESETS.strip.clipPath).toBeUndefined()
    expect(BANNER_PRESETS.hero.clipPath).toBeUndefined()
  })

  it('scales height from strip up to hero', () => {
    expect(BANNER_PRESETS.strip.minHeight).toBeLessThan(BANNER_PRESETS.band.minHeight)
    expect(BANNER_PRESETS.band.minHeight).toBeLessThan(BANNER_PRESETS.hero.minHeight)
  })
})

describe('resolveFill', () => {
  it('resolves a brand token to a solid color with no scrim', () => {
    const f = resolveFill('token', 'primary')
    expect(f.background).toBe('#39D98A')
    expect(f.scrim).toBe(false)
    expect(f.text).toBe('dark')
  })

  it('uses light text on the dark anchor token', () => {
    expect(resolveFill('token', 'anchor').text).toBe('light')
  })

  it('always scrims gradients and forces light text', () => {
    const f = resolveFill('gradient', 'mint-aqua')
    expect(f.background).toContain('linear-gradient')
    expect(f.scrim).toBe(true)
    expect(f.text).toBe('light')
  })

  it('always scrims images and forces light text', () => {
    const f = resolveFill('image', 'https://blob.example/x.jpg')
    expect(f.background).toContain('https://blob.example/x.jpg')
    expect(f.scrim).toBe(true)
    expect(f.text).toBe('light')
  })

  it('falls back to the primary token when the value is unknown or missing', () => {
    expect(resolveFill('token', 'nope').background).toBe('#39D98A')
    expect(resolveFill(undefined, undefined).background).toBe('#39D98A')
    expect(resolveFill('gradient', 'nope').background).toContain('linear-gradient')
  })
})
