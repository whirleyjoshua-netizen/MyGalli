import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({ getUser: vi.fn() }))
vi.mock('@/lib/crm/stages', () => ({ ensureStages: vi.fn() }))
vi.mock('@/lib/db', () => ({
  db: {
    crmContact: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    crmStage: { findFirst: vi.fn() },
    crmActivity: { create: vi.fn() },
  },
}))

import { getUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { ensureStages } from '@/lib/crm/stages'
import { GET, POST } from './route'
import { PATCH } from './[id]/route'
import { POST as POST_NOTE } from './[id]/notes/route'

const req = (url: string, body?: unknown) =>
  new Request(url, { method: body ? 'POST' : 'GET', body: body ? JSON.stringify(body) : undefined }) as any

const ctx = (id: string) => ({ params: Promise.resolve({ id }) })

beforeEach(() => {
  vi.clearAllMocks()
  ;(getUser as any).mockResolvedValue({ id: 'u1', plan: 'free' })
  ;(ensureStages as any).mockResolvedValue([{ id: 's1', order: 0 }])
  ;(db.crmContact.findMany as any).mockResolvedValue([])
  ;(db.crmContact.findFirst as any).mockResolvedValue({ id: 'c1', ownerId: 'u1' })
  ;(db.crmContact.create as any).mockResolvedValue({ id: 'c1' })
  ;(db.crmContact.update as any).mockResolvedValue({ id: 'c1', stageId: 's2' })
  ;(db.crmStage.findFirst as any).mockResolvedValue({ id: 's2', ownerId: 'u1' })
  ;(db.crmActivity.create as any).mockResolvedValue({ id: 'a1' })
})

describe('GET /api/crm/contacts', () => {
  it('401 when signed out', async () => {
    ;(getUser as any).mockResolvedValue(null)
    expect((await GET(req('http://localhost/api/crm/contacts'))).status).toBe(401)
  })

  it('a free-plan user has full access', async () => {
    expect((await GET(req('http://localhost/api/crm/contacts'))).status).toBe(200)
  })

  it('scopes every query to the caller', async () => {
    await GET(req('http://localhost/api/crm/contacts'))
    expect(db.crmContact.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ ownerId: 'u1' }) })
    )
  })

  it('searches name and email together', async () => {
    await GET(req('http://localhost/api/crm/contacts?q=ada'))
    expect(db.crmContact.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [
            { name: { contains: 'ada', mode: 'insensitive' } },
            { email: { contains: 'ada', mode: 'insensitive' } },
          ],
        }),
      })
    )
  })

  it('filters by stage', async () => {
    await GET(req('http://localhost/api/crm/contacts?stageId=s1'))
    expect(db.crmContact.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ stageId: 's1' }) })
    )
  })
})

describe('POST /api/crm/contacts', () => {
  it('gives an email-less manual contact a unique mergeKey', async () => {
    await POST(req('http://localhost/api/crm/contacts', { name: 'Walk-in' }))
    const arg = (db.crmContact.create as any).mock.calls[0][0]
    expect(arg.data.mergeKey).toMatch(/^manual:/)
    expect(arg.data.email).toBeNull()
  })

  it('uses the normalized email as the mergeKey when one is given', async () => {
    await POST(req('http://localhost/api/crm/contacts', { name: 'Ada', email: ' ADA@X.com ' }))
    const arg = (db.crmContact.create as any).mock.calls[0][0]
    expect(arg.data.mergeKey).toBe('ada@x.com')
    expect(arg.data.email).toBe('ada@x.com')
  })
})

describe('PATCH /api/crm/contacts/[id]', () => {
  it('404s a contact owned by someone else', async () => {
    ;(db.crmContact.findFirst as any).mockResolvedValue(null)
    const res = await PATCH(req('http://localhost/x', { stageId: 's2' }), ctx('theirs'))
    expect(res.status).toBe(404)
    expect(db.crmContact.findFirst).toHaveBeenCalledWith({ where: { id: 'theirs', ownerId: 'u1' } })
    expect(db.crmContact.update).not.toHaveBeenCalled()
  })

  it('404s a stage owned by someone else', async () => {
    ;(db.crmStage.findFirst as any).mockResolvedValue(null)
    const res = await PATCH(req('http://localhost/x', { stageId: 'their-stage' }), ctx('c1'))
    expect(res.status).toBe(404)
    expect(db.crmStage.findFirst).toHaveBeenCalledWith({ where: { id: 'their-stage', ownerId: 'u1' } })
    expect(db.crmContact.update).not.toHaveBeenCalled()
  })

  it('restages a contact the caller owns', async () => {
    const res = await PATCH(req('http://localhost/x', { stageId: 's2' }), ctx('c1'))
    expect(res.status).toBe(200)
    expect(db.crmContact.update).toHaveBeenCalledWith({
      where: { id: 'c1', ownerId: 'u1' },
      data: expect.objectContaining({ stageId: 's2' }),
    })
  })
})

describe('POST /api/crm/contacts/[id]/notes', () => {
  it('stores a note as an activity', async () => {
    const res = await POST_NOTE(req('http://localhost/x', { text: 'Called, left voicemail' }), ctx('c1'))
    expect(res.status).toBe(201)
    expect(db.crmActivity.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ contactId: 'c1', source: 'note', summary: 'Called, left voicemail' }),
    })
  })

  it('rejects an empty note', async () => {
    const res = await POST_NOTE(req('http://localhost/x', { text: '  ' }), ctx('c1'))
    expect(res.status).toBe(400)
    expect(db.crmActivity.create).not.toHaveBeenCalled()
  })

  it('truncates a note longer than the stored-text cap', async () => {
    const longText = 'a'.repeat(6000)
    await POST_NOTE(req('http://localhost/x', { text: longText }), ctx('c1'))
    const arg = (db.crmActivity.create as any).mock.calls[0][0]
    expect(arg.data.payload.text.length).toBe(5000)
    expect(arg.data.summary.length).toBe(280)
  })
})
