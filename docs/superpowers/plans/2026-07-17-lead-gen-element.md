# Lead Gen Element Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a free "Lead Gen" page element where a visitor enters their email (name optional) and instantly receives a preset message + optional file download link, while the owner captures the email as a lead in the Data tab.

**Architecture:** A new `lead-gen` element type follows the existing 7-seam element pattern (type in `canvas.ts` → editor/public component pair → slash menu → ColumnCanvas → elements index → render-elements). The public component POSTs to a new `/api/lead-gen/[displayId]` route that resolves the element server-side from the stored display JSON (never trusting client-supplied message/file), stores a `LeadCapture` row, and sends the preset email via the existing Resend seam. Leads surface in the existing Data-tab element-analytics machinery.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Prisma/PostgreSQL, Vitest, Tailwind, Resend (`sendEmail`), Vercel Blob (`/api/upload`).

## Global Constraints

- Slash-menu label: **"Lead Gen"**; type slug: **`lead-gen`**; element field prefix: **`leadGen*`**; component names **`LeadGenElement`** / **`PublicLeadGenElement`**; email builder **`leadGenEmail`**; route rate-limit prefix **`lead-gen`**.
- Tier: **Free** (no `pro: true` on the slash command; no `isPro` gating).
- Delivery is **instant**; email carries a **download link** (Blob URL), never an attachment.
- Emailed content is **always** resolved server-side from the stored display — never from the request body.
- File payload uses the existing `/api/upload` allowlist only: **images (JPEG/PNG/GIF/WebP) or PDF, ≤25MB**. No zip in v1.
- Prisma migrations here are non-interactive: **hand-author** `migration.sql` (shared dev DB `migrate diff` is contaminated), then `prisma migrate deploy`. Set `DATABASE_URL` and `DATABASE_URL_UNPOOLED` inline (127.0.0.1, port 5434) for every Prisma command.
- `createElement()` in `canvas.ts` is the **single** source of element defaults — do not add a branch in `PageEditor`.
- Tests: `pnpm test` (vitest). Commit after each green task.

---

### Task 1: Element type seam + defaults (`canvas.ts`)

**Files:**
- Modify: `src/lib/types/canvas.ts` (ElementType union ~line 157; `CanvasElement` fields ~line 324; `createElement` ~line 1311)
- Test: `src/lib/types/lead-gen-element.test.ts`

**Interfaces:**
- Produces: `ElementType` gains `'lead-gen'`; `CanvasElement` gains `leadGenHeadline?`, `leadGenButtonLabel?`, `leadGenMessage?`, `leadGenFileUrl?`, `leadGenFileName?`, `leadGenSuccessText?`, `leadGenCollectName?: boolean`; `createElement('lead-gen')` returns those seeded.

- [ ] **Step 1: Write the failing test**

Create `src/lib/types/lead-gen-element.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { createElement } from './canvas'

describe('createElement("lead-gen")', () => {
  it('creates a lead-gen element with friendly defaults and a stable id', () => {
    const el = createElement('lead-gen')
    expect(el.type).toBe('lead-gen')
    expect(el.id).toBeTruthy()
    expect(el.leadGenHeadline).toBe('Get my free guide')
    expect(el.leadGenButtonLabel).toBe('Send it to me')
    expect(el.leadGenMessage).toContain('Thanks')
    expect(el.leadGenSuccessText).toBe('Check your inbox! 📬')
    expect(el.leadGenCollectName).toBe(false)
    expect(el.leadGenFileUrl).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- src/lib/types/lead-gen-element.test.ts`
Expected: FAIL — `'lead-gen'` not assignable to `ElementType` (tsc) / defaults undefined.

- [ ] **Step 3: Add the type to the union**

In `src/lib/types/canvas.ts`, in the `ElementType` union just after `| 'product-list'` (~line 157):

```ts
  | 'product-list'
  | 'lead-gen'               // Commerce: email-for-freebie lead magnet
```

- [ ] **Step 4: Add the fields to `CanvasElement`**

In `src/lib/types/canvas.ts`, after the Product List block (after `products?: Product[]`, ~line 326):

```ts
  // Lead Gen specific (email-for-freebie; content resolved server-side on submit)
  leadGenHeadline?: string
  leadGenButtonLabel?: string
  leadGenMessage?: string       // preset body emailed to the visitor
  leadGenFileUrl?: string       // Blob URL of the delivered file (optional)
  leadGenFileName?: string      // display name for the download link
  leadGenSuccessText?: string   // shown on the page after submit
  leadGenCollectName?: boolean  // collect an optional name field
```

- [ ] **Step 5: Add the `createElement` default**

In `src/lib/types/canvas.ts`, in the `createElement` switch after the `case 'product-list':` block (~line 1312):

```ts
    case 'lead-gen':
      return {
        ...base,
        leadGenHeadline: 'Get my free guide',
        leadGenButtonLabel: 'Send it to me',
        leadGenMessage: "Thanks for your interest! Here's what I promised — enjoy.",
        leadGenSuccessText: 'Check your inbox! 📬',
        leadGenCollectName: false,
      }
```

- [ ] **Step 6: Run test to verify it passes**

Run: `pnpm test -- src/lib/types/lead-gen-element.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/types/canvas.ts src/lib/types/lead-gen-element.test.ts
git commit -m "feat(lead-gen): add lead-gen element type + defaults"
```

---

### Task 2: Pure helpers — email validation + element resolver (`src/lib/lead-gen.ts`)

**Files:**
- Create: `src/lib/lead-gen.ts`
- Test: `src/lib/lead-gen.test.ts`

**Interfaces:**
- Produces:
  - `isValidEmail(email: string): boolean`
  - `interface LeadGenNode { id: string; type: string; leadGenMessage?: string; leadGenFileUrl?: string; leadGenFileName?: string; leadGenCollectName?: boolean }`
  - `findLeadGenElement(json: unknown, elementId: string): LeadGenNode | null` — deep-walks display JSON for a `lead-gen` element with the given id (mirrors `findMailboxElement` in `api/messages/route.ts`).

