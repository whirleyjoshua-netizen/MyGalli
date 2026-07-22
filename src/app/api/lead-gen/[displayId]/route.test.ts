import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/rate-limit', () => ({ rateLimit: vi.fn().mockResolvedValue(null) }))
vi.mock('@/lib/auth', () => ({ getJwtSecret: () => 'test-secret' }))
vi.mock('@/lib/db', () => ({
  db: { display: { findUnique: vi.fn() }, leadCapture: { create: vi.fn(), update: vi.fn() } },
}))
vi.mock('@/lib/email', () => ({
  sendEmail: vi.fn().mockResolvedValue(undefined),
  leadGenEmail: vi.fn().mockReturnValue({ subject: 's', html: 'h' }),
}))

import { db } from '@/lib/db'
import { sendEmail, leadGenEmail } from '@/lib/email'
import { POST } from './route'

const ctx = { params: Promise.resolve({ displayId: 'd1' }) }
const req = (body: unknown) =>
  new Request('http://localhost/api/lead-gen/d1', {
    method: 'POST',
    body: JSON.stringify(body),
  }) as never

const DISPLAY = {
  id: 'd1',
  published: true,
  sections: [
    {
      columns: [
        {
          elements: [
            {
              id: 'lg1',
              type: 'lead-gen',
              leadGenMessage: 'hi',
              leadGenFileUrl: 'https://blob/x.pdf',
              leadGenFileName: 'x.pdf',
            },
          ],
        },
      ],
    },
  ],
  tabs: null,
}

beforeEach(() => {
  vi.clearAllMocks()
  ;(db.display.findUnique as never as ReturnType<typeof vi.fn>).mockResolvedValue(DISPLAY)
  ;(db.leadCapture.create as never as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'lc1' })
  ;(db.leadCapture.update as never as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'lc1' })
  ;(leadGenEmail as never as ReturnType<typeof vi.fn>).mockReturnValue({ subject: 's', html: 'h' })
  ;(sendEmail as never as ReturnType<typeof vi.fn>).mockResolvedValue(undefined)
})

const mock = (fn: unknown) => fn as ReturnType<typeof vi.fn>

describe('POST /api/lead-gen/[displayId]', () => {
  it('stores a lead, sends the email, and returns the file link', async () => {
    const res = await POST(req({ elementId: 'lg1', email: 'a@b.com', name: 'Sarah' }), ctx)
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({
      ok: true,
      fileUrl: 'https://blob/x.pdf',
      fileName: 'x.pdf',
    })
    const lead = mock(db.leadCapture.create).mock.calls[0][0].data
    expect(lead).toMatchObject({ displayId: 'd1', elementId: 'lg1', email: 'a@b.com', name: 'Sarah' })
    expect(sendEmail).toHaveBeenCalledTimes(1)
    expect(mock(db.leadCapture.update).mock.calls[0][0].data).toMatchObject({ delivered: true })
  })

  it('emails the STORED message, never one supplied by the caller', async () => {
    await POST(
      req({
        elementId: 'lg1',
        email: 'a@b.com',
        leadGenMessage: 'PWNED: click http://evil.test',
        leadGenFileUrl: 'https://evil.test/malware.exe',
      }),
      ctx
    )
    expect(mock(leadGenEmail).mock.calls[0][0]).toMatchObject({
      message: 'hi',
      fileUrl: 'https://blob/x.pdf',
    })
  })

  it('rejects a malformed email without storing or sending', async () => {
    const res = await POST(req({ elementId: 'lg1', email: 'nope' }), ctx)
    expect(res.status).toBe(400)
    expect(db.leadCapture.create).not.toHaveBeenCalled()
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it('404s on an unpublished display', async () => {
    mock(db.display.findUnique).mockResolvedValue({ ...DISPLAY, published: false })
    const res = await POST(req({ elementId: 'lg1', email: 'a@b.com' }), ctx)
    expect(res.status).toBe(404)
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it('rejects an unknown elementId (no matching lead-gen element)', async () => {
    const res = await POST(req({ elementId: 'ghost', email: 'a@b.com' }), ctx)
    expect(res.status).toBe(400)
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it('silently accepts a filled honeypot without storing', async () => {
    const res = await POST(req({ elementId: 'lg1', email: 'a@b.com', hp: 'bot' }), ctx)
    expect(res.status).toBe(200)
    expect(db.leadCapture.create).not.toHaveBeenCalled()
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it('keeps the lead and still returns 200 when delivery throws', async () => {
    mock(sendEmail).mockRejectedValue(new Error('resend down'))
    const res = await POST(req({ elementId: 'lg1', email: 'a@b.com' }), ctx)
    expect(res.status).toBe(200)
    expect(db.leadCapture.create).toHaveBeenCalledTimes(1)
    // delivered stays false — the owner sees an honest "pending"
    expect(db.leadCapture.update).not.toHaveBeenCalled()
  })
})
