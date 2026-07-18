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
