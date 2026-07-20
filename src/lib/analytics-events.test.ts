import { describe, it, expect } from 'vitest'
import {
  ANALYTICS_EVENT_TYPES,
  isAnalyticsEventType,
  parseInteractMetadata,
  parseShareChannel,
  parseVisitorId,
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

  it('rejects (does not truncate) fields over 64 characters', () => {
    const long = 'x'.repeat(65)
    expect(parseInteractMetadata({ elementId: long, elementType: 'poll', action: 'vote' })).toBeNull()
    expect(parseInteractMetadata({ elementId: 'el_1', elementType: long, action: 'vote' })).toBeNull()
    expect(parseInteractMetadata({ elementId: 'el_1', elementType: 'poll', action: long })).toBeNull()
    const exactly64 = 'x'.repeat(64)
    expect(parseInteractMetadata({ elementId: exactly64, elementType: 'poll', action: 'vote' }))
      .toEqual({ elementId: exactly64, elementType: 'poll', action: 'vote' })
  })
})

describe('parseShareChannel', () => {
  it('returns the trimmed channel when present', () => {
    expect(parseShareChannel({ channel: ' twitter ' })).toBe('twitter')
  })

  it('returns null when absent or not an object', () => {
    expect(parseShareChannel({})).toBeNull()
    expect(parseShareChannel(null)).toBeNull()
    expect(parseShareChannel('nope')).toBeNull()
  })

  it('rejects (does not truncate) a channel over 64 characters', () => {
    const long = 'x'.repeat(65)
    expect(parseShareChannel({ channel: long })).toBeNull()
    const exactly64 = 'x'.repeat(64)
    expect(parseShareChannel({ channel: exactly64 })).toBe(exactly64)
  })
})

describe('parseVisitorId', () => {
  it('accepts a normal id', () => {
    expect(parseVisitorId('vis_abc123')).toBe('vis_abc123')
  })

  it('trims surrounding whitespace', () => {
    expect(parseVisitorId('  vis_abc123  ')).toBe('vis_abc123')
  })

  it('rejects a missing, empty or non-string value', () => {
    expect(parseVisitorId(undefined)).toBeNull()
    expect(parseVisitorId(null)).toBeNull()
    expect(parseVisitorId('')).toBeNull()
    expect(parseVisitorId('   ')).toBeNull()
    expect(parseVisitorId(42)).toBeNull()
    expect(parseVisitorId({ id: 'x' })).toBeNull()
  })

  it('rejects rather than truncates an over-length id', () => {
    expect(parseVisitorId('v'.repeat(64))).toBe('v'.repeat(64))
    expect(parseVisitorId('v'.repeat(65))).toBeNull()
  })
})
