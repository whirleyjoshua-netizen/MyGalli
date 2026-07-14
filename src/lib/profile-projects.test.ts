import { describe, it, expect } from 'vitest'
import { toProjectCards, type ProjectDisplay } from './profile-projects'

const base = (over: Partial<ProjectDisplay>): ProjectDisplay => ({
  id: 'x', slug: 's', title: 'T', coverImage: null, views: 0, kind: 'page', ...over,
})

describe('toProjectCards', () => {
  it('labels pages "Page" and boards "Board"', () => {
    const cards = toProjectCards([
      base({ id: 'p', kind: 'page' }),
      base({ id: 'b', kind: 'collection' }),
    ])
    expect(cards.map((c) => [c.id, c.typeLabel])).toEqual([['p', 'Page'], ['b', 'Board']])
  })

  it('excludes non page/board kinds (e.g. profile)', () => {
    const cards = toProjectCards([base({ id: 'pr', kind: 'profile' }), base({ id: 'p', kind: 'page' })])
    expect(cards.map((c) => c.id)).toEqual(['p'])
  })

  it('floats the featured id to the front, preserving the rest', () => {
    const cards = toProjectCards(
      [base({ id: 'a' }), base({ id: 'b' }), base({ id: 'c' })],
      'b',
    )
    expect(cards.map((c) => c.id)).toEqual(['b', 'a', 'c'])
  })
})
