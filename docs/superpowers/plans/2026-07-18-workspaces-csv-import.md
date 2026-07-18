# Workspaces F2 — CSV Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Let a user drop a CSV, map its columns to workspace fields, and bulk-create records — with the same typed validation the single-record path already runs.

**Architecture:** Two pure helpers (`autoMatchColumns`, `validateImportRows`) reuse the existing `validateWorkspaceRecord` per row; one endpoint validates a batch (dry-run report or real `createMany`); a client modal parses the CSV with papaparse, maps columns, previews the validity report, and confirms. Partial import: valid rows land, skipped rows are reported.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Tailwind, Prisma/PostgreSQL, Vitest, papaparse (new, client-only).

**Design ref:** `docs/superpowers/specs/2026-07-18-workspaces-csv-import-design.md`

## Global Constraints
- **Working directory is the WORKTREE:** `C:/Users/whirl/pages-mvp/.claude/worktrees/e-ai-filter`. `cd` there first. The main checkout `C:/Users/whirl/pages-mvp` is on `main` and belongs to other agents — never edit it.
- Branch MUST be `workspaces-e-ai-filter`. Run `git branch --show-current` before every commit; wrong branch → STOP, report BLOCKED.
- Running the suite in this worktree needs `JWT_SECRET` exported first: `export JWT_SECRET="$(sed -n 's/^JWT_SECRET=//p' .env | tr -d '\r' | tr -d '"')"`.
- Reuse, don't reinvent, validation: every row is validated+coerced by the existing `validateWorkspaceRecord(fields, input)` from `@/lib/workspace-validator` (returns `{ success: boolean; data?: Record<string,any>; errors?: Record<string,string> }`). Do NOT write a second validator.
- Rows arriving at the endpoint are ALREADY mapped header→fieldKey by the client (only real field keys as keys). Row cap: **5000** (400 over).
- Partial import: insert valid rows via `createMany`; report skipped rows with `{ row (1-based), field, message }`. Never all-or-nothing, never silent drops.
- Map to EXISTING fields only; unmatched CSV columns are dropped client-side (not sent).
- Never commit: `Documents/`, `Images/`, `g1t.json`, `nul`, `.env`. tsc + lint + tests must pass.
- DB for live checks: `DATABASE_URL="postgresql://pages:pages@127.0.0.1:5434/pages"` (127.0.0.1, not localhost), set inline.

---

### Task 1: `import.ts` — `autoMatchColumns` + `validateImportRows` (TDD, pure)

**Files:**
- Create: `src/lib/workspaces/import.ts`
- Test: `src/lib/workspaces/import.test.ts`

**Interfaces:**
- Consumes: `validateWorkspaceRecord` from `@/lib/workspace-validator` (`(fields, input, opts?) => { success, data?, errors? }`).
- Produces:
```ts
export type ImportField = { key: string; label: string; type: string; config?: any; required?: boolean }
export type ImportRowError = { row: number; field: string; message: string }
export type ImportValidation = { valid: Array<Record<string, any>>; errors: ImportRowError[]; validCount: number; skippedCount: number }
export function autoMatchColumns(headers: string[], fields: ImportField[]): Record<string, string | null>
export function validateImportRows(fields: ImportField[], rows: Array<Record<string, unknown>>): ImportValidation
```

- [ ] **Step 1: Write the failing test** — create `src/lib/workspaces/import.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { autoMatchColumns, validateImportRows, type ImportField } from './import'

const fields: ImportField[] = [
  { key: 'name', label: 'Name', type: 'text' },
  { key: 'gpa', label: 'GPA', type: 'number' },
  { key: 'grade', label: 'Grade', type: 'choice', config: { options: ['9', '10', '11', '12'] } },
]

describe('autoMatchColumns', () => {
  it('matches on label case-insensitively, then on key', () => {
    expect(autoMatchColumns(['Name', 'gpa', 'GRADE'], fields)).toEqual({ Name: 'name', gpa: 'gpa', GRADE: 'grade' })
  })
  it('returns null for an unmatched header', () => {
    expect(autoMatchColumns(['Nickname'], fields)).toEqual({ Nickname: null })
  })
  it('gives a field to the first header only when two headers match the same field', () => {
    const m = autoMatchColumns(['Name', 'name'], fields)
    expect(m.Name).toBe('name')
    expect(m.name).toBeNull()
  })
})

describe('validateImportRows', () => {
  it('coerces valid rows and returns them ready to insert', () => {
    const r = validateImportRows(fields, [{ name: 'Ava', gpa: '3.8', grade: '11' }])
    expect(r.valid).toEqual([{ name: 'Ava', gpa: 3.8, grade: '11' }]) // gpa coerced to number
    expect(r.validCount).toBe(1)
    expect(r.skippedCount).toBe(0)
    expect(r.errors).toEqual([])
  })
  it('skips a row with a bad cell and reports it with a 1-based row number', () => {
    const r = validateImportRows(fields, [
      { name: 'Ava', gpa: '3.8', grade: '11' },
      { name: 'Bad', gpa: 'N/A', grade: '11' },
    ])
    expect(r.validCount).toBe(1)
    expect(r.skippedCount).toBe(1)
    expect(r.errors).toHaveLength(1)
    expect(r.errors[0]).toMatchObject({ row: 2, field: 'gpa' })
    expect(r.errors[0].message).toBeTruthy()
  })
  it('reports a value not in a choice field options', () => {
    const r = validateImportRows(fields, [{ name: 'X', gpa: '3', grade: '13' }])
    expect(r.skippedCount).toBe(1)
    expect(r.errors[0]).toMatchObject({ row: 1, field: 'grade' })
  })
  it('handles an empty rows list', () => {
    expect(validateImportRows(fields, [])).toEqual({ valid: [], errors: [], validCount: 0, skippedCount: 0 })
  })
})
```

