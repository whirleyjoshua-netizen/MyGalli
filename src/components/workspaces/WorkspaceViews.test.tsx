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

describe('WorkspaceViews search box (Finding 1 regression)', () => {
  it('keeps the search input mounted while records are loading (recordsViewId !== active view id)', async () => {
    // Never let the records fetch resolve — this reproduces the state during
    // every keystroke pre-fix: recordsViewId is cleared to null the instant a
    // fetch starts, so the input would unmount if it were rendered inside the
    // records-loading gate.
    const fetchMock = vi.fn()
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => mainGet })
    fetchMock.mockImplementation(() => new Promise(() => {})) // records fetch never resolves
    ;(globalThis as any).fetch = fetchMock

    render(<WorkspaceViews workspaceId="w1" />)

    // Wait for the workspace shell (view tabs) to appear, i.e. past the
    // top-level grid.loading gate — at this point the records fetch is still
    // in flight (recordsViewId !== active.id) and the body shows "Loading…".
    await waitFor(() => expect(screen.getByText('Grid')).toBeInTheDocument())
    await waitFor(() => expect(screen.getAllByText('Loading…').length).toBeGreaterThan(0))

    // The search input must still be present and typable.
    const input = screen.getByPlaceholderText('Search records…') as HTMLInputElement
    expect(input).toBeInTheDocument()
    fireEvent.change(input, { target: { value: 'abc' } })
    expect(input.value).toBe('abc')
  })
})
