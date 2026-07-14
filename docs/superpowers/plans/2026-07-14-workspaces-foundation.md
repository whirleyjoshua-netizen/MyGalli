# Workspaces Foundation (Sub-project A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the existing Workspaces POC into a usable foundation: create a workspace, define Core-5 typed columns, and add/edit/delete records in an inline spreadsheet grid that persists.

**Architecture:** Reuse the existing `Workspace/WorkspaceField/WorkspaceRecord` Prisma models (JSONB `data`, app-layer validation). The grid reads the workspace **directly** via a new `GET /api/workspaces/[id]` (the `WorkspaceView` models stay dormant until Sub-project C). Records are pure data (no page link in A). Cell edits save per-cell via optimistic `PATCH` with rollback.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Prisma/PostgreSQL, Zustand-free local component state, Tailwind (semantic tokens), Vitest.

## Global Constraints

- **Field type strings (verbatim):** `text` | `number` | `date` | `choice` | `checkbox`. (`choice` = single-select dropdown; the UI labels it "Single-select".)
- **Field `key` is server-generated and immutable** after creation; only `label` changes on rename. Keys are the JSON keys in `record.data`.
- **`required` is a soft hint in A** — never blocks a save; renders a visual asterisk only.
- **Owner-only:** every workspace API route authorizes `getUser(request)` + ownership before acting.
- **DB commands** need both `DATABASE_URL` (pooled) and `DATABASE_URL_UNPOOLED` set. Use `127.0.0.1:5434`, not `localhost`. Never run `prisma migrate dev` or trust `prisma migrate diff` on the shared dev DB — hand-author migrations.
- **Windows:** stop `next dev` before `pnpm build`; `prisma generate` may EPERM while dev holds the engine — retry when quiet.
- **CI must stay green:** `tsc --noEmit` + `next lint` + `pnpm test` + `next build`.
- **Never commit:** `Documents/`, `Images/`, `g1t.json`, `nul`, `.claude/settings.local.json`.

**Design reference:** `docs/superpowers/specs/2026-07-14-workspaces-foundation-design.md`

---

### Task 1: Migration + bug fixes (setup, get the tree green)

**Files:**
- Create: `prisma/migrations/20260714000000_add_workspaces/migration.sql`
- Modify: `src/lib/workspaces/service.ts:8-18` (authorize call site reads `schemaVersion`)
- Modify: `src/lib/workspaces/authorize.ts:8-11` (select `schemaVersion`)
- Modify: `src/app/api/workspaces/[id]/views/[viewId]/records/route.test.ts:1` (add `NextRequest` import)

**Interfaces:**
- Produces: `authorizeWorkspace(userId, workspaceId)` now returns `{ id, ownerId, schemaVersion }`.

- [ ] **Step 1: Hand-author the migration SQL**

Create `prisma/migrations/20260714000000_add_workspaces/migration.sql` with ONLY the Workspace tables (do not include other models — the shared dev DB would otherwise get spurious drops):

```sql
-- CreateTable
CREATE TABLE "Workspace" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkspaceField" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,
    "config" JSONB,
    "validation" JSONB,
    "defaultValue" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WorkspaceField_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkspaceRecord" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "displayId" TEXT,
    "data" JSONB NOT NULL,
    "schemaVersion" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WorkspaceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkspaceView" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'table',
    "config" JSONB NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WorkspaceView_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Workspace_ownerId_idx" ON "Workspace"("ownerId");
CREATE UNIQUE INDEX "Workspace_ownerId_name_key" ON "Workspace"("ownerId", "name");
CREATE INDEX "WorkspaceField_workspaceId_position_idx" ON "WorkspaceField"("workspaceId", "position");
CREATE UNIQUE INDEX "WorkspaceField_workspaceId_key_key" ON "WorkspaceField"("workspaceId", "key");
CREATE UNIQUE INDEX "WorkspaceRecord_displayId_key" ON "WorkspaceRecord"("displayId");
CREATE INDEX "WorkspaceRecord_workspaceId_idx" ON "WorkspaceRecord"("workspaceId");
CREATE INDEX "WorkspaceRecord_workspaceId_status_idx" ON "WorkspaceRecord"("workspaceId", "status");
CREATE INDEX "WorkspaceRecord_createdById_idx" ON "WorkspaceRecord"("createdById");
CREATE UNIQUE INDEX "WorkspaceView_workspaceId_name_key" ON "WorkspaceView"("workspaceId", "name");
CREATE INDEX "WorkspaceView_workspaceId_position_idx" ON "WorkspaceView"("workspaceId", "position");

-- AddForeignKey
ALTER TABLE "Workspace" ADD CONSTRAINT "Workspace_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkspaceField" ADD CONSTRAINT "WorkspaceField_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkspaceRecord" ADD CONSTRAINT "WorkspaceRecord_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkspaceRecord" ADD CONSTRAINT "WorkspaceRecord_displayId_fkey" FOREIGN KEY ("displayId") REFERENCES "Display"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WorkspaceRecord" ADD CONSTRAINT "WorkspaceRecord_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WorkspaceRecord" ADD CONSTRAINT "WorkspaceRecord_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WorkspaceView" ADD CONSTRAINT "WorkspaceView_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

- [ ] **Step 2: Apply the migration + regenerate client**

Run (bash, with env inline):
```bash
export DATABASE_URL="postgresql://pages:pages@127.0.0.1:5434/pages"
export DATABASE_URL_UNPOOLED="postgresql://pages:pages@127.0.0.1:5434/pages"
npx prisma migrate deploy && npx prisma generate
```
Expected: "1 migration found ... applied" (or "No pending migrations" if already applied) and "Generated Prisma Client". If `prisma generate` EPERMs on Windows, stop `next dev` and retry.

- [ ] **Step 3: Fix the `authorizeWorkspace` select to include `schemaVersion`**

In `src/lib/workspaces/authorize.ts`, change the `select`:
```ts
  const workspace = await db.workspace.findUnique({
    where: { id: workspaceId },
    select: { id: true, ownerId: true, schemaVersion: true },
  })
```

- [ ] **Step 4: Fix the missing `NextRequest` import in the existing view-records test**

In `src/app/api/workspaces/[id]/views/[viewId]/records/route.test.ts`, change line 1:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
```

- [ ] **Step 5: Verify tsc is clean for workspaces + existing tests pass**

Run:
```bash
npx tsc --noEmit 2>&1 | grep -i workspace
npx vitest run src/lib/workspace-validator.test.ts src/app/api/workspaces
```
Expected: no workspace lines from tsc; all existing workspace tests pass.

- [ ] **Step 6: Commit**

```bash
git add prisma/migrations src/lib/workspaces/authorize.ts "src/app/api/workspaces/[id]/views/[viewId]/records/route.test.ts"
git commit -m "fix(workspaces): add migration, fix schemaVersion select + test import"
```

---

### Task 2: `deriveFieldKey` helper (TDD)

**Files:**
- Create: `src/lib/workspaces/field-key.ts`
- Test: `src/lib/workspaces/field-key.test.ts`

