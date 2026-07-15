import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from './route'
import { getUser } from '@/lib/auth'
import { authorizeWorkspace } from '@/lib/workspaces/authorize'
import { rateLimit } from '@/lib/rate-limit'
import { db } from '@/lib/db'

vi.mock('@/lib/auth', () => ({ getUser: vi.fn() }))
vi.mock('@/lib/workspaces/authorize', () => ({ authorizeWorkspace: vi.fn() }))
vi.mock('@/lib/rate-limit', () => ({ rateLimit: vi.fn() }))
vi.mock('@/lib/db', () => ({
  db: {
    workspaceField: { findMany: vi.fn() },
    // Mocked so the "no records sent" test can assert this was never touched.
    workspaceRecord: { findMany: vi.fn(), count: vi.fn() },
  },
}))

const createMock = vi.fn()
vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    messages = { create: createMock }
  },
}))

const ctx = { params: Promise.resolve({ id: 'w1' }) }
const req = (body: any) => ({ json: async () => body, headers: new Headers() }) as any

const FIELDS = [
  { id: 'f1', key: 'sport', label: 'Sport', type: 'choice', position: 0, config: { options: ['Soccer', 'Tennis'] } },
  { id: 'f2', key: 'fee', label: 'Fee', type: 'currency', position: 1, config: { symbol: '$' } },
]

function modelReturns(obj: any) {
  createMock.mockResolvedValue({ content: [{ type: 'text', text: JSON.stringify(obj) }] })
}

describe('POST filter-suggest', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.ANTHROPIC_API_KEY = 'test-key'
    ;(rateLimit as any).mockResolvedValue(null)
    ;(db.workspaceField.findMany as any).mockResolvedValue(FIELDS)
    ;(authorizeWorkspace as any).mockResolvedValue({ id: 'w1' })
  })

  it('401 when unauthenticated', async () => {
    ;(getUser as any).mockResolvedValue(null)
    expect((await POST(req({ question: 'soccer' }), ctx)).status).toBe(401)
  })

  it('404 for a workspace the user does not own', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'u1' })
    ;(authorizeWorkspace as any).mockRejectedValue(new Error('Unauthorized or Workspace not found'))
    expect((await POST(req({ question: 'soccer' }), ctx)).status).toBe(404)
  })

  it('400 on a missing or too-short question', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'u1' })
    expect((await POST(req({ question: 'a' }), ctx)).status).toBe(400)
  })

  it('200 returns a validated filter and a human summary', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'u1' })
    modelReturns({ op: 'and', conditions: [
      { field: 'sport', cmp: 'eq', value: 'Soccer' },
      { field: 'fee', cmp: 'gt', value: 1200 },
    ] })
    const res = await POST(req({ question: 'soccer players with a fee over 1200' }), ctx)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.filter.conditions).toHaveLength(2)
    expect(body.summary).toContain('Sport is Soccer')
  })

  it('422 when the model invents a field', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'u1' })
    modelReturns({ op: 'and', conditions: [{ field: 'ghost', cmp: 'eq', value: 'x' }] })
    const res = await POST(req({ question: 'anything' }), ctx)
    expect(res.status).toBe(422)
    expect((await res.json()).error).toMatch(/Unknown field/)
  })

  it('never reads records at all — the route is structurally incapable of leaking them', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'u1' })
    modelReturns({ op: 'and', conditions: [{ field: 'sport', cmp: 'eq', value: 'Soccer' }] })
    await POST(req({ question: 'soccer' }), ctx)

    // The real guarantee: this route never queries the record table, so there
    // is no record data in the process to send. Asserting the absence of a
    // sample name would pass vacuously — assert the query never happens.
    expect(db.workspaceRecord.findMany).not.toHaveBeenCalled()
    expect(db.workspaceRecord.count).not.toHaveBeenCalled()
  })

  it('sends the field schema and the right model', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'u1' })
    modelReturns({ op: 'and', conditions: [{ field: 'sport', cmp: 'eq', value: 'Soccer' }] })
    await POST(req({ question: 'soccer' }), ctx)

    const sentArgs = createMock.mock.calls[0][0]
    expect(sentArgs.model).toBe('claude-opus-4-8')
    expect(JSON.stringify(sentArgs)).toContain('sport')
  })

  it('429 passthrough when rate limited', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'u1' })
    ;(rateLimit as any).mockResolvedValue(new Response('rate limited', { status: 429 }))
    expect((await POST(req({ question: 'soccer' }), ctx)).status).toBe(429)
  })

  it('rate limits by user id, not just IP (Finding: per-IP limiter let one account spend from several networks)', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'u-42' })
    modelReturns({ op: 'and', conditions: [{ field: 'sport', cmp: 'eq', value: 'Soccer' }] })
    await POST(req({ question: 'soccer' }), ctx)
    expect(rateLimit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ identifier: 'u-42' }))
  })
})
