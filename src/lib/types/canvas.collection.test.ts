import { describe, it, expect } from 'vitest'
import { createElement } from './canvas'

describe("createElement('collection-view')", () => {
  it('returns gallery defaults', () => {
    const el = createElement('collection-view')
    expect(el.type).toBe('collection-view')
    expect(el.collectionViewType).toBe('gallery')
    expect(el.collectionColumns).toBe(3)
    expect(el.collectionShowCategory).toBe(true)
    expect(el.collectionShowDescription).toBe(false)
  })
})
