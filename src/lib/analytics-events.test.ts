import { describe, it, expect } from 'vitest'
import {
  ANALYTICS_EVENT_TYPES,
  isAnalyticsEventType,
  parseInteractMetadata,
} from './analytics-events'

describe('isAnalyticsEventType', () => {
  it('accepts the three supported types', () => {
    expect(ANALYTICS_EVENT_TYPES).toEqual(['view', 'interact', 'share'])
    for (const t of ANALYTICS_EVENT_TYPES) expect(isAnalyticsEventType(t)).toBe(true)
  })

  it('rejects anything else', () => {
    expect(isAnalyticsEventType('scroll')).toBe(false)
    expect(isAnalyticsEventType('')).toBe(false)
    expect(isAnalyticsEventType(null)).toBe(false)
    expect(isAnalyticsEventType(42)).toBe(false)
  })
})

describe('parseInteractMetadata', () => {
  it('returns the three fields when all are non-empty strings', () => {
    expect(parseInteractMetadata({ elementId: 'el_1', elementType: 'poll', action: 'vote' }))
      .toEqual({ elementId: 'el_1', elementType: 'poll', action: 'vote' })
  })

  it('drops unknown extra keys rather than persisting them', () => {
    const out = parseInteractMetadata({
      elementId: 'el_1', elementType: 'poll', action: 'vote', evil: 'x',
    })
    expect(out).toEqual({ elementId: 'el_1', elementType: 'poll', action: 'vote' })
  })

  it('returns null when any field is missing, empty or not a string', () => {
    expect(parseInteractMetadata({ elementType: 'poll', action: 'vote' })).toBeNull()
    expect(parseInteractMetadata({ elementId: '', elementType: 'poll', action: 'vote' })).toBeNull()
    expect(parseInteractMetadata({ elementId: 'el_1', elementType: 7, action: 'vote' })).toBeNull()
    expect(parseInteractMetadata(null)).toBeNull()
    expect(parseInteractMetadata('nope')).toBeNull()
  })

  it('trims surrounding whitespace', () => {
    expect(parseInteractMetadata({ elementId: ' el_1 ', elementType: ' poll ', action: ' vote ' }))
      .toEqual({ elementId: 'el_1', elementType: 'poll', action: 'vote' })
  })
})
