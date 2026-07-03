'use client'

import { useEffect, useState } from 'react'
import type { CanvasElement } from '@/lib/types/canvas'
import type { RsvpAttending } from '@/lib/rsvp'
import { CalendarCheck, Check, Users, PartyPopper } from 'lucide-react'

interface Props {
  element: CanvasElement
  displayId: string
}

interface BoardGuest {
  name: string
  guests: number
  items: string[]
}
interface BoardItem {
  label: string
  claimedBy: string[]
  claimed: boolean
}
interface Board {
  public: boolean
  counts?: { going: number; maybe: number; cant: number; responses: number; totalGuests: number }
  going?: BoardGuest[]
  maybe?: BoardGuest[]
  cant?: BoardGuest[]
  items?: BoardItem[]
}

function getSessionId() {
  if (typeof window === 'undefined') return ''
  let id = sessionStorage.getItem('pages_form_session')
  if (!id) {
    id = `sess-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    sessionStorage.setItem('pages_form_session', id)
  }
  return id
}

const ATTEND_OPTIONS: { value: RsvpAttending; label: string; emoji: string }[] = [
  { value: 'going', label: 'Going', emoji: '✅' },
  { value: 'maybe', label: 'Maybe', emoji: '🤔' },
  { value: 'cant', label: "Can't go", emoji: '❌' },
]

export function PublicRSVPElement({ element, displayId }: Props) {
  const subject = element.rsvpSubject || "You're invited!"
  const deadline = element.rsvpDeadline || ''
  const askPlusOne = !!element.rsvpPlusOne
  const allowNote = !!element.rsvpAllowNote
  const items = element.rsvpItems || []
  const isPublic = !!element.rsvpPublicList

  const [name, setName] = useState('')
  const [attending, setAttending] = useState<RsvpAttending | null>(null)
  const [guests, setGuests] = useState(0)
  const [claimed, setClaimed] = useState<string[]>([])
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(() =>
    typeof window !== 'undefined' && localStorage.getItem(`form_submitted_${element.id}`) === 'true'
  )
  const [error, setError] = useState('')
  const [board, setBoard] = useState<Board | null>(null)

  const coming = attending === 'going' || attending === 'maybe'

  const loadBoard = () => {
    if (!isPublic || !displayId) return
    fetch(`/api/displays/${displayId}/rsvp?elementId=${element.id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d && d.public) setBoard(d) })
      .catch(() => {})
  }

  useEffect(() => {
    loadBoard()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPublic, displayId, element.id])

  const toggleItem = (label: string) => {
    setClaimed((prev) => (prev.includes(label) ? prev.filter((i) => i !== label) : [...prev, label]))
  }

  const handleSubmit = async () => {
    if (!name.trim()) { setError('Please enter your name.'); return }
    if (!attending) { setError('Please let us know if you can make it.'); return }
    if (submitting || submitted) return
    setError('')
    setSubmitting(true)
    try {
      const res = await fetch('/api/forms/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayId,
          sessionId: getSessionId(),
          responses: {
            [element.id]: {
              type: 'rsvp',
              question: subject,
              answer: {
                name: name.trim(),
                attending,
                guests: coming && askPlusOne ? guests : 0,
                items: coming ? claimed : [],
                note: allowNote ? note.trim() || undefined : undefined,
              },
            },
          },
        }),
      })
      if (res.ok) {
        setSubmitted(true)
        localStorage.setItem(`form_submitted_${element.id}`, 'true')
        loadBoard()
      } else {
        setError('Something went wrong. Please try again.')
      }
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const claimedByLabel = (label: string) => board?.items?.find((i) => i.label === label)?.claimedBy || []

  return (
    <div className="rounded-2xl border border-border bg-surface p-6 shadow-soft">
      {/* Header */}
      <div className="text-center mb-5">
        <CalendarCheck className="w-6 h-6 mx-auto mb-2 text-primary" />
        <h3 className="text-xl font-bold text-foreground">{subject}</h3>
        {deadline && (
          <p className="text-xs text-muted-foreground mt-1">
            Please respond by{' '}
            {new Date(deadline + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
        )}
      </div>

      {/* Form (hidden once this browser has responded) */}
      {!submitted ? (
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium block mb-1.5 text-foreground">
              Your name <span className="text-primary">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your full name"
              className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition"
            />
          </div>

          <div>
            <label className="text-sm font-medium block mb-2 text-foreground">Will you be there?</label>
            <div className="grid grid-cols-3 gap-2">
              {ATTEND_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setAttending(opt.value)}
                  className={`py-2.5 rounded-xl border text-sm font-medium transition ${
                    attending === opt.value
                      ? 'border-primary bg-primary/10 text-foreground'
                      : 'border-border bg-background text-muted-foreground hover:border-primary/50'
                  }`}
                >
                  <span className="mr-1">{opt.emoji}</span>{opt.label}
                </button>
              ))}
            </div>
          </div>

          {coming && askPlusOne && (
            <div>
              <label className="text-sm font-medium block mb-1.5 text-foreground">Bringing anyone? (+1s)</label>
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => setGuests((g) => Math.max(0, g - 1))}
                  className="w-9 h-9 rounded-lg border border-border bg-background text-lg leading-none hover:border-primary/50">−</button>
                <span className="w-8 text-center text-sm font-semibold">{guests}</span>
                <button type="button" onClick={() => setGuests((g) => Math.min(20, g + 1))}
                  className="w-9 h-9 rounded-lg border border-border bg-background text-lg leading-none hover:border-primary/50">+</button>
                <span className="text-xs text-muted-foreground">additional {guests === 1 ? 'guest' : 'guests'}</span>
              </div>
            </div>
          )}

          {coming && items.length > 0 && (
            <div>
              <label className="text-sm font-medium block mb-2 text-foreground">What can you bring?</label>
              <div className="space-y-2">
                {items.map((label) => {
                  const takenBy = claimedByLabel(label)
                  const isChecked = claimed.includes(label)
                  return (
                    <label key={label}
                      className={`flex items-center gap-3 px-3 py-2 rounded-xl border cursor-pointer transition ${
                        isChecked ? 'border-primary bg-primary/10' : 'border-border bg-background hover:border-primary/40'
                      }`}>
                      <span className={`w-4 h-4 rounded border flex items-center justify-center ${isChecked ? 'bg-primary border-primary' : 'border-muted-foreground/40'}`}>
                        {isChecked && <Check className="w-3 h-3 text-primary-foreground" />}
                      </span>
                      <input type="checkbox" className="sr-only" checked={isChecked} onChange={() => toggleItem(label)} />
                      <span className="text-sm flex-1">{label}</span>
                      {takenBy.length > 0 && (
                        <span className="text-xs text-muted-foreground truncate max-w-[45%]">{takenBy.join(', ')}</span>
                      )}
                    </label>
                  )
                })}
              </div>
            </div>
          )}

          {allowNote && (
            <div>
              <label className="text-sm font-medium block mb-1.5 text-foreground">Leave a note (optional)</label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                placeholder="Anything you'd like the host to know…"
                className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition resize-none"
              />
            </div>
          )}

          {error && <p className="text-sm text-red-500 text-center">{error}</p>}

          <div className="pt-1 flex justify-center">
            <button onClick={handleSubmit} disabled={submitting}
              className="px-8 py-2.5 rounded-full text-sm font-semibold bg-primary text-primary-foreground shadow-soft hover:brightness-105 transition disabled:opacity-50">
              {submitting ? 'Sending…' : 'Send RSVP'}
            </button>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-6 text-center">
          <div className="w-11 h-11 rounded-full bg-primary flex items-center justify-center mx-auto mb-2">
            <Check className="w-6 h-6 text-primary-foreground" />
          </div>
          <p className="text-sm font-semibold text-foreground">Thanks — your RSVP is in!</p>
        </div>
      )}

      {/* Public board */}
      {isPublic && board?.public && board.counts && (
        <div className="mt-6 pt-5 border-t border-border">
          <div className="flex items-center gap-2 mb-3">
            <PartyPopper className="w-4 h-4 text-primary" />
            <span className="text-sm font-bold text-foreground">
              {board.counts.totalGuests} coming
              {board.counts.maybe > 0 && <span className="text-muted-foreground font-normal"> · {board.counts.maybe} maybe</span>}
            </span>
          </div>

          {board.items && board.items.length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Bring list</p>
              <div className="space-y-1">
                {board.items.map((it) => (
                  <div key={it.label} className="flex items-center justify-between text-sm">
                    <span className={it.claimed ? '' : 'text-muted-foreground'}>{it.label}</span>
                    <span className={`text-xs ${it.claimed ? 'text-foreground' : 'text-muted-foreground/70 italic'}`}>
                      {it.claimed ? it.claimedBy.join(', ') : 'open'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {board.going && board.going.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Guest list</p>
              <div className="flex flex-wrap gap-1.5">
                {board.going.map((g, i) => (
                  <span key={i} className="inline-flex items-center gap-1 text-xs bg-muted px-2.5 py-1 rounded-full">
                    <Users className="w-3 h-3" />
                    {g.name}{g.guests > 0 ? ` +${g.guests}` : ''}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
