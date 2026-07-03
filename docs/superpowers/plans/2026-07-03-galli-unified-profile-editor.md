# Unified Profile Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the split "Edit profile modal + generic /editor" flow with one `/profile/edit` screen — standard fields on top, the real `/`-prompt canvas below — that autosaves and links back to the profile.

**Architecture:** A new standalone route `/profile/edit` renders `ProfileEditor`, which composes `ProfileFieldsPanel` (standard section, autosaves to `/api/profile`) and `ProfileCanvasEditor` (reuses `ColumnCanvas` + settings modals, autosaves the profile `Display` to `/api/displays/[id]`). Canvas editing is isolated into `ProfileCanvasEditor` so the ~1,300-line `PageEditor` is untouched. No new API routes or schema changes.

**Tech Stack:** Next.js 15 App Router (server + client components), React 19, TypeScript, Tailwind, Prisma, Zustand (`useAuthStore`), Vitest + @testing-library/react (jsdom).

## Global Constraints

- Profile `Display` stays `published: true` — **always live, no publish/draft toggle**.
- Autosave only (debounced); header shows a "Saved ✓ / Saving…" indicator and a **View Profile** action. No manual Save button required.
- Reuse existing endpoints only: `PATCH /api/profile`, `POST /api/profile/canvas`, `PATCH /api/displays/[id]`. No schema migration.
- Element creation MUST use `createElement(type)` from `@/lib/types/canvas` (do not re-inline the type switch).
- Canvas autosave MUST send `version` and handle a `409` by showing a reload banner (same optimistic-concurrency contract as `PageEditor`).
- Out of scope (do NOT add): tabs, header-card, collaborators, kits, publish dialog.
- Windows/dev note: verify with `npx tsc --noEmit` + `npx vitest run` + live checks. Do NOT run `pnpm build` while the dev server is running (`.next` race).

---

### Task 1: `ensureProfileCanvas` helper + refactor canvas API route

**Files:**
- Create: `src/lib/profile-canvas.ts`
- Modify: `src/app/api/profile/canvas/route.ts`

**Interfaces:**
- Produces: `ensureProfileCanvas(userId: string): Promise<string>` — returns the profile Display id, creating it (and setting `User.profileDisplayId`) if missing. Idempotent.
- Consumes: `db` from `@/lib/db`.

- [ ] **Step 1: Create the helper**

Create `src/lib/profile-canvas.ts`:

```ts
import { db } from '@/lib/db'

// Returns the user's profile-canvas Display id, creating it if missing.
// Mirrors the create-or-get logic previously inline in POST /api/profile/canvas.
export async function ensureProfileCanvas(userId: string): Promise<string> {
  const fresh = await db.user.findUnique({
    where: { id: userId },
    select: { profileDisplayId: true, username: true },
  })

  if (fresh?.profileDisplayId) {
    const existing = await db.display.findUnique({
      where: { id: fresh.profileDisplayId },
      select: { id: true },
    })
    if (existing) return existing.id
  }

  const display = await db.display.create({
    data: {
      userId,
      kind: 'profile',
      published: true,
      slug: '__profile',
      title: `${fresh?.username ?? 'My'} profile`,
      sections: [],
    },
    select: { id: true },
  })
  await db.user.update({ where: { id: userId }, data: { profileDisplayId: display.id } })
  return display.id
}
```

- [ ] **Step 2: Refactor the route to use it**

Replace the body of `POST` in `src/app/api/profile/canvas/route.ts` with:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'
import { ensureProfileCanvas } from '@/lib/profile-canvas'

