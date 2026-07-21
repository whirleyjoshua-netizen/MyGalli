'use client'

import { useState, useEffect, useCallback } from 'react'
import { BadgeCheck, Check } from 'lucide-react'
import type { BulletinBlockProps } from '../BulletinBlock'
import {
  ACK_STATEMENT_DEFAULT,
  ACK_CONFIRM_LABEL_DEFAULT,
  ACK_BUTTON_LABEL_DEFAULT,
  type AckStatus,
} from '@/lib/acknowledgment'

export function BulletinAcknowledgment({ postId, block }: BulletinBlockProps) {
  const [status, setStatus] = useState<AckStatus>('none')
  const [count, setCount] = useState(0)
  const [checked, setChecked] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const statement = block.ackStatement || ACK_STATEMENT_DEFAULT
  const confirmLabel = block.ackConfirmLabel || ACK_CONFIRM_LABEL_DEFAULT
  const buttonLabel = block.ackButtonLabel || ACK_BUTTON_LABEL_DEFAULT

  // Block ids from makeBlock() are deterministic, so the same acknowledgment
  // block id repeats across posts — postId is what keeps these records apart.
  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/acknowledgments/${block.id}?hubPostId=${postId}`)
      if (!res.ok) return
      const data = await res.json()
      setStatus(data.mine as AckStatus)
      setCount(data.count)
    } catch {
      // Leave the block in its default state if the fetch fails.
    }
  }, [block.id, postId])

  useEffect(() => {
    void load()
  }, [load])

  const submit = async () => {
    if (!checked || submitting) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/acknowledgments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ elementId: block.id, hubPostId: postId }),
      })
      if (res.ok) {
        setChecked(false)
        await load()
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-3 space-y-2.5">
      <p className="text-sm font-medium text-foreground flex items-start gap-2">
        <BadgeCheck className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
        {statement}
      </p>

      {status === 'current' ? (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-green-600">
          <Check className="w-3.5 h-3.5" /> You acknowledged this
        </span>
      ) : (
        <div className="space-y-2">
          {status === 'stale' && (
            <p className="text-xs text-amber-700">This was updated &mdash; please acknowledge again.</p>
          )}
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
              className="mt-0.5 h-3.5 w-3.5 rounded border-border text-primary focus:ring-primary"
            />
            <span className="text-xs text-muted-foreground">{confirmLabel}</span>
          </label>
          <button
            onClick={submit}
            disabled={!checked || submitting}
            className="rounded-full bg-galli px-3 py-1 text-xs font-semibold text-white transition hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Recording…' : buttonLabel}
          </button>
        </div>
      )}

      {count > 0 && (
        <p className="text-[11px] text-muted-foreground">
          {count} {count === 1 ? 'person has' : 'people have'} acknowledged
        </p>
      )}
    </div>
  )
}