**Interfaces:**
- Produces: `deriveFieldKey(label: string, existingKeys: string[]): string` — a stable, unique, slugified key.

- [ ] **Step 1: Write the failing test**

`src/lib/workspaces/field-key.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { deriveFieldKey } from './field-key'

describe('deriveFieldKey', () => {
  it('slugifies a label', () => {
    expect(deriveFieldKey('Final Grade', [])).toBe('final_grade')
  })
  it('lowercases and strips punctuation', () => {
    expect(deriveFieldKey('GPA (2026)!', [])).toBe('gpa_2026')
  })
  it('de-dupes against existing keys', () => {
    expect(deriveFieldKey('Grade', ['grade'])).toBe('grade_2')
    expect(deriveFieldKey('Grade', ['grade', 'grade_2'])).toBe('grade_3')
  })
  it('falls back to "field" for empty/symbol-only labels', () => {
    expect(deriveFieldKey('!!!', [])).toBe('field')
    expect(deriveFieldKey('!!!', ['field'])).toBe('field_2')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/workspaces/field-key.test.ts`
Expected: FAIL — cannot find module `./field-key`.

- [ ] **Step 3: Write minimal implementation**

`src/lib/workspaces/field-key.ts`:
```ts
/**
 * Derive a stable, unique JSON key for a workspace field from its label.
 * Called ONCE at field creation; the key is immutable afterwards.
 */
export function deriveFieldKey(label: string, existingKeys: string[]): string {
  const base =
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_') // non-alphanumerics -> underscore
      .replace(/^_+|_+$/g, '') // trim leading/trailing underscores
    || 'field'

  if (!existingKeys.includes(base)) return base

  let n = 2
  while (existingKeys.includes(`${base}_${n}`)) n++
  return `${base}_${n}`
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/workspaces/field-key.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/workspaces/field-key.ts src/lib/workspaces/field-key.test.ts
git commit -m "feat(workspaces): add stable deriveFieldKey helper"
```

---

### Task 3: Validator — `checkbox`, soft-required, partial mode (TDD)

**Files:**
- Modify: `src/lib/workspace-validator.ts`
- Modify: `src/lib/workspace-validator.test.ts`
- Modify: `src/lib/workspaces/validator.ts` (pass through the new `opts`)

**Interfaces:**
- Consumes: `WorkspaceField` (Prisma type).
- Produces: `validateWorkspaceRecord(fields, input, opts?: { strict?: boolean; partial?: boolean }): ValidationResult`.
  - `strict` (default `true`): reject keys not in the schema.
  - `partial` (default `false`): only validate keys present in `input`; do not null-fill missing keys. Required is never enforced (soft).
- Produces (wrapper): `validateWorkspaceRecord(workspaceId, input, opts?)` in `src/lib/workspaces/validator.ts`.

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/workspace-validator.test.ts` (inside the existing `describe`):
```ts
  it('coerces checkbox to boolean', () => {
    const f: WorkspaceField[] = [
      { id: '3', workspaceId: 'w1', key: 'active', label: 'Active', type: 'checkbox', required: false, position: 0, config: null, validation: null, defaultValue: null, createdAt: new Date(), updatedAt: new Date() },
    ]
    expect(validateWorkspaceRecord(f, { active: 'true' }).data).toEqual({ active: true })
    expect(validateWorkspaceRecord(f, { active: '' }).data).toEqual({ active: false })
  })

  it('does NOT block on missing required (soft required)', () => {
    const result = validateWorkspaceRecord(fields, { name: 'Jordan' })
    expect(result.success).toBe(true)
    expect(result.data).toEqual({ name: 'Jordan', grade: null })
  })

  it('partial mode validates only provided keys and does not null-fill', () => {
    const result = validateWorkspaceRecord(fields, { grade: 90 }, { partial: true })
    expect(result.success).toBe(true)
    expect(result.data).toEqual({ grade: 90 })
  })

  it('partial mode still rejects unknown keys', () => {
    const result = validateWorkspaceRecord(fields, { nope: 1 }, { partial: true })
    expect(result.success).toBe(false)
    expect(result.errors).toEqual({ nope: 'Unknown field' })
  })
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/workspace-validator.test.ts`
Expected: FAIL — soft-required test fails (currently errors on missing `grade`); partial mode unsupported.

- [ ] **Step 3: Rewrite the validator**

Replace the body of `src/lib/workspace-validator.ts` (keep the `FieldError`/`ValidationResult` exports) so the signature and behavior match:
```ts
import { WorkspaceField } from '@prisma/client'

export type FieldError = Record<string, string>

export interface ValidationResult {
  success: boolean
  data?: Record<string, any>
  errors?: FieldError
}

export interface ValidateOptions {
  strict?: boolean // reject unknown keys (default true)
  partial?: boolean // only process keys present in input; never null-fill (default false)
}

export function validateWorkspaceRecord(
  fields: WorkspaceField[],
  input: Record<string, any>,
  opts: ValidateOptions = {}
): ValidationResult {
  const { strict = true, partial = false } = opts
  const data: Record<string, any> = {}
  const errors: FieldError = {}

  for (const field of fields) {
    const has = Object.prototype.hasOwnProperty.call(input, field.key)
    const rawValue = input[field.key]
    const isMissing = rawValue === undefined || rawValue === null

    // In partial mode, skip fields the caller didn't send.
    if (partial && !has) continue

    // Required is SOFT in A: missing -> null, no error.
    if (isMissing) {
      data[field.key] = null
      continue
    }

    try {
      switch (field.type) {
        case 'number': {
          const num = Number(rawValue)
          if (isNaN(num)) throw new Error('Must be a number')
          data[field.key] = num
          break
        }
        case 'text':
          data[field.key] = String(rawValue)
          break
        case 'date': {
          const date = new Date(rawValue)
          if (isNaN(date.getTime())) throw new Error('Invalid date')
          data[field.key] = date.toISOString()
          break
        }
        case 'checkbox':
          data[field.key] = Boolean(rawValue) && rawValue !== 'false'
          break
        case 'choice': {
          const config = field.config as { options?: string[] }
          if (config?.options && !config.options.includes(rawValue)) {
            throw new Error(`Must be one of: ${config.options.join(', ')}`)
          }
          data[field.key] = String(rawValue)
          break
        }
        default:
          data[field.key] = rawValue
      }
    } catch (e) {
      errors[field.key] = e instanceof Error ? e.message : 'Invalid format'
    }
  }

  if (strict) {
    for (const key in input) {
      if (!fields.find((f) => f.key === key)) {
        errors[key] = 'Unknown field'
      }
    }
  }

  return Object.keys(errors).length === 0
    ? { success: true, data }
    : { success: false, errors }
}
```

- [ ] **Step 4: Thread `opts` through the DB wrapper**

In `src/lib/workspaces/validator.ts`:
```ts
import { db } from '@/lib/db'
import { validateWorkspaceRecord as validate, ValidateOptions } from '../workspace-validator'