- [ ] **Step 2: Run → fail**

Run: `export JWT_SECRET="$(sed -n 's/^JWT_SECRET=//p' .env | tr -d '\r' | tr -d '"')"; npx vitest run src/lib/workspaces/import.test.ts`
Expected: FAIL — cannot find module `./import`.

- [ ] **Step 3: Implement** — create `src/lib/workspaces/import.ts`:

```ts
import { validateWorkspaceRecord } from '@/lib/workspace-validator'
import type { WorkspaceField } from '@prisma/client'

export type ImportField = { key: string; label: string; type: string; config?: any; required?: boolean }
export type ImportRowError = { row: number; field: string; message: string }
export type ImportValidation = {
  valid: Array<Record<string, any>>
  errors: ImportRowError[]
  validCount: number
  skippedCount: number
}

/** CSV header -> field key (or null = won't import). Case-insensitive: label first, then key.
 *  Deterministic: a field is claimed by the first header that matches it. */
export function autoMatchColumns(headers: string[], fields: ImportField[]): Record<string, string | null> {
  const byLabel = new Map(fields.map((f) => [f.label.toLowerCase().trim(), f.key]))
  const byKey = new Map(fields.map((f) => [f.key.toLowerCase().trim(), f.key]))
  const claimed = new Set<string>()
  const out: Record<string, string | null> = {}
  for (const h of headers) {
    const norm = h.toLowerCase().trim()
    const match = byLabel.get(norm) ?? byKey.get(norm) ?? null
    if (match && !claimed.has(match)) {
      out[h] = match
      claimed.add(match)
    } else {
      out[h] = null
    }
  }
  return out
}

/** Validate+coerce N rows (already mapped header->fieldKey) against the schema.
 *  Reuses the single-record validator. A row with any error is skipped whole. */
export function validateImportRows(fields: ImportField[], rows: Array<Record<string, unknown>>): ImportValidation {
  const valid: Array<Record<string, any>> = []
  const errors: ImportRowError[] = []
  rows.forEach((row, i) => {
    // validateWorkspaceRecord's param is the full Prisma WorkspaceField, but it only reads
    // key/label/type/config/required — all present on ImportField. Narrow cast at the boundary.
    const res = validateWorkspaceRecord(fields as unknown as WorkspaceField[], row as Record<string, any>)
    if (res.success && res.data) {
      valid.push(res.data)
    } else {
      for (const [field, message] of Object.entries(res.errors ?? {})) {
        errors.push({ row: i + 1, field, message })
      }
    }
  })
  return { valid, errors, validCount: valid.length, skippedCount: rows.length - valid.length }
}
```

- [ ] **Step 4: Run → pass**

Run: `npx vitest run src/lib/workspaces/import.test.ts`
Expected: PASS. If the coercion test's expected number/date form differs from what `validateWorkspaceRecord` actually returns, adjust the **test expectation** to match the real validator output (read `src/lib/workspace-validator.ts`) — do not change the validator.

- [ ] **Step 5: Commit**

```bash
git branch --show-current   # must be workspaces-e-ai-filter
git add src/lib/workspaces/import.ts src/lib/workspaces/import.test.ts
git commit -m "feat(workspaces): CSV import helpers — autoMatchColumns + validateImportRows"
```

---

### Task 2: `POST /api/workspaces/[id]/records/import` (TDD)

