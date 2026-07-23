import { it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({ getUser: vi.fn() }))
vi.mock('@/lib/db', () => ({
  db: { display: { findUnique: vi.fn(), update: vi.fn(async () => ({})) } },
}))

import { getUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { POST, DELETE } from './route'

const ctx = { params: Promise.resolve({ id: 'd1', elementId: 'e1' }) }
const req = (body?: unknown) => ({ json: async () => body ?? {} } as any)

function display(overrides: Record<string, unknown> = {}) {
  return {
    id: 'd1',
    userId: 'owner',
    version: 3,
    collaborators: [{ userId: 'collab' }],
    sections: [
      { id: 's1', layout: 'full-width', columns: [
        { id: 'c1', elements: [
          { id: 'e1', type: 'text', content: 'hello' },
          { id: 'e2', type: 'image', url: 'https://x/a.jpg' },
        ] },
      ] },
    ],
    ...overrides,
  }
}

beforeEach(() => vi.resetAllMocks())

it('POST 401 when logged out', async () => {
  ;(getUser as any).mockResolvedValue(null)
  expect((await POST(req(), ctx)).status).toBe(401)
})

it('POST 404 when the display does not exist', async () => {
  ;(getUser as any).mockResolvedValue({ id: 'owner' })
  ;(db.display.findUnique as any).mockResolvedValue(null)
  expect((await POST(req(), ctx)).status).toBe(404)
})

it('POST 404 (not 403) for a signed-in stranger', async () => {
  ;(getUser as any).mockResolvedValue({ id: 'stranger' })
  ;(db.display.findUnique as any).mockResolvedValue(display())
  const res = await POST(req(), ctx)
  expect(res.status).toBe(404)
  expect(db.display.update).not.toHaveBeenCalled()
})

it('POST 404 when the element id is not in the page', async () => {
  ;(getUser as any).mockResolvedValue({ id: 'owner' })
  ;(db.display.findUnique as any).mockResolvedValue(display())
  const res = await POST(req(), { params: Promise.resolve({ id: 'd1', elementId: 'nope' }) })
  expect(res.status).toBe(404)
})

it('POST stamps for the owner using SERVER time, not the request body', async () => {
  ;(getUser as any).mockResolvedValue({ id: 'owner' })
  ;(db.display.findUnique as any).mockResolvedValue(display())
  const before = Date.now()
  const res = await POST(req({ stampedAt: '1999-01-01T00:00:00.000Z', tz: 'UTC' }), ctx)
  const after = Date.now()
  expect(res.status).toBe(200)
  const data = await res.json()
  const written = Date.parse(data.stampedAt)
  expect(written).toBeGreaterThanOrEqual(before)
  expect(written).toBeLessThanOrEqual(after)
  expect(data.stampedAt).not.toBe('1999-01-01T00:00:00.000Z')
})

it('POST succeeds for a COLLABORATOR, not just the owner', async () => {
  ;(getUser as any).mockResolvedValue({ id: 'collab' })
  ;(db.display.findUnique as any).mockResolvedValue(display())
  expect((await POST(req({ tz: 'UTC' }), ctx)).status).toBe(200)
})

it('POST stores a valid tz and ignores an invalid one', async () => {
  ;(getUser as any).mockResolvedValue({ id: 'owner' })
  ;(db.display.findUnique as any).mockResolvedValue(display())
  const ok = await (await POST(req({ tz: 'America/New_York' }), ctx)).json()
  expect(ok.stampedTz).toBe('America/New_York')

  ;(getUser as any).mockResolvedValue({ id: 'owner' })
  ;(db.display.findUnique as any).mockResolvedValue(display())
  const bad = await (await POST(req({ tz: 'Mars/Olympus_Mons' }), ctx)).json()
  expect(bad.stampedTz).toBeUndefined()
  expect(bad.stampedAt).toBeTruthy()
})

it('POST writes only the target element and leaves siblings untouched', async () => {
  ;(getUser as any).mockResolvedValue({ id: 'owner' })
  ;(db.display.findUnique as any).mockResolvedValue(display())
  await POST(req({ tz: 'UTC' }), ctx)
  const written = (db.display.update as any).mock.calls[0][0].data.sections
  const els = written[0].columns[0].elements
  expect(els[0].stampedAt).toBeTruthy()
  expect(els[0].content).toBe('hello')
  expect(els[1].stampedAt).toBeUndefined()
  expect(els[1].url).toBe('https://x/a.jpg')
})

it('DELETE removes both fields', async () => {
  ;(getUser as any).mockResolvedValue({ id: 'owner' })
  ;(db.display.findUnique as any).mockResolvedValue(display({
    sections: [{ id: 's1', layout: 'full-width', columns: [{ id: 'c1', elements: [
      { id: 'e1', type: 'text', content: 'hello', stampedAt: '2026-01-01T00:00:00.000Z', stampedTz: 'UTC' },
    ] }] }],
  }))
  const res = await DELETE(req(), ctx)
  expect(res.status).toBe(200)
  const el = (db.display.update as any).mock.calls[0][0].data.sections[0].columns[0].elements[0]
  expect(el.stampedAt).toBeUndefined()
  expect(el.stampedTz).toBeUndefined()
  expect(el.content).toBe('hello')
})

it('DELETE 404 for a stranger', async () => {
  ;(getUser as any).mockResolvedValue({ id: 'stranger' })
  ;(db.display.findUnique as any).mockResolvedValue(display())
  expect((await DELETE(req(), ctx)).status).toBe(404)
})

it('a fresh 404 response body is readable on EVERY call, not just the first', async () => {
  // Regression test for a shared module-level NOT_FOUND response: a Response
  // body is a single-use stream, so reusing one instance across requests
  // means the second .json() read on a warm module hits an already-consumed
  // (and locked) stream. Reading both bodies is what exercises the bug —
  // checking .status twice would still pass against the broken version.
  ;(getUser as any).mockResolvedValue({ id: 'owner' })
  ;(db.display.findUnique as any).mockResolvedValue(null)

  const first = await POST(req(), ctx)
  const second = await POST(req(), ctx)

  await expect(first.json()).resolves.toEqual({ error: 'Display not found' })
  await expect(second.json()).resolves.toEqual({ error: 'Display not found' })
})

it('POST 409s on a stale version and does not write', async () => {
  ;(getUser as any).mockResolvedValue({ id: 'owner' })
  ;(db.display.findUnique as any).mockResolvedValue(display({ version: 3 }))
  const res = await POST(req({ tz: 'UTC', version: 2 }), ctx)
  expect(res.status).toBe(409)
  const data = await res.json()
  expect(data).toEqual({ error: 'Version conflict', currentVersion: 3 })
  expect(db.display.update).not.toHaveBeenCalled()
})

it('POST succeeds and bumps version when the client version matches', async () => {
  ;(getUser as any).mockResolvedValue({ id: 'owner' })
  ;(db.display.findUnique as any).mockResolvedValue(display({ version: 3 }))
  const res = await POST(req({ tz: 'UTC', version: 3 }), ctx)
  expect(res.status).toBe(200)
  const data = (db.display.update as any).mock.calls[0][0].data
  expect(data.version).toEqual({ increment: 1 })
})

it('DELETE 409s on a stale version and does not write', async () => {
  ;(getUser as any).mockResolvedValue({ id: 'owner' })
  ;(db.display.findUnique as any).mockResolvedValue(display({
    version: 5,
    sections: [{ id: 's1', layout: 'full-width', columns: [{ id: 'c1', elements: [
      { id: 'e1', type: 'text', content: 'hello', stampedAt: '2026-01-01T00:00:00.000Z', stampedTz: 'UTC' },
    ] }] }],
  }))
  const res = await DELETE(req({ version: 4 }), ctx)
  expect(res.status).toBe(409)
  const data = await res.json()
  expect(data).toEqual({ error: 'Version conflict', currentVersion: 5 })
  expect(db.display.update).not.toHaveBeenCalled()
})
