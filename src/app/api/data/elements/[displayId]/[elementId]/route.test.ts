import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', () => ({ getUser: vi.fn() }))
vi.mock('@/lib/db', () => ({
  db: {
    display: { findUnique: vi.fn() },
    formResponse: { findMany: vi.fn().mockResolvedValue([]) },
    waitlistSignup: { findMany: vi.fn().mockResolvedValue([]) },
    message: { findMany: vi.fn().mockResolvedValue([]) },
    booking: { findMany: vi.fn().mockResolvedValue([]) },
    jerseySignature: { findMany: vi.fn().mockResolvedValue([]) },
    comment: { findMany: vi.fn().mockResolvedValue([]) },
  },
}))

import { GET } from './route'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'

const req = () => new NextRequest('http://localhost/api/data/elements/d1/e1')
const ctx = { params: Promise.resolve({ displayId: 'd1', elementId: 'e1' }) }

const display = {
  id: 'd1',
  userId: 'me',
  title: 'Homepage',
  sections: [{ id: 's1', layout: 'single', columns: [{ id: 'c1', elements: [{ id: 'e1', type: 'poll', pollQuestion: 'Best?' }] }] }],
  tabs: null,
}

// A display whose single element is `el`, so each per-type branch can be driven.
const pageWith = (el: Record<string, unknown>, extra: Record<string, unknown>[] = []) => ({
  ...display,
  sections: [{ id: 's1', layout: 'single', columns: [{ id: 'c1', elements: [el, ...extra] }] }],
})

beforeEach(() => vi.clearAllMocks())

describe('GET /api/data/elements/[displayId]/[elementId]', () => {
  it('401s when unauthenticated', async () => {
    ;(getUser as any).mockResolvedValue(null)
    expect((await GET(req(), ctx)).status).toBe(401)
  })

  it('404s for a display that does not exist', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'me' })
    ;(db.display.findUnique as any).mockResolvedValue(null)
    expect((await GET(req(), ctx)).status).toBe(404)
  })

  it('403s when the display belongs to someone else', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'me' })
    ;(db.display.findUnique as any).mockResolvedValue({ ...display, userId: 'someone-else' })
    expect((await GET(req(), ctx)).status).toBe(403)
  })

  it('404s when the element is not on that page', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'me' })
    ;(db.display.findUnique as any).mockResolvedValue(display)
    const res = await GET(req(), { params: Promise.resolve({ displayId: 'd1', elementId: 'nope' }) })
    expect(res.status).toBe(404)
  })

  it('returns the element, its responses and a daily series', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'me' })
    ;(db.display.findUnique as any).mockResolvedValue(display)
    ;(db.formResponse.findMany as any).mockResolvedValue([
      { responses: { e1: { type: 'poll', answer: 'A' } }, submittedAt: new Date('2026-07-20T10:00:00Z') },
      { responses: { e1: { type: 'poll', answer: 'B' } }, submittedAt: new Date('2026-07-20T11:00:00Z') },
      { responses: { other: { type: 'poll', answer: 'C' } }, submittedAt: new Date('2026-07-20T12:00:00Z') },
    ])
    const body = await (await GET(req(), ctx)).json()
    expect(body.element).toMatchObject({ elementId: 'e1', type: 'poll', title: 'Best?' })
    expect(body.responses).toHaveLength(2)
    expect(body.series.find((d: any) => d.date === '2026-07-20').count).toBe(2)
  })

  it('buckets the series by local calendar day, not UTC', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'me' })
    ;(db.display.findUnique as any).mockResolvedValue(display)
    // 00:30 LOCAL today — under UTC bucketing in a negative-offset timezone
    // this would land on yesterday's key.
    const localToday = new Date()
    localToday.setHours(0, 30, 0, 0)
    ;(db.formResponse.findMany as any).mockResolvedValue([
      { responses: { e1: { type: 'poll', answer: 'A' } }, submittedAt: localToday },
    ])
    const body = await (await GET(req(), ctx)).json()
    const y = localToday.getFullYear()
    const m = String(localToday.getMonth() + 1).padStart(2, '0')
    const d = String(localToday.getDate()).padStart(2, '0')
    expect(body.series[0].date).toBe(`${y}-${m}-${d}`)
  })

  it('surfaces truncation instead of silently dropping responses', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      ;(getUser as any).mockResolvedValue({ id: 'me' })
      ;(db.display.findUnique as any).mockResolvedValue(display)
      ;(db.formResponse.findMany as any).mockResolvedValue(
        Array.from({ length: 250 }, () => ({
          responses: { e1: { type: 'poll', answer: 'A' } },
          submittedAt: new Date(),
        }))
      )
      const body = await (await GET(req(), ctx)).json()
      expect(body.responses).toHaveLength(200)
      expect(body.responsesTruncated).toBe(true)
      expect(body.responseCount).toBe(250)
    } finally {
      warnSpy.mockRestore()
    }
  })

  it('does not read FormResponse for a store-backed type', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'me' })
    ;(db.display.findUnique as any).mockResolvedValue(pageWith({ id: 'e1', type: 'waitlist', waitlistTitle: 'List' }))
    ;(db.waitlistSignup.findMany as any).mockResolvedValue([])
    await GET(req(), ctx)
    expect(db.formResponse.findMany).not.toHaveBeenCalled()
  })

  it('does not flag truncation when everything fits', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'me' })
    ;(db.display.findUnique as any).mockResolvedValue(display)
    ;(db.formResponse.findMany as any).mockResolvedValue([
      { responses: { e1: { type: 'poll', answer: 'A' } }, submittedAt: new Date() },
    ])
    const body = await (await GET(req(), ctx)).json()
    expect(body.responsesTruncated).toBe(false)
    expect(body.responseCount).toBe(1)
  })
})

