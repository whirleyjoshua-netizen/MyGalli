import { describe, it, expect } from 'vitest'
import { findLiveFeedIds } from './live-feed-reconcile'

describe('findLiveFeedIds', () => {
  it('finds ids nested in sections/columns/elements', () => {
    const sections = [
      { id: 's1', columns: [
        { id: 'c1', elements: [
          { id: 'el-1', type: 'text' },
          { id: 'el-2', type: 'live-feed' },
        ] },
      ] },
    ]
    expect(findLiveFeedIds(sections)).toEqual(['el-2'])
  })

  it('finds ids inside tab-shaped nesting and dedupes repeats', () => {
    const tabs = [
      { id: 't1', sections: [{ columns: [{ elements: [{ id: 'el-9', type: 'live-feed' }] }] }] },
      { id: 't2', sections: [{ columns: [{ elements: [{ id: 'el-9', type: 'live-feed' }] }] }] },
    ]
    expect(findLiveFeedIds(tabs)).toEqual(['el-9']) // deduped
  })

  it('returns [] for non-objects and empty input', () => {
    expect(findLiveFeedIds(null)).toEqual([])
    expect(findLiveFeedIds([])).toEqual([])
    expect(findLiveFeedIds('nope')).toEqual([])
  })
})
