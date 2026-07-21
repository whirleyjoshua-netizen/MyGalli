'use client'

import { useState, useEffect, useCallback } from 'react'
import { BadgeCheck, Check, AlertCircle } from 'lucide-react'
import type { CanvasElement } from '@/lib/types/canvas'
import {
  ACK_STATEMENT_DEFAULT,
  ACK_CONFIRM_LABEL_DEFAULT,
  ACK_BUTTON_LABEL_DEFAULT,
  type AckStatus,
} from '@/lib/acknowledgment'

interface PublicAcknowledgmentElementProps {
  element: CanvasElement
  displayId: string
}

export function PublicAcknowledgmentElement({ element, displayId }: PublicAcknowledgmentElementProps) {
  const [status, setStatus] = useState<AckStatus>('none')
  const [count, setCount] = useState(0)
  const [isOwner, setIsOwner] = useState(false)
  const [signedIn, setSignedIn] = useState<boolean | null>(null)
  const [checked, setChecked] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [acknowledgedAt, setAcknowledgedAt] = useState<string | null>(null)

  const statement = element.ackStatement || ACK_STATEMENT_DEFAULT
  const confirmLabel = element.ackConfirmLabel || ACK_CONFIRM_LABEL_DEFAULT
  const buttonLabel = element.ackButtonLabel || ACK_BUTTON_LABEL_DEFAULT

  const load = useCallback(async () => {
    if (!displayId) return
    try {
      const res = await fetch(`/api/acknowledgments/${element.id}?displayId=${displayId}`)
      if (!res.ok) return
      const data = await res.json()
      setStatus(data.mine as AckStatus)
      setCount(data.count)
      setIsOwner(!!data.isOwner)
    } catch {
      // Leave the element in its default state if the fetch fails.
    }
  }, [displayId, element.id])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => setSignedIn(r.ok))
      .catch(() => setSignedIn(false))
  }, [])

  const submit = async () => {
    if (!checked || submitting) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/acknowledgments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ elementId: element.id, displayId }),
      })
      if (res.ok) {
        setAcknowledgedAt(
          new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
        )
        setChecked(false)
        await load()
      }
    } catch {
      // Silently fail — the visitor can retry.
    } finally {
      setSubmitting(false)
    }
  }

  const acknowledged = status === 'current'
  const stale = status === 'stale'

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-start gap-2">
        <BadgeCheck className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-slate-900">{statement}</p>
          {element.ackDescription && (
            <p className="text-xs text-slate-500 mt-1">{element.ackDescription}</p>
          )}
        </div>
      </div>

      <div className="p-5">
        {acknowledged ? (
          <div className="flex items-center gap-2 text-sm font-medium text-green-600">
            <Check className="w-4 h-4" />
            {acknowledgedAt ? `You acknowledged this on ${acknowledgedAt}` : 'You acknowledged this'}
          </div>
        ) : signedIn === false ? (
          <a
            href={`/login?next=${encodeURIComponent(typeof window === 'undefined' ? '/' : window.location.pathname)}`}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            Sign in to acknowledge
          </a>
        ) : (
          <div className="space-y-3">
            {stale && (
              <div className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                This was updated &mdash; please acknowledge again.
              </div>
            )}
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={checked}
                onChange={(e) => setChecked(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
              />
              <span className="text-sm text-slate-700">{confirmLabel}</span>
            </label>
            <button
              onClick={submit}
              disabled={!checked || submitting}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Recording…' : buttonLabel}
            </button>
          </div>
        )}
      </div>

      {isOwner && (
        <div className="px-5 py-3 border-t border-slate-100 text-xs text-slate-500">
          {/* The Data tab roster card is deferred until the Interactions tab
              lands, so this deliberately promises no destination yet. */}
          {count} {count === 1 ? 'person has' : 'people have'} acknowledged
        </div>
      )}
    </div>
  )
}
