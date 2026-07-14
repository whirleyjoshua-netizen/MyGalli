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
  const recordsRef = useRef<GridRecord[]>(records)
  useEffect(() => { recordsRef.current = records }, [records])

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}`)
      if (!res.ok) throw new Error('Failed to load workspace')
      const body = await res.json()
      setWorkspace(body.workspace)
      setFields(body.fields)
      setRecords(body.records)
      setError(null)
    } catch (e: any) {
      setError(e.message || 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [workspaceId])

  useEffect(() => { reload() }, [reload])

  const updateCell = useCallback(async (recordId: string, key: string, value: any) => {
    const prev = recordsRef.current.find((r) => r.id === recordId)
    setRecords((rs) => rs.map((r) => (r.id === recordId ? { ...r, data: { ...r.data, [key]: value } } : r)))
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/records/${recordId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: { [key]: value } }),
      })
      if (!res.ok) throw new Error('Save failed')
      setError(null)
    } catch (e: any) {
      if (prev) setRecords((rs) => rs.map((r) => (r.id === recordId ? prev! : r)))
      setError(e.message || 'Save failed')
    }
  }, [workspaceId])

  const addRow = useCallback(async () => {
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/records`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: {} }),
      })
      if (!res.ok) throw new Error('Add row failed')
      const rec = await res.json()
      setRecords((rs) => [...rs, { id: rec.id, data: rec.data ?? {}, updatedAt: rec.updatedAt }])
      setError(null)
    } catch (e: any) { setError(e.message || 'Add row failed') }
  }, [workspaceId])

  const deleteRow = useCallback(async (recordId: string) => {
    const snapshot = records
    setRecords((rs) => rs.filter((r) => r.id !== recordId))
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/records/${recordId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Delete failed')
    } catch (e: any) { setRecords(snapshot); setError(e.message || 'Delete failed') }
  }, [workspaceId, records])

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
