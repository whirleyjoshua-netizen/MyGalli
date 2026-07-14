'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function CreateWorkspaceModal({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function create() {
    if (!name.trim()) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Failed')
      const ws = await res.json()
      router.push(`/workspaces/${ws.id}`)
    } catch (e: any) {
      setError(e.message)
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-surface p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-4 text-lg font-bold">New workspace</h2>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && create()}
          placeholder="e.g. Students"
          className="w-full rounded-lg border border-border bg-transparent px-3 py-2"
        />
        {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-muted-foreground">Cancel</button>
          <button onClick={create} disabled={busy || !name.trim()} className="rounded-lg bg-galli px-4 py-2 font-medium text-white disabled:opacity-50">
            {busy ? 'Creating…' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  )
}
