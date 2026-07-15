import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useWorkspaceGrid } from './useWorkspaceGrid'

const initialRecords = [{ id: 'r1', data: { grade: 80 }, updatedAt: '2026-07-14' }]

const initial = {
  workspace: { id: 'w1', name: 'S', description: null, icon: null },
  fields: [{ id: 'f1', key: 'grade', label: 'Grade', type: 'number', position: 0 }],
  views: [{ id: 'v1', name: 'Grid', type: 'grid', config: {}, position: 0 }],
  // Retained for shape-compatibility with the real GET /api/workspaces/[id]
  // response, but the hook no longer reads this field for its records state —
  // records come solely from GET /api/workspaces/[id]/views/[viewId]/records.
  records: initialRecords,
  pagination: { page: 1, pageSize: 100, total: 1, totalPages: 1 },
}

const initialViewRecords = { view: { id: 'v1' }, fields: initial.fields, records: initialRecords, filterError: null, pagination: initial.pagination }

beforeEach(() => vi.restoreAllMocks())

function mockFetchOnceThen(loadBody: any, mutationOk = true) {
  const fetchMock = vi.fn()
  fetchMock.mockResolvedValueOnce({ ok: true, json: async () => loadBody }) // initial GET
  fetchMock.mockResolvedValueOnce({ ok: true, json: async () => initialViewRecords }) // per-view records GET
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
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => initialViewRecords }) // per-view records GET
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
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => initialViewRecords }) // per-view records GET
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

  it('does not clobber filtered records with the unfiltered main-GET records after a field mutation (Finding 1)', async () => {
    const filteredRecords = [{ id: 'r1', data: { grade: 95 }, updatedAt: '2026-07-14' }] // filter excluded r2
    const unfilteredMainGet = {
      ...initial,
      // Main GET always returns ALL records, unfiltered — the hook must never
      // read this into its records state.
      records: [...initialRecords, { id: 'r2', data: { grade: 40 }, updatedAt: '2026-07-14' }],
    }
    const filteredViewRecords = { view: { id: 'v1' }, fields: initial.fields, records: filteredRecords, filterError: null, pagination: initial.pagination }

    const fetchMock = vi.fn()
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => initial }) // initial main GET
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => filteredViewRecords }) // initial per-view GET (filtered)
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({}) }) // addField POST
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => unfilteredMainGet }) // reload() main GET after addField
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => filteredViewRecords }) // re-fetched per-view GET (still filtered)
    ;(globalThis as any).fetch = fetchMock

    const { result } = renderHook(() => useWorkspaceGrid('w1'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.records).toHaveLength(1)

    await act(async () => { await result.current.addField('New', 'text') })
    await waitFor(() => expect(result.current.records).toHaveLength(1))
    // Must still reflect the view's filtered set, not the unfiltered main GET.
    expect(result.current.records.map((r) => r.id)).toEqual(['r1'])
  })

  it('lands on a real remaining view (with its records) after deleting the active view (Finding 2)', async () => {
    const withTwoViews = {
      ...initial,
      views: [
        { id: 'v1', name: 'Grid', type: 'grid', config: {}, position: 0 },
        { id: 'v2', name: 'Gallery', type: 'gallery', config: {}, position: 1 },
      ],
    }
    const v2Records = { view: { id: 'v2' }, fields: initial.fields, records: [{ id: 'r9', data: { grade: 1 }, updatedAt: '2026-07-14' }], filterError: null, pagination: initial.pagination }
    const afterDeleteMainGet = { ...withTwoViews, views: [{ id: 'v2', name: 'Gallery', type: 'gallery', config: {}, position: 1 }] }

    const fetchMock = vi.fn()
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => withTwoViews }) // initial main GET
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => initialViewRecords }) // initial per-view GET (v1)
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({}) }) // DELETE v1
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => afterDeleteMainGet }) // reload() main GET (v1 gone)
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => v2Records }) // per-view GET for v2
    ;(globalThis as any).fetch = fetchMock

    const { result } = renderHook(() => useWorkspaceGrid('w1'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.activeViewId).toBe('v1')

    await act(async () => { await result.current.deleteView('v1') })
    await waitFor(() => expect(result.current.activeViewId).toBe('v2'))
    await waitFor(() => expect(result.current.records.map((r) => r.id)).toEqual(['r9']))
  })

  it('ignores a stale view-records response that resolves after a newer one (Finding 3)', async () => {
    let resolveStale!: (v: any) => void
    const stalePromise = new Promise((resolve) => { resolveStale = resolve })

    const fetchMock = vi.fn()
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => initial }) // initial main GET
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => initialViewRecords }) // mount's per-view GET (v1) — resolves normally
    ;(globalThis as any).fetch = fetchMock

    const { result } = renderHook(() => useWorkspaceGrid('w1'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    await waitFor(() => expect(result.current.records.map((r) => r.id)).toEqual(['r1']))

    // Issue a slow ("stale") request, then a fast one that resolves first.
    fetchMock.mockImplementationOnce(() => stalePromise) // stale request — held open
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ view: { id: 'v1' }, fields: initial.fields, records: [{ id: 'r-fast', data: { grade: 2 }, updatedAt: '2026-07-14' }], filterError: null, pagination: initial.pagination }) }) // newer request — resolves first

    let stalePending: Promise<void>
    await act(async () => {
      stalePending = result.current.loadViewRecords('v1') // stale, held open
      await result.current.loadViewRecords('v1') // newer, resolves immediately
    })
    expect(result.current.records.map((r) => r.id)).toEqual(['r-fast'])

    // Now let the stale request resolve — it must be discarded, not overwrite the newer result.
    await act(async () => {
      resolveStale({ ok: true, json: async () => ({ view: { id: 'v1' }, fields: initial.fields, records: [{ id: 'r-stale' }], filterError: 'stale filter error', pagination: initial.pagination }) })
      await stalePending
    })
    expect(result.current.records.map((r) => r.id)).toEqual(['r-fast'])
    expect(result.current.filterError).not.toBe('stale filter error')
  })

  // NOTE: the previous "Finding 4 / double fetch" test here asserted one
  // main-GET call + one per-view-GET call on mount. That assertion also
  // passes against the pre-fix buggy code (the old bug was a double
  // *commit* of records — main-GET's records briefly overwriting the
  // per-view fetch's — not a double *fetch*; the old code issued exactly
  // the same one-call-per-URL pattern). Since it can't fail against the
  // bug it was meant to catch, it was removed as tautological rather than
  // kept for false confidence.

  it('seeds the active view from an initialViewId naming a non-first view, and fetches that view\'s records (Finding: deep link)', async () => {
    const withTwoViews = {
      ...initial,
      views: [
        { id: 'v1', name: 'Grid', type: 'grid', config: {}, position: 0 },
        { id: 'v2', name: 'Gallery', type: 'gallery', config: {}, position: 1 },
      ],
    }
    const v2Records = { view: { id: 'v2' }, fields: initial.fields, records: [{ id: 'r9', data: { grade: 1 }, updatedAt: '2026-07-14' }], filterError: null, pagination: initial.pagination }

    const fetchMock = vi.fn()
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => withTwoViews }) // main GET
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => v2Records }) // per-view GET — must be for v2, not v1
    ;(globalThis as any).fetch = fetchMock

    const { result } = renderHook(() => useWorkspaceGrid('w1', 'v2'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    await waitFor(() => expect(result.current.activeViewId).toBe('v2'))
    await waitFor(() => expect(result.current.records.map((r) => r.id)).toEqual(['r9']))

    const calls = fetchMock.mock.calls.map((c: any[]) => c[0] as string)
    expect(calls).toContain('/api/workspaces/w1/views/v2/records')
    expect(calls).not.toContain('/api/workspaces/w1/views/v1/records')
  })

  it('falls back to the first view when initialViewId is unknown/garbage', async () => {
    const fetchMock = mockFetchOnceThen(initial)
    const { result } = renderHook(() => useWorkspaceGrid('w1', 'does-not-exist'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.activeViewId).toBe('v1')
    await waitFor(() => expect(result.current.records.map((r) => r.id)).toEqual(['r1']))
  })

  it('never reports records as belonging to the new view mid-switch (Finding: view-switch mismatch)', async () => {
    const withTwoViews = {
      ...initial,
      views: [
        { id: 'v1', name: 'Grid', type: 'grid', config: {}, position: 0 },
        { id: 'v2', name: 'Gallery', type: 'gallery', config: {}, position: 1 },
      ],
    }
    let resolveV2!: (v: any) => void
    const v2Promise = new Promise((resolve) => { resolveV2 = resolve })

    const fetchMock = vi.fn()
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => withTwoViews }) // main GET
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => initialViewRecords }) // per-view GET v1
    ;(globalThis as any).fetch = fetchMock

    const { result } = renderHook(() => useWorkspaceGrid('w1'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    await waitFor(() => expect(result.current.recordsViewId).toBe('v1'))
    expect(result.current.records.map((r) => r.id)).toEqual(['r1'])

    // Switch to v2 — its records fetch is held open (not yet resolved).
    fetchMock.mockImplementationOnce(() => v2Promise)
    act(() => { result.current.setActiveViewId('v2') })

    // Mid-switch: activeViewId is now v2, but records are still v1's.
    // recordsViewId must NOT claim to match the new active view while the
    // committed records are still the old view's — that mismatch is exactly
    // the bug (chips would describe v2's filter over v1's rows).
    await waitFor(() => expect(result.current.activeViewId).toBe('v2'))
    expect(result.current.recordsViewId).not.toBe('v2')
    expect(result.current.records.map((r) => r.id)).toEqual(['r1']) // still old records, but not claimed to match

    // Let v2's fetch resolve; now it's legitimately safe to say they match.
    await act(async () => {
      resolveV2({ ok: true, json: async () => ({ view: { id: 'v2' }, fields: initial.fields, records: [{ id: 'r9', data: { grade: 1 }, updatedAt: '2026-07-14' }], filterError: null, pagination: initial.pagination }) })
    })
    await waitFor(() => expect(result.current.recordsViewId).toBe('v2'))
    expect(result.current.records.map((r) => r.id)).toEqual(['r9'])
  })

  it('keeps the user\'s chosen active view across a mutator-driven reload (Minor: reload must not revert to the initialViewId seed)', async () => {
    const withTwoViews = {
      ...initial,
      views: [
        { id: 'v1', name: 'Grid', type: 'grid', config: {}, position: 0 },
        { id: 'v2', name: 'Gallery', type: 'gallery', config: {}, position: 1 },
      ],
    }
    const v2Records = { view: { id: 'v2' }, fields: initial.fields, records: [{ id: 'r9', data: { grade: 1 }, updatedAt: '2026-07-14' }], filterError: null, pagination: initial.pagination }
    // After addField, the reload's main GET still lists both views (v1 first)
    // — if the hook wrongly re-seeded from initialViewId, it would matter;
    // here we assert it simply doesn't revert away from the user's v2 choice.
    const afterAddFieldMainGet = { ...withTwoViews }

    const fetchMock = vi.fn()
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => withTwoViews }) // initial main GET (seed=v1)
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => initialViewRecords }) // per-view GET v1
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => v2Records }) // per-view GET v2 (after user switch)
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({}) }) // addField POST
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => afterAddFieldMainGet }) // reload() main GET after addField
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => v2Records }) // re-fetched per-view GET v2
    ;(globalThis as any).fetch = fetchMock

    // Seed with initialViewId 'v1' (simulating a deep link), then the user
    // explicitly picks v2.
    const { result } = renderHook(() => useWorkspaceGrid('w1', 'v1'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.activeViewId).toBe('v1')

    act(() => { result.current.setActiveViewId('v2') })
    await waitFor(() => expect(result.current.activeViewId).toBe('v2'))
    await waitFor(() => expect(result.current.records.map((r) => r.id)).toEqual(['r9']))

    await act(async () => { await result.current.addField('New', 'text') })

    // The user's explicit choice (v2) must survive the reload — not revert
    // to the initialViewId seed (v1).
    expect(result.current.activeViewId).toBe('v2')
  })

  it('exposes pagination.total from the per-view response, not the page length (Finding: "N matching" was page length not total)', async () => {
    const manyRecords = { ...initialViewRecords, records: initialRecords, pagination: { page: 1, pageSize: 100, total: 137, totalPages: 2 } }
    const fetchMock = vi.fn()
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => initial }) // main GET
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => manyRecords }) // per-view GET
    ;(globalThis as any).fetch = fetchMock

    const { result } = renderHook(() => useWorkspaceGrid('w1'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    await waitFor(() => expect(result.current.total).toBe(137))
    // Page length is only 1 record, but total must reflect the real count.
    expect(result.current.records).toHaveLength(1)
  })

  it('never commits total from a stale (superseded) view-records response', async () => {
    let resolveStale!: (v: any) => void
    const stalePromise = new Promise((resolve) => { resolveStale = resolve })

    const fetchMock = vi.fn()
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => initial }) // main GET
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => initialViewRecords }) // mount's per-view GET
    ;(globalThis as any).fetch = fetchMock

    const { result } = renderHook(() => useWorkspaceGrid('w1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    fetchMock.mockImplementationOnce(() => stalePromise) // stale — held open
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ view: { id: 'v1' }, fields: initial.fields, records: [{ id: 'r-fast' }], filterError: null, pagination: { page: 1, pageSize: 100, total: 5, totalPages: 1 } }) }) // newer — resolves first

    let stalePending: Promise<void>
    await act(async () => {
      stalePending = result.current.loadViewRecords('v1')
      await result.current.loadViewRecords('v1')
    })
    expect(result.current.total).toBe(5)

    await act(async () => {
      resolveStale({ ok: true, json: async () => ({ view: { id: 'v1' }, fields: initial.fields, records: [{ id: 'r-stale' }], filterError: null, pagination: { page: 1, pageSize: 100, total: 999, totalPages: 1 } }) })
      await stalePending
    })
    expect(result.current.total).toBe(5) // stale total (999) must never win
  })

  it('updateView PATCHes the view config and refreshes (Finding: remove-filter action needed a mutator)', async () => {
    const fetchMock = vi.fn()
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => initial }) // main GET
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => initialViewRecords }) // per-view GET
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'v1' }) }) // PATCH
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => initial }) // reload() main GET
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => initialViewRecords }) // re-fetched per-view GET
    ;(globalThis as any).fetch = fetchMock

    const { result } = renderHook(() => useWorkspaceGrid('w1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => { await result.current.updateView('v1', { visibleFields: ['grade'] }) })

    const patchCall = fetchMock.mock.calls.find((c: any[]) => c[0] === '/api/workspaces/w1/views/v1' && c[1]?.method === 'PATCH')
    expect(patchCall).toBeTruthy()
    expect(JSON.parse(patchCall![1].body)).toEqual({ config: { visibleFields: ['grade'] } })
  })

  it('clears records when there is no active view', async () => {
    const noViews = { ...initial, views: [] }
    const fetchMock = vi.fn()
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => noViews }) // main GET, no views
    ;(globalThis as any).fetch = fetchMock

    const { result } = renderHook(() => useWorkspaceGrid('w1'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.activeViewId).toBeNull()
    expect(result.current.records).toEqual([])
  })
})
