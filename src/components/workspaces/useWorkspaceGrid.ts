'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

export type GridRecord = { id: string; data: Record<string, any>; updatedAt: string }
export type GridField = { id: string; key: string; label: string; type: string; position: number; required?: boolean; config?: any }
type Workspace = { id: string; name: string; description: string | null; icon: string | null }

export function useWorkspaceGrid(workspaceId: string) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [fields, setFields] = useState<GridField[]>([])
  const [records, setRecords] = useState<GridRecord[]>([])
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
      commitRecords(body.records)
      setError(null)
    } catch (e: any) {
      setError(e.message || 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [workspaceId, commitRecords])

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
    } catch (e: any) { setError(e.message || 'Update column failed') }
  }, [workspaceId, reload])

  const deleteField = useCallback(async (fieldId: string) => {
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/fields/${fieldId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Delete column failed')
      await reload()
    } catch (e: any) { setError(e.message || 'Delete column failed') }
  }, [workspaceId, reload])

  return { loading, error, workspace, fields, records, addRow, updateCell, deleteRow, addField, updateField, deleteField, reload }
}
