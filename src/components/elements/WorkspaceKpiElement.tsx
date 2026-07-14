'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { CanvasElement } from '@/lib/types/canvas'
import { kpiDefaultLabel, formatKpiValue } from './PublicWorkspaceKpiElement'

interface Props {
  element: CanvasElement
  onChange: (updates: Partial<CanvasElement>) => void
  onDelete: () => void
  isSelected: boolean
  onSelect: () => void
}

const AGGS = ['count', 'sum', 'avg', 'min', 'max'] as const

type WsSummary = { id: string; name: string }
type Field = { key: string; label: string; type: string }

export function WorkspaceKpiElement({ element, onChange, onDelete, isSelected, onSelect }: Props) {
  const [workspaces, setWorkspaces] = useState<WsSummary[]>([])
  const [fields, setFields] = useState<Field[]>([])
  const [configuring, setConfiguring] = useState(!element.workspaceKpiWorkspaceId)

  const wsId = element.workspaceKpiWorkspaceId
  const fieldKey = element.workspaceKpiFieldKey
  const agg = element.workspaceKpiAgg || 'avg'

  // Route onChange through a ref so the refresh effect (below) does NOT retrigger
  // every render just because ColumnCanvas passes a fresh inline onChange — that
  // would cause an infinite fetch loop.
  const onChangeRef = useRef(onChange)
  useEffect(() => { onChangeRef.current = onChange })

  // Load workspace list when configuring
  useEffect(() => {
    if (!configuring) return
    fetch('/api/workspaces').then((r) => (r.ok ? r.json() : [])).then(setWorkspaces)
  }, [configuring])

  // Load fields for the selected workspace
  useEffect(() => {
    if (!wsId) { setFields([]); return }
    fetch(`/api/workspaces/${wsId}`).then((r) => (r.ok ? r.json() : null)).then((d) => setFields(d?.fields ?? []))
  }, [wsId])

  // Fetch the live value whenever the binding changes
  const refresh = useCallback(async () => {
    if (!wsId || (agg !== 'count' && !fieldKey)) return
    const qs = new URLSearchParams({ field: fieldKey || '', op: agg })
    const res = await fetch(`/api/workspaces/${wsId}/aggregate?${qs}`)
    if (res.ok) {
      const { value } = await res.json()
      onChangeRef.current({ workspaceKpiValue: value })
    }
  }, [wsId, fieldKey, agg]) // NOT onChange — see onChangeRef above

  useEffect(() => { refresh() }, [refresh])

  function pickWorkspace(w: WsSummary) {
    onChange({ workspaceKpiWorkspaceId: w.id, workspaceKpiWorkspaceName: w.name, workspaceKpiFieldKey: undefined, workspaceKpiFieldLabel: undefined })
  }
  function pickField(f: Field) {
    onChange({ workspaceKpiFieldKey: f.key, workspaceKpiFieldLabel: f.label })
  }

  if (configuring) {
    return (
      <div onClick={onSelect} className={`rounded-xl border p-4 ${isSelected ? 'border-galli' : 'border-border'} bg-surface`}>
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm font-semibold">Workspace Metric</span>
          <button onClick={onDelete} className="text-xs text-muted-foreground hover:text-red-500">Remove</button>
        </div>

        <label className="mb-1 block text-xs text-muted-foreground">Workspace</label>
        <select value={wsId || ''} onChange={(e) => { const w = workspaces.find((x) => x.id === e.target.value); if (w) pickWorkspace(w) }}
          className="mb-3 w-full rounded-lg border border-border bg-transparent px-2 py-1.5 text-sm">
          <option value="">Select…</option>
          {workspaces.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>

        <label className="mb-1 block text-xs text-muted-foreground">Metric</label>
        <select value={agg} onChange={(e) => onChange({ workspaceKpiAgg: e.target.value as any })}
          className="mb-3 w-full rounded-lg border border-border bg-transparent px-2 py-1.5 text-sm">
          {AGGS.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>

        {agg !== 'count' && (
          <>
            <label className="mb-1 block text-xs text-muted-foreground">Field (number)</label>
            <select value={fieldKey || ''} onChange={(e) => { const f = fields.find((x) => x.key === e.target.value); if (f) pickField(f) }}
              disabled={!wsId}
              className="mb-3 w-full rounded-lg border border-border bg-transparent px-2 py-1.5 text-sm">
              <option value="">Select…</option>
              {fields.filter((f) => f.type === 'number').map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
            </select>
          </>
        )}

        <label className="mb-1 block text-xs text-muted-foreground">Label (optional)</label>
        <input value={element.workspaceKpiLabel || ''} onChange={(e) => onChange({ workspaceKpiLabel: e.target.value })}
          placeholder={kpiDefaultLabel(element)} className="mb-3 w-full rounded-lg border border-border bg-transparent px-2 py-1.5 text-sm" />

        <label className="mb-1 block text-xs text-muted-foreground">Suffix (optional)</label>
        <input value={element.workspaceKpiSuffix || ''} onChange={(e) => onChange({ workspaceKpiSuffix: e.target.value })}
          placeholder="e.g. %, lbs" className="mb-3 w-full rounded-lg border border-border bg-transparent px-2 py-1.5 text-sm" />

        <button onClick={() => setConfiguring(false)} disabled={!wsId || (agg !== 'count' && !fieldKey)}
          className="w-full rounded-lg bg-galli px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50">Done</button>
      </div>
    )
  }

  return (
    <div onClick={onSelect} className={`group relative rounded-xl border ${isSelected ? 'border-galli' : 'border-border'} bg-surface px-6 py-5 text-center`}>
      <div className="text-3xl font-bold text-galli">{formatKpiValue(element.workspaceKpiValue, element.workspaceKpiSuffix)}</div>
      <div className="mt-1 text-sm text-muted-foreground">{kpiDefaultLabel(element)}</div>
      <button onClick={(e) => { e.stopPropagation(); setConfiguring(true) }}
        className="absolute right-2 top-2 text-xs text-muted-foreground opacity-0 transition group-hover:opacity-100 hover:text-galli">Edit</button>
    </div>
  )
}