export async function POST(request: NextRequest) {
  try {
    const me = await getUser(request)
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const id = await ensureProfileCanvas(me.id)
    return NextResponse.json({ id })
  } catch (e) {
    console.error('Profile canvas error:', e)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 4: Live-verify idempotency**

With the dev server running, mint a JWT for a test user (see `MEMORY.md` "env quirk" note: sign `{userId}` with `.env` `JWT_SECRET`) and run twice:

```bash
curl -s -X POST http://localhost:3000/api/profile/canvas -H "Cookie: galli-auth=$JWT"
```
Expected: both calls return the **same** `{"id":"..."}`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/profile-canvas.ts src/app/api/profile/canvas/route.ts
git commit -m "refactor(profile): extract ensureProfileCanvas helper"
```

---

### Task 2: `ProfileFieldsPanel` — standard section with autosave

**Files:**
- Create: `src/components/profile/ProfileFieldsPanel.tsx`
- Test: `src/components/profile/ProfileFieldsPanel.test.tsx`

**Interfaces:**
- Consumes: `User` from `@/lib/types`; `useAuthStore` from `@/lib/store` (`setAuth`).
- Produces: `<ProfileFieldsPanel user={User} onSavingChange={(saving: boolean) => void} />`.
  Autosaves name/location/bio/avatar/interests/links to `PATCH /api/profile` (debounced 800 ms), then calls `setAuth`.

- [ ] **Step 1: Write the failing test**

Create `src/components/profile/ProfileFieldsPanel.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ProfileFieldsPanel } from './ProfileFieldsPanel'
import type { User } from '@/lib/types'

vi.mock('@/lib/store', () => ({
  useAuthStore: (sel: (s: { setAuth: () => void }) => unknown) => sel({ setAuth: vi.fn() }),
}))

const user: User = {
  id: 'u1', email: 'a@b.co', username: 'josh', name: 'Josh',
  location: 'NYC', bio: 'hi', interests: [], links: [],
} as User

describe('ProfileFieldsPanel', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    global.fetch = vi.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve({ name: 'Josh R' }) }) as unknown as Response,
    ) as unknown as typeof fetch
  })
  afterEach(() => vi.useRealTimers())

  it('renders the name field with the initial value', () => {
    render(<ProfileFieldsPanel user={user} onSavingChange={() => {}} />)
    expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe('Josh')
  })

  it('debounced-saves to /api/profile after editing a field', () => {
    render(<ProfileFieldsPanel user={user} onSavingChange={() => {}} />)
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Josh R' } })
    expect(global.fetch).not.toHaveBeenCalled() // debounced, not immediate
    vi.advanceTimersByTime(900)
    expect(global.fetch).toHaveBeenCalledWith('/api/profile', expect.objectContaining({ method: 'PATCH' }))
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/profile/ProfileFieldsPanel.test.tsx`
Expected: FAIL (module not found / component undefined).

- [ ] **Step 3: Implement the component**

Create `src/components/profile/ProfileFieldsPanel.tsx` (fields lifted from the old `EditProfileModal`, plus debounced autosave). Note the `aria-label` on each input so the test and screen readers can find them:

```tsx
'use client'

import { useState, useEffect, useRef } from 'react'
import { Plus, Trash2, ImageIcon, X } from 'lucide-react'
import { useAuthStore } from '@/lib/store'
import type { User } from '@/lib/types'

const inputCls =
  'w-full px-3 py-2 border border-border rounded-xl bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary transition'

export function ProfileFieldsPanel({
  user,
  onSavingChange,
}: {
  user: User
  onSavingChange: (saving: boolean) => void
}) {
  const setAuth = useAuthStore((s) => s.setAuth)
  const [name, setName] = useState(user.name || '')
  const [location, setLocation] = useState(user.location || '')
  const [bio, setBio] = useState(user.bio || '')
  const [avatar, setAvatar] = useState<string | null>(user.avatar || null)
  const [interests, setInterests] = useState<string[]>(user.interests || [])
  const [interestDraft, setInterestDraft] = useState('')
  const [links, setLinks] = useState<{ label: string; url: string }[]>(user.links || [])

  const firstRender = useRef(true)

  // Debounced autosave whenever any field changes
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    const t = setTimeout(async () => {
      onSavingChange(true)
      try {
        const res = await fetch('/api/profile', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name,
            location,
            bio,
            avatar,
            interests,
            links: links.filter((l) => l.label.trim() && l.url.trim()),
          }),
        })
        if (res.ok) {
          const updated = await res.json()
          setAuth({ ...user, ...updated })
        }
      } finally {
        onSavingChange(false)
      }
    }, 800)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, location, bio, avatar, interests, links])

  const addInterest = () => {
    const t = interestDraft.trim()
    if (t && !interests.includes(t) && interests.length < 12) setInterests([...interests, t])
    setInterestDraft('')
  }

  const uploadAvatar = async (file: File) => {
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch('/api/upload', { method: 'POST', body: fd })
    if (res.ok) setAvatar((await res.json()).url)
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-5 space-y-4">
      <h2 className="font-bold">Profile details</h2>

      {/* Avatar */}
      <div className="flex items-center gap-3">
        {avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatar} alt="" className="w-16 h-16 rounded-2xl object-cover" />
        ) : (
          <span className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center text-muted-foreground">
            <ImageIcon className="w-6 h-6" />
          </span>
        )}
        <label className="text-sm font-medium text-primary cursor-pointer hover:underline">
          Change photo
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) uploadAvatar(f)
              e.target.value = ''
            }}
          />
        </label>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1.5">Name</label>
        <input aria-label="Name" value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1.5">Location / role</label>
        <input aria-label="Location / role" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. QB · Westfield High · Class 2026" className={inputCls} />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1.5">Bio</label>
        <textarea aria-label="Bio" value={bio} onChange={(e) => setBio(e.target.value)} rows={3} className={`${inputCls} resize-none`} />
      </div>

      {/* Interests */}
      <div>
        <label className="block text-sm font-medium mb-1.5">Interests</label>
        <div className="flex flex-wrap gap-2 mb-2">
          {interests.map((it) => (
            <span key={it} className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs">
              {it}
              <button onClick={() => setInterests(interests.filter((x) => x !== it))} className="text-muted-foreground hover:text-destructive cursor-pointer">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
        <input
          aria-label="Add interest"
          value={interestDraft}
          onChange={(e) => setInterestDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              addInterest()
            }
          }}
          placeholder="Type and press Enter (max 12)"
          className={inputCls}
        />
      </div>

      {/* Links */}
      <div>
        <label className="block text-sm font-medium mb-1.5">Links</label>
        <div className="space-y-2">
          {links.map((l, i) => (
            <div key={i} className="flex gap-2">
              <input aria-label={`Link ${i + 1} label`} value={l.label} onChange={(e) => setLinks(links.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} placeholder="Label" className={`${inputCls} w-1/3`} />
              <input aria-label={`Link ${i + 1} url`} value={l.url} onChange={(e) => setLinks(links.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))} placeholder="https://…" className={`${inputCls} flex-1`} />
              <button onClick={() => setLinks(links.filter((_, j) => j !== i))} aria-label="Remove link" className="p-2 text-muted-foreground hover:text-destructive cursor-pointer">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
        {links.length < 10 && (
          <button onClick={() => setLinks([...links, { label: '', url: '' }])} className="mt-2 inline-flex items-center gap-1.5 text-sm text-primary font-medium hover:underline cursor-pointer">
            <Plus className="w-4 h-4" /> Add link
          </button>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/profile/ProfileFieldsPanel.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/profile/ProfileFieldsPanel.tsx src/components/profile/ProfileFieldsPanel.test.tsx
git commit -m "feat(profile): ProfileFieldsPanel with debounced autosave"
```

---

### Task 3: `ProfileCanvasEditor` — canvas editing bound to one Display

**Files:**
- Create: `src/components/profile/ProfileCanvasEditor.tsx`

**Interfaces:**
- Consumes: `ColumnCanvas` (`@/components/canvas/ColumnCanvas`), `SlashCommandMenu` (`@/components/canvas/SlashCommandMenu`), `BackgroundSettings`, `ColumnStyleSettings`, `SpacingSettings` (`@/components/canvas/*`), `createElement`, `DEFAULT_COLUMN_SETTINGS`, and types from `@/lib/types/canvas`; `BackgroundConfig`/`DEFAULT_BACKGROUND_CONFIG` from `@/lib/types/background`; `SpacingConfig`/`DEFAULT_SPACING_CONFIG` from `@/lib/types/spacing`.
- Produces: `<ProfileCanvasEditor displayId initialSections initialBackground initialSpacing initialVersion onSavingChange />` where props are:
  `displayId: string`, `initialSections: Section[]`, `initialBackground: BackgroundConfig | null`, `initialSpacing: SpacingConfig | null`, `initialVersion: number`, `onSavingChange: (saving: boolean) => void`.

- [ ] **Step 1: Implement the component**

Create `src/components/profile/ProfileCanvasEditor.tsx`. This mirrors `PageEditor`'s canvas handlers but operates directly on `sections` (no tabs) and uses `createElement` for DRY element creation:

```tsx
'use client'

import { useState, useEffect, useRef } from 'react'
import { ImageIcon, AlignVerticalSpaceAround } from 'lucide-react'
import { ColumnCanvas } from '@/components/canvas/ColumnCanvas'
import { SlashCommandMenu } from '@/components/canvas/SlashCommandMenu'
import { BackgroundSettings } from '@/components/canvas/BackgroundSettings'
import { ColumnStyleSettings } from '@/components/canvas/ColumnStyleSettings'
import { SpacingSettings } from '@/components/canvas/SpacingSettings'
import type { Section, LayoutMode, ElementType, CanvasElement, ColumnSettings } from '@/lib/types/canvas'
import { createElement, DEFAULT_COLUMN_SETTINGS } from '@/lib/types/canvas'
import type { BackgroundConfig } from '@/lib/types/background'
import { DEFAULT_BACKGROUND_CONFIG } from '@/lib/types/background'
import type { SpacingConfig } from '@/lib/types/spacing'
import { DEFAULT_SPACING_CONFIG } from '@/lib/types/spacing'

export function ProfileCanvasEditor({
  displayId,
  initialSections,
  initialBackground,
  initialSpacing,
  initialVersion,
  onSavingChange,
}: {
  displayId: string
  initialSections: Section[]
  initialBackground: BackgroundConfig | null
  initialSpacing: SpacingConfig | null
  initialVersion: number
  onSavingChange: (saving: boolean) => void
}) {
  const [sections, setSections] = useState<Section[]>(
    initialSections.length ? initialSections : [{ id: `section-${Date.now()}`, layout: 'full-width', columns: [{ id: `col-${Date.now()}`, elements: [] }] }],
  )
  const [background, setBackground] = useState<BackgroundConfig>(initialBackground || DEFAULT_BACKGROUND_CONFIG)
  const [spacing, setSpacing] = useState<SpacingConfig>(initialSpacing || DEFAULT_SPACING_CONFIG)
  const versionRef = useRef(initialVersion)
  const [conflict, setConflict] = useState(false)

  // Slash menu
  const [showSlashMenu, setShowSlashMenu] = useState(false)
  const [slashPos, setSlashPos] = useState({ x: 0, y: 0 })
  const [curSection, setCurSection] = useState<string | null>(null)
  const [curColumn, setCurColumn] = useState<string | null>(null)

  // Settings modals
  const [showBackground, setShowBackground] = useState(false)
  const [showSpacing, setShowSpacing] = useState(false)
  const [showColumn, setShowColumn] = useState(false)
  const [colSection, setColSection] = useState<string | null>(null)
  const [colId, setColId] = useState<string | null>(null)

  // Debounced autosave (content fields → version-checked PATCH)
  const firstRender = useRef(true)
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    if (conflict) return
    const t = setTimeout(async () => {
      onSavingChange(true)
      try {
        const res = await fetch(`/api/displays/${displayId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sections, background, spacing, version: versionRef.current }),
        })
        if (res.status === 409) {
          setConflict(true)
          return
        }
        if (res.ok) {
          const updated = await res.json()
          if (typeof updated.version === 'number') versionRef.current = updated.version
        }
      } finally {
        onSavingChange(false)
      }
    }, 800)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sections, background, spacing])

  // Section ops
  const addSection = (layout: LayoutMode) => {
    const count = layout === 'full-width' ? 1 : layout === 'two-column' ? 2 : 3
    const columns = Array.from({ length: count }, (_, i) => ({ id: `col-${Date.now()}-${i}`, elements: [] }))
    setSections((prev) => [...prev, { id: `section-${Date.now()}`, layout, columns }])
  }
  const deleteSection = (sectionId: string) => setSections((prev) => prev.filter((s) => s.id !== sectionId))

  // Slash menu
  const openSlashMenu = (sectionId: string, columnId: string, position?: { x: number; y: number }) => {
    setCurSection(sectionId)
    setCurColumn(columnId)
    setSlashPos(position || { x: window.innerWidth / 2 - 160, y: 200 })
    setShowSlashMenu(true)
  }
  const handleCommandSelect = (type: ElementType) => {
    if (!curSection || !curColumn) return
    const newElement = createElement(type)
    setSections((prev) =>
      prev.map((section) =>
        section.id === curSection
          ? { ...section, columns: section.columns.map((col) => (col.id === curColumn ? { ...col, elements: [...col.elements, newElement] } : col)) }
          : section,
      ),
    )
    setShowSlashMenu(false)
    setCurSection(null)
    setCurColumn(null)
  }

  // Element ops
  const updateElement = (sectionId: string, columnId: string, elementId: string, updates: Partial<CanvasElement>) =>
    setSections((prev) =>
      prev.map((section) =>
        section.id === sectionId
          ? { ...section, columns: section.columns.map((col) => (col.id === columnId ? { ...col, elements: col.elements.map((el) => (el.id === elementId ? { ...el, ...updates } : el)) } : col)) }
          : section,
      ),
    )
  const deleteElement = (sectionId: string, columnId: string, elementId: string) =>
    setSections((prev) =>
      prev.map((section) =>
        section.id === sectionId
          ? { ...section, columns: section.columns.map((col) => (col.id === columnId ? { ...col, elements: col.elements.filter((el) => el.id !== elementId) } : col)) }
          : section,
      ),
    )

  // Column settings
  const openColumnSettings = (sectionId: string, columnId: string) => {
    setColSection(sectionId)
    setColId(columnId)
    setShowColumn(true)
  }
  const currentColumnSettings = (): ColumnSettings => {
    const s = sections.find((x) => x.id === colSection)
    return s?.columns.find((c) => c.id === colId)?.settings || DEFAULT_COLUMN_SETTINGS
  }
  const updateColumnSettings = (settings: ColumnSettings) => {
    if (!colSection || !colId) return
    setSections((prev) =>
      prev.map((section) =>
        section.id === colSection
          ? { ...section, columns: section.columns.map((col) => (col.id === colId ? { ...col, settings } : col)) }
          : section,
      ),
    )
  }

  return (
    <div className="rounded-2xl border border-border bg-surface overflow-hidden">
      {conflict && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-800 px-4 py-2.5 text-sm flex items-center justify-between">
          <span>This profile was updated elsewhere. Reload to get the latest — unsaved changes will be lost.</span>
          <button onClick={() => window.location.reload()} className="ml-4 px-3 py-1 rounded-lg bg-amber-600 text-white text-xs font-semibold hover:bg-amber-700 transition cursor-pointer">
            Reload
          </button>
        </div>
      )}

      {/* Canvas toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border">
        <span className="text-sm font-bold mr-auto">Your canvas</span>
        <button onClick={() => setShowBackground(true)} className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-muted rounded-lg transition">
          <ImageIcon className="w-4 h-4" /> Background
        </button>
        <button onClick={() => setShowSpacing(true)} className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-muted rounded-lg transition">
          <AlignVerticalSpaceAround className="w-4 h-4" /> Spacing
        </button>
      </div>

      <ColumnCanvas
        sections={sections}
        onSectionsChange={setSections}
        onAddSection={addSection}
        onDeleteSection={deleteSection}
        onOpenSlashMenu={openSlashMenu}
        onUpdateElement={updateElement}
        onDeleteElement={deleteElement}
        onOpenColumnSettings={openColumnSettings}
        displayId={displayId}
        spacing={spacing}
      />

      {showSlashMenu && (
        <SlashCommandMenu position={slashPos} onSelect={handleCommandSelect} onClose={() => setShowSlashMenu(false)} isKitPage={false} />
      )}
      <BackgroundSettings isOpen={showBackground} onClose={() => setShowBackground(false)} config={background} onChange={setBackground} />
      <SpacingSettings isOpen={showSpacing} onClose={() => setShowSpacing(false)} config={spacing} onChange={setSpacing} />
      <ColumnStyleSettings isOpen={showColumn} onClose={() => setShowColumn(false)} settings={currentColumnSettings()} onChange={updateColumnSettings} />
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0. (If `SlashCommandMenu`'s prop names differ, open `src/components/canvas/SlashCommandMenu.tsx` and match them — expected: `position`, `onSelect`, `onClose`, `isKitPage`.)

- [ ] **Step 3: Commit**

```bash
git add src/components/profile/ProfileCanvasEditor.tsx
git commit -m "feat(profile): ProfileCanvasEditor (reuses ColumnCanvas, autosaves display)"
```

---

### Task 4: `ProfileEditor` + `/profile/edit` route

**Files:**
- Create: `src/components/profile/ProfileEditor.tsx`
- Create: `src/app/profile/edit/page.tsx`

**Interfaces:**
- Consumes: `ProfileFieldsPanel` (Task 2), `ProfileCanvasEditor` (Task 3), `ensureProfileCanvas` (Task 1), `User` from `@/lib/types`.
- Produces: `<ProfileEditor username user initialSections initialBackground initialSpacing initialVersion displayId />`.

- [ ] **Step 1: Implement `ProfileEditor` (client)**

Create `src/components/profile/ProfileEditor.tsx`:

```tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Check, Save, Eye } from 'lucide-react'
import { ProfileFieldsPanel } from '@/components/profile/ProfileFieldsPanel'
import { ProfileCanvasEditor } from '@/components/profile/ProfileCanvasEditor'
import type { User } from '@/lib/types'
import type { Section } from '@/lib/types/canvas'
import type { BackgroundConfig } from '@/lib/types/background'
import type { SpacingConfig } from '@/lib/types/spacing'

export function ProfileEditor({
  username,
  user,
  displayId,
  initialSections,
  initialBackground,
  initialSpacing,
  initialVersion,
}: {
  username: string
  user: User
  displayId: string
  initialSections: Section[]
  initialBackground: BackgroundConfig | null
  initialSpacing: SpacingConfig | null
  initialVersion: number
}) {
  const [fieldsSaving, setFieldsSaving] = useState(false)
  const [canvasSaving, setCanvasSaving] = useState(false)
  const [everSaved, setEverSaved] = useState(false)
  const saving = fieldsSaving || canvasSaving

  const onFields = (s: boolean) => { setFieldsSaving(s); if (!s) setEverSaved(true) }
  const onCanvas = (s: boolean) => { setCanvasSaving(s); if (!s) setEverSaved(true) }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-border bg-background px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href={`/${username}`} className="p-2 hover:bg-muted rounded-lg transition" aria-label="Back to profile">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <span className="text-lg font-bold">Edit profile</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {saving ? (
              <><Save className="w-4 h-4 animate-pulse" /><span>Saving…</span></>
            ) : everSaved ? (
              <><Check className="w-4 h-4 text-green-500" /><span>Saved</span></>
            ) : null}
          </div>
          <Link href={`/${username}`} className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:brightness-105 transition">
            <Eye className="w-4 h-4" /> View Profile
          </Link>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        <ProfileFieldsPanel user={user} onSavingChange={onFields} />
        <ProfileCanvasEditor
          displayId={displayId}
          initialSections={initialSections}
          initialBackground={initialBackground}
          initialSpacing={initialSpacing}
          initialVersion={initialVersion}
          onSavingChange={onCanvas}
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Implement the route (server)**

Create `src/app/profile/edit/page.tsx`:

```tsx
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { verify } from 'jsonwebtoken'
import { db } from '@/lib/db'
import { getJwtSecret } from '@/lib/auth'
import { AUTH_COOKIE } from '@/lib/constants'
import { ensureProfileCanvas } from '@/lib/profile-canvas'
import { ProfileEditor } from '@/components/profile/ProfileEditor'
import type { User } from '@/lib/types'
import type { Section } from '@/lib/types/canvas'
import type { BackgroundConfig } from '@/lib/types/background'
import type { SpacingConfig } from '@/lib/types/spacing'

export default async function ProfileEditPage() {
  const token = (await cookies()).get(AUTH_COOKIE)?.value
  let meId: string | null = null
  if (token) {
    try { meId = (verify(token, getJwtSecret()) as { userId: string }).userId } catch { meId = null }
  }
  if (!meId) redirect('/login')

  const user = await db.user.findUnique({
    where: { id: meId },
    select: {
      id: true, email: true, username: true, name: true, avatar: true, bio: true,
      location: true, interests: true, links: true, featuredDisplayId: true, profileDisplayId: true,
    },
  })
  if (!user) redirect('/login')

  const displayId = await ensureProfileCanvas(user.id)
  const canvas = await db.display.findUnique({
    where: { id: displayId },
    select: { sections: true, background: true, spacing: true, version: true },
  })

  const initialSections = (canvas ? (typeof canvas.sections === 'string' ? JSON.parse(canvas.sections) : canvas.sections) : []) as Section[]
  const initialBackground = (canvas ? (typeof canvas.background === 'string' ? JSON.parse(canvas.background) : canvas.background) : null) as BackgroundConfig | null
  const initialSpacing = (canvas ? (typeof canvas.spacing === 'string' ? JSON.parse(canvas.spacing) : canvas.spacing) : null) as SpacingConfig | null

  const ownerUser: User = {
    id: user.id,
    email: user.email,
    username: user.username,
    name: user.name ?? undefined,
    avatar: user.avatar ?? undefined,
    bio: user.bio ?? undefined,
    location: user.location,
    interests: user.interests,
    links: (user.links as { label: string; url: string }[] | null) || [],
    featuredDisplayId: user.featuredDisplayId,
  }

  return (
    <ProfileEditor
      username={user.username}
      user={ownerUser}
      displayId={displayId}
      initialSections={initialSections}
      initialBackground={initialBackground}
      initialSpacing={initialSpacing}
      initialVersion={canvas?.version ?? 0}
    />
  )
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0. (If the `User` type's optional fields differ, mirror the exact shape used in `src/app/[username]/page.tsx`'s `ownerUser`.)

- [ ] **Step 4: Live-verify the route**

- Signed out: visit `http://localhost:3000/profile/edit` → redirects to `/login`.
- Signed in (browser session): visit `/profile/edit` → shows "Edit profile" header, the fields panel (pre-filled), and the canvas with the `/` prompt. Header shows **View Profile**.

- [ ] **Step 5: Commit**

```bash
git add src/components/profile/ProfileEditor.tsx src/app/profile/edit/page.tsx
git commit -m "feat(profile): unified /profile/edit editor screen"
```

---

### Task 5: Repoint entry points, retire the modal

**Files:**
- Modify: `src/components/profile/ProfileOwnerControls.tsx`
- Modify: `src/components/profile/ProfileCanvasBar.tsx`
- Delete: `src/components/profile/EditProfileModal.tsx`

**Interfaces:**
- Consumes: `ProfileEditor` route `/profile/edit` (Task 4).

- [ ] **Step 1: Route "Edit profile" to the new editor**

Replace `src/components/profile/ProfileOwnerControls.tsx` with (drops `EditProfileModal`; the ID-card edit button navigates):

```tsx
'use client'

import { useRouter } from 'next/navigation'
import { ProfileIdCard } from '@/components/profile/ProfileIdCard'
import type { User } from '@/lib/types'

export function ProfileOwnerControls({
  user,
  followerCount,
  followingCount,
}: {
  user: User
  followerCount: number
  followingCount: number
}) {
  const router = useRouter()
  return (
    <ProfileIdCard
      user={{
        username: user.username,
        name: user.name ?? null,
        avatar: user.avatar ?? null,
        location: user.location ?? null,
      }}
      followerCount={followerCount}
      followingCount={followingCount}
      isOwner
      isFollowing={false}
      isFriend={false}
      onEdit={() => router.push('/profile/edit')}
    />
  )
}
```

- [ ] **Step 2: Route the canvas bar to the new editor**

In `src/components/profile/ProfileCanvasBar.tsx`, replace the `go` handler so it always navigates (no POST — the route ensures the canvas):

```tsx
'use client'

import { useRouter } from 'next/navigation'
import { Wand2 } from 'lucide-react'

export function ProfileCanvasBar({
  hasCanvas,
}: {
  hasCanvas: boolean
  profileDisplayId?: string | null
}) {
  const router = useRouter()
  return (
    <div className="mt-6 flex items-center justify-between gap-4 p-4 rounded-2xl border border-dashed border-border bg-surface">
      <p className="text-sm text-muted-foreground">
        {hasCanvas ? 'Your custom profile canvas.' : 'Add a custom canvas to your profile — text, images, anything.'}
      </p>
      <button
        onClick={() => router.push('/profile/edit')}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold shadow-soft hover:brightness-105 transition-all cursor-pointer"
      >
        <Wand2 className="w-4 h-4" /> {hasCanvas ? 'Edit canvas' : 'Customize your profile'}
      </button>
    </div>
  )
}
```

Note: the `profileDisplayId` prop is kept optional for call-site compatibility (`src/app/[username]/page.tsx` still passes it) but is now unused.

- [ ] **Step 3: Delete the modal**

```bash
git rm src/components/profile/EditProfileModal.tsx
```

- [ ] **Step 4: Verify nothing else imports the modal**

Run: `grep -rn "EditProfileModal" src/`
Expected: no matches.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/components/profile/ProfileOwnerControls.tsx src/components/profile/ProfileCanvasBar.tsx
git commit -m "feat(profile): route Edit profile + Customize to /profile/edit; retire modal"
```

---

### Task 6: Full verification

**Files:** none (verification + optional deploy).

- [ ] **Step 1: Typecheck + tests**

Run: `npx tsc --noEmit && npx vitest run`
Expected: tsc exit 0; all tests pass (including the new `ProfileFieldsPanel` tests).

- [ ] **Step 2: End-to-end live check** (dev server running)

Sign in in the browser, then:
1. Profile `/{username}` → click **Edit profile** → lands on `/profile/edit` (no hop to `/editor`).
2. Edit **Name** → header shows "Saving…" then "Saved ✓". Click **View Profile** → name updated on `/{username}`.
3. Back to `/profile/edit` → in the canvas press `/`, add a **Text** element, type → autosaves.
4. Click **View Profile** → the new element renders in the read-only `ProfileCanvas` on the profile.
5. Open **Background** and **Spacing** in the canvas toolbar, change values → persist and show on the public profile.
6. From the profile, the **Customize / Edit canvas** bar button also lands on `/profile/edit`.

- [ ] **Step 3: Deploy (per fix→push→deploy cadence)**

```bash
git push origin main
```
Then confirm the Vercel production deployment goes **Ready** and takes the `mygalli.com` alias:

```bash
vercel ls my-galli
```

---

## Notes for the implementer

- `ProfileCanvasEditor` intentionally duplicates a slice of `PageEditor`'s canvas handlers. Do **not** refactor `PageEditor` as part of this plan (out of scope; flagged in the spec's "Known tradeoff").
- No schema migration and no new API routes — everything rides on existing endpoints.
- The profile Display is always `published: true`; never add a publish toggle here.
