import { describe, it, expect } from 'vitest'
import { selectVisibleMembers, computePositions, type MemberRow } from './collections'

function row(memberId: string, position: number, published: boolean): MemberRow {
  return {
    memberId,
    position,
    member: {
      published,
      slug: `${memberId}-slug`,
      title: `${memberId} title`,
      description: null,
      coverImage: null,
      category: null,
      user: { username: 'coach' },
    },
  }
}

describe('selectVisibleMembers', () => {
  it('drops unpublished members and sorts by position', () => {
    const rows = [row('b', 1, true), row('a', 0, true), row('c', 2, false)]
    const cards = selectVisibleMembers(rows)
    expect(cards.map((c) => c.id)).toEqual(['a', 'b'])
    expect(cards[0]).toMatchObject({ username: 'coach', slug: 'a-slug', title: 'a title' })
  })

  it('returns [] for empty input', () => {
    expect(selectVisibleMembers([])).toEqual([])
  })
})

describe('computePositions', () => {
  it('assigns 0-based positions in order', () => {
    expect(computePositions(['x', 'y', 'z'])).toEqual([
      { memberId: 'x', position: 0 },
      { memberId: 'y', position: 1 },
      { memberId: 'z', position: 2 },
    ])
  })
})
