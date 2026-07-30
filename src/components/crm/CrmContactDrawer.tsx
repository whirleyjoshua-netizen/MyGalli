'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { CrmActivity, CrmStage } from '@prisma/client'
import { Calendar, FileText, ListPlus, Download, MessageSquare, StickyNote } from 'lucide-react'
import { timeAgo } from '@/lib/time-ago'
import type { CrmContactWithActivity } from './CrmContactCard'

type CrmContactDetail = CrmContactWithActivity & { activities: CrmActivity[] }

const SOURCE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  booking: Calendar,
  form: FileText,
  waitlist: ListPlus,
  'lead-capture': Download,
  comment: MessageSquare,
  note: StickyNote,
}

function SourceIcon({ source, className }: { source: string; className?: string }) {
  const Cmp = SOURCE_ICONS[source] || StickyNote
  return <Cmp className={className} />
}

/**
 * Contact detail drawer: identity fields up top (supporting cast), the
 * merged activity timeline below carrying the visual weight — this is the
 * feature's whole pitch, one person's every touch across every page.
 *
 * Portalled to <body>: this can be opened from within the dashboard's sticky
 * sidebar subtree, and `position: sticky` creates a stacking context that
 * traps an in-place `fixed z-50` overlay below the main content.
 */
export function CrmContactDrawer({
  contactId,
  stages,
  onClose,
  onUpdated,
}: {
  contactId: string
  stages: CrmStage[]
  onClose: () => void
  /** The PATCH response is the bare contact row (no activities include) —
   * callers merge it into their own copy rather than replacing it wholesale. */
  onUpdated: (contact: Partial<CrmContactWithActivity> & { id: string }) => void
}) {
  const [contact, setContact] = useState<CrmContactDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [emailError, setEmailError] = useState<string | null>(null)
  const [followUpAt, setFollowUpAt] = useState('')
  const [noteText, setNoteText] = useState('')
  const [savingNote, setSavingNote] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setLoadError(false)
    fetch(`/api/crm/contacts/${contactId}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((data: CrmContactDetail) => {
        if (cancelled) return
        setContact(data)
        setName(data.name ?? '')
        setEmail(data.email ?? '')
        setFollowUpAt(data.followUpAt ? new Date(data.followUpAt).toISOString().slice(0, 10) : '')
      })
      .catch(() => { if (!cancelled) setLoadError(true) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [contactId])

  const patch = async (body: Record<string, unknown>): Promise<{ ok: true } | { ok: false; status: number; error: string }> => {
    try {
      const res = await fetch(`/api/crm/contacts/${contactId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        return { ok: false, status: res.status, error: data.error || 'Could not save that change.' }
      }
      setContact((prev) => (prev ? { ...prev, ...data } : prev))
      onUpdated(data)
      return { ok: true }
    } catch {
      return { ok: false, status: 0, error: 'Could not save that change. Please try again.' }
    }
  }

  const commitName = async () => {
    const trimmed = name.trim()
    if (!contact || trimmed === (contact.name ?? '')) return
    const prev = contact.name ?? ''
    const result = await patch({ name: trimmed || null })
    if (!result.ok) setName(prev)
  }

  const commitEmail = async () => {
    const trimmed = email.trim()
    if (!contact || trimmed === (contact.email ?? '')) return
    setEmailError(null)
    const prev = contact.email ?? ''
    const result = await patch({ email: trimmed || null })
    if (!result.ok) {
      setEmail(prev)
      // Distinct messaging: an invalid address is a typo the user can fix
      // immediately; a duplicate means another contact already owns it.
      setEmailError(
        result.status === 409
          ? 'Another contact already uses that email.'
          : result.status === 400
            ? 'That is not a valid email address.'
            : result.error
      )
    }
  }

  const changeStage = async (stageId: string) => {
    if (!contact || stageId === contact.stageId) return
    const prev = contact.stageId
    setContact((c) => (c ? { ...c, stageId } : c))
    const result = await patch({ stageId })
    if (!result.ok) setContact((c) => (c ? { ...c, stageId: prev } : c))
  }

  const changeFollowUp = async (value: string) => {
    if (!contact) return
    const prev = followUpAt
    setFollowUpAt(value)
    const result = await patch({ followUpAt: value || null })
    if (!result.ok) setFollowUpAt(prev)
  }

  const submitNote = async () => {
    const text = noteText.trim()
    if (!text || !contact) return
    setSavingNote(true)
    try {
      const res = await fetch(`/api/crm/contacts/${contactId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      if (res.ok) {
        const activity: CrmActivity = await res.json()
        setContact((c) => (c ? { ...c, activities: [activity, ...c.activities] } : c))
        setNoteText('')
      }
    } finally {
      setSavingNote(false)
    }
  }

  if (!mounted) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-stretch justify-end bg-black/40" onClick={onClose}>
      <div
        className="flex h-full w-full max-w-md flex-col border-l border-border bg-surface shadow-soft-lg"
        onClick={(e) => e.stopPropagation()}
      >
        {loading ? (
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">Loading…</div>
        ) : loadError || !contact ? (
          <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-muted-foreground">
            Could not load that contact.
          </div>
        ) : (
          <>
            <div className="shrink-0 space-y-3 border-b border-border p-5">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={commitName}
                onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
                placeholder="Unnamed contact"
                aria-label="Contact name"
                className="w-full rounded-lg border border-transparent bg-transparent px-1.5 py-0.5 text-lg font-bold text-foreground hover:border-border focus:border-border focus:bg-background focus:outline-none"
              />
              <div>
                <input
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setEmailError(null) }}
                  onBlur={commitEmail}
                  onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
                  placeholder="Email address"
                  aria-label="Contact email"
                  className="w-full rounded-lg border border-transparent bg-transparent px-1.5 py-0.5 text-sm text-muted-foreground hover:border-border focus:border-border focus:bg-background focus:outline-none"
                />
                {emailError && <p className="mt-1 px-1.5 text-xs text-destructive">{emailError}</p>}
              </div>

              <div className="flex gap-2">
                <label className="flex-1">
                  <span className="mb-1 block text-xs font-semibold text-muted-foreground">Stage</span>
                  <select
                    value={contact.stageId}
                    onChange={(e) => changeStage(e.target.value)}
                    className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
                  >
                    {stages.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </label>
                <label className="flex-1">
                  <span className="mb-1 block text-xs font-semibold text-muted-foreground">Follow up</span>
                  <input
                    type="date"
                    value={followUpAt}
                    onChange={(e) => changeFollowUp(e.target.value)}
                    className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
                  />
                </label>
              </div>

              <div>
                <textarea
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="Add a note…"
                  rows={2}
                  className="w-full resize-none rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
                />
                <button
                  onClick={submitNote}
                  disabled={savingNote || !noteText.trim()}
                  className="mt-1.5 rounded-full bg-galli px-3 py-1 text-xs font-semibold text-white disabled:opacity-50"
                >
                  {savingNote ? 'Saving…' : 'Add note'}
                </button>
              </div>
            </div>

            {/* The timeline: every touch across every page, newest first — the
                reason this feature exists, so it gets the remaining space and
                the only scroll region in the drawer. */}
            <div className="flex-1 overflow-y-auto p-5">
              <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">Activity</h3>
              {contact.activities.length === 0 ? (
                <p className="text-sm text-muted-foreground">No activity yet.</p>
              ) : (
                <ul className="space-y-4">
                  {contact.activities.map((activity) => (
                    <li key={activity.id} className="flex gap-3">
                      <span className="mt-0.5 shrink-0 rounded-lg bg-muted p-1.5 text-muted-foreground">
                        <SourceIcon source={activity.source} className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-foreground">{activity.summary}</p>
                        <p className="text-xs text-muted-foreground">{timeAgo(new Date(activity.occurredAt).toISOString())} ago</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}

        <div className="shrink-0 border-t border-border p-3">
          <button
            onClick={onClose}
            className="w-full rounded-full border border-border py-2 text-sm font-semibold hover:bg-muted"
          >
            Done
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