export async function validateWorkspaceRecord(
  workspaceId: string,
  input: Record<string, any>,
  opts: ValidateOptions = {}
) {
  const fields = await db.workspaceField.findMany({ where: { workspaceId } })
  return validate(fields, input, opts)
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/lib/workspace-validator.test.ts`
Expected: PASS (all original + 4 new).

- [ ] **Step 6: Commit**

```bash
git add src/lib/workspace-validator.ts src/lib/workspace-validator.test.ts src/lib/workspaces/validator.ts
git commit -m "feat(workspaces): checkbox type, soft required, partial validation"
```

---

### Task 4: `updateWorkspaceRecord` service + record PATCH/DELETE routes (TDD)

**Files:**
- Modify: `src/lib/workspaces/service.ts` (add `updateWorkspaceRecord`, `deleteWorkspaceRecord`)
- Create: `src/app/api/workspaces/[id]/records/[recordId]/route.ts`
- Test: `src/lib/workspaces/service.test.ts`
- Test: `src/app/api/workspaces/[id]/records/[recordId]/route.test.ts`

**Interfaces:**
- Consumes: `authorizeWorkspace`, `validateWorkspaceRecord(workspaceId, input, opts)`.
- Produces:
  - `updateWorkspaceRecord({ userId, workspaceId, recordId, patch }: { userId: string; workspaceId: string; recordId: string; patch: Record<string, any> }): Promise<WorkspaceRecord>`
  - `deleteWorkspaceRecord({ userId, workspaceId, recordId }): Promise<void>`
  - Route: `PATCH/DELETE /api/workspaces/[id]/records/[recordId]`, ctx `{ params: Promise<{ id: string; recordId: string }> }`.

- [ ] **Step 1: Write the failing service tests**

`src/lib/workspaces/service.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { updateWorkspaceRecord } from './service'

vi.mock('@/lib/db', () => ({
  db: {
    workspace: { findUnique: vi.fn() },
    workspaceField: { findMany: vi.fn() },
    workspaceRecord: { findFirst: vi.fn(), update: vi.fn() },
  },
}))

import { db } from '@/lib/db'

describe('updateWorkspaceRecord', () => {
  beforeEach(() => vi.clearAllMocks())

  const fields = [
    { id: 'f1', workspaceId: 'w1', key: 'grade', label: 'Grade', type: 'number', required: false, position: 0, config: null, validation: null, defaultValue: null, createdAt: new Date(), updatedAt: new Date() },
  ]

  it('merges a changed cell into existing data', async () => {
    ;(db.workspace.findUnique as any).mockResolvedValue({ id: 'w1', ownerId: 'u1', schemaVersion: 1 })
    ;(db.workspaceField.findMany as any).mockResolvedValue(fields)
    ;(db.workspaceRecord.findFirst as any).mockResolvedValue({ id: 'r1', workspaceId: 'w1', data: { grade: 80, name: 'Jo' } })
    ;(db.workspaceRecord.update as any).mockImplementation(({ data }: any) => ({ id: 'r1', ...data }))

    const res = await updateWorkspaceRecord({ userId: 'u1', workspaceId: 'w1', recordId: 'r1', patch: { grade: 95 } })
    expect(db.workspaceRecord.update).toHaveBeenCalledWith({
      where: { id: 'r1' },
      data: { data: { grade: 95, name: 'Jo' }, updatedById: 'u1' },
    })
    expect(res.data).toEqual({ grade: 95, name: 'Jo' })
  })

  it('throws VALIDATION_ERROR on a bad cell type', async () => {
    ;(db.workspace.findUnique as any).mockResolvedValue({ id: 'w1', ownerId: 'u1', schemaVersion: 1 })
    ;(db.workspaceField.findMany as any).mockResolvedValue(fields)
    ;(db.workspaceRecord.findFirst as any).mockResolvedValue({ id: 'r1', workspaceId: 'w1', data: {} })
    await expect(
      updateWorkspaceRecord({ userId: 'u1', workspaceId: 'w1', recordId: 'r1', patch: { grade: 'abc' } })
    ).rejects.toMatchObject({ type: 'VALIDATION_ERROR' })
  })

  it('throws NOT_FOUND when the record is not in the workspace', async () => {
    ;(db.workspace.findUnique as any).mockResolvedValue({ id: 'w1', ownerId: 'u1', schemaVersion: 1 })
    ;(db.workspaceField.findMany as any).mockResolvedValue(fields)
    ;(db.workspaceRecord.findFirst as any).mockResolvedValue(null)
    await expect(
      updateWorkspaceRecord({ userId: 'u1', workspaceId: 'w1', recordId: 'rX', patch: { grade: 1 } })
    ).rejects.toMatchObject({ type: 'NOT_FOUND' })
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/lib/workspaces/service.test.ts`
Expected: FAIL — `updateWorkspaceRecord` not exported.

- [ ] **Step 3: Implement the service functions**

Append to `src/lib/workspaces/service.ts`:
```ts
import { validateWorkspaceRecord } from './validator'

export async function updateWorkspaceRecord(params: {
  userId: string
  workspaceId: string
  recordId: string
  patch: Record<string, any>
}) {
  const { userId, workspaceId, recordId, patch } = params

  await authorizeWorkspace(userId, workspaceId)

  const record = await db.workspaceRecord.findFirst({
    where: { id: recordId, workspaceId },
  })
  if (!record) throw { type: 'NOT_FOUND', message: 'Record not found' }

  const validation = await validateWorkspaceRecord(workspaceId, patch, { partial: true })
  if (!validation.success) {
    throw { type: 'VALIDATION_ERROR', errors: validation.errors }
  }

  const mergedData = { ...(record.data as Record<string, any>), ...validation.data }

  return db.workspaceRecord.update({
    where: { id: recordId },
    data: { data: mergedData, updatedById: userId },
  })
}

export async function deleteWorkspaceRecord(params: {
  userId: string
  workspaceId: string
  recordId: string
}) {
  const { userId, workspaceId, recordId } = params
  await authorizeWorkspace(userId, workspaceId)
  const { count } = await db.workspaceRecord.deleteMany({
    where: { id: recordId, workspaceId },
  })
  if (count === 0) throw { type: 'NOT_FOUND', message: 'Record not found' }
}
```
(The existing `import { authorizeWorkspace } from './authorize'` and `import { db } from '@/lib/db'` at the top of the file already cover those references. Keep the existing `createWorkspaceRecord`.)

- [ ] **Step 4: Run service tests to verify pass**

Run: `npx vitest run src/lib/workspaces/service.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Write the failing route test**

`src/app/api/workspaces/[id]/records/[recordId]/route.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PATCH, DELETE } from './route'
import { getUser } from '@/lib/auth'
import { updateWorkspaceRecord, deleteWorkspaceRecord } from '@/lib/workspaces/service'

vi.mock('@/lib/auth', () => ({ getUser: vi.fn() }))
vi.mock('@/lib/workspaces/service', () => ({
  updateWorkspaceRecord: vi.fn(),
  deleteWorkspaceRecord: vi.fn(),
}))

describe('records/[recordId] route', () => {
  beforeEach(() => vi.clearAllMocks())
  const ctx = { params: Promise.resolve({ id: 'w1', recordId: 'r1' }) }

  it('PATCH updates a cell', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'u1' })
    ;(updateWorkspaceRecord as any).mockResolvedValue({ id: 'r1', data: { grade: 95 } })
    const req = new Request('http://localhost', { method: 'PATCH', body: JSON.stringify({ data: { grade: 95 } }) })
    const res = await PATCH(req as any, ctx)
    expect(res.status).toBe(200)
    expect(updateWorkspaceRecord).toHaveBeenCalledWith({ userId: 'u1', workspaceId: 'w1', recordId: 'r1', patch: { grade: 95 } })
  })

  it('PATCH returns 422 on validation error', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'u1' })
    ;(updateWorkspaceRecord as any).mockRejectedValue({ type: 'VALIDATION_ERROR', errors: { grade: 'Must be a number' } })
    const req = new Request('http://localhost', { method: 'PATCH', body: JSON.stringify({ data: { grade: 'x' } }) })
    const res = await PATCH(req as any, ctx)
    expect(res.status).toBe(422)
  })

  it('DELETE removes a row', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'u1' })
    ;(deleteWorkspaceRecord as any).mockResolvedValue(undefined)
    const req = new Request('http://localhost', { method: 'DELETE' })
    const res = await DELETE(req as any, ctx)
    expect(res.status).toBe(200)
  })

  it('401 when unauthenticated', async () => {
    ;(getUser as any).mockResolvedValue(null)
    const req = new Request('http://localhost', { method: 'DELETE' })
    const res = await DELETE(req as any, ctx)
    expect(res.status).toBe(401)
  })
})
```

- [ ] **Step 6: Run to verify failure**

Run: `npx vitest run "src/app/api/workspaces/[id]/records/[recordId]/route.test.ts"`
Expected: FAIL — `./route` not found.

- [ ] **Step 7: Implement the route**

`src/app/api/workspaces/[id]/records/[recordId]/route.ts`:
```ts
import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'
import { updateWorkspaceRecord, deleteWorkspaceRecord } from '@/lib/workspaces/service'

type Ctx = { params: Promise<{ id: string; recordId: string }> }

function handleError(error: any) {
  if (error.type === 'VALIDATION_ERROR') {
    return NextResponse.json({ error: 'Validation failed', fields: error.errors }, { status: 422 })
  }
  if (error.type === 'NOT_FOUND' || error.message === 'Unauthorized or Workspace not found') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  console.error('Record route error:', error)
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
}

export async function PATCH(request: NextRequest, { params }: Ctx) {
  const user = await getUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id: workspaceId, recordId } = await params
  try {
    const body = await request.json()
    if (!body?.data || typeof body.data !== 'object') {
      return NextResponse.json({ error: 'data object required' }, { status: 400 })
    }
    const record = await updateWorkspaceRecord({ userId: user.id, workspaceId, recordId, patch: body.data })
    return NextResponse.json(record)
  } catch (error) {
    return handleError(error)
  }
}

export async function DELETE(request: NextRequest, { params }: Ctx) {
  const user = await getUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id: workspaceId, recordId } = await params
  try {
    await deleteWorkspaceRecord({ userId: user.id, workspaceId, recordId })
    return NextResponse.json({ ok: true })
  } catch (error) {
    return handleError(error)
  }
}
```

- [ ] **Step 8: Run route tests to verify pass**

Run: `npx vitest run "src/app/api/workspaces/[id]/records/[recordId]/route.test.ts"`
Expected: PASS (4 tests).

- [ ] **Step 9: Commit**

```bash
git add src/lib/workspaces/service.ts src/lib/workspaces/service.test.ts "src/app/api/workspaces/[id]/records/[recordId]"
git commit -m "feat(workspaces): record PATCH (partial merge) + DELETE"
```

---

### Task 5: Field POST (label→key) + field PATCH/DELETE routes (TDD)

**Files:**
- Modify: `src/app/api/workspaces/[id]/fields/route.ts` (POST derives key from label)
- Create: `src/app/api/workspaces/[id]/fields/[fieldId]/route.ts`
- Test: `src/app/api/workspaces/[id]/fields/route.test.ts`
- Test: `src/app/api/workspaces/[id]/fields/[fieldId]/route.test.ts`

**Interfaces:**
- Consumes: `deriveFieldKey`, `db.workspaceField`, `authorizeWorkspace` (via inline ownership check pattern already in the fields route).
- Produces:
  - POST body `{ label: string; type: string; required?: boolean; config?: any }` → derives `key`.
  - `PATCH/DELETE /api/workspaces/[id]/fields/[fieldId]`, ctx `{ params: Promise<{ id: string; fieldId: string }> }`. PATCH body may include `{ label?, config?, required?, position? }` (never `key` or `type`).

- [ ] **Step 1: Write the failing POST test**

`src/app/api/workspaces/[id]/fields/route.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from './route'
import { getUser } from '@/lib/auth'
import { db } from '@/lib/db'

vi.mock('@/lib/auth', () => ({ getUser: vi.fn() }))
vi.mock('@/lib/db', () => ({
  db: {
    workspace: { findUnique: vi.fn() },
    workspaceField: { findMany: vi.fn(), count: vi.fn(), create: vi.fn() },
  },
}))

describe('POST /api/workspaces/[id]/fields', () => {
  beforeEach(() => vi.clearAllMocks())
  const ctx = { params: Promise.resolve({ id: 'w1' }) }

  it('derives a stable key from the label', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'u1' })
    ;(db.workspace.findUnique as any).mockResolvedValue({ ownerId: 'u1' })
    ;(db.workspaceField.findMany as any).mockResolvedValue([{ key: 'final_grade' }])
    ;(db.workspaceField.count as any).mockResolvedValue(1)
    ;(db.workspaceField.create as any).mockImplementation(({ data }: any) => ({ id: 'f2', ...data }))

    const req = new Request('http://localhost', { method: 'POST', body: JSON.stringify({ label: 'Final Grade', type: 'number' }) })
    const res = await POST(req as any, ctx)
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.key).toBe('final_grade_2') // de-duped against existing
    expect(body.label).toBe('Final Grade')
    expect(body.position).toBe(1)
  })

  it('400 when label or type missing', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'u1' })
    ;(db.workspace.findUnique as any).mockResolvedValue({ ownerId: 'u1' })
    const req = new Request('http://localhost', { method: 'POST', body: JSON.stringify({ type: 'text' }) })
    const res = await POST(req as any, ctx)
    expect(res.status).toBe(400)
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run "src/app/api/workspaces/[id]/fields/route.test.ts"`
Expected: FAIL — POST still expects client `key`; returns `final_grade` not `final_grade_2`.

- [ ] **Step 3: Modify the POST handler to derive the key**

In `src/app/api/workspaces/[id]/fields/route.ts`, add the import at top:
```ts
import { deriveFieldKey } from '@/lib/workspaces/field-key'
```
Replace the body of the `POST` `try` block:
```ts
    const { label, type, required, config } = await request.json()
    if (!label || !type) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const existing = await db.workspaceField.findMany({ where: { workspaceId: id }, select: { key: true } })
    const key = deriveFieldKey(label, existing.map((f) => f.key))

    const count = await db.workspaceField.count({ where: { workspaceId: id } })

    const field = await db.workspaceField.create({
      data: { workspaceId: id, key, label, type, required: !!required, position: count, config: config ?? undefined },
    })
    return NextResponse.json(field, { status: 201 })
```
(Leave the surrounding ownership check and the `P2002` catch as-is.)

- [ ] **Step 4: Run POST test to verify pass**

Run: `npx vitest run "src/app/api/workspaces/[id]/fields/route.test.ts"`
Expected: PASS (2 tests).

- [ ] **Step 5: Write the failing PATCH/DELETE field test**

`src/app/api/workspaces/[id]/fields/[fieldId]/route.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PATCH, DELETE } from './route'
import { getUser } from '@/lib/auth'
import { db } from '@/lib/db'

vi.mock('@/lib/auth', () => ({ getUser: vi.fn() }))
vi.mock('@/lib/db', () => ({
  db: {
    workspace: { findUnique: vi.fn() },
    workspaceField: { updateMany: vi.fn(), deleteMany: vi.fn() },
  },
}))

describe('fields/[fieldId] route', () => {
  beforeEach(() => vi.clearAllMocks())
  const ctx = { params: Promise.resolve({ id: 'w1', fieldId: 'f1' }) }

  it('PATCH updates label only (never key/type)', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'u1' })
    ;(db.workspace.findUnique as any).mockResolvedValue({ ownerId: 'u1' })
    ;(db.workspaceField.updateMany as any).mockResolvedValue({ count: 1 })
    const req = new Request('http://localhost', { method: 'PATCH', body: JSON.stringify({ label: 'New', key: 'hax', type: 'number' }) })
    const res = await PATCH(req as any, ctx)
    expect(res.status).toBe(200)
    const call = (db.workspaceField.updateMany as any).mock.calls[0][0]
    expect(call.data).toEqual({ label: 'New' }) // key/type stripped
    expect(call.where).toEqual({ id: 'f1', workspaceId: 'w1' })
  })

  it('DELETE removes the column', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'u1' })
    ;(db.workspace.findUnique as any).mockResolvedValue({ ownerId: 'u1' })
    ;(db.workspaceField.deleteMany as any).mockResolvedValue({ count: 1 })
    const req = new Request('http://localhost', { method: 'DELETE' })
    const res = await DELETE(req as any, ctx)
    expect(res.status).toBe(200)
  })

  it('404 when not owner', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'u2' })
    ;(db.workspace.findUnique as any).mockResolvedValue({ ownerId: 'u1' })
    const req = new Request('http://localhost', { method: 'DELETE' })
    const res = await DELETE(req as any, ctx)
    expect(res.status).toBe(404)
  })
})
```

- [ ] **Step 6: Run to verify failure**

Run: `npx vitest run "src/app/api/workspaces/[id]/fields/[fieldId]/route.test.ts"`
Expected: FAIL — `./route` not found.

- [ ] **Step 7: Implement the field PATCH/DELETE route**

`src/app/api/workspaces/[id]/fields/[fieldId]/route.ts`:
```ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'

type Ctx = { params: Promise<{ id: string; fieldId: string }> }

async function assertOwner(request: NextRequest, workspaceId: string) {
  const user = await getUser(request)
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const ws = await db.workspace.findUnique({ where: { id: workspaceId }, select: { ownerId: true } })
  if (!ws || ws.ownerId !== user.id) {
    return { error: NextResponse.json({ error: 'Workspace not found' }, { status: 404 }) }
  }
  return { user }
}

// Only these keys are updatable; key and type are immutable.
const ALLOWED = ['label', 'config', 'required', 'position'] as const

export async function PATCH(request: NextRequest, { params }: Ctx) {
  const { id, fieldId } = await params
  const gate = await assertOwner(request, id)
  if (gate.error) return gate.error
  try {
    const body = await request.json()
    const data: Record<string, any> = {}
    for (const k of ALLOWED) if (k in body) data[k] = body[k]
    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'No updatable fields' }, { status: 400 })
    }
    const { count } = await db.workspaceField.updateMany({ where: { id: fieldId, workspaceId: id }, data })
    if (count === 0) return NextResponse.json({ error: 'Field not found' }, { status: 404 })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Field PATCH error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: Ctx) {
  const { id, fieldId } = await params
  const gate = await assertOwner(request, id)
  if (gate.error) return gate.error
  const { count } = await db.workspaceField.deleteMany({ where: { id: fieldId, workspaceId: id } })
  if (count === 0) return NextResponse.json({ error: 'Field not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 8: Run field tests to verify pass**

Run: `npx vitest run "src/app/api/workspaces/[id]/fields"`
Expected: PASS (all field tests).

- [ ] **Step 9: Commit**

```bash
git add "src/app/api/workspaces/[id]/fields"
git commit -m "feat(workspaces): field key-from-label, field PATCH/DELETE"
```

---

### Task 6: `GET /api/workspaces/[id]` + workspace PATCH/DELETE (TDD)

**Files:**
- Create: `src/app/api/workspaces/[id]/route.ts`
- Test: `src/app/api/workspaces/[id]/route.test.ts`

**Interfaces:**
- Produces: `GET /api/workspaces/[id]` returns:
  ```ts
  {
    workspace: { id: string; name: string; description: string | null; icon: string | null },
    fields: WorkspaceField[],            // ordered by position asc
    records: { id: string; data: Record<string, any>; updatedAt: string }[], // createdAt asc
    pagination: { page: number; pageSize: number; total: number; totalPages: number }
  }
  ```
- Produces: `PATCH` body `{ name?, description?, icon? }`; `DELETE` cascades. ctx `{ params: Promise<{ id: string }> }`.

- [ ] **Step 1: Write the failing test**

`src/app/api/workspaces/[id]/route.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET, PATCH, DELETE } from './route'
import { getUser } from '@/lib/auth'
import { db } from '@/lib/db'

vi.mock('@/lib/auth', () => ({ getUser: vi.fn() }))
vi.mock('@/lib/db', () => ({
  db: {
    workspace: { findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() },
    workspaceField: { findMany: vi.fn() },
    workspaceRecord: { findMany: vi.fn(), count: vi.fn() },
  },
}))

describe('workspaces/[id] route', () => {
  beforeEach(() => vi.clearAllMocks())
  const ctx = { params: Promise.resolve({ id: 'w1' }) }
  const req = (method: string, body?: any) =>
    ({ method, nextUrl: new URL('http://localhost/api/workspaces/w1'), json: async () => body } as any)

  it('GET returns workspace + fields + records', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'u1' })
    ;(db.workspace.findUnique as any).mockResolvedValue({ id: 'w1', ownerId: 'u1', name: 'S', description: null, icon: null })
    ;(db.workspaceField.findMany as any).mockResolvedValue([{ id: 'f1', key: 'grade' }])
    ;(db.workspaceRecord.findMany as any).mockResolvedValue([{ id: 'r1', data: { grade: 90 }, updatedAt: new Date('2026-07-14') }])
    ;(db.workspaceRecord.count as any).mockResolvedValue(1)

    const res = await GET(req('GET'), ctx)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.workspace.name).toBe('S')
    expect(body.fields).toHaveLength(1)
    expect(body.records[0].data).toEqual({ grade: 90 })
    expect(body.pagination.total).toBe(1)
  })

  it('GET 404 when not owner', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'u2' })
    ;(db.workspace.findUnique as any).mockResolvedValue({ id: 'w1', ownerId: 'u1' })
    const res = await GET(req('GET'), ctx)
    expect(res.status).toBe(404)
  })

  it('PATCH renames the workspace', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'u1' })
    ;(db.workspace.findUnique as any).mockResolvedValue({ id: 'w1', ownerId: 'u1' })
    ;(db.workspace.update as any).mockResolvedValue({ id: 'w1', name: 'New' })
    const res = await PATCH(req('PATCH', { name: 'New' }), ctx)
    expect(res.status).toBe(200)
    expect(db.workspace.update).toHaveBeenCalledWith({ where: { id: 'w1' }, data: { name: 'New' } })
  })

  it('DELETE removes the workspace', async () => {
    ;(getUser as any).mockResolvedValue({ id: 'u1' })
    ;(db.workspace.findUnique as any).mockResolvedValue({ id: 'w1', ownerId: 'u1' })
    ;(db.workspace.delete as any).mockResolvedValue({ id: 'w1' })
    const res = await DELETE(req('DELETE'), ctx)
    expect(res.status).toBe(200)
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run "src/app/api/workspaces/[id]/route.test.ts"`
Expected: FAIL — `./route` not found.

- [ ] **Step 3: Implement the route**

`src/app/api/workspaces/[id]/route.ts`:
```ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'

type Ctx = { params: Promise<{ id: string }> }

async function gate(request: NextRequest, id: string) {
  const user = await getUser(request)
  if (!user) return { res: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const ws = await db.workspace.findUnique({ where: { id } })
  if (!ws || ws.ownerId !== user.id) {
    return { res: NextResponse.json({ error: 'Workspace not found' }, { status: 404 }) }
  }
  return { user, ws }
}

export async function GET(request: NextRequest, { params }: Ctx) {
  const { id } = await params
  const g = await gate(request, id)
  if (g.res) return g.res

  const searchParams = request.nextUrl.searchParams
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
  const pageSize = Math.min(200, Math.max(1, parseInt(searchParams.get('pageSize') || '100')))

  const [fields, records, total] = await Promise.all([
    db.workspaceField.findMany({ where: { workspaceId: id }, orderBy: { position: 'asc' } }),
    db.workspaceRecord.findMany({
      where: { workspaceId: id, status: 'active' },
      orderBy: { createdAt: 'asc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: { id: true, data: true, updatedAt: true },
    }),
    db.workspaceRecord.count({ where: { workspaceId: id, status: 'active' } }),
  ])

  const ws = g.ws!
  return NextResponse.json({
    workspace: { id: ws.id, name: ws.name, description: ws.description, icon: ws.icon },
    fields,
    records,
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  })
}

export async function PATCH(request: NextRequest, { params }: Ctx) {
  const { id } = await params
  const g = await gate(request, id)
  if (g.res) return g.res
  try {
    const body = await request.json()
    const data: Record<string, any> = {}
    for (const k of ['name', 'description', 'icon'] as const) if (k in body) data[k] = body[k]
    if (Object.keys(data).length === 0) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
    const updated = await db.workspace.update({ where: { id }, data })
    return NextResponse.json(updated)
  } catch (error: any) {
    if (error.code === 'P2002') return NextResponse.json({ error: 'Name already in use' }, { status: 409 })
    console.error('Workspace PATCH error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: Ctx) {
  const { id } = await params
  const g = await gate(request, id)
  if (g.res) return g.res
  await db.workspace.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run "src/app/api/workspaces/[id]/route.test.ts"`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add "src/app/api/workspaces/[id]/route.ts" "src/app/api/workspaces/[id]/route.test.ts"
git commit -m "feat(workspaces): GET workspace (grid read) + PATCH/DELETE"
```

---

### Task 7: `useWorkspaceGrid` hook (TDD with mocked fetch)

**Files:**
- Create: `src/components/workspaces/useWorkspaceGrid.ts`
- Test: `src/components/workspaces/useWorkspaceGrid.test.ts`

**Interfaces:**
- Consumes: the REST endpoints from Tasks 4–6.
- Produces: `useWorkspaceGrid(workspaceId: string)` returning:

> **Prerequisite (one-time):** this is the first test in the repo to use React Testing Library's `render`/`renderHook`. `@testing-library/react` is installed but its required peer `@testing-library/dom` is **not**, and no `.test.tsx` has exercised it before. Install it first or the hook/cell tests throw "Cannot find module '@testing-library/dom'":
> ```bash
> pnpm add -D @testing-library/dom
> ```
> (vitest is already configured with `environment: 'jsdom'` and a jest-dom setup file, so nothing else is needed.)

  ```ts
  {
    loading: boolean; error: string | null;
    workspace: { id: string; name: string; description: string | null; icon: string | null } | null;
    fields: WorkspaceField[]; records: GridRecord[];
    addRow(): Promise<void>;
    updateCell(recordId: string, key: string, value: any): Promise<void>;
    deleteRow(recordId: string): Promise<void>;
    addField(label: string, type: string, config?: any): Promise<void>;
    updateField(fieldId: string, patch: Record<string, any>): Promise<void>;
    deleteField(fieldId: string): Promise<void>;
    reload(): Promise<void>;
  }
  ```
  where `GridRecord = { id: string; data: Record<string, any>; updatedAt: string }`.

- [ ] **Step 1: Write the failing test (optimistic update + rollback)**

`src/components/workspaces/useWorkspaceGrid.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useWorkspaceGrid } from './useWorkspaceGrid'

const initial = {
  workspace: { id: 'w1', name: 'S', description: null, icon: null },
  fields: [{ id: 'f1', key: 'grade', label: 'Grade', type: 'number', position: 0 }],
  records: [{ id: 'r1', data: { grade: 80 }, updatedAt: '2026-07-14' }],
  pagination: { page: 1, pageSize: 100, total: 1, totalPages: 1 },
}

beforeEach(() => vi.restoreAllMocks())

function mockFetchOnceThen(loadBody: any, mutationOk = true) {
  const fetchMock = vi.fn()
  fetchMock.mockResolvedValueOnce({ ok: true, json: async () => loadBody }) // initial GET
  fetchMock.mockResolvedValue({ ok: mutationOk, json: async () => ({}) }) // subsequent
  ;(globalThis as any).fetch = fetchMock
  return fetchMock
}

describe('useWorkspaceGrid', () => {
  it('loads then optimistically updates a cell', async () => {
    mockFetchOnceThen(initial)
    const { result } = renderHook(() => useWorkspaceGrid('w1'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.records[0].data.grade).toBe(80)

    await act(async () => { await result.current.updateCell('r1', 'grade', 95) })
    expect(result.current.records[0].data.grade).toBe(95)
  })

  it('rolls back a cell on a failed save', async () => {
    mockFetchOnceThen(initial, false) // mutations fail
    const { result } = renderHook(() => useWorkspaceGrid('w1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => { await result.current.updateCell('r1', 'grade', 95) })
    expect(result.current.records[0].data.grade).toBe(80) // reverted
    expect(result.current.error).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/components/workspaces/useWorkspaceGrid.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the hook**

`src/components/workspaces/useWorkspaceGrid.ts`:
```ts
'use client'

import { useCallback, useEffect, useState } from 'react'

export type GridRecord = { id: string; data: Record<string, any>; updatedAt: string }
export type GridField = { id: string; key: string; label: string; type: string; position: number; required?: boolean; config?: any }
type Workspace = { id: string; name: string; description: string | null; icon: string | null }

export function useWorkspaceGrid(workspaceId: string) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [fields, setFields] = useState<GridField[]>([])
  const [records, setRecords] = useState<GridRecord[]>([])

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
    let prev: GridRecord | undefined
    setRecords((rs) => rs.map((r) => {
      if (r.id !== recordId) return r
      prev = r
      return { ...r, data: { ...r.data, [key]: value } }
    }))
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
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/components/workspaces/useWorkspaceGrid.test.ts`
Expected: PASS (2 tests). (If it errors with "Cannot find module '@testing-library/dom'", run the prerequisite install above.)

- [ ] **Step 5: Commit**

```bash
git add src/components/workspaces/useWorkspaceGrid.ts src/components/workspaces/useWorkspaceGrid.test.ts
git commit -m "feat(workspaces): useWorkspaceGrid hook (optimistic CRUD)"
```

---

### Task 8: Workspaces list page + Create modal

**Files:**
- Create: `src/components/workspaces/CreateWorkspaceModal.tsx`
- Create: `src/components/workspaces/WorkspacesListClient.tsx`
- Modify: `src/app/(dashboard)/workspaces/page.tsx` (render the list client)

**Interfaces:**
- Consumes: `GET /api/workspaces` (list), `POST /api/workspaces` (create → `{ id }`).
- Produces: navigable list at `/workspaces`; clicking a card → `/workspaces/[id]`.

- [ ] **Step 1: Implement the Create modal**

`src/components/workspaces/CreateWorkspaceModal.tsx`:
```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function CreateWorkspaceModal({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function create() {
    if (!name.trim()) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Failed')
      const ws = await res.json()
      router.push(`/workspaces/${ws.id}`)
    } catch (e: any) {
      setError(e.message)
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-surface p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-4 text-lg font-bold">New workspace</h2>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && create()}
          placeholder="e.g. Students"
          className="w-full rounded-lg border border-border bg-transparent px-3 py-2"
        />
        {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-muted-foreground">Cancel</button>
          <button onClick={create} disabled={busy || !name.trim()} className="rounded-lg bg-galli px-4 py-2 font-medium text-white disabled:opacity-50">
            {busy ? 'Creating…' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Implement the list client**

`src/components/workspaces/WorkspacesListClient.tsx`:
```tsx
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Database, Plus } from 'lucide-react'
import { CreateWorkspaceModal } from './CreateWorkspaceModal'

type WorkspaceSummary = { id: string; name: string; description: string | null; icon: string | null }

export function WorkspacesListClient() {
  const [items, setItems] = useState<WorkspaceSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)

  useEffect(() => {
    fetch('/api/workspaces')
      .then((r) => (r.ok ? r.json() : []))
      .then(setItems)
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="px-6 py-7 lg:px-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Workspaces</h1>
          <p className="text-muted-foreground">Your data, organized.</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 rounded-lg bg-galli px-4 py-2 font-medium text-white">
          <Plus size={18} /> New workspace
        </button>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center">
          <Database className="mx-auto mb-3 text-muted-foreground" />
          <p className="mb-4 text-muted-foreground">No workspaces yet.</p>
          <button onClick={() => setShowCreate(true)} className="rounded-lg bg-galli px-4 py-2 font-medium text-white">
            Create your first
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((ws) => (
            <Link key={ws.id} href={`/workspaces/${ws.id}`} className="rounded-xl border border-border bg-surface p-5 transition hover:shadow-md">
              <div className="mb-2 flex items-center gap-2">
                <Database size={18} className="text-galli" />
                <h3 className="font-semibold">{ws.name}</h3>
              </div>
              {ws.description && <p className="text-sm text-muted-foreground">{ws.description}</p>}
            </Link>
          ))}
        </div>
      )}

      {showCreate && <CreateWorkspaceModal onClose={() => setShowCreate(false)} />}
    </div>
  )
}
```

- [ ] **Step 3: Wire the page**

Replace `src/app/(dashboard)/workspaces/page.tsx`:
```tsx
import { WorkspacesListClient } from '@/components/workspaces/WorkspacesListClient'

export default function WorkspacesPage() {
  return <WorkspacesListClient />
}
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit 2>&1 | grep -i workspace`
Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add src/components/workspaces/CreateWorkspaceModal.tsx src/components/workspaces/WorkspacesListClient.tsx "src/app/(dashboard)/workspaces/page.tsx"
git commit -m "feat(workspaces): list page + create modal"
```

---

### Task 9: Grid cells (Core-5 editors)

**Files:**
- Create: `src/components/workspaces/cells/GridCell.tsx`
- Test: `src/components/workspaces/cells/GridCell.test.tsx`

**Interfaces:**
- Consumes: `GridField` (from Task 7).
- Produces: `<GridCell field={GridField} value={any} onCommit={(value:any)=>void} />` — dispatches by `field.type`; commits on blur/Enter, cancels on Esc.

- [ ] **Step 1: Write the failing test**

`src/components/workspaces/cells/GridCell.test.tsx`:
```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { GridCell } from './GridCell'

const field = (type: string) => ({ id: 'f', key: 'k', label: 'L', type, position: 0 })

describe('GridCell', () => {
  it('commits text on blur', () => {
    const onCommit = vi.fn()
    render(<GridCell field={field('text') as any} value="" onCommit={onCommit} />)
    const cell = screen.getByTestId('cell-display')
    fireEvent.click(cell)
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: 'hello' } })
    fireEvent.blur(input)
    expect(onCommit).toHaveBeenCalledWith('hello')
  })

  it('checkbox commits immediately on toggle', () => {
    const onCommit = vi.fn()
    render(<GridCell field={field('checkbox') as any} value={false} onCommit={onCommit} />)
    fireEvent.click(screen.getByRole('checkbox'))
    expect(onCommit).toHaveBeenCalledWith(true)
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/components/workspaces/cells/GridCell.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the cell dispatcher + editors**

`src/components/workspaces/cells/GridCell.tsx`:
```tsx
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
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/components/workspaces/cells/GridCell.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/workspaces/cells
git commit -m "feat(workspaces): Core-5 grid cell editors"
```

---

### Task 10: `WorkspaceGrid` + column editor + detail page rewrite

**Files:**
- Create: `src/components/workspaces/ColumnEditorPopover.tsx`
- Create: `src/components/workspaces/WorkspaceGrid.tsx`
- Modify: `src/app/(dashboard)/workspaces/[id]/page.tsx` (render `WorkspaceGrid`)
- Delete: `src/components/workspaces/WorkspaceTable.tsx`, `src/components/workspaces/ViewConfigPanel.tsx` (superseded by the grid; POC-only)

**Interfaces:**
- Consumes: `useWorkspaceGrid` (Task 7), `GridCell` (Task 9).
- Produces: the interactive grid at `/workspaces/[id]`.

- [ ] **Step 1: Implement the column editor popover**

`src/components/workspaces/ColumnEditorPopover.tsx`:
```tsx
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
```

- [ ] **Step 2: Implement the grid**

`src/components/workspaces/WorkspaceGrid.tsx`:
```tsx
'use client'

import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { useWorkspaceGrid } from './useWorkspaceGrid'
import { GridCell } from './cells/GridCell'
import { ColumnEditorPopover } from './ColumnEditorPopover'

export function WorkspaceGrid({ workspaceId }: { workspaceId: string }) {
  const grid = useWorkspaceGrid(workspaceId)
  const [addingColumn, setAddingColumn] = useState(false)

  if (grid.loading) return <div className="p-8 text-muted-foreground">Loading…</div>
  if (grid.error && !grid.workspace) {
    return (
      <div className="p-8">
        <p className="mb-3 text-red-500">Couldn’t load this workspace.</p>
        <button onClick={grid.reload} className="rounded-lg border border-border px-4 py-2">Retry</button>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col p-6 lg:p-8">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">{grid.workspace?.name}</h1>
        {grid.error && <span className="text-sm text-red-500">{grid.error}</span>}
      </div>

      {grid.fields.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center">
          <p className="mb-4 text-muted-foreground">Add your first column to get started.</p>
          <button onClick={() => setAddingColumn(true)} className="rounded-lg bg-galli px-4 py-2 font-medium text-white">
            Add column
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-surface">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted text-xs uppercase text-muted-foreground">
              <tr>
                {grid.fields.map((f) => (
                  <th key={f.id} className="group px-4 py-3 text-left font-semibold">
                    <span className="flex items-center gap-1">
                      {f.label}{f.required ? <span className="text-red-500">*</span> : null}
                      <button
                        onClick={() => { if (confirm(`Delete column “${f.label}”?`)) grid.deleteField(f.id) }}
                        className="opacity-0 transition group-hover:opacity-100"
                        title="Delete column"
                      >
                        <Trash2 size={13} className="text-muted-foreground hover:text-red-500" />
                      </button>
                    </span>
                  </th>
                ))}
                <th className="px-3 py-3">
                  <button onClick={() => setAddingColumn(true)} title="Add column"><Plus size={16} /></button>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {grid.records.map((rec) => (
                <tr key={rec.id} className="group hover:bg-muted/40">
                  {grid.fields.map((f) => (
                    <td key={f.id} className="px-4 py-2 align-top">
                      <GridCell field={f} value={rec.data[f.key]} onCommit={(v) => grid.updateCell(rec.id, f.key, v)} />
                    </td>
                  ))}
                  <td className="px-3 py-2">
                    <button
                      onClick={() => { if (confirm('Delete this row?')) grid.deleteRow(rec.id) }}
                      className="opacity-0 transition group-hover:opacity-100"
                      title="Delete row"
                    >
                      <Trash2 size={14} className="text-muted-foreground hover:text-red-500" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button onClick={grid.addRow} className="flex w-full items-center gap-2 px-4 py-3 text-sm text-muted-foreground hover:bg-muted/40">
            <Plus size={16} /> Add row
          </button>
        </div>
      )}

      {addingColumn && (
        <ColumnEditorPopover
          onClose={() => setAddingColumn(false)}
          onSubmit={(label, type, config) => { grid.addField(label, type, config); setAddingColumn(false) }}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 3: Rewrite the detail page**

Replace `src/app/(dashboard)/workspaces/[id]/page.tsx`:
```tsx
import { WorkspaceGrid } from '@/components/workspaces/WorkspaceGrid'

export default async function WorkspacePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <WorkspaceGrid workspaceId={id} />
}
```

- [ ] **Step 4: Delete the superseded POC components**

```bash
git rm src/components/workspaces/WorkspaceTable.tsx src/components/workspaces/ViewConfigPanel.tsx
```

- [ ] **Step 5: Typecheck + full test run**

Run:
```bash
npx tsc --noEmit 2>&1 | grep -i workspace
npx vitest run src/lib/workspace-validator.test.ts src/lib/workspaces src/components/workspaces src/app/api/workspaces
```
Expected: no workspace tsc output; all tests pass.

- [ ] **Step 6: Commit**

```bash
git add "src/app/(dashboard)/workspaces/[id]/page.tsx" src/components/workspaces
git commit -m "feat(workspaces): interactive grid + column editor, retire POC table"
```

---

### Task 11: Verification + CI green

**Files:** none (verification only)

- [ ] **Step 1: Full local gate**

Run (stop `next dev` first on Windows):
```bash
npx tsc --noEmit
npx next lint
npx vitest run
```
Expected: 0 TS errors, lint clean, all tests pass. Fix anything that fails before continuing.

- [ ] **Step 2: Browser smoke (the real verification)**

Start the app with the correct DB env:
```bash
export DATABASE_URL="postgresql://pages:pages@127.0.0.1:5434/pages"
export DATABASE_URL_UNPOOLED="postgresql://pages:pages@127.0.0.1:5434/pages"
pnpm dev
```
Then, logged in, walk the success criteria:
1. Sidebar → **Workspaces** → **New workspace** → name "Students" → lands on the grid.
2. **Add column** ×5: Name (text), Grade (number), Attendance (number), Sport (single-select: Soccer/Tennis/None), Active (checkbox).
3. **Add row** ×3; fill cells of every type; toggle a checkbox; pick a dropdown value.
4. Edit an existing cell; delete a column; delete a row.
5. **Reload the page** — every value persists.
6. Kill dev, confirm no console errors during the walk.

Record the result (pass/fail + any issues) in the PR description.

- [ ] **Step 3: Push the branch + open a PR**

```bash
git push -u origin workspaces-foundation
gh pr create --title "Workspaces foundation (Sub-project A)" --body "Implements docs/superpowers/specs/2026-07-14-workspaces-foundation-design.md. Inline grid, Core-5 field types, per-cell autosave. Free/ungated. Browser smoke: <paste result>."
```
Expected: PR opened; CI runs and goes green. (A failed Vercel *preview* check due to the Neon branch limit is not a code problem — prod deploys fine on merge.)

---

## Notes for the implementer

- **Read the spec first** (`docs/superpowers/specs/2026-07-14-workspaces-foundation-design.md`) for the "why."
- The existing `src/lib/workspaces/{authorize,service,validator,query-view}.ts` and the `views/*` routes are already present; do not rewrite them beyond what tasks specify. `query-view.ts` + the `views` routes stay unused in A (Sub-project C).
- Tasks 7 & 9 are the repo's first RTL tests — install `@testing-library/dom` once (Task 7 prerequisite) before running them.
- Keep commits small (one per task minimum, as written).
