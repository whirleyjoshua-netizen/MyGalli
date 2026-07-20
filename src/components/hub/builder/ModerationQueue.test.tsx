import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ModerationQueue } from './ModerationQueue'

const reports = [
  { id: 'r1', targetType: 'member', targetId: 'u9', reason: 'harassment', note: 'being mean', status: 'open', createdAt: '2026-01-01T00:00:00.000Z' },
  { id: 'r2', targetType: 'post', targetId: 'p1', reason: 'spam', note: null, status: 'open', createdAt: '2026-01-01T00:00:00.000Z' },
]

beforeEach(() => {
  vi.restoreAllMocks()
  global.fetch = vi.fn(async (url: any, init?: any) => {
    if (String(url).endsWith('/reports') && !init) return { ok: true, json: async () => ({ reports }) } as any
    if (init?.method === 'PATCH') return { ok: true, json: async () => ({ ok: true }) } as any
    if (init?.method === 'POST') return { ok: true, json: async () => ({ ok: true }) } as any
    return { ok: true, json: async () => ({}) } as any
  }) as any
})

describe('ModerationQueue', () => {
  it('lists open reports', async () => {
    render(<ModerationQueue hubId="h1" />)
    expect(await screen.findByText('member · harassment')).toBeInTheDocument()
    expect(screen.getByText('post · spam')).toBeInTheDocument()
  })

  it('Dismiss PATCHes status dismissed', async () => {
    render(<ModerationQueue hubId="h1" />)
    await screen.findByText('member · harassment')
    fireEvent.click(screen.getAllByRole('button', { name: /Dismiss/ })[0])

    await waitFor(() => {
      const call = (global.fetch as any).mock.calls.find((c: any[]) => c[1]?.method === 'PATCH')
      expect(call[0]).toBe('/api/hubs/h1/reports/r1')
      expect(JSON.parse(call[1].body)).toEqual({ status: 'dismissed' })
    })
    await waitFor(() => expect(screen.queryByText('member · harassment')).toBeNull())
  })

  it('Remove & ban POSTs to the bans API', async () => {
    render(<ModerationQueue hubId="h1" />)
    await screen.findByText('member · harassment')
    fireEvent.click(screen.getByRole('button', { name: /Remove & ban/ }))

    await waitFor(() => {
      const call = (global.fetch as any).mock.calls.find((c: any[]) => c[0] === '/api/hubs/h1/bans')
      expect(call[1].method).toBe('POST')
      expect(JSON.parse(call[1].body)).toEqual({ userId: 'u9' })
    })
  })

  it('renders a plain empty state when there are no reports', async () => {
    global.fetch = vi.fn(async () => ({ ok: true, json: async () => ({ reports: [] }) }) as any) as any
    render(<ModerationQueue hubId="h1" />)
    expect(await screen.findByText('No open reports.')).toBeInTheDocument()
  })
})
