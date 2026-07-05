import { describe, it, expect } from 'vitest'
import { createElement } from './canvas'

describe("createElement('map')", () => {
  it('returns the default map shape', () => {
    const el = createElement('map')
    expect(el.type).toBe('map')
    expect(el.mapPlaces).toEqual([])
    expect(el.mapTileStyle).toBe('light')
    expect(el.mapHeight).toBe(420)
    expect(el.mapConnectLine).toBe(false)
    expect(el.mapFitView).toBe(true)
    expect(el.mapCategories).toEqual([{ key: 'visited', label: 'Visited', color: '#39D98A' }])
  })
})
