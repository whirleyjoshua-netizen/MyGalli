// src/lib/appointments.test.ts
import { describe, it, expect } from 'vitest'
import { tzOffsetMinutes, wallClockToUTC, generateSlots, isSlotBookable, type AppointmentConfig } from './appointments'

describe('tzOffsetMinutes', () => {
  it('New York is UTC-4 in July (DST)', () => {
    expect(tzOffsetMinutes('America/New_York', new Date('2026-07-15T12:00:00Z'))).toBe(-240)
  })
  it('New York is UTC-5 in January (standard)', () => {
    expect(tzOffsetMinutes('America/New_York', new Date('2026-01-15T12:00:00Z'))).toBe(-300)
  })
  it('UTC is zero', () => {
    expect(tzOffsetMinutes('UTC', new Date('2026-07-15T12:00:00Z'))).toBe(0)
  })
})

describe('wallClockToUTC', () => {
  it('9:00 in New York July → 13:00 UTC', () => {
    const d = wallClockToUTC('America/New_York', 2026, 7, 15, 9, 0)
    expect(d.toISOString()).toBe('2026-07-15T13:00:00.000Z')
  })
})

const cfg: AppointmentConfig = {
  duration: 30,
  timezone: 'America/New_York',
  weeklyRules: [{ day: 3, start: '09:00', end: '11:00' }], // Wednesday 9-11
  buffer: 0,
  leadTimeHours: 0,
  maxDaysAhead: 30,
}

describe('generateSlots', () => {
  it('produces 30-min slots within a Wednesday window', () => {
    // 2026-07-15 is a Wednesday
    const from = new Date('2026-07-13T00:00:00Z')
    const to = new Date('2026-07-16T00:00:00Z')
    const now = new Date('2026-07-01T00:00:00Z')
    const slots = generateSlots(cfg, from, to, now)
    // 9:00,9:30,10:00,10:30 = 4 slots (10:30-11:00 last; 11:00 excluded)
    expect(slots.length).toBe(4)
    expect(slots[0].startUTC).toBe('2026-07-15T13:00:00.000Z') // 9am ET = 13:00 UTC
    expect(slots[0].endUTC).toBe('2026-07-15T13:30:00.000Z')
  })
  it('honors buffer by widening the step', () => {
    const slots = generateSlots({ ...cfg, buffer: 30 }, new Date('2026-07-13T00:00:00Z'), new Date('2026-07-16T00:00:00Z'), new Date('2026-07-01T00:00:00Z'))
    // step = 60min → 9:00, 10:00 (10:30 slot would end 11:00 but next start 10:00 ok; 10:00-10:30 fits, next 11:00 excluded) = 9:00,10:00 = 2
    expect(slots.map((s) => s.startUTC)).toEqual(['2026-07-15T13:00:00.000Z', '2026-07-15T14:00:00.000Z'])
  })
  it('excludes slots before lead time', () => {
    const now = new Date('2026-07-15T13:15:00Z') // during the window
    const slots = generateSlots({ ...cfg, leadTimeHours: 24 }, new Date('2026-07-13T00:00:00Z'), new Date('2026-07-16T00:00:00Z'), now)
    expect(slots.length).toBe(0)
  })
  it('excludes slots beyond maxDaysAhead', () => {
    const now = new Date('2026-07-01T00:00:00Z')
    const slots = generateSlots({ ...cfg, maxDaysAhead: 5 }, new Date('2026-07-13T00:00:00Z'), new Date('2026-07-16T00:00:00Z'), now)
    expect(slots.length).toBe(0) // 7-15 is >5 days after 7-01
  })
})

describe('isSlotBookable', () => {
  it('accepts a valid generated slot', () => {
    expect(isSlotBookable(cfg, '2026-07-15T13:00:00.000Z', new Date('2026-07-01T00:00:00Z'))).toBe(true)
  })
  it('rejects an off-grid time', () => {
    expect(isSlotBookable(cfg, '2026-07-15T13:07:00.000Z', new Date('2026-07-01T00:00:00Z'))).toBe(false)
  })
  it('rejects a slot on a non-available day', () => {
    expect(isSlotBookable(cfg, '2026-07-14T13:00:00.000Z', new Date('2026-07-01T00:00:00Z'))).toBe(false) // Tuesday
  })
})