**Files:**
- Create: `src/app/api/workspaces/[id]/records/import/route.ts`
- Test: `src/app/api/workspaces/[id]/records/import/route.test.ts`

**Interfaces:**
- Consumes: `getUser`, `authorizeWorkspace` (`@/lib/workspaces/authorize`, returns the workspace incl. `schemaVersion`), `validateImportRows` (Task 1), `db`.
- Produces: `POST` → dry-run `{ validCount, skippedCount, errors }` or real `{ inserted, skipped, errors }`.

- [ ] **Step 1: Write the failing test** — create `src/app/api/workspaces/[id]/records/import/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from './route'
import { getUser } from '@/lib/auth'
import { authorizeWorkspace } from '@/lib/workspaces/authorize'
import { db } from '@/lib/db'

vi.mock('@/lib/auth', () => ({ getUser: vi.fn() }))
vi.mock('@/lib/workspaces/authorize', () => ({ authorizeWorkspace: vi.fn() }))
vi.mock('@/lib/db', () => ({ db: { workspaceField: { findMany: vi.fn() }, workspaceRecord: { createMany: vi.fn() } } }))

const ctx = { params: Promise.resolve({ id: 'w1' }) }
const req = (body: any) => ({ json: async () => body }) as any
const FIELDS = [
  { id: 'f1', key: 'name', label: 'Name', type: 'text' },
  { id: 'f2', key: 'gpa', label: 'GPA', type: 'number' },
]

describe('POST records/import', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(authorizeWorkspace as any).mockResolvedValue({ id: 'w1', schemaVersion: 1 })
    ;(db.workspaceField.findMany as any).mockResolvedValue(FIELDS)
    ;(db.workspaceRecord.createMany as any).mockResolvedValue({ count: 0 })
  })

  it('401 unauth', async () => {
    ;(getUser as any).mockResolvedValue(null)
    expect((await POST(req({ rows: [] }), ctx)).status).toBe(401)
  })

  it('404 foreign workspace', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'u1' })
    ;(authorizeWorkspace as any).mockRejectedValue(new Error('Unauthorized or Workspace not found'))
    expect((await POST(req({ rows: [{ name: 'A' }] }), ctx)).status).toBe(404)
  })

  it('400 over the 5000-row cap', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'u1' })
    const rows = Array.from({ length: 5001 }, () => ({ name: 'A' }))
    expect((await POST(req({ rows }), ctx)).status).toBe(400)
  })

  it('dryRun returns the report and does NOT insert', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'u1' })
    const res = await POST(req({ dryRun: true, rows: [{ name: 'A', gpa: '3.5' }, { name: 'B', gpa: 'nope' }] }), ctx)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.validCount).toBe(1)
    expect(body.skippedCount).toBe(1)
    expect(body.errors[0]).toMatchObject({ row: 2, field: 'gpa' })
    expect(db.workspaceRecord.createMany).not.toHaveBeenCalled()
  })

  it('real import inserts only valid coerced rows via createMany', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'u1' })
    ;(db.workspaceRecord.createMany as any).mockResolvedValue({ count: 1 })
    const res = await POST(req({ rows: [{ name: 'A', gpa: '3.5' }, { name: 'B', gpa: 'nope' }] }), ctx)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.inserted).toBe(1)
    expect(body.skipped).toBe(1)
    const arg = (db.workspaceRecord.createMany as any).mock.calls[0][0].data
    expect(arg).toHaveLength(1)
    expect(arg[0]).toMatchObject({ workspaceId: 'w1', schemaVersion: 1, createdById: 'u1', status: 'active' })
    expect(arg[0].data).toEqual({ name: 'A', gpa: 3.5 }) // coerced
  })
})
```

- [ ] **Step 2: Run → fail**

Run: `npx vitest run "src/app/api/workspaces/[id]/records/import"`
Expected: FAIL — cannot find module `./route`.

