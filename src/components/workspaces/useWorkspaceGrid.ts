'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

export type GridRecord = { id: string; data: Record<string, any>; updatedAt: string }
export type GridField = { id: string; key: string; label: string; type: string; position: number; required?: boolean; config?: any }
type Workspace = { id: string; name: string; description: string | null; icon: string | null }
export type WorkspaceView = { id: string; name: string; type: string; config: any; position: number }

export function useWorkspaceGrid(workspaceId: string, initialViewId?: string | null) {
  // Seed for the very first reload only (deep-link support for ?view=<id>).
  // Captured once — once the user picks a view via setActiveViewId, that
  // becomes `cur` on subsequent reloads and always wins (see reload() below),
  // so this seed can never re-assert itself over a later user choice.
  const initialViewIdRef = useRef(initialViewId ?? null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [fields, setFields] = useState<GridField[]>([])
  const [views, setViews] = useState<WorkspaceView[]>([])
  const [records, setRecords] = useState<GridRecord[]>([])
  const [activeViewId, setActiveViewId] = useState<string | null>(null)
  const [filterError, setFilterError] = useState<string | null>(null)
  // Which view the currently-committed `records` belong to. Set atomically
  // with each successful commitRecords in loadViewRecords, and cleared to
  // null whenever a fetch for a (possibly different) view starts, so
  // consumers can tell — without a race — whether `records` actually
  // describes `activeViewId` right now, or a fetch is still in flight.
  const [recordsViewId, setRecordsViewId] = useState<string | null>(null)
  // The view's true total record count (from pagination.total), not just the
  // current page length — committed on the exact same path/gate as records so
  // it can never describe a different (or stale) view than what's on screen.
  const [total, setTotal] = useState<number | null>(null)
  // Bumped by mutators that change a field/column without changing activeViewId,
  // so the per-view records effect (keyed on activeViewId) re-fires and picks up
  // e.g. a filterError caused by deleting a field the active view's filter used.
  const [viewRecordsNonce, setViewRecordsNonce] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [sortError, setSortError] = useState<string | null>(null)
  // Guards against out-of-order responses: only the latest-issued request for
  // view records is allowed to commit its result.
  const viewRecordsRequestRef = useRef(0)
  // recordsRef is the synchronously-maintained source of truth for the records
  // array. Every path that changes records goes through commitRecords(), which
  // updates the ref and React state together — so back-to-back mutators in the
  // same tick read a fresh snapshot rather than a stale post-commit value.
  const recordsRef = useRef<GridRecord[]>(records)
  const commitRecords = useCallback((next: GridRecord[]) => {
    recordsRef.current = next
    setRecords(next)
  }, [])

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}`)
      if (!res.ok) throw new Error('Failed to load workspace')
      const body = await res.json()
      setWorkspace(body.workspace)
      setFields(body.fields)
      const viewList = body.views ?? []
      setViews(viewList)
      // Records are owned exclusively by the per-view fetch (loadViewRecords) so
      // that what's on screen always matches the active view's saved filter.
      // Resolve activeViewId against the *fresh* view list: keep the current id
      // only if it still exists (e.g. it wasn't just deleted), else fall back to
      // the first view.
      setActiveViewId((cur) => {
        if (cur && viewList.some((v: WorkspaceView) => v.id === cur)) return cur
        const seed = initialViewIdRef.current
        if (seed && viewList.some((v: WorkspaceView) => v.id === seed)) return seed
        return viewList[0]?.id ?? null
      })
      setError(null)
    } catch (e: any) {
      setError(e.message || 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [workspaceId])

  useEffect(() => { reload() }, [reload])

  const updateCell = useCallback(async (recordId: string, key: string, value: any) => {
    const snapshot = recordsRef.current
    commitRecords(snapshot.map((r) => (r.id === recordId ? { ...r, data: { ...r.data, [key]: value } } : r)))
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/records/${recordId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: { [key]: value } }),
      })
      if (!res.ok) throw new Error('Save failed')
      setError(null)
    } catch (e: any) {
      // Revert only this record to its value at call time, preserving any
      // concurrent successful edits to OTHER records made in the interim.
      const prev = snapshot.find((r) => r.id === recordId)
      if (prev) commitRecords(recordsRef.current.map((r) => (r.id === recordId ? prev : r)))
      setError(e.message || 'Save failed')
    }
  }, [workspaceId, commitRecords])

  const addRow = useCallback(async () => {
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/records`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: {} }),
      })
      if (!res.ok) throw new Error('Add row failed')
      const rec = await res.json()
      commitRecords([...recordsRef.current, { id: rec.id, data: rec.data ?? {}, updatedAt: rec.updatedAt }])
      setError(null)
    } catch (e: any) { setError(e.message || 'Add row failed') }
  }, [workspaceId, commitRecords])

  const deleteRow = useCallback(async (recordId: string) => {
    const snapshot = recordsRef.current
    commitRecords(snapshot.filter((r) => r.id !== recordId))
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/records/${recordId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Delete failed')
    } catch (e: any) {
      // Restore the deleted record at its original index without clobbering
      // concurrent edits/additions made to the current array in the interim.
      const removed = snapshot.find((r) => r.id === recordId)
      const idx = snapshot.findIndex((r) => r.id === recordId)
      if (removed && !recordsRef.current.some((r) => r.id === recordId)) {
        const next = [...recordsRef.current]
        next.splice(Math.min(idx, next.length), 0, removed)
        commitRecords(next)
      }
      setError(e.message || 'Delete failed')
    }
  }, [workspaceId, commitRecords])

  const addField = useCallback(async (label: string, type: string, config?: any) => {
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/fields`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label, type, config }),
      })
      if (!res.ok) throw new Error('Add column failed')
      await reload()
      setViewRecordsNonce((n) => n + 1)
    } catch (e: any) { setError(e.message || 'Add column failed') }
  }, [workspaceId, reload])

  const updateField = useCallback(async (fieldId: string, patch: Record<string, any>) => {
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/fields/${fieldId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      if (!res.ok) throw new Error('Update column failed')
      await reload()
      setViewRecordsNonce((n) => n + 1)
    } catch (e: any) { setError(e.message || 'Update column failed') }
  }, [workspaceId, reload])

  const deleteField = useCallback(async (fieldId: string) => {
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/fields/${fieldId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Delete column failed')
      await reload()
      setViewRecordsNonce((n) => n + 1)
    } catch (e: any) { setError(e.message || 'Delete column failed') }
  }, [workspaceId, reload])

  const addView = useCallback(async (name: string, type: string, config?: any): Promise<WorkspaceView | null> => {
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/views`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, type, config: config ?? {} }),
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Add view failed')
      const view = await res.json()
      await reload()
      return view
    } catch (e: any) { setError(e.message || 'Add view failed'); return null }
  }, [workspaceId, reload])

  const updateView = useCallback(async (viewId: string, config: Record<string, any>) => {
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/views/${viewId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config }),
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Update view failed')
      await reload()
      // The view's own records (e.g. after clearing its filter) need
      // re-fetching even though activeViewId hasn't changed.
      setViewRecordsNonce((n) => n + 1)
    } catch (e: any) { setError(e.message || 'Update view failed') }
  }, [workspaceId, reload])

  const deleteView = useCallback(async (viewId: string) => {
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/views/${viewId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Delete view failed')
      await reload()
    } catch (e: any) { setError(e.message || 'Delete view failed') }
  }, [workspaceId, reload])

  const loadViewRecords = useCallback(async (viewId: string) => {
    const requestId = ++viewRecordsRequestRef.current
    // A new fetch is starting: the committed records no longer provably
    // belong to any particular view until this (or a newer) request commits.
    // Clearing this synchronously with the request bump means there is never
    // a render where recordsViewId claims to match a view whose records
    // haven't actually arrived yet.
    setRecordsViewId(null)
    try {
      const qs = new URLSearchParams({ page: String(page), search })
      const res = await fetch(`/api/workspaces/${workspaceId}/views/${viewId}/records?${qs}`)
      if (!res.ok) throw new Error('Failed to load records')
      const body = await res.json()
      // Ignore stale responses: if a newer request has been issued since this
      // one started (e.g. the user switched views again before this resolved),
      // discard this result — including its filterError and total — so it
      // can't overwrite the currently-active view's records.
      if (requestId !== viewRecordsRequestRef.current) return
      commitRecords(body.records ?? [])
      setRecordsViewId(viewId)
      setFilterError(body.filterError ?? null)
      setSortError(body.sortError ?? null)
      setTotal(typeof body.pagination?.total === 'number' ? body.pagination.total : null)
    } catch (e: any) {
      if (requestId !== viewRecordsRequestRef.current) return
      setError(e.message || 'Failed to load records')
    }
  }, [workspaceId, commitRecords, page, search])

  useEffect(() => {
    if (activeViewId) loadViewRecords(activeViewId)
    else { commitRecords([]); setRecordsViewId(null) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeViewId, loadViewRecords, viewRecordsNonce])

  useEffect(() => { setPage(1) }, [activeViewId])
  useEffect(() => { setPage(1) }, [search])

  const setSort = useCallback((fieldKey: string) => {
    const view = views.find((v) => v.id === activeViewId)
    if (!view) return
    const cur = (view.config as any)?.sort as { field: string; dir: 'asc' | 'desc' } | undefined
    let next: { field: string; dir: 'asc' | 'desc' } | undefined
    if (!cur || cur.field !== fieldKey) next = { field: fieldKey, dir: 'asc' }
    else if (cur.dir === 'asc') next = { field: fieldKey, dir: 'desc' }
    else next = undefined // third click clears
    const nextConfig = { ...(view.config as any) }
    if (next) nextConfig.sort = next
    else delete nextConfig.sort
    updateView(view.id, nextConfig)
  }, [views, activeViewId, updateView])

  const activeSort = ((views.find((v) => v.id === activeViewId)?.config as any)?.sort ?? null) as
    { field: string; dir: 'asc' | 'desc' } | null

  return { loading, error, workspace, fields, views, records, activeViewId, setActiveViewId, filterError, recordsViewId, total, loadViewRecords, addRow, updateCell, deleteRow, addField, updateField, deleteField, addView, updateView, deleteView, reload, page, setPage, search, setSearch, setSort, sortError, activeSort }
}
