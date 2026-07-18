'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function NewCommunityModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  if (!open) return null

  const submit = async () => {
    if (busy) return
    setBusy(true); setError('')
    try {
      const res = await fetch('/api/hubs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: name.trim() || 'Untitled Community', community: true }),
      })
      if (!res.ok) { setError('Could not create community. Try again.'); return }
      const hub = await res.json()
      router.push(`/hubs/${hub.id}`)
    } catch {
      setError('Could not create community. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
        <div className="w-full max-w-md bg-surface border border-border rounded-2xl shadow-soft-lg p-6" onClick={(e) => e.stopPropagation()}>
          <h2 className="text-lg font-bold text-foreground">New community</h2>
          <p className="text-sm text-muted-foreground mt-1">Give your community a name. You can change it later.</p>
          <input
            autoFocus
            type="text"
            placeholder="Community name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') submit() }}
            className="mt-4 w-full px-3 py-2.5 bg-muted border border-border rounded-xl outline-none focus:ring-2 focus:ring-ring text-sm"
          />
          {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
          <div className="flex justify-end gap-2 mt-5">
            <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground">Cancel</button>
            <button onClick={submit} disabled={busy} className="px-4 py-2 text-sm font-semibold text-white bg-primary rounded-xl hover:bg-primary/90 disabled:opacity-60">
              {busy ? 'Creating…' : 'Create community'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
