import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/rate-limit', () => ({ rateLimit: vi.fn().mockResolvedValue(null) }))
vi.mock('@/lib/db', () => ({
  db: {
    booking: { create: vi.fn(), findMany: vi.fn() },
    user: { findUnique: vi.fn() },
  },
}))
vi.mock('@/lib/appointments', () => ({
  generateSlots: vi.fn().mockReturnValue([]),
  isSlotBookable: vi.fn().mockReturnValue(true),
}))
vi.mock('@/lib/appointments-server', () => ({
  loadApptContext: vi.fn(),
  elementToConfig: vi.fn().mockReturnValue({
    duration: 30,
    timezone: 'UTC',
    weeklyRules: [],
    buffer: 0,
    leadTimeHours: 0,
    maxDaysAhead: 30,
  }),
}))
vi.mock('@/lib/email', () => ({
  sendEmail: vi.fn().mockResolvedValue(undefined),
  bookingConfirmedEmail: vi.fn().mockReturnValue({ subject: 's', html: 'h' }),
  bookingReceivedEmail: vi.fn().mockReturnValue({ subject: 's2', html: 'h2' }),
}))
vi.mock('@/lib/crm/ingest', () => ({ ingestLead: vi.fn().mockResolvedValue(undefined) }))

import { db } from '@/lib/db'
import { isSlotBookable } from '@/lib/appointments'
import { loadApptContext } from '@/lib/appointments-server'
import { ingestLead } from '@/lib/crm/ingest'
import { POST } from './route'

const ctx = { params: Promise.resolve({ displayId: 'd1' }) }
const req = (body: unknown) =>
  new Request('http://localhost/api/appointments/d1', {
    method: 'POST',
    body: JSON.stringify(body),
  }) as never

const APPT_CTX = {
  display: { id: 'd1', userId: 'owner1', published: true },
  el: { id: 'a1', type: 'appointments', apptTitle: 'Chat' },
}

const BODY = {
  elementId: 'a1',
  startUTC: '2026-08-01T10:00:00.000Z',
  name: 'Sarah Lee',
  email: 'sarah@example.com',
}

beforeEach(() => {
  vi.clearAllMocks()
  ;(loadApptContext as any).mockResolvedValue(APPT_CTX)
  ;(isSlotBookable as any).mockReturnValue(true)
  ;(db.booking.create as any).mockResolvedValue({
    id: 'b1',
    cancelToken: 'tok1',
    start: new Date(BODY.startUTC),
    end: new Date('2026-08-01T10:30:00.000Z'),
  })
  ;(db.user.findUnique as any).mockResolvedValue({ email: 'owner@example.com' })
})

describe('POST /api/appointments/[displayId]', () => {
  it('books, sends confirmation, and ingests a lead after the booking is created', async () => {
    const res = await POST(req(BODY), ctx)
    expect(res.status).toBe(200)
    expect(db.booking.create).toHaveBeenCalledTimes(1)
    expect(ingestLead).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'booking',
        sourceId: 'b1',
        email: 'sarah@example.com',
        name: 'Sarah Lee',
      })
    )
    // The ingest call must happen after booking.create resolves.
    const createOrder = (db.booking.create as any).mock.invocationCallOrder[0]
    const ingestOrder = (ingestLead as any).mock.invocationCallOrder[0]
    expect(ingestOrder).toBeGreaterThan(createOrder)
  })

  it('does not ingest a lead when the slot is a duplicate booking (P2002)', async () => {
    const err: any = new Error('unique violation')
    err.code = 'P2002'
    ;(db.booking.create as any).mockRejectedValue(err)
    const res = await POST(req(BODY), ctx)
    expect(res.status).toBe(409)
    expect(ingestLead).not.toHaveBeenCalled()
  })
})
