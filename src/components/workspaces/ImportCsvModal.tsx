'use client'

import { useMemo, useState } from 'react'
import Papa from 'papaparse'
import { X } from 'lucide-react'
import { autoMatchColumns } from '@/lib/workspaces/import'
import type { GridField } from './useWorkspaceGrid'

type Parsed = { headers: string[]; rows: Array<Record<string, string>> }
type Report = { validCount: number; skippedCount: number; errors: Array<{ row: number; field: string; message: string }> }

export function ImportCsvModal({
  workspaceId, fields, onClose, onImported,
}: {
  workspaceId: string
  fields: GridField[]
  onClose: () => void
  onImported: () => void
}) {
  const [parsed, setParsed] = useState<Parsed | null>(null)
  const [mapping, setMapping] = useState<Record<string, string | null>>({})
  const [report, setReport] = useState<Report | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  function handleParsed(p: Parsed) {
    setParsed(p)
    setMapping(autoMatchColumns(p.headers, fields as any))
    setReport(null)
  }

  function onFile(file: File) {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => handleParsed({ headers: res.meta.fields ?? [], rows: res.data }),
      error: () => setError('Could not parse that file.'),
    })
  }

  // Build rows mapped header->fieldKey, dropping unmapped columns.
  const mappedRows = useMemo(() => {
    if (!parsed) return []
    return parsed.rows.map((row) => {
      const out: Record<string, unknown> = {}
      for (const [header, key] of Object.entries(mapping)) {
        if (key) out[key] = row[header]
      }
      return out
    })
  }, [parsed, mapping])

  async function post(dryRun: boolean) {
    setBusy(true); setError('')
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/records/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: mappedRows, dryRun }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || 'Import failed')
      return body
    } catch (e: any) { setError(e.message); return null } finally { setBusy(false) }
  }

  async function validate() {
    const body = await post(true)
    if (body) setReport({ validCount: body.validCount, skippedCount: body.skippedCount, errors: body.errors })
  }
  async function confirmImport() {
    const body = await post(false)
    if (body) { onImported(); onClose() }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl bg-surface p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold">Import CSV</h3>
          <button onClick={onClose} title="Close"><X size={18} /></button>
        </div>

        {!parsed && (
          <input type="file" accept=".csv,text/csv" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
            className="w-full rounded-lg border border-dashed border-border p-4 text-sm" />
        )}

        {parsed && (
          <>
            <p className="mb-2 text-sm text-muted-foreground">{parsed.rows.length} rows · map columns:</p>
            <div className="mb-3 max-h-56 space-y-2 overflow-y-auto">
              {parsed.headers.map((h) => (
                <div key={h} className="flex items-center justify-between gap-3 text-sm">
                  <span className="truncate">{h}</span>
                  <select aria-label={`map-${h}`} value={mapping[h] ?? ''}
                    onChange={(e) => setMapping((m) => ({ ...m, [h]: e.target.value || null }))}
                    className="rounded-lg border border-border bg-transparent px-2 py-1">
                    <option value="">Don&apos;t import</option>
                    {fields.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
                  </select>
                </div>
              ))}
            </div>

            {report && (
              <div className="mb-3 rounded-lg border border-border p-3 text-sm">
                <p><span className="font-medium text-galli">{report.validCount} valid</span> · {report.skippedCount} skipped</p>
                {report.errors.length > 0 && (
                  <ul className="mt-2 max-h-32 space-y-0.5 overflow-y-auto text-xs text-muted-foreground">
                    {report.errors.slice(0, 50).map((e, i) => (
                      <li key={i}>row {e.row} · {e.field}: {e.message}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {error && <p className="mb-3 text-sm text-red-500">{error}</p>}

            <div className="flex justify-end gap-2">
              <button onClick={onClose} className="rounded-lg px-4 py-2 text-muted-foreground">Cancel</button>
              {!report
                ? <button onClick={validate} disabled={busy} className="rounded-lg bg-galli px-4 py-2 font-medium text-white disabled:opacity-50">Validate</button>
                : <button onClick={confirmImport} disabled={busy || report.validCount === 0} className="rounded-lg bg-galli px-4 py-2 font-medium text-white disabled:opacity-50">Import {report.validCount}</button>}
            </div>
          </>
        )}

      </div>
    </div>
  )
}
