import { describe, it, expect } from 'vitest'
import { formatLastUpdated, absoluteLastUpdated } from './last-updated'

const NOW = new Date('2026-07-15T12:00:00.000Z')
const SEC = 1000
const MIN = 60 * SEC
const HOUR = 60 * MIN
const DAY = 24 * HOUR

/** A date `ms` milliseconds before NOW. */
const ago = (ms: number) => new Date(NOW.getTime() - ms)

describe('formatLastUpdated', () => {
  it('says "just now" under a minute', () => {
    expect(formatLastUpdated(ago(0), NOW)).toBe('just now')
    expect(formatLastUpdated(ago(59 * SEC), NOW)).toBe('just now')
  })

  it('reports whole minutes, flooring, singular at 1', () => {
    expect(formatLastUpdated(ago(60 * SEC), NOW)).toBe('1 minute ago')
    expect(formatLastUpdated(ago(90 * SEC), NOW)).toBe('1 minute ago')
    expect(formatLastUpdated(ago(2 * MIN), NOW)).toBe('2 minutes ago')
    expect(formatLastUpdated(ago(59 * MIN), NOW)).toBe('59 minutes ago')
  })

  it('reports whole hours', () => {
    expect(formatLastUpdated(ago(HOUR), NOW)).toBe('1 hour ago')
    expect(formatLastUpdated(ago(23 * HOUR), NOW)).toBe('23 hours ago')
  })

  it('reports whole days', () => {
    expect(formatLastUpdated(ago(DAY), NOW)).toBe('1 day ago')
    expect(formatLastUpdated(ago(6 * DAY), NOW)).toBe('6 days ago')
  })

  it('reports weeks from 7 days', () => {
    expect(formatLastUpdated(ago(7 * DAY), NOW)).toBe('1 week ago')
    expect(formatLastUpdated(ago(29 * DAY), NOW)).toBe('4 weeks ago')
  })

  it('reports months from 30 days', () => {
    expect(formatLastUpdated(ago(30 * DAY), NOW)).toBe('1 month ago')
    expect(formatLastUpdated(ago(364 * DAY), NOW)).toBe('12 months ago')
  })

  it('falls back to an absolute date at a year', () => {
    expect(formatLastUpdated(ago(365 * DAY), NOW)).toBe('Jul 15, 2025')
  })

  // Clock skew between the DB and the server must never render "in 3 hours".
  it('treats a future date as just now', () => {
    expect(formatLastUpdated(new Date(NOW.getTime() + 3 * HOUR), NOW)).toBe('just now')
  })
})

describe('absoluteLastUpdated', () => {
  it('renders a long, unambiguous date', () => {
    expect(absoluteLastUpdated(new Date('2026-07-15T12:00:00.000Z'))).toBe('July 15, 2026')
  })
})
