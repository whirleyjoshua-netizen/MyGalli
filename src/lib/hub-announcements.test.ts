import { describe, it, expect } from 'vitest'
import { validateAnnouncementBody, toAnnouncementDTO, ANNOUNCEMENT_MAX } from './hub-announcements'

describe('validateAnnouncementBody', () => {
  it('accepts and trims a normal body', () => {
    const r = validateAnnouncementBody('  Meeting Thursday 6pm  ')
    expect(r).toEqual({ ok: true, value: 'Meeting Thursday 6pm' })
  })
  it('rejects an empty or whitespace-only body', () => {
    expect(validateAnnouncementBody('   ').ok).toBe(false)
    expect(validateAnnouncementBody('').ok).toBe(false)
    expect(validateAnnouncementBody(null).ok).toBe(false)
    expect(validateAnnouncementBody(123).ok).toBe(false)
  })
  it('rejects a body longer than the cap', () => {
    expect(validateAnnouncementBody('a'.repeat(ANNOUNCEMENT_MAX + 1)).ok).toBe(false)
  })
  it('accepts a body exactly at the cap', () => {
    const r = validateAnnouncementBody('a'.repeat(ANNOUNCEMENT_MAX))
    expect(r.ok).toBe(true)
  })
})

describe('toAnnouncementDTO', () => {
  it('shapes the row and stringifies the date', () => {
    const dto = toAnnouncementDTO({
      id: 'a1', body: 'hi', createdAt: new Date('2026-07-22T00:00:00Z'),
      author: { username: 'sam', name: 'Sam', avatar: null },
    })
    expect(dto).toEqual({
      id: 'a1', body: 'hi', createdAt: '2026-07-22T00:00:00.000Z',
      author: { username: 'sam', name: 'Sam', avatar: null },
    })
  })
})
