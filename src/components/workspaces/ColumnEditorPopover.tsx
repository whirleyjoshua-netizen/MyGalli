'use client'

import { useState } from 'react'

const TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'choice', label: 'Single-select' },
  { value: 'checkbox', label: 'Checkbox' },
]

export function ColumnEditorPopover({ onSubmit, onClose }: {
  onSubmit: (label: string, type: string, config?: any) => void
  onClose: () => void
}) {
  const [label, setLabel] = useState('')
  const [type, setType] = useState('text')
  const [optionsText, setOptionsText] = useState('')

  function submit() {
    if (!label.trim()) return
    const config = type === 'choice'
      ? { options: optionsText.split('\n').map((s) => s.trim()).filter(Boolean) }
      : undefined
    onSubmit(label.trim(), type, config)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl bg-surface p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="mb-3 font-semibold">Add column</h3>
        <input autoFocus value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Column name"
          className="mb-3 w-full rounded-lg border border-border bg-transparent px-3 py-2" />
        <select value={type} onChange={(e) => setType(e.target.value)}
          className="mb-3 w-full rounded-lg border border-border bg-transparent px-3 py-2">
          {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        {type === 'choice' && (
          <textarea value={optionsText} onChange={(e) => setOptionsText(e.target.value)}
            placeholder="One option per line" rows={4}
            className="mb-3 w-full rounded-lg border border-border bg-transparent px-3 py-2" />
        )}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-muted-foreground">Cancel</button>
          <button onClick={submit} disabled={!label.trim()} className="rounded-lg bg-galli px-4 py-2 font-medium text-white disabled:opacity-50">Add</button>
        </div>
      </div>
    </div>
  )
}
