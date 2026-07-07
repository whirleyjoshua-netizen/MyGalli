# Data Tab + Profile Mailbox — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename the "Analytics" section to "Data" with a fourth **Messages** tab (folding in the standalone inbox), and add a visitor-facing **Message** button to every profile's ID card that sends the owner a private message into the same inbox.

**Architecture:** Part 1 renames the page route `/analytics` → `/data`, adds a Messages tab rendering the existing `<MessagesInbox />`, and redirects the old routes. Part 2 makes `Message.displayId` nullable, adds a `POST /api/messages/profile` route, extracts a shared `MailboxComposer` from the mailbox element, and wires a `ProfileMailboxModal` behind a button on `ProfileIdCard`.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Prisma + PostgreSQL, Tailwind, Vitest (`pnpm test`).

## Global Constraints

- **Only PAGE routes change** (`/analytics` → `/data`, `/messages` → redirect). **Do NOT touch any `/api/analytics/*` or `/api/messages/*` API paths** — those stay exactly as-is.
- **DB env:** prefix every prisma/DB command with `DATABASE_URL="postgresql://pages:pages@127.0.0.1:5434/pages"` (127.0.0.1, not localhost).
- **Migrations non-interactive:** never `prisma migrate dev` or any reset. Hand-author or `migrate diff` → SQL file → `migrate deploy`. Timestamp must sort after `20260709000000_add_community_hub` (use `20260709020000_...`).
- **Windows:** do not run `pnpm build` (races dev). Verify with `pnpm exec tsc --noEmit` + `pnpm test`.
- **Behavior preservation:** the `MailboxComposer` extraction must keep `src/components/elements/PublicMailboxElement.test.tsx` green (it asserts a POST to `/api/messages`).
- **Commit** after each task; messages end with the two trailer lines used in this repo (Co-Authored-By + Claude-Session).

---

## File Structure

**Part 1**
- Move `src/app/(dashboard)/analytics/page.tsx` → `src/app/(dashboard)/data/page.tsx` (Messages tab + title).
- New `src/app/(dashboard)/analytics/page.tsx` (redirect → `/data`).
- `src/app/(dashboard)/messages/page.tsx` (redirect → `/data?tab=messages`).
- `src/components/dashboard/SidebarContent.tsx` (nav rename, drop Messages item, move badge).
- `src/components/dashboard/AnalyticsPanel.tsx` (`href="/analytics"` → `/data`).
- `src/middleware.ts`, `src/app/robots.ts` (add `/data`).
- `src/app/api/messages/route.ts` (notification `entityUrl` → `/data?tab=messages`).

**Part 2**
- `prisma/schema.prisma` + `prisma/migrations/20260709020000_message_displayid_nullable/migration.sql`.
- New `src/components/elements/MailboxComposer.tsx`; `src/components/elements/PublicMailboxElement.tsx` (use it).
- New `src/app/api/messages/profile/route.ts`.
- New `src/components/profile/ProfileMailboxModal.tsx`; `src/components/profile/ProfileIdCard.tsx` (button).
- `src/components/dashboard/MessagesInbox.tsx` (null-display → "Profile").

---

## Task 1: Create the `/data` page with a Messages tab

**Files:**
- Move: `src/app/(dashboard)/analytics/page.tsx` → `src/app/(dashboard)/data/page.tsx`
- Modify (the moved file)

**Interfaces:**
- Produces: route `/data` with tabs `overview | elements | bulletin | messages`.

- [ ] **Step 1: Move the folder**

