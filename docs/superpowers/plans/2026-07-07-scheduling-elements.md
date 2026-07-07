# Scheduling Elements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three scheduling capabilities to Galli — a free **Calendar** element (mark days), a Pro **Appointments** element (Calendly-style booking), and an "Open now" badge on the existing **Business Hours** element.

**Architecture:** Calendar is pure element JSON (no DB, like `flowchart`). Appointments stores availability config in element JSON but bookings in a new `Booking` Prisma table, with public GET/POST + owner + cancel API routes and Resend confirmation emails; all slot/timezone math lives in a unit-tested pure module `src/lib/appointments.ts`. Business Hours gains a pure `isOpenNow` helper. A new slash-menu category "Scheduling" groups all three.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Prisma + PostgreSQL, Zustand, Tailwind, Resend (email), Vitest (`pnpm test`), `Intl.DateTimeFormat` for timezone math (no new dependency).

## Global Constraints

- **DB env:** every DB/prisma command MUST be prefixed `DATABASE_URL="postgresql://pages:pages@127.0.0.1:5434/pages"` (machine `DATABASE_URL` otherwise points at the wrong DB). Use `127.0.0.1`, never `localhost`.
- **Migrations are non-interactive:** NEVER `prisma migrate dev`. Generate SQL via `prisma migrate diff --from-url $DATABASE_URL --to-schema-datamodel prisma/schema.prisma --script` → write to `prisma/migrations/<timestamp>_<name>/migration.sql` → `prisma migrate deploy`.
- **Windows build race:** do not run `pnpm build` while `pnpm dev` runs. Verify with `pnpm exec tsc --noEmit` + `pnpm test`.
- **Element registration (per CLAUDE.md):** a new element type touches exactly these files — `src/lib/types/canvas.ts` (union + fields + `createElement` default), `src/components/elements/{X,PublicX}.tsx`, `src/components/canvas/SlashCommandMenu.tsx` (entry + `CATEGORY_ORDER`), `src/components/canvas/ColumnCanvas.tsx` (renderElement switch), `src/components/elements/index.ts` (barrel), `src/lib/render-elements.tsx` (published-page case).
- **Editor element props:** `{ element, onChange, onDelete, isSelected, onSelect }`. **Public element props:** `{ element }`.
- **Pro gate:** `import { isPro } from '@/lib/plan'`; `isPro(user)` returns `user?.plan === 'pro'`.
- **Email:** `import { sendEmail } from '@/lib/email'`; `sendEmail({ to, subject, html })`. In dev (no `RESEND_API_KEY`) it logs to console.
- **Brand colors:** primary green `#39D98A`, anchor `#0F3D2E`. Tailwind tokens `text-foreground`, `text-muted-foreground`, `border-border`, `bg-background`.
- **Commit after every task.** Commit messages end with the two trailer lines used across this repo (Co-Authored-By + Claude-Session) — omitted from snippets below for brevity; add them.

---

## File Structure

**New files:**
- `src/lib/business-hours.ts` (+ `.test.ts`) — pure `isOpenNow`.
- `src/lib/appointments.ts` (+ `.test.ts`) — pure slot generation + validation + tz math.
- `src/components/elements/CalendarElement.tsx` + `PublicCalendarElement.tsx`.
- `src/components/elements/AppointmentsElement.tsx` + `PublicAppointmentsElement.tsx`.
- `src/app/api/appointments/[displayId]/route.ts` — public GET (slots) + POST (book).
- `src/app/api/appointments/[displayId]/bookings/route.ts` — owner-only GET.
- `src/app/api/appointments/cancel/[token]/route.ts` — public POST (cancel).
- `src/app/appointments/cancel/[token]/page.tsx` — friendly cancel UI.
- `prisma/migrations/<ts>_add_booking/migration.sql`.

**Modified files:**
- `prisma/schema.prisma` — `Booking` model + `Display.bookings` relation.
- `src/lib/types/canvas.ts` — two element types, fields, two `createElement` defaults.
- `src/lib/email.ts` — three booking email templates.
- `src/components/elements/PublicBusinessHoursElement.tsx` — badge.
- `src/components/canvas/SlashCommandMenu.tsx` — two entries + "Scheduling" category.
- `src/components/canvas/ColumnCanvas.tsx` — two renderElement cases.
- `src/components/elements/index.ts` — barrel exports.
- `src/lib/render-elements.tsx` — two published-page cases.

---

## Task 1: Business Hours "Open now" badge

**Files:**
- Create: `src/lib/business-hours.ts`
- Test: `src/lib/business-hours.test.ts`
- Modify: `src/components/elements/PublicBusinessHoursElement.tsx`

**Interfaces:**
- Produces: `parseTimeToMinutes(s: string): number | null`, `isOpenNow(schedule: BizDay[], now: Date): { open: boolean; label: string }` where `BizDay = { day: string; open: string; close: string; closed: boolean }`.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/business-hours.test.ts
import { describe, it, expect } from 'vitest'
import { parseTimeToMinutes, isOpenNow } from './business-hours'

const week = [
  { day: 'Sunday', open: '', close: '', closed: true },
  { day: 'Monday', open: '9:00 AM', close: '5:00 PM', closed: false },
  { day: 'Tuesday', open: '9:00 AM', close: '5:00 PM', closed: false },
  { day: 'Wednesday', open: '9:00 AM', close: '5:00 PM', closed: false },
  { day: 'Thursday', open: '9:00 AM', close: '5:00 PM', closed: false },
  { day: 'Friday', open: '9:00 AM', close: '5:00 PM', closed: false },
  { day: 'Saturday', open: '10:00 AM', close: '2:00 PM', closed: false },
]

describe('parseTimeToMinutes', () => {
  it('parses am/pm', () => {
    expect(parseTimeToMinutes('9:00 AM')).toBe(540)
    expect(parseTimeToMinutes('5:00 PM')).toBe(1020)
    expect(parseTimeToMinutes('12:00 PM')).toBe(720)
    expect(parseTimeToMinutes('12:00 AM')).toBe(0)
  })
  it('returns null on garbage', () => {
    expect(parseTimeToMinutes('nope')).toBeNull()
    expect(parseTimeToMinutes('')).toBeNull()
  })
})

