'use client'

import { useState } from 'react'
import { X, Plus } from 'lucide-react'
import {
  allowedCmps,
  isValueless,
  validateFilter,
  FilterError,
  type Cmp,
  type FilterSpec,
  type FilterField,
} from '@/lib/workspaces/filter'
import type { GridField } from './useWorkspaceGrid'

const CMP_LABELS: Record<Cmp, string> = {
  eq: 'is',
  neq: 'is not',
  contains: 'contains',
  gt: '>',
  gte: '≥',
  lt: '<',
  lte: '≤',
  is_empty: 'is empty',
  is_not_empty: 'is not empty',
}

const NUMERIC = ['number', 'currency', 'percent', 'rating']

// The draft keeps every value as a string — that is what form controls give us,
// and validateFilter's coerce() is the single place that turns strings into the
// field's real type. Parsing here as well would be a second, divergent coercion.
type Row = { field: string; cmp: Cmp; value: string }

const control = 'rounded-lg border border-border bg-transparent px-2 py-1.5 text-sm'

export function FilterBuilder({
  fields,
  value,
  onApply,
  onClose,
}: {
  fields: GridField[]
  value: FilterSpec | null
  onApply: (next: FilterSpec | null) => void
  onClose: () => void
}) {
  const [rows, setRows] = useState<Row[]>(() =>
    (value?.conditions ?? []).map((c) => ({
      field: c.field,
      cmp: c.cmp,
      value: c.value == null ? '' : String(c.value),
    }))
  )
  const [op, setOp] = useState<'and' | 'or'>(value?.op ?? 'and')
  const [error, setError] = useState('')

  const fieldFor = (key: string) => fields.find((f) => f.key === key)

  function addRow() {
    const first = fields[0]
    if (!first) return
    setRows((rs) => [...rs, { field: first.key, cmp: allowedCmps(first.type)[0], value: '' }])
  }

  function removeRow(i: number) {
    setRows((rs) => rs.filter((_, j) => j !== i))
  }

  function changeField(i: number, key: string) {
    setRows((rs) =>
      rs.map((r, j) => {
        if (j !== i) return r
        const legal = allowedCmps(fieldFor(key)?.type ?? 'text')
        const keep = legal.includes(r.cmp)
        // A comparator legal for the old type may be illegal for the new one
        // (fee > 100 → status > 100). Fall back rather than carry it over.
        return { field: key, cmp: keep ? r.cmp : legal[0], value: keep ? r.value : '' }
      })
    )
  }

  function changeCmp(i: number, cmp: Cmp) {
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, cmp, value: isValueless(cmp) ? '' : r.value } : r)))
  }

  function changeValue(i: number, v: string) {
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, value: v } : r)))
  }

  function apply() {
    if (rows.length === 0) {
      onApply(null)
      onClose()
      return
    }
    const draft = {
      op,
      conditions: rows.map((r) =>
        isValueless(r.cmp) ? { field: r.field, cmp: r.cmp } : { field: r.field, cmp: r.cmp, value: r.value }
      ),
    }
    try {
      // Same validator the server runs. Here it is only for instant feedback —
      // query-view.ts re-validates authoritatively on every read.
      const spec = validateFilter(draft, fields as unknown as FilterField[])
      setError('')
      onApply(spec)
      onClose()
    } catch (e) {
      setError(e instanceof FilterError ? e.message : 'That filter is not valid')
    }
  }

  function renderValue(row: Row, i: number) {
    if (isValueless(row.cmp)) return null
    const field = fieldFor(row.field)
    const label = `Value ${i + 1}`
    const common = { 'aria-label': label, className: `${control} min-w-0 flex-1`, value: row.value }

    if (field?.type === 'choice') {
      const options: string[] = field.config?.options ?? []
      return (
        <select {...common} onChange={(e) => changeValue(i, e.target.value)}>
          <option value="">Choose…</option>
          {options.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      )
    }
    if (field?.type === 'checkbox') {
      return (
        <select {...common} onChange={(e) => changeValue(i, e.target.value)}>
          <option value="">Choose…</option>
          <option value="true">checked</option>
          <option value="false">unchecked</option>
        </select>
      )
    }
    // type=date yields the YYYY-MM-DD form coerce() demands, so an ambiguous
    // format can never be typed in the first place.
    const inputType = field?.type === 'date' ? 'date' : NUMERIC.includes(field?.type ?? '') ? 'number' : 'text'
    return <input {...common} type={inputType} onChange={(e) => changeValue(i, e.target.value)} />
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-24" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl bg-surface p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold">Filter</h3>
          <button onClick={onClose} aria-label="Close" className="text-muted-foreground hover:text-foreground">
            <X size={16} />
          </button>
        </div>

        <div className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
          <span>Show records where</span>
          {rows.length > 1 && (
            <select aria-label="Match" value={op} onChange={(e) => setOp(e.target.value as 'and' | 'or')} className={control}>
              <option value="and">all match</option>
              <option value="or">any match</option>
            </select>
          )}
        </div>

        {rows.length === 0 && (
          <p className="mb-3 text-sm text-muted-foreground">No conditions — this view shows every record.</p>
        )}

        <div className="mb-3 space-y-2">
          {rows.map((row, i) => {
            const legal = allowedCmps(fieldFor(row.field)?.type ?? 'text')
            return (
              <div key={i} className="flex items-center gap-2">
                <select aria-label={`Field ${i + 1}`} value={row.field} onChange={(e) => changeField(i, e.target.value)} className={`${control} min-w-0 flex-1`}>
                  {fields.map((f) => (
                    <option key={f.key} value={f.key}>{f.label}</option>
                  ))}
                </select>
                <select aria-label={`Comparator ${i + 1}`} value={row.cmp} onChange={(e) => changeCmp(i, e.target.value as Cmp)} className={control}>
                  {legal.map((c) => (
                    <option key={c} value={c}>{CMP_LABELS[c]}</option>
                  ))}
                </select>
                {renderValue(row, i)}
                <button onClick={() => removeRow(i)} aria-label={`Remove condition ${i + 1}`} className="text-muted-foreground hover:text-red-500">
                  <X size={14} />
                </button>
              </div>
            )
          })}
        </div>

        <button onClick={addRow} className="mb-3 flex items-center gap-1 text-sm text-muted-foreground hover:text-galli">
          <Plus size={14} /> Add condition
        </button>

        {error && <p className="mb-3 text-sm text-amber-600">{error}</p>}

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg px-3 py-2 text-sm text-muted-foreground hover:text-foreground">
            Cancel
          </button>
          <button onClick={apply} className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:brightness-105">
            Apply
          </button>
        </div>
      </div>
    </div>
  )
}