- [ ] **Step 3: Implement** — create `src/app/api/workspaces/[id]/records/import/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { authorizeWorkspace } from '@/lib/workspaces/authorize'
import { validateImportRows, type ImportField } from '@/lib/workspaces/import'

const MAX_ROWS = 5000

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: workspaceId } = await params

  let body: { rows?: unknown; dryRun?: boolean }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
  const rows = body.rows
  if (!Array.isArray(rows)) return NextResponse.json({ error: 'rows must be an array' }, { status: 400 })
  if (rows.length > MAX_ROWS) {
    return NextResponse.json({ error: `Too many rows (max ${MAX_ROWS})` }, { status: 400 })
  }

  try {
    const workspace = await authorizeWorkspace(user.id, workspaceId)
    const fields = (await db.workspaceField.findMany({ where: { workspaceId } })) as unknown as ImportField[]

    const { valid, errors, validCount, skippedCount } = validateImportRows(fields, rows as Array<Record<string, unknown>>)

    if (body.dryRun) {
      return NextResponse.json({ validCount, skippedCount, errors })
    }

    if (valid.length > 0) {
      await db.workspaceRecord.createMany({
        data: valid.map((d) => ({
          workspaceId,
          data: d,
          schemaVersion: workspace.schemaVersion,
          createdById: user.id,
          status: 'active',
        })),
      })
    }

    return NextResponse.json({ inserted: valid.length, skipped: skippedCount, errors })
  } catch (error: any) {
    if (error.message === 'Unauthorized or Workspace not found') {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
    }
    console.error('CSV import error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

- [ ] **Step 4: Run → pass**

Run: `npx vitest run "src/app/api/workspaces/[id]/records/import"`
Expected: PASS — 5 tests.

- [ ] **Step 5: Commit**

```bash
git branch --show-current
git add "src/app/api/workspaces/[id]/records/import"
git commit -m "feat(workspaces): POST records/import — dry-run report + createMany the valid rows"
```

---

### Task 3: `ImportCsvModal` + papaparse + wire into the workspace

**Files:**
- Modify: `package.json` (add `papaparse` + `@types/papaparse`)
- Create: `src/components/workspaces/ImportCsvModal.tsx`
- Modify: `src/components/workspaces/WorkspaceViews.tsx` (Import button + modal)
- Test: `src/components/workspaces/ImportCsvModal.test.tsx`

**Interfaces:**
- Consumes: Task-1 `autoMatchColumns`; the Task-2 endpoint; `useWorkspaceGrid`'s `fields`, `reload`.
- Produces: `ImportCsvModal({ workspaceId, fields, onClose, onImported })`.

- [ ] **Step 1: Add papaparse**

```bash
cd C:/Users/whirl/pages-mvp/.claude/worktrees/e-ai-filter
pnpm add papaparse && pnpm add -D @types/papaparse
```
Confirm `papaparse` appears in `package.json` dependencies.

- [ ] **Step 2: Write a failing component test** — create `src/components/workspaces/ImportCsvModal.test.tsx`. Mock papaparse so a file change drives the REAL parse→map path synchronously (no production test-hook, no real file I/O):

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

// Mock papaparse: parse() immediately calls opts.complete with our sample.
vi.mock('papaparse', () => ({
  default: {
    parse: (_file: any, opts: any) =>
      opts.complete({ meta: { fields: ['Name', 'GPA'] }, data: [{ Name: 'Ava', GPA: '3.8' }, { Name: 'B', GPA: 'x' }] }),
  },
}))

import { ImportCsvModal } from './ImportCsvModal'

const fields = [
  { id: 'f1', key: 'name', label: 'Name', type: 'text', position: 0 },
  { id: 'f2', key: 'gpa', label: 'GPA', type: 'number', position: 1 },
] as any

function pickFile() {
  const input = document.querySelector('input[type=file]') as HTMLInputElement
  const file = new File(['Name,GPA\nAva,3.8\nB,x'], 'students.csv', { type: 'text/csv' })
  fireEvent.change(input, { target: { files: [file] } })
}

beforeEach(() => { vi.restoreAllMocks() })

describe('ImportCsvModal', () => {
  it('after parsing, auto-maps headers to fields', async () => {
    render(<ImportCsvModal workspaceId="w1" fields={fields} onClose={() => {}} onImported={() => {}} />)
    pickFile()
    await waitFor(() => expect(screen.getByLabelText('map-Name')).toHaveValue('name'))
    expect(screen.getByLabelText('map-GPA')).toHaveValue('gpa')
  })

  it('dry-run report renders valid/skipped counts from the endpoint', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true, json: async () => ({ validCount: 1, skippedCount: 1, errors: [{ row: 2, field: 'gpa', message: 'not a number' }] }),
    } as any)
    render(<ImportCsvModal workspaceId="w1" fields={fields} onClose={() => {}} onImported={() => {}} />)
    pickFile()
    await waitFor(() => screen.getByLabelText('map-Name'))
    fireEvent.click(screen.getByRole('button', { name: /validate/i }))
    await waitFor(() => expect(screen.getByText(/1 valid/i)).toBeInTheDocument())
    expect(screen.getByText(/1 skipped/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 3: Run → fail**

Run: `npx vitest run src/components/workspaces/ImportCsvModal.test.tsx`
Expected: FAIL — cannot find module `./ImportCsvModal`.

- [ ] **Step 4: Implement** — create `src/components/workspaces/ImportCsvModal.tsx`:

```tsx
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
```

- [ ] **Step 5: Run → pass**

Run: `npx vitest run src/components/workspaces/ImportCsvModal.test.tsx`
Expected: PASS.

- [ ] **Step 6: Wire into `WorkspaceViews.tsx`.** Add the import + state and an "Import CSV" button in the header near the view switcher, plus the modal:

Add imports:
```ts
import { Upload } from 'lucide-react'
import { ImportCsvModal } from './ImportCsvModal'
```
Add state (next to `addingView`):
```ts
  const [importing, setImporting] = useState(false)