- [ ] **Step 1: Write the failing test**

Create `src/lib/lead-gen.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { isValidEmail, findLeadGenElement } from './lead-gen'

describe('isValidEmail', () => {
  it('accepts normal addresses', () => {
    expect(isValidEmail('a@b.com')).toBe(true)
    expect(isValidEmail('sarah.jones+news@example.co.uk')).toBe(true)
  })
  it('rejects malformed addresses', () => {
    for (const bad of ['', 'nope', 'a@', '@b.com', 'a b@c.com', 'a@b']) {
      expect(isValidEmail(bad)).toBe(false)
    }
  })
})

describe('findLeadGenElement', () => {
  const display = {
    sections: [
      { columns: [ { elements: [
        { id: 'x', type: 'text' },
        { id: 'lg1', type: 'lead-gen', leadGenMessage: 'hi', leadGenFileUrl: 'https://blob/x.pdf', leadGenFileName: 'x.pdf' },
      ] } ] },
    ],
  }
  it('finds a lead-gen element by id', () => {
    const el = findLeadGenElement(display.sections, 'lg1')
    expect(el?.leadGenMessage).toBe('hi')
    expect(el?.leadGenFileName).toBe('x.pdf')
  })
  it('returns null for an unknown id', () => {
    expect(findLeadGenElement(display.sections, 'nope')).toBeNull()
  })
  it('does not match a same-id element of a different type', () => {
    expect(findLeadGenElement(display.sections, 'x')).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- src/lib/lead-gen.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

Create `src/lib/lead-gen.ts`:

```ts
// Pure helpers for the Lead Gen element. No DB / no Next imports — safe to unit test.

// Deliberately conservative: one @, non-empty local part, a dotted domain.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function isValidEmail(email: string): boolean {
  return typeof email === 'string' && email.length <= 254 && EMAIL_RE.test(email.trim())
}

export interface LeadGenNode {
  id: string
  type: string
  leadGenMessage?: string
  leadGenFileUrl?: string
  leadGenFileName?: string
  leadGenCollectName?: boolean
}

