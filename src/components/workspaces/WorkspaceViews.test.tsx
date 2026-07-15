import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { WorkspaceViews } from './WorkspaceViews'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))

const fields = [{ id: 'f1', key: 'fee', label: 'Fee', type: 'currency', position: 0, config: { symbol: '$' } }]
const filter = { op: 'and', conditions: [{ field: 'fee', cmp: 'gt', value: 1200 }] }
const view = { id: 'v1', name: 'Grid', type: 'grid', config: { filter }, position: 0 }

const mainGet = {
  workspace: { id: 'w1', name: 'WS', description: null, icon: null },
  fields,
  views: [view],
  records: [],
  pagination: { page: 1, pageSize: 100, total: 1, totalPages: 1 },
}

// A page of 1 record but a TRUE total of 137 — the regression this covers.
const viewRecords = {
  view: { id: 'v1' },
  fields,
  records: [{ id: 'r1', data: { fee: 1500 }, updatedAt: '2026-07-14' }],
  filterError: null,
  pagination: { page: 1, pageSize: 100, total: 137, totalPages: 2 },
}

function mockFetch() {
  const fetchMock = vi.fn()
  fetchMock.mockResolvedValueOnce({ ok: true, json: async () => mainGet })
  fetchMock.mockResolvedValueOnce({ ok: true, json: async () => viewRecords })
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({ id: 'v1' }) })
  ;(globalThis as any).fetch = fetchMock
  return fetchMock
}

describe('WorkspaceViews filter chips', () => {
  it('shows the true total, not the page length (Finding 3)', async () => {
    mockFetch()
    render(<WorkspaceViews workspaceId="w1" />)
    await waitFor(() => expect(screen.getByText(/137 matching/)).toBeInTheDocument())
  })

  it('wires the remove action to clear config.filter via PATCH (Finding 8)', async () => {
    const fetchMock = mockFetch()
    render(<WorkspaceViews workspaceId="w1" />)
    await waitFor(() => expect(screen.getByTitle('Remove filter')).toBeInTheDocument())

    fireEvent.click(screen.getByTitle('Remove filter'))

    await waitFor(() => {
      const patchCall = fetchMock.mock.calls.find((c: any[]) => c[0] === '/api/workspaces/w1/views/v1' && c[1]?.method === 'PATCH')
      expect(patchCall).toBeTruthy()
      const body = JSON.parse(patchCall![1].body)
      expect(body.config.filter).toBeUndefined()
    })
  })
})
