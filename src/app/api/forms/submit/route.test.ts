import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/rate-limit', () => ({ rateLimit: vi.fn().mockResolvedValue(null) }))
vi.mock('@/lib/auth', () => ({ getJwtSecret: () => 'test-secret' }))
vi.mock('@/lib/db', () => ({
  db: {
    display: { findUnique: vi.fn() },
    formResponse: { create: vi.fn() },
  },
}))
vi.mock('@/lib/crm/ingest', () => ({ ingestLead: vi.fn().mockResolvedValue(undefined) }))

import { db } from '@/lib/db'
import { ingestLead } from '@/lib/crm/ingest'
import { POST } from './route'

const req = (body: unknown) =>
  new Request('http://localhost/api/forms/submit', {
    method: 'POST',
    body: JSON.stringify(body),
  }) as never

const DISPLAY = { id: 'd1', published: true }

beforeEach(() => {
  vi.clearAllMocks()
  ;(db.display.findUnique as any).mockResolvedValue(DISPLAY)
  ;(db.formResponse.create as any).mockResolvedValue({ id: 'fr1' })
})

describe('POST /api/forms/submit', () => {
  it('stores the response and ingests a lead sniffed from the responses blob', async () => {
    const responses = {
      q1: { type: 'email', question: 'Your email', answer: 'lead@example.com' },
      q2: { type: 'text', question: 'Your name', answer: 'Jamie Rivera' },
    }
    const res = await POST(req({ displayId: 'd1', sessionId: 's1', responses }))
    expect(res.status).toBe(200)
    expect(db.formResponse.create).toHaveBeenCalledTimes(1)
    expect(ingestLead).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'form',
        sourceId: 'fr1',
        email: 'lead@example.com',
        name: 'Jamie Rivera',
      })
    )
  })

  it('ingests with a null email when no field looks like an email (dropped internally)', async () => {
    const responses = { q1: { type: 'text', question: 'Favorite color', answer: 'blue' } }
    const res = await POST(req({ displayId: 'd1', responses }))
    expect(res.status).toBe(200)
    expect(ingestLead).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'form', sourceId: 'fr1', email: null })
    )
  })
})
