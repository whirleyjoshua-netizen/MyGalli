import { describe, it, expect } from 'vitest'
import { isAnalyticsEventType, parseInteractMetadata } from '@/lib/analytics-events'
import { countryFromHeaders } from './route'

describe('track route validation helpers', () => {
  it('only allows the three known event types', () => {
    expect(isAnalyticsEventType('interact')).toBe(true)
    expect(isAnalyticsEventType('drop table')).toBe(false)
  })

  it('requires well-formed metadata for interact events', () => {
    expect(parseInteractMetadata({ elementId: 'a', elementType: 'poll', action: 'vote' })).not.toBeNull()
    expect(parseInteractMetadata({ elementId: 'a' })).toBeNull()
  })
})

describe('countryFromHeaders', () => {
  it('reads the Vercel geo header', () => {
    const headers = new Headers({ 'x-vercel-ip-country': 'DE' })
    expect(countryFromHeaders(headers)).toBe('DE')
  })

  it('uppercases and trims', () => {
    expect(countryFromHeaders(new Headers({ 'x-vercel-ip-country': ' de ' }))).toBe('DE')
  })

  it('returns null when absent (local dev)', () => {
    expect(countryFromHeaders(new Headers())).toBeNull()
  })

  it('ignores values that are not two-letter codes', () => {
    expect(countryFromHeaders(new Headers({ 'x-vercel-ip-country': 'Germany' }))).toBeNull()
    expect(countryFromHeaders(new Headers({ 'x-vercel-ip-country': '1' }))).toBeNull()
  })
})
