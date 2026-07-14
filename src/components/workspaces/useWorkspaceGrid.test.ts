import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useWorkspaceGrid } from './useWorkspaceGrid'

const initial = {
  workspace: { id: 'w1', name: 'S', description: null, icon: null },
  fields: [{ id: 'f1', key: 'grade', label: 'Grade', type: 'number', position: 0 }],
  records: [{ id: 'r1', data: { grade: 80 }, updatedAt: '2026-07-14' }],
  pagination: { page: 1, pageSize: 100, total: 1, totalPages: 1 },
}

beforeEach(() => vi.restoreAllMocks())

function mockFetchOnceThen(loadBody: any, mutationOk = true) {
  const fetchMock = vi.fn()
  fetchMock.mockResolvedValueOnce({ ok: true, json: async () => loadBody }) // initial GET
  fetchMock.mockResolvedValue({ ok: mutationOk, json: async () => ({}) }) // subsequent
  ;(globalThis as any).fetch = fetchMock
  return fetchMock
}

describe('useWorkspaceGrid', () => {
  it('loads then optimistically updates a cell', async () => {
    mockFetchOnceThen(initial)
    const { result } = renderHook(() => useWorkspaceGrid('w1'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.records[0].data.grade).toBe(80)

    await act(async () => { await result.current.updateCell('r1', 'grade', 95) })
    expect(result.current.records[0].data.grade).toBe(95)
  })

  it('rolls back a cell on a failed save', async () => {
    mockFetchOnceThen(initial, false) // mutations fail
    const { result } = renderHook(() => useWorkspaceGrid('w1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => { await result.current.updateCell('r1', 'grade', 95) })
    expect(result.current.records[0].data.grade).toBe(80) // reverted
    expect(result.current.error).toBeTruthy()
  })
})