```bash
git mv src/app/(dashboard)/analytics src/app/(dashboard)/data
```
(This moves `page.tsx` to `src/app/(dashboard)/data/page.tsx`. If the `analytics` dir had only `page.tsx`, it's now empty — Task 2 recreates `analytics/page.tsx` as a redirect.)

- [ ] **Step 2: Add the Messages tab to `src/app/(dashboard)/data/page.tsx`**

1. Add the import near the other analytics tab imports:
```tsx
import { MessagesInbox } from '@/components/dashboard/MessagesInbox'
```
2. Widen the tab state type and initializer (replace the existing `useState<'overview' | 'elements' | 'bulletin'>(...)` block):
```tsx
  const [activeTab, setActiveTab] = useState<'overview' | 'elements' | 'bulletin' | 'messages'>(
    (() => {
      const t = searchParams.get('tab')
      return t === 'elements' || t === 'bulletin' || t === 'messages' ? t : 'overview'
    })()
  )
```
3. Rename the header title (find `<h1 className="text-xl font-bold">Analytics</h1>`):
```tsx
              <h1 className="text-xl font-bold">Data</h1>
```
4. Add a Messages tab button after the Bulletin button in the tab nav (mirror the Bulletin button markup; import `Mail` from lucide-react — add it to the existing lucide import line):
```tsx
            <button
              onClick={() => setActiveTab('messages')}
              className={`px-5 py-3 text-sm font-medium transition-colors border-b-2 flex items-center gap-2 ${
                activeTab === 'messages'
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Mail className="w-4 h-4" />
              Messages
            </button>
```
5. Render the Messages tab body. Change the main content conditional chain — the current chain starts `{activeTab === 'bulletin' ? (<BulletinAnalyticsTab />) : activeTab === 'elements' ? (...`. Add a messages branch at the front:
```tsx
        {activeTab === 'messages' ? (
          <MessagesInbox />
        ) : activeTab === 'bulletin' ? (
          <BulletinAnalyticsTab />
        ) : activeTab === 'elements' ? (
```
(Leave the rest of the chain unchanged.)

- [ ] **Step 3: Verify**

Run: `pnpm exec tsc --noEmit`
Expected: clean. (The route now resolves at `/data`; `/analytics` 404s until Task 2 adds the redirect — that's expected mid-plan.)

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(data): rename Analytics page to Data, add Messages tab"
```

---

## Task 2: Redirects, sidebar, middleware, and link/notification updates

**Files:**
- Create: `src/app/(dashboard)/analytics/page.tsx`
- Modify: `src/app/(dashboard)/messages/page.tsx`, `src/components/dashboard/SidebarContent.tsx`, `src/components/dashboard/AnalyticsPanel.tsx`, `src/middleware.ts`, `src/app/robots.ts`, `src/app/api/messages/route.ts`

- [ ] **Step 1: `/analytics` redirect (preserves query)**

Create `src/app/(dashboard)/analytics/page.tsx`:
```tsx
import { redirect } from 'next/navigation'

export default async function AnalyticsRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = await searchParams
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(sp)) {
    if (typeof v === 'string') qs.set(k, v)
    else if (Array.isArray(v) && v[0]) qs.set(k, v[0])
  }
  const s = qs.toString()
  redirect(`/data${s ? `?${s}` : ''}`)
}
```

- [ ] **Step 2: `/messages` redirect**

Replace `src/app/(dashboard)/messages/page.tsx` entirely:
```tsx
import { redirect } from 'next/navigation'

export default function MessagesRedirect() {
  redirect('/data?tab=messages')
}
```

- [ ] **Step 3: Sidebar — rename Data item, drop Messages item, move badge**

In `src/components/dashboard/SidebarContent.tsx`:
1. In the `NAV` array, replace the Analytics and Messages lines with a single Data line:
```tsx
  { label: 'Data', icon: BarChart3, href: '/data', match: (p) => p.startsWith('/data') },
```
(Remove the old `Messages` nav entry entirely. The `Inbox` icon import may now be unused — remove `Inbox` from the lucide import if nothing else uses it; `pnpm exec tsc --noEmit` with noUnusedLocals or eslint will tell you. If unused, delete it.)
2. Move the unread badge from the removed Messages item onto Data — change the badge line (was `item.href === '/messages'`):
```tsx
              {item.href === '/data' && !collapsed && <MessagesNavBadge />}
```

- [ ] **Step 4: AnalyticsPanel links**

In `src/components/dashboard/AnalyticsPanel.tsx`, change both `href="/analytics"` occurrences (lines ~109 and ~139) to `href="/data"`. (Leave the `/api/analytics/...` fetch calls untouched.)

- [ ] **Step 5: middleware + robots**

- `src/middleware.ts`: the protected-paths array (line ~8) and the matcher (line ~39) reference `/analytics`. ADD `/data` alongside (keep `/analytics` so its redirect page stays auth-gated). So the array gains `'/data'` and the matcher gains `'/data/:path*'`.
- `src/app/robots.ts`: the disallow list (line ~15) has `'/analytics'`; add `'/data'`.

- [ ] **Step 6: notification entityUrl**

In `src/app/api/messages/route.ts` (line ~72), change the element-message notification target:
```tsx
    entityUrl: '/data?tab=messages', contextText: display.title,
```

- [ ] **Step 7: Verify**

Run: `pnpm exec tsc --noEmit && pnpm test src/components/dashboard/MessagesInbox.test.tsx`
Expected: tsc clean; inbox test still passes. Manually confirm (reason through) `/analytics?tab=elements&displayId=x` → `/data?tab=elements&displayId=x` and `/messages` → `/data?tab=messages`.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(data): redirects, sidebar Data item + badge, middleware/robots, notification target"
```

---

## Task 3: Make `Message.displayId` nullable (+ migration)

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260709020000_message_displayid_nullable/migration.sql`

- [ ] **Step 1: Edit the schema**

In `prisma/schema.prisma`, model `Message`:
```prisma
  displayId   String?
  display     Display? @relation(fields: [displayId], references: [id], onDelete: Cascade)
```
(Only those two lines change — `displayId` gains `?`, and the relation becomes `Display?`. Leave `ownerId`, `elementId`, indexes, etc. unchanged.)

- [ ] **Step 2: Hand-author the migration**

The only DB change is dropping the NOT NULL. Create `prisma/migrations/20260709020000_message_displayid_nullable/migration.sql`:
```sql
-- Allow profile-scoped messages (no owning page)
ALTER TABLE "Message" ALTER COLUMN "displayId" DROP NOT NULL;
```

- [ ] **Step 3: Apply + regenerate**

```bash
DATABASE_URL="postgresql://pages:pages@127.0.0.1:5434/pages" pnpm exec prisma migrate deploy
DATABASE_URL="postgresql://pages:pages@127.0.0.1:5434/pages" pnpm exec prisma generate
```
If `migrate deploy` errors due to unrelated cross-branch history drift on the shared dev DB, that's non-blocking — report it, do NOT reset. `prisma generate` is what makes `db.message.create({ data: { displayId: null, ... } })` type-check.

- [ ] **Step 4: Verify + commit**

Run: `pnpm exec tsc --noEmit`
```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(messages): make Message.displayId nullable for profile mailbox"
```

---

## Task 4: Extract `MailboxComposer` (behavior-preserving)

**Files:**
- Create: `src/components/elements/MailboxComposer.tsx`
- Modify: `src/components/elements/PublicMailboxElement.tsx`
- Test (existing, must stay green): `src/components/elements/PublicMailboxElement.test.tsx`

**Interfaces:**
- Produces:
  `MailboxComposer` props =
  `{ title?: string; prompt?: string; allowAudio?: boolean; requireName?: boolean; buttonLabel?: string; thankYou?: string; onSubmit: (payload: MailboxPayload) => Promise<{ ok: boolean; error?: string }> }`
  where `MailboxPayload = { kind: 'text' | 'audio'; body?: string; mediaUrl?: string; senderName?: string; senderEmail?: string; hp: string }`.
  The composer owns the textarea, audio record/upload (posting to `/api/messages/upload` to obtain `mediaUrl`), name/email, honeypot, validation, sending + sent states, and calls `onSubmit` with the assembled payload.

- [ ] **Step 1: Create `MailboxComposer.tsx`**

Move the form + audio + submit logic out of `PublicMailboxElement.tsx` verbatim, parameterized by props. The audio upload to `/api/messages/upload` stays inside the composer; after obtaining `mediaUrl` (or for text), it calls `onSubmit(payload)` and shows the sent state on `{ ok: true }` or the error on `{ ok: false, error }`.

```tsx
'use client'

import { useRef, useState } from 'react'
import { Mic, Square, Upload, Send, Inbox } from 'lucide-react'

export interface MailboxPayload {
  kind: 'text' | 'audio'
  body?: string
  mediaUrl?: string
  senderName?: string
  senderEmail?: string
  hp: string
}

export function MailboxComposer({
  title,
  prompt,
  allowAudio = true,
  requireName = false,
  buttonLabel,
  thankYou,
  onSubmit,
}: {
  title?: string
  prompt?: string
  allowAudio?: boolean
  requireName?: boolean
  buttonLabel?: string
  thankYou?: string
  onSubmit: (payload: MailboxPayload) => Promise<{ ok: boolean; error?: string }>
}) {
  const [text, setText] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [hp, setHp] = useState('')
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [recording, setRecording] = useState(false)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const recRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  const startRec = async () => {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const rec = new MediaRecorder(stream)
      chunksRef.current = []
      rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        setAudioBlob(blob); setAudioUrl(URL.createObjectURL(blob))
        stream.getTracks().forEach((t) => t.stop())
      }
      rec.start(); recRef.current = rec; setRecording(true)
    } catch { setError('Microphone unavailable — you can upload a file instead.') }
  }
  const stopRec = () => { recRef.current?.stop(); setRecording(false) }
  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return
    setAudioBlob(f); setAudioUrl(URL.createObjectURL(f))
  }

  const submit = async () => {
    setError(null)
    if (!text.trim() && !audioBlob) { setError('Write or record a message first.'); return }
    if (requireName && !name.trim()) { setError('Please add your name.'); return }
    setSending(true)
    try {
      let mediaUrl = ''
      let kind: 'text' | 'audio' = 'text'
      if (audioBlob) {
        const fd = new FormData()
        fd.append('file', audioBlob, 'message.webm')
        const up = await fetch('/api/messages/upload', { method: 'POST', body: fd })
        if (up.ok) { const d = await up.json(); mediaUrl = d.url; kind = 'audio' }
        else { setError('Could not upload the audio.'); setSending(false); return }
      }
      const res = await onSubmit({
        kind, body: text.trim() || undefined, mediaUrl: mediaUrl || undefined,
        senderName: name.trim() || undefined, senderEmail: email.trim() || undefined, hp,
      })
      if (res.ok) setSent(true)
      else setError(res.error || 'Something went wrong — try again.')
    } catch { setError('Network error — try again.') }
    finally { setSending(false) }
  }

  if (sent) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center">
        <Inbox className="w-6 h-6 mx-auto text-primary mb-2" />
        <p className="text-sm font-medium text-slate-700">{thankYou || 'Thanks — your message was sent!'}</p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      {title && <h3 className="text-base font-bold text-slate-900">{title}</h3>}
      {prompt && <p className="mt-1 text-sm text-slate-500">{prompt}</p>}

      <textarea
        value={text} onChange={(e) => setText(e.target.value)}
        placeholder="Your message…" rows={3}
        className="mt-3 w-full text-sm border border-slate-200 rounded-lg px-3 py-2"
      />

      {allowAudio && (
        <div className="mt-2 flex items-center gap-2">
          {!recording ? (
            <button type="button" onClick={startRec} className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200">
              <Mic className="w-3.5 h-3.5" /> Record
            </button>
          ) : (
            <button type="button" onClick={stopRec} className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-red-100 text-red-700">
              <Square className="w-3.5 h-3.5" /> Stop
            </button>
          )}
          <label className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 cursor-pointer">
            <Upload className="w-3.5 h-3.5" /> Upload
            <input type="file" accept="audio/*" className="hidden" onChange={onFile} />
          </label>
          {audioUrl && <audio src={audioUrl} controls className="h-8" />}
        </div>
      )}

      <div className="mt-3 grid grid-cols-2 gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder={requireName ? 'Your name *' : 'Your name (optional)'} className="text-sm border border-slate-200 rounded-lg px-3 py-2" />
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email (optional)" className="text-sm border border-slate-200 rounded-lg px-3 py-2" />
      </div>

      {/* Honeypot — hidden from humans, bots fill it */}
      <input type="text" name="hp" value={hp} onChange={(e) => setHp(e.target.value)} tabIndex={-1} autoComplete="off" aria-hidden="true" style={{ position: 'absolute', left: '-9999px', width: 1, height: 1 }} />

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

      <button type="button" onClick={submit} disabled={sending} className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50">
        <Send className="w-3.5 h-3.5" /> {sending ? 'Sending…' : (buttonLabel || 'Send')}
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Rewrite `PublicMailboxElement.tsx` as a thin wrapper**

```tsx
'use client'

import type { CanvasElement } from '@/lib/types/canvas'
import { MailboxComposer, type MailboxPayload } from './MailboxComposer'

export function PublicMailboxElement({ element }: { element: CanvasElement }) {
  const displayId = (element as { displayId?: string }).displayId || ''

  const onSubmit = async (p: MailboxPayload) => {
    const res = await fetch('/api/messages', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayId, elementId: element.id,
        kind: p.kind, body: p.body, mediaUrl: p.mediaUrl,
        senderName: p.senderName, senderEmail: p.senderEmail, hp: p.hp,
      }),
    })
    return { ok: res.ok }
  }

  return (
    <MailboxComposer
      title={element.mailboxTitle}
      prompt={element.mailboxPrompt}
      allowAudio={element.mailboxAllowAudio ?? true}
      requireName={element.mailboxRequireName ?? false}
      buttonLabel={element.mailboxButtonLabel}
      thankYou={element.mailboxThankYou}
      onSubmit={onSubmit}
    />
  )
}
```

- [ ] **Step 3: Run the existing test (must stay green)**

Run: `pnpm test src/components/elements/PublicMailboxElement.test.tsx`
Expected: PASS unchanged (it asserts a submit POSTs to `/api/messages`). If it fails, the extraction changed behavior — fix the wrapper/composer, do NOT edit the test.

- [ ] **Step 4: Verify + commit**

Run: `pnpm exec tsc --noEmit`
```bash
git add src/components/elements/MailboxComposer.tsx src/components/elements/PublicMailboxElement.tsx
git commit -m "refactor(mailbox): extract shared MailboxComposer; element uses it"
```

---

## Task 5: Profile mailbox API + inbox "Profile" label

**Files:**
- Create: `src/app/api/messages/profile/route.ts`
- Modify: `src/components/dashboard/MessagesInbox.tsx`
- Test (optional): `src/app/api/messages/profile/route.test.ts`

**Interfaces:**
- Consumes: nullable `db.message.displayId` (Task 3).
- Produces: `POST /api/messages/profile` accepting `{ username, kind, body?, mediaUrl?, senderName?, senderEmail?, hp }`.

- [ ] **Step 1: Create the route** (mirror the element route's rate-limit, honeypot, and ipHash)

```ts
// src/app/api/messages/profile/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { db } from '@/lib/db'
import { getJwtSecret } from '@/lib/auth'
import { rateLimit } from '@/lib/rate-limit'
import { createNotification } from '@/lib/notifications'

export async function POST(request: NextRequest) {
  const limited = await rateLimit(request, { limit: 20, windowMs: 60_000, prefix: 'messages-submit' })
  if (limited) return limited

  let b: Record<string, unknown>
  try { b = await request.json() } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }

  // Honeypot: silently accept, do not persist.
  if (typeof b.hp === 'string' && b.hp.trim() !== '') return NextResponse.json({ ok: true })

  const username = String(b.username ?? '').trim()
  const kind = b.kind === 'audio' ? 'audio' : 'text'
  const body = typeof b.body === 'string' ? b.body.trim() : ''
  const mediaUrl = typeof b.mediaUrl === 'string' ? b.mediaUrl : ''
  const senderName = typeof b.senderName === 'string' ? b.senderName.trim() : ''
  const senderEmail = typeof b.senderEmail === 'string' ? b.senderEmail.trim() : ''

  if (!username) return NextResponse.json({ error: 'Missing target' }, { status: 400 })
  if (!body && !mediaUrl) return NextResponse.json({ error: 'Empty message' }, { status: 400 })

  const user = await db.user.findUnique({ where: { username }, select: { id: true } })
  if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const ipHash = createHash('sha256').update(ip + getJwtSecret()).digest('hex').substring(0, 16)

  await db.message.create({
    data: {
      displayId: null, ownerId: user.id, elementId: 'profile-mailbox', kind,
      body: body || null, mediaUrl: mediaUrl || null,
      senderName: senderName || null, senderEmail: senderEmail || null, ipHash,
    },
  })

  await createNotification({
    userId: user.id, type: 'message',
    actor: { id: null, name: senderName || 'Someone' },
    entityUrl: '/data?tab=messages', contextText: 'Profile mailbox',
  })

  return NextResponse.json({ ok: true }, { status: 201 })
}
```
(Verify `db.user` has a unique `username` field and `createNotification`'s signature matches the element route's usage — copy it exactly from `src/app/api/messages/route.ts`.)

- [ ] **Step 2: Inbox shows "Profile" for null-display messages**

In `src/components/dashboard/MessagesInbox.tsx`, replace the source-label line (currently `{m.display?.title && <span ...>· {m.display.title}</span>}`):
```tsx
                <span className="text-xs text-muted-foreground">· {m.display?.title || 'Profile'}</span>
```

- [ ] **Step 3: (Optional) route test**

If a test harness exists for the messages API (see `src/app/api/messages/route.test.ts` for the mocking pattern), add `src/app/api/messages/profile/route.test.ts` covering: happy path (201, `db.message.create` called with `displayId: null` + `elementId: 'profile-mailbox'`), honeypot (200, no create), unknown username (404). Mirror the existing test's `db` mock.

- [ ] **Step 4: Verify + commit**

Run: `pnpm exec tsc --noEmit` (and the new test if written)
```bash
git add src/app/api/messages/profile/ src/components/dashboard/MessagesInbox.tsx
git commit -m "feat(messages): profile mailbox POST route + inbox Profile label"
```

---

## Task 6: Profile "Message" button + modal

**Files:**
- Create: `src/components/profile/ProfileMailboxModal.tsx`
- Modify: `src/components/profile/ProfileIdCard.tsx`

- [ ] **Step 1: Create the modal**

```tsx
// src/components/profile/ProfileMailboxModal.tsx
'use client'

import { X } from 'lucide-react'
import { MailboxComposer, type MailboxPayload } from '@/components/elements/MailboxComposer'

export function ProfileMailboxModal({
  username,
  name,
  onClose,
}: {
  username: string
  name: string | null
  onClose: () => void
}) {
  const onSubmit = async (p: MailboxPayload) => {
    const res = await fetch('/api/messages/profile', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username, kind: p.kind, body: p.body, mediaUrl: p.mediaUrl,
        senderName: p.senderName, senderEmail: p.senderEmail, hp: p.hp,
      }),
    })
    return { ok: res.ok }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-white font-semibold">Message {name || `@${username}`}</h2>
          <button onClick={onClose} aria-label="Close" className="p-1 rounded-full bg-white/10 text-white hover:bg-white/20">
            <X className="w-4 h-4" />
          </button>
        </div>
        <MailboxComposer
          title="Send me a message"
          prompt="This goes straight to my private inbox."
          allowAudio
          onSubmit={onSubmit}
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Add the Message button to `ProfileIdCard.tsx`**

1. Add imports:
```tsx
import { useState } from 'react'
import { MapPin, Pencil, Mail } from 'lucide-react'   // add Mail
import { ProfileMailboxModal } from '@/components/profile/ProfileMailboxModal'
```
2. Add modal state at the top of the component body:
```tsx
  const [mailboxOpen, setMailboxOpen] = useState(false)
```
3. In the action row (the `mt-4 flex items-center gap-2` div), add a Message button after `ShareProfileButton`:
```tsx
        <button
          onClick={() => setMailboxOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-sm font-semibold hover:bg-muted transition-all cursor-pointer"
        >
          <Mail className="w-4 h-4" /> Message
        </button>
```
4. Render the modal at the end of the card's root (just before the closing `</div>` of the outer container, still inside it):
```tsx
      {mailboxOpen && (
        <ProfileMailboxModal username={user.username} name={user.name} onClose={() => setMailboxOpen(false)} />
      )}
```

- [ ] **Step 3: Verify + commit**

Run: `pnpm exec tsc --noEmit`
```bash
git add src/components/profile/ProfileMailboxModal.tsx src/components/profile/ProfileIdCard.tsx
git commit -m "feat(profile): Message button + mailbox modal on the ID card"
```

---

## Task 7: Full verification

- [ ] **Step 1: Type + tests**

Run: `pnpm exec tsc --noEmit && pnpm test`
Expected: tsc clean; suite green (note any PRE-EXISTING unrelated failures — e.g. env-dependent tests — and confirm they fail on `origin/main` too, not from this branch). Specifically `PublicMailboxElement.test.tsx`, `MessagesInbox.test.tsx`, and any new profile-route test pass.

- [ ] **Step 2: Manual smoke (dev)**

Start dev: `DATABASE_URL="postgresql://pages:pages@127.0.0.1:5434/pages" pnpm dev`
1. Sidebar shows **Data** (no separate Messages item); unread badge is on Data.
2. `/data` shows four tabs; Messages tab lists the inbox. `/analytics?tab=elements` and `/messages` redirect correctly (query preserved).
3. On a public profile `/[username]`, click **Message** → modal → send text (and an audio) → success. It appears in **Data ▸ Messages** labeled **· Profile**.
4. An element mailbox message still works and shows its page title.
5. Notification for a new message deep-links to `/data?tab=messages`.

- [ ] **Step 3: Commit any final notes** (if applicable)

---

## Self-Review notes

- **Spec coverage:** rename + Messages tab (T1), redirects/sidebar/badge/middleware/robots/notification (T2), nullable displayId (T3), shared composer (T4), profile route + inbox label (T5), modal + button (T6), verification (T7). ✓
- **API paths untouched:** only page routes renamed; all `/api/analytics/*` and `/api/messages/*` calls unchanged. ✓
- **Behavior preservation:** composer extraction guarded by existing `PublicMailboxElement.test.tsx` (T4 Step 3). ✓
- **Deferred (unchanged from spec):** per-user profile-mailbox config; hiding the button from the owner's own view; video messages.
- **Implementation-time verifications flagged:** `createNotification` signature (copy from element route), `db.user` unique `username`, exact middleware/robots array shapes, and whether `Inbox` import becomes unused in SidebarContent.
