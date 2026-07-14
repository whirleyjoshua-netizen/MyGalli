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

  it('rolls back only to the last successful value on rapid edits', async () => {
    const fetchMock = vi.fn()
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => initial }) // initial GET
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({}) })     // 1st PATCH (95) OK
    fetchMock.mockResolvedValueOnce({ ok: false, json: async () => ({}) })     // 2nd PATCH (110) FAIL
    ;(globalThis as any).fetch = fetchMock

    const { result } = renderHook(() => useWorkspaceGrid('w1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => { await result.current.updateCell('r1', 'grade', 95) })
    expect(result.current.records[0].data.grade).toBe(95)

    await act(async () => { await result.current.updateCell('r1', 'grade', 110) })
    expect(result.current.records[0].data.grade).toBe(95) // reverts to last successful, not 80
    expect(result.current.error).toBeTruthy()
  })

  it('handles two same-tick edits without a render between them (sync ref)', async () => {
    const fetchMock = vi.fn()
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => initial }) // initial GET
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({}) })     // 1st PATCH (95) OK
    fetchMock.mockResolvedValueOnce({ ok: false, json: async () => ({}) })     // 2nd PATCH (110) FAIL
    ;(globalThis as any).fetch = fetchMock

    const { result } = renderHook(() => useWorkspaceGrid('w1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    // Fire both in the SAME tick — no awaited render flush between them.
    await act(async () => {
      const p1 = result.current.updateCell('r1', 'grade', 95)
      const p2 = result.current.updateCell('r1', 'grade', 110)
      await Promise.all([p1, p2])
    })
    // Failed 2nd edit must revert to the 1st successful value (95), not the
    // pre-first-edit value (80) — proving the ref is maintained synchronously.
    expect(result.current.records[0].data.grade).toBe(95)
    expect(result.current.error).toBeTruthy()
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
