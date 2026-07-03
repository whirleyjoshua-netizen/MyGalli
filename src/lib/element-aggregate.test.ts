import { describe, it, expect } from 'vitest'
import { aggregatePoll, aggregateRating, aggregateShortAnswer, toRecords, type ResponseRecord, type BulletinResponseRow } from './element-aggregate'
import type { CanvasElement } from '@/lib/types/canvas'

const poll: CanvasElement = { id: 'b1', type: 'poll', pollQuestion: 'Pick', pollOptions: ['A', 'B'], pollAllowMultiple: false }
const rating: CanvasElement = { id: 'b2', type: 'rating', ratingQuestion: 'Rate', ratingMax: 5, ratingStyle: 'stars' }
const sa: CanvasElement = { id: 'b3', type: 'shortanswer', shortAnswerQuestion: 'Say' }

const who = (userId: string, name: string) => ({ userId, name, avatar: null })

describe('aggregatePoll', () => {
  it('counts selections, computes percentages, and builds an identified roster', () => {
    const records: ResponseRecord[] = [
      { responses: { b1: { type: 'poll', answer: ['A'] } }, identity: who('u1', 'Maya') },
      { responses: { b1: { type: 'poll', answer: ['B'] } }, identity: who('u2', 'Jon') },
      { responses: { b1: { type: 'poll', answer: ['A'] } }, identity: who('u3', 'Al') },
      { responses: { 'other': { type: 'poll', answer: ['A'] } }, identity: who('u4', 'X') }, // other element - ignored
    ]
    const out = aggregatePoll(poll, records)
    expect(out.totalVoters).toBe(3)
    expect(out.distribution).toEqual([
      { option: 'A', count: 2, percentage: 67 },
      { option: 'B', count: 1, percentage: 33 },
    ])
    expect(out.respondents.map((r) => r.user.name)).toEqual(['Maya', 'Jon', 'Al'])
    expect(out.respondents[0].answer).toEqual(['A'])
  })

  it('leaves the roster empty when responses are anonymous (page path)', () => {
    const out = aggregatePoll(poll, [{ responses: { b1: { type: 'poll', answer: ['A'] } } }])
    expect(out.totalVoters).toBe(1)
    expect(out.respondents).toEqual([])
  })
})

describe('aggregateRating', () => {
  it('averages valid ratings and rosters who gave what', () => {
    const records: ResponseRecord[] = [
      { responses: { b2: { type: 'rating', answer: 4 } }, identity: who('u1', 'Maya') },
      { responses: { b2: { type: 'rating', answer: 2 } }, identity: who('u2', 'Jon') },
      { responses: { b2: { type: 'rating', answer: 99 } }, identity: who('u3', 'Bad') }, // out of range - ignored
    ]
    const out = aggregateRating(rating, records)
    expect(out.responseCount).toBe(2)
    expect(out.average).toBe(3)
    expect(out.respondents.map((r) => [r.user.name, r.answer])).toEqual([['Maya', 4], ['Jon', 2]])
  })
})

describe('aggregateShortAnswer', () => {
  it('collects non-empty answers with an identified roster', () => {
    const records: ResponseRecord[] = [
      { responses: { b3: { type: 'shortanswer', answer: 'Hello' } }, submittedAt: new Date('2026-07-03T00:00:00Z'), identity: who('u1', 'Maya') },
      { responses: { b3: { type: 'shortanswer', answer: '' } }, identity: who('u2', 'Empty') }, // blank - ignored
    ]
    const out = aggregateShortAnswer(sa, records)
    expect(out.responseCount).toBe(1)
    expect(out.recentAnswers[0].answer).toBe('Hello')
    expect(out.respondents.map((r) => r.user.name)).toEqual(['Maya'])
  })
})

describe('toRecords', () => {
  it('maps Prisma rows to identified records, falling back to username when name is null', () => {
    const rows: BulletinResponseRow[] = [
      { userId: 'u1', responses: { b1: { type: 'poll', answer: ['A'] } }, createdAt: new Date('2026-07-03T00:00:00Z'), user: { name: 'Maya', username: 'maya', avatar: null } },
      { userId: 'u2', responses: {}, createdAt: '2026-07-03', user: { name: null, username: 'jon', avatar: 'a.png' } },
    ]
    const recs = toRecords(rows)
    expect(recs[0].identity).toEqual({ userId: 'u1', name: 'Maya', avatar: null })
    expect(recs[1].identity).toEqual({ userId: 'u2', name: 'jon', avatar: 'a.png' })
  })

  it('omits identity when includeIdentity=false, so aggregate respondents stay empty', () => {
    const rows: BulletinResponseRow[] = [
      { userId: 'u1', responses: { b1: { type: 'poll', answer: ['A'] } }, createdAt: new Date('2026-07-03T00:00:00Z'), user: { name: 'Maya', username: 'maya', avatar: null } },
    ]
    const recs = toRecords(rows, false)
    expect(recs[0].identity).toBeUndefined()
    const poll: CanvasElement = { id: 'b1', type: 'poll', pollQuestion: 'Pick', pollOptions: ['A', 'B'] }
    const out = aggregatePoll(poll, recs)
    expect(out.totalVoters).toBe(1)          // still counted
    expect(out.respondents).toEqual([])      // but no identities leaked
  })
})