// Deep-walk arbitrary display JSON (sections or tabs) for a `lead-gen` element.
export function findLeadGenElement(json: unknown, elementId: string): LeadGenNode | null {
  let found: LeadGenNode | null = null
  const walk = (node: unknown) => {
    if (found) return
    if (Array.isArray(node)) { node.forEach(walk); return }
    if (node && typeof node === 'object') {
      const obj = node as Record<string, unknown>
      if (obj.type === 'lead-gen' && obj.id === elementId) { found = obj as unknown as LeadGenNode; return }
      for (const v of Object.values(obj)) walk(v)
    }
  }
  walk(json)
  return found
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- src/lib/lead-gen.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/lead-gen.ts src/lib/lead-gen.test.ts
git commit -m "feat(lead-gen): pure email-validation + element-resolver helpers"
```

---

### Task 3: Email builder `leadGenEmail()` (`src/lib/email.ts`)

**Files:**
- Modify: `src/lib/email.ts` (add export near the other builders)
- Test: `src/lib/lead-gen-email.test.ts`

**Interfaces:**
- Consumes: `escapeHtml` (already exported from `email.ts`).
- Produces: `leadGenEmail(a: { name?: string; message: string; fileUrl?: string; fileName?: string }): { subject: string; html: string }`.

- [ ] **Step 1: Write the failing test**

Create `src/lib/lead-gen-email.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { leadGenEmail } from './email'

describe('leadGenEmail', () => {
  it('includes the preset message and a download button when a file is present', () => {
    const { subject, html } = leadGenEmail({
      name: 'Sarah', message: 'Enjoy the <guide>!', fileUrl: 'https://blob/x.pdf', fileName: 'guide.pdf',
    })
    expect(subject).toBeTruthy()
    expect(html).toContain('Hi Sarah')
    expect(html).toContain('https://blob/x.pdf')
    expect(html).toContain('guide.pdf')
    // message HTML-escaped
    expect(html).toContain('Enjoy the &lt;guide&gt;!')
    expect(html).not.toContain('Enjoy the <guide>!')
  })

  it('omits the download button when there is no file', () => {
    const { html } = leadGenEmail({ message: 'Here is your code: SAVE10' })
    expect(html).toContain('SAVE10')
    expect(html).not.toContain('href="https://blob')
  })

  it('greets generically when no name is given', () => {
    const { html } = leadGenEmail({ message: 'x' })
    expect(html).toContain('Hi there')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- src/lib/lead-gen-email.test.ts`
Expected: FAIL — `leadGenEmail` not exported.

- [ ] **Step 3: Write the implementation**

In `src/lib/email.ts`, after the `bookingConfirmedEmail` export, add:

```ts
interface LeadGenArgs { name?: string; message: string; fileUrl?: string; fileName?: string }

export function leadGenEmail(a: LeadGenArgs) {
  const greeting = a.name ? `Hi ${escapeHtml(a.name)}` : 'Hi there'
  const body = escapeHtml(a.message).replace(/\n/g, '<br/>')
  const download = a.fileUrl
    ? `<a href="${a.fileUrl}" style="display:inline-block;margin-top:16px;background:#39D98A;color:#fff;padding:10px 20px;border-radius:9999px;text-decoration:none;font-weight:600">Download ${escapeHtml(a.fileName || 'your file')}</a>`
    : ''
  return {
    subject: 'Your download from My Galli',
    html: `<div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:24px">
      <p style="color:#0F3D2E;font-size:16px;font-weight:600">${greeting},</p>
      <p style="color:#475569;font-size:14px;line-height:1.6">${body}</p>
      ${download}
      <p style="color:#94a3b8;font-size:12px;margin-top:24px">Sent via My Galli.</p>
    </div>`,
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- src/lib/lead-gen-email.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/email.ts src/lib/lead-gen-email.test.ts
git commit -m "feat(lead-gen): leadGenEmail() builder"
```

---

### Task 4: `LeadCapture` model + migration

**Files:**
- Modify: `prisma/schema.prisma` (add `LeadCapture` model; add back-relation on `Display`)
- Create: `prisma/migrations/20260717000000_lead_capture/migration.sql`

**Interfaces:**
- Produces: `db.leadCapture` with fields `id, displayId, elementId, email, name?, delivered, ipHash?, createdAt`; `Display.leadCaptures`.

- [ ] **Step 1: Add the model to the schema**

In `prisma/schema.prisma`, add:

```prisma
model LeadCapture {
  id         String   @id @default(cuid())
  displayId  String
  elementId  String
  email      String
  name       String?
  delivered  Boolean  @default(false)
  ipHash     String?
  createdAt  DateTime @default(now())

  display    Display  @relation(fields: [displayId], references: [id], onDelete: Cascade)

  @@index([displayId, elementId])
  @@index([displayId, createdAt])
}
```

- [ ] **Step 2: Add the back-relation on `Display`**

In `prisma/schema.prisma`, inside `model Display`, add alongside the other relation lists (e.g. near `formResponses` / `messages` if present):

```prisma
  leadCaptures LeadCapture[]
```

- [ ] **Step 3: Hand-author the migration SQL**

Create `prisma/migrations/20260717000000_lead_capture/migration.sql` with ONLY this table (do not `migrate diff` — the shared dev DB is contaminated):

```sql
-- CreateTable
CREATE TABLE "LeadCapture" (
    "id" TEXT NOT NULL,
    "displayId" TEXT NOT NULL,
    "elementId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "delivered" BOOLEAN NOT NULL DEFAULT false,
    "ipHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadCapture_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LeadCapture_displayId_elementId_idx" ON "LeadCapture"("displayId", "elementId");

-- CreateIndex
CREATE INDEX "LeadCapture_displayId_createdAt_idx" ON "LeadCapture"("displayId", "createdAt");

-- AddForeignKey
ALTER TABLE "LeadCapture" ADD CONSTRAINT "LeadCapture_displayId_fkey" FOREIGN KEY ("displayId") REFERENCES "Display"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

- [ ] **Step 4: Apply the migration + regenerate the client (dev DB)**

Run (Git Bash; inline env — 127.0.0.1, port 5434):

```bash
DATABASE_URL="postgresql://pages:pages@127.0.0.1:5434/pages" \
DATABASE_URL_UNPOOLED="postgresql://pages:pages@127.0.0.1:5434/pages" \
pnpm prisma migrate deploy
DATABASE_URL="postgresql://pages:pages@127.0.0.1:5434/pages" \
DATABASE_URL_UNPOOLED="postgresql://pages:pages@127.0.0.1:5434/pages" \
pnpm prisma generate
```

Expected: migrate deploy reports the `20260717000000_lead_capture` migration applied; generate succeeds. (If `prisma generate` EPERMs on Windows because dev holds the engine DLL, stop `next dev` and retry — non-blocking.)

- [ ] **Step 5: Verify the model is queryable**

Run:

```bash
DATABASE_URL="postgresql://pages:pages@127.0.0.1:5434/pages" \
DATABASE_URL_UNPOOLED="postgresql://pages:pages@127.0.0.1:5434/pages" \
node -e "const{PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.leadCapture.count().then(n=>{console.log('leadCapture rows:',n);process.exit(0)}).catch(e=>{console.error(e);process.exit(1)})"
```

Expected: prints `leadCapture rows: 0` (table exists, no error).

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260717000000_lead_capture/
git commit -m "feat(lead-gen): LeadCapture model + migration"
```

---

### Task 5: Submit route `POST /api/lead-gen/[displayId]`

**Files:**
- Create: `src/app/api/lead-gen/[displayId]/route.ts`
- Test: `src/app/api/lead-gen/[displayId]/route.test.ts`

**Interfaces:**
- Consumes: `isValidEmail`, `findLeadGenElement` (Task 2); `leadGenEmail` + `sendEmail` (Task 3 / existing); `db.display.findUnique`, `db.leadCapture.create/update` (Task 4); `rateLimit`, `getJwtSecret`.
- Produces: `POST(request, { params })`. Request body `{ elementId, email, name?, hp? }`. On success returns `{ ok: true, fileUrl?, fileName? }` (200). Honeypot `hp` non-empty → silent `{ ok: true }`.

- [ ] **Step 1: Write the failing test**

Create `src/app/api/lead-gen/[displayId]/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/rate-limit', () => ({ rateLimit: vi.fn().mockResolvedValue(null) }))
vi.mock('@/lib/db', () => ({
  db: { display: { findUnique: vi.fn() }, leadCapture: { create: vi.fn(), update: vi.fn() } },
}))
vi.mock('@/lib/email', () => ({ sendEmail: vi.fn().mockResolvedValue(undefined), leadGenEmail: vi.fn().mockReturnValue({ subject: 's', html: 'h' }) }))

import { db } from '@/lib/db'
import { sendEmail } from '@/lib/email'
import { POST } from './route'

const ctx = { params: Promise.resolve({ displayId: 'd1' }) }
const req = (body: unknown) => new Request('http://localhost/api/lead-gen/d1', { method: 'POST', body: JSON.stringify(body) }) as any

const DISPLAY = {
  id: 'd1', published: true,
  sections: [{ columns: [{ elements: [
    { id: 'lg1', type: 'lead-gen', leadGenMessage: 'hi', leadGenFileUrl: 'https://blob/x.pdf', leadGenFileName: 'x.pdf' },
  ] }] }],
  tabs: null,
}

beforeEach(() => {
  vi.clearAllMocks()
  ;(db.display.findUnique as any).mockResolvedValue(DISPLAY)
  ;(db.leadCapture.create as any).mockResolvedValue({ id: 'lc1' })
  ;(db.leadCapture.update as any).mockResolvedValue({ id: 'lc1' })
})

describe('POST /api/lead-gen/[displayId]', () => {
  it('stores a lead, sends the email, and returns the file link', async () => {
    const res = await POST(req({ elementId: 'lg1', email: 'a@b.com', name: 'Sarah' }), ctx)
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ ok: true, fileUrl: 'https://blob/x.pdf', fileName: 'x.pdf' })
    const lead = (db.leadCapture.create as any).mock.calls[0][0].data
    expect(lead).toMatchObject({ displayId: 'd1', elementId: 'lg1', email: 'a@b.com', name: 'Sarah' })
    expect(sendEmail).toHaveBeenCalledTimes(1)
    expect((db.leadCapture.update as any).mock.calls[0][0].data).toMatchObject({ delivered: true })
  })

  it('rejects a malformed email without storing or sending', async () => {
    const res = await POST(req({ elementId: 'lg1', email: 'nope' }), ctx)
    expect(res.status).toBe(400)
    expect(db.leadCapture.create).not.toHaveBeenCalled()
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it('404s on an unpublished display', async () => {
    ;(db.display.findUnique as any).mockResolvedValue({ ...DISPLAY, published: false })
    const res = await POST(req({ elementId: 'lg1', email: 'a@b.com' }), ctx)
    expect(res.status).toBe(404)
  })

  it('rejects an unknown elementId (no matching lead-gen element)', async () => {
    const res = await POST(req({ elementId: 'ghost', email: 'a@b.com' }), ctx)
    expect(res.status).toBe(400)
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it('silently accepts a filled honeypot without storing', async () => {
    const res = await POST(req({ elementId: 'lg1', email: 'a@b.com', hp: 'bot' }), ctx)
    expect(res.status).toBe(200)
    expect(db.leadCapture.create).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- src/app/api/lead-gen/[displayId]/route.test.ts`
Expected: FAIL — route module not found.

- [ ] **Step 3: Write the route**

Create `src/app/api/lead-gen/[displayId]/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { db } from '@/lib/db'
import { getJwtSecret } from '@/lib/auth'
import { rateLimit } from '@/lib/rate-limit'
import { isValidEmail, findLeadGenElement } from '@/lib/lead-gen'
import { sendEmail, leadGenEmail } from '@/lib/email'

interface Props { params: Promise<{ displayId: string }> }

export async function POST(request: NextRequest, { params }: Props) {
  const limited = await rateLimit(request, { limit: 30, windowMs: 60_000, prefix: 'lead-gen' })
  if (limited) return limited

  const { displayId } = await params

  let b: Record<string, unknown>
  try { b = await request.json() } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }

  // Honeypot: silently accept, do not persist.
  if (typeof b.hp === 'string' && b.hp.trim() !== '') return NextResponse.json({ ok: true })

  const elementId = String(b.elementId ?? '')
  const email = String(b.email ?? '').trim()
  const name = typeof b.name === 'string' ? b.name.trim() : ''

  if (!elementId) return NextResponse.json({ error: 'Missing element' }, { status: 400 })
  if (!isValidEmail(email)) return NextResponse.json({ error: 'Invalid email' }, { status: 400 })

  const display = await db.display.findUnique({
    where: { id: displayId },
    select: { id: true, published: true, sections: true, tabs: true },
  })
  if (!display || !display.published) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const el = findLeadGenElement(display.sections, elementId) || findLeadGenElement(display.tabs, elementId)
  if (!el) return NextResponse.json({ error: 'No such element' }, { status: 400 })

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const ipHash = createHash('sha256').update(ip + getJwtSecret()).digest('hex').substring(0, 16)

  const lead = await db.leadCapture.create({
    data: { displayId, elementId, email, name: name || null, ipHash },
  })

  try {
    const { subject, html } = leadGenEmail({
      name: name || undefined,
      message: el.leadGenMessage || 'Thanks!',
      fileUrl: el.leadGenFileUrl,
      fileName: el.leadGenFileName,
    })
    await sendEmail({ to: email, subject, html })
    await db.leadCapture.update({ where: { id: lead.id }, data: { delivered: true } })
  } catch (err) {
    console.error('lead-gen delivery failed:', err)
    // Lead is still captured; leave delivered=false.
  }

  return NextResponse.json({ ok: true, fileUrl: el.leadGenFileUrl, fileName: el.leadGenFileName })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- src/app/api/lead-gen/[displayId]/route.test.ts`
Expected: PASS (all 5).

- [ ] **Step 5: Commit**

```bash
git add "src/app/api/lead-gen/[displayId]/route.ts" "src/app/api/lead-gen/[displayId]/route.test.ts"
git commit -m "feat(lead-gen): public submit route (server-resolved content + delivery)"
```

---

### Task 6: Editor component `LeadGenElement.tsx`

**Files:**
- Create: `src/components/elements/LeadGenElement.tsx`

**Interfaces:**
- Consumes: `CanvasElement`, standard editor props `{ element, onChange, onDelete, isSelected, onSelect }` (match `ProductListElement` signature).
- Produces: `export function LeadGenElement(props)` — edits `leadGenHeadline`, `leadGenButtonLabel`, `leadGenMessage`, `leadGenSuccessText`, `leadGenCollectName`, and uploads a file to set `leadGenFileUrl` + `leadGenFileName`.

- [ ] **Step 1: Write the component**

Create `src/components/elements/LeadGenElement.tsx` (upload helper mirrors `AudioPlayerElement`; file input accepts images + PDF per the upload allowlist):

```tsx
'use client'

import { useRef, useState } from 'react'
import type { CanvasElement } from '@/lib/types/canvas'

interface Props {
  element: CanvasElement
  onChange: (updates: Partial<CanvasElement>) => void
  onDelete: () => void
  isSelected: boolean
  onSelect: () => void
}

async function uploadFile(file: File): Promise<{ url: string; name: string }> {
  const fd = new FormData()
  fd.append('file', file)
  const res = await fetch('/api/upload', { method: 'POST', body: fd })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || 'Upload failed')
  }
  const data = await res.json()
  return { url: data.url as string, name: file.name }
}

export function LeadGenElement({ element, onChange, onDelete, isSelected, onSelect }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleFile = async (file: File) => {
    setError(null); setUploading(true)
    try {
      const { url, name } = await uploadFile(file)
      onChange({ leadGenFileUrl: url, leadGenFileName: name })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div
      onClick={onSelect}
      className={`rounded-xl border p-4 space-y-3 ${isSelected ? 'border-galli ring-1 ring-galli' : 'border-slate-200'}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Lead Gen</span>
        <button onClick={onDelete} className="text-xs text-red-500 hover:underline">Delete</button>
      </div>

      <input
        value={element.leadGenHeadline || ''}
        onChange={(e) => onChange({ leadGenHeadline: e.target.value })}
        placeholder="Headline (e.g. Get my free press kit)"
        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
      />

      <textarea
        value={element.leadGenMessage || ''}
        onChange={(e) => onChange({ leadGenMessage: e.target.value })}
        placeholder="Message emailed to the visitor (add a link or discount code here)"
        rows={3}
        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
      />

      <div className="space-y-1">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium hover:bg-slate-200 disabled:opacity-60"
        >
          {uploading ? 'Uploading…' : element.leadGenFileUrl ? `Replace file (${element.leadGenFileName})` : 'Attach a file (PDF or image, optional)'}
        </button>
        {element.leadGenFileUrl && (
          <button
            type="button"
            onClick={() => onChange({ leadGenFileUrl: undefined, leadGenFileName: undefined })}
            className="ml-2 text-xs text-slate-500 hover:underline"
          >
            Remove file
          </button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp,application/pdf"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = '' }}
        />
        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <input
          value={element.leadGenButtonLabel || ''}
          onChange={(e) => onChange({ leadGenButtonLabel: e.target.value })}
          placeholder="Button label"
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />
        <input
          value={element.leadGenSuccessText || ''}
          onChange={(e) => onChange({ leadGenSuccessText: e.target.value })}
          placeholder="Success message"
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />
      </div>

      <label className="flex items-center gap-2 text-sm text-slate-600">
        <input
          type="checkbox"
          checked={element.leadGenCollectName ?? false}
          onChange={(e) => onChange({ leadGenCollectName: e.target.checked })}
        />
        Also collect the visitor&apos;s name
      </label>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck the new component**

Run: `pnpm exec tsc --noEmit`
Expected: no errors referencing `LeadGenElement.tsx`. (Unused-import or prop-shape errors here are real — fix before continuing.)

- [ ] **Step 3: Commit**

```bash
git add src/components/elements/LeadGenElement.tsx
git commit -m "feat(lead-gen): editor component"
```

---

### Task 7: Public component `PublicLeadGenElement.tsx`

**Files:**
- Create: `src/components/elements/PublicLeadGenElement.tsx`
- Test: `src/components/elements/PublicLeadGenElement.test.tsx`

**Interfaces:**
- Consumes: `CanvasElement`; posts to `/api/lead-gen/${displayId}` with `{ elementId, email, name?, hp }`.
- Produces: `export function PublicLeadGenElement({ element, displayId }: { element: CanvasElement; displayId: string })`. On success shows `leadGenSuccessText` + an inline download link when the response returns `fileUrl`.

- [ ] **Step 1: Write the failing test**

Create `src/components/elements/PublicLeadGenElement.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { PublicLeadGenElement } from './PublicLeadGenElement'
import type { CanvasElement } from '@/lib/types/canvas'

function el(over: Partial<CanvasElement> = {}): CanvasElement {
  return {
    id: 'lg1', type: 'lead-gen',
    leadGenHeadline: 'Get my guide', leadGenButtonLabel: 'Send it',
    leadGenSuccessText: 'Check your inbox!', ...over,
  } as CanvasElement
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true, status: 200, json: async () => ({ ok: true, fileUrl: 'https://blob/x.pdf', fileName: 'guide.pdf' }),
  }))
})
afterEach(() => vi.unstubAllGlobals())

describe('PublicLeadGenElement', () => {
  it('renders the headline and an email field but no name field by default', () => {
    render(<PublicLeadGenElement element={el()} displayId="d1" />)
    expect(screen.getByText('Get my guide')).toBeTruthy()
    expect(screen.getByPlaceholderText(/email/i)).toBeTruthy()
    expect(screen.queryByPlaceholderText(/name/i)).toBeNull()
  })

  it('shows the name field when leadGenCollectName is set', () => {
    render(<PublicLeadGenElement element={el({ leadGenCollectName: true })} displayId="d1" />)
    expect(screen.getByPlaceholderText(/name/i)).toBeTruthy()
  })

  it('submits the email and shows the success text + download link', async () => {
    render(<PublicLeadGenElement element={el()} displayId="d1" />)
    fireEvent.change(screen.getByPlaceholderText(/email/i), { target: { value: 'a@b.com' } })
    fireEvent.click(screen.getByRole('button', { name: /send it/i }))
    await waitFor(() => expect(screen.getByText('Check your inbox!')).toBeTruthy())
    const link = screen.getByRole('link', { name: /guide\.pdf|download/i }) as HTMLAnchorElement
    expect(link.href).toContain('https://blob/x.pdf')
    const call = (fetch as any).mock.calls.find((c: any[]) => String(c[0]).includes('/api/lead-gen/d1'))
    expect(JSON.parse(call[1].body)).toMatchObject({ elementId: 'lg1', email: 'a@b.com' })
  })

  it('does not submit an empty email', () => {
    render(<PublicLeadGenElement element={el()} displayId="d1" />)
    fireEvent.click(screen.getByRole('button', { name: /send it/i }))
    const called = (fetch as any).mock.calls.some((c: any[]) => String(c[0]).includes('/api/lead-gen'))
    expect(called).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- src/components/elements/PublicLeadGenElement.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the component**

Create `src/components/elements/PublicLeadGenElement.tsx`:

```tsx
'use client'

import { useState } from 'react'
import type { CanvasElement } from '@/lib/types/canvas'
import { isValidEmail } from '@/lib/lead-gen'

export function PublicLeadGenElement({ element, displayId }: { element: CanvasElement; displayId: string }) {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [hp, setHp] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'done' | 'error'>('idle')
  const [file, setFile] = useState<{ url?: string; name?: string }>({})

  const collectName = element.leadGenCollectName ?? false

  const submit = async () => {
    if (!isValidEmail(email) || status === 'sending') return
    setStatus('sending')
    try {
      const res = await fetch(`/api/lead-gen/${displayId}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ elementId: element.id, email: email.trim(), name: collectName ? name.trim() : undefined, hp }),
      })
      if (!res.ok) { setStatus('error'); return }
      const data = await res.json().catch(() => ({}))
      setFile({ url: data.fileUrl, name: data.fileName })
      setStatus('done')
    } catch {
      setStatus('error')
    }
  }

  if (status === 'done') {
    return (
      <div className="rounded-xl border border-slate-200 p-5 text-center space-y-3">
        <p className="text-base font-semibold text-galli-anchor">{element.leadGenSuccessText || 'Check your inbox! 📬'}</p>
        {file.url && (
          <a
            href={file.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block rounded-full bg-galli px-5 py-2 text-sm font-semibold text-white"
          >
            Download {file.name || 'your file'}
          </a>
        )}
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-slate-200 p-5 space-y-3">
      {element.leadGenHeadline && <h3 className="text-lg font-semibold text-galli-anchor">{element.leadGenHeadline}</h3>}

      {/* Honeypot: hidden from users, catches bots. */}
      <input
        name="hp" value={hp} onChange={(e) => setHp(e.target.value)}
        tabIndex={-1} autoComplete="off" aria-hidden="true"
        className="hidden" style={{ display: 'none' }}
      />

      {collectName && (
        <input
          value={name} onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />
      )}
      <input
        type="email" value={email} onChange={(e) => setEmail(e.target.value)}
        placeholder="Your email"
        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
      />
      <button
        type="button" onClick={submit} disabled={status === 'sending'}
        className="w-full rounded-full bg-galli px-5 py-2 text-sm font-semibold text-white disabled:opacity-60"
      >
        {status === 'sending' ? 'Sending…' : element.leadGenButtonLabel || 'Send it to me'}
      </button>
      {status === 'error' && <p className="text-xs text-red-500">Something went wrong. Please try again.</p>}
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- src/components/elements/PublicLeadGenElement.test.tsx`
Expected: PASS (all 4).

- [ ] **Step 5: Commit**

```bash
git add src/components/elements/PublicLeadGenElement.tsx src/components/elements/PublicLeadGenElement.test.tsx
git commit -m "feat(lead-gen): public component (form + inline download on success)"
```

---

### Task 8: Wire the remaining seams (slash menu, canvas, index, render)

**Files:**
- Modify: `src/components/canvas/SlashCommandMenu.tsx` (add command)
- Modify: `src/components/canvas/ColumnCanvas.tsx` (imports + render case)
- Modify: `src/components/elements/index.ts` (exports)
- Modify: `src/lib/render-elements.tsx` (import + render case)
- Test: `src/lib/render-elements.lead-gen.test.tsx`

**Interfaces:**
- Consumes: `LeadGenElement` (Task 6), `PublicLeadGenElement` (Task 7).
- Produces: `lead-gen` is buildable from the slash menu and renders public/editor everywhere.

- [ ] **Step 1: Write the failing test**

Create `src/lib/render-elements.lead-gen.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { renderElement } from './render-elements'
import type { CanvasElement } from '@/lib/types/canvas'

describe('renderElement — lead-gen', () => {
  it('renders the public lead-gen component with its headline', () => {
    const el = { id: 'lg1', type: 'lead-gen', leadGenHeadline: 'Grab it' } as CanvasElement
    render(<>{renderElement(el, 'd1')}</>)
    expect(screen.getByText('Grab it')).toBeTruthy()
    expect(screen.getByPlaceholderText(/email/i)).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- src/lib/render-elements.lead-gen.test.tsx`
Expected: FAIL — `lead-gen` falls through to the default (no email field rendered).

- [ ] **Step 3: Add the slash-menu command**

In `src/components/canvas/SlashCommandMenu.tsx`: add `Gift` to the existing `lucide-react` import, then add a command right after the `product-list` entry:

```tsx
  { id: 'lead-gen', label: 'Lead Gen', icon: Gift, description: 'Collect emails and auto-send a file or message', category: 'Commerce' },
```

(`'Commerce'` is already in `CATEGORY_ORDER` — no change needed there.)

- [ ] **Step 4: Add exports to the elements barrel**

In `src/components/elements/index.ts`, after the `ProductListElement` exports:

```ts
export { LeadGenElement } from './LeadGenElement'
export { PublicLeadGenElement } from './PublicLeadGenElement'
```

- [ ] **Step 5: Add the render-elements case**

In `src/lib/render-elements.tsx`: add the import near the other Public element imports:

```tsx
import { PublicLeadGenElement } from '@/components/elements/PublicLeadGenElement'
```

Then add a case in `renderElement`, next to `case 'product-list':`:

```tsx
    case 'lead-gen':
      return <PublicLeadGenElement element={element} displayId={displayId || ''} />
```

- [ ] **Step 6: Add the ColumnCanvas case**

In `src/components/canvas/ColumnCanvas.tsx`: add imports near the ProductList imports:

```tsx
import { LeadGenElement } from '@/components/elements/LeadGenElement'
import { PublicLeadGenElement } from '@/components/elements/PublicLeadGenElement'
```

Then add a case next to `case 'product-list':` in `renderElement`:

```tsx
      case 'lead-gen':
        if (isPreviewMode) {
          return <PublicLeadGenElement element={element} displayId={displayId || ''} />
        }
        return (
          <LeadGenElement
            element={element}
            onChange={(updates) => onUpdateElement(sectionId, columnId, element.id, updates)}
            onDelete={() => onDeleteElement(sectionId, columnId, element.id)}
            isSelected={commonProps.isSelected}
            onSelect={commonProps.onSelect}
          />
        )
```

(If `displayId` is not already in scope inside `ColumnCanvas.renderElement`, use the same source the `comment`/`poll`/`tracker` preview cases use — they reference `displayId` there, so it is available.)

- [ ] **Step 7: Run the render test + the slash-menu test suite**

Run: `pnpm test -- src/lib/render-elements.lead-gen.test.tsx src/components/canvas/SlashCommandMenu.test.tsx`
Expected: PASS. (The existing SlashCommandMenu test should still pass; if it asserts a command count, update that count.)

- [ ] **Step 8: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add src/components/canvas/SlashCommandMenu.tsx src/components/canvas/ColumnCanvas.tsx src/components/elements/index.ts src/lib/render-elements.tsx src/lib/render-elements.lead-gen.test.tsx
git commit -m "feat(lead-gen): wire slash menu, canvas, index, and public render"
```

---

### Task 9: Data-tab leads analytics (route extension + card)

**Files:**
- Modify: `src/app/api/analytics/[displayId]/elements/route.ts` (include `lead-gen`; attach lead aggregation)
- Create: `src/components/analytics/element-cards/LeadGenCard.tsx`
- Modify: `src/components/analytics/element-cards/index.ts` (export)
- Modify: `src/components/analytics/ElementsTab.tsx` (import + switch case)
- Test: `src/app/api/analytics/[displayId]/elements/lead-gen.test.ts`

**Interfaces:**
- Consumes: `db.leadCapture.findMany` (Task 4); the route's existing `extractInteractiveElements` + ownership check.
- Produces: each `lead-gen` element in the analytics payload carries `leads: { total: number; delivered: number; recent: Array<{ email: string; name: string | null; delivered: boolean; createdAt: string }> }`. `LeadGenCard` renders it.

- [ ] **Step 1: Write the failing test**

Create `src/app/api/analytics/[displayId]/elements/lead-gen.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({ getUser: vi.fn() }))
vi.mock('@/lib/db', () => ({
  db: { display: { findUnique: vi.fn() }, leadCapture: { findMany: vi.fn() } },
}))

import { getUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { GET } from './route'

const ctx = { params: Promise.resolve({ displayId: 'd1' }) }
const getReq = () => new Request('http://localhost/api/analytics/d1/elements', { method: 'GET' }) as any

beforeEach(() => {
  vi.clearAllMocks()
  ;(getUser as any).mockResolvedValue({ id: 'owner' })
  ;(db.display.findUnique as any).mockResolvedValue({
    id: 'd1', userId: 'owner', title: 'T',
    sections: [{ columns: [{ elements: [{ id: 'lg1', type: 'lead-gen', leadGenHeadline: 'Guide' }] }] }],
    tabs: null,
  })
  ;(db.leadCapture.findMany as any).mockResolvedValue([
    { elementId: 'lg1', email: 'a@b.com', name: 'A', delivered: true, createdAt: new Date('2026-07-17T00:00:00Z') },
    { elementId: 'lg1', email: 'c@d.com', name: null, delivered: false, createdAt: new Date('2026-07-17T01:00:00Z') },
  ])
})

describe('GET /api/analytics/[displayId]/elements — lead-gen', () => {
  it('includes a lead-gen element with aggregated leads', async () => {
    const res = await GET(getReq(), ctx)
    expect(res.status).toBe(200)
    const body = await res.json()
    const lg = body.elements.find((e: any) => e.type === 'lead-gen')
    expect(lg).toBeTruthy()
    expect(lg.leads.total).toBe(2)
    expect(lg.leads.delivered).toBe(1)
    expect(lg.leads.recent[0].email).toBeTruthy()
  })
})
```

(If the route's JSON shape uses a key other than `elements`/`elementId`/`type`, adjust the assertions to match — check the existing return object before writing.)

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- "src/app/api/analytics/[displayId]/elements/lead-gen.test.ts"`
Expected: FAIL — no `lead-gen` element in the payload.

- [ ] **Step 3: Extend the analytics route**

In `src/app/api/analytics/[displayId]/elements/route.ts`:

1. Add `'lead-gen'` to the `INTERACTIVE_TYPES` tuple.
2. After the interactive elements are extracted and the display is confirmed owned, query and group leads. Add near where the response is assembled:

```ts
// Lead Gen: attach captured-lead aggregates per element.
const leadElementIds = interactiveElements.filter((e) => e.type === 'lead-gen').map((e) => e.id)
if (leadElementIds.length > 0) {
  const rows = await db.leadCapture.findMany({
    where: { displayId, elementId: { in: leadElementIds } },
    orderBy: { createdAt: 'desc' },
  })
  const byElement = new Map<string, typeof rows>()
  for (const r of rows) {
    const list = byElement.get(r.elementId) || []
    list.push(r)
    byElement.set(r.elementId, list)
  }
  for (const el of interactiveElements) {
    if (el.type !== 'lead-gen') continue
    const list = byElement.get(el.id) || []
    ;(el as Record<string, unknown>).leads = {
      total: list.length,
      delivered: list.filter((r) => r.delivered).length,
      recent: list.slice(0, 50).map((r) => ({
        email: r.email, name: r.name, delivered: r.delivered, createdAt: r.createdAt.toISOString(),
      })),
    }
  }
}
```

(Map the attachment onto whatever object the route already returns per element — if it returns a transformed shape rather than the raw `interactiveElements`, attach `leads` to that transformed object instead. Read the route's existing return construction first and mirror it.)

- [ ] **Step 4: Run the route test to verify it passes**

Run: `pnpm test -- "src/app/api/analytics/[displayId]/elements/lead-gen.test.ts"`
Expected: PASS.

- [ ] **Step 5: Create the card component**

Create `src/components/analytics/element-cards/LeadGenCard.tsx`:

```tsx
interface LeadRow { email: string; name: string | null; delivered: boolean; createdAt: string }
interface LeadGenData {
  elementId: string
  config?: { leadGenHeadline?: string }
  leads?: { total: number; delivered: number; recent: LeadRow[] }
}

export function LeadGenCard({ data }: { data: LeadGenData }) {
  const leads = data.leads ?? { total: 0, delivered: 0, recent: [] }
  const title = data.config?.leadGenHeadline || 'Lead Gen'
  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-slate-800">{title}</h4>
        <span className="text-sm text-slate-500">{leads.total} lead{leads.total === 1 ? '' : 's'} · {leads.delivered} delivered</span>
      </div>
      {leads.recent.length === 0 ? (
        <p className="mt-3 text-sm text-slate-400">No leads captured yet.</p>
      ) : (
        <ul className="mt-3 divide-y divide-slate-100">
          {leads.recent.map((l, i) => (
            <li key={i} className="flex items-center justify-between py-2 text-sm">
              <span className="text-slate-700">{l.name ? `${l.name} · ` : ''}{l.email}</span>
              <span className={l.delivered ? 'text-galli' : 'text-amber-500'}>
                {l.delivered ? 'delivered' : 'pending'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
```

- [ ] **Step 6: Export the card + wire it into `ElementsTab`**

In `src/components/analytics/element-cards/index.ts`:

```ts
export { LeadGenCard } from './LeadGenCard'
```

In `src/components/analytics/ElementsTab.tsx`: add `LeadGenCard` to the `element-cards` import list, then add a case in the `switch (element.type)`:

```tsx
          case 'lead-gen':
            return <LeadGenCard key={element.elementId} data={element} />
```

- [ ] **Step 7: Typecheck + run the analytics suite**

Run: `pnpm exec tsc --noEmit && pnpm test -- src/app/api/analytics src/components/analytics`
Expected: no type errors; analytics tests pass.

- [ ] **Step 8: Commit**

```bash
git add "src/app/api/analytics/[displayId]/elements/route.ts" "src/app/api/analytics/[displayId]/elements/lead-gen.test.ts" src/components/analytics/element-cards/LeadGenCard.tsx src/components/analytics/element-cards/index.ts src/components/analytics/ElementsTab.tsx
git commit -m "feat(lead-gen): surface captured leads in the Data tab"
```

---

### Task 10: Full verification + browser smoke

**Files:** none (verification only)

- [ ] **Step 1: Full test suite**

Run: `pnpm test`
Expected: entire suite green (previous count + the new lead-gen tests).

- [ ] **Step 2: Typecheck + lint (lint gates the prod build)**

Run: `pnpm exec tsc --noEmit && pnpm exec next lint`
Expected: no type errors; no lint errors. Watch specifically for `react/no-unescaped-entities` (apostrophes in JSX — already escaped as `&apos;`) and `@next/next/no-html-link-for-pages` (the `<a>` tags here are external Blob/`target="_blank"` links, which are allowed).

- [ ] **Step 3: Browser smoke (real Chrome via the `browsing` skill)**

Start dev with the correct DB (Git Bash), then drive the flow:

```bash
DATABASE_URL="postgresql://pages:pages@127.0.0.1:5434/pages" \
DATABASE_URL_UNPOOLED="postgresql://pages:pages@127.0.0.1:5434/pages" \
pnpm dev
```

Smoke checklist (log in, then):
1. In the editor, open the slash menu → **Commerce → Lead Gen**; confirm the element inserts.
2. Set a headline + message, upload a small PDF, toggle "collect name" on.
3. Publish the page; open the public URL in a fresh tab.
4. Submit name + email; confirm the success text + inline **Download** link appear, and the link points at the Blob/`/api/upload` URL.
5. Confirm the delivery email is logged to the dev console (`[email:dev] To: …`) — `RESEND_API_KEY` is unset in dev.
6. Open the owner **Data tab → Elements**; confirm the Lead Gen card lists the captured email with a delivered/pending status.

Expected: all six steps pass. Capture a screenshot of the public success state + the Data-tab card.

- [ ] **Step 4: Finish the branch**

Invoke `superpowers:finishing-a-development-branch` to choose merge / PR. (Note: prod delivery requires `RESEND_API_KEY`, already set in Vercel prod per project memory; `EMAIL_FROM` is unset so mail sends from the default `onboarding@resend.dev` until a domain is verified.)

---

## Notes / deferred (v1 out of scope)

- SMS/phone delivery (separate Twilio + A2P 10DLC milestone).
- Double opt-in / verified newsletter list.
- Multi-file "package" payloads (lean on Hub later).
- CSV export of leads (Data-tab list only for now).
- Revocable / time-limited download links (permanent Blob URL in v1).
- Zip/other file types (upload allowlist is images + PDF; extend `upload-validate.ts` later if needed).
