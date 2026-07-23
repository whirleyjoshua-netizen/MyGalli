import { describe, it, expect } from 'vitest'
import { presetWhere, describeCandidates, PRESETS, CANDIDATE_CAP, type CandidateRow } from './candidates'

const NOW = new Date('2026-07-22T12:00:00.000Z')
const row = (over: Partial<CandidateRow> = {}): CandidateRow => ({
  id: 'd1',
  type: 'video',
  caption: null,
  durationSec: 4,
  createdAt: new Date('2026-07-21T12:00:00.000Z'),
  aiTags: null,
  author: { username: 'maria' },
  ...over,
})

describe('presetWhere', () => {
  it('always scopes to the hub and approved status', () => {
    for (const p of PRESETS) {
      const w = presetWhere(p, 'h1', NOW) as any
      expect(w.hubId).toBe('h1')
      expect(w.status).toBe('approved')
    }
  })

  it('recent narrows to the last 7 days', () => {
    const w = presetWhere('recent', 'h1', NOW) as any
    expect(w.createdAt.gte).toEqual(new Date('2026-07-15T12:00:00.000Z'))
  })

  it('everyone and best do not filter by date', () => {
    expect((presetWhere('everyone', 'h1', NOW) as any).createdAt).toBeUndefined()
    expect((presetWhere('best', 'h1', NOW) as any).createdAt).toBeUndefined()
  })

  it('event narrows to the last 2 days', () => {
    const w = presetWhere('event', 'h1', NOW) as any
    expect(w.createdAt.gte).toEqual(new Date('2026-07-20T12:00:00.000Z'))
  })

  // Spec decision D7: drops predating the consentText column are eligible.
  // This test exists to make reversing that decision a deliberate act rather
  // than an accident — if you add a consentText filter, this fails.
  it('does not filter on consentText', () => {
    for (const p of PRESETS) {
      expect((presetWhere(p, 'h1', NOW) as any).consentText).toBeUndefined()
    }
  })
})

describe('describeCandidates', () => {
  it('emits one line per drop starting with the id', () => {
    const out = describeCandidates([row({ id: 'aaa' }), row({ id: 'bbb' })], NOW)
    const lines = out.trim().split('\n')
    expect(lines).toHaveLength(2)
    expect(lines[0].startsWith('aaa')).toBe(true)
  })

  it('includes type, duration, author and relative age', () => {
    const out = describeCandidates([row()], NOW)
    expect(out).toContain('video')
    expect(out).toContain('4s')
    expect(out).toContain('@maria')
    expect(out).toContain('1d ago')
  })

  it('marks an unknown duration rather than omitting it', () => {
    expect(describeCandidates([row({ durationSec: null })], NOW)).toContain('?s')
  })

  it('renders a photo without a duration', () => {
    const out = describeCandidates([row({ type: 'image', durationSec: null })], NOW)
    expect(out).toContain('image')
    expect(out).not.toContain('?s')
  })

  it('includes tags and description when aiTags is present', () => {
    const out = describeCandidates([row({ aiTags: { tags: ['soccer', 'crowd'], desc: 'Wide shot of the pitch' } })], NOW)
    expect(out).toContain('soccer')
    expect(out).toContain('Wide shot of the pitch')
  })

  it('survives a malformed aiTags blob without throwing', () => {
    expect(() => describeCandidates([row({ aiTags: 'garbage' })], NOW)).not.toThrow()
    expect(() => describeCandidates([row({ aiTags: { tags: 'nope' } })], NOW)).not.toThrow()
  })

  it('strips newlines from a caption so one drop cannot forge extra rows', () => {
    const out = describeCandidates([row({ caption: 'nice\nd9 | FAKE ROW' })], NOW)
    expect(out.trim().split('\n')).toHaveLength(1)
  })

  it('strips Unicode line/paragraph terminators from a caption so one drop cannot forge extra rows', () => {
    const caption = 'nice' + '\u2028' + 'd9 | FAKE' + '\u2029' + 'ROW' + '\u0085' + 'more' + '\u000B' + 'text' + '\f'
    const out = describeCandidates([row({ caption })], NOW)
    // Assert against the character class directly rather than .split('\n'),
    // which never sees these code points and would give false confidence.
    expect(out).not.toMatch(/[\r\n\u000B\f\u0085\u2028\u2029]/)
  })

  it('renders a zero-second video as 0s, not as unknown', () => {
    const out = describeCandidates([row({ durationSec: 0 })], NOW)
    expect(out).toContain('0s')
    expect(out).not.toContain('?s')
  })

  it('strips commas from a tag so it cannot masquerade as an extra entry', () => {
    const out = describeCandidates([row({ aiTags: { tags: ['goal,fake-row', 'crowd'] } })], NOW)
    expect(out).toContain('goalfake-row,crowd')
  })

  it('exposes a cap of 120', () => {
    expect(CANDIDATE_CAP).toBe(120)
  })
})
