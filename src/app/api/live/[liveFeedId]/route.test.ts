import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/rate-limit', () => ({ rateLimit: vi.fn().mockResolvedValue(null) }))
vi.mock('@/lib/auth', () => ({ getUser: vi.fn() }))
vi.mock('@/lib/db', () => ({ db: { liveFeed: { findUnique: vi.fn(), update: vi.fn() } } }))

import { GET, POST } from './route'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'

const ctx = (liveFeedId: string) => ({ params: Promise.resolve({ liveFeedId }) })
const req = (body?: unknown) => new NextRequest('http://localhost/api/live/el-1', { method: body ? 'POST' : 'GET', body: body ? JSON.stringify(body) : undefined })
const baseRow = () => ({ id: 'el-1', isLive: false, values: [{ id: 'a', label: '', value: 0 }], startedAt: null, lastUpdatedAt: new Date('2026-07-25T00:00:00Z'), clockMode: 'off', clockRunning: false, clockElapsedMs: 0, clockLastStartedAt: null, clockDurationMs: null, display: { userId: 'owner' } })

beforeEach(() => vi.clearAllMocks())

it('GET returns idle with empty values when no row exists', async () => {
  ;(db.liveFeed.findUnique as any).mockResolvedValue(null)
  const json = await (await GET(req(), ctx('el-1'))).json()
  expect(json).toMatchObject({ isLive: false, values: [] })
  expect(typeof json.serverTime).toBe('string')
})

it('GET serializes values and clock', async () => {
  ;(db.liveFeed.findUnique as any).mockResolvedValue({ ...baseRow(), values: [{ id: 'a', label: 'Home', value: 7 }], clockMode: 'countup', clockRunning: true, clockElapsedMs: 1000, clockLastStartedAt: new Date('2026-07-25T00:00:00Z') })
  const json = await (await GET(req(), ctx('el-1'))).json()
  expect(json.values[0]).toEqual({ id: 'a', label: 'Home', value: 7 })
  expect(json.clock).toMatchObject({ mode: 'countup', running: true, elapsedMs: 1000 })
})

it('POST 401 logged out', async () => {
  ;(getUser as any).mockResolvedValue(null)
  ;(db.liveFeed.findUnique as any).mockResolvedValue(baseRow())
  expect((await POST(req({ action: 'start' }), ctx('el-1'))).status).toBe(401)
})

it('POST 403 non-owner', async () => {
  ;(getUser as any).mockResolvedValue({ id: 'stranger' })
  ;(db.liveFeed.findUnique as any).mockResolvedValue(baseRow())
  expect((await POST(req({ action: 'start' }), ctx('el-1'))).status).toBe(403)
})

it('POST bump persists the new value list', async () => {
  ;(getUser as any).mockResolvedValue({ id: 'owner' })
  ;(db.liveFeed.findUnique as any).mockResolvedValue(baseRow())
  ;(db.liveFeed.update as any).mockResolvedValue({ lastUpdatedAt: new Date('2026-07-25T00:00:01Z') })
  const json = await (await POST(req({ action: 'bump', id: 'a', delta: 3 }), ctx('el-1'))).json()
  expect(json.values.find((v: any) => v.id === 'a').value).toBe(3)
  expect((db.liveFeed.update as any).mock.calls[0][0].data.values[0].value).toBe(3)
})

it('POST addValue is server-assigned an id, not the client one', async () => {
  ;(getUser as any).mockResolvedValue({ id: 'owner' })
  ;(db.liveFeed.findUnique as any).mockResolvedValue({ ...baseRow(), values: [] })
  ;(db.liveFeed.update as any).mockResolvedValue({ lastUpdatedAt: new Date() })
  const json = await (await POST(req({ action: 'addValue', id: 'HACKED', label: 'Ravens' }), ctx('el-1'))).json()
  expect(json.values).toHaveLength(1)
  expect(json.values[0].id).not.toBe('HACKED')
  expect(json.values[0].label).toBe('Ravens')
})
