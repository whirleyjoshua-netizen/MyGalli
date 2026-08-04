'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

export function CrmAddContactDialog({
  onCancel,
  onCreate,
}: {
  onCancel: () => void
  onCreate: (name: string, email: string) => Promise<boolean>
}) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [saving, setSaving] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  if (!mounted) return null

  // The API accepts a contact with either field; requiring both here would be
  // stricter than the route and block the walk-in case the manual merge key
  // exists for.
  const canSubmit = Boolean(name.trim() || email.trim()) && !saving

  const submit = async () => {
    if (!canSubmit) return
    setSaving(true)
    const ok = await onCreate(name.trim(), email.trim())
    setSaving(false)
    // On failure the board surfaces the error; keep the dialog open so the
    // typed values are not lost.
    if (ok) onCancel()
  }

  return createPortal(
    // Portalled to <body>: the board renders inside the dashboard's sticky
    // sidebar subtree, and `position: sticky` creates a stacking context that
    // would trap a `fixed z-50` overlay beneath the main content.
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={() => !saving && onCancel()}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-2xl border border-border bg-surface p-5 shadow-soft-lg"
      >
        <h2 className="font-bold">Add a contact</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          For someone who reached you off-page. Give an email and their future
          bookings and form submits will merge onto this contact.
        </p>

        <label className="mt-4 block text-xs font-semibold text-muted-foreground">
          Name
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={120}
            className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm font-normal text-foreground"
          />
        </label>

        <label className="mt-3 block text-xs font-semibold text-muted-foreground">
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            maxLength={254}
            className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm font-normal text-foreground"
          />
        </label>

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="rounded-full border border-border px-3 py-1.5 text-sm font-semibold hover:bg-muted disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!canSubmit}
            aria-busy={saving}
            className="rounded-full bg-galli px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
          >
            {saving ? 'Adding…' : 'Add contact'}
          </button>
        </div>
      </form>
    </div>,
    document.body
  )
}