// Every one of these types is counted by the inventory route from its OWN store.
// Reading FormResponse for them returned [], so the drawer rendered
// "No responses yet." directly under a header claiming hundreds of responses.
describe('per-type response stores', () => {
  beforeEach(() => {
    ;(getUser as any).mockResolvedValue({ id: 'me' })
  })

  it('reads WaitlistSignup for a waitlist, scoped to the display and element', async () => {
    ;(db.display.findUnique as any).mockResolvedValue(pageWith({ id: 'e1', type: 'waitlist', waitlistTitle: 'List' }))
    ;(db.waitlistSignup.findMany as any).mockResolvedValue([
      { email: 'a@b.com', name: 'Ada', createdAt: new Date() },
    ])
    const body = await (await GET(req(), ctx)).json()
    expect((db.waitlistSignup.findMany as any).mock.calls[0][0].where).toMatchObject({
      displayId: 'd1',
      elementId: 'e1',
    })
    expect(body.responses[0]).toMatchObject({ answer: 'a@b.com', who: 'Ada' })
    expect(Number.isNaN(Date.parse(body.responses[0].submittedAt))).toBe(false)
    expect(body.series).toHaveLength(1)
  })

  it('reads Message for a mailbox and scopes it to the owner', async () => {
    ;(db.display.findUnique as any).mockResolvedValue(pageWith({ id: 'e1', type: 'mailbox', mailboxTitle: 'Inbox' }))
    ;(db.message.findMany as any).mockResolvedValue([
      { kind: 'text', body: 'hello', senderName: 'Sam', senderEmail: null, read: false, createdAt: new Date() },
      { kind: 'audio', body: null, senderName: null, senderEmail: 'v@x.com', read: true, createdAt: new Date() },
    ])
    const body = await (await GET(req(), ctx)).json()
    expect((db.message.findMany as any).mock.calls[0][0].where).toMatchObject({
      ownerId: 'me',
      displayId: 'd1',
      elementId: 'e1',
    })
    expect(body.responses[0]).toMatchObject({ answer: 'hello', who: 'Sam', meta: 'Unread' })
    // An audio message has no body; it must say so rather than render blank.
    expect(body.responses[1].answer).toContain('Voice message')
    expect(body.responses[1].meta).toBeUndefined()
  })

  it('reads Booking for appointments and surfaces the start time', async () => {
    ;(db.display.findUnique as any).mockResolvedValue(pageWith({ id: 'e1', type: 'appointments', apptTitle: 'Slots' }))
    const start = new Date('2026-08-01T15:00:00Z')
    ;(db.booking.findMany as any).mockResolvedValue([
      { name: 'Rey', email: 'r@x.com', start, note: 'first visit', createdAt: new Date() },
    ])
    const body = await (await GET(req(), ctx)).json()
    expect((db.booking.findMany as any).mock.calls[0][0].where).toMatchObject({
      displayId: 'd1',
      elementId: 'e1',
    })
    expect(body.responses[0].answer).toEqual({ name: 'Rey', email: 'r@x.com', note: 'first visit' })
    expect(body.responses[0].submittedAt).toBe(start.toISOString())
    expect(body.responses[0].dateLabel).toBe('Booked for')
  })

  it('reads JerseySignature for a jersey', async () => {
    ;(db.display.findUnique as any).mockResolvedValue(pageWith({ id: 'e1', type: 'jersey', jerseyName: 'Team' }))
    ;(db.jerseySignature.findMany as any).mockResolvedValue([{ name: 'Nia', createdAt: new Date() }])
    const body = await (await GET(req(), ctx)).json()
    expect((db.jerseySignature.findMany as any).mock.calls[0][0].where).toMatchObject({
      displayId: 'd1',
      elementId: 'e1',
    })
    expect(body.responses[0].answer).toBe('Nia')
  })

  it('reads Comment by displayId only, since Comment has no elementId column', async () => {
    ;(db.display.findUnique as any).mockResolvedValue(pageWith({ id: 'e1', type: 'comment', commentTitle: 'Wall' }))
    ;(db.comment.findMany as any).mockResolvedValue([
      { id: 'c1', authorName: 'Kim', content: 'nice work', approved: false, createdAt: new Date() },
    ])
    const body = await (await GET(req(), ctx)).json()
    const where = (db.comment.findMany as any).mock.calls[0][0].where
    expect(where.displayId).toBe('d1')
    expect(where.elementId).toBeUndefined()
    expect(body.responses[0]).toMatchObject({
      id: 'c1',
      answer: 'nice work',
      who: 'Kim',
      approved: false,
    })
  })

  it('attributes a page’s comments to the FIRST comment wall, like the inventory route', async () => {
    ;(db.display.findUnique as any).mockResolvedValue(
      pageWith({ id: 'e0', type: 'comment', commentTitle: 'First' }, [
        { id: 'e1', type: 'comment', commentTitle: 'Second' },
      ])
    )
    const body = await (await GET(req(), ctx)).json()
    expect(db.comment.findMany).not.toHaveBeenCalled()
    expect(body.responses).toHaveLength(0)
    expect(body.notice).toContain('first comment wall')
  })
})
