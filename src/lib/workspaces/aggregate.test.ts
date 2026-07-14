import { describe, it, expect } from 'vitest'
import { computeAggregate } from './aggregate'

const recs = (vals: any[]) => vals.map((v) => ({ data: { grade: v } }))

describe('computeAggregate', () => {
  it('count = row count regardless of field values', () => {
    expect(computeAggregate(recs([90, null, 'x']), 'grade', 'count')).toBe(3)
    expect(computeAggregate([], 'grade', 'count')).toBe(0)
  })
  it('sum/avg/min/max over finite numbers only', () => {
    const r = recs([90, 80, 100, null, 'x'])
    expect(computeAggregate(r, 'grade', 'sum')).toBe(270)
    expect(computeAggregate(r, 'grade', 'avg')).toBe(90)
    expect(computeAggregate(r, 'grade', 'min')).toBe(80)
    expect(computeAggregate(r, 'grade', 'max')).toBe(100)
  })
  it('avg rounds to <= 2 decimals', () => {
    expect(computeAggregate(recs([1, 2, 2]), 'grade', 'avg')).toBe(1.67)
  })
  it('empty numeric set -> null for sum/avg/min/max', () => {
    const r = recs([null, 'x'])
    for (const op of ['sum', 'avg', 'min', 'max'] as const) {
      expect(computeAggregate(r, 'grade', op)).toBeNull()
    }
  })
})
