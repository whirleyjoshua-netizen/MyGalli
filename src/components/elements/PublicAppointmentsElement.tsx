'use client'
import { useEffect, useState } from 'react'
import { CalendarClock } from 'lucide-react'
import type { CanvasElement } from '@/lib/types/canvas'

// displayId is threaded the SAME way poll/other display-scoped public elements get it
// (render-elements.tsx passes `displayId={displayId || ''}` to every display-scoped
// public element — see PublicPollElement/PublicRSVPElement/etc). We treat '' the same
// as undefined: no fetch, neutral unavailable state.
interface Props { element: CanvasElement; displayId?: string }

interface SlotDTO { startUTC: string; endUTC: string; taken: boolean }

export function PublicAppointmentsElement({ element, displayId }: Props) {
  const [slots, setSlots] = useState<SlotDTO[]>([])
  const [tz, setTz] = useState('UTC')
  const [available, setAvailable] = useState(true)
  const [selected, setSelected] = useState<string | null>(null)
  const [activeDay, setActiveDay] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [note, setNote] = useState('')
  const [done, setDone] = useState<{ when: string } | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!displayId) { setAvailable(false); return }
    fetch(`/api/appointments/${displayId}?elementId=${element.id}`)
      .then((r) => r.json())
      .then((d) => { setSlots(d.slots ?? []); setTz(d.timezone ?? 'UTC'); setAvailable(!!d.available) })
      .catch(() => setAvailable(false))
  }, [displayId, element.id])

  const fmtDay = (iso: string) => new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short', month: 'short', day: 'numeric' }).format(new Date(iso))
  const fmtTime = (iso: string) => new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit' }).format(new Date(iso))
  const open = slots.filter((s) => !s.taken)
  const days = Array.from(new Set(open.map((s) => fmtDay(s.startUTC))))
  const dayForActive = activeDay ?? days[0] ?? null

  const book = async () => {
    if (!selected || !name || !email) { setError('Please fill in your name and email.'); return }
    setBusy(true); setError('')
    try {
      const res = await fetch(`/api/appointments/${displayId}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ elementId: element.id, startUTC: selected, name, email, note }),
      })
      const data = await res.json()
      setBusy(false)
      if (!res.ok) { setError(data.error || 'Could not book that slot.'); return }
      setDone({ when: data.when })
    } catch {
      setBusy(false)
      setError('Network error — please try again.')
    }
  }

  if (!available) {
    return <div className="rounded-xl border border-border p-4 text-sm text-muted-foreground">Booking is currently unavailable.</div>
  }

  if (done) {
    return (
      <div className="rounded-xl border border-[#39D98A]/40 bg-[#39D98A]/5 p-5 text-center space-y-1">
        <CalendarClock className="w-6 h-6 text-[#39D98A] mx-auto" />
        <p className="font-semibold text-foreground">You&apos;re booked!</p>
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
