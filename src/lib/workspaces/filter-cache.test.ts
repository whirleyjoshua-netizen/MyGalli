import { describe, it, expect, beforeEach } from 'vitest'
import {
  filterCacheKey,
  getCachedFilter,
  setCachedFilter,
  clearFilterCache,
  FILTER_CACHE_TTL_MS,
} from './filter-cache'
import type { FilterField } from './filter'

const FIELDS = [
  { id: 'f1', key: 'sport', label: 'Sport', type: 'choice', position: 0, config: { options: ['Soccer', 'Tennis'] } },
  { id: 'f2', key: 'fee', label: 'Fee', type: 'currency', position: 1, config: { symbol: '$' } },
] as unknown as FilterField[]

const value = { filter: { op: 'and', conditions: [] }, summary: 'Sport is Soccer' }

beforeEach(() => clearFilterCache())

describe('filterCacheKey', () => {
  it('is identical for the same workspace, schema and question', () => {
    expect(filterCacheKey('w1', FIELDS, 'soccer players')).toBe(filterCacheKey('w1', FIELDS, 'soccer players'))
  })

  it('normalises case and whitespace in the question', () => {
    expect(filterCacheKey('w1', FIELDS, '  Soccer   Players ')).toBe(filterCacheKey('w1', FIELDS, 'soccer players'))
  })

  it('differs across workspaces', () => {
    expect(filterCacheKey('w1', FIELDS, 'q')).not.toBe(filterCacheKey('w2', FIELDS, 'q'))
  })

  it('differs when a column is retyped', () => {
    const retyped = FIELDS.map((f) => (f.key === 'fee' ? { ...f, type: 'number' } : f)) as FilterField[]
    expect(filterCacheKey('w1', FIELDS, 'q')).not.toBe(filterCacheKey('w1', retyped, 'q'))
  })

  it('differs when a choice column gains an option', () => {
    const extra = FIELDS.map((f) =>
      f.key === 'sport' ? { ...f, config: { options: ['Soccer', 'Tennis', 'Rugby'] } } : f
    ) as FilterField[]
    expect(filterCacheKey('w1', FIELDS, 'q')).not.toBe(filterCacheKey('w1', extra, 'q'))
  })

  it('is stable regardless of the order options are listed in', () => {
    const reordered = FIELDS.map((f) =>
      f.key === 'sport' ? { ...f, config: { options: ['Tennis', 'Soccer'] } } : f
    ) as FilterField[]
    expect(filterCacheKey('w1', FIELDS, 'q')).toBe(filterCacheKey('w1', reordered, 'q'))
  })
})

describe('get/set', () => {
  it('returns null on a miss', () => {
    expect(getCachedFilter('nope')).toBeNull()
  })

  it('round-trips a stored value', () => {
    setCachedFilter('k', value)
    expect(getCachedFilter('k')).toEqual(value)
  })

  it('expires an entry after the TTL and evicts it', () => {
    const t0 = 1_000_000
    setCachedFilter('k', value, t0)
    expect(getCachedFilter('k', t0 + FILTER_CACHE_TTL_MS - 1)).toEqual(value)
    expect(getCachedFilter('k', t0 + FILTER_CACHE_TTL_MS + 1)).toBeNull()
  })

  it('clearFilterCache empties the store', () => {
    setCachedFilter('k', value)
    clearFilterCache()
    expect(getCachedFilter('k')).toBeNull()
  })

  it('never stores record data — only the filter structure and summary', () => {
    // Documents the contract: callers put a {filter, summary}, nothing else.
    setCachedFilter('k', value)
    const got = getCachedFilter('k')!
    expect(Object.keys(got).sort()).toEqual(['filter', 'summary'])
  })
})
