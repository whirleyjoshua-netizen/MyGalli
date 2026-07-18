'use client'

import { useState } from 'react'
import type { GridField } from './useWorkspaceGrid'

const VIEW_TYPES = [{ value: 'grid', label: 'Grid' }, { value: 'gallery', label: 'Gallery' }, { value: 'kanban', label: 'Kanban' }]

export function AddViewModal({ fields, workspaceId, onSubmit, onClose }: {
  fields: GridField[]
  workspaceId: string
  onSubmit: (name: string, type: string, config: any) => void
  onClose: () => void
}) {
  const [name, setName] = useState('')
  const [type, setType] = useState('gallery')
  const [titleField, setTitleField] = useState('')
  const [groupByField, setGroupByField] = useState('')
  const choiceFields = fields.filter((f) => f.type === 'choice')

  const [ask, setAsk] = useState('')
  const [filter, setFilter] = useState<any>(null)
  const [summary, setSummary] = useState('')
  const [asking, setAsking] = useState(false)
  const [askError, setAskError] = useState('')

  async function suggest() {
    if (ask.trim().length < 3) return
    setAsking(true)
    setAskError('')
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/filter-suggest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: ask.trim() }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || 'Could not build that filter')
      setFilter(body.filter)
      setSummary(body.summary)
    } catch (e: any) {
      setAskError(e.message)
      setFilter(null)
      setSummary('')
    } finally {
      setAsking(false)
    }
  }

  function submit() {
    if (!name.trim()) return
    if (type === 'kanban' && !groupByField) return
    const base = type === 'kanban' ? { groupByField } : type === 'gallery' ? { titleField: titleField || undefined } : {}
    const config = filter ? { ...base, filter } : base
    onSubmit(name.trim(), type, config)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl bg-surface p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="mb-3 font-semibold">Add view</h3>
        <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="View name"
          className="mb-3 w-full rounded-lg border border-border bg-transparent px-3 py-2" />
        <select value={type} onChange={(e) => setType(e.target.value)} className="mb-3 w-full rounded-lg border border-border bg-transparent px-3 py-2">
          {VIEW_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        {type === 'gallery' && (
          <select value={titleField} onChange={(e) => setTitleField(e.target.value)} className="mb-3 w-full rounded-lg border border-border bg-transparent px-3 py-2">
            <option value="">Title field (auto)</option>
            {fields.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
          </select>
        )}
        {type === 'kanban' && (
          <select value={groupByField} onChange={(e) => setGroupByField(e.target.value)} className="mb-3 w-full rounded-lg border border-border bg-transparent px-3 py-2">
            <option value="">Group by (single-select field)…</option>
            {choiceFields.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
          </select>
        )}
        {type === 'kanban' && choiceFields.length === 0 && (
          <p className="mb-3 text-xs text-muted-foreground">Add a single-select column first to use Kanban.</p>
        )}
        <div className="mb-3 rounded-lg border border-border p-3">
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
            Describe what you want to see (optional)
          </label>
          <div className="flex gap-2">
            <input
              value={ask}
              onChange={(e) => setAsk(e.target.value)}
              placeholder="soccer players with a fee over 1200"
              className="flex-1 rounded-lg border border-border bg-transparent px-3 py-2 text-sm"
            />
            <button
              onClick={suggest}
              disabled={asking || ask.trim().length < 3}
              className="rounded-lg border border-border px-3 py-2 text-sm disabled:opacity-50"
            >
              {asking ? '…' : 'Build'}
            </button>
          </div>
          {summary && (
            <p className="mt-2 text-xs">
              <span className="text-muted-foreground">Filter: </span>
              <span className="font-medium text-galli">{summary}</span>
            </p>
          )}
          {askError && <p className="mt-2 text-xs text-red-500">{askError}</p>}
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-muted-foreground">Cancel</button>
          <button onClick={submit} disabled={!name.trim() || (type === 'kanban' && !groupByField)}
            className="rounded-lg bg-galli px-4 py-2 font-medium text-white disabled:opacity-50">Add</button>
        </div>
      </div>
    </div>
  )
}
