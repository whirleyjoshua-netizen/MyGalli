import { describe, it, expect } from 'vitest'
import {
  parseScope,
  scopeKeyFor,
  ackStatus,
  buildRoster,
  reAckProgress,
  rosterCsv,
} from './acknowledgment'

describe('parseScope', () => {
  it('accepts a display context', () => {
    expect(parseScope({ displayId: 'd1' })).toEqual({ displayId: 'd1' })
  })

  it('accepts a hub post context', () => {
    expect(parseScope({ hubPostId: 'p1' })).toEqual({ hubPostId: 'p1' })
  })

  it('rejects both contexts at once', () => {
    expect(parseScope({ displayId: 'd1', hubPostId: 'p1' })).toBeNull()
  })

  it('rejects neither', () => {
    expect(parseScope({})).toBeNull()
  })

  it('rejects non-string ids', () => {
    expect(parseScope({ displayId: 42 })).toBeNull()
    expect(parseScope({ displayId: '' })).toBeNull()
  })
})

describe('scopeKeyFor', () => {
  it('namespaces a display element', () => {
    expect(scopeKeyFor('el-1', { displayId: 'd1' })).toBe('display:d1:el-1')
  })

  it('namespaces a hub post element', () => {
    expect(scopeKeyFor('blk-acknowledgment-7', { hubPostId: 'p1' })).toBe('hubpost:p1:blk-acknowledgment-7')
  })

  it('keeps the same element id in two posts distinct', () => {
    const a = scopeKeyFor('blk-acknowledgment-7', { hubPostId: 'p1' })
    const b = scopeKeyFor('blk-acknowledgment-7', { hubPostId: 'p2' })
    expect(a).not.toBe(b)
  })
})

const rec = (userId: string, round: number, createdAt = '2026-07-20T10:00:00.000Z', name = 'Ada Lovelace', username = 'ada') =>
  ({ userId, round, createdAt, user: { name, username } })

describe('ackStatus', () => {
  it('is none for a signed-out viewer', () => {
    expect(ackStatus([rec('u1', 0)], 0, null)).toBe('none')
  })

  it('is none when the viewer has no record', () => {
    expect(ackStatus([rec('u1', 0)], 0, 'u2')).toBe('none')
  })

  it('is current when the viewer acknowledged this round', () => {
    expect(ackStatus([rec('u1', 2)], 2, 'u1')).toBe('current')
  })

  it('is stale when the viewer only acknowledged an earlier round', () => {
    expect(ackStatus([rec('u1', 1)], 2, 'u1')).toBe('stale')
  })

  it('prefers the current round when the viewer has records in both', () => {
    expect(ackStatus([rec('u1', 1), rec('u1', 2)], 2, 'u1')).toBe('current')
  })
})

describe('buildRoster', () => {
  it('includes only current-round records, newest first', () => {
    const records = [
      rec('u1', 1, '2026-07-19T10:00:00.000Z', 'Old Round', 'old'),
      rec('u2', 2, '2026-07-20T09:00:00.000Z', 'Grace Hopper', 'grace'),
      rec('u3', 2, '2026-07-20T11:00:00.000Z', 'Alan Turing', 'alan'),
    ]
    const roster = buildRoster(records, 2)
    expect(roster.map((r) => r.username)).toEqual(['alan', 'grace'])
  })

  it('falls back to the username when the name is missing', () => {
    const roster = buildRoster([rec('u1', 0, '2026-07-20T10:00:00.000Z', null as unknown as string, 'ada')], 0)
    expect(roster[0].name).toBe('ada')
  })

  it('serializes the timestamp as an ISO string', () => {
    const roster = buildRoster([{ userId: 'u1', round: 0, createdAt: new Date('2026-07-20T10:00:00.000Z') }], 0)
    expect(roster[0].acknowledgedAt).toBe('2026-07-20T10:00:00.000Z')
  })
})

describe('reAckProgress', () => {
  it('counts the current round against the previous one', () => {
    const records = [rec('u1', 0), rec('u2', 0), rec('u3', 0), rec('u1', 1)]
    expect(reAckProgress(records, 1)).toEqual({ current: 1, previous: 3 })
  })

  it('reports no previous round at round zero', () => {
    expect(reAckProgress([rec('u1', 0)], 0)).toEqual({ current: 1, previous: 0 })
  })
})

describe('rosterCsv', () => {
  it('writes a header and one row per entry', () => {
    const csv = rosterCsv([
      { userId: 'u1', name: 'Ada Lovelace', username: 'ada', acknowledgedAt: '2026-07-20T10:00:00.000Z' },
    ])
    expect(csv).toBe('Name,Username,Acknowledged At\r\nAda Lovelace,ada,2026-07-20T10:00:00.000Z')
  })

  it('quotes and escapes fields containing commas or quotes', () => {
    const csv = rosterCsv([
      { userId: 'u1', name: 'Lovelace, Ada "The Countess"', username: 'ada', acknowledgedAt: '2026-07-20T10:00:00.000Z' },
    ])
    expect(csv).toContain('"Lovelace, Ada ""The Countess"""')
  })

  it('returns only the header for an empty roster', () => {
    expect(rosterCsv([])).toBe('Name,Username,Acknowledged At')
  })
})
