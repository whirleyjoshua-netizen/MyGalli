import { describe, it, expect } from 'vitest'
import { validateEventInput, toEventDTO } from './hub-events'

describe('validateEventInput', () => {
  it('requires a title', () => {
    expect(validateEventInput({ startsAt: '2026-08-01T19:00:00Z' })).toEqual({ ok: false, error: 'Title is required' })
  })
  it('rejects an invalid start date', () => {
    expect(validateEventInput({ title: 'X', startsAt: 'nope' })).toMatchObject({ ok: false })
  })
  it('rejects end before start', () => {
    const r = validateEventInput({ title: 'X', startsAt: '2026-08-01T19:00:00Z', endsAt: '2026-08-01T18:00:00Z' })
    expect(r).toMatchObject({ ok: false })
  })
  it('accepts a valid event and normalizes fields', () => {
    const r = validateEventInput({ title: '  Kickoff  ', startsAt: '2026-08-01T19:00:00Z', isOnline: true, location: ' https://meet.example ', description: 'hi' })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.value.title).toBe('Kickoff')
      expect(r.value.startsAt.toISOString()).toBe('2026-08-01T19:00:00.000Z')
      expect(r.value.isOnline).toBe(true)
      expect(r.value.location).toBe('https://meet.example')
      expect(r.value.endsAt).toBeNull()
    }
  })
})

describe('toEventDTO', () => {
  it('serializes dates to ISO strings', () => {
    const dto = toEventDTO({ id: 'e1', title: 'X', startsAt: new Date('2026-08-01T19:00:00Z'), endsAt: null, allDay: false, isOnline: false, location: null, description: null })
    expect(dto.startsAt).toBe('2026-08-01T19:00:00.000Z')
    expect(dto.endsAt).toBeNull()
  })
})
