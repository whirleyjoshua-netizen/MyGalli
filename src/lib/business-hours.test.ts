import { describe, it, expect } from 'vitest'
import { parseTimeToMinutes, isOpenNow } from './business-hours'

const week = [
  { day: 'Sunday', open: '', close: '', closed: true },
  { day: 'Monday', open: '9:00 AM', close: '5:00 PM', closed: false },
  { day: 'Tuesday', open: '9:00 AM', close: '5:00 PM', closed: false },
  { day: 'Wednesday', open: '9:00 AM', close: '5:00 PM', closed: false },
  { day: 'Thursday', open: '9:00 AM', close: '5:00 PM', closed: false },
  { day: 'Friday', open: '9:00 AM', close: '5:00 PM', closed: false },
  { day: 'Saturday', open: '10:00 AM', close: '2:00 PM', closed: false },
]

describe('parseTimeToMinutes', () => {
  it('parses am/pm', () => {
    expect(parseTimeToMinutes('9:00 AM')).toBe(540)
    expect(parseTimeToMinutes('5:00 PM')).toBe(1020)
    expect(parseTimeToMinutes('12:00 PM')).toBe(720)
    expect(parseTimeToMinutes('12:00 AM')).toBe(0)
  })
  it('returns null on garbage', () => {
    expect(parseTimeToMinutes('nope')).toBeNull()
    expect(parseTimeToMinutes('')).toBeNull()
  })
})

describe('isOpenNow', () => {
  // Monday 2026-07-06 is a Monday; 13:00 local
  it('open mid-window', () => {
    const now = new Date(2026, 6, 6, 13, 0) // Mon 1pm
    expect(isOpenNow(week, now).open).toBe(true)
  })
  it('closed before open', () => {
    const now = new Date(2026, 6, 6, 8, 0) // Mon 8am
    expect(isOpenNow(week, now).open).toBe(false)
  })
  it('closed after close', () => {
    const now = new Date(2026, 6, 6, 18, 0) // Mon 6pm
    expect(isOpenNow(week, now).open).toBe(false)
  })
  it('closed all day', () => {
    const now = new Date(2026, 6, 5, 13, 0) // Sun 1pm
    expect(isOpenNow(week, now).open).toBe(false)
  })
})
