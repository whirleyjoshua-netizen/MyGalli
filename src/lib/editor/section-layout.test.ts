import { describe, it, expect } from 'vitest'
import { applySectionLayout } from './section-layout'
import type { Section } from '@/lib/types/canvas'

const threeCol: Section = {
  id: 's1', layout: 'three-column',
  columns: [
    { id: 'a', elements: [{ id: 'e1', type: 'heading' }] },
    { id: 'b', elements: [{ id: 'e2', type: 'image' }] },
    { id: 'c', elements: [{ id: 'e3', type: 'button' }, { id: 'e4', type: 'text' }] },
  ],
}

describe('applySectionLayout', () => {
  it('same count: updates layout, keeps columns identical', () => {
    const r = applySectionLayout(threeCol, 'three-column')
    expect(r.layout).toBe('three-column')
    expect(r.columns.map(c => c.id)).toEqual(['a', 'b', 'c'])
    expect(r.columns[2].elements.map(e => e.id)).toEqual(['e3', 'e4'])
  })

  it('reducing 3->2 keeps first 2 columns and appends dropped elements to the last kept column', () => {
    const r = applySectionLayout(threeCol, 'two-column')
    expect(r.layout).toBe('two-column')
    expect(r.columns).toHaveLength(2)
    expect(r.columns[0].id).toBe('a')
    expect(r.columns[1].id).toBe('b')
    // column c's elements (e3,e4) appended onto column b (after e2)
    expect(r.columns[1].elements.map(e => e.id)).toEqual(['e2', 'e3', 'e4'])
  })

  it('reducing 3->1 merges ALL elements into one column in order', () => {
    const r = applySectionLayout(threeCol, 'full-width')
    expect(r.columns).toHaveLength(1)
    expect(r.columns[0].id).toBe('a')
    expect(r.columns[0].elements.map(e => e.id)).toEqual(['e1', 'e2', 'e3', 'e4'])
  })

  it('increasing 1->3 keeps the existing column and adds empty deterministic columns', () => {
    const oneCol: Section = { id: 's2', layout: 'full-width', columns: [{ id: 'x', elements: [{ id: 'e1', type: 'text' }] }] }
    const r = applySectionLayout(oneCol, 'three-column')
    expect(r.columns).toHaveLength(3)
    expect(r.columns[0].id).toBe('x')
    expect(r.columns[0].elements.map(e => e.id)).toEqual(['e1'])
    expect(r.columns[1].elements).toEqual([])
    expect(r.columns[2].elements).toEqual([])
    // deterministic ids, unique
    expect(r.columns[1].id).toBe('s2-c1')
    expect(r.columns[2].id).toBe('s2-c2')
    expect(new Set(r.columns.map(c => c.id)).size).toBe(3)
  })

  it('does not mutate the input section', () => {
    const snapshot = JSON.stringify(threeCol)
    applySectionLayout(threeCol, 'full-width')
    expect(JSON.stringify(threeCol)).toBe(snapshot)
  })
})
