'use client'

import { useState } from 'react'
import type { GridField } from '../useWorkspaceGrid'

interface Props {
  field: GridField
  value: any
  onCommit: (value: any) => void
}

export function GridCell({ field, value, onCommit }: Props) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<any>(value ?? '')

  // Checkbox: no edit mode, toggle commits immediately.
  if (field.type === 'checkbox') {
    return (
      <input
        type="checkbox"
        checked={!!value}
        onChange={(e) => onCommit(e.target.checked)}
        className="h-4 w-4 accent-galli"
      />
    )
  }

  function commit() {
    setEditing(false)
    if (draft !== (value ?? '')) onCommit(draft === '' ? null : draft)
  }
  function cancel() {
    setEditing(false)
    setDraft(value ?? '')
  }
  function keyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') commit()
    if (e.key === 'Escape') cancel()
  }

  if (!editing) {
    return (
      <div
        data-testid="cell-display"
        onClick={() => { setDraft(value ?? ''); setEditing(true) }}
        className="min-h-[1.5rem] cursor-text"
      >
        {formatDisplay(field, value)}
      </div>
    )
  }

  if (field.type === 'choice') {
    const options: string[] = field.config?.options ?? []
    return (
      <select
        autoFocus
        value={draft ?? ''}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={keyDown}
        className="w-full bg-transparent outline-none"
      >
        <option value="">—</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    )
  }

  const inputType = field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'
  return (
    <input
      autoFocus
      type={inputType}
      value={draft ?? ''}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={keyDown}
      className="w-full bg-transparent outline-none"
    />
  )
}

function formatDisplay(field: GridField, value: any) {
  if (value === null || value === undefined || value === '') return ''
  if (field.type === 'date') return new Date(value).toLocaleDateString()
  return String(value)
}
