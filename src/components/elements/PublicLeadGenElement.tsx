'use client'

import { useState } from 'react'
import type { CanvasElement } from '@/lib/types/canvas'
import { isValidEmail } from '@/lib/lead-gen'
import { trackInteraction } from '@/lib/analytics'

export function PublicLeadGenElement({
  element,
  displayId,
}: {
  element: CanvasElement
  displayId: string
}) {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [hp, setHp] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'done' | 'error'>('idle')
  const [file, setFile] = useState<{ url?: string; name?: string }>({})

  const collectName = element.leadGenCollectName ?? false

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isValidEmail(email) || status === 'sending') return
    setStatus('sending')
    try {
      const res = await fetch(`/api/lead-gen/${displayId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          elementId: element.id,
          email: email.trim(),
          name: collectName ? name.trim() : undefined,
          hp,
        }),
      })
      if (!res.ok) {
        setStatus('error')
        return
      }
      const data = await res.json().catch(() => ({}))
      setFile({ url: data.fileUrl, name: data.fileName })
      setStatus('done')
      void trackInteraction(displayId, element.id, 'lead-gen', 'submit')
    } catch {
      setStatus('error')
    }
  }

  if (status === 'done') {
    return (
      <div className="rounded-2xl border border-border bg-surface p-5 text-center space-y-3 shadow-soft">
        <p className="text-sm font-semibold text-galli-dark">
          {element.leadGenSuccessText || 'Check your inbox! 📬'}
        </p>
        {file.url && (
          <a
            href={file.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-soft transition hover:brightness-105"
          >
            Download {file.name || 'your file'}
          </a>
        )}
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-5 shadow-soft">
      <form onSubmit={submit} className="space-y-3">
        {element.leadGenHeadline && (
          <h3 className="text-xl font-extrabold tracking-tight">{element.leadGenHeadline}</h3>
        )}

        {/* Honeypot: hidden from people, catches naive bots. */}
        <input
          name="hp"
          value={hp}
          onChange={(e) => setHp(e.target.value)}
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          className="hidden"
          style={{ display: 'none' }}
        />

        {collectName && (
          <input
            aria-label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none"
          />
        )}
        <input
          aria-label="Email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none"
        />
        <button
          type="submit"
          disabled={status === 'sending'}
          className="w-full rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-soft transition hover:brightness-105 disabled:opacity-50"
        >
          {status === 'sending' ? 'Sending…' : element.leadGenButtonLabel || 'Send it to me'}
        </button>
        {status === 'error' && (
          <p className="text-xs text-destructive">Something went wrong. Please try again.</p>
        )}
      </form>
    </div>
  )
}
