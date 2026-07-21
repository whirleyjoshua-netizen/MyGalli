'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { X } from 'lucide-react'

export function ProfileDmModal({
  username,
  name,
  onClose,
  onSent,
}: {
  username: string
  name: string | null
  onClose: () => void
  /**
   * Called instead of navigating to the thread once the message is away.
   * Callers that show this over a list (e.g. the follower list) pass it so the
   * sender keeps their place and can message several people in a row.
   */
  onSent?: () => void
}) {
  const router = useRouter()
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)

  const send = async () => {
    const text = body.trim()
    if (!text) return
    setBusy(true)
    setError(false)
    try {
      // Idempotent: returns the existing conversation (200) if these two have
      // messaged before, so this never creates a duplicate thread.
      const created = await fetch('/api/dm/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      })
      if (!created.ok) throw new Error('create failed')
      const { id } = await created.json()

      const sent = await fetch(`/api/dm/conversations/${id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: text }),
      })
      if (!sent.ok) throw new Error('send failed')

      if (onSent) onSent()
      else router.push(`/messages?c=${id}`)
    } catch {
      // The typed text is deliberately left in place so a retry costs nothing.
      setError(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div
        className="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-surface shadow-soft-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="font-bold">Message {name || `@${username}`}</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="cursor-pointer rounded-lg p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5">
          <textarea
            autoFocus
            rows={4}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={`Write a message to ${name || `@${username}`}…`}
            className="w-full resize-none rounded-xl border border-border bg-background p-3 text-sm outline-none focus:border-primary"
          />
          {error && (
            <p className="mt-2 text-sm text-red-600">Could not send that message. Try again.</p>
          )}
          <div className="mt-4 flex items-center justify-end gap-2">
            <button
              onClick={onClose}
              className="cursor-pointer rounded-full border border-border px-4 py-2 text-sm font-semibold hover:bg-muted"
            >
              Cancel
            </button>
            <button
              onClick={send}
              disabled={busy || body.trim().length === 0}
              className="cursor-pointer rounded-full bg-galli px-5 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
            >
              {busy ? 'Sending…' : 'Send'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
