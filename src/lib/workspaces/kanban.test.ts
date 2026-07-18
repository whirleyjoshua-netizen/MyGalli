import { describe, it, expect } from 'vitest'
import { groupRecordsByField } from './kanban'

const r = (id: string, sport: any) => ({ id, data: { sport }, updatedAt: '' })

describe('groupRecordsByField', () => {
  it('buckets records by option, null/unknown -> __uncategorized', () => {
    const recs = [r('1', 'Soccer'), r('2', 'Tennis'), r('3', null), r('4', 'Ghost'), r('5', 'Soccer')]
    const g = groupRecordsByField(recs as any, 'sport', ['Soccer', 'Tennis', 'None'])
    expect(g['Soccer'].map((x) => x.id)).toEqual(['1', '5'])
    expect(g['Tennis'].map((x) => x.id)).toEqual(['2'])
    expect(g['None']).toEqual([])
    expect(g['__uncategorized'].map((x) => x.id)).toEqual(['3', '4'])
  })
})
