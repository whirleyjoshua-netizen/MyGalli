'use client'

import { useState } from 'react'
import type { GridField } from '../useWorkspaceGrid'
import { formatFieldValue } from '@/lib/workspaces/format-value'
import { safeHref } from '@/lib/editor/safe-href'

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

  if (field.type === 'rating') {
    const max = field.config?.max ?? 5
    const cur = Number(value) || 0
    return (
      <div className="flex gap-0.5">
        {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
          <button key={n} type="button" aria-label={`${n} star${n > 1 ? 's' : ''}`}
            onClick={() => onCommit(n === cur ? null : n)}
            className={n <= cur ? 'text-galli' : 'text-muted-foreground/40'}>★</button>
        ))}
      </div>
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
    const display = (() => {
      if (value === null || value === undefined || value === '') return ''
      if (field.type === 'url') return <a href={safeHref(String(value))} target="_blank" rel="noopener noreferrer" className="text-galli underline" onClick={(e) => e.stopPropagation()}>{String(value)}</a>
      if (field.type === 'email') return <a href={`mailto:${String(value)}`} className="text-galli underline" onClick={(e) => e.stopPropagation()}>{String(value)}</a>
      return formatFieldValue(field.type, value, field.config)
    })()
    return (
      <div
        data-testid="cell-display"
        onClick={() => { setDraft(field.type === 'date' ? toInputDate(value) : (value ?? '')); setEditing(true) }}
        className="min-h-[1.5rem] cursor-text"
      >
        {display}
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

  const inputType = (field.type === 'number' || field.type === 'currency' || field.type === 'percent') ? 'number'
    : field.type === 'date' ? 'date' : field.type === 'url' ? 'url' : field.type === 'email' ? 'email' : 'text'
  return (
    <input
      autoFocus
      type={inputType}
      value={field.type === 'date' ? toInputDate(draft) : (draft ?? '')}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={keyDown}
      className="w-full bg-transparent outline-none"
    />
  )
}

function toInputDate(value: any): string {
  if (value === null || value === undefined || value === '') return ''
  const s = String(value)
  // ISO datetime strings (e.g. 2026-07-14T00:00:00.000Z) -> yyyy-MM-dd
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  return s
}