describe('isOpenNow', () => {
  // Monday 2026-07-06 is a Monday; 13:00 local
  it('open mid-window', () => {
    const now = new Date(2026, 6, 6, 13, 0) // Mon 1pm
    expect(isOpenNow(week, now).open).toBe(true)
  })
  it('closed before open', () => {
    const now = new Date(2026, 6, 6, 8, 0) // Mon 8am
    expect(isOpenNow(week, now).open).toBe(false)
  })
  it('closed after close', () => {
    const now = new Date(2026, 6, 6, 18, 0) // Mon 6pm
    expect(isOpenNow(week, now).open).toBe(false)
  })
  it('closed all day', () => {
    const now = new Date(2026, 6, 5, 13, 0) // Sun 1pm
    expect(isOpenNow(week, now).open).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/lib/business-hours.test.ts`
Expected: FAIL — cannot find module './business-hours'.

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/business-hours.ts
export interface BizDay { day: string; open: string; close: string; closed: boolean }

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export function parseTimeToMinutes(s: string): number | null {
  if (!s) return null
  const m = s.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
  if (!m) return null
  let h = parseInt(m[1], 10)
  const min = parseInt(m[2], 10)
  const mer = m[3].toUpperCase()
  if (h < 1 || h > 12 || min > 59) return null
  if (mer === 'AM') h = h === 12 ? 0 : h
  else h = h === 12 ? 12 : h + 12
  return h * 60 + min
}

export function isOpenNow(schedule: BizDay[], now: Date): { open: boolean; label: string } {
  const dayName = DAY_NAMES[now.getDay()]
  const today = schedule.find((d) => d.day === dayName)
  if (!today || today.closed) return { open: false, label: 'Closed' }
  const openM = parseTimeToMinutes(today.open)
  const closeM = parseTimeToMinutes(today.close)
  if (openM === null || closeM === null) return { open: false, label: 'Closed' }
  const nowM = now.getHours() * 60 + now.getMinutes()
  if (nowM >= openM && nowM < closeM) return { open: true, label: `Open now · until ${today.close}` }
  if (nowM < openM) return { open: false, label: `Closed · opens ${today.open}` }
  return { open: false, label: 'Closed' }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/lib/business-hours.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Render the badge**

In `src/components/elements/PublicBusinessHoursElement.tsx`, add at the top of the component body (after `const schedule = ...`):

```tsx
import { isOpenNow } from '@/lib/business-hours'
// ...
const status = schedule.length > 0 ? isOpenNow(schedule, new Date()) : null
```

Then replace the title block (the `element.bizHoursTitle &&` div) with a version that includes the pill:

```tsx
{(element.bizHoursTitle || status) && (
  <div className="flex items-center gap-3 flex-wrap">
    {element.bizHoursTitle && (
      <div className="flex items-center gap-2 text-lg font-bold text-foreground">
        <Clock className="w-5 h-5 text-amber-500" />
        {element.bizHoursTitle}
      </div>
    )}
    {status && (
      <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${
        status.open ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
      }`}>
        <span className={`w-1.5 h-1.5 rounded-full ${status.open ? 'bg-green-500' : 'bg-gray-400'}`} />
        {status.label}
      </span>
    )}
  </div>
)}
```

- [ ] **Step 6: Verify types + tests**

Run: `pnpm exec tsc --noEmit && pnpm test src/lib/business-hours.test.ts`
Expected: no type errors; tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/lib/business-hours.ts src/lib/business-hours.test.ts src/components/elements/PublicBusinessHoursElement.tsx
git commit -m "feat(business-hours): live Open now / Closed badge"
```

---

## Task 2: Calendar element — types + createElement default

**Files:**
- Modify: `src/lib/types/canvas.ts`

**Interfaces:**
- Produces: `ElementType` gains `'calendar'`; `CanvasElement` gains `calendarTitle?`, `calendarSubtitle?`, `calendarEvents?: CalendarEvent[]`; `CalendarEvent = { id: string; date: string; title: string; note?: string; color?: string }`.

- [ ] **Step 1: Add the type + interface + default**

In `src/lib/types/canvas.ts`:

1. Add to the `ElementType` union (near the `flowchart` line ~87):
```ts
  | 'calendar'      // Owner-marked month calendar of events
```

2. Add an exported interface (near other element sub-types, e.g. after `FlowNode`):
```ts
export interface CalendarEvent {
  id: string
  date: string // 'YYYY-MM-DD'
  title: string
  note?: string
  color?: string
}
```

3. Add fields to `CanvasElement` (near `flowNodes?`):
```ts
  calendarTitle?: string
  calendarSubtitle?: string
  calendarEvents?: CalendarEvent[]
```

4. Add a `createElement` case (near the `flowchart` case ~890). Note: no `Date.now()` in this repo's constrained contexts, but `createElement` is client-only editor code where `Date.now()` is fine — the ban is only in Workflow scripts. Use the same id style already used by neighboring cases (check the file; if they use `crypto.randomUUID()` or `Date.now()`, match it). Assuming the file's existing helper pattern:
```ts
    case 'calendar':
      return {
        ...base,
        type: 'calendar',
        calendarTitle: 'Calendar',
        calendarSubtitle: '',
        calendarEvents: [],
      }
```
(Where `base` is whatever the surrounding cases spread — match the exact local variable name used in this file's `createElement`.)

- [ ] **Step 2: Verify types**

Run: `pnpm exec tsc --noEmit`
Expected: no errors (a new union member with no renderer yet is fine until Task 3 wires the switches; if `ColumnCanvas`/`render-elements` have exhaustive switches that now error, that's expected and resolved in Task 3 — if so, note it and proceed).

- [ ] **Step 3: Commit**

```bash
git add src/lib/types/canvas.ts
git commit -m "feat(calendar): element type, CalendarEvent, createElement default"
```

---

## Task 3: Calendar element — editor + public components + wiring

**Files:**
- Create: `src/components/elements/CalendarElement.tsx`
- Create: `src/components/elements/PublicCalendarElement.tsx`
- Modify: `src/components/canvas/SlashCommandMenu.tsx`, `src/components/canvas/ColumnCanvas.tsx`, `src/components/elements/index.ts`, `src/lib/render-elements.tsx`

**Interfaces:**
- Consumes: `CalendarEvent`, `calendar*` fields from Task 2.
- Produces: `<CalendarElement>` (editor props), `<PublicCalendarElement>` (public props).

- [ ] **Step 1: Build a shared month-grid helper inline**

Both components need month math. Put this pure helper at the top of `PublicCalendarElement.tsx` and export it; the editor imports it.

```tsx
// src/components/elements/PublicCalendarElement.tsx
'use client'
import { useState } from 'react'
import type { CanvasElement, CalendarEvent } from '@/lib/types/canvas'

export function monthMatrix(year: number, month: number): (string | null)[] {
  // returns 42 cells of 'YYYY-MM-DD' or null (padding)
  const first = new Date(year, month, 1)
  const startPad = first.getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: (string | null)[] = []
  for (let i = 0; i < startPad; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) {
    const mm = String(month + 1).padStart(2, '0')
    const dd = String(d).padStart(2, '0')
    cells.push(`${year}-${mm}-${dd}`)
  }
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const todayIso = () => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-${String(n.getDate()).padStart(2,'0')}` }

interface Props { element: CanvasElement }

export function PublicCalendarElement({ element }: Props) {
  const events = element.calendarEvents ?? []
  const init = new Date()
  const [year, setYear] = useState(init.getFullYear())
  const [month, setMonth] = useState(init.getMonth())
  const [selected, setSelected] = useState<string | null>(null)

  const byDate = (iso: string) => events.filter((e) => e.date === iso)
  const cells = monthMatrix(year, month)
  const shift = (delta: number) => {
    const d = new Date(year, month + delta, 1)
    setYear(d.getFullYear()); setMonth(d.getMonth()); setSelected(null)
  }
  const upcoming = [...events]
    .filter((e) => e.date >= todayIso())
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 5)

  return (
    <div className="space-y-4">
      {element.calendarTitle && <h3 className="text-lg font-bold text-foreground">{element.calendarTitle}</h3>}
      {element.calendarSubtitle && <p className="text-sm text-muted-foreground">{element.calendarSubtitle}</p>}

      <div className="rounded-xl border border-border p-3">
        <div className="flex items-center justify-between mb-2">
          <button onClick={() => shift(-1)} className="px-2 py-1 rounded hover:bg-muted text-muted-foreground">‹</button>
          <div className="text-sm font-semibold text-foreground">{MONTHS[month]} {year}</div>
          <button onClick={() => shift(1)} className="px-2 py-1 rounded hover:bg-muted text-muted-foreground">›</button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center">
          {WD.map((w) => <div key={w} className="text-[10px] font-medium text-muted-foreground py-1">{w}</div>)}
          {cells.map((iso, i) => {
            if (!iso) return <div key={i} />
            const dayEvents = byDate(iso)
            const isToday = iso === todayIso()
            return (
              <button
                key={i}
                onClick={() => setSelected(dayEvents.length ? iso : null)}
                className={`aspect-square rounded-lg text-xs flex flex-col items-center justify-center gap-0.5 transition
                  ${isToday ? 'ring-1 ring-[#39D98A]' : ''}
                  ${dayEvents.length ? 'bg-muted/50 hover:bg-muted font-medium text-foreground cursor-pointer' : 'text-muted-foreground'}`}
              >
                <span>{parseInt(iso.slice(-2), 10)}</span>
                {dayEvents.length > 0 && (
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: dayEvents[0].color || '#39D98A' }} />
                )}
              </button>
            )
          })}
        </div>
      </div>

      {selected && (
        <div className="rounded-lg border border-border p-3 space-y-2">
          <div className="text-xs font-semibold text-muted-foreground">{selected}</div>
          {byDate(selected).map((e) => (
            <div key={e.id} className="text-sm">
              <span className="font-medium text-foreground" style={{ color: e.color || undefined }}>● </span>
              <span className="font-medium text-foreground">{e.title}</span>
              {e.note && <p className="text-xs text-muted-foreground">{e.note}</p>}
            </div>
          ))}
        </div>
      )}

      {upcoming.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Upcoming</div>
          {upcoming.map((e) => (
            <div key={e.id} className="flex items-center gap-2 text-sm">
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: e.color || '#39D98A' }} />
              <span className="text-muted-foreground w-24 flex-shrink-0">{e.date}</span>
              <span className="text-foreground">{e.title}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Build the editor**

```tsx
// src/components/elements/CalendarElement.tsx
'use client'
import { useState } from 'react'
import { Trash2, Plus, Calendar as CalIcon } from 'lucide-react'
import type { CanvasElement, CalendarEvent } from '@/lib/types/canvas'
import { monthMatrix } from './PublicCalendarElement'

interface Props {
  element: CanvasElement
  onChange: (updates: Partial<CanvasElement>) => void
  onDelete: () => void
  isSelected: boolean
  onSelect: () => void
}

const WD = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const SWATCHES = ['#39D98A', '#1FB6FF', '#6C63FF', '#F59E0B', '#EF4444']

export function CalendarElement({ element, onChange, onDelete, isSelected, onSelect }: Props) {
  const events = element.calendarEvents ?? []
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [activeDay, setActiveDay] = useState<string | null>(null)

  const shift = (d: number) => { const dt = new Date(year, month + d, 1); setYear(dt.getFullYear()); setMonth(dt.getMonth()) }
  const byDate = (iso: string) => events.filter((e) => e.date === iso)
  const newId = () => `evt-${Date.now()}-${Math.floor(Math.random() * 1e6)}`

  const addEvent = (iso: string) => {
    const evt: CalendarEvent = { id: newId(), date: iso, title: 'New event', color: '#39D98A' }
    onChange({ calendarEvents: [...events, evt] })
    setActiveDay(iso)
  }
  const updateEvent = (id: string, patch: Partial<CalendarEvent>) =>
    onChange({ calendarEvents: events.map((e) => (e.id === id ? { ...e, ...patch } : e)) })
  const removeEvent = (id: string) => onChange({ calendarEvents: events.filter((e) => e.id !== id) })

  const cells = monthMatrix(year, month)

  return (
    <div
      className={`relative group rounded-xl border bg-background transition-all ${isSelected ? 'ring-2 ring-[#39D98A] border-[#39D98A]/30' : 'border-border hover:border-[#39D98A]/30'}`}
      onClick={(e) => { e.stopPropagation(); onSelect() }}
    >
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <CalIcon className="w-4 h-4 text-[#39D98A]" />
          <input
            value={element.calendarTitle ?? ''} placeholder="Calendar title"
            onChange={(e) => onChange({ calendarTitle: e.target.value })}
            onClick={(e) => e.stopPropagation()}
            className="text-sm font-semibold bg-transparent border-none outline-none flex-1"
          />
        </div>
        <input
          value={element.calendarSubtitle ?? ''} placeholder="Subtitle (optional)"
          onChange={(e) => onChange({ calendarSubtitle: e.target.value })}
          onClick={(e) => e.stopPropagation()}
          className="w-full text-xs bg-transparent border border-border rounded px-2 py-1 outline-none"
        />

        <div className="flex items-center justify-between" onClick={(e) => e.stopPropagation()}>
          <button onClick={() => shift(-1)} className="px-2 text-muted-foreground hover:text-foreground">‹</button>
          <span className="text-xs font-semibold">{MONTHS[month]} {year}</span>
          <button onClick={() => shift(1)} className="px-2 text-muted-foreground hover:text-foreground">›</button>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center" onClick={(e) => e.stopPropagation()}>
          {WD.map((w, i) => <div key={i} className="text-[9px] text-muted-foreground">{w}</div>)}
          {cells.map((iso, i) => {
            if (!iso) return <div key={i} />
            const has = byDate(iso).length > 0
            return (
              <button key={i} onClick={() => (has ? setActiveDay(iso) : addEvent(iso))}
                className={`aspect-square rounded text-[10px] flex items-center justify-center ${has ? 'bg-[#39D98A]/15 text-foreground font-semibold' : 'text-muted-foreground hover:bg-muted'} ${activeDay === iso ? 'ring-1 ring-[#39D98A]' : ''}`}>
                {parseInt(iso.slice(-2), 10)}
              </button>
            )
          })}
        </div>
        <p className="text-[10px] text-muted-foreground">Tap a day to add an event.</p>

        {activeDay && (
          <div className="space-y-2 border-t border-border pt-2" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold text-muted-foreground">{activeDay}</span>
              <button onClick={() => addEvent(activeDay)} className="text-[10px] text-[#39D98A] flex items-center gap-1"><Plus className="w-3 h-3" />Add</button>
            </div>
            {byDate(activeDay).map((e) => (
              <div key={e.id} className="space-y-1 border border-border rounded p-2">
                <div className="flex items-center gap-1">
                  <input value={e.title} onChange={(ev) => updateEvent(e.id, { title: ev.target.value })}
                    className="flex-1 text-xs bg-transparent border-b border-border outline-none" />
                  <button onClick={() => removeEvent(e.id)}><Trash2 className="w-3 h-3 text-muted-foreground hover:text-red-500" /></button>
                </div>
                <input value={e.note ?? ''} placeholder="Note (optional)" onChange={(ev) => updateEvent(e.id, { note: ev.target.value })}
                  className="w-full text-[10px] bg-transparent border border-border rounded px-1.5 py-0.5 outline-none" />
                <div className="flex gap-1">
                  {SWATCHES.map((c) => (
                    <button key={c} onClick={() => updateEvent(e.id, { color: c })}
                      className={`w-4 h-4 rounded-full ${e.color === c ? 'ring-2 ring-offset-1 ring-foreground' : ''}`} style={{ background: c }} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {isSelected && (
        <button onClick={(e) => { e.stopPropagation(); onDelete() }}
          className="absolute -top-3 -right-3 p-1.5 bg-background border border-border rounded-md shadow-sm hover:bg-destructive hover:text-destructive-foreground transition">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Wire the slash menu**

In `src/components/canvas/SlashCommandMenu.tsx`:
1. Add `'Scheduling'` to `CATEGORY_ORDER` (line ~158), after `'Media'`:
```ts
const CATEGORY_ORDER = ['Content', 'Data & Visuals', 'Media', 'Scheduling', 'Live', 'Forms', 'Social', 'Apps', 'Kit']
```
2. Add an entry to the elements list (ensure `Calendar` icon is imported from `lucide-react` — it is already used elsewhere in the file):
```ts
  { id: 'calendar', label: 'Calendar', icon: Calendar, description: 'Mark events on a monthly calendar', category: 'Scheduling' },
```

- [ ] **Step 4: Wire ColumnCanvas + barrel + render-elements**

`src/components/elements/index.ts` — add:
```ts
export { CalendarElement } from './CalendarElement'
export { PublicCalendarElement } from './PublicCalendarElement'
```

`src/components/canvas/ColumnCanvas.tsx` — in `renderElement`, add a case mirroring how `flowchart` is handled (preview → Public, else editor). Match the exact local prop names used by neighboring cases:
```tsx
    case 'calendar':
      return isPreview
        ? <PublicCalendarElement element={element} />
        : <CalendarElement element={element} onChange={onChange} onDelete={onDelete} isSelected={isSelected} onSelect={onSelect} />
```
(Add the imports at the top from `@/components/elements`.)

`src/lib/render-elements.tsx` — add a case (published page):
```tsx
    case 'calendar':
      return <PublicCalendarElement element={element} />
```
(Import `PublicCalendarElement` at the top alongside the other public imports.)

- [ ] **Step 5: Verify**

Run: `pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/elements/CalendarElement.tsx src/components/elements/PublicCalendarElement.tsx src/components/elements/index.ts src/components/canvas/SlashCommandMenu.tsx src/components/canvas/ColumnCanvas.tsx src/lib/render-elements.tsx
git commit -m "feat(calendar): editor + public month-grid element, fully wired"
```

---

## Task 4: Appointments pure logic — `src/lib/appointments.ts`

This is the highest-risk task (timezone math). TDD strictly.

**Files:**
- Create: `src/lib/appointments.ts`
- Test: `src/lib/appointments.test.ts`

**Interfaces:**
- Produces:
  - `AppointmentConfig = { duration: number; timezone: string; weeklyRules: ApptRule[]; buffer: number; leadTimeHours: number; maxDaysAhead: number }`
  - `ApptRule = { day: number; start: string; end: string }` (day 0=Sun..6=Sat, start/end `'HH:MM'` 24h)
  - `Slot = { startUTC: string; endUTC: string }` (ISO strings)
  - `generateSlots(config, fromUTC: Date, toUTC: Date, nowUTC: Date): Slot[]`
  - `isSlotBookable(config, startUTC: string, nowUTC: Date): boolean`
  - `tzOffsetMinutes(timeZone: string, at: Date): number` (minutes to ADD to UTC to get local; e.g. America/New_York in July = -240)
  - `wallClockToUTC(timeZone, year, month1, day, hour, min): Date`

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/appointments.test.ts
import { describe, it, expect } from 'vitest'
import { tzOffsetMinutes, wallClockToUTC, generateSlots, isSlotBookable, type AppointmentConfig } from './appointments'

describe('tzOffsetMinutes', () => {
  it('New York is UTC-4 in July (DST)', () => {
    expect(tzOffsetMinutes('America/New_York', new Date('2026-07-15T12:00:00Z'))).toBe(-240)
  })
  it('New York is UTC-5 in January (standard)', () => {
    expect(tzOffsetMinutes('America/New_York', new Date('2026-01-15T12:00:00Z'))).toBe(-300)
  })
  it('UTC is zero', () => {
    expect(tzOffsetMinutes('UTC', new Date('2026-07-15T12:00:00Z'))).toBe(0)
  })
})

describe('wallClockToUTC', () => {
  it('9:00 in New York July → 13:00 UTC', () => {
    const d = wallClockToUTC('America/New_York', 2026, 7, 15, 9, 0)
    expect(d.toISOString()).toBe('2026-07-15T13:00:00.000Z')
  })
})

const cfg: AppointmentConfig = {
  duration: 30,
  timezone: 'America/New_York',
  weeklyRules: [{ day: 3, start: '09:00', end: '11:00' }], // Wednesday 9-11
  buffer: 0,
  leadTimeHours: 0,
  maxDaysAhead: 30,
}

describe('generateSlots', () => {
  it('produces 30-min slots within a Wednesday window', () => {
    // 2026-07-15 is a Wednesday
    const from = new Date('2026-07-13T00:00:00Z')
    const to = new Date('2026-07-16T00:00:00Z')
    const now = new Date('2026-07-01T00:00:00Z')
    const slots = generateSlots(cfg, from, to, now)
    // 9:00,9:30,10:00,10:30 = 4 slots (10:30-11:00 last; 11:00 excluded)
    expect(slots.length).toBe(4)
    expect(slots[0].startUTC).toBe('2026-07-15T13:00:00.000Z') // 9am ET = 13:00 UTC
    expect(slots[0].endUTC).toBe('2026-07-15T13:30:00.000Z')
  })
  it('honors buffer by widening the step', () => {
    const slots = generateSlots({ ...cfg, buffer: 30 }, new Date('2026-07-13T00:00:00Z'), new Date('2026-07-16T00:00:00Z'), new Date('2026-07-01T00:00:00Z'))
    // step = 60min → 9:00, 10:00 (10:30 slot would end 11:00 but next start 10:00 ok; 10:00-10:30 fits, next 11:00 excluded) = 9:00,10:00 = 2
    expect(slots.map((s) => s.startUTC)).toEqual(['2026-07-15T13:00:00.000Z', '2026-07-15T14:00:00.000Z'])
  })
  it('excludes slots before lead time', () => {
    const now = new Date('2026-07-15T13:15:00Z') // during the window
    const slots = generateSlots({ ...cfg, leadTimeHours: 24 }, new Date('2026-07-13T00:00:00Z'), new Date('2026-07-16T00:00:00Z'), now)
    expect(slots.length).toBe(0)
  })
  it('excludes slots beyond maxDaysAhead', () => {
    const now = new Date('2026-07-01T00:00:00Z')
    const slots = generateSlots({ ...cfg, maxDaysAhead: 5 }, new Date('2026-07-13T00:00:00Z'), new Date('2026-07-16T00:00:00Z'), now)
    expect(slots.length).toBe(0) // 7-15 is >5 days after 7-01
  })
})

describe('isSlotBookable', () => {
  it('accepts a valid generated slot', () => {
    expect(isSlotBookable(cfg, '2026-07-15T13:00:00.000Z', new Date('2026-07-01T00:00:00Z'))).toBe(true)
  })
  it('rejects an off-grid time', () => {
    expect(isSlotBookable(cfg, '2026-07-15T13:07:00.000Z', new Date('2026-07-01T00:00:00Z'))).toBe(false)
  })
  it('rejects a slot on a non-available day', () => {
    expect(isSlotBookable(cfg, '2026-07-14T13:00:00.000Z', new Date('2026-07-01T00:00:00Z'))).toBe(false) // Tuesday
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test src/lib/appointments.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// src/lib/appointments.ts
export interface ApptRule { day: number; start: string; end: string } // day 0=Sun..6=Sat, 'HH:MM'
export interface AppointmentConfig {
  duration: number
  timezone: string
  weeklyRules: ApptRule[]
  buffer: number
  leadTimeHours: number
  maxDaysAhead: number
}
export interface Slot { startUTC: string; endUTC: string }

const MS_MIN = 60_000
const MS_DAY = 86_400_000

// Minutes to ADD to a UTC instant to get wall-clock in timeZone.
export function tzOffsetMinutes(timeZone: string, at: Date): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
  const parts = dtf.formatToParts(at)
  const map: Record<string, number> = {}
  for (const p of parts) if (p.type !== 'literal') map[p.type] = parseInt(p.value, 10)
  // asUTC = the wall-clock numbers interpreted as if they were UTC
  const asUTC = Date.UTC(map.year, map.month - 1, map.day, map.hour === 24 ? 0 : map.hour, map.minute, map.second)
  return Math.round((asUTC - at.getTime()) / MS_MIN)
}

// Convert a wall-clock time in timeZone to the corresponding UTC instant.
export function wallClockToUTC(timeZone: string, year: number, month1: number, day: number, hour: number, min: number): Date {
  // First guess: treat wall clock as UTC, then correct by that instant's offset.
  const guess = new Date(Date.UTC(year, month1 - 1, day, hour, min))
  const offset = tzOffsetMinutes(timeZone, guess)
  let utc = new Date(guess.getTime() - offset * MS_MIN)
  // Re-check once for DST edges (offset may differ at the corrected instant).
  const offset2 = tzOffsetMinutes(timeZone, utc)
  if (offset2 !== offset) utc = new Date(guess.getTime() - offset2 * MS_MIN)
  return utc
}

const hm = (s: string) => { const [h, m] = s.split(':').map(Number); return h * 60 + m }

// Local Y/M/D in timeZone for a UTC instant.
function localYMD(timeZone: string, at: Date): { y: number; m: number; d: number; wd: number } {
  const off = tzOffsetMinutes(timeZone, at)
  const local = new Date(at.getTime() + off * MS_MIN)
  return { y: local.getUTCFullYear(), m: local.getUTCMonth() + 1, d: local.getUTCDate(), wd: local.getUTCDay() }
}

export function generateSlots(config: AppointmentConfig, fromUTC: Date, toUTC: Date, nowUTC: Date): Slot[] {
  const slots: Slot[] = []
  const step = config.duration + Math.max(0, config.buffer)
  const leadMs = config.leadTimeHours * 60 * MS_MIN
  const earliest = nowUTC.getTime() + leadMs
  const latest = nowUTC.getTime() + config.maxDaysAhead * MS_DAY

  // Iterate calendar days spanning the window (pad ±1 day for tz edges).
  for (let t = fromUTC.getTime() - MS_DAY; t <= toUTC.getTime() + MS_DAY; t += MS_DAY) {
    const { y, m, d, wd } = localYMD(config.timezone, new Date(t))
    for (const rule of config.weeklyRules) {
      if (rule.day !== wd) continue
      const startMin = hm(rule.start)
      const endMin = hm(rule.end)
      for (let mins = startMin; mins + config.duration <= endMin; mins += step) {
        const startUTC = wallClockToUTC(config.timezone, y, m, d, Math.floor(mins / 60), mins % 60)
        const endUTC = new Date(startUTC.getTime() + config.duration * MS_MIN)
        const ts = startUTC.getTime()
        if (ts < fromUTC.getTime() || ts >= toUTC.getTime()) continue
        if (ts < earliest || ts > latest) continue
        slots.push({ startUTC: startUTC.toISOString(), endUTC: endUTC.toISOString() })
      }
    }
  }
  // Dedup + sort (tz padding can double-count a boundary day).
  const seen = new Set<string>()
  return slots
    .filter((s) => (seen.has(s.startUTC) ? false : (seen.add(s.startUTC), true)))
    .sort((a, b) => a.startUTC.localeCompare(b.startUTC))
}

export function isSlotBookable(config: AppointmentConfig, startUTC: string, nowUTC: Date): boolean {
  const target = new Date(startUTC)
  if (isNaN(target.getTime())) return false
  // Window: from now to maxDaysAhead+1, generate and check membership.
  const from = new Date(nowUTC.getTime())
  const to = new Date(nowUTC.getTime() + (config.maxDaysAhead + 1) * MS_DAY)
  return generateSlots(config, from, to, nowUTC).some((s) => s.startUTC === target.toISOString())
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test src/lib/appointments.test.ts`
Expected: PASS (all cases, including DST). If a boundary count differs, fix the implementation — never loosen the test to match a bug.

- [ ] **Step 5: Commit**

```bash
git add src/lib/appointments.ts src/lib/appointments.test.ts
git commit -m "feat(appointments): pure slot generation + tz-safe booking validation"
```

---

## Task 5: Booking Prisma model + migration

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<ts>_add_booking/migration.sql`

**Interfaces:**
- Produces: `db.booking` with fields `id, displayId, elementId, start, end, name, email, note?, cancelToken, createdAt`.

- [ ] **Step 1: Add the model**

In `prisma/schema.prisma`, add:
```prisma
model Booking {
  id          String   @id @default(cuid())
  displayId   String
  elementId   String
  start       DateTime
  end         DateTime
  name        String
  email       String
  note        String?
  cancelToken String   @unique @default(cuid())
  createdAt   DateTime @default(now())

  display     Display  @relation(fields: [displayId], references: [id], onDelete: Cascade)

  @@unique([elementId, start])
  @@index([displayId])
  @@index([elementId, start])
}
```
And add to the `Display` model's field list:
```prisma
  bookings    Booking[]
```

- [ ] **Step 2: Generate the migration SQL**

Run (single line):
```bash
DATABASE_URL="postgresql://pages:pages@127.0.0.1:5434/pages" pnpm exec prisma migrate diff --from-url "postgresql://pages:pages@127.0.0.1:5434/pages" --to-schema-datamodel prisma/schema.prisma --script
```
Copy the output into a new file `prisma/migrations/20260707000000_add_booking/migration.sql` (use a timestamp greater than the latest existing migration folder).

- [ ] **Step 3: Apply the migration**

```bash
DATABASE_URL="postgresql://pages:pages@127.0.0.1:5434/pages" pnpm exec prisma migrate deploy
DATABASE_URL="postgresql://pages:pages@127.0.0.1:5434/pages" pnpm exec prisma generate
```
Expected: migration applied; client regenerated. (On Windows, `prisma generate` may EPERM if dev server holds the engine — stop dev and retry; non-blocking.)

- [ ] **Step 4: Verify the client knows the model**

Run: `pnpm exec tsc --noEmit`
Expected: no errors (do a throwaway `db.booking.findMany` in a scratch check if needed, then remove).

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(appointments): Booking model + migration"
```

---

## Task 6: Booking email templates

**Files:**
- Modify: `src/lib/email.ts`

**Interfaces:**
- Produces: `bookingConfirmedEmail(args)`, `bookingReceivedEmail(args)`, `bookingCancelledEmail(args)` each returning `{ subject, html }`. `args = { name: string; when: string; meetingTitle: string; location?: string; cancelUrl?: string }`.

- [ ] **Step 1: Add templates**

Append to `src/lib/email.ts`:
```ts
interface BookingArgs { name: string; when: string; meetingTitle: string; location?: string; cancelUrl?: string }

export function bookingConfirmedEmail(a: BookingArgs) {
  const loc = a.location ? `<br/>Location: ${a.location}` : ''
  return {
    subject: `Confirmed: ${a.meetingTitle} — ${a.when}`,
    html: shell(
      'Your booking is confirmed',
      `Hi ${a.name}, you're booked for <strong>${a.meetingTitle}</strong> on <strong>${a.when}</strong>.${loc}`,
      { href: a.cancelUrl || '#', label: a.cancelUrl ? 'Cancel booking' : 'View' }
    ),
  }
}

export function bookingReceivedEmail(a: BookingArgs) {
  return {
    subject: `New booking: ${a.meetingTitle} — ${a.when}`,
    html: shell(
      'You have a new booking',
      `${a.name} booked <strong>${a.meetingTitle}</strong> on <strong>${a.when}</strong>.`,
      { href: a.cancelUrl || '#', label: 'Manage' }
    ),
  }
}

export function bookingCancelledEmail(a: BookingArgs) {
  return {
    subject: `Cancelled: ${a.meetingTitle} — ${a.when}`,
    html: shell(
      'Booking cancelled',
      `The booking for <strong>${a.meetingTitle}</strong> on <strong>${a.when}</strong> has been cancelled.`,
      { href: '#', label: 'OK' }
    ),
  }
}
```

- [ ] **Step 2: Verify + commit**

Run: `pnpm exec tsc --noEmit`
```bash
git add src/lib/email.ts
git commit -m "feat(appointments): booking email templates"
```

---

## Task 7: Appointments API — public slots + book, owner list, cancel

**Files:**
- Create: `src/app/api/appointments/[displayId]/route.ts`
- Create: `src/app/api/appointments/[displayId]/bookings/route.ts`
- Create: `src/app/api/appointments/cancel/[token]/route.ts`

**Interfaces:**
- Consumes: `generateSlots`, `isSlotBookable`, `AppointmentConfig` (Task 4); `db.booking` (Task 5); `sendEmail`, `booking*Email` (Task 6); `isPro` (`@/lib/plan`); `rateLimit` (`@/lib/rate-limit`); `getUser` (`@/lib/auth`).
- Produces: the three routes below.

**Shared helper** — put at the top of `[displayId]/route.ts` and import into the others, OR duplicate the small `findApptElement` (≤15 lines). To keep it DRY, create `src/lib/appointments-server.ts`:

- [ ] **Step 1: Create the server helper**

```ts
// src/lib/appointments-server.ts
import { db } from '@/lib/db'
import type { AppointmentConfig } from '@/lib/appointments'

// Deep-walk a Display's section JSON to find an appointments element by id.
export function findApptElement(sections: any, elementId: string): any | null {
  if (!Array.isArray(sections)) return null
  for (const section of sections) {
    for (const col of section?.columns ?? []) {
      for (const el of col?.elements ?? []) {
        if (el?.id === elementId && el?.type === 'appointments') return el
      }
    }
  }
  return null
}

export function elementToConfig(el: any): AppointmentConfig {
  return {
    duration: el.apptDuration ?? 30,
    timezone: el.apptTimezone || 'UTC',
    weeklyRules: Array.isArray(el.apptWeeklyRules) ? el.apptWeeklyRules : [],
    buffer: el.apptBuffer ?? 0,
    leadTimeHours: el.apptLeadTimeHours ?? 12,
    maxDaysAhead: el.apptMaxDaysAhead ?? 30,
  }
}

// Load a published display + its appointments element across all tabs.
export async function loadApptContext(displayId: string, elementId: string) {
  const display = await db.display.findUnique({
    where: { id: displayId },
    select: { id: true, userId: true, published: true, sections: true, tabs: true, user: { select: { plan: true } } },
  })
  if (!display) return null
  // Search main sections then each tab's sections.
  let el = findApptElement(display.sections as any, elementId)
  if (!el && Array.isArray(display.tabs)) {
    for (const tab of display.tabs as any[]) {
      el = findApptElement(tab?.sections, elementId)
      if (el) break
    }
  }
  return el ? { display, el } : null
}
```
(Verify the actual section JSON shape — `section.columns[].elements[]` — matches this repo by checking one element-walk already in the codebase, e.g. the live-feed `findLiveFeedIds` reconcile in `src/app/api/displays/[id]/route.ts`. Mirror that exact traversal.)

- [ ] **Step 2: Public slots + booking route**

```ts
// src/app/api/appointments/[displayId]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { rateLimit } from '@/lib/rate-limit'
import { isPro } from '@/lib/plan'
import { generateSlots, isSlotBookable } from '@/lib/appointments'
import { loadApptContext, elementToConfig } from '@/lib/appointments-server'
import { sendEmail, bookingConfirmedEmail, bookingReceivedEmail } from '@/lib/email'

type Params = { params: Promise<{ displayId: string }> }
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

// GET public: available slots with taken flag. No PII.
export async function GET(request: NextRequest, { params }: Params) {
  const { displayId } = await params
  const elementId = request.nextUrl.searchParams.get('elementId')
  if (!elementId) return NextResponse.json({ error: 'elementId required' }, { status: 400 })
  const limited = await rateLimit(request, { limit: 120, windowMs: 60_000, prefix: `appt-read:${displayId}` })
  if (limited) return limited

  const ctx = await loadApptContext(displayId, elementId)
  if (!ctx || !ctx.display.published) return NextResponse.json({ slots: [], available: false })
  if (!isPro(ctx.display.user)) return NextResponse.json({ slots: [], available: false })

  const config = elementToConfig(ctx.el)
  const now = new Date()
  const to = new Date(now.getTime() + (config.maxDaysAhead + 1) * 86_400_000)
  const slots = generateSlots(config, now, to, now)

  const taken = await db.booking.findMany({
    where: { elementId, start: { gte: now } },
    select: { start: true },
  })
  const takenSet = new Set(taken.map((b) => b.start.toISOString()))
  return NextResponse.json({
    available: true,
    timezone: config.timezone,
    slots: slots.map((s) => ({ ...s, taken: takenSet.has(s.startUTC) })),
  }, { headers: { 'Cache-Control': 'no-store' } })
}

// POST public: create a booking.
export async function POST(request: NextRequest, { params }: Params) {
  const { displayId } = await params
  const limited = await rateLimit(request, { limit: 10, windowMs: 60_000, prefix: 'appt-book' })
  if (limited) return limited

  let body: { elementId?: string; startUTC?: string; name?: string; email?: string; note?: string }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }
  const { elementId, startUTC, name, email, note } = body
  if (!elementId || !startUTC || !name || !email) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return NextResponse.json({ error: 'Invalid email' }, { status: 400 })

  const ctx = await loadApptContext(displayId, elementId)
  if (!ctx || !ctx.display.published) return NextResponse.json({ error: 'Not available' }, { status: 404 })
  if (!isPro(ctx.display.user)) return NextResponse.json({ error: 'Booking unavailable' }, { status: 403 })

  const config = elementToConfig(ctx.el)
  if (!isSlotBookable(config, startUTC, new Date())) return NextResponse.json({ error: 'Slot not available' }, { status: 400 })

  const start = new Date(startUTC)
  const end = new Date(start.getTime() + config.duration * 60_000)

  let booking
  try {
    booking = await db.booking.create({
      data: { displayId, elementId, start, end, name: name.slice(0, 120), email: email.slice(0, 200), note: note?.slice(0, 1000) || null },
    })
  } catch (e: any) {
    if (e?.code === 'P2002') return NextResponse.json({ error: 'That time was just booked' }, { status: 409 })
    throw e
  }

  const meetingTitle = ctx.el.apptTitle || 'Appointment'
  const when = new Intl.DateTimeFormat('en-US', {
    timeZone: config.timezone, dateStyle: 'full', timeStyle: 'short',
  }).format(start) + ` (${config.timezone})`
  const cancelUrl = `${APP_URL}/appointments/cancel/${booking.cancelToken}`
  const location = ctx.el.apptLocationDetail || undefined

  const owner = await db.user.findUnique({ where: { id: ctx.display.userId }, select: { email: true } })
  const visitorMail = bookingConfirmedEmail({ name, when, meetingTitle, location, cancelUrl })
  await sendEmail({ to: email, ...visitorMail })
  if (owner?.email) {
    const ownerMail = bookingReceivedEmail({ name, when, meetingTitle, location, cancelUrl })
    await sendEmail({ to: owner.email, ...ownerMail })
  }

  return NextResponse.json({ ok: true, when, cancelUrl })
}
```

- [ ] **Step 3: Owner bookings route**

```ts
// src/app/api/appointments/[displayId]/bookings/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'

type Params = { params: Promise<{ displayId: string }> }

export async function GET(request: NextRequest, { params }: Params) {
  const { displayId } = await params
  const elementId = request.nextUrl.searchParams.get('elementId')
  const user = await getUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const display = await db.display.findUnique({ where: { id: displayId }, select: { userId: true } })
  if (!display) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (display.userId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const bookings = await db.booking.findMany({
    where: { displayId, ...(elementId ? { elementId } : {}), start: { gte: new Date() } },
    orderBy: { start: 'asc' },
    select: { id: true, start: true, end: true, name: true, email: true, note: true },
  })
  return NextResponse.json({ bookings }, { headers: { 'Cache-Control': 'no-store' } })
}
```

- [ ] **Step 4: Cancel route**

```ts
// src/app/api/appointments/cancel/[token]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { rateLimit } from '@/lib/rate-limit'
import { sendEmail, bookingCancelledEmail } from '@/lib/email'
import { loadApptContext, elementToConfig } from '@/lib/appointments-server'

type Params = { params: Promise<{ token: string }> }

export async function POST(request: NextRequest, { params }: Params) {
  const { token } = await params
  const limited = await rateLimit(request, { limit: 20, windowMs: 60_000, prefix: 'appt-cancel' })
  if (limited) return limited

  const booking = await db.booking.findUnique({ where: { cancelToken: token } })
  if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 })

  await db.booking.delete({ where: { id: booking.id } })

  // Best-effort cancellation emails (config lookup for a nice "when" label).
  const ctx = await loadApptContext(booking.displayId, booking.elementId)
  const tz = ctx ? elementToConfig(ctx.el).timezone : 'UTC'
  const meetingTitle = ctx?.el?.apptTitle || 'Appointment'
  const when = new Intl.DateTimeFormat('en-US', { timeZone: tz, dateStyle: 'full', timeStyle: 'short' }).format(booking.start) + ` (${tz})`
  const mail = bookingCancelledEmail({ name: booking.name, when, meetingTitle })
  await sendEmail({ to: booking.email, ...mail })
  const owner = await db.user.findUnique({ where: { id: ctx?.display.userId ?? '' }, select: { email: true } }).catch(() => null)
  if (owner?.email) await sendEmail({ to: owner.email, ...mail })

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 5: Verify + commit**

Run: `pnpm exec tsc --noEmit`
Expected: no errors.
```bash
git add src/lib/appointments-server.ts src/app/api/appointments/
git commit -m "feat(appointments): public slots+book, owner list, token cancel API"
```

---

## Task 8: Cancel confirmation page

**Files:**
- Create: `src/app/appointments/cancel/[token]/page.tsx`

- [ ] **Step 1: Build the page (client)**

```tsx
// src/app/appointments/cancel/[token]/page.tsx
'use client'
import { use, useState } from 'react'

export default function CancelPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')

  const cancel = async () => {
    setState('loading')
    const res = await fetch(`/api/appointments/cancel/${token}`, { method: 'POST' })
    setState(res.ok ? 'done' : 'error')
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="max-w-md w-full text-center space-y-4 rounded-2xl border border-border p-8">
        {state === 'done' ? (
          <>
            <h1 className="text-xl font-bold text-foreground">Booking cancelled</h1>
            <p className="text-sm text-muted-foreground">Your appointment has been cancelled. A confirmation email is on its way.</p>
          </>
        ) : state === 'error' ? (
          <>
            <h1 className="text-xl font-bold text-foreground">Link expired</h1>
            <p className="text-sm text-muted-foreground">This booking may already be cancelled or the link is invalid.</p>
          </>
        ) : (
          <>
            <h1 className="text-xl font-bold text-foreground">Cancel this booking?</h1>
            <p className="text-sm text-muted-foreground">This frees the time slot for others. This can't be undone.</p>
            <button onClick={cancel} disabled={state === 'loading'}
              className="w-full py-2.5 rounded-full bg-red-500 text-white font-semibold hover:bg-red-600 disabled:opacity-50">
              {state === 'loading' ? 'Cancelling…' : 'Cancel booking'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify + commit**

Run: `pnpm exec tsc --noEmit`
```bash
git add src/app/appointments/
git commit -m "feat(appointments): friendly cancel confirmation page"
```

---

## Task 9: Appointments element — types + createElement default

**Files:**
- Modify: `src/lib/types/canvas.ts`

**Interfaces:**
- Produces: `ElementType` gains `'appointments'`; `ApptRule` type; `CanvasElement` gains `apptTitle?, apptDuration?, apptTimezone?, apptWeeklyRules?: ApptRule[], apptBuffer?, apptLeadTimeHours?, apptMaxDaysAhead?, apptLocationType?, apptLocationDetail?, apptNoteLabel?`.

- [ ] **Step 1: Add type + fields + default**

1. Union (after `'calendar'`):
```ts
  | 'appointments'  // Calendly-style bookable time slots (Pro)
```
2. Interface (reuse the shape from `src/lib/appointments.ts` but define a local UI type to avoid a client→server import; keep them structurally identical):
```ts
export interface ApptRule { day: number; start: string; end: string }
```
3. `CanvasElement` fields:
```ts
  apptTitle?: string
  apptDuration?: number
  apptTimezone?: string
  apptWeeklyRules?: ApptRule[]
  apptBuffer?: number
  apptLeadTimeHours?: number
  apptMaxDaysAhead?: number
  apptLocationType?: 'video' | 'phone' | 'in-person' | 'custom'
  apptLocationDetail?: string
  apptNoteLabel?: string
```
4. `createElement` case:
```ts
    case 'appointments':
      return {
        ...base,
        type: 'appointments',
        apptTitle: '30-min intro call',
        apptDuration: 30,
        apptTimezone: typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'UTC',
        apptWeeklyRules: [
          { day: 1, start: '09:00', end: '17:00' },
          { day: 2, start: '09:00', end: '17:00' },
          { day: 3, start: '09:00', end: '17:00' },
          { day: 4, start: '09:00', end: '17:00' },
          { day: 5, start: '09:00', end: '17:00' },
        ],
        apptBuffer: 0,
        apptLeadTimeHours: 12,
        apptMaxDaysAhead: 30,
        apptLocationType: 'video',
        apptLocationDetail: '',
        apptNoteLabel: 'Anything I should know?',
      }
```

- [ ] **Step 2: Verify + commit**

Run: `pnpm exec tsc --noEmit`
```bash
git add src/lib/types/canvas.ts
git commit -m "feat(appointments): element type + config fields + default"
```

---

## Task 10: Appointments editor component (Pro-gated)

**Files:**
- Create: `src/components/elements/AppointmentsElement.tsx`

**Interfaces:**
- Consumes: `appt*` fields (Task 9); the owner bookings route (Task 7); Pro state.

Note on Pro state in the editor: check how existing Pro editor elements (e.g. `WhiteboardElement`) read the current user's plan — likely a Zustand auth store (`useAuthStore`/`setAuth`). Mirror that exact hook. Below assumes `useAuthStore((s) => s.user)`.

- [ ] **Step 1: Build the editor**

```tsx
// src/components/elements/AppointmentsElement.tsx
'use client'
import { useEffect, useState } from 'react'
import { Trash2, CalendarClock, Lock } from 'lucide-react'
import type { CanvasElement, ApptRule } from '@/lib/types/canvas'
import { isPro } from '@/lib/plan'
import { useAuthStore } from '@/lib/store' // adjust to the real auth store path/hook

interface Props {
  element: CanvasElement
  onChange: (updates: Partial<CanvasElement>) => void
  onDelete: () => void
  isSelected: boolean
  onSelect: () => void
}
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function AppointmentsElement({ element, onChange, onDelete, isSelected, onSelect }: Props) {
  const user = useAuthStore((s) => s.user)
  const pro = isPro(user)
  const rules = element.apptWeeklyRules ?? []
  const [bookings, setBookings] = useState<{ id: string; start: string; name: string }[]>([])

  useEffect(() => {
    if (!pro || !element.displayId) return // displayId may be injected by editor context; if unavailable, skip
    // NOTE: fetch owner bookings; requires the page be saved so displayId exists.
    const dId = (element as any)._displayId
    if (!dId) return
    fetch(`/api/appointments/${dId}/bookings?elementId=${element.id}`)
      .then((r) => (r.ok ? r.json() : { bookings: [] }))
      .then((d) => setBookings(d.bookings ?? []))
      .catch(() => {})
  }, [pro, element.id])

  const setRuleForDay = (day: number, enabled: boolean) => {
    if (enabled) onChange({ apptWeeklyRules: [...rules, { day, start: '09:00', end: '17:00' }] })
    else onChange({ apptWeeklyRules: rules.filter((r) => r.day !== day) })
  }
  const updateRule = (day: number, patch: Partial<ApptRule>) =>
    onChange({ apptWeeklyRules: rules.map((r) => (r.day === day ? { ...r, ...patch } : r)) })

  if (!pro) {
    return (
      <div className={`relative rounded-xl border-2 border-dashed border-[#6C63FF]/40 bg-[#6C63FF]/5 p-6 text-center ${isSelected ? 'ring-2 ring-[#6C63FF]' : ''}`}
        onClick={(e) => { e.stopPropagation(); onSelect() }}>
        <Lock className="w-6 h-6 text-[#6C63FF] mx-auto mb-2" />
        <p className="text-sm font-semibold text-foreground">Appointments is a Pro feature</p>
        <p className="text-xs text-muted-foreground mt-1">Upgrade to let visitors book time with you.</p>
        <a href="/enterprise" className="inline-block mt-3 text-xs font-semibold text-[#6C63FF] underline">Upgrade to Pro</a>
        {isSelected && (
          <button onClick={(e) => { e.stopPropagation(); onDelete() }} className="absolute -top-3 -right-3 p-1.5 bg-background border border-border rounded-md shadow-sm hover:bg-destructive hover:text-destructive-foreground">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    )
  }

  return (
    <div className={`relative rounded-xl border bg-background transition-all ${isSelected ? 'ring-2 ring-[#39D98A] border-[#39D98A]/30' : 'border-border'}`}
      onClick={(e) => { e.stopPropagation(); onSelect() }}>
      <div className="p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2">
          <CalendarClock className="w-4 h-4 text-[#39D98A]" />
          <input value={element.apptTitle ?? ''} placeholder="Meeting title"
            onChange={(e) => onChange({ apptTitle: e.target.value })}
            className="text-sm font-semibold bg-transparent outline-none flex-1" />
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <label className="space-y-1"><span className="text-muted-foreground">Duration (min)</span>
            <input type="number" value={element.apptDuration ?? 30} onChange={(e) => onChange({ apptDuration: parseInt(e.target.value) || 30 })}
              className="w-full border border-border rounded px-2 py-1 bg-transparent" /></label>
          <label className="space-y-1"><span className="text-muted-foreground">Buffer (min)</span>
            <input type="number" value={element.apptBuffer ?? 0} onChange={(e) => onChange({ apptBuffer: parseInt(e.target.value) || 0 })}
              className="w-full border border-border rounded px-2 py-1 bg-transparent" /></label>
          <label className="space-y-1"><span className="text-muted-foreground">Min notice (hrs)</span>
            <input type="number" value={element.apptLeadTimeHours ?? 12} onChange={(e) => onChange({ apptLeadTimeHours: parseInt(e.target.value) || 0 })}
              className="w-full border border-border rounded px-2 py-1 bg-transparent" /></label>
          <label className="space-y-1"><span className="text-muted-foreground">Book up to (days)</span>
            <input type="number" value={element.apptMaxDaysAhead ?? 30} onChange={(e) => onChange({ apptMaxDaysAhead: parseInt(e.target.value) || 30 })}
              className="w-full border border-border rounded px-2 py-1 bg-transparent" /></label>
        </div>

        <label className="block text-xs space-y-1">
          <span className="text-muted-foreground">Timezone (IANA)</span>
          <input value={element.apptTimezone ?? ''} placeholder="America/New_York"
            onChange={(e) => onChange({ apptTimezone: e.target.value })}
            className="w-full border border-border rounded px-2 py-1 bg-transparent" />
        </label>

        <div className="space-y-1.5">
          <div className="text-[10px] font-semibold text-muted-foreground uppercase">Weekly availability</div>
          {DAYS.map((label, day) => {
            const rule = rules.find((r) => r.day === day)
            return (
              <div key={day} className="flex items-center gap-2 text-xs">
                <label className="flex items-center gap-1 w-16">
                  <input type="checkbox" checked={!!rule} onChange={(e) => setRuleForDay(day, e.target.checked)} className="accent-[#39D98A]" />
                  <span>{label}</span>
                </label>
                {rule && (
                  <>
                    <input type="time" value={rule.start} onChange={(e) => updateRule(day, { start: e.target.value })} className="border border-border rounded px-1 py-0.5 bg-transparent" />
                    <span>–</span>
                    <input type="time" value={rule.end} onChange={(e) => updateRule(day, { end: e.target.value })} className="border border-border rounded px-1 py-0.5 bg-transparent" />
                  </>
                )}
              </div>
            )
          })}
        </div>

        <label className="block text-xs space-y-1">
          <span className="text-muted-foreground">Location / details</span>
          <input value={element.apptLocationDetail ?? ''} placeholder="Zoom link sent after booking, address, etc."
            onChange={(e) => onChange({ apptLocationDetail: e.target.value })}
            className="w-full border border-border rounded px-2 py-1 bg-transparent" />
        </label>

        <div className="border-t border-border pt-2">
          <div className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">Upcoming bookings</div>
          {bookings.length === 0
            ? <p className="text-[10px] text-muted-foreground">No bookings yet. Save & publish your page to start receiving them.</p>
            : bookings.slice(0, 5).map((b) => (
                <div key={b.id} className="text-[11px] flex justify-between"><span>{b.name}</span><span className="text-muted-foreground">{new Date(b.start).toLocaleString()}</span></div>
              ))}
        </div>
      </div>

      {isSelected && (
        <button onClick={(e) => { e.stopPropagation(); onDelete() }} className="absolute -top-3 -right-3 p-1.5 bg-background border border-border rounded-md shadow-sm hover:bg-destructive hover:text-destructive-foreground">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  )
}
```
IMPORTANT during implementation: verify the real auth-store import (`@/lib/store` and hook name) by grepping an existing Pro editor element; and verify whether the editor passes a `displayId` to elements (grep `ColumnCanvas` for how it renders elements — if no displayId is available client-side, drop the bookings fetch and show only the "save & publish" hint; the owner can still see bookings via the dashboard later). Do not invent a prop that doesn't exist.

- [ ] **Step 2: Verify + commit**

Run: `pnpm exec tsc --noEmit`
```bash
git add src/components/elements/AppointmentsElement.tsx
git commit -m "feat(appointments): Pro-gated editor with availability config"
```

---

## Task 11: Appointments public booking component

**Files:**
- Create: `src/components/elements/PublicAppointmentsElement.tsx`

**Interfaces:**
- Consumes: public GET/POST API (Task 7). Needs the display id — grep how other public interactive elements (e.g. `PublicRSVPElement`, poll) obtain the display id on the published page (likely a prop threaded through `render-elements.tsx`, or a `data-display-id` on a wrapper). Use the SAME mechanism. If public elements only receive `{ element }`, add an optional context: check `render-elements.tsx` signature first.

- [ ] **Step 1: Determine display-id availability**

Grep `src/lib/render-elements.tsx` and an existing element that POSTs to a display-scoped endpoint (RSVP board / poll) to see how they learn `displayId`. Mirror it. (RSVP posts to `/api/forms/submit` which may not need displayId; poll's public aggregate GET is display-scoped — copy poll's approach.)

- [ ] **Step 2: Build the component**

```tsx
// src/components/elements/PublicAppointmentsElement.tsx
'use client'
import { useEffect, useState } from 'react'
import { CalendarClock } from 'lucide-react'
import type { CanvasElement } from '@/lib/types/canvas'

// displayId is threaded the SAME way poll/other display-scoped public elements get it.
interface Props { element: CanvasElement; displayId?: string }

interface SlotDTO { startUTC: string; endUTC: string; taken: boolean }

export function PublicAppointmentsElement({ element, displayId }: Props) {
  const [slots, setSlots] = useState<SlotDTO[]>([])
  const [tz, setTz] = useState('UTC')
  const [available, setAvailable] = useState(true)
  const [selected, setSelected] = useState<string | null>(null)
  const [name, setName] = useState(''); const [email, setEmail] = useState(''); const [note, setNote] = useState('')
  const [done, setDone] = useState<{ when: string } | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!displayId) return
    fetch(`/api/appointments/${displayId}?elementId=${element.id}`)
      .then((r) => r.json())
      .then((d) => { setSlots(d.slots ?? []); setTz(d.timezone ?? 'UTC'); setAvailable(!!d.available) })
      .catch(() => setAvailable(false))
  }, [displayId, element.id])

  if (!available) {
    return <div className="rounded-xl border border-border p-4 text-sm text-muted-foreground">Booking is currently unavailable.</div>
  }

  // Group open slots by local day label.
  const fmtDay = (iso: string) => new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short', month: 'short', day: 'numeric' }).format(new Date(iso))
  const fmtTime = (iso: string) => new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit' }).format(new Date(iso))
  const open = slots.filter((s) => !s.taken)
  const days = Array.from(new Set(open.map((s) => fmtDay(s.startUTC))))
  const [activeDay, setActiveDay] = useState<string | null>(null)
  const dayForActive = activeDay ?? days[0] ?? null

  const book = async () => {
    if (!selected || !name || !email) { setError('Please fill in your name and email.'); return }
    setBusy(true); setError('')
    const res = await fetch(`/api/appointments/${displayId}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ elementId: element.id, startUTC: selected, name, email, note }),
    })
    const data = await res.json()
    setBusy(false)
    if (!res.ok) { setError(data.error || 'Could not book that slot.'); return }
    setDone({ when: data.when })
  }

  if (done) {
    return (
      <div className="rounded-xl border border-[#39D98A]/40 bg-[#39D98A]/5 p-5 text-center space-y-1">
        <CalendarClock className="w-6 h-6 text-[#39D98A] mx-auto" />
        <p className="font-semibold text-foreground">You're booked!</p>
        <p className="text-sm text-muted-foreground">{done.when}</p>
        <p className="text-xs text-muted-foreground">A confirmation email (with a cancel link) is on its way.</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border p-4 space-y-4">
      <div className="flex items-center gap-2">
        <CalendarClock className="w-5 h-5 text-[#39D98A]" />
        <h3 className="font-bold text-foreground">{element.apptTitle || 'Book a time'}</h3>
      </div>
      <p className="text-[11px] text-muted-foreground">All times in {tz}</p>

      {days.length === 0 ? (
        <p className="text-sm text-muted-foreground">No times available right now — check back soon.</p>
      ) : (
        <>
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {days.map((d) => (
              <button key={d} onClick={() => { setActiveDay(d); setSelected(null) }}
                className={`px-3 py-1.5 rounded-full text-xs whitespace-nowrap border ${dayForActive === d ? 'bg-[#39D98A] text-white border-[#39D98A]' : 'border-border text-muted-foreground'}`}>
                {d}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2">
            {open.filter((s) => fmtDay(s.startUTC) === dayForActive).map((s) => (
              <button key={s.startUTC} onClick={() => setSelected(s.startUTC)}
                className={`py-2 rounded-lg text-xs border ${selected === s.startUTC ? 'bg-[#39D98A] text-white border-[#39D98A]' : 'border-border hover:border-[#39D98A] text-foreground'}`}>
                {fmtTime(s.startUTC)}
              </button>
            ))}
          </div>

          {selected && (
            <div className="space-y-2 border-t border-border pt-3">
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name"
                className="w-full text-sm border border-border rounded px-2 py-1.5 bg-transparent" />
              <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Your email" type="email"
                className="w-full text-sm border border-border rounded px-2 py-1.5 bg-transparent" />
              <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder={element.apptNoteLabel || 'Note (optional)'}
                className="w-full text-sm border border-border rounded px-2 py-1.5 bg-transparent" rows={2} />
              {error && <p className="text-xs text-red-500">{error}</p>}
              <button onClick={book} disabled={busy}
                className="w-full py-2.5 rounded-full bg-[#39D98A] text-white font-semibold hover:opacity-90 disabled:opacity-50">
                {busy ? 'Booking…' : 'Confirm booking'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
```
NOTE: React hooks must not be called conditionally — move the `const [activeDay,setActiveDay]` up with the other `useState` calls (above the early `return` for `!available`). Fix during implementation so all hooks run unconditionally.

- [ ] **Step 3: Verify + commit**

Run: `pnpm exec tsc --noEmit`
```bash
git add src/components/elements/PublicAppointmentsElement.tsx
git commit -m "feat(appointments): public two-step booking component"
```

---

## Task 12: Wire appointments into the canvas + published page

**Files:**
- Modify: `src/components/canvas/SlashCommandMenu.tsx`, `src/components/canvas/ColumnCanvas.tsx`, `src/components/elements/index.ts`, `src/lib/render-elements.tsx`

- [ ] **Step 1: Slash menu entry**

Add to the elements list in `SlashCommandMenu.tsx` (Scheduling category; mark `pro: true` like `whiteboard`):
```ts
  { id: 'appointments', label: 'Appointments', icon: CalendarClock, description: 'Let visitors book a time with you', category: 'Scheduling', pro: true },
```
(Import `CalendarClock` from `lucide-react` if not already imported.)

- [ ] **Step 2: Barrel + ColumnCanvas + render-elements**

`index.ts`:
```ts
export { AppointmentsElement } from './AppointmentsElement'
export { PublicAppointmentsElement } from './PublicAppointmentsElement'
```

`ColumnCanvas.tsx` renderElement case:
```tsx
    case 'appointments':
      return isPreview
        ? <PublicAppointmentsElement element={element} displayId={displayId} />
        : <AppointmentsElement element={element} onChange={onChange} onDelete={onDelete} isSelected={isSelected} onSelect={onSelect} />
```
(Only pass `displayId` if `ColumnCanvas` actually has it in scope — per Task 11 Step 1 findings. If not available in the editor preview, pass `undefined`; booking is exercised on the published page.)

`render-elements.tsx` case (published page — thread `displayId` the same way poll does):
```tsx
    case 'appointments':
      return <PublicAppointmentsElement element={element} displayId={displayId} />
```

- [ ] **Step 3: Verify + commit**

Run: `pnpm exec tsc --noEmit`
```bash
git add src/components/canvas/SlashCommandMenu.tsx src/components/canvas/ColumnCanvas.tsx src/components/elements/index.ts src/lib/render-elements.tsx
git commit -m "feat(appointments): wire element into canvas, slash menu, published page"
```

---

## Task 13: Full verification + manual smoke

- [ ] **Step 1: Full type + test suite**

Run: `pnpm exec tsc --noEmit && pnpm test`
Expected: no type errors; entire suite green including `business-hours.test.ts` and `appointments.test.ts`.

- [ ] **Step 2: Manual smoke (dev)**

Start dev with the correct DB:
```bash
DATABASE_URL="postgresql://pages:pages@127.0.0.1:5434/pages" pnpm dev
```
As a **Pro** user (set `plan='pro'` in DB for your test user):
1. Insert **Calendar**, add an event, publish, view the public page — event dot + popover + Upcoming list render.
2. Insert **Business Hours**, view public page — "Open now / Closed" badge reflects current time.
3. Insert **Appointments**, configure Mon–Fri 9–5, publish. On the public page, pick a day + time, enter name/email, confirm. Watch the dev console for the two `[email:dev]` sends (visitor confirmation + owner notification).
4. Copy the cancel link from the console log, open `/appointments/cancel/<token>`, cancel — confirm the slot re-opens on the public page and a cancellation email logs.
5. As a **free** user, confirm the Appointments editor shows the upgrade prompt and the public booking POST returns 403.

- [ ] **Step 3: Final commit (docs/notes if any)**

```bash
git add -A
git commit -m "docs(scheduling): mark plan complete after smoke test"
```

---

## Self-Review notes

- **Spec coverage:** Calendar (Tasks 2–3) ✓; Appointments engine — pure logic (4), model (5), emails (6), API (7), cancel page (8), types (9), editor (10), public (11), wiring (12) ✓; Business-hours badge (1) ✓; Pro gate (10 editor + 7 API 403) ✓; emails via Resend (6–7) ✓; new "Scheduling" category (3) ✓.
- **Deferred (unchanged from spec):** Google Calendar sync, visitor-tz conversion, cancellation history/reschedule, multi-day calendar spans.
- **Known implementation-time verifications flagged inline:** (a) exact section-JSON traversal shape (mirror live-feed `findLiveFeedIds`); (b) auth-store hook path in the editor; (c) how public display-scoped elements receive `displayId` (mirror poll). These are grep-and-match, not guesses — do them before writing the dependent code.
