import { describe, it, expect } from 'vitest'
import { filterEntries, groupByCategory, displayNumber, newEntryId } from './index-element'
import type { IndexEntry } from './types/canvas'

const entries: IndexEntry[] = [
  { id: '1', label: 'NASA Mars Data', subtitle: 'nasa.gov', category: 'Research', tags: ['space'] },
  { id: '2', label: 'Climate Study', subtitle: 'journal.com', category: 'Research' },
  { id: '3', label: 'Deep Work', subtitle: 'Cal Newport', category: 'Books' },
  { id: '4', label: 'Loose Note', subtitle: '' }, // no category
]

describe('filterEntries', () => {
  it('returns all entries for an empty or whitespace query', () => {
    expect(filterEntries(entries, '')).toHaveLength(4)
    expect(filterEntries(entries, '   ')).toHaveLength(4)
  })
  it('matches label case-insensitively', () => {
    const r = filterEntries(entries, 'mars')
    expect(r.map(e => e.id)).toEqual(['1'])
  })
  it('matches subtitle', () => {
    const r = filterEntries(entries, 'journal')
    expect(r.map(e => e.id)).toEqual(['2'])
  })
  it('matches tags', () => {
    const r = filterEntries(entries, 'space')
    expect(r.map(e => e.id)).toEqual(['1'])
  })
  it('returns empty array when nothing matches', () => {
    expect(filterEntries(entries, 'zzzzz')).toEqual([])
  })
})

describe('groupByCategory', () => {
  it('groups entries preserving first-seen category order', () => {
    const groups = groupByCategory(entries)
    expect(groups.map(g => g.category)).toEqual(['Research', 'Books', ''])
    expect(groups[0].entries.map(e => e.id)).toEqual(['1', '2'])
    expect(groups[2].entries.map(e => e.id)).toEqual(['4'])
  })
  it('puts everything in one empty-category group when none are set', () => {
    const groups = groupByCategory([{ id: 'a', label: 'x' }])
    expect(groups).toHaveLength(1)
    expect(groups[0].category).toBe('')
  })
})

describe('displayNumber', () => {
  it('zero-pads to three digits, 1-based', () => {
    expect(displayNumber(0)).toBe('001')
    expect(displayNumber(11)).toBe('012')
  })
  it('does not pad beyond three digits', () => {
    expect(displayNumber(999)).toBe('1000')
  })
})

describe('newEntryId', () => {
  it('produces unique ids with the idx- prefix', () => {
    const a = newEntryId()
    const b = newEntryId()
    expect(a).toMatch(/^idx-/)
    expect(a).not.toBe(b)
  })
})
