import { describe, it, expect } from 'vitest'
import { activityRows, isQuiet, type ActivityCounts } from './hub-activity'

const counts = (p: number, d: number, m: number): ActivityCounts =>
  ({ newPosts: p, newDrops: d, newMembers: m })

describe('activityRows', () => {
  it('returns rows in a stable order: posts, clips, members', () => {
    expect(activityRows(counts(4, 7, 2)).map((r) => r.key)).toEqual(['posts', 'clips', 'members'])
  })

  it('labels plurals', () => {
    expect(activityRows(counts(4, 7, 2)).map((r) => r.label))
      .toEqual(['4 new posts', '7 clips added', '2 new members'])
  })

  // Off-by-one in pluralisation is the classic bug here.
  it('labels singulars at exactly 1', () => {
    expect(activityRows(counts(1, 1, 1)).map((r) => r.label))
      .toEqual(['1 new post', '1 clip added', '1 new member'])
  })

  it('omits zero rows entirely', () => {
    expect(activityRows(counts(0, 3, 0)).map((r) => r.key)).toEqual(['clips'])
  })

  it('returns nothing when all counts are zero', () => {
    expect(activityRows(counts(0, 0, 0))).toEqual([])
  })

  it('treats negative or non-finite counts as zero rather than rendering nonsense', () => {
    expect(activityRows(counts(-2, Number.NaN, 3)).map((r) => r.key)).toEqual(['members'])
  })
})

describe('isQuiet', () => {
  it('is true only when every count is zero', () => {
    expect(isQuiet(counts(0, 0, 0))).toBe(true)
    expect(isQuiet(counts(0, 0, 1))).toBe(false)
    expect(isQuiet(counts(5, 0, 0))).toBe(false)
  })
})