```
Add a button beside the "+ View" button (in the switcher row):
```tsx
<button onClick={() => setImporting(true)} className="ml-1 flex items-center gap-1 px-2 py-2 text-sm text-muted-foreground hover:text-galli" title="Import CSV">
  <Upload size={14} /> Import CSV
</button>
```
Render the modal (near the AddViewModal render):
```tsx
{importing && (
  <ImportCsvModal
    workspaceId={workspaceId}
    fields={grid.fields}
    onClose={() => setImporting(false)}
    onImported={() => grid.reload()}
  />
)}
```

- [ ] **Step 7: Verify + commit**

```bash
export JWT_SECRET="$(sed -n 's/^JWT_SECRET=//p' .env | tr -d '\r' | tr -d '"')"
npx tsc --noEmit 2>&1 | grep -iE 'import|workspace|papaparse' || echo clean
npx vitest run src/components/workspaces
```
Expected: tsc clean; component tests green.
```bash
git branch --show-current
git add package.json pnpm-lock.yaml src/components/workspaces/ImportCsvModal.tsx src/components/workspaces/ImportCsvModal.test.tsx src/components/workspaces/WorkspaceViews.tsx
git commit -m "feat(workspaces): CSV import modal (papaparse parse -> map -> validate -> import)"
```

---

### Task 4: Full gate + live-DB smoke

- [ ] **Step 1: Full gate**
```bash
export JWT_SECRET="$(sed -n 's/^JWT_SECRET=//p' .env | tr -d '\r' | tr -d '"')"
npx tsc --noEmit
npx next lint 2>&1 | grep -iE "Error:" || echo "no lint errors"
npx vitest run
```
Expected: tsc 0; no lint errors (pre-existing `<img>`/exhaustive-deps warnings OK); tests green (a couple of known load-flaky files may need an isolation re-run — `GridCell`, `PageEditor.integration` — confirm they pass alone if the full run flags them).

- [ ] **Step 2: Live-DB smoke — `createMany` + coercion have never met Postgres (Prisma mocked in tests).**

Confirm which checkout owns the dev port (`Get-NetTCPConnection -LocalPort 3200`); start your own if needed:
```bash
DATABASE_URL="postgresql://pages:pages@127.0.0.1:5434/pages" npx next dev -p 3200
```
Reseed a Students workspace (owner `hubowner@test.local`; fields incl. a `number` and a `choice`). Mint a `galli-auth` cookie. Prepare a CSV (or a JSON rows array) with ~10 rows including 2 deliberately bad (non-numeric in the number field, a value not in the choice options). Then, against `POST /api/workspaces/[id]/records/import`:
1. **dryRun** → returns `validCount: 8, skippedCount: 2` with the 2 errors naming the right rows/fields; the record count in the DB is unchanged.
2. **Real import** → `inserted: 8`; the DB count rises by exactly 8; the number field is stored as a JSON **number** and the choice value is one of the options; the 2 bad rows are absent.
3. Load the workspace grid and confirm the imported rows render and are **sortable/searchable** via F1 (e.g. sort by the number field returns numeric order including the imported rows).
Log each result.

- [ ] **Step 3: Record results** in `.superpowers/sdd/progress.md`, remove any temp seed/CSV scripts, then STOP — F2 rides the C+E+F stack (no separate PR). Report completion.

## Out of scope
Creating fields from unmatched columns (F2.1), de-dupe/upsert, `.xlsx`, updating existing records, per-cell fix-in-place, chunked import of >5000 rows.

## Success criteria
Dropping a CSV of students maps columns to existing fields, shows a valid/skipped report, and imports the valid rows in one action — number fields stored as numbers, choice validated, bad rows reported not dropped, imported records immediately sortable/searchable. tsc/lint/tests green; the live smoke confirms `createMany` + coercion against real Postgres.
