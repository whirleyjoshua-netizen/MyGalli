import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from './route'
import { getUser } from '@/lib/auth'
import { authorizeWorkspace } from '@/lib/workspaces/authorize'
import { rateLimit } from '@/lib/rate-limit'
import { db } from '@/lib/db'
import { clearFilterCache } from '@/lib/workspaces/filter-cache'

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
    // The route now dedupes identical requests through a module-level cache.
    // Clear it between tests so each starts from a cold cache and the tests
    // that assert the model WAS called stay valid.
    clearFilterCache()
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

  it('surfaces an invalid/expired Anthropic API key as a config error, not a rephrase prompt', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'u1' })
    const authErr: any = new Error('401 {"type":"error","error":{"type":"authentication_error","message":"API key is invalid."}}')
    authErr.status = 401
    createMock.mockRejectedValue(authErr)

    const res = await POST(req({ question: 'soccer players' }), ctx)
    const body = await res.json()

    expect(res.status).toBe(500)
    expect(body.error).not.toMatch(/rephrasing/i)
    expect(body.error).toMatch(/not configured/i)
    expect(body.error).not.toContain('API key is invalid')
  })

  it('rate limits by user id, not just IP (Finding: per-IP limiter let one account spend from several networks)', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'u-42' })
    modelReturns({ op: 'and', conditions: [{ field: 'sport', cmp: 'eq', value: 'Soccer' }] })
    await POST(req({ question: 'soccer' }), ctx)
    expect(rateLimit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ identifier: 'u-42' }))
  })

  it('enforces a sustained hourly ceiling in addition to the per-minute burst limit', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'u1' })
    modelReturns({ op: 'and', conditions: [{ field: 'sport', cmp: 'eq', value: 'Soccer' }] })
    await POST(req({ question: 'soccer' }), ctx)
    expect(rateLimit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ windowMs: 60_000, identifier: 'u1' })
    )
    expect(rateLimit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ windowMs: 3_600_000, identifier: 'u1' })
    )
  })

  it('serves an identical repeat request from cache without paying the model again', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'u1' })
    modelReturns({ op: 'and', conditions: [{ field: 'sport', cmp: 'eq', value: 'Soccer' }] })

    const first = await POST(req({ question: 'soccer players' }), ctx)
    const second = await POST(req({ question: 'soccer players' }), ctx)

    expect(first.status).toBe(200)
    expect(second.status).toBe(200)
    expect(await first.json()).toEqual(await second.json())
    // The model was called exactly once across two identical requests.
    expect(createMock).toHaveBeenCalledTimes(1)
  })

  it('treats case and whitespace variants of the same question as a cache hit', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'u1' })
    modelReturns({ op: 'and', conditions: [{ field: 'sport', cmp: 'eq', value: 'Soccer' }] })
    await POST(req({ question: 'Soccer Players' }), ctx)
    await POST(req({ question: '  soccer   players ' }), ctx)
    expect(createMock).toHaveBeenCalledTimes(1)
  })

  it('does not serve a different question from cache', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'u1' })
    modelReturns({ op: 'and', conditions: [{ field: 'sport', cmp: 'eq', value: 'Soccer' }] })
    await POST(req({ question: 'soccer players' }), ctx)
    await POST(req({ question: 'tennis players' }), ctx)
    expect(createMock).toHaveBeenCalledTimes(2)
  })

  it('never caches an error — a failed call is retried, not memoised', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'u1' })
    const busy: any = new Error('529 overloaded')
    busy.status = 529
    createMock.mockRejectedValueOnce(busy)
    const failed = await POST(req({ question: 'soccer players' }), ctx)
    expect(failed.status).toBe(502)

    // A retry of the same question must reach the model again, not a cached error.
    modelReturns({ op: 'and', conditions: [{ field: 'sport', cmp: 'eq', value: 'Soccer' }] })
    const ok = await POST(req({ question: 'soccer players' }), ctx)
    expect(ok.status).toBe(200)
    expect(createMock).toHaveBeenCalledTimes(2)
  })
})
